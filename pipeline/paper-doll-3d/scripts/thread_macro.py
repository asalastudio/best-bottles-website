#!/usr/bin/env python3
"""Macro clay views of a bottle's FINISH, for the THREAD-STANDARD §5 gate.

Frames just the neck so the thread form can actually be judged: front
elevation (the "3 angled parallel lines" read), a three-quarter, and a cut
section showing crest/root profile. Clay only — §5: form is judged in clay,
never through glass.

    blender --background --python scripts/thread_macro.py -- \
        --glb glb-threaded/Cyl-round-17-415-70x20.glb --finish-h 13.76
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy


def clay():
    """Neutral matte + soft studio light. No glass, no colour."""
    mat = bpy.data.materials.new("CLAY")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.62, 0.60, 0.58, 1)
    bsdf.inputs["Roughness"].default_value = 0.62
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.30
    return mat


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", required=True)
    ap.add_argument("--finish-h", type=float, default=13.76, help="mm")
    ap.add_argument("--pad", type=float, default=5.0, help="mm above/below")
    ap.add_argument("--out", default="renders/thread-macro")
    ap.add_argument("--res", type=int, default=1400)
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.glb)
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")

    m = clay()
    mesh.data.materials.clear()
    mesh.data.materials.append(m)

    # Height is .z after import (the glTF importer restores Blender's Z-up).
    top = max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)
    fh, pad = args.finish_h / 1000.0, args.pad / 1000.0
    lo, hi = top - fh - pad, top + pad
    mid = (lo + hi) / 2.0
    span = (hi - lo)
    radius = max(math.hypot((mesh.matrix_world @ v.co).x,
                            (mesh.matrix_world @ v.co).y)
                 for v in mesh.data.vertices
                 if lo <= (mesh.matrix_world @ v.co).z <= hi)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.render.resolution_x = scene.render.resolution_y = args.res
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.6
    scene.world = world

    for name, ang, elev in (("front", 0.0, 0.0),
                            ("threequarter", 38.0, 12.0)):
        cam_data = bpy.data.cameras.new(name)
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = span * 1.05
        cam = bpy.data.objects.new(name, cam_data)
        scene.collection.objects.link(cam)
        a, e = math.radians(ang), math.radians(elev)
        d = 0.5
        cam.location = (d * math.sin(a) * math.cos(e),
                        -d * math.cos(a) * math.cos(e),
                        mid + d * math.sin(e))
        cam.rotation_euler = (math.pi / 2 - e, 0.0, a)
        scene.camera = cam

        key = bpy.data.objects.new("key", bpy.data.lights.new("k", "AREA"))
        key.data.energy, key.data.size = 40.0, 0.25
        key.location = (0.22, -0.28, mid + 0.20)
        key.rotation_euler = (math.radians(52), 0, math.radians(38))
        scene.collection.objects.link(key)
        fill = bpy.data.objects.new("fill", bpy.data.lights.new("f", "AREA"))
        fill.data.energy, fill.data.size = 12.0, 0.4
        fill.location = (-0.30, -0.18, mid + 0.05)
        fill.rotation_euler = (math.radians(80), 0, math.radians(-58))
        scene.collection.objects.link(fill)

        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(out / f"{Path(args.glb).stem}--{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"wrote {scene.render.filepath}")
        bpy.data.objects.remove(key, do_unlink=True)
        bpy.data.objects.remove(fill, do_unlink=True)

    print(f"framed z {lo*1000:.2f}..{hi*1000:.2f} mm, max r {radius*1000:.2f} mm")
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
