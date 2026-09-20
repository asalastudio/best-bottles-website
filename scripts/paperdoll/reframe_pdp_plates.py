#!/usr/bin/env python3
"""Re-export published PDP plates onto the locked capacity standard.

Reads `data/asset-ledger/pdp-capacity-standards.json` and the plate ledger,
downloads the current 1000×1100 Blob fronts, measures ink, and writes new
candidates with the locked mid-body width and a 4% margin.

    python3 scripts/paperdoll/reframe_pdp_plates.py --sku GBCrcl15Gl,GBCrcl15Sl,GBCrcl15BlkSht,GBCrcl15WhtSht,GBCrcl30GlCap

Does not publish. Candidates land in docs/reviews/circle-pdp-reframe-<date>/.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
STANDARD_PATH = ROOT / "data/asset-ledger/pdp-capacity-standards.json"
LEDGER_PATH = ROOT / "data/asset-ledger/circle-plates.json"


def load_json(path: Path):
    return json.loads(path.read_text())


def family_key(family_id: str) -> str:
    return family_id.split("-")[0]


def capacity_from_family(family_id: str) -> int | None:
    for part in family_id.split("-"):
        if part.endswith("ml") and part[:-2].replace(".", "", 1).isdigit():
            return int(float(part[:-2]))
    return None


WHITE = 250


def is_ink(pixel: tuple[int, ...]) -> bool:
    rgb = pixel[:3]
    return any(channel < WHITE for channel in rgb)


def ink_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    width, height = rgb.size
    left, top, right, bottom = width, height, -1, -1
    for y in range(height):
        for x in range(width):
            if is_ink(pixels[x, y]):
                if x < left:
                    left = x
                if y < top:
                    top = y
                if x > right:
                    right = x
                if y > bottom:
                    bottom = y
    if right < 0:
        return None
    return left, top, right + 1, bottom + 1


def mid_body_width(image: Image.Image, bbox: tuple[int, int, int, int]) -> int:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    mid_y = (bbox[1] + bbox[3]) // 2
    ink = [x for x in range(rgb.size[0]) if is_ink(pixels[x, mid_y])]
    if not ink:
        return bbox[2] - bbox[0]
    return ink[-1] - ink[0] + 1


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    with urllib.request.urlopen(url, timeout=30) as response, dest.open("wb") as out:
        out.write(response.read())
    return dest


def reframe(image: Image.Image, scale: float, canvas: tuple[int, int], margin: float) -> Image.Image:
    """Scale the published plate uniformly and centre it on a white 10:11 canvas.

    Clear Circle glass transmits near-white, so we never crop-to-ink. After
    scale, if the remaining bottle ink still breaks the 4% / 88% gate, fit
    further — never enlarge.
    """
    width, height = canvas
    rgb = image.convert("RGB")
    new_w = max(1, round(rgb.width * scale))
    new_h = max(1, round(rgb.height * scale))
    resized = rgb.resize((new_w, new_h), Image.Resampling.LANCZOS)
    plate = Image.new("RGB", canvas, (255, 255, 255))
    plate.paste(resized, ((width - new_w) // 2, (height - new_h) // 2))
    bbox = ink_bbox(plate)
    if bbox is None:
        return plate
    max_w = width * (1 - 2 * margin)
    max_h = height * (1 - 2 * margin)
    span_w = bbox[2] - bbox[0]
    span_h = bbox[3] - bbox[1]
    if span_w <= max_w and span_h <= max_h:
        return plate
    fit = min(max_w / span_w, max_h / span_h, 1)
    return reframe(rgb, scale * fit, canvas, 0)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sku", default="GBCrcl15Gl,GBCrcl15Sl,GBCrcl15BlkSht,GBCrcl15WhtSht,GBCrcl30GlCap")
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    skus = [sku.strip() for sku in args.sku.split(",") if sku.strip()]
    standard = load_json(STANDARD_PATH)
    ledger = load_json(LEDGER_PATH)
    by_sku = {row["sku"]: row for row in ledger}
    out = Path(args.out) if args.out else ROOT / f"docs/reviews/circle-pdp-reframe-{date.today().isoformat()}"
    out.mkdir(parents=True, exist_ok=True)
    receipt = []
    canvas = (standard["canvas"]["width"], standard["canvas"]["height"])
    margin = standard["gates"]["safeMarginRatio"]
    for sku in skus:
        row = by_sku.get(sku)
        if not row:
            print(f"missing ledger row: {sku}", file=sys.stderr)
            continue
        family_id = row["familyId"]
        family = family_key(family_id)
        capacity = capacity_from_family(family_id)
        target = standard["families"].get(family, {}).get("capacities", {}).get(str(capacity), {})
        scale = float(target.get("publishedPlateScale") or 1)
        source = download(row["front"]["url"], out / "source" / f"{sku}.front-on.webp")
        image = Image.open(source)
        before_bbox = ink_bbox(image)
        before_mid = mid_body_width(image, before_bbox) / canvas[0] * 100 if before_bbox else 0
        before_h = ((before_bbox[3] - before_bbox[1]) / canvas[1] * 100) if before_bbox else 0
        framed = reframe(image, scale, canvas, margin)
        dest = out / "candidates" / f"{sku}.front-on-1000x1100.webp"
        dest.parent.mkdir(parents=True, exist_ok=True)
        framed.save(dest, "WEBP", quality=92, method=6)
        after_bbox = ink_bbox(framed)
        after_mid = mid_body_width(framed, after_bbox) / canvas[0] * 100 if after_bbox else 0
        after_h = ((after_bbox[3] - after_bbox[1]) / canvas[1] * 100) if after_bbox else 0
        record = {
            "sku": sku,
            "familyId": family_id,
            "capacityMl": capacity,
            "publishedPlateScale": scale,
            "sourceUrl": row["front"]["url"],
            "candidate": str(dest.relative_to(ROOT)),
            "before": {"midW": round(before_mid, 2), "fillH": round(before_h, 2), "bbox": before_bbox},
            "after": {"midW": round(after_mid, 2), "fillH": round(after_h, 2), "bbox": after_bbox},
            "targetMidBodyWidthPercent": target.get("midBodyWidthPercent"),
            "margins": {
                "L": round(after_bbox[0] / canvas[0] * 100, 2) if after_bbox else None,
                "T": round(after_bbox[1] / canvas[1] * 100, 2) if after_bbox else None,
                "R": round((canvas[0] - after_bbox[2]) / canvas[0] * 100, 2) if after_bbox else None,
                "B": round((canvas[1] - after_bbox[3]) / canvas[1] * 100, 2) if after_bbox else None,
            },
        }
        receipt.append(record)
        print(f"{sku}: midW {record['before']['midW']}% → {record['after']['midW']}%  fillH {record['before']['fillH']}% → {record['after']['fillH']}%")
    (out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    if receipt:
        thumb_w, thumb_h = 250, 275
        sheet = Image.new("RGB", (thumb_w * 2, thumb_h * len(receipt)), (245, 243, 239))
        for index, record in enumerate(receipt):
            before = Image.open(out / "source" / f"{record['sku']}.front-on.webp").convert("RGB").resize((thumb_w, thumb_h))
            after = Image.open(ROOT / record["candidate"]).convert("RGB").resize((thumb_w, thumb_h))
            sheet.paste(before, (0, index * thumb_h))
            sheet.paste(after, (thumb_w, index * thumb_h))
        sheet.save(out / "before-after-contact.webp", "WEBP", quality=90, method=6)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
