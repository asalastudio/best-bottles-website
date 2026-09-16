"""One product on the real 10:11 product card (1560 x 1716), read against the scale card.
Left: the card at large size with the scale card laid over it. Right: the product card today vs on the scale card.

    python3 card_example.py [snapshot dir]   -> <snapshot dir>/scale-card/scale-card-example.jpg
The example product and its measurements are in ../references/approved-sizes-2026-09-16.json (exampleProduct).
"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bottle_bodies import default_snapshot, repo_root
from scale_card import glass_pct
REPO = repo_root()
REF = json.load(open(os.path.join(os.path.dirname(HERE), "references", "approved-sizes-2026-09-16.json")))
EX = REF["exampleProduct"]; SKU = EX["sku"]; MM = float(EX["glassMm"])
HEL = "/System/Library/Fonts/Helvetica.ttc"
MONT = next(iter(glob.glob(os.path.expanduser("~/Library/Fonts/Montserrat*.ttf")) + glob.glob("/Library/Fonts/Montserrat*.ttf")), None)
def hel(sz, b=False): return ImageFont.truetype(HEL, sz, index=1 if b else 0)
def mont(sz, weight=500):
    if not MONT:
        return hel(sz, weight >= 600)
    f = ImageFont.truetype(MONT, sz)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f
BONE = np.array((245.0, 243.0, 239.0))
def extent(a):
    m = np.abs(a - BONE).max(axis=2) > 40
    from scipy import ndimage
    m = ndimage.binary_opening(m, structure=np.ones((5, 5))); m[1562 - 6:, :] = False
    rows = np.where(m.sum(axis=1) >= 3)[0]; cols = np.where(m.sum(axis=0) >= 3)[0]
    return int(rows.min()), int(cols.min()), int(cols.max())
def resize_about_foot(img, f, cx, CW=1560, CH=1716, BASE=1562, CX=780, FEATHER=48):
    big = img.resize((round(CW * f), round(CH * f)), Image.LANCZOS)
    canvas = Image.new("RGB", (CW, CH), (245, 243, 239)); canvas.paste(big, (round(CX - cx * f), round(BASE - BASE * f)))
    a = np.asarray(canvas).astype(np.float64); yy, xx = np.mgrid[0:CH, 0:CW]
    dd = np.minimum(np.minimum(yy, CH - 1 - yy), np.minimum(xx, CW - 1 - xx)).astype(np.float64)
    w = np.clip(dd / FEATHER, 0, 1)[..., None]
    return Image.fromarray(np.round(a * w + BONE * (1 - w)).astype(np.uint8))
INK=(28,30,29); MUTED=(112,117,113); RED=(190,60,40); BLUE=(30,104,160); LINE=(214,196,160); BG=(253,251,247); CARDBG=(255,253,249)
CW, CH, BASE = 1560, 1716, 1562

SNAP = sys.argv[1] if len(sys.argv) > 1 else default_snapshot()
OUT = os.path.join(SNAP, "scale-card"); os.makedirs(OUT, exist_ok=True)
reg = {h["websiteSku"]: h for h in json.load(open(f"{REPO}/src/lib/products/catalog-heroes.json"))}
today_full = EX["shoulderPercentNow"] * EX["rimOverShoulder"]          # glass foot-to-rim today, % of card
target = glass_pct(MM); k = target / today_full
today = Image.open(f"{REPO}/public{reg[SKU]['url']}").convert("RGB")
a = np.asarray(today).astype(np.float64); top, x0, x1 = extent(a)
card = resize_about_foot(today, k, (x0 + x1) / 2)
card.save(os.path.join(OUT, f"example-{SKU}-S{int(round(MM / 10) * 10)}.png"))
rim_y = BASE - target / 100 * CH
b = np.asarray(card).astype(np.float64); fit_top, _, _ = extent(b)

W, H = 2760, 1640
out = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(out)
d.text((90, 60), "The scale card on a real product card", font=hel(64, True), fill=INK)
d.text((90, 142), "9 ml Clear Cylinder Roll-On  ·  bare glass 70 mm  ·  tag S70  ·  glass stands 47.8 % of the card", font=hel(34), fill=MUTED)

# ---- left: the 10:11 card, large, with the scale card over it
sc = 0.74; cx0, cy0 = 90, 250; cw, chh = round(CW * sc), round(CH * sc)
out.paste(card.resize((cw, chh), Image.LANCZOS), (cx0, cy0))
d.rectangle([cx0, cy0, cx0 + cw - 1, cy0 + chh - 1], outline=LINE, width=2)
Y = lambda y: cy0 + y * sc
# tag ticks along the right edge
for t in (40, 50, 60, 70, 80, 90, 100, 120, 150):
    y = Y(BASE - glass_pct(t) / 100 * CH)
    is_this = t == 70
    d.line([(cx0 + cw - (160 if is_this else 60), y), (cx0 + cw - 1, y)], fill=RED if is_this else (196, 188, 176), width=4 if is_this else 2)
    lab = f"S{t}  {glass_pct(t):.1f} %"
    d.text((cx0 + cw + 14, y - 15), lab, font=hel(26, is_this), fill=RED if is_this else MUTED)
# baseline, glass top, fitment
d.line([(cx0, Y(BASE)), (cx0 + cw, Y(BASE))], fill=INK, width=3)
d.text((cx0 + cw + 14, Y(BASE) - 15), "foot · 91 %", font=hel(26, True), fill=INK)
d.line([(cx0 + 40, Y(rim_y)), (cx0 + cw - 160, Y(rim_y))], fill=RED, width=3)
bx = cx0 + 250
d.line([(bx, Y(rim_y)), (bx, Y(BASE))], fill=RED, width=3)
for yy in (rim_y, BASE):
    d.line([(bx - 14, Y(yy)), (bx + 14, Y(yy))], fill=RED, width=3)
d.text((bx - 220, (Y(rim_y) + Y(BASE)) / 2 - 60), "bare glass", font=hel(30, True), fill=RED)
d.text((bx - 220, (Y(rim_y) + Y(BASE)) / 2 - 22), "70 mm", font=hel(30), fill=RED)
d.text((bx - 220, (Y(rim_y) + Y(BASE)) / 2 + 16), "= 47.8 %", font=hel(30), fill=RED)
d.text((bx - 220, (Y(rim_y) + Y(BASE)) / 2 + 54), "= 820 px", font=hel(30), fill=RED)
fx = cx0 + 250
d.line([(fx, Y(fit_top)), (fx, Y(rim_y) - 6)], fill=BLUE, width=3)
d.line([(fx - 14, Y(fit_top)), (fx + 14, Y(fit_top))], fill=BLUE, width=3)
d.text((fx - 220, Y(fit_top) - 118), "roller rides", font=hel(28, True), fill=BLUE)
d.text((fx - 220, Y(fit_top) - 84), "on top at", font=hel(28), fill=BLUE)
d.text((fx - 220, Y(fit_top) - 50), "true size", font=hel(28), fill=BLUE)
d.text((cx0, cy0 + chh + 18), "1560 × 1716 product image (10 : 11). Red = where the tag puts the top of the glass.", font=hel(26), fill=MUTED)

# ---- right: the product card on the site, today vs on the scale card
rx = cx0 + cw + 330; ry = 250
d.text((rx, ry - 6), "On the site", font=hel(40, True), fill=INK)
iw = 540; ih = round(iw * CH / CW)
for i, (img, label, sub, col) in enumerate(((today, "Today", f"glass {today_full:.1f} % of the card", MUTED),
                                            (card, "Scale card S70", f"glass {target:.1f} % of the card  ({(k - 1) * 100:+.0f} %)", RED))):
    x = rx + i * (iw + 60); y = ry + 70
    d.text((x, y), label, font=hel(32, True), fill=INK if i == 0 else RED); d.text((x, y + 42), sub, font=hel(24), fill=col)
    y += 90
    d.rectangle([x - 1, y - 1, x + iw, y + ih + 330], fill=CARDBG, outline=LINE, width=2)
    out.paste(img.resize((iw, ih), Image.LANCZOS), (x, y))
    ty = y + ih + 26
    d.text((x + 24, ty), "CAP OPTIONS · 9", font=mont(20, 600), fill=INK)
    d.text((x + 24, ty + 48), "9 ml Clear Cylinder Roll-On", font=mont(30, 500), fill=INK)
    d.text((x + 24, ty + 88), "Bottle", font=mont(30, 500), fill=INK)
    d.text((x + 24, ty + 136), "9 ml · Roll-On · Metal roller · 17-415 neck", font=mont(20, 400), fill=MUTED)
    d.line([(x + 24, ty + 180), (x + iw - 24, ty + 180)], fill=LINE, width=1)
    d.text((x + 24, ty + 196), "Availability", font=mont(20, 400), fill=MUTED); d.text((x + 24, ty + 226), "In stock", font=mont(20, 500), fill=INK)
    d.text((x + iw // 2, ty + 196), "Case quantity", font=mont(20, 400), fill=MUTED); d.text((x + iw // 2, ty + 226), "724", font=mont(20, 500), fill=INK)
cap_y = ry + 70 + 90 + ih + 330 + 36
for j, line in enumerate(("Same photograph, same card. Only the size changes.", "Every bottle is placed by its bare glass height, so a 70 mm", "glass stands the same height in its card in every family.")):
    d.text((rx, cap_y + j * 38), line, font=hel(28), fill=MUTED)
out.save(os.path.join(OUT, "scale-card-example.jpg"), quality=92)
print("saved", out.size, "| today full glass", round(today_full, 1), "-> target", target, "factor", round(k, 3), "| fitment top px", fit_top, "rim px", round(rim_y))
