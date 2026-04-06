#!/usr/bin/env python3
"""
Step 2: PSD Layer Extraction
Extracts individual layers from PSD files as transparent PNGs,
preserving layer positioning for pixel-perfect alignment.
"""

import os
from pathlib import Path
from typing import Optional

try:
    from psd_tools import PSDImage
except ImportError:
    print("Error: psd-tools not installed. Run: pip install psd-tools")
    exit(1)

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow not installed. Run: pip install Pillow")
    exit(1)

from tqdm import tqdm


def extract_psd_layers(psd_path: Path, output_dir: Path, preserve_alignment: bool = True) -> dict:
    """
    Extract visible layers from a PSD file.
    
    Args:
        psd_path: Path to the PSD file
        output_dir: Directory to write extracted PNGs
        preserve_alignment: If True, place each layer on a canvas matching PSD dimensions
                           so all layers align when stacked. If False, crop to layer bounds.
    
    Returns:
        Dict with extraction stats and layer info
    """
    psd = PSDImage.open(str(psd_path))
    layers_info = []
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    layer_idx = 0
    for layer in psd:
        # Skip invisible layers, adjustment layers, and groups
        if not layer.is_visible():
            continue
        if layer.is_group():
            # Recursively handle groups — flatten to individual layers
            for sublayer in layer:
                if sublayer.is_visible() and not sublayer.is_group():
                    _extract_single_layer(
                        sublayer, psd, layer_idx, output_dir,
                        preserve_alignment, layers_info
                    )
                    layer_idx += 1
        else:
            _extract_single_layer(
                layer, psd, layer_idx, output_dir,
                preserve_alignment, layers_info
            )
            layer_idx += 1
    
    return {
        "psd_file": str(psd_path),
        "psd_width": psd.width,
        "psd_height": psd.height,
        "layers_extracted": len(layers_info),
        "layers": layers_info
    }


def _extract_single_layer(layer, psd, idx: int, output_dir: Path,
                           preserve_alignment: bool, layers_info: list):
    """Extract a single layer and save as PNG."""
    try:
        layer_image = layer.composite()
        if layer_image is None:
            return
        
        # Ensure RGBA
        if layer_image.mode != "RGBA":
            layer_image = layer_image.convert("RGBA")
        
        if preserve_alignment:
            # Create canvas matching full PSD dimensions
            canvas = Image.new("RGBA", (psd.width, psd.height), (0, 0, 0, 0))
            # layer.offset gives (left, top) in PSD coordinate space
            offset = layer.offset
            canvas.paste(layer_image, (offset[0], offset[1]), layer_image)
            save_image = canvas
        else:
            save_image = layer_image
        
        # Save
        filename = f"layer_{idx:03d}.png"
        save_path = output_dir / filename
        save_image.save(str(save_path), "PNG", optimize=True)
        
        layers_info.append({
            "filename": filename,
            "layer_name": layer.name,
            "offset_x": layer.offset[0],
            "offset_y": layer.offset[1],
            "layer_width": layer_image.width,
            "layer_height": layer_image.height,
            "opacity": getattr(layer, 'opacity', 255),
            "blend_mode": str(getattr(layer, 'blend_mode', 'normal')),
        })
    except Exception as e:
        print(f"  Warning: Could not extract layer {idx} ({layer.name}): {e}")


def extract_all_psds(source: Path, output: Path) -> dict:
    """
    Extract all PSDs in SKU-organized source directory.
    
    Expects:
        source/
          SKU_FOLDER/
            product.psd (or any .psd file)
    
    Outputs:
        output/
          SKU_FOLDER/
            layer_000.png
            layer_001.png
            ...
            extraction_info.json
    """
    import json
    
    stats = {"psds_processed": 0, "layers_extracted": 0, "errors": []}
    
    sku_folders = sorted([d for d in source.iterdir() if d.is_dir()])
    
    for folder in tqdm(sku_folders, desc="Extracting PSDs"):
        psd_files = list(folder.glob("*.psd")) + list(folder.glob("*.psb"))
        
        if not psd_files:
            # No PSD files — check if PNGs already exist and copy them
            png_files = list(folder.glob("*.png"))
            if png_files:
                out_dir = output / folder.name
                out_dir.mkdir(parents=True, exist_ok=True)
                for png in sorted(png_files):
                    import shutil
                    shutil.copy2(str(png), str(out_dir / png.name))
            continue
        
        # Process first PSD found (typically one per folder)
        psd_path = psd_files[0]
        out_dir = output / folder.name
        
        try:
            result = extract_psd_layers(psd_path, out_dir, preserve_alignment=True)
            stats["psds_processed"] += 1
            stats["layers_extracted"] += result["layers_extracted"]
            
            # Save extraction metadata
            info_path = out_dir / "extraction_info.json"
            with open(info_path, "w") as f:
                json.dump(result, f, indent=2)
                
        except Exception as e:
            stats["errors"].append({"sku": folder.name, "error": str(e)})
            print(f"  Error processing {folder.name}: {e}")
    
    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Extract PSD layers to transparent PNGs")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    
    stats = extract_all_psds(args.source, args.output)
    print(f"\nExtracted {stats['layers_extracted']} layers from {stats['psds_processed']} PSDs")
    if stats["errors"]:
        print(f"Errors: {len(stats['errors'])}")
