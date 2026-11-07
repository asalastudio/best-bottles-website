#!/usr/bin/env python3
"""Contact sheet for data/catalog-corrections/2026-10-18-white-box-plates/plan.json.

One card per SKU: LIVE is the plate production serves today, PROPOSED the plate the plan writes, each drawn the
way the product page's stage draws a fallback photo (pearl #f6f4f3 canvas, image contained inside a 24/24/48 px
inset). Held pages show their live kit and the reason. A red tab marks the variant a page shows when it opens.
Images are only scaled to fit; nothing is retouched or generated.

    python3 scripts/catalog-corrections/2026-10-18-white-box-plates-sheet.py --snapshot DIR [--cache DIR]
    (DIR holds productKits.jsonl from `npx convex data productKits --prod --format jsonl --limit 8000`)
"""
import argparse
import hashlib
import io
import json
import os
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
DIR = REPO / "data" / "catalog-corrections" / "2026-10-18-white-box-plates"
PEARL = (246, 244, 243)
TILE_W, TILE_H = 300, 324          # the stage at 0.6 scale: 500 x 540
INSET = (14, 14, 14, 29)           # left, top, right, bottom: the stage's 24/24/48 px at the same scale
HEAD, GAP, PAD = 92, 14, 22


def font(size, bold=False):
    try:
        return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size, index=1 if bold else 0)
    except OSError:
        return ImageFont.load_default()


def fetch(cache: Path, url: str, sha256: str | None = None) -> Image.Image:
    path = cache / hashlib.sha256(url.encode()).hexdigest()[:24]
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    if sha256 and hashlib.sha256(data).hexdigest() != sha256:
        raise SystemExit(f"{url} no longer hashes to {sha256[:12]}")
    return Image.open(io.BytesIO(data)).convert("RGBA")


def stage(image: Image.Image | None, layers: list[Image.Image] | None = None) -> Image.Image:
    tile = Image.new("RGBA", (TILE_W, TILE_H), PEARL + (255,))
    if layers:   # a kit: its parts share one 1000x1100 canvas, contained in the whole stage
        canvas = Image.new("RGBA", layers[0].size, (0, 0, 0, 0))
        for layer in layers:
            canvas.alpha_composite(layer)
        image = canvas
        box = (0, 0, TILE_W, TILE_H)
    else:
        box = (INSET[0], INSET[1], TILE_W - INSET[2], TILE_H - INSET[3])
    if image is not None:
        fitted = image.copy()
        fitted.thumbnail((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
        x = box[0] + (box[2] - box[0] - fitted.width) // 2
        y = box[1] + (box[3] - box[1] - fitted.height) // 2
        tile.alpha_composite(fitted, (x, y))
    return tile.convert("RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/white-box-plates-cache"))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    plan = json.loads((DIR / "plan.json").read_text())
    kits = {}
    for line in (args.snapshot / "productKits.jsonl").read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            kits[row["sku"]] = row

    cards = []
    for entry in plan["entries"]:
        live = stage(fetch(args.cache, entry["expectFront"]["url"], entry["expectFront"]["sha256"]))
        proposed_bytes = (REPO / entry["file"]).read_bytes()
        if hashlib.sha256(proposed_bytes).hexdigest() != entry["front"]["sha256"]:
            raise SystemExit(f"{entry['file']} does not hash to the plan's sha256")
        proposed = stage(Image.open(io.BytesIO(proposed_bytes)).convert("RGBA"))
        source = entry["source"]
        if source["method"] == "psd-cutout":
            detail = f"master PSD {source['psdSha256'][:12]} (the live plate's source), white dropped; on white = live ±{source['registration']['residualVsLivePlate']}/255"
        else:
            detail = f"catalogue card's bone hero {Path(source['file']).name}, {source['ledger']}"
        cards.append({"title": entry["sku"], "page": entry["page"], "first": entry["pageShowsFirst"],
                      "method": "transparent plate" if entry["transparent"] else "bone-background plate",
                      "detail": detail, "left": live, "right": proposed, "held": None})
    for held in plan["held"]:
        for sku in held["skus"][:1]:   # the variant the page opens on
            kit = kits[sku]
            layers = [fetch(args.cache, part["image"]["url"], part["image"]["sha256"]) for part in sorted(kit["parts"], key=lambda p: p["zOrder"])]
            cards.append({"title": " / ".join(held["skus"]), "page": f"/products/{held['page']}", "first": True,
                          "method": "HELD", "detail": f"{held['record']}: master glass layer is opaque (alpha 255)",
                          "left": stage(None, layers), "right": None, "held": held["reason"]})

    cols = 2
    card_w = TILE_W * 2 + GAP * 3
    card_h = HEAD + TILE_H + GAP
    rows = (len(cards) + cols - 1) // cols
    sheet_w = PAD * 2 + cols * card_w + (cols - 1) * GAP
    title_h = 96
    sheet = Image.new("RGB", (sheet_w, title_h + PAD + rows * (card_h + GAP)), (226, 222, 218))
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 22), "White-box product stages · productPlates.front · LIVE (today) vs PROPOSED", fill=(28, 28, 30), font=font(28, True))
    draw.text((PAD, 60), "Each tile is drawn as the product page's stage draws a fallback photo: pearl canvas, 24/24/48 px inset. Red tab = the variant the page opens on.",
              fill=(77, 87, 103), font=font(17))
    for i, card in enumerate(cards):
        x = PAD + (i % cols) * (card_w + GAP)
        y = title_h + PAD + (i // cols) * (card_h + GAP)
        draw.rectangle((x, y, x + card_w - 1, y + card_h - 1), fill=(255, 255, 255))
        if card["first"]:
            draw.rectangle((x, y, x + 6, y + HEAD - 10), fill=(196, 30, 58))
        draw.text((x + 18, y + 10), card["title"], fill=(28, 28, 30), font=font(20, True))
        draw.text((x + 18, y + 36), f"{card['page']}   ·   {card['method']}", fill=(93, 107, 126), font=font(15))
        detail = card["detail"]
        while draw.textlength(detail, font=font(12)) > card_w - 30:
            detail = detail[:-2].rstrip() + "…"
        draw.text((x + 18, y + 58), detail, fill=(93, 107, 126), font=font(12))
        tx, ty = x + GAP, y + HEAD
        sheet.paste(card["left"], (tx, ty))
        draw.text((tx + 8, ty + 6), "LIVE", fill=(154, 122, 72), font=font(13, True))
        rx = tx + TILE_W + GAP
        if card["right"] is not None:
            sheet.paste(card["right"], (rx, ty))
            draw.text((rx + 8, ty + 6), "PROPOSED", fill=(79, 138, 91), font=font(13, True))
        else:
            draw.rectangle((rx, ty, rx + TILE_W - 1, ty + TILE_H - 1), fill=(250, 246, 240), outline=(196, 30, 58))
            words, line, lines = card["held"].split(), "", []
            for word in words:
                if draw.textlength(f"{line} {word}", font=font(13)) > TILE_W - 24:
                    lines.append(line)
                    line = word
                else:
                    line = f"{line} {word}".strip()
            lines.append(line)
            draw.text((rx + 12, ty + 10), "HELD: no transparent source", fill=(196, 30, 58), font=font(14, True))
            for n, text in enumerate(lines[:17]):
                draw.text((rx + 12, ty + 34 + n * 17), text, fill=(28, 28, 30), font=font(13))
    out = DIR / "contact-sheet.jpg"
    sheet.save(out, quality=86, optimize=True)
    print(f"wrote {out.relative_to(REPO)} ({out.stat().st_size // 1024} KB, {len(cards)} cards)")


if __name__ == "__main__":
    main()
