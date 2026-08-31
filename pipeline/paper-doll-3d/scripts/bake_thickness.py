"""
bake_thickness.py — Lane A (geometry) product: per-texel thickness for browser glass.

WHY
  three.js MeshPhysicalMaterial.thickness is a scalar, so the whole bottle
  absorbs uniformly and reads flat. Pacdora's three.js glass avoids that with a
  baked `thicknessMap` (verified in their bundle 2026-08-30): thick heel goes
  dark, thin neck stays light. That map is geometry-derived data — so it is
  produced HERE, in Blender, and consumed in the browser. No materials, no
  lighting, no look decisions live in this script.

WHAT IT EMITS, per body
  public/models/bodies-thickness/<bodyId>.glb            geometry + UVs, no materials
  public/models/bodies-thickness/<bodyId>.thickness.png  grayscale; three.js reads GREEN
  public/models/bodies-thickness/<bodyId>.thickness.json { maxThicknessM, ... }

  Browser contract: material.thicknessMap = PNG (flipY=false, linear),
  material.thickness = maxThicknessM. three.js multiplies the two.

HARD RULES
  - Geometry is IMMUTABLE: same vert/tri counts in as out, no weld, no cleanup.
    (The drawing-exact helix threads died to a remove_doubles once. Never again.)
  - The ~7,800 "non-manifold" edges are glTF split-normal seams — healthy state.
  - Thickness on these SOLID bodies is the interior chord along -normal. That is
    also what Cycles integrates, and it matches how real bottles are built:
    thick heel, thinner neck.

USAGE
  /opt/homebrew/bin/blender -b --factory-startup -P bake_thickness.py -- \
      --glb public/models/bodies-threaded/Cyl-round-17-415-70x20.glb \
      --out public/models/bodies-thickness [--res 1024] [--clamp-pct 98]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree

EPS = 1e-6  # metres — push-off so the inward ray does not hit its own face


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=1024)
    p.add_argument("--clamp-pct", type=float, default=98.0,
                   help="percentile of vertex thickness used as the encoding "
                        "ceiling; the base looking straight down the axis can "
                        "see the full body height, which would crush the rest "
                        "of the range into black")
    return p.parse_args(argv)


def main() -> None:
    args = parse_args()
    glb_path = Path(args.glb).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    body_id = glb_path.stem

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    empties = [o for o in bpy.data.objects if o.type == "EMPTY"]
    if len(meshes) != 1:
        raise SystemExit(f"expected exactly 1 mesh, found "
                         f"{[m.name for m in meshes]} — refusing to guess")
    obj = meshes[0]
    me = obj.data
    in_verts, in_tris = len(me.vertices), len(me.loop_triangles) or None
    me.calc_loop_triangles()
    in_tris = len(me.loop_triangles)
    print(f"[in ] {obj.name}: {in_verts} verts / {in_tris} tris, "
          f"empties: {[e.name for e in empties]}")

    # ---- UVs: non-overlapping islands (bake-safe). UVs are attributes, not
    # geometry — vert/tri counts are asserted unchanged below.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")

    # ---- per-vertex thickness: inward raycast to the far wall
    depsgraph = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(obj, depsgraph)
    thick = [0.0] * in_verts
    misses = 0
    for v in me.vertices:
        n = v.normal
        origin = v.co - n * EPS
        loc, _hn, _idx, dist = bvh.ray_cast(origin, -n)
        if loc is None:
            misses += 1
        else:
            thick[v.index] = dist + EPS
    hits = sorted(t for t in thick if t > 0.0)
    if not hits:
        raise SystemExit("every ray missed — mesh is not closed?")
    median = hits[len(hits) // 2]
    if misses:
        thick = [t if t > 0.0 else median for t in thick]
    clamp = hits[min(len(hits) - 1, int(len(hits) * args.clamp_pct / 100.0))]
    print(f"[ray] misses {misses}/{in_verts}  median {median*1000:.2f}mm  "
          f"p{args.clamp_pct:.0f} clamp {clamp*1000:.2f}mm  "
          f"max {hits[-1]*1000:.2f}mm")

    attr = me.color_attributes.new(name="bb_thickness", type="FLOAT_COLOR",
                                   domain="POINT")
    for i, t in enumerate(thick):
        g = min(t / clamp, 1.0)
        attr.data[i].color = (g, g, g, 1.0)

    # ---- bake attribute -> texture via a throwaway emission material
    img = bpy.data.images.new(f"{body_id}_thickness", width=args.res,
                              height=args.res, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    mat = bpy.data.materials.new("bb_bake_thickness")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    n_attr = nodes.new("ShaderNodeAttribute")
    n_attr.attribute_name = "bb_thickness"
    n_emit = nodes.new("ShaderNodeEmission")
    n_out = nodes.new("ShaderNodeOutputMaterial")
    n_img = nodes.new("ShaderNodeTexImage")
    n_img.image = img
    links.new(n_attr.outputs["Color"], n_emit.inputs["Color"])
    links.new(n_emit.outputs["Emission"], n_out.inputs["Surface"])
    n_img.select = True
    nodes.active = n_img
    me.materials.clear()
    me.materials.append(mat)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="EMIT", margin=8)

    png_path = out_dir / f"{body_id}.thickness.png"
    img.filepath_raw = str(png_path)
    img.file_format = "PNG"
    img.save()

    # ---- export: strip the bake material and the color attribute; ship
    # geometry + UVs only, exactly like every other Lane A GLB
    me.materials.clear()
    me.color_attributes.remove(me.color_attributes["bb_thickness"])
    me.calc_loop_triangles()
    out_verts, out_tris = len(me.vertices), len(me.loop_triangles)
    if (out_verts, out_tris) != (in_verts, in_tris):
        raise SystemExit(f"GEOMETRY CHANGED: {in_verts}/{in_tris} -> "
                         f"{out_verts}/{out_tris} — aborting, nothing written")
    glb_out = out_dir / f"{body_id}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(glb_out), export_format="GLB",
                              export_materials="NONE", export_yup=True,
                              use_selection=True)

    sidecar = {
        "bodyId": body_id,
        "maxThicknessM": round(clamp, 6),
        "clampPercentile": args.clamp_pct,
        "medianThicknessM": round(median, 6),
        "resolution": args.res,
        "channel": "green",
        "source": str(glb_path.name),
        "note": "browser: material.thickness = maxThicknessM, "
                "material.thicknessMap = PNG (flipY=false, NoColorSpace)",
    }
    (out_dir / f"{body_id}.thickness.json").write_text(
        json.dumps(sidecar, indent=2) + "\n")
    print(f"[out] {glb_out.name}  {png_path.name}  "
          f"maxThickness {clamp*1000:.2f}mm  verts/tris unchanged "
          f"{out_verts}/{out_tris}")


main()
