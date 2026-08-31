#!/usr/bin/env python3
"""Report a body's radius profile near the rim, against its drawing finish.

The splice has to cut the body where the finish master's base belongs, and
that height is NOT the traced BB_REF_SHOULDER: the shoulder datum is "first
height below ~72% of max half-width", while the drawing's finish datum is the
bottom of the threaded finish, at radius E/2. This prints both so the cut
plane can be chosen from evidence.

    blender --background --python scripts/neck_probe.py -- \
        --body ../../public/models/bodies/Cyl-round-17-415-70x20.glb
"""

from __future__ import annotations

import argparse
import importlib.util as ilu
import math
import sys
from pathlib import Path

import bpy

MM = 1000.0
RIG_DIR = Path(__file__).resolve().parents[3] / "scripts" / "paper-doll-3d"


def load_rig():
    spec = ilu.spec_from_file_location(
        "build_master_scene", RIG_DIR / "build-master-scene.py")
    mod = ilu.module_from_spec(spec)
    sys.modules["build_master_scene"] = mod
    spec.loader.exec_module(mod)
    return mod


def finish_of(body_id):
    """Body ids look like Cyl-round-17-415-70x20 / Cr-boxy-18-415-105x89x29."""
    for part in ("8-425", "8-425"):
        pass
    import re
    m = re.search(r"(\d{1,2}-\d{3})", body_id)
    return m.group(1) if m else None


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--body", required=True)
    ap.add_argument("--step", type=float, default=0.5, help="mm")
    args = ap.parse_args(argv)

    rig = load_rig()
    body_id = Path(args.body).stem
    finish = finish_of(body_id)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=args.body)
    objs = [o for o in bpy.data.objects if o not in before]
    mesh = next(o for o in objs if o.type == "MESH")
    neck = next((o for o in objs if o.name.startswith("BB_ATTACH_NECK")), None)
    sh = next((o for o in objs if o.name.startswith("BB_REF_SHOULDER")), None)

    mw = mesh.matrix_world
    pts = [mw @ v.co for v in mesh.data.vertices]     # Z-up after import
    rim = neck.matrix_world.translation.z * MM

    print(f"\n=== neck probe: {body_id} ===")
    if finish and finish in rig.FINISH_MASTERS:
        f = rig.FINISH_MASTERS[finish]
        print(f"  finish {finish}: T {f['major_d']}  E {f['neck_d']}  "
              f"bore {f['bore_d']}  finish_h {f['finish_h']}")
        print(f"  drawing finish datum would sit at z = "
              f"{rim - f['finish_h']:.2f} mm  (radius E/2 = "
              f"{f['neck_d'] / 2:.2f} mm)")
    if sh:
        print(f"  BB_REF_SHOULDER    z = {sh.matrix_world.translation.z * MM:.2f} mm")
    print(f"  BB_ATTACH_NECK     z = {rim:.2f} mm")

    print(f"\n  {'z (mm)':>9}  {'radius':>8}  {'diameter':>9}")
    z = rim
    while z > rim - 22.0:
        band = [p for p in pts if abs(p.z * MM - z) <= args.step / 2]
        if band:
            r = max(math.hypot(p.x, p.y) for p in band) * MM
            print(f"  {z:9.2f}  {r:8.2f}  {r * 2:9.2f}")
        z -= args.step
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
