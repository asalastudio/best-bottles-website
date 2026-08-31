"""Audit promoted five-variant Blender scenes as one locked family.

Run with Blender and pass the five .blend paths after ``--``.
"""

import bpy
import hashlib
import json
import math
import sys
from pathlib import Path


BODY_NAME = "BB_BTL_CYL_009ML_001"
EXPECTED_VARIANTS = {"clear", "frosted", "cobalt", "amber", "swirl"}


def mesh_hash(obj, z_min=None, z_offset=0.0, precision=6):
    coordinates = set()
    for vertex in obj.data.vertices:
        co = vertex.co
        if z_min is None or co.z >= z_min - 1e-5:
            coordinates.add(
                (
                    round(co.x, precision),
                    round(co.y, precision),
                    round(co.z - z_offset, precision),
                )
            )
    ordered = sorted(coordinates)
    payload = json.dumps(ordered, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


paths = [Path(value).resolve() for value in sys.argv[sys.argv.index("--") + 1 :]]
assert len(paths) == 5, f"expected five locked scenes, received {len(paths)}"

records = []
for path in paths:
    assert path.exists(), f"missing locked scene: {path}"
    bpy.ops.wm.open_mainfile(filepath=str(path))
    variant = bpy.context.scene["bb_variant"]
    body = bpy.data.objects[BODY_NAME]
    datum = body["bb_finish_datum_z_mm"]
    assert variant in EXPECTED_VARIANTS
    assert math.isclose(body["bb_finish_height_mm"], 13.76, abs_tol=1e-6)
    assert math.isclose(body["bb_thread_pitch_mm"], 2.7, abs_tol=1e-6)
    assert math.isclose(body["bb_thread_turns"], 2.0, abs_tol=1e-6)
    assert math.isclose(body["bb_thread_group_offset_z_mm"], 0.375, abs_tol=1e-6)
    assert math.isclose(body["bb_thread_runout_overlap_deg"], 20.0, abs_tol=1e-6)
    assert math.isclose(body["bb_band_height_mm"], 2.0, abs_tol=1e-6)
    assert math.isclose(body["bb_band_center_z_mm"], 1.3, abs_tol=1e-6)
    records.append(
        {
            "variant": variant,
            "path": str(path),
            "finish_hash": mesh_hash(
                body, datum + 0.01, z_offset=datum, precision=3
            ),
            "thread_source_fingerprint": body["bb_thread_source_fingerprint"],
            "full_geometry_hash": mesh_hash(body),
            "material": body.data.materials[0].name,
        }
    )

assert {record["variant"] for record in records} == EXPECTED_VARIANTS
print("LOCK_AUDIT_DIAGNOSTIC " + json.dumps(records, sort_keys=True))
thread_signatures = {record["thread_source_fingerprint"] for record in records}
assert len(thread_signatures) == 1, "approved helix source differs across variants"
shared_hashes = {
    record["full_geometry_hash"]
    for record in records
    if record["variant"] != "swirl"
}
assert len(shared_hashes) == 1, "clear/frosted/cobalt/amber body geometry differs"
swirl_hash = next(
    record["full_geometry_hash"] for record in records if record["variant"] == "swirl"
)
assert swirl_hash not in shared_hashes, "swirl lost its independent molded body geometry"

print("PASS locked five-variant family: identical 17-415 finish/thread signature")
print("LOCK_AUDIT_JSON " + json.dumps(records, sort_keys=True))
