"""
fix_inverted_normals.py — recalc a closure GLB's normals to face OUTSIDE.

BB_ROLL_BALL_17415_* shipped with 100% inverted normals (top-of-dome normal
(0,-1,0), mean dot(normal, outward) = -1.000). Every material rendered the
ball as a dark "transparent dome" because shading lit the INSIDE of the
sphere - a full session of steel-material fixes could not work. Asset bug,
not material bug. Geometry counts asserted unchanged.
"""
import argparse, math, sys
from pathlib import Path
import bpy, bmesh

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--glb", required=True)
a = p.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(a.glb).resolve()))
fixed = []
for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
    me = obj.data
    me.calc_loop_triangles()
    n_v, n_t = len(me.vertices), len(me.loop_triangles)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # outward for closed meshes
    bm.to_mesh(me); bm.free()
    me.update(); me.calc_loop_triangles()
    assert (len(me.vertices), len(me.loop_triangles)) == (n_v, n_t)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_auto_smooth(angle=math.radians(38.0))
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    fixed.append(f"{obj.name} ({n_v}v/{n_t}t)")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),
                          export_format="GLB", export_materials="NONE",
                          export_yup=True, use_selection=True)
print("[out] normals recalculated outward:", ", ".join(fixed))
