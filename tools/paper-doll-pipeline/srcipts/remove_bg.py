#!/usr/bin/env python3
"""
Step 3: Background Removal
Batch removes backgrounds using rembg (U²-Net model).
Handles glass transparency with alpha matting for clean edges.
"""

import os
from pathlib import Path
from typing import Optional

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: Pillow not installed. Run: pip install Pillow")
    exit(1)

from tqdm import tqdm


def has_transparency(image_path: Path, threshold: float = 0.1) -> bool:
    """Check if an image already has significant transparency."""
    img = Image.open(image_path)
    if img.mode != "RGBA":
        return False
    alpha = np.array(img.split()[-1])
    transparent_ratio = np.sum(alpha < 128) / alpha.size
    return transparent_ratio > threshold


def get_rembg_params(sku: str) -> dict:
    """
    Return rembg parameters tuned for specific product types.
    Glass/frosted products need tighter matting thresholds.
    """
    params = {
        "alpha_matting": True,
        "alpha_matting_foreground_threshold": 240,
        "alpha_matting_background_threshold": 10,
        "alpha_matting_erode_size": 10,
    }

    sku_upper = sku.upper()

    # Frosted glass — tighter thresholds to preserve soft edges
    if "FRS" in sku_upper or "FROST" in sku_upper:
        params["alpha_matting_foreground_threshold"] = 200
        params["alpha_matting_background_threshold"] = 20
        params["alpha_matting_erode_size"] = 5

    # Clear glass — preserve transparency of the glass itself
    elif "CLR" in sku_upper or "CLEAR" in sku_upper:
        params["alpha_matting_foreground_threshold"] = 210
        params["alpha_matting_background_threshold"] = 15
        params["alpha_matting_erode_size"] = 7

    # Metal atomizers — solid objects, standard settings work well
    elif "GBATOM" in sku_upper or "ATOM" in sku_upper:
        params["alpha_matting"] = False  # No matting needed for solid metal

    return params


def remove_background_single(image_path: Path, output_path: Path,
                              session, sku: str = "") -> dict:
    """Remove background from a single image."""
    from rembg import remove

    with open(image_path, "rb") as f:
        input_data = f.read()

    params = get_rembg_params(sku)

    try:
        output_data = remove(
            input_data,
            session=session,
            **params
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(output_data)

        return {"status": "processed", "params": params}

    except Exception as e:
        return {"status": "error", "error": str(e)}


def batch_remove_backgrounds(input_dir: Path, output_dir: Path,
                              model_name: str = "u2net") -> dict:
    """
    Process all images in SKU-organized directory structure.
    
    Input:  input_dir/SKU_FOLDER/layer_000.png
    Output: output_dir/SKU_FOLDER/layer_000.png (background removed)
    """
    try:
        from rembg import new_session
    except ImportError:
        print("Error: rembg not installed. Run: pip install rembg[gpu]")
        print("  or for CPU only: pip install rembg[cpu]")
        exit(1)

    # Initialize model session once (reuse across all images)
    print(f"Loading {model_name} model (first run downloads ~170MB)...")
    session = new_session(model_name)
    print("Model loaded.")

    stats = {"processed": 0, "skipped": 0, "errors": 0, "error_details": []}
    image_extensions = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}

    # Collect all image files
    all_images = []
    for sku_folder in sorted(input_dir.iterdir()):
        if not sku_folder.is_dir():
            continue
        for img_file in sorted(sku_folder.iterdir()):
            if img_file.suffix.lower() in image_extensions:
                all_images.append((sku_folder.name, img_file))

    for sku, img_path in tqdm(all_images, desc="Removing backgrounds"):
        output_path = output_dir / sku / img_path.name
        
        # Ensure output is PNG regardless of input format
        if output_path.suffix.lower() != ".png":
            output_path = output_path.with_suffix(".png")

        # Skip if already transparent
        if img_path.suffix.lower() == ".png" and has_transparency(img_path):
            # Copy as-is
            output_path.parent.mkdir(parents=True, exist_ok=True)
            import shutil
            shutil.copy2(str(img_path), str(output_path))
            stats["skipped"] += 1
            continue

        result = remove_background_single(img_path, output_path, session, sku=sku)

        if result["status"] == "processed":
            stats["processed"] += 1
        else:
            stats["errors"] += 1
            stats["error_details"].append({"sku": sku, "file": img_path.name, "error": result.get("error")})

    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Batch background removal for product images")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="u2net", help="rembg model name")
    args = parser.parse_args()

    stats = batch_remove_backgrounds(args.input, args.output, args.model)
    print(f"\nProcessed: {stats['processed']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")
