#!/usr/bin/env python3
"""Same-zoom before/after of dropper kits, drawn with Build Your Bottle's blend rules: clear glass,
dip tube and pipette multiply into the stage; everything else is drawn as it is. A SKU that serves
no kit today shows what the builder falls back to — the product photograph on its white ground.

    python3 scripts/paperdoll/dropper_kits_sheet.py --batch dist/paper-doll/empire-droppers-2026-09-20 \
        --before dist/paper-doll/empire-2026-09-16 --plates dist/paper-doll/empire-waived-2026-09-20 --out public/reviews/.../x.jpg
"""
import argparse, json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
ROOT = Path(__file__).resolve().parents[2]; STAGE = (238, 235, 229); CANVAS = (1000, 1100)

def draw(kits, row):
    out = Image.new("RGB", CANVAS, STAGE)
    for p in sorted(row["parts"], key=lambda p: p["zOrder"]):
        im = Image.open(kits / p["image"]).convert("RGBA")
        if p["slot"] in ("body", "diptube", "pipette"):
            white = Image.new("RGB", CANVAS, "white"); white.paste(im, (0, 0), im); out = ImageChops.multiply(out, white)
        else:
            out.paste(im, (0, 0), im)
    return out

ap = argparse.ArgumentParser(); ap.add_argument("--batch", type=Path, required=True); ap.add_argument("--before", type=Path, required=True)
ap.add_argument("--plates", type=Path, required=True); ap.add_argument("--out", type=Path, required=True); a = ap.parse_args()
new = ROOT / a.batch / "kits"; rows = json.loads((new / "manifest.json").read_text())["rows"]
old = {r["sku"]: r for r in json.loads((ROOT / a.before / "kits/manifest.json").read_text())["rows"] if r.get("parts") and r["status"] == "candidate"}
plates = {p["websiteSku"]: ROOT / a.plates / "plates" / p["plate"]["key"] for p in json.loads((ROOT / a.plates / "plates/manifest.json").read_text())["rows"]}
box, cw, ch = (250, 0, 750, 1100), 300, 660
sheet = Image.new("RGB", (len(rows) * (2 * cw + 30) + 10, ch + 70), "white"); d = ImageDraw.Draw(sheet)
for i, r in enumerate(rows):
    x = 10 + i * (2 * cw + 30); d.text((x, 6), r["sku"], fill="#111")
    if r["sku"] in old:
        before, label = draw(ROOT / a.before / "kits", old[r["sku"]]), "BEFORE  one fused opaque part"
    else:
        before, label = Image.open(plates[r["sku"]]).convert("RGB"), "BEFORE  no kit served: product photo on white"
    for j, (im, l, c) in enumerate([(before, label, "#b00"), (draw(new, r), "AFTER  pipette blends into the glass", "#060")]):
        d.text((x + j * (cw + 6), 24), l, fill=c); sheet.paste(im.crop(box).resize((cw, ch)), (x + j * (cw + 6), 40))
    adj = r.get("pipetteProvenance", {}).get("psdAdjustmentApplied")
    d.text((x, ch + 46), f"parity {r['gates']['parity']['mean']:.2f} (standard gate)" + (f" · PSD '{adj['layer']}' applied" if adj else ""), fill="#777")
sheet.save(ROOT / a.out, quality=92); print(a.out, sheet.size)
