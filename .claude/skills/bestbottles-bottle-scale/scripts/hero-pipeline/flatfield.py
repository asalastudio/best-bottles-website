"""Put every render back on exact bone, keeping its rendered shadow.

The model paints its own studio paper: close to #F5F3EF but off by a few levels, sometimes with a
gentle gradient across the frame. The registry requires the corners within 2/255 of bone.

A shadow is a darkening on top of the paper, so the paper can be removed without touching it: fit a
smooth colour surface to the pixels well clear of the product and its shadow, subtract that surface
and add bone back. Product and shadow keep their offset from the paper; the paper becomes exact.
No AI, no geometry change.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

from hero_paths import WORK as S
BONE = np.array((245.0, 243.0, 239.0))
IN, OUT = f"{S}/cyl-final", f"{S}/cyl-bone"


def paper_mask(a):
    """True where the pixel is plain paper: far from the product and from its shadow."""
    local = ndimage.median_filter(a.mean(axis=2), size=31)
    dev = np.abs(a.mean(axis=2) - local) > 2.5              # edges, texture, product detail
    dark = a.mean(axis=2) < np.percentile(a.mean(axis=2), 60) - 6
    busy = ndimage.binary_dilation(dev | dark, iterations=45)
    return ~busy


def fit_surface(a, keep):
    """Per-channel 2-D quadratic through the paper pixels."""
    H, W, _ = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    x, y = xx / W - 0.5, yy / H - 0.5
    basis = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=-1)
    step = 4                                                # subsample for speed
    sel = keep[::step, ::step]
    B = basis[::step, ::step][sel]
    surf = np.empty_like(a)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(B, a[::step, ::step, c][sel], rcond=None)
        surf[..., c] = basis @ coef
    return surf


def corners(a, k=60):
    return max(np.abs(c.reshape(-1, 3).mean(axis=0) - BONE).max()
               for c in (a[:k, :k], a[:k, -k:], a[-k:, :k], a[-k:, -k:]))


def run(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float64)
    keep = paper_mask(a)
    surf = fit_surface(a, keep)
    out = np.clip(a - surf + BONE, 0, 255)
    before, after = corners(a), corners(out)
    name = os.path.basename(path).replace(".REJECTED", "")
    Image.fromarray(np.round(out).astype(np.uint8)).save(f"{OUT}/{name}")
    return dict(sku=name[:-4], before=round(float(before), 2), after=round(float(after), 2),
                paperShare=round(float(keep.mean()), 3))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    paths = [p for p in sorted(glob.glob(f"{IN}/*.png*")) if "/_" not in p]
    res = [run(p) for p in paths]
    json.dump(res, open(f"{S}/cyl-bone.json", "w"), indent=1)
    ok = sum(1 for r in res if r["after"] <= 2)
    print(f"corrected {len(res)}   corners within 2/255: before "
          f"{sum(1 for r in res if r['before'] <= 2)}  after {ok}")
    worst = max(res, key=lambda r: r["after"])
    print(f"worst after correction: {worst['sku']} {worst['after']}/255")
