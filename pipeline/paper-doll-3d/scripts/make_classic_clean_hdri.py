"""
make_classic_clean_hdri.py — lift the darks out of the classic metal studio.

Measured truth of raw studio_small_03: HALF the environment is near-black
(median luminance 0.011, p75 0.315, highlights to 3300+). A polished metal
mirrors that darkness as the "big dark elements" Jordan flagged in the
gold and black reflections. The softboxes are right; the ROOM is too dark.

Fix: smooth-max shadow lift. L' = sqrt(L^2 + F^2) raises everything below
the floor F toward it, barely touches anything brighter, and leaves the
highlights exactly alone — the reflection keeps its structure but loses
the black holes. Very dark pixels carry noisy hue, so they blend toward
neutral instead of amplifying noise chroma.

In:  public/models/studio-classic.hdr        (raw Poly Haven studio_small_03)
Out: public/models/studio-classic-clean.hdr
"""
import re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "public/models/studio-classic.hdr"
OUT = ROOT / "public/models/studio-classic-clean.hdr"

FLOOR = 0.24        # shadow floor: between the room's p50 and p75
NEUTRAL_BELOW = 0.05  # pixels darker than this blend toward neutral grey


def read_hdr(path):
    data = open(path, "rb").read()
    m = re.search(rb"-Y (\d+) \+X (\d+)\n", data[:2000])
    H, W = int(m.group(1)), int(m.group(2)); pos = m.end()
    img = np.zeros((H, W, 3), np.float32); buf = data[pos:]; o = 0
    for y in range(H):
        if buf[o] == 2 and buf[o + 1] == 2:
            o += 4; sl = np.zeros((W, 4), np.uint8)
            for ch in range(4):
                x = 0
                while x < W:
                    c = buf[o]; o += 1
                    if c > 128: sl[x:x + c - 128, ch] = buf[o]; o += 1; x += c - 128
                    else: sl[x:x + c, ch] = np.frombuffer(buf[o:o + c], np.uint8); o += c; x += c
        else:
            sl = np.frombuffer(buf[o:o + W * 4], np.uint8).reshape(W, 4).copy(); o += W * 4
        e = sl[:, 3].astype(np.int32)
        img[y] = sl[:, :3].astype(np.float32) * np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)[:, None]
    return img


def write_hdr(path, img):
    h, w, _ = img.shape
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        m = img.max(axis=2)
        e = np.zeros_like(m, dtype=np.int32)
        nz = m > 1e-32
        mant, ex = np.frexp(m[nz]); e[nz] = ex + 128
        scale = np.zeros_like(m); scale[nz] = mant * 256.0 / m[nz]
        rgbe = np.zeros((h, w, 4), np.uint8)
        for k in range(3):
            rgbe[..., k] = np.clip(img[..., k] * scale, 0, 255).astype(np.uint8)
        rgbe[..., 3] = np.clip(e, 0, 255).astype(np.uint8)
        f.write(rgbe.tobytes())


img = read_hdr(SRC)
lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
lifted = np.sqrt(lum * lum + FLOOR * FLOOR)

# chroma-preserving where the pixel has real colour; neutral where it is
# noise-dark (a huge ratio on a noisy hue invents colour that isn't there)
ratio = lifted / np.maximum(lum, 1e-6)
w = np.clip(lum / NEUTRAL_BELOW, 0.0, 1.0)
w = w * w * (3 - 2 * w)
chroma = img * ratio[..., None]
neutral = np.repeat(lifted[..., None], 3, axis=2)
out = w[..., None] * chroma + (1.0 - w[..., None]) * neutral

write_hdr(OUT, out.astype(np.float32))
nl = 0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2]
qs = np.percentile(nl, [1, 25, 50, 75, 99])
print(f"[out] {OUT.name}  new percentiles 1/25/50/75/99:",
      [round(float(v), 3) for v in qs], " max", round(float(nl.max()), 1))
