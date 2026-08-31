"""
build_spray_actuator.py — the Spry17-415 actuator, rebuilt from the PSD
reference (20. Closures/13. 17-415 Spray, measured 2026-08-31).

The shipped actuator was a fat plain cylinder ("horrendous" — Jordan).
Measured truth from Spry17-415Blk.psd at 14.9 px/mm (closure = 31 x Ø19):
  - two-tier WHITE actuator: head Ø13.1 (≈11 mm, domed shoulder, nozzle
    orifice near the top) over a Ø15.0 skirt (≈6.3 mm)
  - collar is the coloured part; the actuator is ALWAYS white PP
Seats on the existing collar (top +3.0 mm above rim datum, bore r 3.2):
skirt base inset to +1.0, stem drops into the bore. Origin = neck rim,
per the closures manifest contract.
"""
import math
from pathlib import Path
import bpy, bmesh

OUT = Path(__file__).resolve().parents[3] / "public/models/closures/BB_SPR_ACTUATOR_17415.glb"
MM = 0.001
SEG = 96

bpy.ops.wm.read_factory_settings(use_empty=True)

# profile (r_mm, y_mm): outer surface bottom->top, then close across the top
prof = [
    (3.0, -8.0),          # stem, drops into the collar bore
    (3.0,  0.5),
    (7.5,  0.9),          # skirt underside
    (7.5,  7.3),          # skirt wall (O15)
    (6.9,  7.7),          # step chamfer
    (6.55, 8.1),          # head wall starts (O13.1)
    (6.55, 16.6),
    (5.9, 17.9),          # domed shoulder
    (4.2, 18.45),
    (0.0, 18.5),          # top centre
]
verts, faces = [], []
n = len(prof)
for s in range(SEG):
    th = 2 * math.pi * s / SEG
    c, sn = math.cos(th), math.sin(th)
    # Blender is Z-up (same convention as closures.py); export_yup handles glTF
    for r, y in prof:
        verts.append((r * MM * c, r * MM * sn, y * MM))
for s in range(SEG):
    s2 = (s + 1) % SEG
    for i in range(n - 1):
        a, b = s * n + i, s * n + i + 1
        cc, dd = s2 * n + i, s2 * n + i + 1
        faces.append((a, b, dd, cc))
me = bpy.data.meshes.new("BB_SPR_ACTUATOR_17415")
me.from_pydata(verts, [], faces)
me.validate()
obj = bpy.data.objects.new("BB_SPR_ACTUATOR_17415", me)
bpy.context.scene.collection.objects.link(obj)

# close the stem bottom
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
bm.edges.ensure_lookup_table()
open_edges = [e for e in bm.edges if len(e.link_faces) == 1]
if open_edges:
    bmesh.ops.holes_fill(bm, edges=open_edges)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free()

# nozzle orifice: recess bored horizontally into the head front, near the
# top (Blender -Y = glTF +Z = toward the default camera)
noz = bpy.ops.mesh.primitive_cylinder_add(
    radius=1.15 * MM, depth=3.0 * MM,
    location=(0, -6.0 * MM, 15.2 * MM), rotation=(math.pi / 2, 0, 0))
noz_obj = bpy.context.active_object
mod = obj.modifiers.new("nozzle", "BOOLEAN")
mod.operation = "DIFFERENCE"; mod.object = noz_obj; mod.solver = "EXACT"
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="nozzle")
bpy.data.objects.remove(noz_obj, do_unlink=True)

obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_auto_smooth(angle=math.radians(38))
for m in list(obj.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB",
                          export_materials="NONE", export_yup=True,
                          use_selection=True)
me.calc_loop_triangles()
print(f"[out] {OUT.name}  {len(me.vertices)}v/{len(me.loop_triangles)}t  "
      f"head O13.1 skirt O15.0 dome top +18.5mm, nozzle recess")
