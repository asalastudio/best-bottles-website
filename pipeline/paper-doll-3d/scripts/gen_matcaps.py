#!/usr/bin/env python3
"""
gen_matcaps.py — bake OUR matcaps from the chrome-studio HDRI.

WHY (Three.js Journey, materials lesson — Jordan, 2026-08-31): small metal
parts want MeshMatcapMaterial: an entire studio lighting setup baked into a
mirrored-sphere image, so the part looks perfectly lit from every angle in
every scene, at zero runtime cost. Community matcap repos are unlicensed
grab-bags; ours are baked from our own studio-metal.hdr, so the look is
owned, deterministic and regenerable.

Emits public/models/matcaps/{steel,gold,copper-matte,silver-matte}.png
"""
import re, pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[3]
HDR = ROOT / "public" / "models" / "studio-metal.hdr"
OUT = ROOT / "public" / "models" / "matcaps"
SIZE = 512

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
                    if c > 128: sl[x:x+c-128, ch] = buf[o]; o += 1; x += c - 128
                    else: sl[x:x+c, ch] = np.frombuffer(buf[o:o+c], np.uint8); o += c; x += c
        else:
            sl = np.frombuffer(buf[o:o+W*4], np.uint8).reshape(W, 4).copy(); o += W * 4
        e = sl[:, 3].astype(np.int32)
        img[y] = sl[:, :3].astype(np.float32) * np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)[:, None]
    return img

env = read_hdr(HDR)
EH, EW, _ = env.shape

yy, xx = np.mgrid[0:SIZE, 0:SIZE]
nx = (xx + 0.5) / SIZE * 2 - 1
ny = -((yy + 0.5) / SIZE * 2 - 1)
r2 = nx * nx + ny * ny
inside = r2 <= 1.0
nz = np.sqrt(np.clip(1 - r2, 0, 1))
# reflect view v=(0,0,1) about normal n: r = 2(n.v)n - v
rx, ry, rz = 2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1
theta = np.arctan2(rx, rz)                       # azimuth
phi = np.arccos(np.clip(ry, -1, 1))              # polar from +Y
u = ((theta + np.pi) / (2 * np.pi) * EW).astype(int) % EW
v = np.clip((phi / np.pi * EH).astype(int), 0, EH - 1)
sample = env[v, u]                                # HxWx3 radiance

def emit(name, tint=(1, 1, 1), blur=0, gain=1.0):
    x = sample * np.array(tint) * gain
    x = x / (1.0 + x)                              # Reinhard
    x = np.clip(x, 0, 1) ** (1 / 2.2)
    x[~inside] = 0
    img = Image.fromarray((x * 255).astype(np.uint8))
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png")
    print(f"  {name}.png")

print("matcaps:")
emit("steel", (1.0, 1.0, 1.02), blur=0, gain=1.3)
emit("gold", (1.05, 0.82, 0.45), blur=0, gain=1.25)
emit("silver-matte", (1.0, 1.0, 1.0), blur=7, gain=1.0)
emit("gold-matte", (1.05, 0.82, 0.45), blur=7, gain=1.0)
emit("copper-matte", (1.05, 0.62, 0.45), blur=7, gain=1.0)
