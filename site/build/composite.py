#!/usr/bin/env python3
"""
Deviation-transfer compositor: place a real Best Bottles studio photo onto the
navy void by transferring how each pixel DEVIATES from its own beige backdrop.
Clear glass -> authentic refraction/caustics on black. Chrome/gold/black tops
-> solid. No ML, deterministic, keeps 100% real product pixels.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

NAVY = np.array([5, 7, 15], np.float32)

def _rowbg(rgb):
    h, w, _ = rgb.shape
    m = max(6, w // 22)
    margin = np.concatenate([rgb[:, :m], rgb[:, -m:]], axis=1)
    bg = np.median(margin, axis=1)
    for c in range(3):
        bg[:, c] = ndimage.uniform_filter1d(bg[:, c], max(3, h // 25))
    return bg[:, None, :]

def estimate_bg(rgb, thr=26.0):
    """Smooth backdrop behind the product via nearest-background inpaint."""
    rb = _rowbg(rgb)
    dev = np.sqrt(((rgb - rb) ** 2).mean(-1))
    prod = ndimage.binary_dilation(dev > thr, iterations=3)
    if prod.all():
        return rb.repeat(rgb.shape[1], 1) if rb.shape[1] == 1 else rb
    # nearest unmasked pixel for every masked pixel
    idx = ndimage.distance_transform_edt(prod, return_distances=False, return_indices=True)
    filled = rgb[tuple(idx)]
    filled = np.asarray(Image.fromarray(filled.astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32)
    return filled

def cutout_rgba(img, thr=26.0, solid_k=0.020, glow=1.35, edge_boost=1.0,
                shadow_kill=True):
    """Return an RGBA where the product sits on transparency, rendered as it
    would look on the void: solid metal/colour + ghost-glass refraction."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    bg = estimate_bg(rgb, thr)
    dev = rgb - bg
    mag = np.sqrt((dev ** 2).mean(-1))

    # solid coverage where the product strongly departs from its backdrop
    solid = np.clip(mag / (mag.max() * solid_k + 1e-6), 0, 1)
    # edge energy for thin glass rims / threads
    L = img.convert("L").filter(ImageFilter.FIND_EDGES)
    e = np.asarray(L).astype(np.float32); e /= e.max() + 1e-6
    alpha = np.clip(np.maximum(solid, e * 2.2 * edge_boost), 0, 1)

    if shadow_kill:  # warm, low-chroma cast shadow on the sweep
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        lum = 0.299*r + 0.587*g + 0.114*b
        chroma = rgb.max(-1) - rgb.min(-1)
        darker = (lum < bg.mean(-1) - 6)
        warm = (r >= b) & (chroma < 55)
        alpha = np.where(darker & warm & (mag < thr*1.8), alpha*0.12, alpha)

    # colour on the void: navy + deviation glow, solid pixels keep real colour
    glass = np.clip(NAVY[None, None, :] + dev * glow, 0, 255)
    out_rgb = rgb  # solid areas use true product pixels
    # blend: strongly-solid -> true colour, faint -> glass glow (over navy via alpha)
    s = np.clip(mag / (mag.max()*0.10 + 1e-6), 0, 1)[..., None]
    col = out_rgb * s + glass * (1 - s)

    a = ndimage.grey_closing(alpha, size=2)
    lbl, n = ndimage.label(a > 0.4)
    if n:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n+1))
        keep = np.isin(lbl, [i+1 for i, sz in enumerate(sizes) if sz > a.size*0.0015])
        a = np.where(keep, a, 0)
    ai = Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = Image.fromarray(col.astype(np.uint8)).convert("RGBA")
    rgba.putalpha(ai)
    bb = rgba.getbbox()
    return rgba.crop(bb) if bb else rgba

if __name__ == "__main__":
    import os
    OUT = "creative/best-bottles-scroll-motion/assets/cutouts"
    tests = [("vintage-spray.png", "void_hero.png", dict(thr=24, glow=1.5)),
             ("hero_bottles.png", "void_trio.png", dict(thr=22)),
             ("Slim-BB.png", "void_slim.png", dict(thr=22)),
             ("Cylinder-BB.png", "void_rollon.png", dict(thr=22))]
    for src, dst, kw in tests:
        im = Image.open(f"public/assets/{src}")
        r = cutout_rgba(im, **kw)
        r.save(f"{OUT}/{dst}"); print(dst, r.size)
