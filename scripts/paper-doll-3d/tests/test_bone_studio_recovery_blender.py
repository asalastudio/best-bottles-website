"""Blender integration gates for the bone studio recovery builder.

Run with any immutable five-variant locked scene already loaded.
"""

import importlib.util
import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts/paper-doll-3d"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


contract = load_module(
    "bone_studio_recovery_contract",
    SCRIPT_DIR / "bone_studio_recovery_contract.py",
)
builder = load_module(
    "bone_studio_recovery_builder",
    SCRIPT_DIR / "build-9ml-bone-studio-recovery.py",
)

variant = bpy.context.scene["bb_variant"]
expected_body_hash = (
    contract.SWIRL_BODY_SHA256 if variant == "swirl" else contract.SHARED_BODY_SHA256
)

before = builder.protected_snapshot()
assert before[contract.BODY_NAME]["mesh"] == expected_body_hash
assert before[contract.BODY_NAME]["thread_source_fingerprint"] == contract.THREAD_SHA256

builder.prepare_recovery_scene(variant=variant, mode="baseline")

after = builder.protected_snapshot()
contract.assert_protected_state(before, after)
assert after[contract.BODY_NAME]["mesh"] == expected_body_hash
assert after[contract.BODY_NAME]["thread_source_fingerprint"] == contract.THREAD_SHA256

camera = bpy.data.objects[contract.CAMERA_NAME]
assert camera.data.lens == contract.TARGET_STUDIO.camera_lens_mm
assert camera.data.sensor_width == contract.TARGET_STUDIO.camera_sensor_width_mm
assert camera.data.dof.use_dof is contract.TARGET_STUDIO.use_dof
assert tuple(round(value, 4) for value in camera.location) == tuple(
    round(value, 4) for value in contract.TARGET_STUDIO.camera_location_mm
)

assert not any(
    obj.name.startswith("BB_LUX_") and not obj.hide_render
    for obj in bpy.data.objects
), "luxury-only object remains render-enabled"

sweep = bpy.data.objects["BB_STUDIO_SWEEP"]
assert sweep.active_material is not None
assert sweep.active_material.get("bb_visible_backdrop_hex") == contract.TARGET_STUDIO.backdrop_hex
assert bpy.context.scene.get("bb_recovery_source") == str(contract.LOCKED_SOURCES[variant])

print(
    "PASS bone studio recovery protected state "
    + json.dumps(
        {
            "variant": variant,
            "body_hash": after[contract.BODY_NAME]["mesh"],
            "thread_hash": after[contract.BODY_NAME]["thread_source_fingerprint"],
            "camera": after[contract.CAMERA_NAME],
        },
        sort_keys=True,
    )
)
