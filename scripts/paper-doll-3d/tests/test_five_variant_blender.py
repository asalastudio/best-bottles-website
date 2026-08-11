"""Blender integration gates for the five-variant working scenes.

Run with the immutable approved baseline already loaded:

    blender -b pipeline/paper-doll-3d/master/locked/\
009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
        -P scripts/paper-doll-3d/tests/test_five_variant_blender.py
"""

import importlib.util
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
BUILDER_PATH = ROOT / "scripts/paper-doll-3d/build-five-variant-system.py"
PROTECTED = {
    "BB_CAM_MASTER",
    "BB_STUDIO_SWEEP",
    "BB_LIGHT_KEY_SOFTBOX",
    "BB_CARD_FILL_RIGHT",
    "BB_CARD_TOP",
    "BB_LIGHT_SWEEP_WASH",
    "BB_FIN_17_415",
}


def load_builder():
    spec = importlib.util.spec_from_file_location("bb_five_variant_builder", BUILDER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = load_builder()

before = builder.protected_snapshot()
assert set(before) == PROTECTED, f"protected set drifted: {set(before)}"
body_before = builder.mesh_fingerprint(bpy.data.objects[builder.BODY_NAME])
finish_before = builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME])

builder.build_variant("clear", save=False)

after = builder.protected_snapshot()
assert before == after, "clear variant changed protected camera/studio/light/finish state"
assert body_before == builder.mesh_fingerprint(bpy.data.objects[builder.BODY_NAME]), (
    "clear variant changed the approved smooth-body mesh"
)
assert finish_before == builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME]), (
    "clear variant changed the approved 17/415 finish mesh"
)
assert bpy.context.scene["bb_variant"] == "clear"

print("PASS five-variant Blender baseline preservation")
