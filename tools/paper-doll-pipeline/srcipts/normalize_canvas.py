#!/usr/bin/env python3
"""
Step 5: Canvas Normalization
Resizes all component images to the standard 600x1063 Paper Doll canvas.
Preserves relative layer alignment from PSD extraction when available.
"""

import json
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: Pillow/numpy not installed.")
    exit(1)

from tqdm import tqdm

CANVAS_WIDTH = 600
CANVAS_HEIGHT = 1063
PADDING_RATIO = 0.05  # 5% padding on each side


def normalize_single(image_path: Path, output_path: Path,
                     component_type: str = "body",
                     psd_alignment: dict = None) -> dict:
    """
    Normalize a single image to the standard Paper Doll canvas.
    
    If psd_alignment is provided (from extraction_info.json), uses PSD
    coordinates for pixel-perfect layer stacking. Otherwise, uses
    heuristic positioning based on component type.
    """
    img = Image.open(image_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    original_size = img.size
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))

    if psd_alignment:
        # PSD-aware positioning: scale from PSD canvas to our canvas
        psd_w = psd_alignment.get("psd_width", img.width)
        psd_h = psd_alignment.get("psd_height", img.height)
        scale = min(CANVAS_WIDTH / psd_w, CANVAS_HEIGHT / psd_h)

        # The image was already placed on PSD-sized canvas during extraction
        # Just resize the whole thing to our target
        resized = img.resize(
            (int(img.width * scale), int(img.height * scale)),
            Image.LANCZOS
        )

        # Center on our canvas
        x = (CANVAS_WIDTH - resized.width) // 2
        y = (CANVAS_HEIGHT - resized.height) // 2
        canvas.paste(resized, (x, y), resized)

    else:
        # Heuristic positioning based on component type
        # First, find the content bounding box (ignore transparent pixels)
        alpha = np.array(img.split()[-1])
        content_mask = alpha > 20

        if content_mask.any():
            rows = np.any(content_mask, axis=1)
            cols = np.any(content_mask, axis=0)
            y_min, y_max = np.where(rows)[0][[0, -1]]
            x_min, x_max = np.where(cols)[0][[0, -1]]

            # Crop to content
            cropped = img.crop((x_min, y_min, x_max + 1, y_max + 1))
        else:
            cropped = img

        # Scale to fit within padded canvas
        max_w = int(CANVAS_WIDTH * (1 - 2 * PADDING_RATIO))
        max_h = int(CANVAS_HEIGHT * (1 - 2 * PADDING_RATIO))
        ratio = min(max_w / cropped.width, max_h / cropped.height)
        new_w = int(cropped.width * ratio)
        new_h = int(cropped.height * ratio)
        resized = cropped.resize((new_w, new_h), Image.LANCZOS)

        # Position based on component type
        x = (CANVAS_WIDTH - new_w) // 2  # Always horizontally centered

        if component_type == "body":
            # Anchor to bottom-center
            y = CANVAS_HEIGHT - new_h - int(CANVAS_HEIGHT * PADDING_RATIO)
        elif component_type == "cap":
            # Anchor to top-center
            y = int(CANVAS_HEIGHT * PADDING_RATIO)
        elif component_type in ("fitment", "roller"):
            # Center vertically (neck junction area)
            y = int(CANVAS_HEIGHT * 0.15)  # Slightly above center
        else:
            y = (CANVAS_HEIGHT - new_h) // 2

        canvas.paste(resized, (x, y), resized)

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(str(output_path), "PNG", optimize=True)

    return {
        "original_size": original_size,
        "output_size": (CANVAS_WIDTH, CANVAS_HEIGHT),
        "component_type": component_type,
        "used_psd_alignment": psd_alignment is not None,
    }


def infer_component_type(filename: str) -> str:
    """Extract component type from filename (e.g., 'SKU-body.png' -> 'body')."""
    stem = Path(filename).stem
    for comp in ("body", "fitment", "roller", "cap", "shadow", "lighting"):
        if stem.endswith(f"-{comp}"):
            return comp
        # Handle numbered duplicates like -cap2
        for i in range(1, 10):
            if stem.endswith(f"-{comp}{i}"):
                return comp
    return "unknown"


def load_psd_alignment(sku_folder: Path) -> dict:
    """Load PSD extraction info if available for alignment data."""
    info_path = sku_folder / "extraction_info.json"
    if info_path.exists():
        with open(info_path) as f:
            return json.load(f)
    return None


def normalize_all(input_dir: Path, output_dir: Path) -> dict:
    """
    Normalize all images in SKU-organized directory to standard canvas.
    
    Input:  input_dir/SKU_FOLDER/SKU-body.png, SKU-cap.png, etc.
    Output: output_dir/SKU_FOLDER/SKU-body.png, SKU-cap.png (all 600x1063)
    """
    stats = {"processed": 0, "errors": 0}

    for sku_folder in tqdm(sorted(input_dir.iterdir()), desc="Normalizing canvas"):
        if not sku_folder.is_dir():
            continue

        sku = sku_folder.name
        out_dir = output_dir / sku
        psd_info = load_psd_alignment(sku_folder)

        for img_file in sorted(sku_folder.iterdir()):
            if img_file.suffix.lower() != ".png":
                continue
            if img_file.name.startswith("_") or img_file.name == "extraction_info.json":
                continue

            comp_type = infer_component_type(img_file.name)
            output_path = out_dir / img_file.name

            psd_align = None
            if psd_info:
                psd_align = {
                    "psd_width": psd_info.get("psd_width"),
                    "psd_height": psd_info.get("psd_height"),
                }

            try:
                normalize_single(img_file, output_path, comp_type, psd_align)
                stats["processed"] += 1
            except Exception as e:
                stats["errors"] += 1
                print(f"  Error normalizing {img_file}: {e}")

    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Normalize images to 600x1063 Paper Doll canvas")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    stats = normalize_all(args.input, args.output)
    print(f"\nNormalized: {stats['processed']}, Errors: {stats['errors']}")
