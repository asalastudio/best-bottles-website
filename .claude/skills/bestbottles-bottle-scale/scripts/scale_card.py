"""Best Bottles universal scale card - v1 proposal (2026-09-16).

One rule for every bottle in every family: the BARE GLASS height in mm (Convex heightWithoutCap, foot to rim,
no fitment) sets how tall the glass stands on the 1560 x 1716 hero card, foot on the 91 % baseline. Fitments,
caps and bulbs ride on top at true proportion. Every SKU of one glass gets the same size.

The curve is a monotone cubic (PCHIP) through eight control points, each with a reason:
    20 mm  23.0 %   smallest jars stay readable
    40 mm  33.0 %   sample vials larger than today (Jordan: small bottles too small)
    68 mm  46.7 %   Boston Round 15 ml, locked 2026-09-12 (full glass)
    78 mm  52.4 %   Boston Round 30 ml, locked 2026-09-12 (full glass)
   106 mm  65.5 %   9 ml Slim clearly taller than the 9 ml Classic (Jordan approved ~1.4x)
   117 mm  68.0 %   50 ml Cylinder a little taller than the Slim (Jordan: "maybe 2 % taller")
   154 mm  74.0 %   100 ml at the frame limit with its sprayer
   195 mm  80.0 %   tallest glass at the frame limit with its cap

    python3 scale_card.py [snapshot dir]
    -> <snapshot dir>/scale-card/scale-card.jpg, scale-card.json, scale-card-bodies.csv

Inputs: <snapshot dir>/bodies.json (run bottle_bodies.py first) and ../references/approved-sizes-2026-09-16.json.
"""
import csv, json, math, os
import numpy as np
from scipy.interpolate import PchipInterpolator
from PIL import Image, ImageDraw, ImageFont

import sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bottle_bodies import default_snapshot
REF = json.load(open(os.path.join(os.path.dirname(HERE), "references", "approved-sizes-2026-09-16.json")))
CANVAS_W, CANVAS_H, BASELINE_PCT = 1560, 1716, 91.0

CONTROL = [tuple(c) for c in REF["scaleCardV1"]["controlPoints"]]
_curve = PchipInterpolator([c[0] for c in CONTROL], [c[1] for c in CONTROL], extrapolate=False)


def glass_pct(mm):
    mm = float(np.clip(mm, CONTROL[0][0], CONTROL[-1][0]))
    return round(float(_curve(mm)), 1)


def tag(mm):
    return f"S{int(math.floor(mm / 10 + 0.5) * 10)}"


# ---------------------------------------------------------------- today's approved sizes, as full glass %
def approved_today():
    """Full-glass % of the sizes on the site today (reference file), for the change table."""
    return [dict(body=r["body"], mm=r["mm"], todayPct=r["todayPct"], estimated=r["estimated"], cardPct=glass_pct(r["mm"]),
                 change=round((glass_pct(r["mm"]) / r["todayPct"] - 1) * 100, 1)) for r in REF["todayFullGlassPercent"]]


# ---------------------------------------------------------------- every bottle body in the catalogue
def bodies(snap):
    out = []
    for b in json.load(open(os.path.join(snap, "bodies.json"))):
        mm, dia = b["heightNoCapMm"], b["diameterMm"] or 0
        flag = "" if b["status"] == "OK" else f'{b["status"]}: {b["notes"]}'
        pct = glass_pct(mm) if mm else None
        if pct and not flag and dia and pct * dia / mm > 62:
            flag = f"wide glass: {pct * dia / mm:.0f} % of card height across, check the cap fits beside it"
        out.append(dict(bottle=b["id"], family=b["family"], capacityMl=b["capacityMl"], neck=b["neck"], glass=b["glass"], variant=b["shape"],
                        glassMm=mm, diameterMm=dia, skus=b["skuCount"], tag=tag(mm) if mm else "", glassPct=pct,
                        glassPx=round(pct / 100 * CANVAS_H) if pct else None, governingSku=b["governingSku"], check=flag))
    return sorted(out, key=lambda x: (x["glassMm"] or 0, x["family"]))


# ---------------------------------------------------------------- the card
BG = (250, 248, 244); CARD = (245, 243, 239); INK = (28, 30, 29); MUTED = (112, 117, 113); RULE = (214, 208, 199)
RED = (190, 60, 40); BLUE = (30, 104, 160); GLASS = (226, 232, 233); GLASS_EDGE = (120, 134, 138); GOOD = (46, 125, 80)
FP = "/System/Library/Fonts/Helvetica.ttc"


def font(size, bold=False):
    return ImageFont.truetype(FP, size, index=1 if bold else 0)


def bottle(d, cx, base_y, h, max_w):
    """A plain cylinder bottle silhouette: body, rounded shoulder, short neck. Height h px, foot at base_y."""
    neck_h = 0.13 * h; body_h = h - neck_h; bw = min(0.34 * h, max_w); nw = bw * 0.46
    r = min(bw * 0.22, body_h * 0.25)
    d.rectangle([cx - nw / 2, base_y - h, cx + nw / 2, base_y - body_h + r], fill=GLASS, outline=GLASS_EDGE, width=3)
    d.rounded_rectangle([cx - bw / 2, base_y - body_h, cx + bw / 2, base_y], radius=r, fill=GLASS, outline=GLASS_EDGE, width=3)


def draw_card(tags, today, all_bodies, path):
    W, H = 4400, 2980
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    L = 110
    d.text((L, 70), "Best Bottles Scale Card", font=font(92, True), fill=INK)
    d.text((L, 182), "One size rule for every bottle in every family, set by its bare glass height.   Proposal v1 for approval  ·  16 Sep 2026",
           font=font(38), fill=MUTED)
    d.line([(L, 262), (W - L, 262)], fill=INK, width=3)

    # how to tag - a real sequence, so numbered
    steps = [("Measure", "Take the bare glass height in mm: Convex heightWithoutCap, foot to rim, no fitment."),
             ("Tag", "Find the height on the ladder. Every SKU of that glass gets the same tag and size."),
             ("Place", "Foot on the 91 % baseline of the 1560 × 1716 card, glass top on the tag's line."),
             ("Fit", "Sprayers, pumps, rollers, caps and bulbs ride on top at true size. Nothing else is scaled.")]
    sx, sw = L, (W - 2 * L - 3 * 40) // 4
    for i, (t, s) in enumerate(steps):
        x = sx + i * (sw + 40)
        d.text((x, 300), f"{i + 1}", font=font(64, True), fill=BLUE)
        d.text((x + 70, 306), t, font=font(40, True), fill=INK)
        words, line, y = s.split(), "", 362
        for wd in words:
            test = (line + " " + wd).strip()
            if d.textlength(test, font=font(30)) > sw - 70:
                d.text((x + 70, y), line, font=font(30), fill=MUTED); y += 40; line = wd
            else:
                line = test
        d.text((x + 70, y), line, font=font(30), fill=MUTED)

    # the ladder: every tag's glass at card scale on one baseline
    top, bottom = 520, 1720
    band_h = bottom - top
    d.rectangle([L, top, W - L, bottom], fill=CARD)
    card_px = band_h / (BASELINE_PCT / 100 * 1.0) * 1.0      # px for 100 % of card height such that 91 % = band height
    scale = band_h / BASELINE_PCT                           # px per 1 % of card height
    base_y = bottom - 30
    for pct in range(10, 91, 10):
        y = base_y - pct * scale * (band_h - 60) / band_h
        d.line([(L + 120, y), (W - L - 20, y)], fill=RULE, width=2)
        d.text((L + 20, y - 18), f"{pct} %", font=font(28), fill=MUTED)
    d.line([(L + 120, base_y), (W - L - 20, base_y)], fill=INK, width=3)
    d.text((L + 20, base_y - 18), "base", font=font(28, True), fill=INK)
    n = len(tags); slot = (W - 2 * L - 160) / n
    for i, t in enumerate(tags):
        cx = L + 140 + slot * (i + 0.5)
        h = t["glassPct"] * scale * (band_h - 60) / band_h
        bottle(d, cx, base_y, h, slot * 0.58)
        y = base_y - h
        d.line([(cx - slot * 0.42, y), (cx + slot * 0.42, y)], fill=RED, width=3)
        lab = f"{t['glassPct']:.1f}"
        d.text((cx - d.textlength(lab, font=font(30, True)) / 2, y - 44), lab, font=font(30, True), fill=RED)
    # tag labels under the band
    for i, t in enumerate(tags):
        cx = L + 140 + slot * (i + 0.5)
        for text, f, col, dy in ((t["tag"], font(40, True), INK, 20), (f"{t['fromMm']}–{t['toMm']} mm", font(24), MUTED, 72),
                                 (f"{t['glassPx']} px", font(24), MUTED, 104)):
            d.text((cx - d.textlength(text, font=f) / 2, bottom + dy), text, font=f, fill=col)
    d.text((L, bottom + 150), "Red number = glass height as % of the card, at the tag's nominal height. Exact values for any height are in the table below and in scale-card.json.",
           font=font(28), fill=MUTED)

    # lookup table, 5 mm steps
    ty = bottom + 230
    d.text((L, ty), "Lookup  ·  glass % of card by bare glass height", font=font(40, True), fill=INK)
    ty += 64
    rows = [(mm, glass_pct(mm)) for mm in range(20, 200, 5)]
    per_col = 12; col_w = 560
    for c in range(3):
        x = L + c * (col_w + 40)
        d.text((x, ty), "mm", font=font(26, True), fill=MUTED); d.text((x + 150, ty), "tag", font=font(26, True), fill=MUTED)
        d.text((x + 300, ty), "glass %", font=font(26, True), fill=MUTED); d.text((x + 450, ty), "px", font=font(26, True), fill=MUTED)
        for j, (mm, pct) in enumerate(rows[c * per_col:(c + 1) * per_col]):
            y = ty + 44 + j * 40
            if j % 2 == 0:
                d.rectangle([x - 10, y - 4, x + col_w - 20, y + 34], fill=(242, 239, 233))
            d.text((x, y), f"{mm}", font=font(28), fill=INK); d.text((x + 150, y), tag(mm), font=font(28), fill=INK)
            d.text((x + 300, y), f"{pct:.1f}", font=font(28, True), fill=INK); d.text((x + 450, y), f"{round(pct / 100 * CANVAS_H)}", font=font(28), fill=MUTED)

    # what changes
    px0 = L + 3 * (col_w + 40) + 40
    d.text((px0, bottom + 230), "What changes if approved", font=font(40, True), fill=INK)
    hy = bottom + 294
    cols = [(0, "bottle"), (560, "mm"), (660, "today"), (800, "card"), (930, "change")]
    for off, text in cols:
        d.text((px0 + off, hy), text, font=font(26, True), fill=MUTED)
    for j, r in enumerate(sorted(today, key=lambda r: r["mm"])):
        y = hy + 44 + j * 40
        if j % 2 == 0:
            d.rectangle([px0 - 10, y - 4, W - L, y + 34], fill=(242, 239, 233))
        d.text((px0, y), r["body"], font=font(28), fill=INK)
        d.text((px0 + 560, y), f"{r['mm']}", font=font(28), fill=MUTED)
        d.text((px0 + 660, y), ("≈" if r["estimated"] else "") + f"{r['todayPct']:.1f}", font=font(28), fill=MUTED)
        d.text((px0 + 800, y), f"{r['cardPct']:.1f}", font=font(28, True), fill=INK)
        ch = r["change"]; col = GOOD if abs(ch) < 3 else (RED if ch < 0 else BLUE)
        d.text((px0 + 930, y), f"{ch:+.0f} %", font=font(28, True), fill=col)

    # checks against what Jordan asked for
    g = {r["body"]: r["cardPct"] for r in today}
    checks = [f"9 ml Slim glass is {g['Cylinder 9 ml Slim'] / g['Cylinder 9 ml Classic']:.2f}× the 9 ml Classic",
              f"50 ml Cylinder is {(g['Cylinder 50 ml'] / g['Cylinder 9 ml Slim'] - 1) * 100:.0f} % taller than the Slim",
              f"100 ml is {(g['Cylinder 100 ml'] / g['Cylinder 50 ml'] - 1) * 100:.0f} % taller than the 50 ml",
              f"4 ml vial is {g['Cylinder 4 ml vial'] / g['Cylinder 5 ml'] * 100:.0f} % of the 5 ml"]
    cy = hy + 44 + len(today) * 40 + 30
    for k, text in enumerate(checks):
        d.text((px0, cy + k * 40), "•  " + text, font=font(28), fill=INK)
    flagged = sum(1 for b in all_bodies if b["check"] and not b["check"].startswith("wide glass"))
    wide = sum(1 for b in all_bodies if b["check"].startswith("wide glass"))
    d.line([(L, H - 110), (W - L, H - 110)], fill=RULE, width=2)
    d.text((L, H - 84), f"Built from production Convex heightWithoutCap for {len(all_bodies)} bottle bodies. {flagged} have measurements under review and must be "
           f"settled before they are tagged; {wide} are wide enough to check the cap fits beside it. All listed in scale-card-bodies.csv.", font=font(28), fill=MUTED)
    im.save(path, quality=92)


def main():
    snap = sys.argv[1] if len(sys.argv) > 1 else default_snapshot()
    OUT = os.path.join(snap, "scale-card"); os.makedirs(OUT, exist_ok=True)
    tags = []
    for nominal in range(20, 201, 10):
        tags.append(dict(tag=f"S{nominal}", nominalMm=nominal, fromMm=nominal - 5, toMm=nominal + 4,
                         glassPct=glass_pct(nominal), glassPx=round(glass_pct(nominal) / 100 * CANVAS_H)))
    today = approved_today()
    all_bodies = bodies(snap)
    card = dict(
        name="Best Bottles scale card", version="1-proposal", date="2026-09-16", status="proposal, awaiting Jordan's approval",
        rule=["Size is set by the BARE GLASS height in mm (Convex heightWithoutCap): foot to rim, no fitment.",
              "Every SKU of one glass gets the same size, whatever the fitment.",
              "Canvas 1560 x 1716. Foot on the 91 % baseline. Glass top at glassPct of the card height above the foot line's canvas origin.",
              "Fitments, caps, bulbs ride on top at true proportion; nothing else is scaled.",
              "Use the exact height's value (perMm); the tag is the nearest 10 mm, for grouping and review."],
        canvas=dict(width=CANVAS_W, height=CANVAS_H, baselinePercent=BASELINE_PCT),
        curve=dict(kind="monotone cubic (PCHIP) through control points, clamped at both ends",
                   controlPoints=[dict(mm=m, glassPct=p, reason=r) for m, p, r in CONTROL]),
        tags=tags,
        perMm={str(mm): glass_pct(mm) for mm in range(20, 196)},
        changesToApprovedSizes=today)
    json.dump(card, open(f"{OUT}/scale-card.json", "w"), indent=1)
    with open(f"{OUT}/scale-card-bodies.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(all_bodies[0].keys())); w.writeheader(); w.writerows(all_bodies)
    draw_card(tags, today, all_bodies, f"{OUT}/scale-card.jpg")
    print("tags:", ", ".join(f"{t['tag']} {t['glassPct']}" for t in tags))
    for r in today:
        print(f"  {r['body']:24} {r['mm']:>4} mm  today {r['todayPct']:5.1f}  card {r['cardPct']:5.1f}  {r['change']:+5.1f} %")
    print("bodies with a check:", sum(1 for b in all_bodies if b["check"]), "| written to", OUT)


if __name__ == "__main__":
    main()
