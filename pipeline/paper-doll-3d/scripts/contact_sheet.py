#!/usr/bin/env python3
"""Render the all-bodies contact sheet - THE visual gate for a batch.

This is not decoration. Both numeric gates in this lane (the 0.5% dimension
check and the silhouette aspect check) can pass on a body that is visibly
wrong: a closure crop and a bottle-plus-sprayer composite both land on the
right proportions by coincidence. Two bodies covering 158 SKUs once rendered as
mushrooms on a stalk with every number green.

Look at the sheet before shipping a batch.

  blender --background --python scripts/verify_glb.py -- --glb glb/*.glb --out renders/verify
  python3 scripts/contact_sheet.py
"""
import argparse, csv, pathlib
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("--renders", default="renders/verify")
ap.add_argument("--bodies", default="bodies.csv")
ap.add_argument("--out", default="renders/all-bodies.png")
ap.add_argument("--cols", type=int, default=11)
a = ap.parse_args()

meta = {r["body_id"]: r for r in csv.DictReader(open(a.bodies))}
files = sorted(p for p in pathlib.Path(a.renders).glob("*.png") if p.stem in meta)
if not files:
    raise SystemExit(f"no renders in {a.renders} - run verify_glb.py first")

TH = 214
tiles = []
for p in files:
    m = meta[p.stem]
    im = Image.open(p).convert("RGB")
    f = (TH - 36) / im.height
    tiles.append((p.stem, m["shape_class"], m["sku_count"],
                  im.resize((max(1, int(im.width * f)), TH - 36), Image.LANCZOS)))

rows = (len(tiles) + a.cols - 1) // a.cols
cw = max(t[3].width for t in tiles) + 14
sheet = Image.new("RGB", (a.cols * cw + 16, rows * TH + 42), (250, 250, 250))
d = ImageDraw.Draw(sheet)
d.text((10, 10), f"Best Bottles - {len(tiles)} bottle bodies  |  round = lathe, "
                 f"boxy = extrude  |  one GLB per distinct piece of glass", fill=(25, 25, 25))
for i, (bid, shape, n, im) in enumerate(tiles):
    r, c = divmod(i, a.cols)
    x, y = 8 + c * cw, 32 + r * TH
    sheet.paste(im, (x + (cw - 14 - im.width) // 2, y))
    d.text((x, y + TH - 32), bid[:25], fill=(50, 50, 50))
    d.text((x, y + TH - 20), f"{shape} - {n} SKUs", fill=(125, 125, 125))
pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
sheet.save(a.out)
print(f"{len(tiles)} tiles -> {a.out}")
