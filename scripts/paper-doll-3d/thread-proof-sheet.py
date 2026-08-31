#!/usr/bin/env python3
"""BEST BOTTLES — thread-standard family proof sheet.

Composes the clay-gate renders (THREAD-STANDARD.md protocol) into one grid:
one row per bottle, one column per view, plus an optional drawing-crop
column so every neck sits next to its governing sheet detail.

    python3 thread-proof-sheet.py --renders <dir> --out <png> \
        [--crops <dir>] [--specs 005 009 ...]

Expects <renders>/<spec>-<view>.png for views front/macro/threequarter/
section (missing cells render as labeled gaps, never errors) and optional
<crops>/<spec>-drawing.png sheet crops.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SPECS = ["005", "009", "009_tall", "circle15", "circle30", "circle50",
         "circle100"]
VIEWS = ["front", "macro", "threequarter", "section"]
LABELS = {"005": "5 mL — 13/415", "009": "9 mL — 17/415",
          "009_tall": "9 mL tall — 13/415", "circle15": "Circle 15 — 13/415",
          "circle30": "Circle 30 — 15/415", "circle50": "Circle 50 — 18/415",
          "circle100": "Circle 100 — 18/415"}
CELL_H = 420
GAP = 8
HEAD = 104
ROWLBL = 46


def font(size):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except Exception:
        return ImageFont.load_default()


def cell(path, w, h):
    tile = Image.new("RGB", (w, h), "#242424")
    if path.exists():
        im = Image.open(path).convert("RGB")
        scale = min(w / im.width, h / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)),
                       Image.LANCZOS)
        tile.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    else:
        d = ImageDraw.Draw(tile)
        d.text((14, h // 2 - 12), "— not rendered —", font=font(22),
               fill="#777777")
    return tile


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--renders", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--crops", type=Path, default=None,
                   help="dir of <spec>-drawing.png sheet crops")
    p.add_argument("--specs", nargs="*", default=SPECS)
    a = p.parse_args()

    cols = VIEWS + (["drawing"] if a.crops else [])
    cw = round(CELL_H * 2080 / 2288)          # master aspect
    W = len(cols) * (cw + GAP) - GAP
    H = HEAD + len(a.specs) * (CELL_H + ROWLBL + GAP)
    sheet = Image.new("RGB", (W, H), "#1B1B1B")
    d = ImageDraw.Draw(sheet)
    d.text((16, 12), "THREAD STANDARD — GCMI 415 · 8 TPI · clay gate",
           font=font(34), fill="#EFE9DE")
    d.text((16, 50), "pitch 3.175 · turns = band/pitch · raised-cosine lens "
           "2.48 mm · form judged in clay (THREAD-STANDARD.md)",
           font=font(20), fill="#9C9C94")
    for i, v in enumerate(cols):
        d.text((i * (cw + GAP) + 10, HEAD - 26), v.upper(),
               font=font(20), fill="#9C9C94")

    y = HEAD
    for spec in a.specs:
        d.text((16, y + 10), LABELS.get(spec, spec), font=font(28),
               fill="#EFE9DE")
        y += ROWLBL
        for i, v in enumerate(cols):
            src = (a.crops / f"{spec}-drawing.png" if v == "drawing"
                   else a.renders / f"{spec}-{v}.png")
            sheet.paste(cell(src, cw, CELL_H), (i * (cw + GAP), y))
        y += CELL_H + GAP

    a.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.out)
    print(f"PROOF_SHEET {a.out}")


main()
