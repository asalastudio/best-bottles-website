#!/usr/bin/env python3
"""cap_pnkdot_master.py — the pink decorative roll-on cap, one master, two outputs.

    blender --background --python scripts/cap_pnkdot_master.py -- --glb OUT.glb
    blender --background --python scripts/cap_pnkdot_master.py -- --render OUT.png
    blender --background --python scripts/cap_pnkdot_master.py -- --compare OUT.png
    blender --background --python scripts/cap_pnkdot_master.py -- --save OUT.blend

THE PHOTOGRAPH IS THE AUTHORITY
  "4. CpRoll17-415PnkDot.psd", layer 'Layer 6', 291 x 417 px of opaque alpha.

SCALE IS DELIBERATELY NOT CLAIMED. Jordan: "17-415 tells us the closure/neck
interface, not this decorative shell's exterior dimensions... that's much
safer than contaminating your asset library with a guessed measurement."
So DIAMETER_MM is the single provisional input and everything else is a
RATIO measured off the photograph. A photograph gives proportion; it can
never give scale. When a physical cap or a manufacturer drawing arrives,
change DIAMETER_MM alone and every derived dimension follows.

WHAT THE PHOTOGRAPH ACTUALLY MEASURES (all scale-free)
  height / diameter          1.4330
  top transition / height    ~0.053   (see BEVEL below)
  crystal dia / cap dia      0.0966
  crystals                   8, in columns at -46.8 / -1.0 / +45.2 degrees
                             left 3, centre 2, right 3 -- the 3-2-3
  crystal heights (h/H)      L 0.1598 0.4645 0.7722
                             C        0.3187 0.6300
                             R 0.1625 0.4711 0.7819
  The centre pair sits BETWEEN the outer rows, as the reference shows.

BEVEL, AND A MEASUREMENT THAT LIED. An earlier pass traced this silhouette
from a flattened PNG using a luminance threshold and read a 1.94 mm DOME on
the crown. That was an artifact: the top of the cap is a blown-out specular
highlight, so it fell on the background side of the threshold and faked a
dome. The PSD's own alpha shows the truth -- the bottom rim reaches full
width in 4 px (a sharp moulded cut, so that 4 px is the camera being a
degree or so off square) against 26 px at the top. Jordan, looking at the
real cap: "flat/closed top... very small rounded transition... do not
exaggerate the bevel." BEVEL_RATIO is exposed so the comparison render
decides it, which is what --compare is for.

TWO OUTPUTS FROM ONE MASTER
  A. Cycles     layered pearl paint -- a metallic flake basecoat under a
                dielectric coat, which is what an automotive-style pearl
                physically IS.
  B. GLB        the same identity within glTF's metallic-roughness model:
                metalness 0 with a coat, because a PAINTED surface is a
                dielectric (three.js: 0 for plastic, 1 for metal, never
                between). The pearl reads through coat + colour, not
                through a fractional metalness that means nothing physical.
                No lighting is baked into base colour -- the configurator
                brings its own HDRI.
"""
import argparse, math, sys
from pathlib import Path

import bpy
from mathutils import Vector

# --------------------------------------------------------------- parameters

#: THE ONE PROVISIONAL NUMBER. Everything else is a measured ratio.
#: Replace when a physical cap or a manufacturer drawing exists -- and only
#: then. 19.0 is a placeholder chosen so the part is a sane size on screen.
DIAMETER_MM = 19.0
DIAMETER_IS_VERIFIED = False

RATIO = dict(
    height=1.4330,          # measured: 417 / 291 px of opaque alpha
    # FITTED 2026-08-31 against the PSD alpha, not chosen. 0.055 was my own
    # over-correction after Jordan said "do not exaggerate the bevel", and
    # it left the crown 5x too square: the reference is at 92% of radius
    # 3% down from the top where we were still at 100%. Sweeping the ratio
    # and rendering a true orthographic silhouette each time bottoms out at
    # 0.300 (rms 0.032 across h = 0.950-0.984, against 0.107 at 0.08).
    #
    # 30% of the radius is a LARGE "small bevel", so it was worth proving
    # the measurement rather than trusting it: the layer's alpha feathers
    # 2.82 px at the top against 2.88 px down the side walls. The mask is
    # uniformly tight, so the narrowing is the cap's own geometry and not a
    # soft edge over a blown highlight.
    bevel=0.300,            # of the RADIUS
    crystal_d=0.0966,       # of the cap diameter
    seat_depth=0.030,       # of the cap diameter -- a shallow seat, not a socket
    crystal_proud=0.0015,   # of the cap diameter; ~0 but nonzero to beat z-fighting
)

#: azimuth in degrees (0 faces the camera), then height as a fraction of the
#: cap's height. Straight off the photograph; see the header.
CRYSTALS = [
    ("CRYSTAL_L_01", -46.8, 0.1598),
    ("CRYSTAL_L_02", -46.8, 0.4645),
    ("CRYSTAL_L_03", -46.8, 0.7722),
    ("CRYSTAL_C_01",  -1.0, 0.3187),
    ("CRYSTAL_C_02",  -1.0, 0.6300),
    ("CRYSTAL_R_01",  45.2, 0.1625),
    ("CRYSTAL_R_02",  45.2, 0.4711),
    ("CRYSTAL_R_03",  45.2, 0.7819),
]

#: Softbox power, calibrated against the reference rather than guessed.
#: Lighting a 19 mm part from 70 mm is NOT room lighting: the first pass
#: used 6 W, which at that distance is a 12 kW lamp at a metre, and since
#: this Blender build ships no tone-mapping view transform (the enum offers
#: only NONE) every highlight clipped and the render came back pure white
#: at every pixel. --light-scale sweeps it; the default is the value whose
#: rendered mean matches the photograph's.
LIGHT_SCALE = 1.0

#: How much the white sweep is allowed to light the PART (camera rays always
#: see it at full white). Low, or the cylinder's edges never fall away.
AMBIENT = 0.010

WALL_SEGMENTS = 192          # smooth enough that the silhouette has no facets
MM = 0.001                   # spec millimetres -> Blender metres


def dims():
    d = DIAMETER_MM
    return dict(
        d=d, r=d / 2.0,
        h=d * RATIO["height"],
        bevel=(d / 2.0) * RATIO["bevel"],
        crystal_r=d * RATIO["crystal_d"] / 2.0,
        seat=d * RATIO["seat_depth"],
        proud=d * RATIO["crystal_proud"],
    )


# ------------------------------------------------------------------ geometry

def build_cap_body():
    """CAP_BODY: straight vertical wall, flat closed top, small top bevel.

    Lathed from an explicit outline rather than a cylinder + bevel modifier,
    because a modifier bevel rounds the BOTTOM rim too and the reference's
    bottom is a dead-square cut. The profile is (r, z) with z=0 at the base.
    No internal thread: nothing here is ever seen, and the brief is explicit
    that hidden geometry is not wanted for the web asset.
    """
    import bmesh
    D = dims()
    r, h, b = D["r"], D["h"], D["bevel"]

    prof = [(0.0, 0.0), (r, 0.0)]                       # square bottom, outward
    prof.append((r, h - b))                             # straight vertical wall
    for i in range(1, 9):                               # the small top bevel
        a = (math.pi / 2) * i / 8
        prof.append((r - b + b * math.cos(a), h - b + b * math.sin(a)))
    prof.append((0.0, h))                               # flat closed top

    me = bpy.data.meshes.new("CAP_BODY")
    bm = bmesh.new()
    rings = []
    for pr, pz in prof:
        if pr < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, pz * MM))])
            continue
        rings.append([bm.verts.new((pr * MM * math.cos(2 * math.pi * i / WALL_SEGMENTS),
                                    pr * MM * math.sin(2 * math.pi * i / WALL_SEGMENTS),
                                    pz * MM)) for i in range(WALL_SEGMENTS)])
    for a, bb in zip(rings, rings[1:]):
        if len(a) == 1:
            for i in range(WALL_SEGMENTS):
                bm.faces.new((a[0], bb[i], bb[(i + 1) % WALL_SEGMENTS]))
        elif len(bb) == 1:
            for i in range(WALL_SEGMENTS):
                bm.faces.new((a[i], a[(i + 1) % WALL_SEGMENTS], bb[0]))
        else:
            for i in range(WALL_SEGMENTS):
                j = (i + 1) % WALL_SEGMENTS
                bm.faces.new((a[i], a[j], bb[j], bb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()

    # Smooth the WALL, keep the bottom rim and the bevel's own break crisp.
    # Auto-smooth by angle does that in one setting and survives the export.
    me.shade_smooth()
    for poly in me.polygons:
        if abs(poly.normal.z) > 0.85:
            poly.use_smooth = False

    obj = bpy.data.objects.new("CAP_BODY", me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_crystal(name, az_deg, h_frac):
    """One flush-set crystal, seated ON the cylinder, not on a flat plane.

    Two pieces of geometry in one mesh, which is what produces the reference's
    dark centre with a bright rim:
      - a shallow SEAT, a short cone cut inward. Its inner wall faces away
        from the key, so it reads as the dark ring around every stone.
      - the STONE, a low faceted disc whose table sits flush with the wall.
        Flat-shaded facets each catch their own glint; at product distance
        they read as one brilliant point, which is the brief.
    Nothing meaningfully protrudes, so the cap's silhouette stays clean.
    """
    import bmesh
    D = dims()
    az = math.radians(az_deg)
    z = h_frac * D["h"]
    cr, seat, proud = D["crystal_r"], D["seat"], D["proud"]

    bm = bmesh.new()
    SEG = 16

    def ring(rad, depth):
        return [bm.verts.new((rad * math.cos(2 * math.pi * i / SEG),
                              rad * math.sin(2 * math.pi * i / SEG), depth))
                for i in range(SEG)]

    # seat: mouth at the wall, narrowing inward
    r_mouth, r_floor = cr * 1.30, cr * 0.95
    a, b, c = ring(r_mouth, 0.0), ring(r_floor, -seat), ring(r_floor * 0.88, -seat)
    for u, v in ((a, b), (b, c)):
        for i in range(SEG):
            j = (i + 1) % SEG
            bm.faces.new((u[i], u[j], v[j], v[i]))

    # stone: table flush with the wall, girdle down inside the seat
    tab = ring(cr * 0.68, proud)
    gir = ring(cr, -seat * 0.35)
    cul = bm.verts.new((0.0, 0.0, -seat * 0.85))
    bm.faces.new(tab)
    for i in range(SEG):
        j = (i + 1) % SEG
        bm.faces.new((tab[i], tab[j], gir[j], gir[i]))
        bm.faces.new((gir[j], gir[i], cul))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # vary each stone's clocking so eight identical glints do not repeat
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=__import__("mathutils").Matrix.Rotation(
                         math.radians((hash(name) % 360)), 3, "Z"))
    # local +Z -> outward radial, then round to this crystal's azimuth
    M = __import__("mathutils").Matrix
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=M.Rotation(math.pi / 2, 3, "Y"))
    # AZIMUTH IS MEASURED FROM THE CAMERA. The camera looks along +Y from
    # -Y, so azimuth 0 must face -Y -- not +X, which is where a bare
    # cos/sin placement puts it and where the first build wrongly sent all
    # eight crystals, round the side out of shot.
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=M.Rotation(az - math.pi / 2, 3, "Z"))
    bmesh.ops.translate(bm, verts=bm.verts,
                        vec=(D["r"] * math.sin(az), -D["r"] * math.cos(az), z))
    bmesh.ops.scale(bm, verts=bm.verts, vec=(MM, MM, MM))

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = False          # facets, so each catches its own glint
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ----------------------------------------------------------------- materials

def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return nt, bsdf


def _set(bsdf, name, value):
    """Principled input names moved between Blender versions; skip politely
    rather than dying on a machine with a different build."""
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value
        return True
    return False


def cap_material(for_web):
    """Pale blush pearl, satin, subtly metallic. Explicitly NOT flat plastic
    pink, NOT high-gloss, no glitter, no coarse flake.

    Cycles gets the physically honest build: a metallic flake basecoat under
    a dielectric coat, which is what a pearl paint actually is.

    glTF has no layered-paint model, so the web material carries the same
    IDENTITY inside metallic-roughness: metalness 0 (a painted surface is a
    dielectric -- three.js is explicit that this value is 0 or 1 and never
    between) with a coat for the wet sheen, and the pearl living in the
    colour and the coat rather than in a fractional metalness that would
    mean nothing physical.
    """
    mat = bpy.data.materials.new("CAP_PINK_PEARL")
    nt, b = _nodes(mat)
    _set(b, "Base Color", (0.847, 0.702, 0.757, 1.0))   # pale desaturated blush
    _set(b, "Roughness", 0.28)                          # satin, not mirror
    _set(b, "Metallic", 0.0 if for_web else 0.55)
    for coat, val in (("Coat Weight", 0.55), ("Coat", 0.55),
                      ("Clearcoat", 0.55)):
        if _set(b, coat, val):
            break
    for cr, val in (("Coat Roughness", 0.14), ("Clearcoat Roughness", 0.14)):
        if _set(b, cr, val):
            break
    _set(b, "Specular IOR Level", 0.5)
    _set(b, "IOR", 1.5)
    return mat


def crystal_material(for_web):
    """Tiny brilliant silver/crystal points -- dark centre, sharp white
    highlights. In Cycles a real dielectric with transmission; for the web,
    transmission on eight sub-millimetre parts costs a full render pass for
    detail nobody can resolve, so it becomes a very smooth high-specular
    dielectric that reads identically at product distance."""
    mat = bpy.data.materials.new("CRYSTAL")
    nt, b = _nodes(mat)
    _set(b, "Base Color", (0.92, 0.93, 0.95, 1.0))
    _set(b, "Roughness", 0.045)
    _set(b, "Metallic", 0.0)
    _set(b, "IOR", 2.0)
    if not for_web:
        for t in ("Transmission Weight", "Transmission"):
            if _set(b, t, 0.85):
                break
    else:
        _set(b, "Specular IOR Level", 1.0)
    return mat


# ------------------------------------------------------------------- scene

def studio(width, height, ortho_scale):
    """Controlled studio: a big soft key front-left, a softer fill front-right
    and a top strip. This is what puts the broad vertical highlight down the
    front and the darker falloff toward the cylinder's edges -- the brief is
    explicit that it comes from lighting and material, never painted in."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 256
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Filmic" if "Filmic" in [
        v.name for v in sc.view_settings.bl_rna.properties["view_transform"].enum_items
    ] else "Standard"

    # WHITE TO THE CAMERA, DARK TO THE SURFACE. A plain white world at any
    # useful strength is an all-directions dome light: it floods the
    # cylinder's edges and the render goes flat -- measured range 37 against
    # the photograph's 173. But the sweep still has to READ white behind the
    # part. Light Path splits the two jobs: camera rays see the white sweep,
    # every other ray sees near-darkness, so the key alone shapes the cap and
    # the edges are free to fall away exactly as the reference's do.
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out_w = nt.nodes.new("ShaderNodeOutputWorld")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    sweep = nt.nodes.new("ShaderNodeBackground")     # what the CAMERA sees
    sweep.inputs[0].default_value = (1, 1, 1, 1)
    sweep.inputs[1].default_value = 1.0
    amb = nt.nodes.new("ShaderNodeBackground")       # what the SURFACE sees
    amb.inputs[0].default_value = (1, 1, 1, 1)
    amb.inputs[1].default_value = AMBIENT
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(sweep.outputs[0], mix.inputs[2])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(mix.outputs[0], out_w.inputs[0])
    sc.world = world

    D = dims()
    mid = D["h"] / 2 * MM

    cam_d = bpy.data.cameras.new("CAM")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("CAM", cam_d)
    cam.location = (0.0, -0.4, mid)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)     # dead square on
    bpy.context.scene.collection.objects.link(cam)
    sc.camera = cam

    def area(name, loc_mm, aim_at, size_mm, energy):
        """Softbox sized and placed in MILLIMETRES, relative to the part.

        Two things a 19 mm subject punishes. Lights authored at room scale
        (a 220 mm panel) are enormous next to the cap, and any of them
        sitting between an ORTHOGRAPHIC camera and the subject fills the
        entire 20 mm frame with the inside of the softbox -- which is
        exactly why the first render came back pure white at every pixel,
        world strength included. So each light is a few cap-diameters
        across, and every one is hidden from camera rays: it lights the
        cap, it is never photographed.
        """
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size_mm[0] * MM, size_mm[1] * MM
        ld.energy = energy
        o = bpy.data.objects.new(name, ld)
        o.location = tuple(v * MM for v in loc_mm)
        bpy.context.scene.collection.objects.link(o)
        d = Vector(tuple(v * MM for v in aim_at)) - o.location
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        o.visible_camera = False
        return o

    mid_mm = D["h"] / 2
    # KEY front-left and high: this is what lays the broad soft highlight
    # down the front of the cylinder and lets the tone fall away toward
    # both silhouette edges, which is the reference's whole character.
    area("KEY",  (-52, -46, mid_mm + 26), (0, 0, mid_mm), (60, 80), 0.115 * LIGHT_SCALE)
    # a softer counter on the right so the far edge keeps a pale reflection
    # instead of going dead -- the reference has one there too
    area("FILL", (54, -34, mid_mm + 4), (0, 0, mid_mm), (50, 70), 0.013 * LIGHT_SCALE)
    # top strip: grazes the crown and gives the bevel its bright line
    area("TOP",  (0, -14, mid_mm + 70), (0, 0, mid_mm), (70, 70), 0.030 * LIGHT_SCALE)
    return cam


# -------------------------------------------------------------------- build

def build(for_web):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = build_cap_body()
    cmat = cap_material(for_web)
    body.data.materials.append(cmat)
    xmat = crystal_material(for_web)
    parts = [body]
    for name, az, hf in CRYSTALS:
        o = build_crystal(name, az, hf)
        o.data.materials.append(xmat)
        parts.append(o)
    return parts


def export_glb(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB",
        use_selection=True, export_apply=True,
        export_yup=True, export_normals=True,
        export_texcoords=True, export_materials="EXPORT",
    )


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb"); ap.add_argument("--render")
    ap.add_argument("--compare"); ap.add_argument("--save")
    ap.add_argument("--diameter", type=float)
    ap.add_argument("--bevel", type=float, help="override bevel/radius ratio")
    ap.add_argument("--light-scale", type=float)
    ap.add_argument("--ambient", type=float)
    ap.add_argument("--res", type=int, default=291)
    a = ap.parse_args(argv)

    global DIAMETER_MM
    if a.diameter:
        DIAMETER_MM = a.diameter
    if a.bevel:
        RATIO["bevel"] = a.bevel
    global LIGHT_SCALE, AMBIENT
    if a.light_scale:
        LIGHT_SCALE = a.light_scale
    if a.ambient is not None:
        AMBIENT = a.ambient

    D = dims()
    print(f"\ncap  O{D['d']:.2f} x {D['h']:.2f} mm"
          f"   {'(VERIFIED)' if DIAMETER_IS_VERIFIED else '(PROVISIONAL SCALE)'}")
    print(f"  aspect {RATIO['height']:.4f}   bevel {D['bevel']:.3f} mm"
          f"   crystal O{2*D['crystal_r']:.3f} mm   8 crystals, 3-2-3")

    if a.glb:
        build(for_web=True)
        Path(a.glb).parent.mkdir(parents=True, exist_ok=True)
        export_glb(a.glb)
        n = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH")
        print(f"  GLB  {a.glb}  ({Path(a.glb).stat().st_size/1024:.0f} KB, {n} verts)")

    if a.render or a.compare:
        build(for_web=False)
        h = int(a.res * RATIO["height"])
        # ortho_scale maps to the LARGER sensor dimension. The frame is
        # portrait (res x res*1.433), so it is the HEIGHT that must fit --
        # sizing this from the diameter cropped the cap to ~70%.
        studio(a.res, h, (D["h"] * 1.06) * MM)
        out = a.render or a.compare
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(out)
        bpy.ops.render.render(write_still=True)
        print(f"  render  {out}  ({a.res}x{h}, Cycles)")

    if a.save:
        Path(a.save).parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(a.save))
        print(f"  blend  {a.save}")
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
