#!/usr/bin/env python3
"""
ldr_to_env.py — turn ANY 2:1 image into a glass-safe studio environment.

WHY
  Pacdora's shipped environment (analysed 2026-08-31) is a Photoshop-painted
  picture: 512x256, max 5.8x, 99.5% of pixels under 2.6x, mild structure at
  every elevation. That means an environment can be AUTHORED AS AN IMAGE —
  Photoshop, Higgsfield, GPT-Image, a photograph — and converted, instead of
  only synthesised from ellipses. AI is fine HERE: an environment has no
  product geometry to drift.

WHAT IT DOES
  - loads the image (PNG/JPG/WebP), resizes to --width x width/2
  - sRGB -> linear
  - normalises so the median matches --median (default 0.40, Pacdora's level)
  - expands the top end with a gentle power curve so the brightest pixels
    reach --peak (default 5.0) — the glass-safe range. NOTHING can exceed it,
    so the horizon-line artefact is impossible by construction.
  - writes Radiance .hdr next to --out

USAGE
  python3 ldr_to_env.py --in room.png --out public/models/studio-room-ai.hdr
  Prompt guidance for generation: "equirectangular 360 panorama, soft beige
  photography studio interior, large softbox glow from upper left, gentle
  window light, seamless cyclorama, no hard shadows, muted, low contrast".
"""
import argparse, pathlib, sys
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("--in", dest="src", required=True)
p.add_argument("--out", required=True)
p.add_argument("--width", type=int, default=1024)
p.add_argument("--median", type=float, default=0.40)
p.add_argument("--peak", type=float, default=5.0)
a = p.parse_args()

im = Image.open(a.src).convert("RGB")
W = a.width
im = im.resize((W, W // 2), Image.LANCZOS)
x = np.asarray(im, np.float64) / 255.0
x = np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)  # -> linear

lum = x @ [0.2126, 0.7152, 0.0722]
med = np.median(lum)
if med > 1e-6:
    x *= a.median / med
# gentle highlight expansion: top of the range lifts toward --peak
lum = x @ [0.2126, 0.7152, 0.0722]
hi = np.percentile(lum, 99.9)
if hi > 1e-6:
    t = np.clip(lum / hi, 0, 1)[..., None]
    x *= 1.0 + (a.peak / max(hi, 1e-6) - 1.0) * t ** 3
x = np.clip(x, 0, a.peak).astype(np.float32)

h, w, _ = x.shape
with open(a.out, "wb") as f:
    f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
    f.write(f"-Y {h} +X {w}\n".encode())
    m = x.max(axis=2)
    e = np.zeros_like(m, dtype=np.int32)
    nz = m > 1e-32
    mant, ex = np.frexp(m[nz])
    e[nz] = ex + 128
    scale = np.zeros_like(m)
    scale[nz] = mant * 256.0 / m[nz]
    rgbe = np.zeros((h, w, 4), np.uint8)
    for k in range(3):
        rgbe[..., k] = np.clip(x[..., k] * scale, 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.clip(e, 0, 255).astype(np.uint8)
    f.write(rgbe.tobytes())
lum2 = x @ [0.2126, 0.7152, 0.0722]
print(f"{w}x{h}  median {np.median(lum2):.3f}  p99.5 {np.percentile(lum2,99.5):.2f}  max {lum2.max():.2f}")
print(f"-> {pathlib.Path(a.out).resolve()}")
