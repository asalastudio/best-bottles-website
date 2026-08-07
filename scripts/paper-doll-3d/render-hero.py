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


def backdrop(coll, tone="bone", width=900.0, depth=700.0, rise=600.0,
             radius=180.0, steps=24):
    """
    Seamless sweep: floor running toward camera, curving up behind the subject.
    No horizon line, which is what makes a product shot read as studio rather
    than as an object sitting on a table.
    """
    prof: List[Tuple[float, float]] = [(-depth, 0.0)]
    cy, cz = radius, radius                       # arc centre
    for i in range(steps + 1):
        a = math.radians(-90.0 + 90.0 * i / steps)
        prof.append((cy + radius * math.sin(a), cz + radius * math.cos(a) - radius))
    prof.append((cy, rise))

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
    coll = stage_collection(scene)
    backdrop(coll, tone)
    mid = subject_h * 0.5

    # large overhead softbox — the dominant source, straight above and forward
    area_light(coll, "key_softbox", (0.0, -110.0, 330.0),
               (math.radians(28.0), 0.0, 0.0), 420, 420, 620_000 * exposure)
    # two vertical strip lights: long specular highlights down the glass edges
    area_light(coll, "strip_left", (-230.0, -130.0, mid + 30.0),
               (math.radians(90.0), 0.0, math.radians(-62.0)), 60, 320, 210_000 * exposure)
    area_light(coll, "strip_right", (230.0, -130.0, mid + 30.0),
               (math.radians(90.0), 0.0, math.radians(62.0)), 60, 320, 210_000 * exposure)
    # white bounce cards, low and wide, to lift the base out of black
    area_light(coll, "bounce_low", (0.0, -300.0, 20.0),
               (math.radians(96.0), 0.0, 0.0), 500, 160, 70_000 * exposure)
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
    aim_z = subject_h * 0.52                      # just above midpoint, per spec
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
    p.add_argument("--elevation", type=float, default=8.0)
    p.add_argument("--backdrop", default="bone", choices=sorted(BACKDROP_TONES),
                   help="stage backdrop tone; bone is the house standard")
    p.add_argument("--exposure", type=float, default=1.0,
                   help="scales every light; 1.0 is calibrated for dark amber glass")
    p.add_argument("--ambient", type=float, default=0.22,
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
    scene.cycles.blur_glossy = 0.5                # suppresses fireflies without killing caustics
    scene.cycles.transmission_bounces = 24
    scene.cycles.max_bounces = 32

    # CRITICAL: AgX would grey the backdrop and bleach the amber.
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
