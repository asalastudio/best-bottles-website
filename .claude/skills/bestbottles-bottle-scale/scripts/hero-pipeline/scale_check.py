"""Bottle-to-bottle scale check against Jordan's lineup (2026-09-16).

Three rows, one representative hero per body, fitments on (a roller, sprayer or pump rides on top of
the glass at its own height):
  A  as locked on 2026-09-07 - what the grid shows          (glass shoulder on each body's locked line)
  B  true scale - glass follows millimetres, anchored on the 9 ml so that body is the same size in A and B
  C  proposal - the four bodies that break the order moved onto the lock's own progression through 5/9/50/100
Each cell is the shipped render scaled about its foot; one zoom for everything.
"""
import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFont
from hero_paths import WORK as S
BONE = (245, 243, 239); INK = (26, 28, 27); MUTED = (120, 126, 122); RED = (196, 58, 38); BLUE = (26, 111, 176)
FP = "/System/Library/Fonts/Helvetica.ttc"; CW, CH, BASE = 1560, 1716, 1562
font = lambda sz, b=False: ImageFont.truetype(FP, sz, index=1 if b else 0)

# body -> (label, mm, representative SKU, locked shoulder %, proposed shoulder %)
BODIES = [
    ("5 ml",               53, "GBCyl5MtlRollBlkDot",  36.5, 36.5),
    ("9 ml Classic",       70, "GBCyl9MtlRollBlkDot",  43.5, 43.5),
    ("28 ml Jumbo Roller", 81, "GBMtlRoll28Blk",       50.5, 46.5),
    ("25 ml Cylinder",     83, "GBcyl25SpryMtGl",      46.5, 47.2),
    ("50 ml roller",       98, "GBCyl50MtlRollBlk",    56.0, 51.8),
    ("9 ml Slim",         106, "GBTallCyl9MtlRollBlkDot", 62.5, 54.1),
    ("50 ml Cylinder",    117, "GBCyl50SpryMtGl",      56.0, 56.0),
    ("100 ml Cylinder",   154, "GBCyl100SpryMtGl",     67.5, 67.5),
]


def product_cols(a):
    m = np.abs(a - np.array(BONE)).max(axis=2) > 40; m[BASE - 6:, :] = False
    c = np.where(m.sum(axis=0) > 6)[0]
    return (int(c.min()), int(c.max())) if len(c) else (0, CW - 1)


def cell(sku, shoulder_pct_now, shoulder_pct_target, scale, line_pct=None):
    """Scale the shipped render about its foot so its shoulder goes from now -> target; crop sideways."""
    im = Image.open(f"{S}/cyl-locked/{sku}.png").convert("RGB")
    f = shoulder_pct_target / shoulder_pct_now
    big = im.resize((round(CW * f), round(CH * f)), Image.LANCZOS)
    canvas = Image.new("RGB", (CW, CH), BONE)
    a0 = np.asarray(im).astype(int); x0, x1 = product_cols(a0); cx = (x0 + x1) / 2
    canvas.paste(big, (round(CW / 2 - cx * f), round(BASE - BASE * f)))
    a = np.asarray(canvas).astype(int); x0, x1 = product_cols(a)
    x0, x1 = max(0, x0 - 50), min(CW - 1, x1 + 50)
    crop = canvas.crop((x0, 0, x1 + 1, CH)).resize((round((x1 - x0 + 1) * scale), round(CH * scale)), Image.LANCZOS)
    if line_pct is not None:
        d = ImageDraw.Draw(crop); y = round((BASE - line_pct / 100 * CH) * scale)
        d.line([(0, y), (crop.width, y)], fill=RED, width=3)
    return crop


def main():
    lr = json.load(open(f"{S}/lock-restore.json"))
    SC = 0.30; GAP = 16; PAD = 60; HEAD = 150; ROWH = round(CH * SC); LABH = 78
    ref9 = 43.5 / 70.0                                        # true scale: shoulder % per mm, anchored on the 9 ml
    rows = []
    rows.append(("A   AS LOCKED 2026-09-07  -  before the amendment. Red = the locked shoulder line.",
                 [cell(s, lr[s]["targetPct"], lk, SC, lk) for _, mm, s, lk, pr in BODIES], INK))
    rows.append(("B   TRUE BOTTLE-TO-BOTTLE SCALE  -  glass follows millimetres (anchored on the 9 ml), fitments ride on top. This is Jordan's lineup with the tops on.",
                 [cell(s, lr[s]["targetPct"], mm * ref9, SC, None) for _, mm, s, lk, pr in BODIES], INK))
    rows.append(("C   SHIPPED  -  lock amendment 2026-09-16: the four bodies that broke the order moved onto the lock's own progression.",
                 [cell(s, lr[s]["targetPct"], pr, SC, pr) for _, mm, s, lk, pr in BODIES], BLUE))
    W = PAD * 2 + max(sum(max(c.width, 150) for c in r[1]) + GAP * (len(BODIES) - 1) for r in rows)
    H = HEAD + len(rows) * (ROWH + LABH + 40) + PAD
    out = Image.new("RGB", (W, H), BONE); d = ImageDraw.Draw(out)
    d.text((PAD, 40), "Bottle-to-bottle scale: the 09-07 lock, true scale, and what ships", font=font(44, True), fill=INK)
    d.text((PAD, 98), "Eight Cylinder bodies, one representative hero each, foot on the 91 % baseline, one zoom for every cell.", font=font(22), fill=MUTED)
    y = HEAD
    for title, cells, col in rows:
        d.text((PAD, y), title, font=font(24, True), fill=col); y += 40
        x = PAD
        for (label, mm, s, lk, pr), c in zip(BODIES, cells):
            w = max(c.width, 150); out.paste(c, (x + (w - c.width) // 2, y))
            t1 = f"{label}"; t2 = f"{mm} mm"
            if title.startswith("A"): t2 += f"  ·  locked {lk:g}%"
            if title.startswith("B"): t2 += f"  ·  {mm * ref9:.1f}%"
            if title.startswith("C"): t2 += f"  ·  {pr:g}%" + ("" if pr == lk else f"  (was {lk:g})")
            d.text((x + w / 2 - d.textlength(t1, font=font(20, True)) / 2, y + ROWH + 6), t1, font=font(20, True), fill=INK)
            d.text((x + w / 2 - d.textlength(t2, font=font(17)) / 2, y + ROWH + 32), t2, font=font(17), fill=MUTED if pr == lk or not title.startswith("C") else RED)
            x += w + GAP
        y += ROWH + LABH
    out.save(f"{S}/scale-check.jpg", quality=92); print("scale-check.jpg", out.size)


if __name__ == "__main__":
    main()
