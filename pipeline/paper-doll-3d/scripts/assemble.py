#!/usr/bin/env python3
"""Assemble a body + a closure stack, exactly as the browser will.

Every part parent-and-zeros onto BB_ATTACH_NECK — that is the whole seating
rule, and this script does nothing cleverer, so if it looks right here it will
look right in r3f.

`--explode N` offsets each part along the stack axis by N mm times its index,
which is the same transform an exploded product view animates.

    blender --background --python scripts/assemble.py -- \
        --body glb-threaded/Cyl-round-17-415-70x20.glb \
        --parts glb-parts --assembly roller-steel --out renders/assembly
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy

MM = 0.001


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def clay(objs):
    m = bpy.data.materials.new("CLAY")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.62, 0.60, 0.58, 1)
    b.inputs["Roughness"].default_value = 0.62
    for o in objs:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(m)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--body", required=True)
    ap.add_argument("--parts", default="glb-parts")
    ap.add_argument("--assembly", required=True)
    ap.add_argument("--explode", type=float, default=0.0, help="mm per index")
    ap.add_argument("--out", default="renders/assembly")
    ap.add_argument("--res", type=int, default=1100)
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    body_objs = imp(args.body)
    body = next(o for o in body_objs if o.type == "MESH")
    neck = next((o for o in body_objs if o.name.startswith("BB_ATTACH_NECK")), None)
    if neck is None:
        raise SystemExit("body carries no BB_ATTACH_NECK")

    man = json.loads((Path(args.parts) / "manifest.json").read_text())
    stacks = {a["kind"]: a for a in man["assemblies"]}
    if args.assembly not in stacks:
        raise SystemExit(f"no assembly {args.assembly!r}; have {sorted(stacks)}")
    stack = stacks[args.assembly]["stack"]

    # Height is .z inside Blender: the glTF importer restores Z-up, so the
    # browser-side "height is .y" rule is exactly wrong in here.
    rim = neck.matrix_world.translation.z
    placed = []
    print(f"\n=== {args.assembly} on {Path(args.body).stem} ===")
    print(f"  rim datum      {rim / MM:7.2f} mm")
    for i, mesh in enumerate(stack):
        f = Path(args.parts) / f"{mesh}.glb"
        objs = imp(f)
        part = next(o for o in objs if o.type == "MESH")
        part.matrix_world.translation = (0.0, 0.0,
                                         rim + i * args.explode * MM)
        zs = [(part.matrix_world @ v.co).z for v in part.data.vertices]
        print(f"  [{i}] {mesh:32s} z {min(zs)/MM:7.2f} .. {max(zs)/MM:7.2f} mm")
        placed.append(part)

    allz = [(o.matrix_world @ v.co).z for o in [body] + placed
            for v in o.data.vertices]
    print(f"  assembled height {(max(allz) - min(allz)) / MM:.2f} mm")

    clay([body] + placed)

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 72
    sc.render.resolution_x = args.res
    sc.render.resolution_y = int(args.res * 1.5)
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.5
    sc.world = w

    lo, hi = min(allz), max(allz)
    mid = (lo + hi) / 2
    cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"
    cam_d.ortho_scale = (hi - lo) * 1.18
    cam = bpy.data.objects.new("cam", cam_d)
    sc.collection.objects.link(cam)
    cam.location = (0.16, -0.30, mid + 0.05)
    cam.rotation_euler = (math.radians(81), 0, math.radians(28))
    sc.camera = cam

    for loc, rot, e, s in (((0.22, -0.28, mid + 0.22), (52, 0, 38), 45.0, 0.25),
                           ((-0.30, -0.18, mid + 0.05), (80, 0, -58), 14.0, 0.4)):
        L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
        L.data.energy, L.data.size = e, s
        L.location = loc
        L.rotation_euler = tuple(math.radians(a) for a in rot)
        sc.collection.objects.link(L)

    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    tag = f"{Path(args.body).stem}--{args.assembly}"
    if args.explode:
        tag += f"--explode{args.explode:g}"
    sc.render.filepath = str(out / f"{tag}.png")
    bpy.ops.render.render(write_still=True)
    print(f"  wrote {sc.render.filepath}")
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
