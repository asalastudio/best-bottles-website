#!/usr/bin/env python3
"""
Step 7: Manifest Generation
Creates Sanity CMS-ready JSON manifest mapping products to their processed layers.
"""

import json
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow not installed.")
    exit(1)

from tqdm import tqdm

VALID_COMPONENTS = {"body", "fitment", "roller", "cap", "shadow", "lighting"}
LAYER_ORDER = ["shadow", "body", "roller", "fitment", "cap", "lighting"]


def parse_component_from_filename(filename: str) -> tuple:
    """
    Extract component type from filename.
    'GB-CYL-CLR-50ML-SPR-body.png' -> ('body', None)
    'GB-CYL-CLR-50ML-SPR-fitment2.png' -> ('fitment', 2)
    """
    stem = Path(filename).stem
    for comp in VALID_COMPONENTS:
        if stem.endswith(f"-{comp}"):
            return (comp, None)
        for i in range(1, 10):
            if stem.endswith(f"-{comp}{i}"):
                return (comp, i)
    return ("unknown", None)


def generate_manifest(input_dir: Path) -> dict:
    """
    Generate Sanity-ready manifest from processed image directory.
    
    Reads: input_dir/SKU_FOLDER/SKU-body.png, SKU-cap.png, etc.
    """
    products = []

    for sku_folder in tqdm(sorted(input_dir.iterdir()), desc="Building manifest"):
        if not sku_folder.is_dir():
            continue

        sku = sku_folder.name
        layers = {}

        for img_file in sorted(sku_folder.iterdir()):
            if img_file.suffix.lower() != ".png":
                continue

            comp_type, index = parse_component_from_filename(img_file.name)
            if comp_type == "unknown":
                continue

            # Get image metadata
            try:
                img = Image.open(img_file)
                width, height = img.size
            except:
                width, height = 0, 0

            key = comp_type if index is None else f"{comp_type}{index}"
            layers[key] = {
                "file": img_file.name,
                "path": str(img_file.relative_to(input_dir)),
                "width": width,
                "height": height,
                "filesize_bytes": img_file.stat().st_size,
                "component_type": comp_type,
            }

        if not layers:
            continue

        # Determine layer order for this product
        present_types = [comp for comp in LAYER_ORDER if comp in layers]

        products.append({
            "sku": sku,
            "layers": layers,
            "layer_order": present_types,
            "layer_count": len(layers),
            "has_body": "body" in layers,
            "has_cap": "cap" in layers,
            "has_fitment": "fitment" in layers,
            "has_roller": "roller" in layers,
        })

    manifest = {
        "generated_at": datetime.now().isoformat(),
        "pipeline_version": "1.0.0",
        "canvas": {"width": 600, "height": 1063},
        "total_products": len(products),
        "total_layers": sum(p["layer_count"] for p in products),
        "products": products,
    }

    return manifest


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate Sanity-ready manifest")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = generate_manifest(args.input)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest: {manifest['total_products']} products, {manifest['total_layers']} layers")
    print(f"Written to: {args.output}")
