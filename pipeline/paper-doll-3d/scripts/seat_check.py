#!/usr/bin/env python3
"""Does the closure actually seat on the body?

Loads a body GLB and a closure GLB, puts the closure's origin on the body's
BB_ATTACH_NECK (which is what parent-and-zero does in the browser), and reports
the three clearances that decide whether the pairing is physically possible:

  skirt vs shoulder   the cap skirt runs DOWN from the rim. If it reaches
                      below the body's shoulder, the cap intersects glass.
  bore vs neck        the cap's thread root ID against the body's neck OD.
  crown vs rim        headroom between the bottle mouth and the cap ceiling.

Bodies are lathed from a silhouette, so neck length is whatever the photo
showed — it is NOT the drawing's finish height. That is exactly what this
measures, and why the finish-master splice is the next fix.

Run:
    blender --background --python scripts/seat_check.py -- \
        --body public/models/bodies/Cyl-round-17-415-70x20.glb \
        --closure glb-closures/BB_CAP_17415.glb
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy

MM = 1000.0                      # GLB metres -> report millimetres


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def mesh_of(objs):
    return next(o for o in objs if o.type == "MESH")


def empty_named(objs, name):
    for o in objs:
        if o.type == "EMPTY" and o.name.startswith(name):
            return o
    return None


def world_bounds(obj):
    """Bounds of the object's OWN geometry, in world space: (lo, hi, radius).

    Height is .z. The files are Y-up on disk, but the glTF IMPORTER converts
    back to Blender's Z-up, so the browser-side "height is .y" rule is exactly
    wrong in here — applying it reports a bottle's DIAMETER as its height.

    Deliberately not bound_box-of-children: anything parented to a datum would
    be measured as part of the bottle.
    """
    mw = obj.matrix_world
    pts = [mw @ v.co for v in obj.data.vertices]
    return (min(p.z for p in pts), max(p.z for p in pts),
            max((p.x ** 2 + p.y ** 2) ** 0.5 for p in pts))


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--body", required=True)
    ap.add_argument("--closure", required=True)
    args = ap.parse_args(argv)

    clear()
    body_objs = import_glb(args.body)
    body = mesh_of(body_objs)
    neck = empty_named(body_objs, "BB_ATTACH_NECK")
    shoulder = empty_named(body_objs, "BB_REF_SHOULDER")
    if neck is None:
        raise SystemExit("body has no BB_ATTACH_NECK — not to contract")

    clo_objs = import_glb(args.closure)
    clo = mesh_of(clo_objs)

    rim_y = neck.matrix_world.translation.z
    clo.matrix_world.translation = neck.matrix_world.translation   # parent-and-zero

    mw_b = body.matrix_world
    b_lo, b_hi, b_r = world_bounds(body)
    c_lo, c_hi, c_r = world_bounds(clo)
    sh_y = shoulder.matrix_world.translation.z if shoulder else None

    print("\n=== seat check ===")
    print(f"  body                 {Path(args.body).name}")
    print(f"  closure              {Path(args.closure).name}")
    print(f"  body height          {(b_hi - b_lo) * MM:8.2f} mm")
    print(f"  rim (BB_ATTACH_NECK) {rim_y * MM:8.2f} mm")
    print(f"  rim vs body top      {(rim_y - b_hi) * MM:8.2f} mm  "
          f"(0.00 = datum on the bare height)")
    if sh_y is not None:
        print(f"  shoulder             {sh_y * MM:8.2f} mm")
        print(f"  traced neck length   {(rim_y - sh_y) * MM:8.2f} mm")
    print(f"  cap skirt bottom     {c_lo * MM:8.2f} mm")
    print(f"  cap crown top        {c_hi * MM:8.2f} mm")
    print(f"  capped height        {(c_hi - b_lo) * MM:8.2f} mm")

    # The real test is RADIAL, not vertical. A cap skirt is designed to run
    # past the bottom of the finish (0.94 mm on the measured 17-415), so
    # "skirt below the datum" is not interference — it is how a cap covers the
    # finish. Interference is the body being WIDER than the cap's bore at a
    # height where the two overlap.
    verdict = []
    STEP = 0.25 * (1 / MM)
    body_pts = [(mw_b @ v.co) for v in body.data.vertices]
    clo_pts = [(clo.matrix_world @ v.co) for v in clo.data.vertices]

    def band(pts, z, half):
        return [p for p in pts if abs(p.z - z) <= half]

    # Compare radii at matching ANGLE, not min-vs-max around the ring.
    #
    # THREAD-STANDARD.md §4: the cap seats a half-period ANTI-PHASE so its
    # ridges nest in the bottle's root land, clearing ~0.44 mm radially. An
    # axisymmetric test cannot see that — it puts the bottle's crest and the
    # cap's ridge at the same height, ignores that they are 180 deg apart, and
    # reports a 0.60 mm collision that does not exist. Bin by (z, theta).
    SECTORS = 64

    def sector(p):
        return int(((math.atan2(p.y, p.x) + math.pi) / (2 * math.pi)) * SECTORS) % SECTORS

    worst, worst_z = None, None
    z = max(c_lo, b_lo)
    while z <= min(c_hi, b_hi):
        bb, cc = band(body_pts, z, STEP / 2), band(clo_pts, z, STEP / 2)
        if bb and cc:
            b_by, c_by = {}, {}
            for p in bb:
                k = sector(p); r = (p.x ** 2 + p.y ** 2) ** 0.5
                b_by[k] = max(b_by.get(k, 0.0), r)
            for p in cc:
                k = sector(p); r = (p.x ** 2 + p.y ** 2) ** 0.5
                c_by[k] = min(c_by.get(k, 1e9), r)
            for k in b_by.keys() & c_by.keys():
                gap = (c_by[k] - b_by[k]) * MM
                if worst is None or gap < worst:
                    worst, worst_z = gap, z
        z += STEP

    if worst is not None:
        print(f"\n  tightest radial gap  {worst:8.2f} mm  at z = {worst_z * MM:.2f} mm")
        if worst < 0:
            verdict.append(f"cap bore cuts {abs(worst):.2f} mm into glass "
                           f"at z={worst_z * MM:.1f} mm")
    if sh_y is not None:
        print(f"  skirt vs finish datum{(c_lo - sh_y) * MM:8.2f} mm  "
              f"(negative = skirt covers the datum, as designed)")
    if c_hi <= b_hi:
        verdict.append("cap crown is below the bottle mouth")

    print("\n  VERDICT              " + ("SEATS" if not verdict
                                         else "FAILS: " + "; ".join(verdict)))
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
