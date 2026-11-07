#!/usr/bin/env python3
"""Contact sheet for data/catalog-corrections/2026-10-17-dead-pdp-images/plan.json.

One card per SKU, in page order: the old site's photo of that SKU (identity reference only), and the
plate the plan writes into products.imageUrl. Held SKUs show the reference beside an empty slot.
Images are downloaded as-is and only scaled to fit; nothing is retouched or generated.

    python3 scripts/catalog-corrections/2026-10-17-dead-pdp-images-sheet.py <cache-dir>
"""
import json, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "data", "catalog-corrections", "2026-10-17-dead-pdp-images")
CACHE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dead-pdp-images-cache"
os.makedirs(CACHE, exist_ok=True)
plan = json.load(open(os.path.join(DIR, "plan.json")))

def font(size, bold=False):
    path = "/System/Library/Fonts/HelveticaNeue.ttc"
    try: return ImageFont.truetype(path, size, index=1 if bold else 0)
    except OSError: return ImageFont.load_default()

def fetch(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f: f.write(r.read())
    return Image.open(path).convert("RGBA")

def fit(im, w, h):
    im = im.copy(); im.thumbnail((w, h), Image.LANCZOS)
    tile = Image.new("RGB", (w, h), "white"); tile.paste(im, ((w - im.width) // 2, (h - im.height) // 2), im)
    return tile

COLS, PW, PH, HEAD, GAP = 5, 240, 264, 74, 14
CW, CH = PW * 2 + 18, HEAD + PH + 30
cards = [("write", e) for e in plan["entries"]] + [("held", h) for h in plan["held"]]
order = {p["slug"]: i for i, p in enumerate(plan["pages"])}
cards.sort(key=lambda c: (order[c[1]["page"]], not c[1]["pageDefault"], c[1]["websiteSku"]))
rows = -(-len(cards) // COLS)
TOP = 120
sheet = Image.new("RGB", (GAP + COLS * (CW + GAP), TOP + rows * (CH + GAP) + GAP), (238, 233, 224))
d = ImageDraw.Draw(sheet)
d.text((GAP, 18), "Dead product images: proposed replacements (production, 17 Oct 2026)", fill="black", font=font(30, True))
d.text((GAP, 60), f"{len(plan['entries'])} SKUs get their own plate in products.imageUrl; {len(plan['held'])} held.  "
       "Left: the old bestbottles.com photo of the same SKU, for identity only.  Right: the plate that will be written.  "
       "Red tab = the variant the page shows first.", fill=(60, 60, 60), font=font(19))

for i, (kind, c) in enumerate(cards):
    x, y = GAP + (i % COLS) * (CW + GAP), TOP + (i // COLS) * (CH + GAP)
    d.rectangle([x, y, x + CW, y + CH], fill="white", outline=(200, 194, 182))
    if c["pageDefault"]:
        d.rectangle([x, y, x + 8, y + CH], fill=(196, 40, 40))
    d.text((x + 16, y + 8), c["websiteSku"], fill="black", font=font(20, True))
    d.text((x + 16, y + 34), c["page"][:58], fill=(90, 90, 90), font=font(14))
    old = (c["expect"]["imageUrl"] if kind == "write" else c["imageUrl"]).split("/files/")[-1].split("?")[0]
    d.text((x + 16, y + 52), f"404  {old[:56]}", fill=(196, 40, 40), font=font(13))
    ref = c["identityReference"] if kind == "write" else c["checked"]["legacy"]
    py = y + HEAD
    if ref:
        sheet.paste(fit(fetch(ref, f"{c['websiteSku']}.legacy"), PW, PH), (x + 6, py))
    else:
        d.text((x + 60, py + PH // 2), "no old-site photo", fill=(150, 150, 150), font=font(15))
    if kind == "write":
        sheet.paste(fit(fetch(c["patch"]["imageUrl"], f"{c['websiteSku']}.plate.webp"), PW, PH), (x + PW + 12, py))
        d.text((x + 10, y + CH - 24), "old site (reference)", fill=(120, 120, 120), font=font(13))
        d.text((x + PW + 16, y + CH - 24), f"plate · {c['source']['familyId'][:30]}", fill=(30, 110, 60), font=font(13, True))
    else:
        d.rectangle([x + PW + 12, py, x + 2 * PW + 12, py + PH], fill=(250, 240, 240), outline=(196, 40, 40))
        d.text((x + PW + 40, py + PH // 2 - 20), "HELD: no plate, kit", fill=(196, 40, 40), font=font(16, True))
        d.text((x + PW + 40, py + PH // 2 + 2), "or Shopify media", fill=(196, 40, 40), font=font(16, True))
        d.text((x + 10, y + CH - 24), "old site (reference)", fill=(120, 120, 120), font=font(13))

out = os.path.join(DIR, "contact-sheet.jpg")
sheet.save(out, quality=86, optimize=True)
print(out, sheet.size, f"{os.path.getsize(out) // 1024} KB")
