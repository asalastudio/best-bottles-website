"""Family shape icons traced from each family's real clear glass body (scripts/icons/family-bodies.json, from
production's register): the bottle's silhouette, made symmetric about its axis, smoothed, simplified and fitted to a
24 x 24 icon (20 units tall, centred). Writes src/lib/catalog/family-shape-paths.generated.json: { family: "M... Z" },
drawn as a 1.25-unit stroke in the filter. Families without a register body (Vial, Apothecary, Lotion Bottle) are drawn
by hand in FamilyShapeIcon.tsx.
Usage: python3 scripts/icons/trace-family-shapes.py
"""
import io, json, urllib.request
import numpy as np
from PIL import Image

SRC = json.load(open("scripts/icons/family-bodies.json"))
OUT = "src/lib/catalog/family-shape-paths.generated.json"
HEIGHT, TOP, MAXW = 20.0, 2.0, 21.0


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1]); ab = b - a; n = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / n for p in points[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps:
        return rdp(points[:i + 1], eps)[:-1] + rdp(points[i:], eps)
    return [points[0], points[-1]]


def trace(url):
    img = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGBA")
    a = np.asarray(img)[..., 3] > 60
    ys = np.where(a.any(1))[0]; a = a[ys.min(): ys.max() + 1]
    xs = np.where(a.any(0))[0]; axis = (xs.min() + xs.max() + 1) / 2
    half = np.array([max(abs(np.where(r)[0].min() - axis), abs(np.where(r)[0].max() + 1 - axis)) if r.any() else 0 for r in a], float)
    # smooth the thread ridges and photographic noise: a running median over ~1.5% of the height
    k = max(3, int(len(half) * 0.015) | 1); pad = np.pad(half, k // 2, mode="edge")
    half = np.array([np.median(pad[i:i + k]) for i in range(len(half))])
    h = len(half); scale = HEIGHT / h
    if half.max() * 2 * scale > MAXW:
        scale = MAXW / (half.max() * 2)
    top = TOP + (HEIGHT - h * scale)                      # sit every bottle on the same baseline (y = 22)
    step = max(1, h // 160)
    right = [(12 + half[y] * scale, top + y * scale) for y in range(0, h, step)] + [(12 + half[-1] * scale, top + h * scale)]
    right = rdp(right, 0.12)
    left = [(24 - x, y) for x, y in reversed(right)]
    pts = right + left
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"


paths = {}
for family, body in sorted(SRC.items()):
    paths[family] = trace(body["url"])
    print(f"{family:14} {paths[family].count('L') + 1:3d} points")
json.dump(paths, open(OUT, "w"), indent=1)
open(OUT, "a").write("\n")
