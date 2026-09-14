"""Crop the -wide renders to 4:3 around the ink, output 1200x900 webp tiles."""
import glob, os, sys
import numpy as np
from PIL import Image
SRC = "public/assets/sketches"
for p in sorted(glob.glob(f"{SRC}/family-*-wide.png")):
    im = Image.open(p).convert("RGB"); a = np.asarray(im).astype(int)
    paper = np.median(a.reshape(-1, 3), axis=0)
    ink = (np.abs(a - paper).sum(axis=2) > 60)
    ys, xs = np.where(ink)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0, y1 - y0
    W, H = im.size
    # window: 4:3, containing the ink bbox plus ~6% margin, clamped to the frame
    mw, mh = bw * 1.12, bh * 1.12
    if mw / mh < 4 / 3: mw = mh * 4 / 3
    else: mh = mw * 3 / 4
    mw, mh = min(mw, W), min(mh, H)
    if mw / mh > 4 / 3 + 1e-6: mw = mh * 4 / 3
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    left = min(max(cx - mw / 2, 0), W - mw); top = min(max(cy - mh / 2, 0), H - mh)
    tile = im.crop((int(left), int(top), int(left + mw), int(top + mh))).resize((1200, 900), Image.LANCZOS)
    out = p.replace("-wide.png", "-4x3.webp"); tile.save(out, "WEBP", quality=86)
    print(os.path.basename(out), f"bbox {bw}x{bh} window {int(mw)}x{int(mh)}", os.path.getsize(out) // 1024, "KB")
