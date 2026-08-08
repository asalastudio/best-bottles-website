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


def area_light(coll, name, loc, rot, size_x, size_y, energy):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = size_x, size_y
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.location, o.rotation_euler = loc, rot
    coll.objects.link(o)
    return o


def build_stage(scene, subject_h: float, exposure: float = 1.0, tone: str = "bone"):
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

    # background washes — the actual key. Aimed at the sweep BEHIND the bottle,
    # offset left/right so neither throws the bottle's own shadow into frame.
    area_light(coll, "bg_wash_l", (-150.0, -60.0, 260.0),
               (math.radians(52.0), 0.0, math.radians(-16.0)), 240, 420, 640_000 * exposure)
    area_light(coll, "bg_wash_r", (150.0, -60.0, 260.0),
               (math.radians(52.0), 0.0, math.radians(16.0)), 240, 420, 640_000 * exposure)
    # narrow vertical strips: the two long speculars down the glass edges
    area_light(coll, "strip_left", (-220.0, 40.0, mid + 20.0),
               (math.radians(90.0), 0.0, math.radians(-64.0)), 55, 300, 300_000 * exposure)
    area_light(coll, "strip_right", (220.0, 40.0, mid + 20.0),
               (math.radians(90.0), 0.0, math.radians(64.0)), 55, 300, 300_000 * exposure)
    # floor wash: skims the sweep base behind the subject so a straight-on
    # camera still sees lit backdrop through the LOWER body, not dark floor
    area_light(coll, "floor_wash", (0.0, -240.0, 30.0),
               (math.radians(78.0), 0.0, 0.0), 420, 120, 260_000 * exposure)
    # key: 45 degrees off-camera, soft — models the cap face and throws the
    # contact shadow without washing the glass frontally
    area_light(coll, "key_45", (-200.0, -200.0, 300.0),
               (math.radians(48.0), 0.0, math.radians(-45.0)), 140, 140, 520_000 * exposure)
    return coll


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

    mod = load_builder()
    bargs = ["--glass", args.glass, "--capacity", str(args.capacity)]
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

    scene = bpy.context.scene
    build_stage(scene, subject_h, args.exposure, args.backdrop)
    cam, dist = build_camera(scene, bpy.data.collections[STAGE], subject_h,
                             args.lens, args.fill, args.elevation)

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
    scene.cycles.transparent_max_bounces = 12
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
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    code = main()
    if bpy.app.background:
        sys.exit(code)
