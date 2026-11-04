"""A black-cap catalog photograph for the 2 ml amber 13-425 vial (GBVAmb1o5BlackCapSht), from two approved heroes.

Jordan (4 Nov 2026): "the black cap can be selected on the product grid ... only the white cap for the 2 ml amber".
The black-cap SKU had no photograph (only a dead old-site GIF), so picking it kept the white-cap hero. No new image is
drawn: the approved white-cap hero (GBVialAmb1o5WhtCapSht) keeps its bottle, ground and light; its translucent white
cap is cleared to the ground (each row interpolated across the cap) and the same 13-425 short black cap, with its own
contact shadow, is taken from the approved 3 ml cobalt hero (GBVBlu1o9BlackCapSht) as a multiply layer (the photograph over its own ground, its margin faded),
scaled to the white cap's width and stood on the white cap's foot, centred where it stood.
Writes the 1560x1716 PNG to <out> (default docs/hero-families/vial2-black-cap-2026-11-04/GBVAmb1o5BlackCapSht.png).
Usage: python3 scripts/catalog-heroes/vial2-black-cap-2026-11-04.py [out]
"""
import json, os, sys
import numpy as np
from PIL import Image

BONE = np.array([245, 243, 239], float)
RELEASE = "src/lib/products/catalog-hero-vials-release.json"
OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/hero-families/vial2-black-cap-2026-11-04/GBVAmb1o5BlackCapSht.png"


def hero(sku):
    row = next(r for r in json.load(open(RELEASE)) if r["websiteSku"] == sku)
    return np.asarray(Image.open("public" + row["url"]).convert("RGB")).astype(float), row["url"]


def cap_box(a, x_from, dark=False):
    """The cap's box right of `x_from`: its sides where the ground difference is strong (> 60; the contact shadow and
    the bottle's reflection stay under it), its foot the lowest strong row, its top the run of rows above it that differ (> 25) between those sides.
    A black cap is found by its dark pixels."""
    if dark:
        d = a.max(2) < 120; d[:, :x_from] = False
        ys, xs = np.where(d); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    diff = np.abs(a - BONE).max(2); diff[:, :x_from] = 0
    strong = diff > 60; xs = np.where(strong.any(0))[0]; x0, x1 = xs.min(), xs.max() + 1
    on = (diff[:, x0 + 4:x1 - 4] > 25).any(1); foot = int(np.where((diff[:, x0:x1] > 60).any(1))[0].max())
    top = foot
    while top > 0 and on[top - 1]:
        top -= 1
    return x0, top, x1, foot + 1


def ground(a, x0, y0, x1, y1, right_only=False):
    """The ground under a box: each row interpolated between the 6 px just outside its sides (or, beside a bottle,
    the open right side's 6 px held across the row)."""
    g = a.copy(); t = np.linspace(0, 1, x1 - x0)[:, None]
    for y in range(y0, y1):
        r = a[y, x1:x1 + 6].mean(0); l = r if right_only else a[y, x0 - 6:x0].mean(0)
        g[y, x0:x1] = l * (1 - t) + r * t
    return g


def main():
    white, white_url = hero("GBVialAmb1o5WhtCapSht")
    blue, blue_url = hero("GBVBlu1o9BlackCapSht")
    wx0, wy0, wx1, wy1 = cap_box(white, 785)
    bx0, by0, bx1, by1 = cap_box(blue, 790, dark=True)
    # 1. Clear the white cap (and its contact shadow) to the ground.
    m = 28   # the left margin stays 4 px off the cap: left of it lies the amber bottle's floor reflection
    out = ground(white, wx0 - 4, wy0 - m, wx1 + m, min(white.shape[0] - 1, wy1 + m))
    # 2. The black cap with its own contact shadow, as a multiply layer: the cobalt photograph over its own ground
    #    (so its ground reads 1 and leaves no seam), the layer's margin faded to 1.
    #    The cobalt bottle stands 30 px left of the cap: the crop keeps 20 px on that side, the ground is read right.
    pad, lpad = 40, 20; X0, Y0, X1, Y1 = bx0 - lpad, by0 - pad, bx1 + pad, by1 + pad
    layer = (blue / np.maximum(ground(blue, X0, Y0, X1, Y1, right_only=True), 1))[Y0:Y1, X0:X1].clip(0, 1)
    h, w = layer.shape[:2]
    ramp = lambda n, p: np.clip(np.minimum(np.arange(n), np.arange(n)[::-1]) / p, 0, 1)
    fade = np.minimum.outer(ramp(h, 24), ramp(w, 12))[..., None]
    layer = 1 + (layer - 1) * fade
    s = (wx1 - wx0) / (bx1 - bx0)
    layer = np.stack([np.asarray(Image.fromarray(layer[..., c].astype(np.float32), "F").resize((round(w * s), round(h * s)), Image.LANCZOS)) for c in range(3)], 2)
    # The black cap's foot on the white cap's foot, centred on the white cap's axis.
    cx = (wx0 + wx1) / 2; foot = wy1
    left = round(cx - ((bx0 + bx1) / 2 - X0) * s); top = round(foot - (by1 - by0 + pad) * s)
    region = out[top:top + layer.shape[0], left:left + layer.shape[1]]
    out[top:top + layer.shape[0], left:left + layer.shape[1]] = region * layer[:region.shape[0], :region.shape[1]]
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    Image.fromarray(out.clip(0, 255).round().astype(np.uint8)).save(OUT)
    print(json.dumps({"out": OUT, "whiteCap": [int(v) for v in (wx0, wy0, wx1, wy1)], "blackCap": [int(v) for v in (bx0, by0, bx1, by1)],
                      "scale": round(s, 4), "sources": [white_url, blue_url]}))


if __name__ == "__main__":
    main()
