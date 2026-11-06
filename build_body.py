"""Build a posed MPFB body with muscle and fat shape keys, then export a GLB.

Blender 5.2.3 and MPFB 2.0.18. The mesh is one shell. React Three Fiber drives
mesh.morphTargetInfluences in the order muscle, fat, muscle_fat_corr.

  Blender -b -P build_body.py -- --sex male --out apps/web/public/models/body_male.glb --render
  Blender -b -P build_body.py -- --sex female --out apps/web/public/models/body_female.glb --render
"""

import array
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
import traceback
import zlib

import bpy
from mathutils import Quaternion, Vector

# MPFB muscle and weight macros for the four baked corners. The exported
# sliders stay 0..1. These values are the targets themselves: a linear map
# from the slider made muscle=1 look thin and muscle=1 with fat=1 cartoonish.
# D keeps weight at 1 and a low muscle value. Higher muscle deletes the belly.
CORNERS = {
    "male": {
        "A": (0.25, 0.30),
        "B": (1.00, 0.45),
        "C": (0.25, 1.00),
        "D": (0.35, 1.00),
    },
    "female": {
        "A": (0.25, 0.30),
        "B": (0.90, 0.45),
        "C": (0.25, 1.00),
        "D": (0.40, 1.00),
    },
}

# Extra sculpt targets baked into a corner, on top of the muscle/weight macros.
# Names are file stems from the installed MPFB targets folder. There is no
# separate biceps, triceps, trapezius, or quadriceps file: upper-arm muscle,
# torso-vshape, and upper-leg muscle are the real stand-ins. A is empty.
# D keeps the stronger of the muscle and fat weights when a name is in both.
def _sides(stem, weight):
    return {f"l-{stem}": weight, f"r-{stem}": weight}


def _combine(*groups):
    combined = {}
    for group in groups:
        for name, weight in group.items():
            combined[name] = max(combined.get(name, 0.0), weight)
    return combined


_MUSCLE_DETAILS = {
    "torso-muscle-pectoral-incr": 0.55,
    **_sides("upperarm-shoulder-muscle-incr", 0.60),
    **_sides("upperarm-muscle-incr", 0.55),
    **_sides("lowerarm-muscle-incr", 0.40),
    "torso-vshape-incr": 0.40,
    "torso-muscle-dorsi-incr": 0.50,
    **_sides("upperleg-muscle-incr", 0.50),
    **_sides("lowerleg-muscle-incr", 0.45),
    "buttocks-volume-incr": 0.35,
}
_FAT_DETAILS = {
    "stomach-tone-decr": 0.70,
    "hip-scale-horiz-incr": 0.40,
    "hip-scale-depth-incr": 0.25,
    **_sides("upperleg-fat-incr", 0.50),
    "buttocks-volume-incr": 0.40,
    "neck-double-incr": 0.45,
    "neck-scale-horiz-incr": 0.30,
    "chin-width-incr": 0.20,
    "torso-scale-depth-incr": 0.28,
    "neck-back-scale-depth-incr": 0.25,
    "pelvis-tone-decr": 0.35,
}
# Width is the mask cutoff. Softness is the gaussian sigma. Width is about
# 3 sigma, so the groove fades out instead of ending in a step. Depths are
# meters on the height-fitted body and push the surface inward along its normal.
# width is the outer reach in metres. softness is the gaussian sigma: keep it
# near width * 0.6 so the rim falls off instead of ending in a cut.
# form bulge pushes out; valley presses in. Fat folds stay deeper than muscle.
DETAIL_CONFIG = {
    "muscle": {
        "linea_alba": {"width": 0.020, "depth": 0.0010, "softness": 0.012, "form": "valley"},
        "abs_block": {"width": 0.036, "depth": 0.0015, "softness": 0.022, "form": "bulge"},
        "pec_arc": {"width": 0.030, "depth": 0.0011, "softness": 0.018, "form": "valley"},
        "pec_belly": {"width": 0.058, "depth": 0.0016, "softness": 0.034, "form": "bulge"},
        "delt_arc": {"width": 0.028, "depth": 0.0010, "softness": 0.016, "form": "valley"},
        "delt_belly": {"width": 0.048, "depth": 0.0014, "softness": 0.028, "form": "bulge"},
        "biceps": {"width": 0.034, "depth": 0.0013, "softness": 0.020, "form": "bulge"},
        "spine": {"width": 0.024, "depth": 0.0011, "softness": 0.014, "form": "valley"},
        "trap": {"width": 0.060, "depth": 0.0015, "softness": 0.036, "form": "bulge"},
        "lat": {"width": 0.064, "depth": 0.0014, "softness": 0.038, "form": "bulge"},
        "scapula": {"width": 0.052, "depth": 0.0015, "softness": 0.030, "form": "bulge"},
        "quad": {"width": 0.032, "depth": 0.0013, "softness": 0.020, "form": "bulge"},
        "calf_split": {"width": 0.022, "depth": 0.0009, "softness": 0.013, "form": "valley"},
    },
    "fat": {
        "inframammary": {"width": 0.036, "depth": 0.0036, "softness": 0.020, "form": "valley"},
        "inguinal": {"width": 0.034, "depth": 0.0032, "softness": 0.018, "form": "valley"},
        "love_handle": {"width": 0.040, "depth": 0.0034, "softness": 0.022, "form": "valley"},
        "lumbar": {"width": 0.038, "depth": 0.0030, "softness": 0.020, "form": "valley"},
        "gluteal_fold": {"width": 0.036, "depth": 0.0038, "softness": 0.020, "form": "valley"},
        "knee": {"width": 0.028, "depth": 0.0022, "softness": 0.015, "form": "valley"},
        "thigh": {"width": 0.034, "depth": 0.0026, "softness": 0.018, "form": "valley"},
        "arm": {"width": 0.024, "depth": 0.0018, "softness": 0.013, "form": "valley"},
        "chin": {"width": 0.026, "depth": 0.0020, "softness": 0.014, "form": "valley"},
    },
}

# Helper cubes on the posed basemesh. Names are the keys of
# mpfb/data/mesh_metadata/basemesh_vertex_groups.json. They are not skin
# weights: each one is eight vertices, and helper removal deletes them.
LANDMARK_GROUPS = (
    "joint-pelvis",
    "joint-spine-1",
    "joint-spine-2",
    "joint-spine-3",
    "joint-spine-4",
    "joint-neck",
    "joint-head",
    "joint-jaw",
    "joint-l-clavicle",
    "joint-r-clavicle",
    "joint-l-shoulder",
    "joint-r-shoulder",
    "joint-l-elbow",
    "joint-r-elbow",
    "joint-l-scapula",
    "joint-r-scapula",
    "joint-l-upper-leg",
    "joint-r-upper-leg",
    "joint-l-knee",
    "joint-r-knee",
    "joint-l-ankle",
    "joint-r-ankle",
    "joint-l-hand",
    "joint-r-hand",
    "joint-l-eye",
    "joint-r-eye",
)
MASK_GROUPS = ("Mid", "Left", "Right")
NORMAL_SIZE = 2048
BAKE_MARGIN = 16
UV_OVERLAP_LIMIT = 0.01
# Multiplies every DETAIL_CONFIG depth. The export writes 1.0 and 1.6.
DETAIL_GAIN = 1.0
DETAIL_GAIN_EXPORTS = (1.0, 1.6)
# Short ray stays off thin shells. The torso bake reaches deeper grooves.
SHORT_CAGE = 0.008
SHORT_RAY = 0.015
LONG_CAGE = 0.02
LONG_RAY = 0.045
PEAK_DEVIATION = 0.3
ISLAND_FEATHER = 8
# Delt facets survive the bake. A 3 px blur on the shoulder cap knocks them down.
SHOULDER_BLUR_PX = 3
SHOULDER_REACH = 0.14

_FEMALE_MUSCLE = {**_MUSCLE_DETAILS, "torso-muscle-pectoral-incr": 0.28}
DETAIL_TARGETS = {
    "male": {
        "A": {},
        "B": _MUSCLE_DETAILS,
        "C": _FAT_DETAILS,
        "D": _combine(_MUSCLE_DETAILS, _FAT_DETAILS),
    },
    "female": {
        "A": {},
        "B": _FEMALE_MUSCLE,
        "C": _FAT_DETAILS,
        "D": _combine(_FEMALE_MUSCLE, _FAT_DETAILS),
    },
}

# MPFB_OT_CreateHumanOperator: Meter is the default and uses scale 0.1.
METER_SCALE = 0.1
# phenotype influence 1.0: male is 0.5 + 0.5, female is 0.5 - 0.5.
MALE_GENDER = 1.0
FEMALE_GENDER = 0.0
YOUNG_AGE = 0.5
# add_breast False. This is the pair calculate_target_stack excludes.
NEUTRAL_BREAST = 0.5
# New-human panel defaults when breast targets are enabled: maxcup and
# maxfirmness at breast_influence 0.1, so both macros are 0.5 + 0.1 * 0.5.
BREAST_INFLUENCE = 0.1

ARM_ANGLE_DEG = 12.0
ELBOW_BEND_DEG = 0.0
PALM_RELAX_DEG = 0.0
# The default rig already stands with the ankles about 0.40 m apart. Negative
# turns the thighs inward. -4 puts the ankles near 0.28 m.
LEG_SPREAD_DEG = -4.0

# MPFB's height slider is not centimeters. Bodies are built at height 0.5
# (average) and then scaled so the basis matches these standing heights.
HEIGHT_CM = {"male": 175, "female": 165}

BODY_COLOR = (0xF4 / 255, 0xF2 / 255, 0xEC / 255, 1.0)
ROUGHNESS = 0.7

ARM_BONES = ("upperarm01.L", "upperarm02.L", "lowerarm01.L", "lowerarm02.L")
TORSO_BONES = ("spine01", "spine02", "spine03", "spine04", "spine05")
SHAPE_KEYS = ("muscle", "fat", "muscle_fat_corr")
CORNER_ORDER = ("A", "B", "C", "D")
RENDER_STATES = ((0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0), (0.5, 0.5))
# Share of standing height used for the belly girth. The navel on these
# average-height bodies sits just above the waist, near 58% of stature.
NAVEL_RATIO = 0.58
NAVEL_BAND_M = 0.015

ADDON_MODULE = "bl_ext.blender_org.mpfb"
WARN_CM = 1.0


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def arguments():
    if "--" not in sys.argv:
        fail("Missing arguments after --")
    raw = sys.argv[sys.argv.index("--") + 1 :]
    parsed = {}
    index = 0
    while index < len(raw):
        token = raw[index]
        if token == "--render":
            parsed["render"] = True
            index += 1
            continue
        if not token.startswith("--"):
            fail(f"Unexpected argument: {token}")
        name = token[2:]
        if index + 1 >= len(raw):
            fail(f"Missing value for --{name}")
        parsed[name] = raw[index + 1]
        index += 2
    sex = parsed.get("sex")
    if sex not in HEIGHT_CM:
        fail("--sex must be male or female")
    if "out" not in parsed:
        fail("Missing --out")
    return sex, os.path.abspath(parsed["out"]), bool(parsed.get("render"))


def enable_mpfb():
    if ADDON_MODULE not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module=ADDON_MODULE)
    from bl_ext.blender_org.mpfb.services import ExportService, HumanService, RigService, TargetService

    return ExportService, HumanService, RigService, TargetService


def macro_details(TargetService, sex, muscle, weight):
    details = TargetService.get_default_macro_info_dict()
    details["gender"] = MALE_GENDER if sex == "male" else FEMALE_GENDER
    details["age"] = YOUNG_AGE
    details["race"] = {"african": 0.33, "asian": 0.33, "caucasian": 0.33}
    details["muscle"] = muscle
    details["weight"] = weight
    details["proportions"] = 0.5
    details["height"] = 0.5
    if sex == "female":
        details["cupsize"] = NEUTRAL_BREAST + BREAST_INFLUENCE * 0.5
        details["firmness"] = NEUTRAL_BREAST + BREAST_INFLUENCE * 0.5
    else:
        details["cupsize"] = NEUTRAL_BREAST
        details["firmness"] = NEUTRAL_BREAST
    return details


def rotate_world_y(pose_bone, degrees):
    pose_bone.rotation_mode = "QUATERNION"
    pose_bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    axis = (pose_bone.matrix.to_3x3().inverted() @ Vector((0.0, 1.0, 0.0))).normalized()
    pose_bone.rotation_quaternion = Quaternion(axis, math.radians(degrees))
    bpy.context.view_layer.update()


def frontal_arm_angle(upper, wrist):
    direction = wrist.tail - upper.head
    flat = Vector((direction.x, 0.0, direction.z))
    if flat.length < 1e-8:
        fail("Arm direction has no frontal component")
    return math.degrees(flat.angle(Vector((0.0, 0.0, -1.0))))


def pose_body(armature, RigService):
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")

    upper_l = RigService.find_pose_bone_by_name("upperarm01.L", armature)
    upper_r = RigService.find_pose_bone_by_name("upperarm01.R", armature)
    wrist_l = RigService.find_pose_bone_by_name("wrist.L", armature)
    wrist_r = RigService.find_pose_bone_by_name("wrist.R", armature)
    lower_l = RigService.find_pose_bone_by_name("lowerarm01.L", armature)
    lower_r = RigService.find_pose_bone_by_name("lowerarm01.R", armature)
    leg_l = RigService.find_pose_bone_by_name("upperleg01.L", armature)
    leg_r = RigService.find_pose_bone_by_name("upperleg01.R", armature)
    foot_l = RigService.find_pose_bone_by_name("foot.L", armature)
    foot_r = RigService.find_pose_bone_by_name("foot.R", armature)
    bones = (upper_l, upper_r, wrist_l, wrist_r, lower_l, lower_r, leg_l, leg_r, foot_l, foot_r)
    if any(bone is None for bone in bones):
        fail("Default rig is missing an arm or leg bone")

    drop = frontal_arm_angle(upper_l, wrist_l) - ARM_ANGLE_DEG
    rotate_world_y(upper_l, drop)
    rotate_world_y(upper_r, -drop)
    if ELBOW_BEND_DEG:
        rotate_world_y(lower_l, ELBOW_BEND_DEG)
        rotate_world_y(lower_r, -ELBOW_BEND_DEG)
    if PALM_RELAX_DEG:
        for wrist, sign in ((wrist_l, 1.0), (wrist_r, -1.0)):
            wrist.rotation_mode = "XYZ"
            wrist.rotation_euler.y = math.radians(PALM_RELAX_DEG * sign)
        bpy.context.view_layer.update()

    # Only the thigh turns. The knee and shin inherit it. The foot turns back
    # around the ankle so the toes keep pointing forward.
    rotate_world_y(leg_l, -LEG_SPREAD_DEG)
    rotate_world_y(leg_r, LEG_SPREAD_DEG)
    rotate_world_y(foot_l, LEG_SPREAD_DEG)
    rotate_world_y(foot_r, -LEG_SPREAD_DEG)

    knee_l = RigService.find_pose_bone_by_name("lowerleg01.L", armature)
    knee_r = RigService.find_pose_bone_by_name("lowerleg01.R", armature)
    if knee_l is None or knee_r is None:
        fail("Default rig is missing a knee bone")
    knee_distance = (knee_l.head - knee_r.head).length
    ankle_distance = (foot_l.head - foot_r.head).length
    bpy.ops.object.mode_set(mode="OBJECT")
    return frontal_arm_angle(upper_l, wrist_l), knee_distance, ankle_distance


def weighted_vertices(obj, names, minimum):
    chosen = set()
    for name in names:
        group = obj.vertex_groups.get(name)
        if group is None:
            continue
        index = group.index
        for vertex in obj.data.vertices:
            for item in vertex.groups:
                if item.group == index and item.weight >= minimum:
                    chosen.add(vertex.index)
                    break
    return chosen


def closest_distance(coords, left, right):
    if not left or not right:
        return None
    best = None
    for index in left:
        point = coords[index]
        for other in right:
            distance = (point - coords[other]).length
            if best is None or distance < best:
                best = distance
    return best


def apply_armature(body):
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="OBJECT")
    names = [modifier.name for modifier in body.modifiers if modifier.type == "ARMATURE"]
    if not names:
        fail("Body has no Armature modifier to apply")
    for name in names:
        bpy.ops.object.modifier_apply(modifier=name)


def plant_feet(obj):
    lowest = min(vertex.co.z for vertex in obj.data.vertices)
    obj.location = (0.0, 0.0, -lowest)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def drop_other_objects(body):
    for obj in list(bpy.data.objects):
        if obj != body:
            bpy.data.objects.remove(obj, do_unlink=True)


def snapshot(obj):
    coords = [vertex.co.copy() for vertex in obj.data.vertices]
    faces = [tuple(polygon.vertices) for polygon in obj.data.polygons]
    return coords, faces


def same_topology(reference, faces, label):
    if len(faces) != len(reference):
        fail(f"{label} has {len(faces)} faces, the basis has {len(reference)}")
    for index, (left, right) in enumerate(zip(reference, faces)):
        if left != right:
            fail(f"{label} face {index} differs from the basis: {left} vs {right}")


def discard(obj):
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def blended_details(sex):
    # The 0.5/0.5 shape-key mix is one quarter of each baked corner.
    combined = {}
    for corner in CORNER_ORDER:
        for name, weight in DETAIL_TARGETS[sex][corner].items():
            combined[name] = combined.get(name, 0.0) + weight * 0.25
    return combined


def load_details(TargetService, body, details):
    stack = [
        {"target": name, "value": weight}
        for name, weight in details.items()
        if weight > 0.0
    ]
    if stack:
        TargetService.bulk_load_targets(body, stack)


def build_variant(services, sex, muscle, weight, details):
    ExportService, HumanService, RigService, TargetService = services
    body = HumanService.create_human(
        mask_helpers=True,
        detailed_helpers=True,
        extra_vertex_groups=True,
        feet_on_ground=True,
        scale=METER_SCALE,
        macro_detail_dict=macro_details(TargetService, sex, muscle, weight),
    )
    if sex == "female":
        # Full decrease, baked in with the macros. The mannequin should not
        # show a pointed nipple.
        TargetService.bulk_load_targets(
            body,
            [
                {"target": "nipple-point-decr", "value": 1.0},
                {"target": "nipple-size-decr", "value": 1.0},
            ],
        )
    load_details(TargetService, body, details)
    if body.data.shape_keys:
        TargetService.bake_targets(body)
    if body.data.shape_keys and body.data.shape_keys.key_blocks:
        names = [key.name for key in body.data.shape_keys.key_blocks]
        fail(f"Shape keys remained after bake: {names}")

    armature = HumanService.add_builtin_rig(body, "default")
    if armature is None:
        fail("MPFB did not create the default rig")
    pose = pose_body(armature, RigService)

    shell = weighted_vertices(body, ("body",), 0.5)
    raw_landmarks = landmark_centroids(body)
    mask_groups = {
        name: weighted_vertices(body, (name,), 0.5) & shell for name in MASK_GROUPS
    }
    arm = weighted_vertices(body, ARM_BONES, 0.5) & shell
    torso = (weighted_vertices(body, TORSO_BONES, 0.5) & shell) - arm
    apply_armature(body)
    posed = [vertex.co.copy() for vertex in body.data.vertices]
    arm_gap = closest_distance(posed, arm, torso)
    # The raw minimum sits on the armpit seam, where the two groups meet.
    # The second distance ignores that top band and measures the hanging arm.
    if arm:
        cutoff = max(posed[index].z for index in arm) - 0.12
        hanging = {index for index in arm if posed[index].z < cutoff}
        arm_gap_hanging = closest_distance(posed, hanging, torso)
    else:
        arm_gap_hanging = None

    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    ExportService.bake_modifiers_remove_helpers(
        body,
        bake_masks=True,
        bake_subdiv=False,
        remove_helpers=True,
        also_proxy=False,
    )
    if body.data.shape_keys and body.data.shape_keys.key_blocks:
        names = [key.name for key in body.data.shape_keys.key_blocks]
        fail(f"Shape keys remained after helper removal: {names}")
    for group in list(body.vertex_groups):
        body.vertex_groups.remove(group)
    before_plant = body.data.vertices[0].co.copy()
    plant_feet(body)
    plant_delta = body.data.vertices[0].co - before_plant
    drop_other_objects(body)
    coords, faces = snapshot(body)
    discard(body)
    return {
        "coords": coords,
        "faces": faces,
        "pose": pose,
        "arm_gap": arm_gap,
        "arm_gap_hanging": arm_gap_hanging,
        "landmarks": {name: point + plant_delta for name, point in raw_landmarks.items()},
        "mask_groups": mask_groups,
    }


def convex_perimeter(points):
    unique = sorted({(round(point.x, 5), round(point.y, 5)) for point in points})
    if len(unique) < 3:
        return None

    def turn(origin, left, right):
        return (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0])

    lower = []
    for point in unique:
        while len(lower) >= 2 and turn(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper = []
    for point in reversed(unique):
        while len(upper) >= 2 and turn(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    hull = lower[:-1] + upper[:-1]
    length = 0.0
    for index, point in enumerate(hull):
        nxt = hull[(index + 1) % len(hull)]
        length += math.hypot(nxt[0] - point[0], nxt[1] - point[1])
    return length


def belly_girth(coords):
    """Circumference of the torso at navel height, arms left out of the slice."""
    height = max(point.z for point in coords)
    level = height * NAVEL_RATIO
    band = [point for point in coords if abs(point.z - level) <= NAVEL_BAND_M]
    if len(band) < 24:
        band = [point for point in coords if abs(point.z - level) <= NAVEL_BAND_M * 2]
    torso = [point for point in band if abs(point.x) <= 0.08]
    rest = [point for point in band if abs(point.x) > 0.08]
    changed = True
    while changed:
        changed = False
        kept = []
        for point in rest:
            if any((point - other).length < 0.02 for other in torso):
                torso.append(point)
                changed = True
            else:
                kept.append(point)
        rest = kept
    return convex_perimeter(torso)


def correction_positions(corners):
    basis = corners["A"]
    muscle = corners["B"]
    fat = corners["C"]
    both = corners["D"]
    # Absolute positions of the relative key D - A - (B - A) - (C - A).
    return [2 * a + d - b - c for a, b, c, d in zip(basis, muscle, fat, both)]


def assemble(corners, faces):
    mesh = bpy.data.meshes.new("Body")
    mesh.from_pydata([point[:] for point in corners["A"]], [], [list(face) for face in faces])
    mesh.update()
    obj = bpy.data.objects.new("Body", mesh)
    bpy.context.scene.collection.objects.link(obj)
    basis = obj.shape_key_add(name="Basis")
    basis.interpolation = "KEY_LINEAR"
    targets = {
        "muscle": corners["B"],
        "fat": corners["C"],
        "muscle_fat_corr": correction_positions(corners),
    }
    for name in SHAPE_KEYS:
        key = obj.shape_key_add(name=name)
        key.interpolation = "KEY_LINEAR"
        key.slider_min = 0.0
        key.slider_max = 1.0
        key.value = 0.0
        key.vertex_group = ""
        for index, point in enumerate(targets[name]):
            key.data[index].co = point
    return obj


def set_influences(obj, muscle, fat, correction):
    keys = obj.data.shape_keys.key_blocks
    keys["muscle"].value = muscle
    keys["fat"].value = fat
    keys["muscle_fat_corr"].value = correction
    bpy.context.view_layer.update()


def evaluated_error(obj, reference):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    worst = 0.0
    total = 0.0
    for index, vertex in enumerate(mesh.vertices):
        distance = (vertex.co - reference[index]).length
        total += distance
        if distance > worst:
            worst = distance
    evaluated.to_mesh_clear()
    count = len(reference)
    return worst, total / count


def fit_height_and_center(obj, sex):
    coords = [vertex.co.z for vertex in obj.data.vertices]
    height = max(coords) - min(coords)
    target = HEIGHT_CM[sex] / 100.0
    if height < 1e-6:
        fail("Body has no height")
    factor = target / height
    before = obj.data.vertices[0].co.copy()
    obj.scale = (factor, factor, factor)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    xs = [vertex.co.x for vertex in obj.data.vertices]
    ys = [vertex.co.y for vertex in obj.data.vertices]
    zs = [vertex.co.z for vertex in obj.data.vertices]
    obj.location = (-(min(xs) + max(xs)) / 2.0, -(min(ys) + max(ys)) / 2.0, -min(zs))
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Uniform scale about the origin, then one translation. The same pair
    # maps pre-fit landmarks into this mesh.
    translation = obj.data.vertices[0].co - before * factor
    return factor, translation


def assign_material(obj):
    material = bpy.data.materials.new("Body")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = BODY_COLOR
    principled.inputs["Roughness"].default_value = ROUGHNESS
    principled.inputs["Metallic"].default_value = 0.0
    obj.data.materials.clear()
    obj.data.materials.append(material)


def shade_smooth(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()


def non_manifold_edges(obj):
    import bmesh

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    mesh.edges.ensure_lookup_table()
    count = sum(1 for edge in mesh.edges if not edge.is_manifold)
    mesh.free()
    return count


def ensure_uv(obj):
    if len(obj.data.uv_layers) > 0:
        return
    from bl_ext.blender_org.mpfb.services import LocationService

    path = os.path.join(LocationService.get_mpfb_data("3dobjs"), "base.obj")
    texcoords = []
    body_faces = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("vt "):
                parts = line.split()
                texcoords.append((float(parts[1]), float(parts[2])))
            elif line.startswith("f "):
                corners = []
                body = True
                for token in line.split()[1:]:
                    point, uv_index, *_rest = token.split("/")
                    vertex = int(point) - 1
                    if vertex >= 13380:
                        body = False
                        break
                    corners.append((vertex, int(uv_index) - 1))
                if body and corners:
                    body_faces.append(corners)
    polygons = obj.data.polygons
    if len(body_faces) != len(polygons):
        fail(f"Body UV faces {len(body_faces)} do not match mesh faces {len(polygons)}")
    layer = obj.data.uv_layers.new(name="UVMap")
    for polygon, corners in zip(polygons, body_faces):
        if len(polygon.loop_indices) != len(corners):
            fail(f"UV face {polygon.index} has a different corner count")
        for loop_index, (_vertex, uv_index) in zip(polygon.loop_indices, corners):
            layer.data[loop_index].uv = texcoords[uv_index]


def export_glb(path, obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    operator = bpy.ops.export_scene.gltf
    available = {prop.identifier for prop in operator.get_rna_type().properties}
    wanted = {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": True,
        "export_yup": True,
        "export_apply": False,
        "export_skins": False,
        "export_morph": True,
        "export_morph_normal": True,
        "export_morph_tangent": False,
        "export_morph_animation": False,
        "export_animations": False,
        "export_cameras": False,
        "export_lights": False,
        "export_materials": "EXPORT",
        "export_texcoords": True,
        "export_extras": False,
    }
    operator(**{key: value for key, value in wanted.items() if key in available})


def glb_document(path):
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        return None
    length = int.from_bytes(data[12:16], "little")
    return json.loads(data[20 : 20 + length])


def glb_morph_count(path):
    document = glb_document(path)
    if not document:
        return 0
    primitives = document["meshes"][0]["primitives"]
    return len(primitives[0].get("targets") or [])


def glb_has_uv(path):
    document = glb_document(path)
    if not document:
        return False
    attributes = document["meshes"][0]["primitives"][0].get("attributes") or {}
    return "TEXCOORD_0" in attributes


def compress_glb(source, destination):
    # Weld and simplify would merge or delete vertices and change the morphs.
    # prune-attributes would drop TEXCOORD_0 because the material has no texture.
    keep = [
        "--simplify",
        "false",
        "--weld",
        "false",
        "--texture-compress",
        "false",
        "--prune-attributes",
        "false",
    ]
    attempts = (
        ["npx", "-y", "@gltf-transform/cli", "optimize", source, destination, "--compress", "meshopt", *keep],
        ["npx", "-y", "@gltf-transform/cli", "optimize", source, destination, "--compress", "draco", *keep],
    )
    for command in attempts:
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0 or not os.path.isfile(destination):
            print(result.stderr[-500:] if result.stderr else "gltf-transform produced no file", flush=True)
            continue
        if glb_morph_count(destination) == len(SHAPE_KEYS):
            kind = command[command.index("--compress") + 1]
            return kind, os.path.getsize(destination)
        os.remove(destination)
        print(f"{command[-1]} dropped morph targets", flush=True)
    os.replace(source, destination)
    return "none", os.path.getsize(destination)


def write_meta(path, sex):
    payload = {
        "shapeKeys": list(SHAPE_KEYS),
        "corners": {
            name: {"muscle": muscle, "weight": weight}
            for name, (muscle, weight) in CORNERS[sex].items()
        },
        "heightCm": HEIGHT_CM[sex],
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def aim_camera(camera, location, target):
    camera.location = location
    camera.rotation_euler = (target - location).to_track_quat("-Z", "Y").to_euler()


def render_engine_name():
    names = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    for candidate in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        if candidate in names:
            return candidate
    return "BLENDER_WORKBENCH"


def add_area_light(name, location, target, energy):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = 2.4
    light.color = (1.0, 0.97, 0.93)
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def use_relief_lights(scene, center):
    scene.render.engine = render_engine_name()
    eevee = getattr(scene, "eevee", None)
    if eevee is not None and hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = 16
    if scene.world is None:
        scene.world = bpy.data.worlds.new("SheetWorld")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs[0].default_value = (0.93, 0.93, 0.91, 1.0)
        background.inputs[1].default_value = 0.12
    # Character faces -Y. The key sits 45° off that axis, up and to one side.
    add_area_light("Key", center + Vector((1.7, -1.7, 2.1)), center, 40)
    add_area_light("Fill", center + Vector((-1.5, -1.1, 1.3)), center, 12)


def use_matcap(scene):
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "MATCAP"
    shading.color_type = "MATERIAL"
    shading.background_type = "VIEWPORT"
    shading.background_color = (0.93, 0.93, 0.91)
    folder = os.path.join(bpy.utils.resource_path("LOCAL"), "datafiles", "studiolights", "matcap")
    names = sorted(os.listdir(folder)) if os.path.isdir(folder) else []
    chosen = next((name for name in names if "ceramic" in name.lower() or "clay" in name.lower()), None)
    if chosen is None and names:
        chosen = next((name for name in names if name.startswith("basic_1")), names[0])
    if chosen:
        shading.studio_light = chosen


def render_contact_sheet(obj, sex, directory):
    scene = bpy.context.scene
    scene.render.resolution_x = 420
    scene.render.resolution_y = 560
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"

    xs = [vertex.co.x for vertex in obj.data.vertices]
    ys = [vertex.co.y for vertex in obj.data.vertices]
    zs = [vertex.co.z for vertex in obj.data.vertices]
    center = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    height = max(zs) - min(zs)
    distance = height * 2.2

    camera_data = bpy.data.cameras.new("SheetCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.28
    camera_data.sensor_fit = "VERTICAL"
    camera = bpy.data.objects.new("SheetCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    views = {
        "front": center + Vector((0.0, -distance, 0.0)),
        "side": center + Vector((distance, 0.0, 0.0)),
        "back": center + Vector((0.0, distance, 0.0)),
    }
    use_relief_lights(scene, center)
    cells = []
    captions = []
    folder = tempfile.mkdtemp(prefix="ys-body-")
    for muscle, fat in RENDER_STATES:
        correction = muscle * fat
        set_influences(obj, muscle, fat, correction)
        caption = f"muscle {muscle:g} / fat {fat:g}"
        for view, location in views.items():
            captions.append(caption)
            aim_camera(camera, location, center)
            path = os.path.join(folder, f"m{muscle:g}_f{fat:g}_{view}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            cells.append(path)

    set_influences(obj, 0.0, 0.0, 0.0)
    sheet_path = os.path.join(directory, f"contact_sheet_{sex}.png")
    pack_sheet(cells, captions, len(views), sheet_path)

    use_matcap(scene)
    matcap_cells = []
    matcap_captions = []
    for muscle, fat in RENDER_STATES:
        set_influences(obj, muscle, fat, muscle * fat)
        caption = f"muscle {muscle:g} / fat {fat:g}"
        for view, location in views.items():
            matcap_captions.append(caption)
            aim_camera(camera, location, center)
            path = os.path.join(folder, f"matcap_m{muscle:g}_f{fat:g}_{view}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            matcap_cells.append(path)
    matcap_path = os.path.join(directory, f"contact_sheet_{sex}_matcap.png")
    pack_sheet(matcap_cells, matcap_captions, len(views), matcap_path)

    scene.render.engine = render_engine_name()
    scene.render.resolution_x = 480
    scene.render.resolution_y = 420
    chest = Vector((center.x, center.y, min(zs) + height * 0.62))
    camera_data.ortho_scale = height * 0.62
    close_distance = height * 1.4
    close_views = {
        "front": chest + Vector((0.0, -close_distance, 0.0)),
        "side": chest + Vector((close_distance, 0.0, 0.0)),
    }
    close_cells = []
    close_captions = []
    for name in CORNER_ORDER:
        slider = {"A": (0.0, 0.0), "B": (1.0, 0.0), "C": (0.0, 1.0), "D": (1.0, 1.0)}[name]
        set_influences(obj, slider[0], slider[1], slider[0] * slider[1])
        caption = f"{name} torso"
        for view, location in close_views.items():
            close_captions.append(caption)
            aim_camera(camera, location, chest)
            path = os.path.join(folder, f"close_{name}_{view}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            close_cells.append(path)
    close_path = os.path.join(directory, f"closeup_{sex}.png")
    pack_sheet(close_cells, close_captions, len(close_views), close_path)
    camera_data.ortho_scale = height * 1.28
    scene.render.resolution_x = 420
    scene.render.resolution_y = 560

    corner_cells = []
    corner_captions = []
    corner_views = ("front", "side")
    for name in CORNER_ORDER:
        muscle, weight = CORNERS[sex][name]
        slider = {"A": (0.0, 0.0), "B": (1.0, 0.0), "C": (0.0, 1.0), "D": (1.0, 1.0)}[name]
        set_influences(obj, slider[0], slider[1], slider[0] * slider[1])
        caption = f"{name} muscle {muscle:.2f} weight {weight:.2f}"
        for view in corner_views:
            corner_captions.append(caption)
            aim_camera(camera, views[view], center)
            path = os.path.join(folder, f"corner_{name}_{view}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            corner_cells.append(path)
    set_influences(obj, 0.0, 0.0, 0.0)
    corners_path = os.path.join(directory, f"corners_{sex}.png")
    pack_sheet(corner_cells, corner_captions, len(corner_views), corners_path)
    bpy.data.objects.remove(camera, do_unlink=True)
    return sheet_path, corners_path, matcap_path, close_path


GLYPHS = {
    " ": ["00000"] * 7,
    "(": ["00110", "01000", "10000", "10000", "10000", "01000", "00110"],
    ")": ["01100", "00010", "00001", "00001", "00001", "00010", "01100"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "a": ["00000", "01110", "00001", "01111", "10001", "10001", "01111"],
    "c": ["00000", "01110", "10001", "10000", "10000", "10001", "01110"],
    "d": ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
    "e": ["00000", "01110", "10001", "11111", "10000", "10001", "01110"],
    "f": ["00110", "01001", "01000", "11100", "01000", "01000", "01000"],
    "g": ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
    "h": ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
    "i": ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
    "k": ["10000", "10010", "10100", "11000", "10100", "10010", "10001"],
    "l": ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
    "m": ["00000", "11010", "10101", "10101", "10101", "10001", "10001"],
    "n": ["00000", "11110", "10001", "10001", "10001", "10001", "10001"],
    "o": ["00000", "01110", "10001", "10001", "10001", "10001", "01110"],
    "s": ["00000", "01111", "10000", "01110", "00001", "00001", "11110"],
    "t": ["00100", "00100", "11111", "00100", "00100", "00101", "00010"],
    "u": ["00000", "10001", "10001", "10001", "10001", "10011", "01101"],
    "w": ["00000", "10001", "10001", "10101", "10101", "10101", "01010"],
    "y": ["00000", "10001", "10001", "01010", "00100", "00100", "01000"],
}


def stamp_text(buffer, width, height, x, y_top, text, scale=2):
    for char_index, char in enumerate(text.lower()):
        glyph = GLYPHS.get(char, GLYPHS[" "])
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit != "1":
                    continue
                for step_y in range(scale):
                    for step_x in range(scale):
                        px = x + char_index * 6 * scale + col * scale + step_x
                        py = y_top - row * scale - step_y
                        if 0 <= px < width and 0 <= py < height:
                            offset = (py * width + px) * 4
                            buffer[offset : offset + 4] = [0.1, 0.1, 0.1, 1.0]


def pack_sheet(paths, captions, columns, destination):
    loaded = [bpy.data.images.load(path) for path in paths]
    width, height = loaded[0].size
    rows = math.ceil(len(paths) / columns)
    sheet = bpy.data.images.new("contact", width * columns, height * rows, alpha=False)
    buffer = [0.85] * (width * columns * height * rows * 4)
    for index, image in enumerate(loaded):
        column = index % columns
        # Image y = 0 is the bottom of the saved PNG, so the first state goes
        # on the high rows and appears at the top of the sheet.
        row = rows - 1 - index // columns
        pixels = [0.0] * (width * height * 4)
        image.pixels.foreach_get(pixels)
        for y in range(height):
            src = y * width * 4
            dst = ((row * height + y) * width * columns + column * width) * 4
            buffer[dst : dst + width * 4] = pixels[src : src + width * 4]
        for line_index, line in enumerate(captions[index].split("\n")):
            stamp_text(
                buffer,
                width * columns,
                height * rows,
                column * width + 8,
                row * height + height - 8 - line_index * 16,
                line,
            )
        bpy.data.images.remove(image)
    sheet.pixels.foreach_set(buffer)
    sheet.filepath_raw = destination
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)


def group_centroid(obj, name):
    group = obj.vertex_groups.get(name)
    if group is None:
        return None
    index = group.index
    total = Vector()
    count = 0
    for vertex in obj.data.vertices:
        for item in vertex.groups:
            if item.group == index and item.weight >= 0.5:
                total += vertex.co
                count += 1
                break
    if count == 0:
        return None
    return total / count


def landmark_centroids(obj):
    found = {}
    missing = []
    for name in LANDMARK_GROUPS:
        point = group_centroid(obj, name)
        if point is None:
            missing.append(name)
        else:
            found[name] = point
    if missing:
        fail("Missing landmark vertex groups: " + ", ".join(missing))
    return found


def place_landmarks(raw, factor, translation):
    return {name: point * factor + translation for name, point in raw.items()}


def body_frame(landmarks):
    pelvis = landmarks["joint-pelvis"]
    neck = landmarks["joint-neck"]
    up = (neck - pelvis).normalized()
    shoulder = landmarks["joint-l-shoulder"] - landmarks["joint-r-shoulder"]
    side = (shoulder - up * shoulder.dot(up)).normalized()
    front = side.cross(up)
    if front.dot(landmarks["joint-jaw"] - neck) < 0.0:
        front = -front
    return pelvis, side.normalized(), up, front.normalized()


def project_point(point, origin, side, up, front):
    delta = point - origin
    return delta.dot(side), delta.dot(up), delta.dot(front)


def frame_vertices(coords, origin, side, up, front):
    framed = []
    for co in coords:
        framed.append((*project_point(co, origin, side, up, front), co))
    return framed


def skin_point(framed, side_at, up_at, which, side_band, up_band):
    best = None
    best_score = -1e9
    for side, up, front, co in framed:
        if abs(up - up_at) > up_band or abs(side - side_at) > side_band:
            continue
        score = -abs(front) if which == 0 else front * which
        if score > best_score:
            best_score = score
            best = co
    return best


def skin_line(framed, samples):
    points = []
    fades = []
    for sample in samples:
        side_at, up_at, which = sample[0], sample[1], sample[2]
        fade = sample[3] if len(sample) > 3 else 1.0
        hit = None
        for scale in (1.0, 2.0, 4.0):
            hit = skin_point(framed, side_at, up_at, which, 0.035 * scale, 0.025 * scale)
            if hit is not None:
                break
        if hit is not None:
            points.append(hit)
            fades.append(fade)
    if len(points) < 2:
        return None
    return points, fades


def axis_value(point, origin, axis):
    return (point - origin).dot(axis)


def groove_paths(kind, landmarks):
    origin, side, up, front = body_frame(landmarks)

    def level(name):
        return axis_value(landmarks[name], origin, up)

    def lateral(name):
        return axis_value(landmarks[name], origin, side)

    hip = abs(lateral("joint-l-upper-leg"))
    shoulder = abs(lateral("joint-l-shoulder"))
    pelvis = level("joint-pelvis")
    spine4 = level("joint-spine-4")
    spine3 = level("joint-spine-3")
    spine2 = level("joint-spine-2")
    spine1 = level("joint-spine-1")
    neck = level("joint-neck")
    jaw = level("joint-jaw")
    knee = level("joint-l-knee")
    specs = []

    def samples_vertical(side_at, up0, up1, which, count):
        return [
            (side_at, up0 + (up1 - up0) * (index / (count - 1)), which)
            for index in range(count)
        ]

    def samples_across(side0, side1, up_at, which, count):
        return [
            (side0 + (side1 - side0) * (index / (count - 1)), up_at, which)
            for index in range(count)
        ]

    def samples_limb(start_name, end_name, which, count):
        return [
            (
                lateral(start_name) + (lateral(end_name) - lateral(start_name)) * (index / (count - 1)),
                level(start_name) + (level(end_name) - level(start_name)) * (index / (count - 1)),
                which,
            )
            for index in range(count)
        ]

    def samples_arc(side0, up0, side1, up1, which, count, bow):
        samples = []
        for index in range(count):
            t = index / (count - 1)
            sag = math.sin(math.pi * t) * bow
            samples.append((side0 + (side1 - side0) * t, up0 + (up1 - up0) * t - sag, which))
        return samples

    def samples_faded(start_name, end_name, which, count, side_offset, stop):
        samples = []
        for index in range(count):
            t = stop * index / (count - 1)
            samples.append(
                (
                    lateral(start_name) + (lateral(end_name) - lateral(start_name)) * t + side_offset,
                    level(start_name) + (level(end_name) - level(start_name)) * t,
                    which,
                    1.0 - index / (count - 1),
                )
            )
        return samples

    # spine-4 sits just above the pelvis, spine-1 is the upper chest.
    navel = spine4
    xiphoid = spine3 + (spine2 - spine3) * 0.45
    print(f"detail_span_{kind} navel={navel:.3f} xiphoid={xiphoid:.3f}", flush=True)
    if kind == "muscle":
        specs.append(("linea_alba", samples_vertical(0.0, navel, xiphoid, 1, 6)))
        row_span = xiphoid - navel
        for row in range(3):
            mid = navel + row_span * ((row + 0.5) / 3.0)
            half = row_span / 6.0
            for sign in (-1.0, 1.0):
                side_at = sign * hip * 0.32
                specs.append(
                    ("abs_block", samples_vertical(side_at, mid - half * 0.55, mid + half * 0.55, 1, 3))
                )
        for sign in (-1.0, 1.0):
            armpit = spine2 + (spine1 - spine2) * 0.42
            specs.append(
                (
                    "pec_arc",
                    samples_arc(
                        sign * shoulder * 0.05,
                        xiphoid,
                        sign * shoulder * 0.9,
                        armpit,
                        1,
                        8,
                        bow=max(0.012, (spine2 - spine3) * 0.18),
                    ),
                )
            )
            pec_up = (spine1 + spine2) * 0.5
            specs.append(
                (
                    "pec_belly",
                    (
                        (sign * shoulder * 0.28, pec_up, 1),
                        (sign * shoulder * 0.48, pec_up + (spine1 - spine2) * 0.12, 1),
                        (sign * shoulder * 0.38, pec_up - (spine1 - spine2) * 0.06, 1),
                    ),
                )
            )
            prefix = "l" if sign > 0.0 else "r"
            shoulder_name = f"joint-{prefix}-shoulder"
            elbow_name = f"joint-{prefix}-elbow"
            shoulder_side = lateral(shoulder_name)
            shoulder_up = level(shoulder_name)
            specs.append(
                (
                    "delt_belly",
                    (
                        (shoulder_side, shoulder_up, 0),
                        (shoulder_side + sign * 0.02, shoulder_up - 0.025, 0),
                        (shoulder_side - sign * 0.015, shoulder_up - 0.01, 0),
                    ),
                )
            )
            specs.append(
                (
                    "delt_arc",
                    samples_arc(
                        shoulder_side,
                        shoulder_up - 0.012,
                        shoulder_side + (lateral(elbow_name) - shoulder_side) * 0.4,
                        shoulder_up + (level(elbow_name) - shoulder_up) * 0.4,
                        0,
                        6,
                        bow=0.016,
                    ),
                )
            )
            specs.append(("biceps", samples_faded(shoulder_name, elbow_name, 1, 5, sign * 0.012, 0.7)))
            trap_up = spine1 + (neck - spine1) * 0.38
            specs.append(
                (
                    "trap",
                    (
                        (sign * shoulder * 0.28, trap_up, -1),
                        (sign * shoulder * 0.46, trap_up + (neck - spine1) * 0.1, -1),
                        (sign * shoulder * 0.36, spine1 + (neck - spine1) * 0.16, -1),
                    ),
                )
            )
            specs.append(("lat", samples_vertical(sign * shoulder * 0.52, spine4, spine2, -1, 4)))
            scapula_name = f"joint-{prefix}-scapula"
            scapula_side = lateral(scapula_name)
            scapula_up = level(scapula_name)
            specs.append(
                (
                    "scapula",
                    (
                        (scapula_side, scapula_up, -1),
                        (scapula_side - sign * 0.02, scapula_up + 0.02, -1),
                        (scapula_side + sign * 0.025, scapula_up - 0.018, -1),
                    ),
                )
            )
            for offset in (-0.028, 0.0, 0.03):
                specs.append(
                    (
                        "quad",
                        samples_faded(
                            f"joint-{prefix}-upper-leg",
                            f"joint-{prefix}-knee",
                            1,
                            5,
                            sign * offset,
                            0.66,
                        ),
                    )
                )
            specs.append(("calf_split", samples_limb(f"joint-{prefix}-knee", f"joint-{prefix}-ankle", -1, 4)))
        specs.append(("spine", samples_vertical(0.0, spine4, neck, -1, 6)))
    else:
        for sign in (-1.0, 1.0):
            specs.append(
                (
                    "inframammary",
                    samples_arc(
                        sign * shoulder * 0.06,
                        xiphoid - (xiphoid - navel) * 0.12,
                        sign * shoulder * 0.82,
                        spine2 + (spine1 - spine2) * 0.2,
                        1,
                        7,
                        bow=max(0.014, (xiphoid - navel) * 0.16),
                    ),
                )
            )
            specs.append(
                (
                    "inguinal",
                    samples_across(sign * hip * 0.05, sign * hip * 0.85, pelvis, 1, 4),
                )
            )
            specs.append(("love_handle", samples_across(sign * hip * 0.7, sign * hip * 1.15, spine3, 0, 3)))
            specs.append(
                (
                    "gluteal_fold",
                    samples_across(sign * hip * 0.08, sign * hip * 0.8, pelvis, -1, 4),
                )
            )
            prefix = "l" if sign > 0.0 else "r"
            knee_side = lateral(f"joint-{prefix}-knee")
            specs.append(("knee", samples_across(knee_side - hip * 0.18, knee_side + hip * 0.18, knee, 1, 3)))
            specs.append(("knee", samples_across(knee_side - hip * 0.18, knee_side + hip * 0.18, knee, -1, 3)))
            specs.append(("thigh", samples_across(sign * hip * 0.4, sign * hip * 1.05, pelvis, 1, 3)))
            specs.append(("arm", samples_limb(f"joint-{prefix}-elbow", f"joint-{prefix}-hand", 1, 3)))
        specs.append(("lumbar", samples_across(-hip * 0.7, hip * 0.7, spine3, -1, 5)))
        specs.append(("chin", samples_across(-shoulder * 0.12, shoulder * 0.12, jaw, 1, 3)))
    return origin, side, up, front, specs


def dist_to_polyline(point, points, fades=None):
    best = None
    fade = 1.0
    for index, (start, end) in enumerate(zip(points, points[1:])):
        span = end - start
        length_sq = span.length_squared
        if length_sq < 1e-12:
            distance = (point - start).length
            along = 0.0
        else:
            along = max(0.0, min(1.0, (point - start).dot(span) / length_sq))
            distance = (point - (start + span * along)).length
        if best is None or distance < best:
            best = distance
            if fades is not None:
                fade = fades[index] * (1.0 - along) + fades[index + 1] * along
    return (1e9 if best is None else best), fade


CENTER_GROOVES = {"linea_alba", "spine"}


def group_axis_radius(framed, indices):
    radii = []
    for index in indices:
        if index >= len(framed):
            continue
        side, _up, front, _co = framed[index]
        radii.append(math.hypot(side, front))
    if not radii:
        return None
    radii.sort()
    return radii[int((len(radii) - 1) * 0.95)]


def group_side_span(framed, indices):
    sides = [framed[index][0] for index in indices if index < len(framed)]
    if not sides:
        return None
    return min(sides), max(sides)


def displace_grooves(obj, segments, origin, side_axis, up_axis, front_axis):
    mesh = obj.data
    mesh.update()
    if hasattr(mesh, "calc_normals"):
        mesh.calc_normals()
    cap = max(abs(item[3]) for item in segments) * 2.2 if segments else 0.0
    for vertex in mesh.vertices:
        side, up, _front = project_point(vertex.co, origin, side_axis, up_axis, front_axis)
        offset = 0.0
        for points, fades, width, signed_depth, softness, box in segments:
            side0, side1, up0, up1 = box
            if side < side0 or side > side1 or up < up0 or up > up1:
                continue
            distance, fade = dist_to_polyline(vertex.co, points, fades)
            if distance >= width or fade <= 0.0:
                continue
            sigma = max(softness, 1e-5)
            gauss = math.exp(-(distance * distance) / (2.0 * sigma * sigma))
            rim = distance / width
            if rim > 0.72:
                t = (rim - 0.72) / 0.28
                gauss *= 1.0 - t * t * (3.0 - 2.0 * t)
            offset += signed_depth * gauss * fade
        if offset != 0.0:
            vertex.co += vertex.normal * max(-cap, min(cap, offset))
    mesh.update()


def uv_overlap_ratio(obj, resolution=256):
    layer = obj.data.uv_layers.active
    if layer is None:
        return 1.0
    counts = [0] * (resolution * resolution)

    def fill(a, b, c):
        min_u = max(0, int(min(a.x, b.x, c.x) * resolution))
        max_u = min(resolution - 1, int(max(a.x, b.x, c.x) * resolution))
        min_v = max(0, int(min(a.y, b.y, c.y) * resolution))
        max_v = min(resolution - 1, int(max(a.y, b.y, c.y) * resolution))
        edge_b = b - a
        edge_c = c - a
        denom = edge_b.x * edge_c.y - edge_c.x * edge_b.y
        if abs(denom) < 1e-12:
            return
        for y in range(min_v, max_v + 1):
            for x in range(min_u, max_u + 1):
                point = Vector(((x + 0.5) / resolution, (y + 0.5) / resolution)) - a
                beta = (point.x * edge_c.y - edge_c.x * point.y) / denom
                gamma = (edge_b.x * point.y - point.x * edge_b.y) / denom
                alpha = 1.0 - beta - gamma
                # Inset so a shared island edge is not counted as overlap.
                if min(alpha, beta, gamma) <= 0.04:
                    continue
                counts[y * resolution + x] += 1

    data = layer.data
    for polygon in obj.data.polygons:
        uvs = [data[index].uv for index in polygon.loop_indices]
        for index in range(1, len(uvs) - 1):
            fill(uvs[0], uvs[index], uvs[index + 1])
    covered = sum(1 for value in counts if value)
    overlap = sum(1 for value in counts if value > 1)
    if covered == 0:
        return 1.0
    return overlap / covered


def unwrap_for_bake(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def frozen_copy(obj, name):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(
        obj.evaluated_get(depsgraph),
        depsgraph=depsgraph,
        preserve_all_data_layers=True,
    )
    copy = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(copy)
    copy.matrix_world = obj.matrix_world.copy()
    return copy


def apply_subsurf(obj, levels):
    modifier = obj.modifiers.new("DetailSubdiv", "SUBSURF")
    modifier.levels = levels
    modifier.render_levels = levels
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def attach_bake_image(obj, image):
    material = obj.data.materials[0].copy() if obj.data.materials else bpy.data.materials.new("Bake")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    for node in nodes:
        node.select = False
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    node.select = True
    nodes.active = node
    obj.data.materials.clear()
    obj.data.materials.append(material)


def mesh_bounds(obj):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    lows = [min(point[axis] for point in points) for axis in range(3)]
    highs = [max(point[axis] for point in points) for axis in range(3)]
    return lows, highs


def bake_normal(high, low, image, cage, max_ray):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.cycles.bake_type = "NORMAL"
    bake = scene.render.bake
    bake.normal_space = "TANGENT"
    bake.margin = BAKE_MARGIN
    bake.use_clear = True
    if hasattr(bake, "margin_type"):
        bake.margin_type = "EXTEND"
    attach_bake_image(low, image)
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    for target in (low, high):
        if hasattr(target.data, "calc_tangents") and target.data.uv_layers:
            try:
                target.data.calc_tangents()
            except RuntimeError:
                pass
    print(
        f"bake_verts low={len(low.data.vertices)} high={len(high.data.vertices)} "
        f"cage={cage:.3f} ray={max_ray:.3f}",
        flush=True,
    )
    # Start just outside the shell. The torso pass uses a longer ray; the
    # short pass stops before a ray can cross an eye socket or a finger.
    operator = bpy.ops.object.bake
    available = {prop.identifier for prop in operator.get_rna_type().properties}
    wanted = {
        "type": "NORMAL",
        "margin": BAKE_MARGIN,
        "use_clear": True,
        "use_selected_to_active": True,
        "cage_extrusion": cage,
        "max_ray_distance": max_ray,
        "normal_space": "TANGENT",
    }
    operator(**{key: value for key, value in wanted.items() if key in available})


def png_chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, width, height, pixels):
    # Blender stores y = 0 at the bottom. PNG rows start at the top.
    raw = bytearray()
    for y in range(height - 1, -1, -1):
        raw.append(0)
        row = y * width * 4
        for x in range(width):
            index = row + x * 4
            raw.append(max(0, min(255, int(pixels[index] * 255.0 + 0.5))))
            raw.append(max(0, min(255, int(pixels[index + 1] * 255.0 + 0.5))))
            raw.append(max(0, min(255, int(pixels[index + 2] * 255.0 + 0.5))))
    payload = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 6))
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(payload)


def save_normal_image(image, png_path, webp_path):
    # image.save() writes the blank generated source and ignores the bake buffer.
    width, height = image.size
    pixels = array.array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(pixels)
    write_png(png_path, width, height, pixels)
    loaded = bpy.data.images.load(png_path)
    loaded.colorspace_settings.name = "Non-Color"
    scene = bpy.context.scene
    settings = scene.render.image_settings
    previous = (settings.file_format, settings.quality, settings.color_mode, scene.view_settings.view_transform)
    settings.file_format = "WEBP"
    settings.quality = 90
    settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    loaded.save_render(webp_path, scene=scene)
    settings.file_format, settings.quality, settings.color_mode, scene.view_settings.view_transform = previous
    bpy.data.images.remove(loaded)


def normal_histogram(image, label):
    width, height = image.size
    buffer = array.array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(buffer)
    mins = [1.0, 1.0, 1.0]
    maxs = [0.0, 0.0, 0.0]
    bins = [0] * 10
    strong = 0
    for index in range(0, len(buffer), 4):
        for channel in range(3):
            value = buffer[index + channel]
            mins[channel] = min(mins[channel], value)
            maxs[channel] = max(maxs[channel], value)
        # Flat tangent normal is (0.5, 0.5, 1). Strength is how far RG leave 0.5.
        deviation = math.hypot(buffer[index] - 0.5, buffer[index + 1] - 0.5)
        if deviation > 0.02:
            strong += 1
        bins[min(9, int(deviation / 0.02))] += 1
    pixels = width * height
    print(
        f"normal_{label}_range="
        f"R[{mins[0]:.3f},{maxs[0]:.3f}] "
        f"G[{mins[1]:.3f},{maxs[1]:.3f}] "
        f"B[{mins[2]:.3f},{maxs[2]:.3f}] "
        f"effect_pct={100.0 * strong / pixels:.2f}",
        flush=True,
    )
    populated = ",".join(str(round(100.0 * count / pixels, 2)) for count in bins)
    print(f"normal_{label}_hist_pct_per_0.02={populated}", flush=True)


def ktx2_offer(png_path):
    if shutil_which("toktx") or shutil_which("ktx"):
        print(f"ktx2_tool=available source={png_path}", flush=True)
        return
    print(
        "ktx2=skipped no toktx binary; "
        f"toktx --encode uastc --uastc_quality 2 --genmipmap {png_path}",
        flush=True,
    )


def shutil_which(name):
    return any(
        os.path.isfile(os.path.join(path, name))
        for path in os.environ.get("PATH", "").split(os.pathsep)
    )


def build_high(low, landmarks, kind, mask_groups, gain=DETAIL_GAIN):
    origin, side, up, front, specs = groove_paths(kind, landmarks)
    coords = [vertex.co.copy() for vertex in low.data.vertices]
    framed = frame_vertices(coords, origin, side, up, front)
    mid_radius = group_axis_radius(framed, mask_groups["Mid"])
    left_span = group_side_span(framed, mask_groups["Left"])
    right_span = group_side_span(framed, mask_groups["Right"])
    print(
        f"mask_{kind}_mid_m={mid_radius if mid_radius is not None else 0:.4f} "
        f"left={len(mask_groups['Left'])} right={len(mask_groups['Right'])} mid={len(mask_groups['Mid'])}",
        flush=True,
    )
    segments = []
    limb_clip = {"biceps", "quad", "calf_split", "knee", "thigh", "arm"}
    for groove, samples in specs:
        traced = skin_line(framed, samples)
        if traced is None:
            print(f"groove_skip={kind}:{groove}", flush=True)
            continue
        points, fades = traced
        config = DETAIL_CONFIG[kind][groove]
        sides = [item[0] for item in samples]
        ups = [item[1] for item in samples]
        pad = config["width"]
        side0, side1 = min(sides) - pad, max(sides) + pad
        up0, up1 = min(ups) - pad, max(ups) + pad
        clipped0, clipped1 = side0, side1
        if groove in CENTER_GROOVES and mid_radius is not None:
            clipped0, clipped1 = max(side0, -mid_radius), min(side1, mid_radius)
        elif groove in limb_clip and min(sides) >= 0.0 and left_span is not None:
            clipped0, clipped1 = max(side0, left_span[0]), min(side1, left_span[1])
        elif groove in limb_clip and max(sides) <= 0.0 and right_span is not None:
            clipped0, clipped1 = max(side0, right_span[0]), min(side1, right_span[1])
        if clipped0 < clipped1:
            side0, side1 = clipped0, clipped1
        signed = config["depth"] * gain
        if config["form"] != "bulge":
            signed = -signed
        segments.append((points, fades, config["width"], signed, config["softness"], (side0, side1, up0, up1)))
    high = low.copy()
    high.data = low.data.copy()
    high.name = f"{kind}_high"
    bpy.context.scene.collection.objects.link(high)
    apply_subsurf(high, 2)
    displace_grooves(high, segments, origin, side, up, front)
    return high, len(segments), segments


def image_buffer(image):
    width, height = image.size
    buffer = array.array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(buffer)
    return width, height, buffer


def store_buffer(image, buffer):
    image.pixels.foreach_set(buffer)
    image.update()


def box_blur(source, width, height, radius):
    if radius <= 0:
        return source
    horizontal = [0.0] * (width * height)
    for y in range(height):
        row = y * width
        prefix = [0.0] * (width + 1)
        for x in range(width):
            prefix[x + 1] = prefix[x] + source[row + x]
        for x in range(width):
            start = max(0, x - radius)
            end = min(width, x + radius + 1)
            horizontal[row + x] = (prefix[end] - prefix[start]) / (end - start)
    output = [0.0] * (width * height)
    for x in range(width):
        prefix = [0.0] * (height + 1)
        for y in range(height):
            prefix[y + 1] = prefix[y] + horizontal[y * width + x]
        for y in range(height):
            start = max(0, y - radius)
            end = min(height, y + radius + 1)
            output[y * width + x] = (prefix[end] - prefix[start]) / (end - start)
    return output


def body_part(point, landmarks):
    origin, side, up, front = body_frame(landmarks)

    def level(name):
        return project_point(landmarks[name], origin, side, up, front)[1]

    def lateral(name):
        return project_point(landmarks[name], origin, side, up, front)[0]

    along, height, depth = project_point(point, origin, side, up, front)
    if (point - landmarks["joint-l-eye"]).length < 0.045 or (
        point - landmarks["joint-r-eye"]
    ).length < 0.045:
        return "eye"
    if height > level("joint-neck") and abs(along) > abs(lateral("joint-l-eye")) + 0.03:
        return "ear"
    if height > level("joint-neck"):
        return "head"
    if (point - landmarks["joint-l-hand"]).length < 0.16 or (
        point - landmarks["joint-r-hand"]
    ).length < 0.16:
        return "hand"
    for ankle_name, knee_name in (("joint-l-ankle", "joint-l-knee"), ("joint-r-ankle", "joint-r-knee")):
        ankle = landmarks[ankle_name]
        if (point - ankle).length < 0.14 and (point - ankle).length < (point - landmarks[knee_name]).length:
            return "foot"
    if (point - landmarks["joint-l-shoulder"]).length < 0.07 or (
        point - landmarks["joint-r-shoulder"]
    ).length < 0.07:
        return "shoulder"
    if abs(depth) < 0.018:
        return "contour"
    if depth > 0.0:
        return "front"
    return "back"


def torso_ray_part(point, landmarks):
    part = body_part(point, landmarks)
    if part not in ("front", "back"):
        return False
    origin, side, up, front = body_frame(landmarks)
    along, height, _depth = project_point(point, origin, side, up, front)
    pelvis = project_point(landmarks["joint-pelvis"], origin, side, up, front)[1]
    neck = project_point(landmarks["joint-neck"], origin, side, up, front)[1]
    shoulder = abs(project_point(landmarks["joint-l-shoulder"], origin, side, up, front)[0])
    return pelvis <= height <= neck and abs(along) < shoulder * 0.92


def uv_face_grid(mesh, resolution=64):
    layer = mesh.uv_layers.active.data
    grid = {}
    for polygon in mesh.polygons:
        loops = [layer[index].uv.copy() for index in polygon.loop_indices]
        verts = [mesh.vertices[index].co.copy() for index in polygon.vertices]
        umin = min(uv.x for uv in loops)
        umax = max(uv.x for uv in loops)
        vmin = min(uv.y for uv in loops)
        vmax = max(uv.y for uv in loops)
        record = (loops, verts, polygon.index)
        for y in range(max(0, int(vmin * resolution)), min(resolution - 1, int(vmax * resolution)) + 1):
            for x in range(max(0, int(umin * resolution)), min(resolution - 1, int(umax * resolution)) + 1):
                grid.setdefault((x, y), []).append(record)
    return grid


def face_at_uv(grid, u, v, resolution=64):
    cell = grid.get((min(resolution - 1, int(u * resolution)), min(resolution - 1, int(v * resolution))))
    if not cell:
        return None
    point = Vector((u, v))
    for loops, verts, _index in cell:
        for corner in range(1, len(loops) - 1):
            a, b, c = loops[0], loops[corner], loops[corner + 1]
            edge_b = b - a
            edge_c = c - a
            denom = edge_b.x * edge_c.y - edge_c.x * edge_b.y
            if abs(denom) < 1e-12:
                continue
            delta = point - a
            beta = (delta.x * edge_c.y - edge_c.x * delta.y) / denom
            gamma = (edge_b.x * delta.y - delta.x * edge_b.y) / denom
            alpha = 1.0 - beta - gamma
            if min(alpha, beta, gamma) >= -1e-4:
                position = verts[0] * alpha + verts[corner] * beta + verts[corner + 1] * gamma
                return position
    return None


def raster_uv(mesh, face_ids, resolution):
    mask = [0.0] * (resolution * resolution)
    layer = mesh.uv_layers.active.data
    chosen = set(face_ids)

    def fill(a, b, c):
        min_u = max(0, int(min(a.x, b.x, c.x) * resolution))
        max_u = min(resolution - 1, int(max(a.x, b.x, c.x) * resolution))
        min_v = max(0, int(min(a.y, b.y, c.y) * resolution))
        max_v = min(resolution - 1, int(max(a.y, b.y, c.y) * resolution))
        edge_b = b - a
        edge_c = c - a
        denom = edge_b.x * edge_c.y - edge_c.x * edge_b.y
        if abs(denom) < 1e-12:
            return
        for y in range(min_v, max_v + 1):
            for x in range(min_u, max_u + 1):
                sample = Vector(((x + 0.5) / resolution, (y + 0.5) / resolution)) - a
                beta = (sample.x * edge_c.y - edge_c.x * sample.y) / denom
                gamma = (edge_b.x * sample.y - sample.x * edge_b.y) / denom
                if min(1.0 - beta - gamma, beta, gamma) < -1e-4:
                    continue
                mask[y * resolution + x] = 1.0

    for polygon in mesh.polygons:
        if polygon.index not in chosen:
            continue
        uvs = [layer[index].uv for index in polygon.loop_indices]
        for corner in range(1, len(uvs) - 1):
            fill(uvs[0], uvs[corner], uvs[corner + 1])
    return mask


def extremity_islands(mesh, landmarks):
    layer = mesh.uv_layers.active.data
    parent = list(range(len(mesh.polygons)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    seen = {}
    for polygon in mesh.polygons:
        verts = list(polygon.vertices)
        loops = list(polygon.loop_indices)
        for corner in range(len(verts)):
            nxt = (corner + 1) % len(verts)
            uv_a = tuple(round(value, 4) for value in layer[loops[corner]].uv)
            uv_b = tuple(round(value, 4) for value in layer[loops[nxt]].uv)
            key = (tuple(sorted((verts[corner], verts[nxt]))), tuple(sorted((uv_a, uv_b))))
            other = seen.get(key)
            if other is None:
                seen[key] = polygon.index
            else:
                union(polygon.index, other)
    groups = {}
    for index in range(len(mesh.polygons)):
        groups.setdefault(find(index), []).append(index)
    hot = []
    for faces in groups.values():
        region = False
        for face_index in faces:
            for vertex_index in mesh.polygons[face_index].vertices:
                part = body_part(mesh.vertices[vertex_index].co, landmarks)
                if part in ("hand", "foot", "head", "eye", "ear"):
                    region = True
                    break
            if region:
                break
        if not region:
            continue
        if len(faces) > len(mesh.polygons) * 0.25:
            faces = [
                face_index
                for face_index in faces
                if any(
                    body_part(mesh.vertices[vertex].co, landmarks) in ("hand", "foot", "head", "eye", "ear")
                    for vertex in mesh.polygons[face_index].vertices
                )
            ]
        hot.extend(faces)
    return hot


def torso_faces(mesh, landmarks):
    origin, side, up, front = body_frame(landmarks)
    pelvis = project_point(landmarks["joint-pelvis"], origin, side, up, front)[1]
    neck = project_point(landmarks["joint-neck"], origin, side, up, front)[1]
    shoulder = abs(project_point(landmarks["joint-l-shoulder"], origin, side, up, front)[0])
    chosen = []
    blocked = {"eye", "ear", "head", "hand", "foot"}
    for polygon in mesh.polygons:
        samples = [project_point(mesh.vertices[index].co, origin, side, up, front) for index in polygon.vertices]
        parts = [body_part(mesh.vertices[index].co, landmarks) for index in polygon.vertices]
        if any(part in blocked for part in parts):
            continue
        if any(not pelvis <= sample[1] <= neck for sample in samples):
            continue
        if any(abs(sample[0]) > shoulder * 0.95 for sample in samples):
            continue
        depth = sum(sample[2] for sample in samples) / len(samples)
        if abs(depth) < 0.012:
            continue
        chosen.append(polygon.index)
    return chosen


def apply_mask(buffer, mask, width, height, target=None, replace=None):
    # target is the long-ray buffer when compositing. replace=None flattens.
    for index, weight in enumerate(mask):
        if weight <= 0.0:
            continue
        pixel = index * 4
        if replace is None:
            buffer[pixel] += (0.5 - buffer[pixel]) * weight
            buffer[pixel + 1] += (0.5 - buffer[pixel + 1]) * weight
            buffer[pixel + 2] += (1.0 - buffer[pixel + 2]) * weight
            continue
        source = index * 4
        for channel in range(3):
            buffer[pixel + channel] = (
                buffer[pixel + channel] * (1.0 - weight) + replace[source + channel] * weight
            )


def shoulder_mask(mesh, landmarks, resolution):
    left = landmarks["joint-l-shoulder"]
    right = landmarks["joint-r-shoulder"]
    faces = []
    for polygon in mesh.polygons:
        for index in polygon.vertices:
            point = mesh.vertices[index].co
            if (point - left).length < SHOULDER_REACH or (point - right).length < SHOULDER_REACH:
                faces.append(polygon.index)
                break
    return box_blur(raster_uv(mesh, faces, resolution), resolution, resolution, SHOULDER_BLUR_PX * 3)


def blur_shoulder_normals(buffer, width, height, mask):
    planes = []
    for channel in range(3):
        plane = [buffer[index * 4 + channel] for index in range(width * height)]
        planes.append(box_blur(plane, width, height, SHOULDER_BLUR_PX))
    for index, weight in enumerate(mask):
        if weight <= 0.0:
            continue
        pixel = index * 4
        for channel in range(3):
            buffer[pixel + channel] = buffer[pixel + channel] * (1.0 - weight) + planes[channel][index] * weight
        x = buffer[pixel] * 2.0 - 1.0
        y = buffer[pixel + 1] * 2.0 - 1.0
        z = buffer[pixel + 2] * 2.0 - 1.0
        length = math.sqrt(x * x + y * y + z * z) or 1.0
        buffer[pixel] = (x / length + 1.0) * 0.5
        buffer[pixel + 1] = (y / length + 1.0) * 0.5
        buffer[pixel + 2] = (z / length + 1.0) * 0.5


def point_on_mask(point, segments):
    for points, _fades, width, _depth, _softness, _box in segments:
        distance, _fade = dist_to_polyline(point, points)
        if distance <= width:
            return True
    return False


def finish_normal_map(image, short, long_image, low, landmarks, segments, kind):
    width, height = image.size
    _w, _h, long_buffer = image_buffer(long_image)
    faces = torso_faces(low.data, landmarks)
    print(f"torso_bake_faces_{kind}={len(faces)}", flush=True)
    torso = box_blur(raster_uv(low.data, faces, width), width, height, 4)
    apply_mask(short, torso, width, height, replace=long_buffer)
    grid = uv_face_grid(low.data)
    clusters = {}
    for y in range(height):
        row = y * width
        for x in range(width):
            pixel = (row + x) * 4
            deviation = math.hypot(short[pixel] - 0.5, short[pixel + 1] - 0.5)
            if deviation <= PEAK_DEVIATION:
                continue
            u = (x + 0.5) / width
            v = (y + 0.5) / height
            point = face_at_uv(grid, u, v)
            if point is None:
                continue
            part = body_part(point, landmarks)
            masked = point_on_mask(point, segments)
            key = (part, int(u * 40), int(v * 40))
            current = clusters.get(key)
            if current is None or deviation > current[0]:
                clusters[key] = (deviation, u, v, part, masked)
            if not masked:
                short[pixel] = 0.5
                short[pixel + 1] = 0.5
                short[pixel + 2] = 1.0
    ranked = sorted(clusters.values(), reverse=True)[:40]
    for deviation, u, v, part, masked in ranked:
        print(
            f"peak {kind} uv={u:.3f},{v:.3f} part={part} dev={deviation:.3f} masked={int(masked)}",
            flush=True,
        )
    islands = raster_uv(low.data, extremity_islands(low.data, landmarks), width)
    islands = box_blur(islands, width, height, ISLAND_FEATHER)
    apply_mask(short, islands, width, height)
    blur_shoulder_normals(short, width, height, shoulder_mask(low.data, landmarks, width))
    store_buffer(image, short)


def bake_corner_normal(body, muscle, fat, landmarks, kind, image, mask_groups, gain):
    set_influences(body, muscle, fat, muscle * fat)
    low = frozen_copy(body, f"{kind}_low")
    overlap = uv_overlap_ratio(low)
    print(f"uv_overlap_{kind}={overlap * 100:.2f}%", flush=True)
    if overlap > UV_OVERLAP_LIMIT:
        unwrap_for_bake(low)
        print(f"uv_bake_{kind}=smart_project", flush=True)
    else:
        print(f"uv_bake_{kind}=mesh", flush=True)
    high, used, segments = build_high(low, landmarks, kind, mask_groups, gain)
    print(f"grooves_{kind}={used} gain={gain:.1f}", flush=True)
    held = body.location.copy()
    body.location.x += 10.0
    bpy.context.view_layer.update()
    long_image = bpy.data.images.new(f"{kind}_long_{gain:.1f}", NORMAL_SIZE, NORMAL_SIZE, alpha=False)
    long_image.colorspace_settings.name = "Non-Color"
    try:
        bake_normal(high, low, image, SHORT_CAGE, SHORT_RAY)
        bake_normal(high, low, long_image, LONG_CAGE, LONG_RAY)
        _width, _height, short = image_buffer(image)
        finish_normal_map(image, short, long_image, low, landmarks, segments, kind)
    finally:
        body.location = held
        bpy.context.view_layer.update()
        if long_image.name in bpy.data.images:
            bpy.data.images.remove(long_image)
    discard(high)
    discard(low)
    set_influences(body, 0.0, 0.0, 0.0)


def blend_normal_images(muscle_image, fat_image):
    width, height = muscle_image.size
    first = array.array("f", [0.0]) * (width * height * 4)
    second = array.array("f", [0.0]) * (width * height * 4)
    muscle_image.pixels.foreach_get(first)
    fat_image.pixels.foreach_get(second)
    mixed = array.array("f", [1.0]) * (width * height * 4)
    for index in range(0, len(first), 4):
        ax = first[index] * 2.0 - 1.0
        ay = first[index + 1] * 2.0 - 1.0
        az = first[index + 2] * 2.0 - 1.0
        bx = second[index] * 2.0 - 1.0
        by = second[index + 1] * 2.0 - 1.0
        bz = second[index + 2] * 2.0 - 1.0
        x = ax + bx
        y = ay + by
        z = az * bz
        length = math.sqrt(x * x + y * y + z * z) or 1.0
        mixed[index] = (x / length + 1.0) * 0.5
        mixed[index + 1] = (y / length + 1.0) * 0.5
        mixed[index + 2] = (z / length + 1.0) * 0.5
    image = bpy.data.images.new("detail_both", width, height, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(mixed)
    image.pack()
    return image


def link_normal_map(obj, image):
    material = obj.data.materials[0]
    tree = material.node_tree
    principled = tree.nodes.get("Principled BSDF")
    for node in list(tree.nodes):
        if node.name.startswith("Detail"):
            tree.nodes.remove(node)
    if image is None:
        return
    normal = tree.nodes.new("ShaderNodeNormalMap")
    normal.name = "DetailNormal"
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.name = "DetailTex"
    texture.image = image
    texture.interpolation = "Smart"
    tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
    tree.links.new(normal.outputs["Normal"], principled.inputs["Normal"])


def render_detail_sheet(obj, sex, directory, muscle_image, fat_image, both_image):
    scene = bpy.context.scene
    scene.render.engine = render_engine_name()
    scene.render.resolution_x = 420
    scene.render.resolution_y = 360
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    xs = [vertex.co.x for vertex in obj.data.vertices]
    ys = [vertex.co.y for vertex in obj.data.vertices]
    zs = [vertex.co.z for vertex in obj.data.vertices]
    height = max(zs) - min(zs)
    chest = Vector((0.0, 0.0, min(zs) + height * 0.62))
    camera_data = bpy.data.cameras.new("DetailCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 0.62
    camera = bpy.data.objects.new("DetailCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    distance = height * 1.35
    views = (
        ("face", chest + Vector((0.0, -distance, 0.0))),
        ("side", chest + Vector((distance, 0.0, 0.0))),
        ("aft", chest + Vector((0.0, distance, 0.0))),
    )
    use_relief_lights(scene, chest)
    rows = (
        ("a", (0.0, 0.0), None),
        ("muscle", (1.0, 0.0), None),
        ("muscle yes", (1.0, 0.0), muscle_image),
        ("fat", (0.0, 1.0), None),
        ("fat yes", (0.0, 1.0), fat_image),
        ("d", (1.0, 1.0), None),
        ("d yes", (1.0, 1.0), both_image),
    )
    folder = tempfile.mkdtemp(prefix="ys-detail-")
    cells = []
    captions = []
    for label, (muscle, fat), image in rows:
        set_influences(obj, muscle, fat, muscle * fat)
        link_normal_map(obj, image)
        for view, location in views:
            captions.append(f"{label}\n{view}")
            aim_camera(camera, location, chest)
            path = os.path.join(folder, f"{label}_{view}.png".replace(" ", "_"))
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            cells.append(path)
    link_normal_map(obj, None)
    set_influences(obj, 0.0, 0.0, 0.0)
    destination = os.path.join(directory, f"details_{sex}.png")
    pack_sheet(cells, captions, len(views), destination)
    bpy.data.objects.remove(camera, do_unlink=True)
    return destination


def write_detail_maps(body, landmarks_b, landmarks_c, mask_groups, directory, sex):
    sheet_images = None
    for gain in DETAIL_GAIN_EXPORTS:
        tag = f"g{int(round(gain * 10))}"
        muscle_image = bpy.data.images.new(
            f"muscle_normal_{sex}_{tag}", NORMAL_SIZE, NORMAL_SIZE, alpha=False
        )
        fat_image = bpy.data.images.new(
            f"fat_normal_{sex}_{tag}", NORMAL_SIZE, NORMAL_SIZE, alpha=False
        )
        for image in (muscle_image, fat_image):
            image.colorspace_settings.name = "Non-Color"
        bake_corner_normal(body, 1.0, 0.0, landmarks_b, "muscle", muscle_image, mask_groups, gain)
        bake_corner_normal(body, 0.0, 1.0, landmarks_c, "fat", fat_image, mask_groups, gain)
        normal_histogram(muscle_image, f"muscle_{sex}_{tag}")
        normal_histogram(fat_image, f"fat_{sex}_{tag}")
        for label, image in (("muscle", muscle_image), ("fat", fat_image)):
            png_path = os.path.join(directory, f"{label}_normal_{sex}_{tag}.png")
            webp_path = os.path.join(directory, f"{label}_normal_{sex}_{tag}.webp")
            save_normal_image(image, png_path, webp_path)
            print(f"{label}_normal_{tag}_png_bytes={os.path.getsize(png_path)}", flush=True)
            print(f"{label}_normal_{tag}_webp_bytes={os.path.getsize(webp_path)}", flush=True)
        if tag == "g16":
            sheet_images = (muscle_image, fat_image)
    muscle_image, fat_image = sheet_images
    both = blend_normal_images(muscle_image, fat_image)
    sheet = render_detail_sheet(body, sex, directory, muscle_image, fat_image, both)
    print(f"details={sheet}", flush=True)
    print(f"DETAIL_GAIN={DETAIL_GAIN}", flush=True)
    print(f"sheet_gain=1.6", flush=True)
    return sheet


def main():
    sex, out_path, do_render = arguments()
    directory = os.path.dirname(out_path) or "."
    os.makedirs(directory, exist_ok=True)
    services = enable_mpfb()

    corners = {}
    faces = None
    pose = None
    arm_gap_fat = None
    arm_gap_hanging = None
    raw_landmarks = {}
    mask_groups = None
    for name in CORNER_ORDER:
        muscle, weight = CORNERS[sex][name]
        print(f"variant={name} macro_muscle={muscle:.2f} macro_weight={weight:.2f}", flush=True)
        built = build_variant(services, sex, muscle, weight, DETAIL_TARGETS[sex][name])
        if faces is None:
            faces = built["faces"]
            pose = built["pose"]
        elif len(built["coords"]) != len(corners["A"]):
            fail(f"{name} has {len(built['coords'])} vertices, A has {len(corners['A'])}")
        else:
            same_topology(faces, built["faces"], name)
        corners[name] = built["coords"]
        if name in ("B", "C"):
            raw_landmarks[name] = built["landmarks"]
        if mask_groups is None:
            mask_groups = built["mask_groups"]
        if name == "C":
            arm_gap_fat = built["arm_gap"]
            arm_gap_hanging = built["arm_gap_hanging"]

    mid_muscle = sum(CORNERS[sex][name][0] for name in CORNER_ORDER) / 4.0
    mid_weight = sum(CORNERS[sex][name][1] for name in CORNER_ORDER) / 4.0
    print(f"variant=E macro_muscle={mid_muscle:.4f} macro_weight={mid_weight:.4f}", flush=True)
    reference = build_variant(services, sex, mid_muscle, mid_weight, blended_details(sex))
    if len(reference["coords"]) != len(corners["A"]):
        fail("The 0.5/0.5 body has a different vertex count")
    same_topology(faces, reference["faces"], "0.5/0.5")

    body = assemble(corners, faces)
    checks = (
        ("1/0", 1.0, 0.0, 0.0, corners["B"]),
        ("0/1", 0.0, 1.0, 0.0, corners["C"]),
        ("0.5/0.5", 0.5, 0.5, 0.25, reference["coords"]),
    )
    errors = {}
    for label, muscle, fat, correction, expected in checks:
        set_influences(body, muscle, fat, correction)
        errors[label] = evaluated_error(body, expected)
    set_influences(body, 0.0, 0.0, 0.0)

    shade_smooth(body)
    assign_material(body)
    scale, translation = fit_height_and_center(body, sex)
    open_edges = non_manifold_edges(body)

    raw_path = out_path + ".raw.glb"
    ensure_uv(body)
    detail_sheet = write_detail_maps(
        body,
        place_landmarks(raw_landmarks["B"], scale, translation),
        place_landmarks(raw_landmarks["C"], scale, translation),
        mask_groups,
        directory,
        sex,
    )
    export_glb(raw_path, body)
    print(f"uv_raw={glb_has_uv(raw_path)}", flush=True)
    if glb_morph_count(raw_path) != len(SHAPE_KEYS):
        fail("Export did not keep the three shape keys")
    compression, size = compress_glb(raw_path, out_path)
    if os.path.isfile(raw_path) and os.path.abspath(raw_path) != os.path.abspath(out_path):
        os.remove(raw_path)

    meta_path = os.path.join(directory, f"meta_{sex}.json")
    write_meta(meta_path, sex)
    sheet_path = None
    corners_path = None
    matcap_path = None
    close_path = None
    if do_render:
        sheet_path, corners_path, matcap_path, close_path = render_contact_sheet(body, sex, directory)

    body.data.calc_loop_triangles()
    print(f"sex={sex}", flush=True)
    print(f"vertices={len(body.data.vertices)}", flush=True)
    print(f"triangles={len(body.data.loop_triangles)}", flush=True)
    print(f"uv={glb_has_uv(out_path)}", flush=True)
    print(f"shape_keys={','.join(SHAPE_KEYS)}", flush=True)
    print(f"compression={compression}", flush=True)
    print(f"bytes={size}", flush=True)
    print(f"height_scale={scale:.4f}", flush=True)
    print(f"knee_distance_m={pose[1]:.4f}", flush=True)
    print(f"ankle_distance_m={pose[2]:.4f}", flush=True)
    print(f"arm_torso_fat1_m={arm_gap_fat:.4f}", flush=True)
    if arm_gap_hanging is not None:
        print(f"arm_torso_hanging_fat1_m={arm_gap_hanging:.4f}", flush=True)
    print(f"non_manifold_edges={open_edges}", flush=True)
    for label, (worst, mean) in errors.items():
        worst_cm = worst * scale * 100
        mean_cm = mean * scale * 100
        flag = " WARN" if worst_cm > WARN_CM else ""
        print(f"error_{label}_max_cm={worst_cm:.4f} mean_cm={mean_cm:.4f}{flag}", flush=True)
    for name in CORNER_ORDER:
        girth = belly_girth(corners[name])
        if girth is None:
            print(f"belly_{name}_cm=missing", flush=True)
        else:
            print(f"belly_{name}_cm={girth * scale * 100:.2f}", flush=True)
    print(f"belly_z_ratio={NAVEL_RATIO:.2f}", flush=True)
    print(f"out={out_path}", flush=True)
    print(f"meta={meta_path}", flush=True)
    if sheet_path:
        print(f"sheet={sheet_path}", flush=True)
    if corners_path:
        print(f"corners={corners_path}", flush=True)
    if matcap_path:
        print(f"matcap={matcap_path}", flush=True)
    if close_path:
        print(f"closeup={close_path}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(1)
