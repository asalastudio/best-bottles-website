#!/usr/bin/env python3
"""Same-zoom before/after of the Empire sprayer kits, drawn the way Build Your Bottle draws them.

BuilderImage.tsx: with the cover off, a kit that has BOTH an `overcap` part and a mechanism
stands the overcap on the baseline beside the glass (gap = max(18, 8 % of body width)).
Clear glass AND a part in the `diptube` slot multiply into the stage colour. This sheet applies exactly that rule to the
kit as published today and to the rebuilt kit, so the difference shown is the kit's.

    python3 scripts/paperdoll/empire_pump_kits_sheet.py --batch dist/paper-doll/empire-pumps-2026-09-20
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/bottle-builder-pilot"))
from empire_library_pumps import CANVAS, STAGE, kit_for  # noqa: E402


def draw(kits: Path, row: dict, cover_on: bool) -> Image.Image:
    parts = sorted(row["parts"], key=lambda p: p["zOrder"])
    body = next(p for p in parts if p["slot"] == "body")
    white = Image.new("RGB", CANVAS, "white")
    glass = Image.open(kits / body["image"]).convert("RGBA"); white.paste(glass, (0, 0), glass)
    out = ImageChops.multiply(Image.new("RGB", CANVAS, STAGE), white).convert("RGBA")
    sidecar = (not cover_on and any(p["slot"] == "overcap" for p in parts)
               and any(p["slot"] not in ("body", "overcap", "diptube") for p in parts))
    for p in parts:
        if p["slot"] == "body":
            continue
        im = Image.open(kits / p["image"]).convert("RGBA")
        if p["slot"] == "diptube":
            # BuilderImage.tsx multiplies `diptube` on clear glass exactly as it does the body. A tube
            # filed under any other slot name is drawn opaque — which is what the 50 ml kits did.
            white = Image.new("RGB", CANVAS, "white"); white.paste(im, (0, 0), im)
            out = ImageChops.multiply(out.convert("RGB"), white).convert("RGBA")
            continue
        if p["slot"] == "overcap" and sidecar:
            b, bb = p["bounds"], body["bounds"]
            gap = max(18, (bb["right"] - bb["left"]) * .08)
            im = ImageChops.offset(im, round(bb["right"] + gap - b["left"]), round(row["anchors"]["baselineY"] - b["bottom"]))
        out.alpha_composite(im)
    return out.convert("RGB")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--batch", type=Path, required=True); ap.add_argument("--name", default="pump-kits"); args = ap.parse_args()
    new_kits = ROOT / args.batch / "kits"
    rows = sorted(json.loads((new_kits / "manifest.json").read_text())["rows"], key=lambda r: (r["familyId"], r["sku"]))
    box, cw = (250, 0, 1000, 1100), 250
    ch = round(cw * (box[3] - box[1]) / (box[2] - box[0]))
    cols = [("BEFORE  cover off", "#b00"), ("AFTER  cover off", "#060"), ("AFTER  cover on (= plate)", "#555")]
    cell_w, cell_h, per_row = len(cols) * (cw + 4) + 22, ch + 96, 2
    for size in ("50ml", "100ml"):
        group = [r for r in rows if f"-{size}-" in r["familyId"]]
        sheet = Image.new("RGB", (per_row * cell_w + 14, ((len(group) + per_row - 1) // per_row) * cell_h), "white"); d = ImageDraw.Draw(sheet)
        for i, row in enumerate(group):
            old_batch, old, _ = kit_for(row["sku"])
            x, y = 14 + (i % per_row) * cell_w, (i // per_row) * cell_h
            d.text((x, y + 8), f"{row['sku']}   ({row['applicator']})", fill="#111")
            for j, (im, (label, colour)) in enumerate(zip([draw(old_batch / "kits", old, False), draw(new_kits, row, False), draw(new_kits, row, True)], cols)):
                d.text((x + j * (cw + 4), y + 28), label, fill=colour)
                sheet.paste(im.crop(box).resize((cw, ch), Image.Resampling.LANCZOS), (x + j * (cw + 4), y + 44))
            pv = row["pumpProvenance"]
            d.text((x, y + 48 + ch), "parts before: " + ", ".join(f"{k} {v[0]}x{v[1]}" for k, v in pv["labelsBefore"].items()), fill="#b00")
            d.text((x, y + 62 + ch), "parts after:  " + ", ".join(f"{p['slot']} {p['bounds']['right']-p['bounds']['left']}x{p['bounds']['bottom']-p['bounds']['top']}" for p in row["parts"] if p["slot"] != "body")
                   + f"   parity {row['gates']['parity']['mean']:.2f}", fill="#060")
            d.text((x, y + 76 + ch), pv["pump"] + (f" (x{pv['scale']})" if "scale" in pv else ""), fill="#777")
        out = ROOT / f"public/reviews/builder-review-2026-09-19/empire{size[:-2]}-{args.name}-before-after.jpg"
        sheet.save(out, quality=90); print(out.relative_to(ROOT), sheet.size)


if __name__ == "__main__":
    main()
