"""Pillar 9 ml / 13-415 clear body from the real photograph (4 Nov 2026).

Jordan: the Pillar page must match the old site (bestbottles.com, GBPillar9SpryBlkMatt), whose photo has the heavy
white glass base. The only Pillar PSD is 12. Vials/0. All Vials/Capped/27. GBPillar9RollBlk.psd; its 'Layer 8' is the
glass body on a transparent ground. It carries a flat, 67 %-white studio card inside the glass (alpha ~171); that card
is removed here (alpha set to 0 where it is the flat card), everything else is the photo's own pixels.
Usage: python3 scripts/pillar/pillar-body.py "<PSD path>"
"""
import hashlib, io, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

OUT = "public/local-kits/pillar-masters-2026-11-04"
psd = PSDImage.open(sys.argv[1])
layer = next(l for l in psd.descendants() if l.name == "Layer 8")
img = layer.topil().convert("RGBA"); a = np.asarray(img).copy()
alpha = a[..., 3]; rgb = a[..., :3].min(2)
solid = alpha > 40; w = solid.sum(1); full = w.max(); shoulder = int(np.where(w > 0.9 * full)[0].min())
cols = np.where(solid[shoulder + 20])[0]; inner = slice(cols.min() + 30, cols.max() - 30)
# The heavy glass base starts where the inside of the bottle turns solid again; the card stops above it.
med = np.median(alpha[:, inner], 1); base_top = int(next(y for y in range(shoulder + 100, len(med)) if med[y] > 200))
card = np.zeros_like(alpha, bool)
card[shoulder:base_top - 4, inner] = ((alpha[shoulder:base_top - 4, inner] >= 150) & (alpha[shoulder:base_top - 4, inner] <= 190) & (rgb[shoulder:base_top - 4, inner] >= 240))
# The card's whole outline: its convex hull grown 4 px, then every light pixel inside it (the card face, its
# anti-aliased rim and the brighter strip along its top) is cleared; darker glass pixels inside the hull are kept.
from PIL import ImageDraw, ImageFilter
def convex_hull(points):
    pts = sorted(set(points)); cross = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]
ys, xs = np.where(card)
poly = Image.new("L", img.size, 0); ImageDraw.Draw(poly).polygon(convex_hull(list(zip(xs.tolist(), ys.tolist()))), fill=255)
hull = np.asarray(poly.filter(ImageFilter.MaxFilter(9))) > 0
light = (rgb >= 200)
clear = hull & light
clear[:shoulder + 8] = False   # never touch the neck and the shoulder ring
clear[base_top - 2:] = False    # nor the heavy base
a[clear, 3] = 0
card = clear
out = Image.fromarray(a)
buf = io.BytesIO(); out.save(buf, "PNG", optimize=True); data = buf.getvalue(); sha = hashlib.sha256(data).hexdigest()
path = f"{OUT}/body-pillar-9ml-13-415-clear.{sha[:12]}.png"; open(path, "wb").write(data)
print(path, out.size, "card pixels cleared:", int(card.sum()), "shoulder row", shoulder, "base top", base_top)
