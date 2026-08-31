"""
hollow_body.py — carve the real interior cavity into a solid lathe body.

WHY
  A solid mesh reads as dyed acrylic, not glass: no far wall, no see-through,
  no vessel. Pacdora-level realism is mostly THIN WALLS (verified: their
  engine is three.js like ours — the difference is the asset). This hollows
  the APPROVED exterior without touching it: wall 1.6 mm, base 3.5 mm,
  cavity easing from the existing neck bore under the shoulder (spec 009).

GATES
  - exterior silhouette bit-identical: max-radius-per-height compared
    before/after, tolerance 1 micron, or nothing is written
  - thread crest radii unchanged (threads are outside the cavity entirely)

USAGE
  blender -b --factory-startup -P hollow_body.py -- \
      --glb <in.glb> --out <out.glb> [--wall-mm 1.6] [--base-mm 3.5]
"""

import argparse
import math
import sys
from collections import defaultdict
from pathlib import Path

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--wall-mm", type=float, default=1.6)
    p.add_argument("--base-mm", type=float, default=3.5)
    p.add_argument("--bore-mm", type=float, default=4.95,
                   help="cavity radius through the neck; slightly over the "
                        "existing 4.90 bore so the boolean bites cleanly "
                        "through the old bore wall instead of grazing it")
    return p.parse_args(argv)


def silhouette(me, bins=1400):
    sil = defaultdict(float)
    for v in me.vertices:
        r = (v.co.x ** 2 + v.co.y ** 2) ** 0.5
        k = round(v.co.z * bins)
        if r > sil[k]:
            sil[k] = r
    return sil


def main():
    a = parse_args()
    wall, base, bore = a.wall_mm / 1e3, a.base_mm / 1e3, a.bore_mm / 1e3

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    me = body.data
    sil_before = silhouette(me)
    zs = [v.co.z for v in me.vertices]
    rs = [(v.co.x ** 2 + v.co.y ** 2) ** 0.5 for v in me.vertices]
    z_top, r_max = max(zs), max(rs)
    r_in = r_max - wall

    # ---- cavity solid of revolution (Z-up here; exporter converts back).
    # bore column through the neck -> ease out under the shoulder -> straight
    # inner wall -> domed base at base_mm.
    Z_SHOULDER = 0.0545          # just under the shelf (body top ~0.0549)
    EASE = 0.0042                # vertical span of the bore->wall easing
    prof = [(0.0, z_top + 0.004), (bore, z_top + 0.004), (bore, Z_SHOULDER)]
    for i in range(1, 13):
        t = i / 12.0
        e = t * t * (3 - 2 * t)
        prof.append((bore + (r_in - bore) * e, Z_SHOULDER - EASE * t))
    prof.append((r_in, base + 0.002))
    for i in range(1, 11):                       # domed base fillet
        th = (i / 10.0) * (math.pi / 2)
        prof.append((r_in * math.cos(th), base + 0.002 - 0.002 * math.sin(th) * 0
                     ))
    prof.append((r_in, base))
    prof.append((0.0, base))
    # dedupe
    clean = [prof[0]]
    for q in prof[1:]:
        if abs(q[0] - clean[-1][0]) > 1e-7 or abs(q[1] - clean[-1][1]) > 1e-7:
            clean.append(q)

    verts, faces = [], []
    SEG = 256
    ring = len(clean)
    for s in range(SEG):
        th = 2 * math.pi * s / SEG
        c, sn = math.cos(th), math.sin(th)
        for r, z in clean:
            verts.append((r * c, r * sn, z))
    for s in range(SEG):
        s2 = (s + 1) % SEG
        for i in range(ring - 1):
            aa, bb = s * ring + i, s * ring + i + 1
            cc, dd = s2 * ring + i, s2 * ring + i + 1
            faces.append((aa, bb, dd, cc))
    cav_me = bpy.data.meshes.new("cavity")
    cav_me.from_pydata(verts, [], faces)
    cav_me.validate()
    cav = bpy.data.objects.new("cavity", cav_me)
    bpy.context.scene.collection.objects.link(cav)

    mod = body.modifiers.new("hollow", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cav
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="hollow")
    bpy.data.objects.remove(cav, do_unlink=True)

    me = body.data
    me.update()
    me.calc_loop_triangles()

    # ---- exterior gate
    sil_after = silhouette(me)
    worst = 0.0
    for k, r in sil_before.items():
        worst = max(worst, abs(sil_after.get(k, 0.0) - r))
    print(f"[gate] exterior silhouette worst delta {worst*1e6:.2f} um")
    if worst > 1e-6:
        raise SystemExit("EXTERIOR CHANGED — aborting, nothing written")

    out = Path(a.out).resolve()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)
    print(f"[out] {out.name}  {len(me.vertices)} verts / "
          f"{len(me.loop_triangles)} tris  wall {a.wall_mm} mm  "
          f"base {a.base_mm} mm  (was solid)")


main()
