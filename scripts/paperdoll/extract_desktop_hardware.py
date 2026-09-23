#!/usr/bin/env python3
"""Reproduce native hardware parts from an inspected, hashed PSD manifest.

This is source extraction, not a publishable per-bottle kit. Native white
retouch scraps are intentionally retained for explicit later review.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from psd_tools import PSDImage


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    manifest = json.loads(args.manifest.read_text())
    args.out.mkdir(parents=True, exist_ok=True)
    rows = manifest["rows"]
    sheet = Image.new("RGB", (1080, 360 * ((len(rows) + 2) // 3)), "#F5F3EF")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        source = Path(row["sourcePsd"])
        assert sha(source) == row["sourceSha256"], f"Source changed: {source}"
        doc = PSDImage.open(source)
        assert list(doc.size) == row["canvas"]
        layers = list(doc.descendants())
        composite = Image.new("RGBA", doc.size)
        for part in row["parts"]:
            layer = layers[part["layerIndex"]]
            assert layer.is_visible() and list(layer.bbox) == part["bounds"]
            assert layer.name == part["layerName"]
            canvas = Image.new("RGBA", doc.size)
            canvas.alpha_composite(layer.composite(force=True).convert("RGBA"), (layer.left, layer.top))
            target = args.out / part["file"]
            assert target.parent == args.out, "Part must be a basename"
            canvas.save(target)
            assert sha(target) == part["sha256"], f"Extraction differs: {part['file']}"
            composite.alpha_composite(canvas)
        composite.save(args.out / (row["sku"] + ".png"))
        im = composite.crop(composite.getbbox())
        im.thumbnail((300, 290))
        x, y = i % 3 * 360, i // 3 * 360
        sheet.paste(im, (x + (360 - im.width) // 2, y + 15), im)
        draw.text((x + 20, y + 320), row["sku"], fill="black")
    sheet.save(args.out / "source-sheet.jpg", quality=92)
    print(f"Reproduced {len(rows)} native source candidates; no per-bottle kit or hosted asset changed.")


if __name__ == "__main__":
    main()
