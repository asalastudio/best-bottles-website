#!/usr/bin/env python3
"""Cycles still of Cylinder 9 ml CLEAR GLASS on the shipped catalog body.

Geometry: public/models/bodies/Cyl-round-17-415-70x20.glb (or a hollowed
copy of that same exterior). Not the wavy photo-cutout rebuild.

Materials: tune_glass.TUNE['BB_MAT_GLASS_CLEAR'] — Base Color white, colour
in Volume Absorption, Thin Wall OFF, IOR 1.52, roughness 0. Filmic, not AgX.

Lighting: cream cyclorama (Best Bottles photoreal bone #EFE9DE, matching
Jordan's studio cream plate) + soft dome world + ONE large dim key.
No small hard area lights (those become fake panels inside the glass).
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[4]
LANE = REPO / "pipeline" / "paper-doll-3d"
SHIPPED = REPO / "public" / "models" / "bodies" / "Cyl-round-17-415-70x20.glb"

# tune_glass.py TUNE for BB_MAT_GLASS_CLEAR
CLEAR_DENSITY = 6.0
CLEAR_ABSORB = (0.92, 0.97, 0.95)  # what SURVIVES; near-clear, slight cool
CLEAR_ROUGH = 0.0
IOR = 1.52

# HANDOVER photoreal bone; photo 2 language (cream/bone cyclorama)
CREAM = (0.937, 0.914, 0.871)  # #EFE9DE linear-ish via sRGB later
BONE_HEX = "#EFE9DE"


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", default=str(SHIPPED))
    p.add_argument("--out", required=True)
    p.add_argument("--mode", choices=["glass", "clay", "both"], default="both")
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--res-x", type=int, default=1200)
    p.add_argument("--res-y", type=int, default=1600)
    return p.parse_args(argv)


def clear_glass():
    mat = bpy.data.materials.new("BB_MAT_GLASS_CLEAR")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    out = nt.nodes["Material Output"]

    def s(k, v):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v

    s("Base Color", (1.0, 1.0, 1.0, 1.0))
    s("Metallic", 0.0)
    s("Roughness", CLEAR_ROUGH)
    s("IOR", IOR)
    s("Transmission Weight", 1.0)
    s("Transmission", 1.0)
    s("Alpha", 1.0)
    s("Thin Wall", False)
    s("Thin Surface", False)
    s("Coat Weight", 0.0)
    s("Specular IOR Level", 0.5)
    if "Thin Film Thickness" in bsdf.inputs:
        s("Thin Film Thickness", 0.0)

    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.location = (bsdf.location.x, bsdf.location.y - 340)
    vol.inputs["Color"].default_value = (*CLEAR_ABSORB, 1.0)
    vol.inputs["Density"].default_value = CLEAR_DENSITY
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return mat


def clay():
    mat = bpy.data.materials.new("BB_MAT_CLAY")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    if "Base Color" in bsdf.inputs:
        bsdf.inputs["Base Color"].default_value = (0.52, 0.50, 0.48, 1)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.58
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.30
    return mat


def cream_studio(scene, h_m: float):
    """Cream cyclorama + soft dome + one large dim key (photo 2 language)."""
    cream = (*hex_to_linear(BONE_HEX), 1.0)
    sweep_mat = bpy.data.materials.new("BB_MAT_STUDIO_BONE")
    sweep_mat.use_nodes = True
    sbsdf = sweep_mat.node_tree.nodes["Principled BSDF"]
    if "Base Color" in sbsdf.inputs:
        sbsdf.inputs["Base Color"].default_value = cream
    if "Roughness" in sbsdf.inputs:
        sbsdf.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in sbsdf.inputs:
        sbsdf.inputs["Specular IOR Level"].default_value = 0.12

    # Seamless L-sweep: floor + backdrop as one bent plane
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    sweep = bpy.context.active_object
    sweep.name = "BB_STUDIO_SWEEP"
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=24)
    bpy.ops.object.mode_set(mode="OBJECT")
    # scale to a large cyc around a 70 mm bottle
    sweep.scale = (0.55, 0.85, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    # bend the far half up into a backdrop
    for v in sweep.data.vertices:
        if v.co.y > 0.12:
            t = min(1.0, (v.co.y - 0.12) / 0.30)
            v.co.z = t * t * 0.42
            v.co.y = 0.12 + (v.co.y - 0.12) * (1.0 - 0.55 * t)
    sweep.location = (0.0, 0.08, 0.0)
    sweep.data.materials.append(sweep_mat)

    world = bpy.data.worlds.new("BB_WORLD")
    world.use_nodes = True
    wnt = world.node_tree
    for n in list(wnt.nodes):
        if n.type != "OUTPUT_WORLD":
            wnt.nodes.remove(n)
    wout = next(n for n in wnt.nodes if n.type == "OUTPUT_WORLD")
    bg = wnt.nodes.new("ShaderNodeBackground")
    ramp = wnt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (*hex_to_linear("#D9D0C4"), 1)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (1.0, 0.99, 0.97, 1)
    grad = wnt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "EASING"
    mapping = wnt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
    texco = wnt.nodes.new("ShaderNodeTexCoord")
    wnt.links.new(texco.outputs["Generated"], mapping.inputs["Vector"])
    wnt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    wnt.links.new(grad.outputs["Color"], ramp.inputs["Fac"])
    wnt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.15
    wnt.links.new(bg.outputs["Background"], wout.inputs["Surface"])
    scene.world = world

    # ONE tall, very large, dim key — photo 2's vertical softbox language
    # without a small bright source that images as a panel inside the glass.
    key = bpy.data.lights.new("BB_SOFT_KEY", "AREA")
    key.shape = "RECTANGLE"
    key.size = 0.42
    key.size_y = 1.25
    key.energy = 42.0
    key.color = (1.0, 0.99, 0.96)
    key_ob = bpy.data.objects.new("BB_SOFT_KEY", key)
    key_ob.location = (-0.36, -0.38, h_m * 0.58)
    key_ob.rotation_euler = (math.radians(76), 0, math.radians(-22))
    scene.collection.objects.link(key_ob)

    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.05
    scene.cycles.transmission_bounces = 24
    scene.cycles.volume_bounces = 4
    scene.cycles.max_bounces = 24
    scene.cycles.caustics_refractive = True
    scene.cycles.use_denoising = True


def frame_camera(scene, body, h_m: float):
    cam_d = bpy.data.cameras.new("BB_CAM")
    cam_d.type = "PERSP"
    cam_d.lens = 100
    cam_d.clip_start = 0.001
    cam = bpy.data.objects.new("BB_CAM", cam_d)
    # front-on product plate, slight elevation like photo 2
    cam.location = (0.012, -0.32, h_m * 0.46)
    cam.rotation_euler = (math.radians(88.2), 0.0, math.radians(2.2))
    scene.collection.objects.link(cam)
    scene.camera = cam
    # dolly so the 70 mm bottle fills ~62% of the frame height
    from mathutils import Vector

    target = Vector((0.0, 0.0, h_m * 0.50))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def import_body(path: Path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    for o in list(bpy.data.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o, do_unlink=True)
    return mesh


def render_mode(body, mode: str, out: Path, samples: int, res_x: int, res_y: int):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples if mode == "glass" else min(48, samples)
    scene.cycles.device = "CPU"
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"

    body.data.materials.clear()
    body.data.materials.append(clear_glass() if mode == "glass" else clay())

    dest = out / (f"cyl9_clear_glass.png" if mode == "glass" else "cyl9_clay.png")
    scene.render.filepath = str(dest)
    bpy.ops.render.render(write_still=True)
    print(f"[{mode}] {dest}")
    return dest


def main():
    a = parse_args()
    glb = Path(a.glb)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        scene.view_settings.view_transform = "Filmic"
    except TypeError:
        scene.view_settings.view_transform = "Standard"

    body = import_body(glb)
    h_m = body.dimensions.z
    w_m = max(body.dimensions.x, body.dimensions.y)
    print(f"body {glb.name}  {h_m*1000:.2f} x Ø{w_m*1000:.2f} mm  "
          f"verts={len(body.data.vertices)}")

    cream_studio(scene, h_m)
    frame_camera(scene, body, h_m)

    modes = ["glass", "clay"] if a.mode == "both" else [a.mode]
    written = []
    for mode in modes:
        written.append(render_mode(body, mode, out, a.samples, a.res_x, a.res_y))
    print("wrote", " ".join(str(p) for p in written))


if __name__ == "__main__":
    main()
