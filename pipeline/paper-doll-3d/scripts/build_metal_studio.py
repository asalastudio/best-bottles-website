"""
build_metal_studio.py — synthesize the metal-component studio HDRI.

Why synthetic: the laundered Poly Haven studio kept a narrow hot panel near
the camera axis, and a vertical cylinder smears any narrow source into a
full-height stripe (Jordan: "a white line down the middle... not a really
good way to show a highlight"; same physics as the glass no-horizon rule).
Roughness/intensity sliders cannot move a reflection — only the environment
can. So the environment is designed for cylinders:

- every source is WIDE (>=40 deg azimuth span) with smooth falloff, so a
  cylinder shows a broad graded sheen, never a line;
- the key panel sits ~40 deg LEFT of the camera axis (Jordan: "the shine
  element needs to go to the left side for accent");
- a dimmer fill right, a soft overhead dome (punch stays above, per the
  glass rule), a modest back rim for silhouette edges;
- the floor hemisphere stays dark so metals keep contrast (ACES washes
  hue out of anything driven to clip).

Writes public/models/studio-universal.hdr (equirect 2048x1024 RGBE).
"""
import numpy as np
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "public/models/studio-universal.hdr"
W, H = 2048, 1024

# u: azimuth phi in [-180, 180) with 0 at u=0.5 ; v: elevation +90 (top) .. -90
phi = (np.linspace(0, 1, W, endpoint=False) - 0.5) * 360.0
theta = 90.0 - np.linspace(0, 1, H, endpoint=False) * 180.0
PHI, THETA = np.meshgrid(phi, theta)


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def panel(center_phi, half_phi, lo_theta, hi_theta, peak, grad_up=0.45):
    """A soft-edged area source. grad_up dims the top edge relative to the
    bottom so the sheen falls off elegantly up the cap."""
    d = np.abs(((PHI - center_phi + 180.0) % 360.0) - 180.0)
    az = smooth(1.0 - d / half_phi)
    el = smooth((THETA - lo_theta) / 8.0) * smooth((hi_theta - THETA) / 8.0)
    span = max(1e-6, hi_theta - lo_theta)
    vgrad = 1.0 - grad_up * np.clip((THETA - lo_theta) / span, 0, 1)
    return peak * az * el * vgrad


img = np.zeros((H, W, 3), np.float32)

# ambient field: dark floor, mild upper hemisphere
field = np.where(THETA > 0.0, 0.20, 0.07).astype(np.float32)
field += 0.06 * smooth((THETA - 20.0) / 70.0)
img += field[..., None]

# key: broad panel left of camera — the accent sheen
img += panel(-40.0, 32.0, 4.0, 62.0, 9.0)[..., None]
# fill: dimmer, right side
img += panel(55.0, 22.0, 0.0, 46.0, 2.6)[..., None]
# back rim: silhouette edges
img += panel(178.0, 18.0, 8.0, 52.0, 3.5)[..., None]
# overhead dome
img += (1.6 * smooth((THETA - 58.0) / 14.0))[..., None]

# neutral studio: mirrors have no colour of their own — keep it white
# (brown_photostudio turned silver sepia; "the silver went wacky")


# RGBE writer — byte-identical convention to clean_studio_hdri.py
def write_hdr(path, im):
    h, w, _ = im.shape
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        m = im.max(axis=2)
        e = np.zeros_like(m, dtype=np.int32)
        nz = m > 1e-32
        mant, ex = np.frexp(m[nz]); e[nz] = ex + 128
        scale = np.zeros_like(m); scale[nz] = mant * 256.0 / m[nz]
        rgbe = np.zeros((h, w, 4), np.uint8)
        for k in range(3):
            rgbe[..., k] = np.clip(im[..., k] * scale, 0, 255).astype(np.uint8)
        rgbe[..., 3] = np.clip(e, 0, 255).astype(np.uint8)
        f.write(rgbe.tobytes())


write_hdr(OUT, img)
print(f"[out] {OUT.name}  {W}x{H}  field {field.mean():.2f}  peak {img.max():.1f}")
