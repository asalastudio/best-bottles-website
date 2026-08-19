"""Regression gate for the 9 mL bottle's 17/415 external thread.

Run with Blender so this exercises the real mesh generator:

    /Applications/Blender.app/Contents/MacOS/Blender \
        -b --factory-startup \
        -P scripts/paper-doll-3d/tests/test_17_415_helix.py
"""

import importlib.util
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
BUILD_SCRIPT = ROOT / "scripts/paper-doll-3d/build-master-scene.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("bb_build_master", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def unwrap_turns(thread, section_samples=24):
    """Measure turns from the generated sweep rings, not registry metadata."""
    sweep_vertices = len(thread.data.vertices) - 2  # two buried end-cap centers
    assert sweep_vertices % section_samples == 0
    ring_count = sweep_vertices // section_samples
    angles = []
    for ring in range(ring_count):
        co = thread.data.vertices[ring * section_samples].co
        angles.append(math.atan2(co.y, co.x))

    travel = 0.0
    for previous, current in zip(angles, angles[1:]):
        delta = current - previous
        if delta > math.pi:
            delta -= 2.0 * math.pi
        elif delta < -math.pi:
            delta += 2.0 * math.pi
        travel += delta
    return abs(travel) / (2.0 * math.pi)


def top_runout_angle_deg(thread, section_samples=24):
    """Read the top sweep ring's azimuth from the generated mesh."""
    sweep_vertices = len(thread.data.vertices) - 2
    ring_count = sweep_vertices // section_samples
    co = thread.data.vertices[(ring_count - 1) * section_samples].co
    return math.degrees(math.atan2(co.y, co.x)) % 360.0


def bottom_runout_angle_deg(thread, section_samples=24):
    """Read the bottom sweep ring's azimuth from the generated mesh."""
    co = thread.data.vertices[0].co
    return math.degrees(math.atan2(co.y, co.x)) % 360.0


builder = load_builder()
finish = dict(builder.FINISH_MASTERS["17-415"])
thread = builder.helical_thread_object(finish, "TEST_17_415_THREAD")

assert math.isclose(finish["finish_h"], 13.76, abs_tol=1e-6), (
    f"17/415 visual finish height drifted: {finish['finish_h']:.3f} mm"
)
assert math.isclose(finish["nominal_finish_h"], 14.06, abs_tol=1e-6), (
    "17/415 lost the drawing's nominal finish-height datum"
)
assert math.isclose(finish["thread_profile_w"], 2.65, abs_tol=1e-6), (
    f"17/415 visible thread spacing drifted: {finish['thread_profile_w']:.3f} mm"
)
assert math.isclose(finish["nominal_pitch"], 3.175, abs_tol=1e-6), (
    "17/415 lost the engineering pitch datum"
)
assert math.isclose(finish["pitch"], 2.7, abs_tol=1e-6), (
    f"17/415 visual pass spacing drifted: pitch={finish['pitch']:.3f} mm"
)
assert math.isclose(finish["thread_material_envelope"], 8.05, abs_tol=1e-6), (
    "17/415 tightened visual thread group drifted from 8.05 mm"
)
assert math.isclose(finish["thread_group_offset_z"], 0.375, abs_tol=1e-6), (
    "17/415 thread group drifted from the 0.375 mm upward visual adjustment"
)
assert math.isclose(finish["runout_arc_deg"], 20.0, abs_tol=1e-6), (
    "17/415 runout taper drifted from the drawing-matched center overlap: "
    f"{finish['runout_arc_deg']:.1f} degrees"
)
assert math.isclose(finish["runout_power"], 0.5, abs_tol=1e-6), (
    "17/415 runout tip drifted from the drawing-matched pointed profile: "
    f"power={finish['runout_power']:.2f}"
)
assert math.isclose(finish["runout_overlap_deg"], 20.0, abs_tol=1e-6), (
    "17/415 front runouts lost the drawing-matched endpoint overlap"
)

bottle_spec = builder.resolve_thread(dict(builder.CYL_SPECS["009"]))
assert math.isclose(bottle_spec["turns"], 2.0, abs_tol=1e-6), (
    "9 mL bottle metadata/cap path drifted from the two-turn finish master: "
    f"{bottle_spec['turns']:.4f} turns"
)
assert math.isclose(bottle_spec["pitch"], 2.7, abs_tol=1e-6), (
    "9 mL bottle metadata/cap path drifted from the closer visual pitch: "
    f"{bottle_spec['pitch']:.3f} mm"
)

measured_turns = unwrap_turns(thread)
top_angle = top_runout_angle_deg(thread)
bottom_angle = bottom_runout_angle_deg(thread)
z_values = [vertex.co.z for vertex in thread.data.vertices]
material_envelope = max(z_values) - min(z_values)

# The active 17/415 visual-review master remains a two-turn continuous thread,
# but deliberately uses 2.7 mm center spacing inside the drawing's 8.8 mm
# nominal zone. `nominal_pitch` preserves the 3.175 mm engineering datum.
expected_visible_turns = 2.0 + 40.0 / 360.0
assert math.isclose(measured_turns, expected_visible_turns, abs_tol=0.01), (
    f"17/415 generated {measured_turns:.4f} visible turns; "
    f"expected {expected_visible_turns:.4f} with runout overlap"
)
assert math.isclose(material_envelope, 8.05, abs_tol=0.05), (
    f"17/415 thread envelope is {material_envelope:.3f} mm; expected 8.050 mm"
)
assert math.isclose(top_angle, 290.0, abs_tol=0.1), (
    "17/415 default face does not match the drawing's top-left / bottom-right "
    f"runout presentation: top angle is {top_angle:.1f} degrees"
)
assert math.isclose(bottom_angle, 250.0, abs_tol=0.1), (
    "17/415 bottom runout does not extend past the front centerline: "
    f"bottom angle is {bottom_angle:.1f} degrees"
)

# The dimensional audit must compare the generated crest path with the
# inset centerline datums, not compare that path to the wider material edges.
master = builder.build_finish_master("17-415")
assert builder.audit_finish_master(master, finish), (
    "17/415 finish audit rejected drawing-correct two-turn geometry"
)

print(
    "PASS 17/415 helix: "
    f"turns={measured_turns:.4f}, material_envelope={material_envelope:.3f} mm, "
    f"top_runout={top_angle:.1f} degrees, bottom_runout={bottom_angle:.1f} degrees"
)
