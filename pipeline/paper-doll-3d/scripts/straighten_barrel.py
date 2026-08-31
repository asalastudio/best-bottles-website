"""
straighten_barrel.py — enforce the drawing's straight wall on a cylinder body.

WHY
  Lathe profiles harvested from PSD silhouettes carry ~0.13 mm p-p pixel noise,
  which renders as horizontal bands under glass. For DRAWING-SPEC straight
  cylinders the barrel is a straight line by definition — so the fix is not
  more smoothing (which only shrinks noise), it is setting the barrel to the
  spec wall exactly. Truth = drawings.

WHAT IT TOUCHES — and what it never touches
  Only vertices in circular "barrel rings": rings whose radius sits within
  --band-mm of the body's maximum radius. Threads, finish, shoulder curve and
  heel radius all fall outside that band and are NEVER moved. Vert/tri counts
  are asserted unchanged. No weld, no cleanup, ever.

  Each barrel ring's radius is set to a least-squares straight wall r(z)
  (captures any real draft), feathered over --feather-mm at both ends so the
  transition into shoulder/heel stays tangent-smooth.

USAGE
  blender -b --factory-startup -P straighten_barrel.py -- \
      --glb public/models/bodies-threaded/Cyl-round-17-415-70x20.glb \
      --out /path/out.glb [--band-mm 0.4] [--feather-mm 2.0] [--dry-run]
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--band-mm", type=float, default=0.4,
                   help="rings within this of max radius count as barrel")
    p.add_argument("--feather-mm", type=float, default=2.0)
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args(argv)


def main() -> None:
    args = parse_args()
    band = args.band_mm / 1000.0
    feather = args.feather_mm / 1000.0

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.glb).resolve()))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise SystemExit(f"expected 1 mesh, got {[m.name for m in meshes]}")
    me = meshes[0].data
    me.calc_loop_triangles()
    in_verts, in_tris = len(me.vertices), len(me.loop_triangles)

    # ---- group verts into lathe rings by height. The GLB is Y-up but the
    # importer converts to Blender's Z-up, so height is co.z here; the
    # exporter (export_yup=True) converts back on the way out.
    rings = defaultdict(list)
    for v in me.vertices:
        rings[round(v.co.z, 6)].append(v.index)

    def radius(i):  # radial distance from the vertical (z) axis
        c = me.vertices[i].co
        return (c.x * c.x + c.y * c.y) ** 0.5

    ring_r = {y: sum(radius(i) for i in idx) / len(idx)
              for y, idx in rings.items()}
    r_max = max(ring_r.values())

    # ---- barrel = the single longest contiguous run of near-max rings.
    # Thread crests can also brush r_max; contiguity excludes them.
    ys = sorted(ring_r)
    runs, cur = [], []
    for y in ys:
        if r_max - ring_r[y] <= band:
            cur.append(y)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    barrel = max(runs, key=lambda r: r[-1] - r[0])
    y_lo, y_hi = barrel[0], barrel[-1]
    span = y_hi - y_lo

    # ---- spec wall: least-squares r(z) over the barrel (captures real draft)
    n = len(barrel)
    my = sum(barrel) / n
    mr = sum(ring_r[y] for y in barrel) / n
    den = sum((y - my) ** 2 for y in barrel)
    slope = (sum((y - my) * (ring_r[y] - mr) for y in barrel) / den
             if den > 1e-12 else 0.0)

    devs = [abs(ring_r[y] - (mr + slope * (y - my))) for y in barrel]
    print(f"[in ] {in_verts} verts / {in_tris} tris")
    print(f"[fit] barrel y {y_lo*1000:.2f}..{y_hi*1000:.2f} mm "
          f"({len(barrel)} rings)  r {mr*1000:.3f} mm  "
          f"draft {slope*1000:.4f} mm/mm")
    print(f"[fit] ripple vs spec wall: p-p {(max(devs)+max(devs))*0:.0f}"
          f"{(max(devs)) * 2000:.3f} mm, max dev {max(devs)*1000:.3f} mm")
    if args.dry_run:
        print("[dry] no changes written")
        return

    moved = 0
    for y in barrel:
        target = mr + slope * (y - my)
        edge = min(y - y_lo, y_hi - y)          # distance to barrel end
        w = min(edge / feather, 1.0) if feather > 0 else 1.0
        for i in rings[y]:
            c = me.vertices[i].co
            r = (c.x * c.x + c.y * c.y) ** 0.5
            if r < 1e-9:
                continue
            r_new = r + (target - r) * w
            s = r_new / r
            c.x *= s
            c.y *= s
            moved += 1
    me.update()
    me.calc_loop_triangles()
    out_verts, out_tris = len(me.vertices), len(me.loop_triangles)
    if (out_verts, out_tris) != (in_verts, in_tris):
        raise SystemExit("GEOMETRY COUNT CHANGED — aborting, nothing written")

    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)
    print(f"[out] {out.name}  {moved} verts projected onto the spec wall, "
          f"counts unchanged {out_verts}/{out_tris}")


main()
