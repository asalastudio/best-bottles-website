#!/usr/bin/env python3
"""Render deterministic luxury-glass review frames and 200% diagnostics."""

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
    path = SCRIPT_DIR / "build-9ml-luxury-glass-studio.py"
    spec = importlib.util.spec_from_file_location("bb_luxury_render_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = _load_builder()


def validate_scene(variant: str):
    body = bpy.data.objects.get(contract.BODY_NAME)
    if body is None:
        raise RuntimeError("protected 9 ml body is missing")
    fingerprint = contract.geometry_fingerprint(body.data)
    if fingerprint != contract.BODY_GEOMETRY_SHA256:
        raise RuntimeError(f"geometry changed before render: {fingerprint}")
    if body.get("bb_thread_source_fingerprint") != contract.THREAD_SHA256:
        raise RuntimeError("approved 17-415 thread changed before render")
    if bpy.context.scene.get("bb_variant") != variant:
        raise RuntimeError(
            f"loaded derivative is {bpy.context.scene.get('bb_variant')!r}, not {variant!r}"
        )
    material = body.data.materials[0] if body.data.materials else None
    expected_material = f"BB_GLASS_{variant.upper()}"
    if material is None or material.name != expected_material:
        raise RuntimeError(f"expected {expected_material}, found {getattr(material, 'name', None)}")
    builder.configure_camera()
    return body


def configure_output(width: int, height: int, samples: int, denoised: bool):
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 15
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = contract.RENDER.noise_threshold
    scene.cycles.use_denoising = denoised
    scene.render.film_transparent = False


def render_full(out_dir: Path, variant: str, width: int, height: int, samples: int, denoised: bool):
    validate_scene(variant)
    configure_output(width, height, samples, denoised)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / contract.qc_filename(variant, "full", samples, denoised)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if not path.exists():
        raise RuntimeError(f"Cycles did not write {path}")
    return path


def _magick():
    executable = shutil.which("magick")
    if executable is None:
        raise RuntimeError("ImageMagick 'magick' executable is required for QC crops")
    return executable


def export_crop(full_path: Path, out_dir: Path, variant: str, region: str, samples: int, denoised: bool, width: int, height: int):
    left, top, right, bottom = contract.crop_boxes(width, height)[region]
    crop_width = right - left
    crop_height = bottom - top
    output = out_dir / contract.qc_filename(variant, region, samples, denoised)
    subprocess.run(
        [
            _magick(),
            str(full_path),
            "-crop",
            f"{crop_width}x{crop_height}+{left}+{top}",
            "+repage",
            "-filter",
            "Mitchell",
            "-resize",
            "200%",
            str(output),
        ],
        check=True,
    )
    return output


def compose_comparison(out_dir: Path, samples: int):
    variants = ("clear", "frosted", "cobalt", "amber")
    inputs = [out_dir / contract.qc_filename(name, "full", samples, True) for name in variants]
    missing = [path for path in inputs if not path.exists()]
    if missing:
        raise FileNotFoundError(f"comparison inputs missing: {missing}")
    output = out_dir / "009ml-four-luxury-comparison.png"
    labels = tuple(name.upper() for name in variants)
    bone = "#d4cbbf"
    ink = "#292621"
    command = [_magick()]
    for path, label in zip(inputs[:2], labels[:2]):
        command.extend(
            ["(", str(path), "-resize", "600x660", "-gravity", "south", "-background", bone,
             "-splice", "0x52", "-fill", ink, "-pointsize", "25", "-annotate", "+0+13", label, ")"]
        )
    command.extend(["+append", "("])
    for path, label in zip(inputs[2:], labels[2:]):
        command.extend(
            ["(", str(path), "-resize", "600x660", "-gravity", "south", "-background", bone,
             "-splice", "0x52", "-fill", ink, "-pointsize", "25", "-annotate", "+0+13", label, ")"]
        )
    command.extend(["+append", ")", "-append", "-background", bone, str(output)])
    subprocess.run(command, check=True)
    return output


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--samples", type=int, default=contract.RENDER.samples)
    parser.add_argument("--res", nargs=2, type=int, metavar=("WIDTH", "HEIGHT"), default=(1200, 1320))
    parser.add_argument("--variant", choices=tuple(contract.VARIANTS))
    parser.add_argument("--denoise", choices=("on", "off"), default="on")
    parser.add_argument("--region", choices=("full", "neck", "shoulder", "base"), default="full")
    parser.add_argument("--compose-comparison", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    out_dir = args.out_dir.expanduser().resolve()
    if args.compose_comparison:
        print("BB_QC_COMPARISON", compose_comparison(out_dir, args.samples))
        return
    if args.variant is None:
        raise ValueError("--variant is required unless --compose-comparison is used")
    width, height = args.res
    denoised = args.denoise == "on"
    full_path = out_dir / contract.qc_filename(args.variant, "full", args.samples, denoised)
    if args.region == "full" or not full_path.exists():
        full_path = render_full(out_dir, args.variant, width, height, args.samples, denoised)
    if args.region == "full":
        print("BB_QC_RENDER", full_path)
    else:
        crop = export_crop(
            full_path, out_dir, args.variant, args.region, args.samples,
            denoised, width, height,
        )
        print("BB_QC_CROP", crop)


if __name__ == "__main__":
    main()
