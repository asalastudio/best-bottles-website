#!/usr/bin/env python3
"""Cap-off still: CLEAR 9 ml / 70 mm / 17-415 + seated metal roller insert.

Matrix (23 Sep 2026): photos are often cap-off with the insert still seated.
SKU example GBCyl9MtlRollBlkDot = metal ball. No outer cap.
"""
from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("cyl9glass", HERE / "render_cyl9_clear_glass.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

REPO = mod.REPO
BODY = REPO / "public" / "models" / "bodies-thickness" / "Cyl-round-17-415-70x20.glb"
CLOS = REPO / "public" / "models" / "closures"
STACK = ("BB_ROLL_HOUSING_17415_STEEL", "BB_ROLL_BALL_17415_STEEL")
MM = 0.001


def principled(name, *, color, rough, metal, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    lin = mod.hex_to_linear(color)
    if "Base Color" in b.inputs:
        b.inputs["Base Color"].default_value = (*lin, 1)
    if "Roughness" in b.inputs:
        b.inputs["Roughness"].default_value = rough
    if "Metallic" in b.inputs:
        b.inputs["Metallic"].default_value = metal
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = 0.0
    return mat


def imp(path: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def main():
    out = HERE / "clear-glass"
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.view_settings.view_transform = "Filmic"

    body_objs = imp(BODY)
    body = next(o for o in body_objs if o.type == "MESH")
    neck = next((o for o in body_objs if "ATTACH_NECK" in o.name), None)
    rim = neck.matrix_world.translation.z if neck else body.dimensions.z
    print(f"body {body.name} h={body.dimensions.z*1000:.2f} rim={rim/MM:.2f} mm")

    body.data.materials.clear()
    body.data.materials.append(mod.clear_glass())

    housing_mat = principled("PART_HOUSING_PP", color="#e8e6dd", rough=0.40, metal=0.0)
    ball_mat = principled("PART_BALL_STEEL", color="#e0dfdd", rough=0.10, metal=1.0, coat=0.50)

    for name, mat in ((STACK[0], housing_mat), (STACK[1], ball_mat)):
        objs = imp(CLOS / f"{name}.glb")
        part = next(o for o in objs if o.type == "MESH")
        part.matrix_world.translation = (0.0, 0.0, rim)
        part.data.materials.clear()
        part.data.materials.append(mat)
        zs = [(part.matrix_world @ v.co).z for v in part.data.vertices]
        print(f"  seated {name} z {min(zs)/MM:.2f} .. {max(zs)/MM:.2f} mm")

    h_m = body.dimensions.z
    mod.cream_studio(scene, h_m)
    mod.frame_camera(scene, body, h_m)
    scene.cycles.samples = 96
    scene.cycles.device = "CPU"
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1480
    scene.render.film_transparent = False
    dest = out / "cyl9_clear_capoff_insert.png"
    scene.render.filepath = str(dest)
    bpy.ops.render.render(write_still=True)
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
