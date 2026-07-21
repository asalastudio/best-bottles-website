#!/usr/bin/env python3
"""
Best Bottles — deterministic beige->transparent product keyer.

Every Best Bottles product photo we hold is shot on a smooth warm/beige studio
sweep. We key that sweep to alpha so the REAL product pixels (glass edges,
chrome, gold, black bulb + tassel) survive and drop cleanly onto the navy void.
Clear-glass interiors go semi-transparent by design, so the void shows through
the glass exactly as it would on a real dark set. No ML, no drift — pure NumPy.
"""
import sys, os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def load_rgb(p):
    im = Image.open(p).convert("RGB")
    return im, np.asarray(im).astype(np.float32)

def estimate_bg(rgb):
    """Per-row background colour from the left/right margins (the sweep is
    mostly a vertical gradient), smoothed vertically."""
    h, w, _ = rgb.shape
    m = max(6, w // 25)
    left = rgb[:, :m, :]
    right = rgb[:, -m:, :]
    margin = np.concatenate([left, right], axis=1)
    bg_row = np.median(margin, axis=1)                     # (h,3)
    # smooth along y
    for c in range(3):
        bg_row[:, c] = ndimage.uniform_filter1d(bg_row[:, c], size=max(3, h // 30))
    return bg_row[:, None, :]                               # (h,1,3)

def keyer(path, out, k=3.2, edge_boost=1.0, floor=0.0, feather=1.0,
          trim=None, sat_gate=True):
    im, rgb = load_rgb(path)
    h, w, _ = rgb.shape
    bg = estimate_bg(rgb)
    diff = np.sqrt(((rgb - bg) ** 2).mean(axis=2))         # colour distance
    d = diff / (diff.max() + 1e-6)
    alpha = np.clip(d * k, 0, 1)

    # edge energy keeps thin glass rims / thread lines crisp
    g = np.asarray(im.convert("L").filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    g = g / (g.max() + 1e-6)
    alpha = np.maximum(alpha, np.clip(g * 2.4 * edge_boost, 0, 1))

    # background is border-connected: kill any beige island the distance metric
    # left opaque, but protect enclosed product interiors.
    strong = alpha > 0.28
    filled = ndimage.binary_fill_holes(strong)
    alpha = np.where(filled, np.maximum(alpha, 0.10 if not sat_gate else alpha), alpha)

    # remove specks not attached to the main subject
    lbl, n = ndimage.label(alpha > 0.35)
    if n:
        sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
        keep = (np.argmax(sizes) + 1)
        big = lbl == keep
        big = ndimage.binary_dilation(big, iterations=max(2, w // 200))
        alpha = np.where(big | (alpha > 0.6), alpha, alpha * 0.0)

    alpha = np.clip((alpha - floor) / (1 - floor + 1e-6), 0, 1)
    a_img = Image.fromarray((alpha * 255).astype(np.uint8))
    if feather:
        a_img = a_img.filter(ImageFilter.GaussianBlur(feather))
    out_im = im.convert("RGBA")
    out_im.putalpha(a_img)

    # autocrop to content
    bbox = out_im.getbbox()
    if trim:
        bbox = (bbox[0]+trim[0], bbox[1]+trim[1], bbox[2]-trim[2], bbox[3]-trim[3])
    out_im = out_im.crop(bbox)
    out_im.save(out)
    print(f"  {os.path.basename(path)} -> {os.path.basename(out)}  {out_im.size}")
    return out_im

if __name__ == "__main__":
    SRC = "public/assets"
    OUT = "creative/best-bottles-scroll-motion/assets/cutouts"
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("vintage-spray.png", "empire_hero.png",    dict(k=3.0, edge_boost=1.1)),
        ("Assorted Closers.png", "closers.png",     dict(k=3.4, edge_boost=1.0)),
        ("hero_bottles.png", "bottles_trio.png",    dict(k=3.0, edge_boost=1.0)),
        ("Slim-BB.png", "slim.png",                 dict(k=3.0, edge_boost=1.0)),
        ("Cylinder-BB.png", "rollon.png",           dict(k=3.0, edge_boost=1.0)),
        ("CreamJars-BB.png", "creamjar.png",        dict(k=3.2, edge_boost=1.0)),
    ]
    for src, dst, kw in jobs:
        p = os.path.join(SRC, src)
        if os.path.exists(p):
            keyer(p, os.path.join(OUT, dst), **kw)
        else:
            print("  MISSING", src)
