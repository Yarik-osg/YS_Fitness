'use client';

import { usePathname } from '@/i18n/navigation';
import {
  createScanDetector,
  type ScanDetector,
} from '@/lib/food/barcode-engine';
import { confirmDetection } from '@/lib/food/barcode';
import { useCallback, useEffect, useRef, useState } from 'react';

const FRAME_MS = 160;

export type ScannerPhase =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'denied'
  | 'no-camera'
  | 'insecure'
  | 'paused';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function torchCapable(track: MediaStreamTrack): boolean {
  const capabilities = track.getCapabilities?.() as
    { torch?: boolean } | undefined;
  return capabilities?.torch === true;
}

async function setTorch(track: MediaStreamTrack, on: boolean) {
  await track.applyConstraints({
    advanced: [{ torch: on } as MediaTrackConstraintSet],
  });
}

export function useBarcodeScanner(
  active: boolean,
  onCode: (code: string) => void,
) {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const streamRef = useRef<MediaStream | null>(null);
  const openedOn = useRef<string | null>(null);
  const [phase, setPhase] = useState<ScannerPhase>('idle');
  const [torch, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!active) {
      stopStream(streamRef.current);
      streamRef.current = null;
      openedOn.current = null;
      return;
    }
    if (openedOn.current && openedOn.current !== pathname) {
      stopStream(streamRef.current);
      streamRef.current = null;
      const notify = window.setTimeout(() => {
        setPhase('paused');
        setCanTorch(false);
      }, 0);
      return () => window.clearTimeout(notify);
    }
    openedOn.current = pathname;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let cancelled = false;
    let timer = 0;
    let detector: ScanDetector | null = null;
    const owned: MediaStream[] = [];

    function release() {
      window.clearTimeout(timer);
      for (const stream of owned) stopStream(stream);
      owned.length = 0;
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    let previous: string | null = null;
    async function loop() {
      if (cancelled || document.hidden) return;
      const video = videoRef.current;
      if (detector && video && video.readyState >= 2) {
        try {
          const hits = await detector.detect(video);
          for (const hit of hits) {
            const next = confirmDetection(previous, hit);
            previous = next.previous;
            if (next.code) {
              if (typeof navigator.vibrate === 'function')
                navigator.vibrate(40);
              onCodeRef.current(next.code);
              return;
            }
          }
        } catch {
          // A single frame can fail while the camera is still starting.
        }
      }
      if (!cancelled && !document.hidden) {
        timer = window.setTimeout(() => void loop(), FRAME_MS);
      }
    }

    function onHide() {
      if (!document.hidden) return;
      release();
      if (!cancelled) setPhase('paused');
    }

    async function start() {
      setPhase('requesting');
      setCanTorch(false);
      setTorchOn(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        owned.push(stream);
        if (cancelled || document.hidden) {
          release();
          if (!cancelled && document.hidden) setPhase('paused');
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (track && torchCapable(track)) setCanTorch(true);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play?.().catch(() => undefined);
        }
        const created = await createScanDetector();
        if (cancelled) {
          release();
          return;
        }
        detector = created.detector;
        setPhase('scanning');
        void loop();
      } catch (error) {
        release();
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setPhase('denied');
          return;
        }
        if (name === 'SecurityError') {
          setPhase('insecure');
          return;
        }
        setPhase('no-camera');
      }
    }

    document.addEventListener('visibilitychange', onHide);
    void start();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onHide);
      release();
    };
  }, [active, pathname, session]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchCapable(track)) return;
    const next = !torch;
    await setTorch(track, next);
    setTorchOn(next);
  }

  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    const stream = streamRef.current;
    if (!node || !stream) return;
    node.srcObject = stream;
    void node.play?.().catch(() => undefined);
  }, []);

  const environment: ScannerPhase | null =
    !active || typeof window === 'undefined'
      ? null
      : !window.isSecureContext
        ? 'insecure'
        : !navigator.mediaDevices?.getUserMedia
          ? 'no-camera'
          : null;

  return {
    bindVideo,
    phase: !active ? 'idle' : (environment ?? phase),
    canTorch: active && canTorch,
    torch,
    toggleTorch,
    restart: () => setSession((value) => value + 1),
  };
}
