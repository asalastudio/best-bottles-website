#!/usr/bin/env python3
"""
clean_studio_hdri.py — keep a real studio's panels, launder its clutter.

Jordan, 2026-08-31: the real-studio HDRI gives the chrome caps their
beautiful shine at the equator, but orbiting UP mirrors the studio's
ceiling rig — "way too busy". A mirror needs the panel band, not the
scaffolding. This replaces the zenith (and optionally the floor) with its
own smooth azimuthal average, feathered into the untouched equator band.

  python3 clean_studio_hdri.py --in studio-universal.hdr \
      --out studio-universal.hdr --zenith-deg 55 --floor-deg 130
"""
import argparse, re
import numpy as np

def read_hdr(path):
    data = open(path, "rb").read()
    m = re.search(rb"-Y (\d+) \+X (\d+)\n", data[:2000])
    H, W = int(m.group(1)), int(m.group(2)); pos = m.end()
    img = np.zeros((H, W, 3), np.float32); buf = data[pos:]; o = 0
    for y in range(H):
        if buf[o] == 2 and buf[o+1] == 2:
            o += 4; sl = np.zeros((W, 4), np.uint8)
            for ch in range(4):
                x = 0
                while x < W:
                    c = buf[o]; o += 1
                    if c > 128: sl[x:x+c-128, ch] = buf[o]; o += 1; x += c-128
                    else: sl[x:x+c, ch] = np.frombuffer(buf[o:o+c], np.uint8); o += c; x += c
        else:
            sl = np.frombuffer(buf[o:o+W*4], np.uint8).reshape(W, 4).copy(); o += W*4
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

p = argparse.ArgumentParser()
p.add_argument("--in", dest="src", required=True)
p.add_argument("--out", required=True)
p.add_argument("--zenith-deg", type=float, default=55.0,
               help="everything above this polar angle becomes smooth")
p.add_argument("--floor-deg", type=float, default=132.0,
               help="everything below this becomes smooth")
p.add_argument("--feather-deg", type=float, default=14.0)
p.add_argument("--panels-only", action="store_true",
               help="keep ONLY the light panels (luminance mask); everything "
                    "else - walls, props, doorways, rig - becomes the smooth "
                    "field. Real lights, empty room: the universal chrome "
                    "studio (Jordan: the equator props corrupted the cap "
                    "straight-on).")
p.add_argument("--panel-lo", type=float, default=1.3)
p.add_argument("--panel-hi", type=float, default=3.0)
a = p.parse_args()

img = read_hdr(a.src)
H, W, _ = img.shape
phi = (np.arange(H) + 0.5) / H * 180.0
smooth = img.mean(axis=1, keepdims=True) * np.ones((1, W, 1), np.float32)
# vertical soften of the azimuthal mean so no ring artefacts remain
k = max(3, H // 48) | 1
pad = np.pad(smooth, ((k//2, k//2), (0, 0), (0, 0)), mode="edge")
smooth = np.stack([np.convolve(pad[:, 0, c], np.ones(k)/k, mode="valid")
                   for c in range(3)], axis=-1)[:, None, :] * np.ones((1, W, 1), np.float32)
if a.panels_only:
    lum_src = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    t = np.clip((lum_src - a.panel_lo) / (a.panel_hi - a.panel_lo), 0, 1)
    mask = (t * t * (3 - 2 * t))[:, :, None]
    out = smooth * (1 - mask) + img * mask
else:
    wz = np.clip((a.zenith_deg + a.feather_deg - phi) / a.feather_deg, 0, 1)   # 1 above
    wf = np.clip((phi - (a.floor_deg - a.feather_deg)) / a.feather_deg, 0, 1)  # 1 below
    w = np.maximum(wz, wf)[:, None, None]
    out = img * (1 - w) + smooth * w
write_hdr(a.out, out.astype(np.float32))
lum = out @ np.array([0.2126, 0.7152, 0.0722])
print(f"cleaned: zenith<= {a.zenith_deg} deg and floor >= {a.floor_deg} deg "
      f"smoothed; equator band untouched. mean {lum.mean():.3f} max {lum.max():.1f}")
