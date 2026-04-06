#!/usr/bin/env python3
"""
Step 4: Component Classification & Renaming
Identifies what each layer image is (body, fitment, roller, cap) using
heuristics and optionally Claude Vision, then renames per SKU convention.
"""

import json
import os
from pathlib import Path
from typing import Optional

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: Pillow/numpy not installed.")
    exit(1)

from tqdm import tqdm


def get_content_bbox(image: Image.Image) -> dict:
    """
    Analyze the non-transparent content of an image.
    Returns bounding box and coverage statistics.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    alpha = np.array(image.split()[-1])
    content_mask = alpha > 20  # Threshold for "visible" pixels

    if not content_mask.any():
        return {"empty": True}

    rows = np.any(content_mask, axis=1)
    cols = np.any(content_mask, axis=0)
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    h, w = alpha.shape
    content_pixels = np.sum(content_mask)

    return {
        "empty": False,
        "bbox": {"x_min": int(x_min), "y_min": int(y_min),
                 "x_max": int(x_max), "y_max": int(y_max)},
        "bbox_width": int(x_max - x_min),
        "bbox_height": int(y_max - y_min),
        "canvas_width": w,
        "canvas_height": h,
        "content_ratio": float(content_pixels / (h * w)),
        "vertical_center": float((y_min + y_max) / 2 / h),
        "horizontal_center": float((x_min + x_max) / 2 / w),
        "height_ratio": float((y_max - y_min) / h),
        "width_ratio": float((x_max - x_min) / w),
        "aspect_ratio": float((x_max - x_min) / max(y_max - y_min, 1)),
    }


def classify_by_heuristic(analysis: dict, layer_index: int,
                           total_layers: int) -> tuple:
    """
    Classify a component using position and shape heuristics.
    
    Returns: (component_type, confidence)
    """
    if analysis.get("empty"):
        return ("unknown", 0.0)

    vc = analysis["vertical_center"]   # 0=top, 1=bottom
    hr = analysis["height_ratio"]      # How tall relative to canvas
    cr = analysis["content_ratio"]     # How much of canvas is filled
    ar = analysis["aspect_ratio"]      # width/height of content

    # Rule 1: Layer position is the strongest signal
    if total_layers >= 2:
        # Bottom layer = body (almost always)
        if layer_index == 0:
            if hr > 0.3:  # Content is tall enough to be a bottle
                return ("body", 0.95)
            else:
                return ("body", 0.7)

        # Top layer = cap (almost always)
        if layer_index == total_layers - 1:
            if vc < 0.4:  # Content is in top portion of canvas
                return ("cap", 0.95)
            elif hr < 0.3:  # Content is short
                return ("cap", 0.85)
            else:
                return ("cap", 0.6)

    # Rule 2: Middle layers by shape analysis
    # Roller: very small, near top
    if cr < 0.03 and vc < 0.4:
        return ("roller", 0.85)

    # Fitment: medium size, sits in upper-middle area
    if 0.02 < cr < 0.25 and 0.2 < vc < 0.6:
        return ("fitment", 0.80)

    # Body: large, fills most of frame
    if hr > 0.5 and cr > 0.1:
        return ("body", 0.75)

    # Cap: small, top of frame
    if vc < 0.35 and hr < 0.3:
        return ("cap", 0.70)

    # Fallback by position
    if total_layers >= 3:
        if layer_index == 0:
            return ("body", 0.5)
        elif layer_index == total_layers - 1:
            return ("cap", 0.5)
        else:
            return ("fitment", 0.5)

    return ("unknown", 0.0)


def classify_by_vision(image_path: Path) -> tuple:
    """
    Use Claude Vision API to classify ambiguous components.
    Only called when heuristic confidence is below threshold.
    
    Returns: (component_type, confidence)
    """
    try:
        import anthropic
        import base64

        client = anthropic.Anthropic()

        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data,
                        }
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a single layer from a product photograph of a glass bottle "
                            "used for fragrance/cosmetics packaging. The background has been removed. "
                            "Classify this image as exactly ONE of these component types:\n"
                            "- body (the glass bottle/vessel itself)\n"
                            "- fitment (spray pump, dropper, roll-on mechanism, lotion pump)\n"
                            "- roller (small steel or glass ball that sits in the bottle neck)\n"
                            "- cap (the closure/overcap that covers the top)\n\n"
                            "Respond with ONLY the component type word (body, fitment, roller, or cap). "
                            "Nothing else."
                        )
                    }
                ]
            }]
        )

        result = response.content[0].text.strip().lower()
        valid_types = {"body", "fitment", "roller", "cap"}
        if result in valid_types:
            return (result, 0.90)
        else:
            return ("unknown", 0.0)

    except Exception as e:
        print(f"  Vision API error: {e}")
        return ("unknown", 0.0)


def classify_and_rename_all(input_dir: Path, output_dir: Path,
                             use_vision: bool = False,
                             confidence_threshold: float = 0.6) -> dict:
    """
    Classify all component images and rename per SKU convention.
    
    Input:  input_dir/SKU_FOLDER/layer_000.png
    Output: output_dir/SKU_FOLDER/SKU-body.png, SKU-fitment.png, SKU-cap.png
    """
    import shutil

    stats = {"classified": 0, "ambiguous": 0, "vision_calls": 0, "errors": 0}
    classification_report = []

    for sku_folder in tqdm(sorted(input_dir.iterdir()), desc="Classifying"):
        if not sku_folder.is_dir():
            continue

        sku = sku_folder.name
        out_dir = output_dir / sku
        out_dir.mkdir(parents=True, exist_ok=True)

        # Gather all image layers (sorted by name for consistent ordering)
        layers = sorted([
            f for f in sku_folder.iterdir()
            if f.suffix.lower() == ".png" and not f.name.startswith(".")
            and f.name != "extraction_info.json"
        ])

        total = len(layers)
        if total == 0:
            continue

        product_classifications = []
        used_types = set()

        for idx, layer_path in enumerate(layers):
            img = Image.open(layer_path)
            analysis = get_content_bbox(img)

            comp_type, confidence = classify_by_heuristic(analysis, idx, total)

            # If low confidence and vision is enabled, use Claude Vision
            if confidence < confidence_threshold and use_vision:
                comp_type_v, confidence_v = classify_by_vision(layer_path)
                stats["vision_calls"] += 1
                if confidence_v > confidence:
                    comp_type = comp_type_v
                    confidence = confidence_v
                    method = "vision"
                else:
                    method = "heuristic"
            else:
                method = "heuristic"

            # Handle duplicate component types within same product
            if comp_type in used_types:
                # Append numeric suffix for duplicates
                count = sum(1 for c in product_classifications if c["type"] == comp_type)
                output_name = f"{sku}-{comp_type}{count + 1}.png"
            else:
                output_name = f"{sku}-{comp_type}.png"

            used_types.add(comp_type)

            # Copy and rename
            shutil.copy2(str(layer_path), str(out_dir / output_name))

            classification = {
                "sku": sku,
                "original": layer_path.name,
                "renamed": output_name,
                "type": comp_type,
                "confidence": round(confidence, 3),
                "method": method,
                "analysis": {k: v for k, v in analysis.items()
                             if k not in ("bbox",)} if not analysis.get("empty") else {},
            }
            product_classifications.append(classification)

            if confidence < confidence_threshold:
                stats["ambiguous"] += 1
            else:
                stats["classified"] += 1

        classification_report.append({
            "sku": sku,
            "layer_count": total,
            "classifications": product_classifications,
        })

    # Save classification report
    report_path = output_dir / "_classification_report.json"
    with open(report_path, "w") as f:
        json.dump(classification_report, f, indent=2)

    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Classify and rename product image layers")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--use-vision", action="store_true",
                        help="Use Claude Vision API for ambiguous images")
    parser.add_argument("--threshold", type=float, default=0.6,
                        help="Confidence threshold below which to flag as ambiguous")
    args = parser.parse_args()

    stats = classify_and_rename_all(args.input, args.output,
                                     use_vision=args.use_vision,
                                     confidence_threshold=args.threshold)
    print(f"\nClassified: {stats['classified']}, Ambiguous: {stats['ambiguous']}")
    if stats["vision_calls"]:
        print(f"Vision API calls: {stats['vision_calls']}")
