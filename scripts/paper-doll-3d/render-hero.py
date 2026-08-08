#!/usr/bin/env python3
"""
Paper Doll 3D — studio stage and hero render.

Builds the _STAGE collection (seamless white backdrop, softbox key, two vertical
strip lights, bounce cards, product camera) around whatever the body builder
produced, then renders with Cycles.

_STAGE is a separate collection and is never exported — the GLB carries the
bottle only, per packaging-saas/public/models/MODELS.md.

Two settings matter more than anything else here and are easy to get wrong:

  view_transform = 'Standard'
      Blender 4.x+ defaults to AgX, which desaturates and rolls off highlights
      for a filmic look. On a product-on-white shot that turns the backdrop grey
      and bleaches amber glass to pink. Standard is correct for this work.

  Volume Absorption density (set in build-boston-round.py)
      Amber is volumetric, not a tint. If the render looks like tinted plastic,
      the absorption is too weak — not the lighting.

Usage:
  blender --background --python scripts/paper-doll-3d/render-hero.py -- \\
      --capacity 30 --glass amber --samples 2048 \\
      --output pipeline/paper-doll-3d/pilot/subject-boston-round/05_thumbnails/bsr-30ml-amber.png
"""
from __future__ import annotations

import argparse
import importlib.util
import math
import sys
from pathlib import Path
from typing import List, Tuple

try:
    import bpy
except ImportError:
    print("ERROR: run inside Blender.", file=sys.stderr)
    raise SystemExit(2)

HERE = Path(__file__).resolve().parent
STAGE = "_STAGE"

# The universal paper-doll stage tone. "Bone" is a warm off-white — it keeps the
# backdrop from competing with the product the way pure white does, and it gives
# amber glass something warm to sit against. Values are LINEAR (Blender's Base
# Color space), not sRGB.
BACKDROP_TONES = {
    "bone":  (0.792, 0.760, 0.686, 1.0),   # sRGB ~ #E6E1D7
    "white": (0.940, 0.940, 0.940, 1.0),
    "grey":  (0.420, 0.420, 0.420, 1.0),
}


def load_builder():
    path = HERE / "build-boston-round.py"
    spec = importlib.util.spec_from_file_location("bbr_build", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def stage_collection(scene) -> bpy.types.Collection:
    coll = bpy.data.collections.get(STAGE) or bpy.data.collections.new(STAGE)
    if coll.name not in {c.name for c in scene.collection.children}:
        scene.collection.children.link(coll)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    return coll


def backdrop(coll, tone="bone", width=1400.0, depth=900.0, rise=700.0,
             radius=260.0, steps=28):
    """
    Seamless sweep: floor running toward camera, curving up behind the subject.
    No horizon line, which is what makes a product shot read as studio rather
    than as an object sitting on a table.
    """
    # Flat floor runs from in front of the camera to BEHIND the subject, then
    # sweeps up. The earlier version began curving at y=0 — exactly where the
    # bottle stands — which put a visible crease right at its base.
    flat_back = 150.0
    prof: List[Tuple[float, float]] = [(-depth, 0.0), (flat_back, 0.0)]
    for i in range(1, steps + 1):
        t = math.radians(90.0 * i / steps)
        prof.append((flat_back + radius * math.sin(t), radius - radius * math.cos(t)))
    prof.append((flat_back + radius, rise))

    verts, faces = [], []
    for y, z in prof:
        verts.append((-width / 2.0, y, z))
        verts.append((width / 2.0, y, z))
    for i in range(len(prof) - 1):
        a = 2 * i
        faces.append([a, a + 1, a + 3, a + 2])

    mesh = bpy.data.meshes.new("stage_backdrop")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True

    mat = bpy.data.materials.get("bb_mat_backdrop") or bpy.data.materials.new("bb_mat_backdrop")
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = BACKDROP_TONES.get(tone, BACKDROP_TONES["bone"])
    bsdf.inputs["Roughness"].default_value = 0.62
    mesh.materials.append(mat)

    obj = bpy.data.objects.new("stage_backdrop", mesh)
    # floor sits 0.1 mm below z=0 so the bottle's flat contact ring never
    # shares a plane with it (z-fighting / shadow-terminator artifacts)
    obj.location = (0.0, 0.0, -0.1)
    coll.objects.link(obj)
    return obj


def area_light(coll, name, loc, rot, size_x, size_y, energy, color=(1.0, 1.0, 1.0)):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = size_x, size_y
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location, o.rotation_euler = loc, rot
    coll.objects.link(o)
    return o


def soft_softbox(coll, name, w, h, loc, rot, strength, tint=(1.0, 1.0, 1.0)):
    """Centred quad with hot-centre quadratic falloff — a diffusion panel,
    not a hard-edged emissive rectangle."""
    m = bpy.data.meshes.new(name)
    m.from_pydata([(-w/2, -h/2, 0), (w/2, -h/2, 0), (w/2, h/2, 0), (-w/2, h/2, 0)],
                  [], [[0, 1, 2, 3]])
    m.update()
    em = bpy.data.materials.new(name + "_mat")
    em.use_nodes = True
    ent = em.node_tree
    for n in list(ent.nodes):
        ent.nodes.remove(n)
    o1 = ent.nodes.new("ShaderNodeOutputMaterial")
    e1 = ent.nodes.new("ShaderNodeEmission")
    e1.inputs["Color"].default_value = (*tint, 1.0)
    tc = ent.nodes.new("ShaderNodeTexCoord")
    mp = ent.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (-1.0, -1.0, 0.0)
    mp.inputs["Scale"].default_value = (2.0, 2.0, 1.0)
    gr = ent.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = 'QUADRATIC_SPHERE'
    mth = ent.nodes.new("ShaderNodeMath")
    mth.operation = 'MULTIPLY'
    mth.inputs[1].default_value = strength
    ent.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    ent.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    ent.links.new(gr.outputs["Fac"], mth.inputs[0])
    ent.links.new(mth.outputs["Value"], e1.inputs["Strength"])
    ent.links.new(e1.outputs[0], o1.inputs["Surface"])
    m.materials.append(em)
    o = bpy.data.objects.new(name, m)
    o.location = loc
    o.rotation_euler = rot
    coll.objects.link(o)
    return o



def build_stage(scene, subject_h: float, exposure: float = 1.0, tone: str = "bone",
                trans_card: bool = False, sweep: float = 0.3,
                floor_glow: float = 0.75):
    """
    BRIGHT-FIELD glass stage.

    Amber glass gets its colour from TRANSMISSION, so the dominant source is
    behind the subject: two washes light the sweep itself, and the camera sees
    that bright field through the glass, tinted by the volume. Frontal light is
    minimal — a big frontal softbox mirrors across the whole front face of
    polished glass and buries the amber under a neutral white reflection (probe:
    the same glass reads (0.40,0.27,0.07) by transmission but rendered neutral
    grey under the old frontal rig). Narrow strips supply the two vertical edge
    highlights every product shot of a cylinder has; a small top light models
    the cap and shoulder and throws the contact shadow.
    """
    coll = stage_collection(scene)
    backdrop(coll, tone)
    mid = subject_h * 0.5

    # Sweep washes — helper fill on the backdrop. sweep=1.0 reproduces the
    # approved v5 look; sweep=0.0 is a true single-light setup (softbox alone,
    # backdrop lit purely by its bounce). A parameter, not an assumption: an
    # unasserted edit once claimed these lights were deleted while they kept
    # rendering.
    if sweep > 0.0:
        area_light(coll, "bg_wash_l", (-150.0, -60.0, 260.0),
                   (math.radians(52.0), 0.0, math.radians(-16.0)), 240, 420,
                   560_000 * exposure * sweep, color=(1.0, 0.93, 0.80))
        area_light(coll, "bg_wash_r", (150.0, -60.0, 260.0),
                   (math.radians(52.0), 0.0, math.radians(16.0)), 240, 420,
                   560_000 * exposure * sweep, color=(1.0, 0.93, 0.80))
    # Floor glow is decoupled from sweep: the LOW back-field is what the lower
    # body's refracted sightlines land on. Under-lighting it makes the cavity
    # tangent render as a crisp dark cone ("internal object" artifact); with it
    # lit, the lower darkening grades gradually from absorption alone.
    # Floor glow — decoupled from sweep. The LOW back-field is what the lower
    # body's refracted sightlines land on; under-lit, the cavity tangent
    # renders as a crisp dark cone (the "internal object" artifact). Lit, the
    # lower darkening grades gradually from absorption alone, matching the
    # real photo's white-surround bounce.
    area_light(coll, "floor_wash_glow", (0.0, -240.0, 35.0),
               (math.radians(74.0), 0.0, 0.0), 520, 160,
               420_000 * exposure * floor_glow, color=(1.0, 0.94, 0.82))

    # ONE huge near-frontal scrim (Aesop-style): a giant soft source close to
    # the camera axis, slightly above and camera-left, so the glass carries one
    # continuous soft sheen instead of a discrete patch — and the slight left
    # offset keeps the drop shadow trailing to 2 o'clock. With the backdrop
    # exposed as a midtone (sweep ~0.3) nothing bright sits behind the bottle,
    # so the refracted field stops reading as "two softboxes and a strip".
    soft_softbox(coll, "softbox_key", 620, 720,
                 (-120.0, -320.0, 310.0),
                 (math.radians(38.0), 0.0, math.radians(-18.0)),
                 26.0 * exposure)

    # SUBTRACTIVE FLAGS — the piece a physical glass shoot always has and a CG
    # stage usually forgets. Polished glass at grazing angles mirrors whatever
    # is beside it; with a bright wrapping stage the flanks mirror white and
    # the bottle washes out. Two near-black cards out of frame give the flanks
    # real darkness to reflect — this is where an amber bottle's deep edges
    # actually come from in product photography.
    # DARK SIDE WALLS, room-scale. Earlier versions used card-sized flags,
    # and their rectangular edges mirrored on the curved glass as straight
    # diagonal seams — the "fake" angled boundaries. A real studio's dark
    # sides are the room itself: no edge within reach of the reflection. These
    # walls are big enough that only their darkness is visible, never their
    # geometry. The remaining soft dark gradient at the flanks is genuine
    # physics (grazing paths through the cavity taper) and appears on the
    # real product photo too.
    for sx, nm in ((-1.0, "sidewall_left"), (1.0, "sidewall_right")):
        mesh = bpy.data.meshes.new(nm)
        x = sx * 430.0
        mesh.from_pydata([(x, -450.0, -0.1), (x, 250.0, -0.1),
                          (x, 250.0, 520.0), (x, -450.0, 520.0)],
                         [], [[0, 1, 2, 3]])
        mesh.update()
        fm = bpy.data.materials.get("bb_mat_sidewall") or bpy.data.materials.new("bb_mat_sidewall")
        fm.use_nodes = True
        fb = next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        fb.inputs["Base Color"].default_value = (0.07, 0.068, 0.065, 1.0)
        fb.inputs["Roughness"].default_value = 0.9
        mesh.materials.append(fm)
        o = bpy.data.objects.new(nm, mesh)
        o.visible_camera = False
        coll.objects.link(o)

    # TRANSMISSION CARD — hidden behind the subject; only transmission rays
    # see it. OFF BY DEFAULT: tested against the reference, dimming the centre
    # column also killed the warm punch (+33 -> +20 warmth) — the real photo's
    # centre is bright; its darkness lives in the flanks, which the flags
    # already supply. Kept for dark-mood shots via trans_card=True.
    if not trans_card:
        return coll
    mesh = bpy.data.meshes.new("transmission_card")
    mesh.from_pydata([(-13.0, 28.0, 2.0), (13.0, 28.0, 2.0),
                      (13.0, 28.0, 92.0), (-13.0, 28.0, 92.0)], [], [[0, 1, 2, 3]])
    mesh.update()
    cm = bpy.data.materials.get("bb_mat_transcard") or bpy.data.materials.new("bb_mat_transcard")
    cm.use_nodes = True
    cb = next(n for n in cm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    cb.inputs["Base Color"].default_value = (0.22, 0.215, 0.205, 1.0)   # warm grey
    cb.inputs["Roughness"].default_value = 0.9
    mesh.materials.append(cm)
    o = bpy.data.objects.new("transmission_card", mesh)
    o.visible_camera = False
    coll.objects.link(o)
    return coll


def build_stage_hero(scene, subject_h: float, exposure: float = 1.0):
    """
    Editorial hero stage — a DIFFERENT deliverable from the pack shot, kept as
    its own mode so the canonical e-comm scene never inherits dust or DOF.

    The "HDRI" is emissive geometry: a ceiling grid of light bars and a distant
    warm window card. Real geometry beats an image environment here because the
    reflections it draws on the glass are exactly placeable, and there is no
    external file to lose. The floor is procedural stone; a small hard spot
    drives MNEE shadow caustics under the bottle.
    """
    coll = stage_collection(scene)

    # stone floor
    mesh = bpy.data.meshes.new("hero_floor")
    E = 900.0
    mesh.from_pydata([(-E, -E, -0.1), (E, -E, -0.1), (E, E, -0.1), (-E, E, -0.1)],
                     [], [[0, 1, 2, 3]])
    mesh.update()
    fm = bpy.data.materials.get("bb_mat_stone") or bpy.data.materials.new("bb_mat_stone")
    fm.use_nodes = True
    fnt = fm.node_tree
    for n in [n for n in fnt.nodes if n.type in ("TEX_NOISE", "BUMP", "TEX_VORONOI")]:
        fnt.nodes.remove(n)
    fb = next(n for n in fnt.nodes if n.type == "BSDF_PRINCIPLED")
    fb.inputs["Base Color"].default_value = (0.10, 0.095, 0.09, 1.0)
    fb.inputs["Roughness"].default_value = 0.68
    fn1 = fnt.nodes.new("ShaderNodeTexNoise")
    fn1.inputs["Scale"].default_value = 0.06        # broad tonal patches
    fn1.inputs["Detail"].default_value = 6.0
    fvor = fnt.nodes.new("ShaderNodeTexVoronoi")
    fvor.inputs["Scale"].default_value = 0.8        # ~1.2 mm stone speckle
    fmix = fnt.nodes.new("ShaderNodeMath"); fmix.operation = 'MULTIPLY_ADD'
    fmix.inputs[1].default_value = 0.5
    fnt.links.new(fvor.outputs["Distance"], fmix.inputs[0])
    fnt.links.new(fn1.outputs["Fac"], fmix.inputs[2])
    fbmp = fnt.nodes.new("ShaderNodeBump")
    fbmp.inputs["Strength"].default_value = 0.55
    fbmp.inputs["Distance"].default_value = 0.07    # fine tactile stone grain
    fnt.links.new(fmix.outputs["Value"], fbmp.inputs["Height"])
    fnt.links.new(fbmp.outputs["Normal"], fb.inputs["Normal"])
    mesh.materials.append(fm)
    floor = bpy.data.objects.new("hero_floor", mesh)
    coll.objects.link(floor)

    def emissive_card(name, verts, strength, color=(1, 1, 1)):
        m = bpy.data.meshes.new(name)
        m.from_pydata(verts, [], [[0, 1, 2, 3]])
        m.update()
        em = bpy.data.materials.new(name + "_mat")
        em.use_nodes = True
        ent = em.node_tree
        for n in list(ent.nodes):
            ent.nodes.remove(n)
        o1 = ent.nodes.new("ShaderNodeOutputMaterial")
        e1 = ent.nodes.new("ShaderNodeEmission")
        e1.inputs["Color"].default_value = (*color, 1.0)
        e1.inputs["Strength"].default_value = strength
        ent.links.new(e1.outputs[0], o1.inputs["Surface"])
        m.materials.append(em)
        o = bpy.data.objects.new(name, m)
        coll.objects.link(o)
        return o

    # ONE big softbox (final art direction) — its soft-edged reflection is the
    # only bright shape the glass sees besides the dark surround.
    mid = subject_h * 0.55
    soft_softbox(coll, "softbox_key", 340, 440,
                 (-250.0, -190.0, mid + 220.0),
                 (math.radians(52.0), 0.0, math.radians(-52.0)),
                 24.0 * exposure)

    # hard spot for MNEE caustics under the glass
    sd = bpy.data.lights.new("caustic_spot", 'SPOT')
    sd.energy = 3_200_000 * exposure
    sd.spot_size = 0.5
    sd.shadow_soft_size = 2.0                        # small source -> defined caustics
    spot = bpy.data.objects.new("caustic_spot", sd)
    spot.location = (-160.0, -240.0, 430.0)
    spot.rotation_euler = (math.radians(29.0), 0.0, math.radians(-33.0))
    coll.objects.link(spot)
    for target, attr in ((sd, "use_shadow_caustics"), (getattr(sd, "cycles", None), "is_caustics_light")):
        if target is None:
            continue
        try:
            setattr(target, attr, True)
        except (AttributeError, TypeError):
            pass

    world = bpy.data.worlds.get("bb_hero_world") or bpy.data.worlds.new("bb_hero_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.02, 0.022, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scene.world = world
    return coll


def film_grain(path, amount=0.011, seed=7):
    """Luminance-correlated grain, strongest in mids — film, not sensor noise."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return False
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255.0
    rng = np.random.default_rng(seed)
    g = rng.normal(0.0, 1.0, im.shape[:2])[..., None]
    lum = im.mean(axis=2, keepdims=True)
    weight = 4.0 * lum * (1.0 - lum)               # peaks at mid-grey, like print film
    out = np.clip(im + g * amount * weight, 0.0, 1.0)
    Image.fromarray((out * 255).astype(np.uint8)).save(path)
    return True


def build_camera(scene, coll, subject_h: float, lens: float,
                 fill: float, elevation_deg: float):
    """
    Product camera. Distance is solved so the subject fills `fill` of the frame
    height at the given focal length, rather than dialled in by eye:
        H = subject_h / fill     frame height at the subject
        d = lens * H / sensor_h
    """
    cd = bpy.data.cameras.new("hero_cam")
    cd.lens = lens
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = 36.0                       # full-frame, portrait orientation
    frame_h = subject_h / fill
    dist = lens * frame_h / cd.sensor_height

    cam = bpy.data.objects.new("hero_cam", cd)
    coll.objects.link(cam)
    elev = math.radians(elevation_deg)
    aim_z = subject_h * 0.50                      # dead centre for a straight-on pack shot
    cam.location = (0.0, -dist * math.cos(elev), aim_z + dist * math.sin(elev))
    cam.rotation_euler = (math.radians(90.0) - elev, 0.0, 0.0)
    scene.camera = cam
    return cam, dist


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="render-hero.py")
    p.add_argument("--capacity", type=int, default=30)
    p.add_argument("--glass", default="amber")
    p.add_argument("--turns", type=float, default=None)
    p.add_argument("--samples", type=int, default=1024)
    p.add_argument("--res-x", type=int, default=900)
    p.add_argument("--res-y", type=int, default=1350)
    p.add_argument("--lens", type=float, default=100.0)
    p.add_argument("--fill", type=float, default=0.80,
                   help="fraction of frame height the bottle occupies")
    p.add_argument("--elevation", type=float, default=0.0,
                   help="camera elevation; 0 = straight-on e-commerce pack shot")
    p.add_argument("--floor-glow", dest="floor_glow", type=float, default=0.75,
                   help="low back-field luminance behind the bottle; prevents the "
                        "cavity tangent reading as a dark internal cone")
    p.add_argument("--clay", action="store_true",
                   help="diagnostic: flat diffuse grey on bottle and cap. Optical "
                        "images (reflections/refractions) cannot survive clay; "
                        "geometry must. Whatever vanishes was never a shape.")
    p.add_argument("--sweep", type=float, default=0.3,
                   help="backdrop wash level: 0.3 = midtone Aesop-style default, "
                        "1.0 = bright bone, 0.0 = softbox only")
    p.add_argument("--stage", default="packshot", choices=["packshot", "hero"],
                   help="packshot = canonical bone e-comm scene; hero = editorial stone/caustics/DOF")
    p.add_argument("--wear", type=float, default=None,
                   help="glass smudge/dust 0..1 (default: 0 packshot, 0.35 hero)")
    p.add_argument("--bubbles", type=int, default=None,
                   help="trapped seeds in the wall (default: 0 packshot, 8 hero)")
    p.add_argument("--view", default="standard", choices=["standard", "agx"],
                   help="colour transform; agx = AgX + Medium High Contrast")
    p.add_argument("--backdrop", default="bone", choices=sorted(BACKDROP_TONES),
                   help="stage backdrop tone; bone is the house standard")
    p.add_argument("--exposure", type=float, default=1.0,
                   help="scales every light; 1.0 is calibrated for dark amber glass")
    p.add_argument("--ambient", type=float, default=0.10,
                   help="world background strength (fill wrap)")
    p.add_argument("--show-liquid", action="store_true")
    p.add_argument("--with-cap", action="store_true",
                   help="seat a closure on the neck datum (proves the paper-doll contract)")
    p.add_argument("--cap-style", default="short")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args(argv)

    hero = args.stage == "hero"
    wear = args.wear if args.wear is not None else (0.35 if hero else 0.0)
    bubbles = args.bubbles if args.bubbles is not None else (8 if hero else 0)

    mod = load_builder()
    bargs = ["--glass", args.glass, "--capacity", str(args.capacity),
             "--wear", str(wear), "--bubbles", str(bubbles)]
    if args.turns is not None:
        bargs += ["--turns", str(args.turns)]
    spec = mod.resolve_spec(mod.parse_args(bargs))
    res = mod.build(spec, clear_scene=True)

    # labels off for a bare-glass hero; liquid optional
    for key in ("label_front", "label_back"):
        res[key].hide_render = True
    res["liquid"].hide_render = not args.show_liquid

    subject_h = float(spec["height"])
    if args.with_cap:
        # Seat the closure by PARENTING TO THE DATUM WITH A ZERO TRANSFORM.
        # No offsets are computed here — if the contract holds, this is all it
        # takes, and if it does not, the cap visibly floats or sinks.
        closure = importlib.util.spec_from_file_location(
            "bb_closure", HERE / "build-closure.py")
        cmod = importlib.util.module_from_spec(closure)
        closure.loader.exec_module(cmod)
        cap = cmod.build(str(spec["neck"]), args.cap_style, clear_scene=False)["obj"]
        cap.parent = res["datum"]
        cap.location = (0.0, 0.0, 0.0)
        bpy.context.view_layer.update()
        subject_h = max(v.co.z + cap.matrix_world.translation.z
                        for v in cap.data.vertices)
        print(f"cap seated: {cap.name} -> parent {res['datum'].name}, "
              f"zero transform; assembled height {subject_h:.2f} mm")

    if args.clay:
        clay = bpy.data.materials.new("bb_clay")
        clay.use_nodes = True
        cb = next(n for n in clay.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        cb.inputs["Base Color"].default_value = (0.48, 0.47, 0.45, 1.0)
        cb.inputs["Roughness"].default_value = 0.85
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.name.startswith("bb_"):
                o.data.materials.clear()
                o.data.materials.append(clay)
        print("CLAY diagnostic: bottle and cap overridden with diffuse grey")

    scene = bpy.context.scene
    if hero:
        build_stage_hero(scene, subject_h, args.exposure)
    else:
        build_stage(scene, subject_h, args.exposure, args.backdrop,
                    sweep=args.sweep, floor_glow=args.floor_glow)
    cam, dist = build_camera(scene, bpy.data.collections[STAGE], subject_h,
                             args.lens, args.fill, args.elevation if not hero else 6.0)
    if hero:
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = dist
        cam.data.dof.aperture_fstop = 2.8
        try:
            body = next(o for o in bpy.data.objects if o.name.endswith("_body_v001"))
            for ob, attr in ((body, "is_caustics_caster"), (bpy.data.objects["hero_floor"], "is_caustics_receiver")):
                try:
                    setattr(ob, attr, True)
                except AttributeError:
                    setattr(ob.cycles, attr, True)
        except (StopIteration, KeyError, AttributeError):
            pass

    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'GPU'
    except Exception:
        pass
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.caustics_reflective = True
    scene.cycles.caustics_refractive = True       # glass needs these
    scene.cycles.blur_glossy = 0.2                # suppresses fireflies without killing caustics
    scene.cycles.max_bounces = 16
    scene.cycles.transmission_bounces = 16
    scene.cycles.volume_bounces = 8
    scene.cycles.transparent_max_bounces = 16
    try:
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.denoising_prefilter = 'ACCURATE'
    except (AttributeError, TypeError):
        pass

    if args.view == "agx":
        scene.view_settings.view_transform = 'AgX'
        try:
            scene.view_settings.look = 'AgX - Medium High Contrast'
        except TypeError:
            scene.view_settings.look = 'None'
    else:
        # Standard is the verified default: AgX greyed the backdrop and
        # bleached the amber on this exact scene (see commit 317c418).
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
    scene.render.film_transparent = False

    if not hero:
        world = bpy.data.worlds.get("bb_stage_world") or bpy.data.worlds.new("bb_stage_world")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
        world.node_tree.nodes["Background"].inputs[1].default_value = args.ambient
        scene.world = world

    scene.render.resolution_x, scene.render.resolution_y = args.res_x, args.res_y
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    out = Path(args.output).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(out)

    print(f"glass {args.glass} · {args.samples} spp · lens {args.lens}mm · "
          f"camera {dist:.0f}mm · fill {args.fill:.0%} · exposure {args.exposure} · "
          f"ambient {args.ambient} · view transform Standard")
    bpy.ops.render.render(write_still=True)
    if hero and film_grain(str(out)):
        print("film grain applied")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    code = main()
    if bpy.app.background:
        sys.exit(code)
