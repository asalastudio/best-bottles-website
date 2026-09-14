"""Collar alignment sheet: every closure frame cropped around the neck with a guide at the shoulder line and neck centre.
Usage: HERO_SET=v6 python3 scripts/hero-empire/collars.py"""
import os, json
from PIL import Image, ImageDraw, ImageFont
SET = os.environ.get("HERO_SET", "v6"); OUT = f"public/assets/hero/{SET}"
g = json.load(open(f"{OUT}/geometry.json")); b = g["body"]; cx = (b[0] + b[2]) // 2; shoulder = b[1] - 10
man = json.load(open(f"{OUT}/manifest.json")); frames = man["frames"] if isinstance(man, dict) else man
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
except Exception: font = ImageFont.load_default()
cells = []
for f in frames:
    if f["sku"] == "BARE": continue
    im = Image.open(f"{OUT}/frame-{f['sku']}.png").convert("RGB").crop((cx - 150, shoulder - 190, cx + 150, shoulder + 60)).resize((300, 250))
    d = ImageDraw.Draw(im); d.line((0, 190, 300, 190), fill="#C5A065", width=1); d.line((150, 0, 150, 250), fill=(197, 160, 101), width=1)
    c = Image.new("RGB", (300, 268), "#141210"); c.paste(im, (0, 0)); ImageDraw.Draw(c).text((3, 252), f["label"][:34], fill="#e8e2d6", font=font); cells.append(c)
cols, pad = 7, 6; rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 300 + (cols + 1) * pad, rows * 268 + (rows + 1) * pad), "#141210")
for i, c in enumerate(cells): sheet.paste(c, (pad + (i % cols) * (300 + pad), pad + (i // cols) * (268 + pad)))
sheet.save(f"{OUT}/_collars.jpg", quality=88); print("collar sheet", sheet.size, len(cells))
