#!/usr/bin/env python3
"""Build and render the photo-calibrated cobalt V2 bracket without geometry edits."""

from __future__ import annotations

import argparse
import importlib.util
import math
from pathlib import Path
import sys

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def _load_builder():
    path = SCRIPT_DIR / "build-9ml-cobalt-correction.py"
    spec = importlib.util.spec_from_file_location("bb_cobalt_reference_v2_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = _load_builder()


def configure_render(width, height, samples):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE" if samples <= 32 else "CYCLES"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = contract.COBALT_REFERENCE_V2.exposure
    scene.view_settings.gamma = 1.0
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = samples
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.01 if samples < 256 else 0.005
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 12
        scene.cycles.transmission_bounces = 12
        scene.cycles.glossy_bounces = 8
        scene.cycles.diffuse_bounces = 4
        scene.cycles.transparent_max_bounces = 8


def render(
    out_dir,
    value,
    width,
    height,
    samples,
    save_scene=None,
    neck_fill_watts=None,
    hero_glossy=False,
    hero_glossy_level=None,
    bottle_yaw_degrees=None,
    glass_ior=None,
    glass_roughness=None,
):
    body = bpy.data.objects[contract.BODY_NAME]
    geometry_before = contract.geometry_fingerprint(body.data)
    builder.build_reference_v2_in_memory()
    if bottle_yaw_degrees is None:
        bottle_yaw_degrees = contract.COBALT_REFERENCE_V2.selected_packshot_yaw_degrees
    if bottle_yaw_degrees:
        body = bpy.data.objects[contract.BODY_NAME]
        body.rotation_euler.z += math.radians(bottle_yaw_degrees)
        body["bb_packshot_yaw_degrees"] = bottle_yaw_degrees
    if hero_glossy:
        hero = bpy.data.objects[contract.COBALT_REFERENCE_V2.hero_scrim_name]
        hero.visible_glossy = True
        hero["bb_calibrated_visible_glossy"] = True
        if hero_glossy_level is not None:
            material = hero.data.materials[0]
            principled = material.node_tree.nodes.get("Principled BSDF")
            rgba = (hero_glossy_level,) * 3 + (1.0,)
            principled.inputs["Base Color"].default_value = rgba
            principled.inputs["Emission Color"].default_value = rgba
            principled.inputs["Emission Strength"].default_value = 0.0
            hero["bb_calibrated_glossy_level"] = hero_glossy_level
    if neck_fill_watts is not None:
        neck_fill = bpy.data.objects["BB_REF_V2_NECK_SEPARATION_FILL"]
        neck_fill.data.energy = neck_fill_watts
        neck_fill["bb_calibrated_energy_watts"] = neck_fill_watts
    builder.assign_reference_v2_variant(value)
    material = body.data.materials[0]
    group = next(
        node for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeGroup"
    )
    if glass_ior is not None:
        group.inputs["IOR"].default_value = glass_ior
        material["bb_calibrated_ior"] = glass_ior
    if glass_roughness is not None:
        group.inputs["surface_roughness"].default_value = glass_roughness
        material["bb_calibrated_surface_roughness"] = glass_roughness
    if contract.geometry_fingerprint(body.data) != geometry_before:
        raise AssertionError("reference V2 render changed approved geometry")
    configure_render(width, height, samples)
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"COBALT_REFERENCE_V2_{value:03d}.png"
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    if save_scene is not None:
        save_scene = save_scene.expanduser().resolve()
        root = contract.REFERENCE_V2_WORKING_DIR.resolve()
        if save_scene != root and root not in save_scene.parents:
            raise ValueError(f"reference V2 scene must remain below {root}")
        if save_scene.exists():
            raise FileExistsError(f"refusing to overwrite {save_scene}")
        save_scene.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_scene), copy=True)
        print("BB_COBALT_REFERENCE_V2_SCENE", save_scene)
    print("BB_COBALT_REFERENCE_V2", output)


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument(
        "--variant",
        type=int,
        choices=(25, 50, 75, 100),
        default=contract.COBALT_REFERENCE_V2.selected_density_percentage,
    )
    parser.add_argument("--samples", type=int, default=96)
    parser.add_argument("--res", nargs=2, type=int, default=(720, 792))
    parser.add_argument("--save-scene", type=Path)
    parser.add_argument("--neck-fill-watts", type=float)
    parser.add_argument("--hero-glossy", action="store_true")
    parser.add_argument("--hero-glossy-level", type=float)
    parser.add_argument("--bottle-yaw-degrees", type=float)
    parser.add_argument("--glass-ior", type=float)
    parser.add_argument("--glass-roughness", type=float)
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1:])
    render(
        args.out_dir.resolve(),
        args.variant,
        *args.res,
        args.samples,
        save_scene=args.save_scene,
        neck_fill_watts=args.neck_fill_watts,
        hero_glossy=args.hero_glossy,
        hero_glossy_level=args.hero_glossy_level,
        bottle_yaw_degrees=args.bottle_yaw_degrees,
        glass_ior=args.glass_ior,
        glass_roughness=args.glass_roughness,
    )


if __name__ == "__main__":
    main()
