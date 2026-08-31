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
RENDERER_PATH = ROOT / "scripts/paper-doll-3d/render-views.py"
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
renderer_spec = importlib.util.spec_from_file_location(
    "bb_nine_ml_renderer", RENDERER_PATH
)
renderer = importlib.util.module_from_spec(renderer_spec)
sys.modules[renderer_spec.name] = renderer
renderer_spec.loader.exec_module(renderer)

before = builder.protected_snapshot()
assert set(before) == PROTECTED, f"protected set drifted: {set(before)}"
body_before = builder.mesh_fingerprint(bpy.data.objects[builder.BODY_NAME])
finish_before = builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME])

builder.build_variant("clear", save=False)

after = builder.protected_snapshot()
assert before == after, "clear variant changed protected camera/studio/light/finish state"
assert body_before != builder.mesh_fingerprint(bpy.data.objects[builder.BODY_NAME]), (
    "clear variant did not replace the capped body/finish pair with one continuous shell"
)
assert finish_before == builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME]), (
    "clear variant changed the approved 17/415 finish mesh"
)
assert bpy.context.scene["bb_variant"] == "clear"
continuous = bpy.data.objects[builder.BODY_NAME]
source_finish = bpy.data.objects[builder.FINISH_NAME]
assert continuous["bb_continuous_glass_shell"]
assert math.isclose(continuous["bb_finish_height_mm"], 13.76, abs_tol=1e-6)
assert math.isclose(continuous["bb_band_height_mm"], 2.0, abs_tol=1e-6)
assert math.isclose(continuous["bb_band_center_z_mm"], 1.3, abs_tol=1e-6)
assert math.isclose(
    continuous["bb_thread_group_offset_z_mm"], 0.375, abs_tol=1e-6
)
assert math.isclose(
    continuous["bb_thread_runout_overlap_deg"], 20.0, abs_tol=1e-6
)
clear_thread_source_fingerprint = continuous["bb_thread_source_fingerprint"]
assert clear_thread_source_fingerprint == (
    "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"
)
assert continuous["bb_precision_shoulder"]
assert math.isclose(
    continuous["bb_shoulder_start_z_mm"], 55.692, abs_tol=0.01
)
assert math.isclose(
    continuous["bb_shoulder_end_z_mm"], 58.24, abs_tol=1e-6
)
assert continuous["bb_min_smooth_wall_mm"] >= 1.5
shoulder_center_z, shoulder_distance = renderer.shoulder_frame(continuous)
assert math.isclose(shoulder_center_z, 63.5, abs_tol=1e-6)
assert math.isclose(shoulder_distance, 72.0, abs_tol=1e-6)
assert source_finish.hide_render
datum_z = continuous["bb_finish_datum_z_mm"]
datum_faces = [
    polygon
    for polygon in continuous.data.polygons
    if all(abs(continuous.data.vertices[index].co.z - datum_z) < 1e-4
           for index in polygon.vertices)
]
assert not datum_faces, "continuous shell still contains a transverse datum annulus"
straight_body_radii = [
    (vertex.co.x ** 2 + vertex.co.y ** 2) ** 0.5
    for vertex in continuous.data.vertices
    if abs(vertex.co.z - continuous["bb_shoulder_start_z_mm"]) < 1e-3
    and (vertex.co.x ** 2 + vertex.co.y ** 2) ** 0.5 > 9.0
]
assert straight_body_radii
assert max(abs(radius - 9.85) for radius in straight_body_radii) < 1e-3
master_module = builder._load_master_builder()
profile_spec = dict(master_module.CYL_SPECS["009"])
profile_finish = dict(master_module.FINISH_MASTERS["17-415"])
raw_profile = builder._precision_009_body_profile(
    master_module, profile_spec, profile_finish
)
outer_end_index = next(
    index
    for index, (radius, z) in enumerate(raw_profile)
    if math.isclose(radius, 7.4, abs_tol=1e-6)
    and math.isclose(z, 58.24, abs_tol=1e-6)
)
outer_ring_radii = [
    radius
    for radius, z in raw_profile[:outer_end_index + 1]
    if continuous["bb_shoulder_start_z_mm"] - 1e-4 <= z <= 58.24 + 1e-4
]
assert len(outer_ring_radii) >= 40
assert all(
    next_radius <= radius + 1e-4
    for radius, next_radius in zip(outer_ring_radii, outer_ring_radii[1:])
)
thread_band_radii = [
    (vertex.co.x ** 2 + vertex.co.y ** 2) ** 0.5
    for vertex in continuous.data.vertices
    if datum_z + 4.0 <= vertex.co.z <= datum_z + 12.9
]
assert max(thread_band_radii) >= 8.14, (
    "continuous shell lost the 16.3 mm approved thread crest diameter"
)


def principled(material):
    return next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")


def volume_absorption(material):
    return next(
        (node for node in material.node_tree.nodes if node.type == "VOLUME_ABSORPTION"),
        None,
    )


materials = {name: builder.build_glass_material(name) for name in builder.contract.VARIANTS}
for name in ("clear", "frosted", "cobalt", "amber"):
    material = materials[name]
    shader = principled(material)
    assert shader.inputs["Transmission Weight"].default_value == 1.0
    assert math.isclose(shader.inputs["IOR"].default_value, 1.52, abs_tol=1e-6)
    expected_roughness = builder.contract.VARIANTS[name].roughness
    assert math.isclose(
        shader.inputs["Roughness"].default_value,
        expected_roughness,
        abs_tol=1e-6,
    )
    expected_tint = (*builder.contract.VARIANTS[name].surface_tint, 1.0)
    assert all(
        math.isclose(actual, expected, abs_tol=1e-6)
        for actual, expected in zip(
            shader.inputs["Base Color"].default_value,
            expected_tint,
        )
    )
    if name != "frosted":
        assert not any(node.type == "BUMP" for node in material.node_tree.nodes), (
            f"{name} polished material still contains a Bump node"
        )
    assert math.isclose(material["bb_ior"], 1.52, abs_tol=1e-6)
    assert math.isclose(material["bb_transmission"], 1.0, abs_tol=1e-6)
    assert math.isclose(material["bb_roughness"], expected_roughness, abs_tol=1e-6)

for name in ("cobalt", "amber"):
    shader = principled(materials[name])
    assert all(
        math.isclose(value, 1.0, abs_tol=1e-6)
        for value in shader.inputs["Base Color"].default_value
    )

cobalt_volume = volume_absorption(materials["cobalt"])
amber_volume = volume_absorption(materials["amber"])
assert cobalt_volume is not None
assert amber_volume is not None
assert math.isclose(cobalt_volume.inputs["Density"].default_value, 0.55, abs_tol=1e-6)
assert math.isclose(amber_volume.inputs["Density"].default_value, 0.75, abs_tol=1e-6)
assert all(
    math.isclose(actual, expected, abs_tol=1e-6)
    for actual, expected in zip(
        cobalt_volume.inputs["Color"].default_value,
        (0.003, 0.012, 0.92, 1.0),
    )
)
assert all(
    math.isclose(actual, expected, abs_tol=1e-6)
    for actual, expected in zip(
        amber_volume.inputs["Color"].default_value,
        (0.72, 0.32, 0.045, 1.0),
    )
)
assert volume_absorption(materials["clear"]) is None
assert volume_absorption(materials["swirl"]) is None

frosted = materials["frosted"]
frost_noise = next(node for node in frosted.node_tree.nodes if node.type == "TEX_NOISE")
frost_bump = next(node for node in frosted.node_tree.nodes if node.type == "BUMP")
assert math.isclose(frost_noise.inputs["Scale"].default_value, 85.0, abs_tol=1e-6)
assert math.isclose(frost_bump.inputs["Strength"].default_value, 0.04, abs_tol=1e-6)
assert math.isclose(frost_bump.inputs["Distance"].default_value, 0.012, abs_tol=1e-6)
assert math.isclose(
    principled(frosted).inputs["Roughness"].default_value, 0.22, abs_tol=1e-6
)

body_material = bpy.data.objects[builder.BODY_NAME].data.materials[0]
assert body_material == materials["clear"]

strip = builder.ensure_reflection_strip()
assert strip.name == "BB_CARD_GLASS_REFLECTION_STRIP"
assert tuple(round(value, 3) for value in strip.dimensions[:2]) == (55.0, 240.0)
assert not strip.visible_camera
assert not strip.visible_diffuse
assert not strip.visible_transmission
assert not strip.visible_shadow
assert strip.visible_glossy
assert any(node.type == "LIGHT_PATH" for node in strip.data.materials[0].node_tree.nodes)

camera_before_card = builder.object_snapshot(bpy.data.objects["BB_CAM_MASTER"])
key_before_card = builder.object_snapshot(bpy.data.objects["BB_LIGHT_KEY_SOFTBOX"])
transmission_card = builder.ensure_transmission_card()
assert transmission_card.name == "BB_CARD_GLASS_TRANSMISSION_BACK"
assert not transmission_card.visible_camera
assert not transmission_card.visible_shadow
assert transmission_card.visible_transmission
assert not transmission_card.visible_glossy
assert not transmission_card.visible_diffuse
assert transmission_card["bb_role"] == "transmission_only_back_card"
assert transmission_card["bb_dimensions_mm"] == "140x220"
assert builder.object_snapshot(bpy.data.objects["BB_CAM_MASTER"]) == camera_before_card
assert builder.object_snapshot(bpy.data.objects["BB_LIGHT_KEY_SOFTBOX"]) == key_before_card

builder.configure_workspaces()
assert bpy.context.window.workspace.name == "SCENE OVERVIEW"
largest_area = max(
    bpy.context.window.screen.areas,
    key=lambda area: area.width * area.height,
)
assert largest_area.type == "VIEW_3D"
assert strip.display_type == "BOUNDS"
assert strip.show_name
assert not bpy.data.objects[builder.BODY_NAME].hide_viewport

# Reload the immutable source before exercising the sole geometry exception.
bpy.ops.wm.open_mainfile(filepath=str(builder.LOCKED_BASELINE))
smooth_fingerprint = builder.mesh_fingerprint(bpy.data.objects[builder.BODY_NAME])
finish_fingerprint = builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME])

builder.build_swirl_candidate(10)

swirl = bpy.data.objects[builder.BODY_NAME]
finish = bpy.data.objects[builder.FINISH_NAME]
assert builder.mesh_fingerprint(swirl) != smooth_fingerprint
assert builder.mesh_fingerprint(finish) == finish_fingerprint
assert not any(modifier.type == "DISPLACE" for modifier in swirl.modifiers)
assert math.isclose(swirl.dimensions.x, 21.0, abs_tol=0.5)
assert math.isclose(swirl.dimensions.y, 21.0, abs_tol=0.5)
assert math.isclose(swirl.dimensions.z, 74.0, abs_tol=1.0)
assert swirl["bb_swirl_flute_count"] == 10
assert swirl["bb_swirl_twist_deg"] == 90.0
assert swirl["bb_swirl_depth_mm"] == 0.75
assert swirl["bb_swirl_fade_mm"] == 2.75
assert swirl["bb_swirl_channel_power"] == 2.5
assert swirl["bb_thread_source_fingerprint"] == clear_thread_source_fingerprint
assert swirl["bb_min_wall_mm"] >= 0.8
assert swirl["bb_geometry_authority"] == "photo-solved relief; measured envelope"

# Real mesh evidence: a mid-body ring contains repeated inward radii rather
# than one smooth cylindrical radius, and no render-time modifier supplies it.
mid_radii = {
    round((vertex.co.x ** 2 + vertex.co.y ** 2) ** 0.5, 3)
    for vertex in swirl.data.vertices
    if 20.0 <= vertex.co.z <= 40.0
    and (vertex.co.x ** 2 + vertex.co.y ** 2) ** 0.5 > 9.7
}
assert len(mid_radii) >= 20, f"swirl relief is not present in mesh radii: {mid_radii}"

print(
    "PASS five-variant Blender baseline, materials, reflection card, "
    "and molded-swirl gates"
)
