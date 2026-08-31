"""
export_web_body.py — phase-2 web exporter: master-scene glass -> BB_BTL_* GLB.

WHY
  bodies-threaded/Cyl-round-17-415-70x20.glb came from an early splice whose
  finish measured 16 mm with a ~2 mm rim land and a hard shoulder ledge. The
  governing drawing (GBCyl10mlAmber.pdf) says 0.9 + 8.8 + 2.0 = 14.06 finish
  with an R0.8/R0.3 sloped shoulder — and Jordan's photo of the real bottle
  (IMG_5048) shows exactly that. build-master-scene.py already builds the
  drawing-exact twin (CYL_SPECS["009"], cone shoulder, true swept helix,
  neck_h 13.76 per Jordan's 2026-08-11 shorter presentation); this script is
  the missing bridge from that MASTER to the web GLB contract.

CONTRACT OUT (same as every Lane A body GLB)
  geometry-only, metres, Y-up · mesh BB_BTL_<bodyId>
  BB_ATTACH_NECK empty at the rim · BB_REF_SHOULDER at the finish base
  NOTE: unlike the old solid lathe bodies, this shell is the REAL VESSEL WALL
  (hollow, wall 1.6 / base 3.5) — the thickness bake then encodes true glass
  thickness, which is what the reference photograph shows.

USAGE
  blender -b --factory-startup -P export_web_body.py -- \
      --spec 009 --body-id Cyl-round-17-415-70x20 --out <dir>
"""

import argparse
import importlib.util
import sys
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[3]
MASTER_DIR = REPO / "scripts" / "paper-doll-3d"


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--spec", default="009")
    p.add_argument("--body-id", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--blend-out", default=None,
                   help="where the intermediate master .blend is saved")
    return p.parse_args(argv)


def main():
    args = parse_args()
    sys.path.insert(0, str(MASTER_DIR))
    spec_file = MASTER_DIR / "build-master-scene.py"
    mod_spec = importlib.util.spec_from_file_location("bb_master", spec_file)
    master = importlib.util.module_from_spec(mod_spec)
    mod_spec.loader.exec_module(master)

    blend_out = Path(args.blend_out) if args.blend_out else (
        Path(bpy.app.tempdir or "/tmp") / f"web-body-{args.spec}.blend")
    master.build(out_path=blend_out, samples=16, bottle_key=args.spec)

    s = master.CYL_SPECS[args.spec]
    shell = bpy.data.objects.get("BB_RENDER_GLASS_ASSEMBLY")
    if shell is None:
        # the standard build keeps body and finish as separate closed source
        # components; weld them here exactly the way the render path does
        # (removes the two coincident datum annuli, welds matched rings)
        body = next(o for o in bpy.data.objects if o.get("web_name") == "body")
        finish = next(o for o in bpy.data.objects if o.get("web_name") == "finish")
        shell = master.welded_glass_render_assembly(
            body, finish, bpy.data.collections["WEB_EXPORT"])

    # strip the scene down to the shell alone
    keep = {shell.name}
    for o in list(bpy.data.objects):
        if o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)

    # scene units are 1 BU = 1 mm; the GLB contract is metres. Scale the
    # mesh data itself so nothing depends on exporter unit handling.
    me = shell.data
    for v in me.vertices:
        v.co *= 0.001
    shell.matrix_world.identity()
    bpy.context.scene.unit_settings.scale_length = 1.0
    me.materials.clear()
    me.update()
    me.calc_loop_triangles()

    name = f"BB_BTL_{args.body_id}"
    shell.name = name
    me.name = name

    def empty(nm, z_m):
        e = bpy.data.objects.new(nm, None)
        e.empty_display_size = 0.004
        e.location = (0.0, 0.0, z_m)
        bpy.context.scene.collection.objects.link(e)
        return e

    empty("BB_ATTACH_NECK", s["height"] * 0.001)              # rim datum
    empty("BB_REF_SHOULDER", (s["height"] - s["neck_h"]) * 0.001)
    if shell.name not in {o.name for o in bpy.context.scene.collection.objects}:
        bpy.context.scene.collection.objects.link(shell)

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    glb = out_dir / f"{args.body_id}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)

    zs = [v.co.z for v in me.vertices]
    rs = [(v.co.x ** 2 + v.co.y ** 2) ** 0.5 for v in me.vertices]
    print(f"[out] {glb}")
    print(f"[out] {len(me.vertices)} verts / {len(me.loop_triangles)} tris  "
          f"height {(max(zs)-min(zs))*1000:.2f} mm  max r {max(rs)*1000:.2f} mm  "
          f"finish {s['neck_h']} mm  spec {args.spec} ({s['source']})")


main()
