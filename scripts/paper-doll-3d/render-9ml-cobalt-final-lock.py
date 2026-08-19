#!/usr/bin/env python3
"""Render the non-overwriting cobalt final-lock candidate."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import sys

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def _load_builder():
    path = SCRIPT_DIR / "build-9ml-cobalt-correction.py"
    spec = importlib.util.spec_from_file_location("bb_cobalt_final_lock_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = _load_builder()


def _safe_path(path, root, label, replace=False):
    path = contract.assert_derivative_path(path, root, label)
    if path.exists() and not replace:
        raise FileExistsError(f"refusing to overwrite {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def configure_render(width, height, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = False
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.01 if samples < 256 else 0.005
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 12
    scene.cycles.transmission_bounces = 12
    scene.cycles.glossy_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.transparent_max_bounces = 8
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = contract.COBALT_FINAL_LOCK.exposure
    scene.view_settings.gamma = 1.0


def render(
    output,
    save_scene,
    width,
    height,
    samples,
    replace=False,
    base_halo_control=False,
    grounded_contact_v2=False,
    gloss_refraction_variant=None,
    gloss_refraction_scrim=False,
    neutral_surface_tint=False,
):
    body = bpy.data.objects[contract.BODY_NAME]
    body_hash = contract.geometry_fingerprint(body.data)
    finish_hash = contract.geometry_fingerprint(
        bpy.data.objects[contract.FINISH_MASTER_NAME].data
    )
    camera = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
    selected_modes = sum(
        bool(value)
        for value in (
            base_halo_control,
            grounded_contact_v2,
            gloss_refraction_variant,
            gloss_refraction_scrim,
            neutral_surface_tint,
        )
    )
    if selected_modes > 1:
        raise ValueError("final-lock experimental modes are mutually exclusive")
    if neutral_surface_tint:
        builder.build_neutral_surface_tint_candidate_in_memory()
    elif gloss_refraction_scrim:
        builder.build_gloss_refraction_scrim_calibration_in_memory()
    elif gloss_refraction_variant:
        builder.build_gloss_refraction_candidate_in_memory(gloss_refraction_variant)
    elif grounded_contact_v2:
        builder.build_grounded_contact_v2_candidate_in_memory()
    elif base_halo_control:
        builder.build_base_halo_control_candidate_in_memory()
    else:
        builder.build_final_lock_candidate_in_memory()
    if contract.geometry_fingerprint(body.data) != body_hash:
        raise AssertionError("render changed approved bottle geometry")
    if (
        contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data)
        != finish_hash
    ):
        raise AssertionError("render changed approved finish geometry")
    if contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]) != camera:
        raise AssertionError("render changed approved camera")

    configure_render(width, height, samples)
    gloss_mode = bool(gloss_refraction_variant or gloss_refraction_scrim)
    if neutral_surface_tint:
        render_root = contract.NEUTRAL_SURFACE_TINT_RENDER_DIR
        working_root = contract.NEUTRAL_SURFACE_TINT_WORKING_DIR
        mode_label = "neutral surface tint"
    elif gloss_mode:
        render_root = contract.GLOSS_REFRACTION_RENDER_DIR
        working_root = contract.GLOSS_REFRACTION_WORKING_DIR
        mode_label = "gloss-refraction"
    else:
        render_root = contract.FINAL_LOCK_RENDER_DIR
        working_root = contract.FINAL_LOCK_WORKING_DIR
        mode_label = "final-lock"
    output = _safe_path(
        output,
        render_root,
        f"{mode_label} render",
        replace,
    )
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print("BB_COBALT_FINAL_LOCK_RENDER", output)

    if save_scene is not None:
        save_scene = _safe_path(
            save_scene,
            working_root,
            f"{mode_label} scene",
            replace,
        )
        bpy.ops.wm.save_as_mainfile(filepath=str(save_scene), copy=True)
        print("BB_COBALT_FINAL_LOCK_SCENE", save_scene)


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--save-scene", type=Path)
    parser.add_argument("--samples", type=int, default=256)
    parser.add_argument("--res", nargs=2, type=int, default=(900, 990))
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--base-halo-control", action="store_true")
    parser.add_argument("--grounded-contact-v2", action="store_true")
    parser.add_argument(
        "--gloss-refraction-variant",
        choices=tuple(contract.GLOSS_REFRACTION_PRESETS),
    )
    parser.add_argument("--gloss-refraction-scrim", action="store_true")
    parser.add_argument("--neutral-surface-tint", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1:])
    render(
        args.output,
        args.save_scene,
        *args.res,
        args.samples,
        args.replace,
        args.base_halo_control,
        args.grounded_contact_v2,
        args.gloss_refraction_variant,
        args.gloss_refraction_scrim,
        args.neutral_surface_tint,
    )


if __name__ == "__main__":
    main()
