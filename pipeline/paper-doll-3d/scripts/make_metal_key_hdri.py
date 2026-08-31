"""
make_metal_key_hdri.py — one key light for the metal studio.

Jordan on the raw monochrome_studio_02 reflections: "those two panels make
it messed up. It should be like a nice key light, either top left or top
right, not the whole strip of the whole cap."

Panel map of the source (measured):
  az 138.7..153.3  elev -40..+21   tall strip  -> suppress
  az 205..227      elev  +3..+25   ELEVATED    -> THE KEY (kept, boosted)
  az 277..292      elev -38..+20   tall strip  -> suppress

Everything bright outside the key window is blended down to the field, so
the cap mirrors exactly one softbox from above plus the studio's natural
ambience. Feathered azimuth window — no hard edges, no stripes.

In:  public/models/studio-mono.hdr           (Poly Haven, CC0, 2k)
Out: public/models/studio-metal-key.hdr
"""
import re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "public/models/studio-mono.hdr"
OUT = ROOT / "public/models/studio-metal-key.hdr"

KEY_LO, KEY_HI = 200.0, 232.0     # degrees, the elevated panel
FEATHER = 8.0                     # degrees of smooth edge
KEY_GAIN = 1.25                   # a touch brighter, it now works alone
BRIGHT_X = 8.0                    # "panel" = brighter than field x this


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
H, W, _ = img.shape
lum = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
field = float(np.median(lum))
az = (np.arange(W) / W) * 360.0

# feathered keep-window over azimuth
def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)

keep = smoothstep((az - (KEY_LO - FEATHER)) / FEATHER) * \
       smoothstep(((KEY_HI + FEATHER) - az) / FEATHER)
keep2d = np.tile(keep, (H, 1))

bright = lum > max(field * BRIGHT_X, 2.0)
target = np.where(bright, field + (lum - field) * (keep2d * KEY_GAIN), lum)
ratio = np.where(lum > 1e-6, target / np.maximum(lum, 1e-6), 1.0)
out = img * ratio[..., None]

write_hdr(OUT, out.astype(np.float32))
kept = (bright & (keep2d > 0.5)).sum()
killed = (bright & (keep2d <= 0.5)).sum()
print(f"[out] {OUT.name}  field {field:.3f}  key px kept {kept}  strip px suppressed {killed}")
