#!/usr/bin/env python3
"""Build a geometry-safe working copy for the Best Bottles bone studio recovery."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent


def _load_contract():
    path = SCRIPT_DIR / "bone_studio_recovery_contract.py"
    spec = importlib.util.spec_from_file_location("bone_studio_recovery_contract", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


contract = _load_contract()


def mesh_fingerprint(obj, precision=6):
    coordinates = {
        (round(vertex.co.x, precision), round(vertex.co.y, precision), round(vertex.co.z, precision))
        for vertex in obj.data.vertices
    }
    payload = json.dumps(sorted(coordinates), separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _vector(values, digits=6):
    return tuple(round(float(value), digits) for value in values)


def object_snapshot(obj):
    result = {
        "type": obj.type,
        "location": _vector(obj.location),
        "rotation_euler": _vector(obj.rotation_euler),
        "scale": _vector(obj.scale),
        "hide_render": bool(obj.hide_render),
    }
    if obj.type == "MESH":
        result["mesh"] = mesh_fingerprint(obj)
        result["materials"] = tuple(material.name for material in obj.data.materials if material)
    if obj.type == "CAMERA":
        result.update(
            {
                "lens": round(float(obj.data.lens), 6),
                "sensor_width": round(float(obj.data.sensor_width), 6),
                "use_dof": bool(obj.data.dof.use_dof),
            }
        )
    thread_hash = obj.get("bb_thread_source_fingerprint")
    if thread_hash is not None:
        result["thread_source_fingerprint"] = str(thread_hash)
    return result


def protected_snapshot():
    names = (contract.BODY_NAME, contract.FINISH_NAME, contract.CAMERA_NAME)
    missing = [name for name in names if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError(f"locked recovery scene is missing protected objects: {missing}")
    return {name: object_snapshot(bpy.data.objects[name]) for name in names}


def _linear_rgba(hex_color):
    value = hex_color.lstrip("#")
    if len(value) != 6:
        raise ValueError(f"expected six-digit hex color, received {hex_color}")

    def linear(channel):
        srgb = int(channel, 16) / 255.0
        return srgb / 12.92 if srgb <= 0.04045 else ((srgb + 0.055) / 1.055) ** 2.4

    return tuple(linear(value[index : index + 2]) for index in (0, 2, 4)) + (1.0,)


def _principled(material):
    if material is None or not material.use_nodes:
        raise RuntimeError("bone studio sweep has no node material")
    node = next(
        (candidate for candidate in material.node_tree.nodes if candidate.type == "BSDF_PRINCIPLED"),
        None,
    )
    if node is None:
        raise RuntimeError("bone studio sweep material has no Principled BSDF")
    return node


def configure_bone_baseline():
    target = contract.TARGET_STUDIO
    scene = bpy.context.scene
    camera = bpy.data.objects[contract.CAMERA_NAME]

    if not math.isclose(camera.data.lens, target.camera_lens_mm, abs_tol=1e-6):
        raise AssertionError("locked camera lens does not match recovery contract")
    if not math.isclose(camera.data.sensor_width, target.camera_sensor_width_mm, abs_tol=1e-6):
        raise AssertionError("locked camera sensor does not match recovery contract")
    if _vector(camera.location, 4) != _vector(target.camera_location_mm, 4):
        raise AssertionError("locked camera location does not match recovery contract")
    expected_rotation = tuple(math.radians(value) for value in target.camera_rotation_deg)
    if _vector(camera.rotation_euler, 5) != _vector(expected_rotation, 5):
        raise AssertionError("locked camera rotation does not match recovery contract")
    if camera.data.dof.use_dof != target.use_dof:
        raise AssertionError("locked camera depth of field does not match recovery contract")

    sweep = bpy.data.objects.get("BB_STUDIO_SWEEP")
    if sweep is None or sweep.type != "MESH":
        raise RuntimeError("locked scene is missing BB_STUDIO_SWEEP")
    material = sweep.active_material
    shader = _principled(material)
    visible_bone = _linear_rgba(target.backdrop_hex)
    shader.inputs["Base Color"].default_value = visible_bone
    shader.inputs["Roughness"].default_value = 0.92
    material["bb_visible_backdrop_hex"] = target.backdrop_hex
    material["bb_recovery_role"] = "studio"

    if scene.world is None:
        scene.world = bpy.data.worlds.new("BB_WORLD_BONE_RECOVERY")
    scene.world.use_nodes = True
    background = next(
        node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND"
    )
    background.inputs["Color"].default_value = visible_bone
    background.inputs["Strength"].default_value = 0.35
    scene.world["bb_recovery_role"] = "world"

    for obj in bpy.data.objects:
        if obj.name.startswith("BB_LUX_"):
            obj.hide_render = True

    scene.camera = camera
    scene.render.engine = target.engine
    scene.render.resolution_x = target.render_width_px
    scene.render.resolution_y = target.render_height_px
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "16"
    scene.view_settings.view_transform = target.view_transform
    scene.view_settings.look = target.look
    scene.view_settings.exposure = target.exposure
    scene.render.film_transparent = False


def _file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_locked_source(variant):
    source = Path(bpy.data.filepath).resolve()
    expected = contract.LOCKED_SOURCES[variant].resolve()
    if source != expected:
        raise AssertionError(f"recovery must start from {expected}, loaded {source}")
    actual_sha = _file_sha256(source)
    expected_sha = contract.LOCKED_FILE_SHA256[variant]
    if actual_sha != expected_sha:
        raise AssertionError(
            f"locked {variant} file hash drifted: expected {expected_sha}, received {actual_sha}"
        )


def prepare_recovery_scene(variant, mode="baseline"):
    if mode != "baseline":
        raise ValueError(f"unsupported recovery mode before approval: {mode}")
    if variant not in contract.LOCKED_SOURCES:
        raise ValueError(f"unknown recovery variant: {variant}")
    scene_variant = bpy.context.scene.get("bb_variant")
    if scene_variant != variant:
        raise AssertionError(f"loaded scene is {scene_variant}, requested {variant}")

    before = protected_snapshot()
    expected_body = (
        contract.SWIRL_BODY_SHA256 if variant == "swirl" else contract.SHARED_BODY_SHA256
    )
    if before[contract.BODY_NAME]["mesh"] != expected_body:
        raise AssertionError(f"locked {variant} body geometry fingerprint drifted")
    if before[contract.BODY_NAME].get("thread_source_fingerprint") != contract.THREAD_SHA256:
        raise AssertionError(f"locked {variant} thread fingerprint drifted")

    configure_bone_baseline()
    after = protected_snapshot()
    contract.assert_protected_state(before, after)
    scene = bpy.context.scene
    scene["bb_recovery_source"] = str(contract.LOCKED_SOURCES[variant])
    scene["bb_recovery_variant"] = variant
    scene["bb_recovery_mode"] = mode
    scene["bb_recovery_body_sha256"] = expected_body
    scene["bb_recovery_thread_sha256"] = contract.THREAD_SHA256
    return after


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", required=True, choices=tuple(contract.LOCKED_SOURCES))
    parser.add_argument("--mode", default="baseline", choices=("baseline",))
    parser.add_argument("--output", type=Path)
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(
        argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )
    validate_locked_source(args.variant)
    snapshot = prepare_recovery_scene(args.variant, args.mode)
    output = (args.output or contract.working_scene_path(args.variant)).expanduser().resolve()
    if contract.LOCK_ROOT.resolve() in output.parents:
        raise AssertionError("recovery output may not overwrite the locked source directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=False)
    print(
        "BB_BONE_RECOVERY_BUILT "
        + json.dumps(
            {"variant": args.variant, "output": str(output), "protected": snapshot},
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
