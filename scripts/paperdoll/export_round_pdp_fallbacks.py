#!/usr/bin/env python3
"""Export exact-SKU Round PDP fallbacks from the capped PSD assemblies.

These images are a local safety net for PDP variants whose historical Shopify
media URL no longer resolves. They preserve the selected finish and do not
replace the separately approved catalog heroes.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

REPO = Path(__file__).resolve().parents[2]
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
OUT = REPO / "public/images/pdp/round"
MANIFEST = REPO / "docs/reviews/round-pdp-fallbacks-2026-09-07.json"
CANVAS = (1000, 1100)
BONE = (245, 243, 239)
BASELINE_Y = 1001  # 91% of the 1100px PDP plate canvas
MAX_WIDTH = 920
TOP_MARGIN = 40

F78 = "2.  18-415 Bottles /31. Capped & Uncapped, 18-415 Lotion and Sprayers/Capped/8.  78 Round Frosted, Spry & Ltn, capped"
C78 = "2.  18-415 Bottles /31. Capped & Uncapped, 18-415 Lotion and Sprayers/Capped/9.  78ml Round, Ltn & Spry, capped"
F128 = "2.  18-415 Bottles /31. Capped & Uncapped, 18-415 Lotion and Sprayers/Capped/10. 128ml Round Frst, Ltn & Spry capped"

SOURCES = {
    "GBRnd78SpryMtGl": f"{C78}/11. GBRnd78SpryMtGl.psd",
    "GBRnd78SpryMtSl": f"{C78}/24. GBRnd78SpryMtSl.psd",
    "GBRnd78SpryShnGl": f"{C78}/17. GBRnd78SpryShnGl.psd",
    "GBRnd78SpryShnBlk": f"{C78}/21. GBRnd78SpryShnBlk.psd",
    "GBRnd78SpryShnSl": f"{C78}/30. GBRnd78SpryShnSl.psd",
    "GBRndFrst78SpryCu": f"{F78}/54. GBRndFrst78SpryCu.psd",
    "GBRndFrst78SpryMtGl": f"{F78}/11. GBRndFrst78SpryMtGl.psd",
    "GBRndFrst78SpryMtSl": f"{F78}/24. GBRndFrst78SpryMtSl.psd",
    "GBRndFrst78SpryShnGl": f"{F78}/17. GBRndFrst78SpryShnGl.psd",
    "GBRndFrst78SpryShnBlk": f"{F78}/21. GBRndFrst78SpryShnBlk.psd",
    "GBRndFrst78SpryShnSl": f"{F78}/30. GBRndFrst78SpryShnSl.psd",
    "GBRndFrst128SpryCu": f"{F128}/57. GBRndFrst128SpryCu.psd",
    "GBRndFrst128SpryMtGl": f"{F128}/11. GBRndFrst128SpryMtGl.psd",
    "GBRndFrst128SpryMtSl": f"{F128}/23. GBRndFrst128SpryMtSl.psd",
    "GBRndFrst128SpryShnGl": f"{F128}/17. GBRndFrst128SpryShnGl.psd",
    "GBRndFrst128SpryShnBlk": f"{F128}/21. GBRndFrst128SpryShnBlk.psd",
    # The master uses its historical SpSlShn spelling for this exact spray.
    "GBRndFrst128SpryShnSl": f"{F128}/30. GBRndFrst128SpSlShn.psd",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(sku: str, rel: str) -> dict:
    source = MASTER / rel
    if not source.exists():
        raise FileNotFoundError(source)

    image = PSDImage.open(source).composite().convert("RGB")
    pixels = np.asarray(image).copy()
    subject = np.any(pixels < 254, axis=2)
    ys, xs = np.where(subject)
    if len(xs) == 0:
        raise RuntimeError(f"blank PSD composite: {source}")

    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    crop = pixels[top:bottom, left:right].copy()
    # The masters use exact white outside the photographed assembly. Changing
    # only those pixels preserves pale frosted glass and antialiased edges.
    crop[np.all(crop == 255, axis=2)] = BONE
    crop_image = Image.fromarray(crop, "RGB")

    scale = min(MAX_WIDTH / crop_image.width, (BASELINE_Y - TOP_MARGIN) / crop_image.height)
    size = (round(crop_image.width * scale), round(crop_image.height * scale))
    resized = crop_image.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", CANVAS, BONE)
    x = (CANVAS[0] - resized.width) // 2
    y = BASELINE_Y - resized.height
    canvas.paste(resized, (x, y))

    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / f"{sku}.png"
    canvas.save(destination, format="PNG", optimize=True)
    return {
        "websiteSku": sku,
        "url": f"/images/pdp/round/{sku}.png",
        "source": rel,
        "sourceSha256": sha256(source),
        "assetSha256": sha256(destination),
        "canvas": list(CANVAS),
        "baselineY": BASELINE_Y,
        "sourceSubjectBounds": [left, top, right, bottom],
        "renderedBounds": [x, y, x + resized.width, y + resized.height],
        "scale": scale,
    }


def main() -> None:
    rows = [export(sku, rel) for sku, rel in SOURCES.items()]
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        "purpose": "Exact-SKU PDP fallback for Round spray variants with unavailable remote media",
        "background": "#F5F3EF",
        "baselinePercent": 91,
        "rows": rows,
    }, indent=2) + "\n")
    print(f"exported {len(rows)} exact-SKU fallbacks to {OUT}")


if __name__ == "__main__":
    main()
