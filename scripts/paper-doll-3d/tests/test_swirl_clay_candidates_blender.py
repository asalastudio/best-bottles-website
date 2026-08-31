"""Blender integration gates for the 10/12 swirl clay candidates."""

import importlib.util
import math
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
BUILDER_PATH = ROOT / "scripts/paper-doll-3d/build-five-variant-system.py"
RENDERER_PATH = ROOT / "scripts/paper-doll-3d/render-views.py"


spec = importlib.util.spec_from_file_location("bb_candidate_builder", BUILDER_PATH)
builder = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = builder
spec.loader.exec_module(builder)

renderer_spec = importlib.util.spec_from_file_location(
    "bb_candidate_renderer", RENDERER_PATH
)
renderer = importlib.util.module_from_spec(renderer_spec)
sys.modules[renderer_spec.name] = renderer
renderer_spec.loader.exec_module(renderer)

expected_thread = (
    "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"
)

for flute_count in (10, 12):
    bpy.ops.wm.open_mainfile(filepath=str(builder.LOCKED_BASELINE))
    finish_before = builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME])
    body = builder.build_swirl_candidate(flute_count)
    assert body["bb_swirl_flute_count"] == flute_count
    assert math.isclose(body["bb_swirl_twist_deg"], 90.0, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_depth_mm"], 0.75, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_fade_mm"], 2.75, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_channel_power"], 2.5, abs_tol=1e-6)
    assert body["bb_thread_source_fingerprint"] == expected_thread
    assert builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME]) == finish_before
    assert body["bb_min_wall_mm"] >= 0.8
    assert body.dimensions.x <= 21.5
    assert body.dimensions.y <= 21.5
    assert body.dimensions.z <= 75.0
    outer_radii = [
        math.hypot(vertex.co.x, vertex.co.y) for vertex in body.data.vertices
    ]
    assert max(outer_radii) <= 10.5 + 1e-3
    clay = renderer.apply_body_only_clay(body)
    clay_index = list(body.data.materials).index(clay)
    datum_z = body["bb_finish_datum_z_mm"]
    body_faces = []
    finish_faces = []
    for polygon in body.data.polygons:
        mean_z = sum(
            body.data.vertices[index].co.z for index in polygon.vertices
        ) / len(polygon.vertices)
        if mean_z < datum_z - 1e-4:
            body_faces.append(polygon)
        elif mean_z > datum_z + 1e-4:
            finish_faces.append(polygon)
    assert body_faces and finish_faces
    assert all(polygon.material_index == clay_index for polygon in body_faces)
    assert all(polygon.material_index != clay_index for polygon in finish_faces)

print("PASS 10/12 swirl candidates preserve locked finish and measured envelope")
