'use client';

import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, useGLTF } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import {
  ACESFilmicToneMapping,
  MeshStandardMaterial,
  type Group,
  type Mesh,
} from 'three';

const MODEL_URL = {
  male: '/models/body_male.glb',
  female: '/models/body_female.glb',
} as const;

// The default camera looks at the origin, which is the feet, so only the
// legs stay in frame. Aim at mid-height instead.
const FRAME_Y = 0.86;
// World height of the orthographic frame. The body is about 1.65–1.75 m.
const FRAME_HEIGHT = 1.82;
const BODY_COLOR = '#F4F2EC';
const SHAPE_KEYS = ['muscle', 'fat', 'muscle_fat_corr'] as const;

function applyShape(root: Group, muscle: number, fat: number) {
  const m = muscle / 100;
  const f = fat / 100;
  const values = [m, f, m * f];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    const influences = mesh.morphTargetInfluences;
    const names = mesh.morphTargetDictionary;
    if (!influences || !names) return;
    SHAPE_KEYS.forEach((name, index) => {
      const target = names[name];
      if (target !== undefined) influences[target] = values[index] ?? 0;
    });
  });
}

function mannequinMaterial() {
  return new MeshStandardMaterial({
    color: BODY_COLOR,
    roughness: 0.7,
    metalness: 0,
    flatShading: false,
    envMapIntensity: 0,
  });
}

function Figure({
  sex,
  muscle,
  fat,
  view,
}: {
  sex: 'male' | 'female';
  muscle: number;
  fat: number;
  view: 'front' | 'back';
}) {
  const gltf = useGLTF(MODEL_URL[sex], undefined, true);
  const fitted = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const material = mannequinMaterial();
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
    });
    return { scene, material };
  }, [gltf.scene]);
  const group = useRef<Group>(null);
  const applied = useRef({ muscle: Number.NaN, fat: Number.NaN, view: '' });

  useEffect(() => {
    const { material } = fitted;
    return () => material.dispose();
  }, [fitted]);

  useFrame(() => {
    const root = group.current;
    if (!root) return;
    if (applied.current.view !== view) {
      root.rotation.y = view === 'back' ? Math.PI : 0;
      applied.current.view = view;
    }
    if (applied.current.muscle === muscle && applied.current.fat === fat)
      return;
    applyShape(root, muscle, fat);
    applied.current.muscle = muscle;
    applied.current.fat = fat;
  });

  return (
    <group ref={group}>
      <primitive object={fitted.scene} />
      <directionalLight
        position={[1.4, 2.4, 1.4]}
        intensity={1.45}
        color="#fff8f1"
      />
      <directionalLight
        position={[-1.7, 0.8, 0.5]}
        intensity={0.32}
        color="#f3ece4"
      />
    </group>
  );
}

function Aim() {
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  // Fiber resets an automatic ortho camera to a pixel frustum, which makes
  // the body a speck on a short phone canvas. Own the frustum instead.
  const aspect = width / Math.max(height, 1);
  const frameWidth = FRAME_HEIGHT * aspect;
  return (
    <OrthographicCamera
      makeDefault
      manual
      near={0.01}
      far={20}
      zoom={1}
      position={[0, FRAME_Y, 4]}
      top={FRAME_HEIGHT / 2}
      bottom={-FRAME_HEIGHT / 2}
      left={-frameWidth / 2}
      right={frameWidth / 2}
    />
  );
}

class BodyMeshErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <div className="h-full min-h-0 w-full" />;
    return this.props.children;
  }
}

export function BodyMesh({
  sex,
  muscle,
  fat,
  view,
}: {
  sex: 'male' | 'female';
  muscle: number;
  fat: number;
  view: 'front' | 'back';
}) {
  return (
    <BodyMeshErrorBoundary key={sex}>
      <div className="h-full min-h-0 w-full">
        <Canvas
          gl={{
            alpha: true,
            antialias: true,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
        >
          <Aim />
          <hemisphereLight args={['#f7f4ee', '#1c1916', 0.5]} />
          <Suspense fallback={null}>
            <Figure key={sex} sex={sex} muscle={muscle} fat={fat} view={view} />
          </Suspense>
          <EffectComposer multisampling={0} enableNormalPass>
            <SSAO
              radius={0.12}
              intensity={18}
              luminanceInfluence={0.5}
              samples={16}
            />
          </EffectComposer>
        </Canvas>
      </div>
    </BodyMeshErrorBoundary>
  );
}

useGLTF.preload(MODEL_URL.male, undefined, true);
useGLTF.preload(MODEL_URL.female, undefined, true);
