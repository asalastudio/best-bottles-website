"""Verify built GLBs: mesh integrity + a Workbench render for eyeball proof.

The dimension gate in bottle_bodies.py only compares a BOUNDING BOX, which a
collapsed or self-intersecting mesh can still satisfy. This checks the mesh is
actually a closed solid and renders it so the shape can be seen.

  blender --background --python scripts/verify_glb.py -- --glb glb/X.glb --out renders/
"""
import argparse, math, os, sys
import bpy, bmesh

argv = sys.argv; argv = argv[argv.index("--")+1:] if "--" in argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glb", nargs="+", required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

for path in a.glb:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        print(f"{os.path.basename(path)}: NO MESH"); continue
    ob = meshes[0]
    empties = [o for o in bpy.data.objects if o.type == "EMPTY"]

    bm = bmesh.new(); bm.from_mesh(ob.data)
    # WELD BEFORE COUNTING. glTF stores a separate vertex per normal, so every
    # sharp edge round-trips as two coincident vertex pairs and the seam reads
    # as a hole. A threaded finish is nothing but sharp edges: the 17-415
    # master measures 0 non-manifold in Blender, 7138 straight after a GLB
    # round-trip, and 0 again after this weld. Counting without it condemns
    # watertight geometry and sends you hunting a boolean bug that isn't there.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)   # 1e-4 mm
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    volume_mm3 = bm.calc_volume(signed=True) * 1e9
    bm.free()

    dims_mm = tuple(round(d * 1000, 2) for d in ob.dimensions)
    mount = ", ".join(f"{e.name}@{e.matrix_world.translation.z*1000:.2f}mm" for e in empties) or "NONE"
    seat_mm = None
    print(f"\n{os.path.basename(path)}")
    print(f"   dims mm        {dims_mm}")
    print(f"   verts/faces    {len(ob.data.vertices)} / {len(ob.data.polygons)}")
    print(f"   non-manifold   {non_manifold}  {'CLOSED SOLID' if non_manifold==0 else 'NOT WATERTIGHT'}")
    print(f"   outer volume   {volume_mm3:.0f} mm3  ({volume_mm3/1000:.1f} ml of glass+cavity)")
    print(f"   datums         {mount}")

    # Workbench render: geometry only, no materials - matches this lane's scope.
    scn = bpy.context.scene
    scn.render.engine = "BLENDER_WORKBENCH"
    scn.render.resolution_x, scn.render.resolution_y = 520, 900
    scn.render.film_transparent = False
    sh = scn.display.shading
    sh.light = "STUDIO"; sh.color_type = "SINGLE"
    sh.single_color = (0.72, 0.76, 0.80)
    sh.show_cavity = True
    cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
    h = ob.dimensions.z
    cam_data.ortho_scale = h * 1.25
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam); scn.camera = cam
    cam.location = (h * 3, -h * 3, h * 0.55)
    d = cam.location - (ob.location + ob.matrix_world.to_quaternion() @ __import__("mathutils").Vector((0,0,h*0.5)))
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = d.to_track_quat("Z", "Y")
    scn.render.filepath = os.path.join(a.out, os.path.basename(path).replace(".glb", ".png"))
    bpy.ops.render.render(write_still=True)
    print(f"   render         {scn.render.filepath}")
