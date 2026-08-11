"""Blender integration gates for the five-variant working scenes.

Run with the immutable approved baseline already loaded:

    blender -b pipeline/paper-doll-3d/master/locked/\
009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
        -P scripts/paper-doll-3d/tests/test_five_variant_blender.py
"""

import importlib.util
import math
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


def principled(material):
    return next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")


def volume_absorption(material):
    return next(
        (node for node in material.node_tree.nodes if node.type == "VOLUME_ABSORPTION"),
        None,
    )


materials = {name: builder.build_glass_material(name) for name in builder.contract.VARIANTS}
for name in ("clear", "cobalt", "amber", "swirl"):
    material = materials[name]
    shader = principled(material)
    assert shader.inputs["Transmission Weight"].default_value == 1.0
    assert shader.inputs["IOR"].default_value == 1.5
    assert 0.02 <= shader.inputs["Roughness"].default_value <= 0.04
    assert not any(node.type == "BUMP" for node in material.node_tree.nodes), (
        f"{name} polished material still contains a Bump node"
    )

cobalt_volume = volume_absorption(materials["cobalt"])
amber_volume = volume_absorption(materials["amber"])
assert cobalt_volume is not None
assert amber_volume is not None
assert math.isclose(cobalt_volume.inputs["Density"].default_value, 0.85, abs_tol=1e-6)
assert math.isclose(amber_volume.inputs["Density"].default_value, 0.95, abs_tol=1e-6)
assert volume_absorption(materials["clear"]) is None
assert volume_absorption(materials["swirl"]) is None

frosted = materials["frosted"]
assert any(node.type == "TEX_NOISE" for node in frosted.node_tree.nodes)
assert any(node.type == "BUMP" for node in frosted.node_tree.nodes)
assert math.isclose(
    principled(frosted).inputs["Roughness"].default_value, 0.28, abs_tol=1e-6
)

body_material = bpy.data.objects[builder.BODY_NAME].data.materials[0]
finish_material = bpy.data.objects[builder.FINISH_NAME].data.materials[0]
assert body_material == materials["clear"]
assert finish_material == materials["clear"]

strip = builder.ensure_reflection_strip()
assert strip.name == "BB_CARD_GLASS_REFLECTION_STRIP"
assert tuple(round(value, 3) for value in strip.dimensions[:2]) == (55.0, 240.0)
assert not strip.visible_camera
assert not strip.visible_diffuse
assert not strip.visible_transmission
assert not strip.visible_shadow
assert strip.visible_glossy
assert any(node.type == "LIGHT_PATH" for node in strip.data.materials[0].node_tree.nodes)

print("PASS five-variant Blender baseline, material, and reflection-card gates")
