"""
fillet_shelf.py — round the shoulder-shelf creases per the drawing's radii.

The GBCyl10mlAmber.pdf 5:1 detail calls out R0.5/R0.3 where the shelf meets
the body and the neck. The splice body carries those creases SHARP, and on
clear glass against grey they read as a hard horizontal line (amber hid it
as a soft shelf ring). Bevel the crease edge loops in the shelf band only;
threads and everything else untouched. Gate: silhouette may move only within
the bevel width (0.5 mm) and ONLY inside the shelf band.

USAGE
  blender -b --factory-startup -P fillet_shelf.py -- \
      --glb <in.glb> --out <out.glb> --band-lo-mm 53.5 --band-hi-mm 56.5 \
      [--width-mm 0.4] [--segments 3]
"""
import argparse, math, sys
from pathlib import Path
import bpy, bmesh


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--band-lo-mm", type=float, required=True)
    p.add_argument("--band-hi-mm", type=float, required=True)
    p.add_argument("--width-mm", type=float, default=0.4)
    p.add_argument("--angle-deg", type=float, default=30.0)
    p.add_argument("--segments", type=int, default=3)
    return p.parse_args(argv)


def main():
    a = parse_args()
    lo, hi, w = a.band_lo_mm/1e3, a.band_hi_mm/1e3, a.width_mm/1e3

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    me = body.data

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    # crease edges: inside the band, EXTERIOR (radius above the bore zone),
    # and sharper than angle-deg between faces
    thresh = math.radians(a.angle_deg)
    target = []
    for e in bm.edges:
        z0, z1 = e.verts[0].co.z, e.verts[1].co.z
        if not (lo <= z0 <= hi and lo <= z1 <= hi):
            continue
        r = sum((v.co.x**2 + v.co.y**2) ** 0.5 for v in e.verts) / 2
        if r < 0.006:              # bore/cavity interior - leave alone
            continue
        if len(e.link_faces) == 2:
            ang = e.calc_face_angle(None)
            if ang is not None and ang > thresh:
                target.append(e)
    print(f"[sel] {len(target)} crease edges in band "
          f"{a.band_lo_mm}-{a.band_hi_mm} mm (> {a.angle_deg} deg)")
    if not target:
        raise SystemExit("no creases found - band wrong?")
    bmesh.ops.bevel(bm, geom=target, offset=w, segments=a.segments,
                    profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(me)
    bm.free()
    me.update()
    me.calc_loop_triangles()

    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(38.0))
    for m in list(body.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

    out = Path(a.out).resolve()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)
    print(f"[out] {out.name}  {len(me.vertices)} verts / "
          f"{len(me.loop_triangles)} tris  bevel {a.width_mm} mm x "
          f"{a.segments} on the shelf creases")


main()
