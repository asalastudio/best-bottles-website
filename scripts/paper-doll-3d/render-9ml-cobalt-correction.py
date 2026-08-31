#!/usr/bin/env python3
"""Render clear calibration and cobalt absorption brackets for correction v1."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def _load_builder():
    path = SCRIPT_DIR / "build-9ml-cobalt-correction.py"
    spec = importlib.util.spec_from_file_location("bb_cobalt_correction_render_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = _load_builder()


def normalize_variant(value):
    return "clear" if value == "clear" else int(value)


def expected_material(value):
    return "BB_CORR_CLEAR" if value == "clear" else f"BB_CORR_COBALT_{value}"


def validate_scene(value):
    body = bpy.data.objects.get(contract.BODY_NAME)
    if body is None:
        raise RuntimeError("approved 9 ml body is missing")
    if contract.geometry_fingerprint(body.data) != contract.BODY_GEOMETRY_SHA256:
        raise RuntimeError("approved geometry changed before correction render")
    if body.get("bb_thread_source_fingerprint") != contract.THREAD_SHA256:
        raise RuntimeError("approved thread changed before correction render")
    material = body.data.materials[0] if body.data.materials else None
    if material is None or material.name != expected_material(value):
        raise RuntimeError(
            f"expected correction material {expected_material(value)}, found {getattr(material, 'name', None)}"
        )
    if any(obj.get("bb_negative_fill") and not obj.hide_render for obj in bpy.data.objects):
        raise RuntimeError("negative fill is active in the cobalt correction scene")
    if any(
        (obj.name.startswith("BB_FLAG_") or obj.name.startswith("BB_CARD_"))
        and not obj.hide_render
        for obj in bpy.data.objects
    ):
        raise RuntimeError("an inherited reflection flag/card is active in the cobalt correction scene")
    if bpy.data.objects.get("BB_CORR_REAR_RIM") is not None:
        raise RuntimeError("rear rim is not permitted in the cobalt correction scene")
    builder.shared.configure_camera()
    return body


def output_name(value, denoised):
    normal = contract.correction_filename(value)
    if denoised:
        return normal
    path = Path(normal)
    return f"{path.stem}_RAW{path.suffix}"


def configure_render(width, height, samples, denoised):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 15
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.005
    scene.cycles.use_denoising = denoised
    scene.cycles.max_bounces = 12
    scene.cycles.transmission_bounces = 12
    scene.cycles.glossy_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.transparent_max_bounces = 8
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = contract.COBALT_CORRECTION.exposure
    scene.view_settings.gamma = 1.0


def render_full(out_dir, value, width, height, samples, denoised):
    validate_scene(value)
    configure_render(width, height, samples, denoised)
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / output_name(value, denoised)
    bpy.context.scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    if not output.exists():
        raise RuntimeError(f"Cycles did not write {output}")
    return output


def magick():
    path = shutil.which("magick")
    if path is None:
        raise RuntimeError("ImageMagick is required")
    return path


def export_crop(full_path, out_dir, value, region, width, height, denoised):
    left, top, right, bottom = contract.crop_boxes(width, height)[region]
    suffix = "" if denoised else "RAW"
    output = out_dir / contract.correction_crop_filename(value, region, suffix)
    subprocess.run(
        [
            magick(), str(full_path),
            "-crop", f"{right-left}x{bottom-top}+{left}+{top}",
            "+repage", "-filter", "Mitchell", "-resize", "200%", str(output),
        ],
        check=True,
    )
    return output


def compose_bracket(out_dir):
    values = ("clear", 25, 50, 75, 100)
    labels = ("CLEAR", "COBALT 25%", "COBALT 50%", "COBALT 75%", "COBALT 100%")
    inputs = [out_dir / contract.correction_filename(value) for value in values]
    missing = [path for path in inputs if not path.exists()]
    if missing:
        raise FileNotFoundError(f"missing bracket inputs: {missing}")
    output = out_dir / "06_COBALT_DENSITY_COMPARISON.png"
    command = [magick()]
    for path, label in zip(inputs, labels):
        command.extend(
            [
                "(", str(path), "-resize", "420x462", "-gravity", "south",
                "-background", "#F3EFE8", "-splice", "0x46", "-fill", "#272522",
                "-font", str(contract.COMPARISON_FONT), "-pointsize", "19",
                "-annotate", "+0+11", label, ")",
            ]
        )
    command.extend(["+append", "-background", "#F3EFE8", str(output)])
    subprocess.run(command, check=True)
    return output


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--variant", choices=("clear", "25", "50", "75", "100"))
    parser.add_argument("--samples", type=int, default=512)
    parser.add_argument("--res", nargs=2, type=int, default=(1200, 1320))
    parser.add_argument("--denoise", choices=("on", "off"), default="on")
    parser.add_argument("--region", choices=("full", "neck", "shoulder", "base"), default="full")
    parser.add_argument("--compose", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    out_dir = args.out_dir.expanduser().resolve()
    if args.compose:
        print("BB_CORRECTION_COMPARISON", compose_bracket(out_dir))
        return
    if args.variant is None:
        raise ValueError("--variant is required unless --compose is used")
    value = normalize_variant(args.variant)
    width, height = args.res
    denoised = args.denoise == "on"
    full_path = out_dir / output_name(value, denoised)
    if args.region == "full" or not full_path.exists():
        full_path = render_full(out_dir, value, width, height, args.samples, denoised)
    if args.region == "full":
        print("BB_CORRECTION_RENDER", full_path)
    else:
        print(
            "BB_CORRECTION_CROP",
            export_crop(full_path, out_dir, value, args.region, width, height, denoised),
        )


if __name__ == "__main__":
    main()
