"""The Cylinder catalogue sheet, from the finished Sunburst renders.

Every render shares one canvas and one baseline, so they are laid out WITHOUT per-image rescaling:
each canvas is only cropped sideways to its product, then the whole row is scaled by a single
factor. The relative sizes on the sheet are therefore exactly the sizes the site will show, and the
rendered shadow comes through untouched.
"""
import json, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from hero_paths import WORK as S
BONE = (245, 243, 239); INK = (26, 28, 27); MID = (96, 102, 99); MUTED = (140, 146, 142)
RULE = (212, 208, 201); ACC = (26, 111, 176)
FP = "/System/Library/Fonts/Helvetica.ttc"
CW, CH, BASELINE = 1560, 1716, 1562


def font(sz, bold=False):
    return ImageFont.truetype(FP, sz, index=1 if bold else 0)


def product_columns(img):
    """Horizontal extent of the product, ignoring the pale cast shadow on the floor."""
    a = np.asarray(img.convert("RGB")).astype(int)
    m = np.abs(a - np.array(BONE)).max(axis=2) > 40
    m[BASELINE - 6:, :] = False                              # the shadow lives at the floor
    cols = np.where(m.sum(axis=0) > 6)[0]
    return (int(cols.min()), int(cols.max())) if len(cols) else (0, CW - 1)


def main():
    state = {r["sku"]: r for r in json.load(open(f"{S}/cylinder-barrel.json"))}
    geom = {b["sku"]: b for b in json.load(open(f"{S}/cyl-geom.json"))}
    items = []
    for sku in geom:
        p = f"{S}/{os.environ.get('HERO_DIR', 'cyl-sized')}/{sku}.png"
        if not os.path.exists(p):
            continue
        r = state[sku]
        glass = ("frosted" if "Frst" in sku else "swirl" if "Swrl" in sku else
                 "amber" if "Amb" in sku else "cobalt" if "Blu" in sku else "clear")
        items.append(dict(sku=sku, path=p, mm=r["heightMm"], cap=r["capacity"],
                          fit=r["fitment"], glass=glass, capped=geom[sku].get("cappedTo")))
    items.sort(key=lambda i: (i["mm"], i["glass"], i["fit"], i["sku"]))

    SCALE = 0.34                                              # one factor for every canvas
    PAD, GAP, HEAD, CAP_H, ROWGAP = 90, 18, 250, 120, 40
    MAXW = 5200
    for it in items:
        im = Image.open(it["path"]).convert("RGB")
        x0, x1 = product_columns(im)
        x0, x1 = max(0, x0 - 60), min(CW - 1, x1 + 60)
        crop = im.crop((x0, 0, x1 + 1, CH))
        crop = crop.resize((round(crop.width * SCALE), round(CH * SCALE)), Image.LANCZOS)
        it["im"] = crop
    n_rows = 3
    per = -(-len(items) // n_rows)
    rows = [items[i:i + per] for i in range(0, len(items), per)]

    row_h = round(CH * SCALE)
    W = MAXW
    H = HEAD + len(rows) * (row_h + CAP_H + ROWGAP) + 110
    sheet = Image.new("RGB", (W, H), BONE)
    d = ImageDraw.Draw(sheet)
    d.text((PAD, 70), "CYLINDER", font=font(92, True), fill=INK)
    d.text((PAD, 178), "The family at catalogue scale  ·  photographed with GPT-Image-2.5 Sunburst from "
                       "the PSD masters", font=font(40), fill=MID)
    right = f"{len(items)} heroes   ·   37 – 154 mm   ·   sized from measured height"
    d.text((W - PAD - d.textlength(right, font=font(34)), 188), right, font=font(34), fill=MUTED)
    d.line([(PAD, HEAD - 18), (W - PAD, HEAD - 18)], fill=INK, width=3)

    y = HEAD
    for row in rows:
        total = sum(max(it["im"].width, 190) for it in row) + GAP * (len(row) - 1)
        x = PAD + (W - 2 * PAD - total) / 2
        base = y + round(BASELINE * SCALE)
        for it in row:
            cw = max(it["im"].width, 190)
            sheet.paste(it["im"], (int(x + (cw - it["im"].width) / 2), y))
            cx = x + cw / 2
            lines = [(f'{it["cap"]}  ·  {it["glass"]}', font(22, True), INK),
                     (f'{it["fit"]}  ·  {it["mm"]:.0f} mm', font(21, True), ACC),
                     (it["sku"], font(16), MUTED)]
            ty = y + row_h + 8
            for text, fnt, col in lines:
                t = text
                while d.textlength(t, font=fnt) > cw + GAP - 4 and len(t) > 4:
                    t = t[:-2]
                d.text((cx - d.textlength(t, font=fnt) / 2, ty), t, font=fnt, fill=col)
                ty += 28
            x += cw + GAP
        y += row_h + CAP_H + ROWGAP

    note = ("Each bottle is rebuilt from its PSD master and sized so its glass, shoulder to foot, sits at the shoulder height locked for its body on 2026-09-07, "
            "then photographed by the model with its geometry locked. "
            ""
            "Every background corrected to bone #F5F3EF within 2/255.")
    d.line([(PAD, H - 96), (W - PAD, H - 96)], fill=RULE, width=2)
    d.text((PAD, H - 72), note, font=font(24), fill=MUTED)
    sheet.save(f"{S}/{os.environ.get('HERO_SHEET', 'cylinder-catalogue-final.jpg')}", quality=92)
    print(sheet.size, len(rows), "rows")


if __name__ == "__main__":
    main()
