#!/usr/bin/env python3
"""
Phase 3 approval sheet for the 17-415 Cylinder 9 mL pilot.

  python3 scripts/register/phase3/review_sheet.py

Reads data/register/phase3/pilot-measurements.json and the cut images, writes
output/register-phase3/pilot/review-plates.png and review-components.png.

Left of each pair: the assembly drawn ONLY from our measurements (plate anchors + layer anchors +
px/mm), which is exactly what the Phase 4 renderer will do. Right: the master CAPPED bottle photo at
the same scale, rim on rim. If the anchors are right, the two match.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont
from psd_tools import PSDImage

import cut_pilot as cp

ROOT = cp.ROOT
OUT = cp.OUT
DATA = json.loads(cp.MEASURE.read_text())
BONE = (245, 243, 239, 255)
INK, GOLD, BLUE, GREEN, GREY, RED = (28, 28, 30), (139, 111, 66), (60, 110, 170), (60, 130, 80), (150, 150, 150), (190, 50, 40)
SCALE = 6.0  # display px per mm


def font(size: int):
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


F, FS, FB = font(15), font(12), font(18)


def on_bone(img: Image.Image) -> Image.Image:
    """White-backed photo layers read as glass on bone: multiply RGB against the ground, keep alpha."""
    ground = Image.new("RGBA", img.size, BONE)
    rgb = ImageChops.multiply(img.convert("RGB"), ground.convert("RGB"))
    out = rgb.convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def scaled(img: Image.Image, px_per_mm: float) -> tuple[Image.Image, float]:
    f = SCALE / px_per_mm
    return img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS), f


CELL, RIM_AT = (260, 700), 200  # the whole bottle fits: 73.8 mm x 6 px/mm = 443 px of glass below the rim


def render(plate: dict, layers: list, size=CELL, rim_at=RIM_AT) -> Image.Image:
    """Plate + layers placed by anchors only. rim_at: where the seat lands on the cell."""
    cell = Image.new("RGBA", size, BONE)
    axis_c = size[0] / 2
    pimg, pf = scaled(Image.open(OUT / plate["file"]).convert("RGBA"), plate["pxPerMm"])
    px0 = round(axis_c - plate["anchors"]["axisX"] * pf)
    py0 = round(rim_at - plate["anchors"]["seatY"] * pf)
    def put(img, x, y):
        sheet = Image.new("RGBA", size, (0, 0, 0, 0))
        sheet.paste(img, (x, y))
        return sheet
    behind = [l for l in layers if l["z"] == "behind-body"]
    front = [l for l in layers if l["z"] != "behind-body"]
    for layer in behind + [None] + sorted(front, key=lambda l: -l["explodeIndex"]):
        if layer is None:
            cell = Image.alpha_composite(cell, put(on_bone(pimg), px0, py0))
            continue
        limg, lf = scaled(Image.open(OUT / layer["file"]).convert("RGBA"), layer["pxPerMm"])
        x = round(axis_c - layer["anchor"]["x"] * lf)
        y = round(rim_at - layer["anchor"]["y"] * lf)
        cell = Image.alpha_composite(cell, put(on_bone(limg), x, y))
    return cell


def reference(entry: dict, size=CELL, rim_at=RIM_AT) -> Image.Image:
    ref = entry["reference"]
    psd = PSDImage.open(Path(DATA["psdRoot"]) / ref["psd"])
    layers = cp.pixel_layers(psd)
    if entry["type"] == "roller-insert":  # show the insert as it sits, cap off: the body plus the insert layers only
        keep = set(ref["matchedLayers"])
        layers = [l for l in layers if l.name in keep or (l.bbox[3] - l.bbox[1]) > 0.5 * psd.height]
    img = cp.canvas_of(psd, layers)
    rimg, f = scaled(img, ref["bottlePxPerMm"])
    cell = Image.new("RGBA", size, BONE)
    sheet = Image.new("RGBA", size, (0, 0, 0, 0))
    sheet.paste(on_bone(rimg), (round(size[0] / 2 - ref["axisX"] * f), round(rim_at - ref["rimY"] * f)))
    return Image.alpha_composite(cell, sheet)


def plates_sheet():
    plates = DATA["plates"]
    w, h, top = 250, 620, 70
    sheet = Image.new("RGBA", (w * len(plates) + 40, h + 150), BONE)
    d = ImageDraw.Draw(sheet)
    d.text((20, 14), "Body plates: 17-415 Cylinder 9 mL, every glass the same height. Lines: axis, seat (rim), shoulder, foot. Scale 6 px/mm, feet aligned.", fill=INK, font=FB)
    for i, p in enumerate(plates):
        img, f = scaled(Image.open(OUT / p["file"]).convert("RGBA"), p["pxPerMm"])
        x0 = 20 + i * w + (w - img.width) // 2
        y0 = top + h - 40 - img.height
        sheet.alpha_composite(on_bone(img), (x0, y0))
        a = p["anchors"]
        ax, seat, sh, foot = x0 + a["axisX"] * f, y0 + a["seatY"] * f, y0 + a["shoulderY"] * f, y0 + a["baselineY"] * f
        d.line([(ax, seat - 20), (ax, foot + 10)], fill=GREY, width=1)
        for y, col, label in ((seat, GOLD, "seat"), (sh, BLUE, "shoulder"), (foot, GREEN, "foot")):
            d.line([(x0 - 14, y), (x0 + img.width + 14, y)], fill=col, width=2)
            d.text((x0 + img.width + 16, y - 7), label, fill=col, font=FS)
        c = p["checks"]
        ok = "PASS" if c["passes"] else "FLAG"
        d.text((20 + i * w, top + h - 20), f"{p['glass']}", fill=INK, font=FB)
        d.text((20 + i * w, top + h + 4), f"{p['pxPerMm']:.3f} px/mm  ·  {p['width']}×{p['height']} px", fill=INK, font=FS)
        d.text((20 + i * w, top + h + 22), f"width {c['diameterMm']:.1f} mm vs {DATA['scaleBasis']['fitDiameterMm']:.1f}", fill=INK, font=FS)
        d.text((20 + i * w, top + h + 40), f"{c['widthErrorPct']:+.1f}%  {ok}" + ("  accepted" if not c["passes"] and c.get("acceptedBy") else ""), fill=GREEN if c["passes"] else RED, font=F)
    out = OUT / "review-plates.png"
    sheet.convert("RGB").save(out, optimize=True)
    return out


def components_sheet():
    clear = next(p for p in DATA["plates"] if p["glass"] == "Clear")
    entries = [e for e in DATA["components"] if e.get("reference")]
    cols, cw, ch = 4, 560, CELL[1] + 60
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw + 20, rows * ch + 60), BONE)
    d = ImageDraw.Draw(sheet)
    d.text((20, 14), "Components on the clear plate. Left: drawn from our anchors only. Right: master capped photo, rim on rim (inserts: cap removed). Scale 6 px/mm.", fill=INK, font=FB)
    for i, e in enumerate(entries):
        x, y = 20 + (i % cols) * cw, 50 + (i // cols) * ch
        ours = render(clear, e["layers"])
        ref = reference(e)
        sheet.alpha_composite(ours, (x, y))
        sheet.alpha_composite(ref, (x + 270, y))
        dd = ImageDraw.Draw(sheet)
        dd.line([(x, y + RIM_AT), (x + 530, y + RIM_AT)], fill=GOLD, width=1)
        iou = e["checks"].get("registrationIoU")
        tag = f"IoU {iou:.3f}" if iou is not None else ("clipped at rim" if e["checks"].get("clippedAtRim") else "whole layer")
        flag = iou is not None and iou < 0.95
        dd.text((x, y + CELL[1] + 8), e["componentId"], fill=INK, font=F)
        dd.text((x, y + CELL[1] + 28), f"{e['type']} · {tag} · {', '.join(l['slot'] for l in e['layers'])}", fill=RED if flag else INK, font=FS)
    out = OUT / "review-components.png"
    sheet.convert("RGB").save(out, optimize=True)
    return out


if __name__ == "__main__":
    print(plates_sheet())
    print(components_sheet())
