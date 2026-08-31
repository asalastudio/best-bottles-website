"""
build_atomizer.py — vintage atomizer bulb + pump assembly (Jordan's brief,
2026-08-31). Runs inside a LIVE Blender (via MCP exec) or headless.

Base unit D = 21.3mm (18-415 collar OD, drawing-derived). All key dims are
custom properties on ATOMIZER_ROOT. Objects (separate, parented to root,
root origin at the collar's bottle-neck opening, Z-up, bulb toward -X):
ATOMIZER_Bulb / Hose / Connector / PumpStem / Plunger / Collar.
Materials: MAT_Atomizer_Fabric_Black (baked weave normal, packed),
MAT_Atomizer_Rubber_Black, MAT_Atomizer_Chrome. Collections:
ATOMIZER_HIGH (subsurf) and ATOMIZER_WEB (export-ready).
"""
import bpy, bmesh, math

MM = 0.001
D = 21.3 * MM

def clean():
    for cname in ("ATOMIZER_HIGH", "ATOMIZER_WEB"):
        c = bpy.data.collections.get(cname)
        if c:
            for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    for o in list(bpy.data.objects):
        if o.name.startswith("ATOMIZER_"):
            bpy.data.objects.remove(o, do_unlink=True)

def build():
    clean()
    high = bpy.data.collections.new("ATOMIZER_HIGH")
    web = bpy.data.collections.new("ATOMIZER_WEB")
    bpy.context.scene.collection.children.link(high)
    bpy.context.scene.collection.children.link(web)

    def into(o):
        for c in o.users_collection: c.objects.unlink(o)
        high.objects.link(o)

    root = bpy.data.objects.new("ATOMIZER_ROOT", None)
    root.empty_display_size = 0.01
    bpy.context.scene.collection.objects.link(root)
    into(root)

    P = dict(collar_od=1.0*D, collar_h=1.08*D, collar_wall=1.2*MM,
             collar_id=18.2*MM, bulb_len=2.65*D, bulb_dia=1.35*D,
             hose_od=0.18*D, pump_h=1.0*D, plunger_w=0.31*D,
             connector_len=0.45*D)
    for k, v in P.items(): root[k] = v

    def revolve(name, prof, seg=64):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        n = len(prof)
        for s in range(seg):
            th = 2*math.pi*s/seg
            c0, s0 = math.cos(th), math.sin(th)
            for r, z in prof:
                bm.verts.new((r*c0, r*s0, z))
        bm.verts.ensure_lookup_table()
        for s in range(seg):
            s2 = (s+1) % seg
            for i in range(n-1):
                bm.faces.new((bm.verts[s*n+i], bm.verts[s*n+i+1],
                              bm.verts[s2*n+i+1], bm.verts[s2*n+i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()
        into(o); o.parent = root
        return o

    # collar (hollow, rim + base bevels)
    revolve("ATOMIZER_Collar", [
        (P["collar_id"]/2, 0.0),
        (P["collar_id"]/2, P["collar_h"] - 2*MM),
        (P["collar_id"]/2 + 0.6*MM, P["collar_h"] - 0.8*MM),
        (P["collar_od"]/2 - 0.8*MM, P["collar_h"]),
        (P["collar_od"]/2, P["collar_h"] - 0.8*MM),
        (P["collar_od"]/2, 0.8*MM),
        (P["collar_od"]/2 - 0.8*MM, 0.0),
    ])

    # pump stem
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.4*MM,
                                        depth=P["pump_h"]*0.75)
    stem = bpy.context.active_object
    stem.name = "ATOMIZER_PumpStem"
    stem.location = (0, 0, P["collar_h"] + P["pump_h"]*0.75/2 - 1*MM)
    bpy.ops.object.shade_smooth(); into(stem); stem.parent = root

    # plunger capsule
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24,
                                         radius=P["plunger_w"]/2)
    pl = bpy.context.active_object
    pl.name = "ATOMIZER_Plunger"
    pl.scale = (1, 1, 1.9)
    pl.location = (0, 0, P["collar_h"] + P["pump_h"]*0.9)
    bpy.ops.object.shade_smooth(); into(pl); pl.parent = root

    # horizontal stepped connector
    cprof = [(2.6*MM,0.0),(2.6*MM,2.0*MM),(3.2*MM,2.4*MM),(3.2*MM,3.6*MM),
             (2.7*MM,4.0*MM),(2.7*MM,6.2*MM),(3.0*MM,6.6*MM),(3.0*MM,8.2*MM),
             (2.2*MM,8.8*MM),(2.2*MM,P["connector_len"])]
    conn = revolve("ATOMIZER_Connector", cprof, seg=32)
    conn.rotation_euler = (0, -1.5708, 0)
    conn.location = (-2.4*MM, 0, P["collar_h"] + P["pump_h"]*0.45)

    # bulb: asymmetric teardrop, quads, subsurf
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.5)
    bulb = bpy.context.active_object
    bulb.name = "ATOMIZER_Bulb"
    L, H = P["bulb_len"], P["bulb_dia"]
    for v in bulb.data.verticies if False else bulb.data.vertices:
        x = v.co.x
        t = x + 0.5
        profile = math.sin(min(1.0, (1.0 - t)) * math.pi * 0.5) ** 0.8
        neck = 0.16 + 0.84 * profile
        belly = 1.0 + 0.06 * math.exp(-((t - 0.35) ** 2) / 0.02)
        v.co.y *= H * neck * belly
        v.co.z *= H * neck * belly
        v.co.x = (t - 0.5) * L
    # densify the weave: tile UVs (baked repeat = glTF-proof)
    uv = bulb.data.uv_layers.active
    for lo in uv.data:
        lo.uv[0] *= 10.0
        lo.uv[1] *= 5.0
    sub = bulb.modifiers.new("subsurf", 'SUBSURF')
    sub.levels = 2; sub.render_levels = 2
    bpy.ops.object.shade_smooth()
    bulb.rotation_euler = (0, 0.10, 0)
    bulb.location = (-(P["connector_len"] + L*0.55 + 6*MM), 0,
                     P["collar_h"] + P["pump_h"]*0.45 + 2*MM)
    into(bulb); bulb.parent = root

    # hose
    cu = bpy.data.curves.new("ATOMIZER_Hose", 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(2)
    neck_x = bulb.location.x + (L*0.5 - 2*MM)*math.cos(0.10)
    neck_z = bulb.location.z - (L*0.5)*math.sin(0.10)
    conn_x = -2.4*MM - P["connector_len"]
    conn_z = P["collar_h"] + P["pump_h"]*0.45
    mid = ((neck_x+conn_x)/2, 0, min(neck_z, conn_z) - 2.2*MM)
    for bp, co in zip(sp.bezier_points,
                      [(neck_x, 0, neck_z), mid, (conn_x + 1.5*MM, 0, conn_z)]):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = P["hose_od"]/2
    cu.bevel_resolution = 8
    cu.use_fill_caps = True
    hose = bpy.data.objects.new("ATOMIZER_Hose", cu)
    bpy.context.scene.collection.objects.link(hose)
    bpy.ops.object.select_all(action="DESELECT")
    hose.select_set(True); bpy.context.view_layer.objects.active = hose
    bpy.ops.object.shade_smooth()
    into(hose); hose.parent = root
    return root


def materials():
    import numpy as np
    if "T_atomizer_weave_normal" not in bpy.data.images:
        N = 512
        yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
        u, v = xx/N*64*math.pi, yy/N*64*math.pi
        h = 0.5*np.sin(u+v) + 0.5*np.sin(u-v) + 0.15*np.sin(3.1*(u+v)+1.7)
        gx, gy = np.gradient(h)
        nx, ny, nz = -gx*2.2, -gy*2.2, np.ones_like(h)
        ln = np.sqrt(nx*nx+ny*ny+nz*nz)
        nrm = np.stack([(nx/ln+1)/2, (ny/ln+1)/2, (nz/ln+1)/2,
                        np.ones_like(h)], axis=-1)
        img = bpy.data.images.new("T_atomizer_weave_normal", width=N, height=N)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels = nrm.astype(np.float32).ravel().tolist()
        img.pack()
    img = bpy.data.images["T_atomizer_weave_normal"]

    def make(name, base, rough, metal, nimg=None, nstr=1.0):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
        b.inputs["Base Color"].default_value = (*base, 1.0)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if nimg is not None:
            tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = nimg
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = nstr
            nt.links.new(tx.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
        return m

    fabric = make("MAT_Atomizer_Fabric_Black", (0.045, 0.045, 0.048), 0.72, 0.0, img, 0.85)
    rubber = make("MAT_Atomizer_Rubber_Black", (0.03, 0.03, 0.032), 0.6, 0.0)
    chrome = make("MAT_Atomizer_Chrome", (0.85, 0.86, 0.87), 0.12, 1.0)
    assign = {"ATOMIZER_Bulb": fabric, "ATOMIZER_Hose": rubber,
              "ATOMIZER_Connector": chrome, "ATOMIZER_PumpStem": chrome,
              "ATOMIZER_Plunger": chrome, "ATOMIZER_Collar": chrome}
    for name, mat in assign.items():
        o = bpy.data.objects[name]
        if o.data and hasattr(o.data, "materials"):
            o.data.materials.clear()
            o.data.materials.append(mat)


def lights_and_camera():
    for name in ("VAL_KEY", "VAL_FILL_R", "VAL_FILL_F"):
        o = bpy.data.objects.get(name)
        if o: bpy.data.objects.remove(o, do_unlink=True)
    def area(name, loc, rot, size, energy):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.size = size; ld.energy = energy
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc; lo.rotation_euler = rot
        bpy.context.scene.collection.objects.link(lo)
    area("VAL_KEY", (-0.25, 0.18, 0.35), (math.radians(-35), math.radians(-25), 0), 0.5, 60)
    area("VAL_FILL_R", (0.3, -0.05, 0.1), (math.radians(75), math.radians(65), 0), 0.4, 25)
    area("VAL_FILL_F", (0.0, -0.35, 0.08), (math.radians(85), 0, 0), 0.5, 15)
    cam = bpy.data.objects.get("BB_CAM")
    if cam is None:
        cd = bpy.data.cameras.new("BB_CAM")
        cam = bpy.data.objects.new("BB_CAM", cd)
        bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (-0.045, -0.30, 0.045)
    cam.rotation_euler = (1.5708, 0, 0)
    w = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.55, 0.54, 0.52, 1.0)
        bg.inputs[1].default_value = 0.5


if __name__ == "__main__" or True:
    build()
    materials()
    lights_and_camera()
    print("ATOMIZER assembly rebuilt:", [o.name for o in bpy.data.objects if o.name.startswith("ATOMIZER")])
