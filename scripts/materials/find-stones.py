"""find-stones.py — locate every rhinestone in a reference PNG, in mm.

Jordan, looking at the dotted cap: "three rhinestones down the left side,
two in the middle, and three on the right. That is the pattern that every
bottle is showing, so we kind of need to have that information." This is
how that information gets read off the photograph instead of guessed.

A stone is NOT simply dark: it is a dark bezel ring around a bright table,
so thresholding on darkness alone shatters one stone into several blobs.
Detect on |deviation from the wall's own per-column tone| instead, close
the mask to knit ring and table together, then take centroids.

The cap is a cylinder photographed square on, so x maps to azimuth by
arcsin and y to height. Two checks tell you the mapping is sound before
you trust a number: the bbox height should match the published cap height,
and apparent stone width should track cos(azimuth).

  python3 scripts/materials/find-stones.py <ref.png> [cap_diameter_mm]
"""
import numpy as np, sys
from PIL import Image
from scipy import ndimage

path = sys.argv[1]
CAP_D_MM = float(sys.argv[2]) if len(sys.argv) > 2 else 19.0

img = np.array(Image.open(path).convert("RGB")).astype(float)
lum = img.mean(axis=2)
part = lum < 246
ys, xs = np.where(part)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
W, H = x1 - x0 + 1, y1 - y0 + 1
mm_px = CAP_D_MM / W
print(f"cap bbox {W}x{H}px   scale {mm_px:.4f} mm/px   height {H*mm_px:.2f} mm")

wall = np.where(part, lum, np.nan)
colmed = np.nanmedian(np.where(part, lum, np.nan), axis=0)
resid = np.nan_to_num(wall - colmed[None, :], nan=0.0)

# a stone deviates from its column's wall tone in EITHER direction
mask = (np.abs(resid) > 20) & part
# drop the rim bands: the top ellipse and the bottom edge are shading, not stones
band = int(0.055 * H)
mask[:y0 + band, :] = False
mask[y1 - band:, :] = False

mask = ndimage.binary_closing(mask, np.ones((7, 7)))
lab, n = ndimage.label(mask)
blobs = []
for i in range(1, n + 1):
    m = lab == i
    a = int(m.sum())
    if a < 40:
        continue
    yy, xx = np.where(m)
    blobs.append((xx.mean(), yy.mean(), a, xx.max() - xx.min() + 1, yy.max() - yy.min() + 1))

cx_mid = (x0 + x1) / 2
print(f"\n{len(blobs)} stones\n")
print(f"{'#':>2} {'x':>6} {'y':>6} {'area':>5} {'w':>3} {'h':>3}  {'azimuth':>8} {'up mm':>7}")
rows = []
for k, (cx, cy, a, bw, bh) in enumerate(sorted(blobs), 1):
    u = max(-1.0, min(1.0, 2 * (cx - cx_mid) / W))
    theta = np.degrees(np.arcsin(u))
    h = (y1 - cy) * mm_px
    rows.append((theta, h, a, bw, bh))
    print(f"{k:>2} {cx:6.1f} {cy:6.1f} {a:5d} {bw:3d} {bh:3d}  {theta:7.1f} {h:7.2f}")

print("\n--- columns (grouped by azimuth) ---")
rows.sort()
cols, cur = [], [rows[0]]
for r in rows[1:]:
    (cols.append(cur), cur := [r]) if r[0] - cur[-1][0] > 16 else cur.append(r)
cols.append(cur)
for c in cols:
    th = np.mean([r[0] for r in c])
    hs = sorted(r[1] for r in c)
    print(f"  {th:6.1f} deg : {len(c)} stone(s)  heights " +
          ", ".join(f"{h:5.2f}" for h in hs))

print("\n--- apparent stone width vs azimuth (foreshortening check) ---")
for th, h, a, bw, bh in sorted(rows):
    print(f"  {th:7.1f} deg  w {bw*mm_px:.2f} mm  h {bh*mm_px:.2f} mm  ratio {bw/bh:.2f}")
