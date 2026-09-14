"""Consistency audit for a hero set: per frame, collar bottom vs shoulder, collar centre vs neck centre, and how much the
GLASS changed vs the base (flash risk). Usage: HERO_SET=v5 python3 scripts/hero-empire/audit.py"""
import os, json, glob
import numpy as np
from PIL import Image
SET = os.environ.get("HERO_SET", "v5"); OUT = f"public/assets/hero/{SET}"
g = json.load(open(f"{OUT}/geometry.json")); NICHE = g["niche"]; BODY = g["body"]
base = np.asarray(Image.open(f"{OUT}/base.png").convert("RGB")).astype(float)
cx = (BODY[0] + BODY[2]) / 2; shoulder = BODY[1] - 10
rows = []
for p in sorted(glob.glob(f"{OUT}/frame-*.png")):
    sku = os.path.basename(p)[6:-4]
    if sku == "BARE": continue
    f = np.asarray(Image.open(p).convert("RGB")).astype(float); d = np.abs(f - base).sum(axis=2) > 40
    band = d[NICHE[1]:shoulder + 14, int(cx) - 30:int(cx) + 30]; hit = np.where(band.any(axis=1))[0]
    seat = (int(hit.max()) + NICHE[1] - shoulder) if len(hit) else None
    collar = d[max(shoulder - 70, NICHE[1]):shoulder, int(cx) - 70:int(cx) + 70]; ys, xs = np.where(collar)
    dx = (float(xs.mean()) + int(cx) - 70 - cx) if len(xs) else None
    # glass change: mean abs diff inside the body, excluding a 50px column around the neck centre (dip tube)
    body = np.abs(f - base).mean(axis=2)[BODY[1]:BODY[3], BODY[0]:BODY[2]].copy()
    c0 = int(cx) - 25 - BODY[0]; body[:, max(c0, 0):c0 + 50] = np.nan
    glass = float(np.nanmean(body))
    rows.append((sku, seat, dx, glass))
print(f"{'frame':26} {'seat px':>8} {'dx px':>7} {'glass Δ/255':>11}")
for sku, seat, dx, glass in rows:
    flag = "" if (seat is not None and abs(seat) <= 4 and dx is not None and abs(dx) <= 4 and glass < 6) else "  <-- check"
    print(f"{sku:26} {('%+d' % seat) if seat is not None else 'n/a':>8} {('%+.1f' % dx) if dx is not None else 'n/a':>7} {glass:>11.2f}{flag}")
seats = [r[1] for r in rows if r[1] is not None]; dxs = [r[2] for r in rows if r[2] is not None]
print(f"\nspread: seat {min(seats):+d}..{max(seats):+d} px, dx {min(dxs):+.1f}..{max(dxs):+.1f} px, glass max {max(r[3] for r in rows):.2f}/255 over {len(rows)} frames")
