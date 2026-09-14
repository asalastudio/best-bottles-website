"""Crop renders to card aspect (families 4:5, collections 4:3), centred on content, base kept low; write webp + review sheet."""
import glob, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
BONE = np.array([245, 243, 239])
SPEC = {"families": ((4, 5), (1000, 1250)), "collections": ((4, 3), (1200, 900))}
rows = {}
for p in sorted(glob.glob("public/assets/cards/*.png")):
    name = os.path.basename(p)[:-4]; kind = name.split("-")[0]; slug = name[len(kind) + 1:]
    (aw, ah), (ow, oh) = SPEC[kind]
    im = Image.open(p).convert("RGB"); a = np.asarray(im).astype(int); H, W = a.shape[:2]
    bg = a[10:60, 10:60].reshape(-1, 3).mean(0)
    content = np.abs(a - bg).sum(axis=2) > 36
    ys, xs = np.where(content); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # window at target aspect: as large as fits, content centred horizontally, bottom margin ~5% below content
    ww, wh = W, W * ah / aw
    if wh > H: wh, ww = H, H * aw / ah
    cx = (x0 + x1) / 2; left = min(max(cx - ww / 2, 0), W - ww)
    top = min(max(y1 + 0.05 * wh - wh, 0), H - wh)
    # keep content inside
    if y0 < top: top = max(y0 - 0.04 * wh, 0)
    tile = im.crop((int(left), int(top), int(left + ww), int(top + wh))).resize((ow, oh), Image.LANCZOS)
    out = f"public/assets/cards/{'family' if kind == 'families' else 'collection'}-{slug}.webp"
    tile.save(out, "WEBP", quality=88)
    rows.setdefault(kind, []).append((slug, out, '#%02x%02x%02x' % tuple(int(v) for v in bg), round(100 * y0 / H), round(100 * y1 / H)))
    print(f"{kind:12} {slug:24} bg {'#%02x%02x%02x' % tuple(int(v) for v in bg)}  content y {round(100*y0/H)}–{round(100*y1/H)}%  -> {out} {os.path.getsize(out)//1024}KB")
# review sheet
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
except Exception: font = ImageFont.load_default()
def strip(items, h):
    cells = []
    for slug, out, bg, *_ in items:
        im = Image.open(out).convert("RGB"); im = im.resize((int(im.width * h / im.height), h))
        c = Image.new("RGB", (im.width, h + 22), "#FBFAF7"); c.paste(im, (0, 22)); ImageDraw.Draw(c).text((0, 2), f"{slug}  {bg}", fill="#1D1D1F", font=font); cells.append(c)
    r = Image.new("RGB", (sum(c.width for c in cells) + 12 * (len(cells) + 1), h + 22), "#FBFAF7"); x = 12
    for c in cells: r.paste(c, (x, 0)); x += c.width + 12
    return r
r1 = strip(rows["families"], 300); r2 = strip(rows["collections"], 240)
sheet = Image.new("RGB", (max(r1.width, r2.width), r1.height + r2.height + 30), "#FBFAF7"); sheet.paste(r1, (0, 8)); sheet.paste(r2, (0, r1.height + 22))
sheet.save("public/assets/cards/_review-sheet.jpg", quality=86); print("sheet", sheet.size)
