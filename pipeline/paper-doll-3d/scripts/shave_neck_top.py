"""
shave_neck_top.py — shorten a threaded body's TOP LAND without touching threads.

WHY
  Jordan (2026-08-31), against the real amber bottle (IMG_5048): keep the
  previous body's defined shoulder shelf, but the top of the neck is a little
  too tall. The excess sits in the cylindrical land between the last thread
  crest and the rim lip (~2 mm built vs the drawing's 0.9 top land).

HOW — and what it never touches
  The land is a pure cylinder (constant radius), so compressing it vertically
  is geometrically invisible. Verts above the land translate DOWN rigidly
  (the lip keeps its exact round-over); verts inside the land compress; the
  threads and everything below stay bit-identical. BB_ATTACH_NECK moves down
  with the rim — it is the cap-seating datum. Vert/tri counts asserted
  unchanged.

USAGE
  blender -b --factory-startup -P shave_neck_top.py -- \
      --glb <in.glb> --out <out.glb> --shave-mm 0.8 \
      [--land-lo-mm 68.6] [--land-hi-mm 69.6]
"""

import argparse
import sys
from pathlib import Path

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--shave-mm", type=float, required=True)
    p.add_argument("--land-lo-mm", type=float, default=68.6)
    p.add_argument("--land-hi-mm", type=float, default=69.6)
    return p.parse_args(argv)


def main():
    a = parse_args()
    lo, hi = a.land_lo_mm / 1000.0, a.land_hi_mm / 1000.0
    d = a.shave_mm / 1000.0
    span = hi - lo
    assert d < span, "shave exceeds the land height — would invert geometry"
    k = (span - d) / span

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    assert len(meshes) == 1, [m.name for m in meshes]
    me = meshes[0].data
    me.calc_loop_triangles()
    n_v, n_t = len(me.vertices), len(me.loop_triangles)

    moved = compressed = 0
    for v in me.vertices:               # importer is Z-up; exporter converts back
        z = v.co.z
        if z >= hi:
            v.co.z = z - d
            moved += 1
        elif z > lo:
            v.co.z = lo + (z - lo) * k
            compressed += 1
    for o in bpy.data.objects:
        if o.type == "EMPTY" and o.name == "BB_ATTACH_NECK":
            o.location.z -= d
            print(f"[dat] BB_ATTACH_NECK -> {o.location.z*1000:.2f} mm")

    me.update()
    me.calc_loop_triangles()
    assert (len(me.vertices), len(me.loop_triangles)) == (n_v, n_t)
    out = Path(a.out).resolve()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)
    zs = [v.co.z for v in me.vertices]
    print(f"[out] {out.name}  shaved {a.shave_mm} mm  rim now "
          f"{max(zs)*1000:.2f} mm  ({moved} translated, {compressed} "
          f"compressed)  counts unchanged {n_v}/{n_t}")


main()
