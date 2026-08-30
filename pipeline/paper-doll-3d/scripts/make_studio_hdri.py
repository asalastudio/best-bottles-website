#!/usr/bin/env python3
"""
Generate ONE studio HDRI that Blender and three.js both load.

WHY THIS IS THE BRIDGE
----------------------
Glass has no colour of its own - it renders its ENVIRONMENT. So matching glass
between two renderers needs TWO things transferred, not one:

  1. the absorption coefficient   (sigma, solved from a photograph)
  2. the environment              (this file)

Transfer only the material and the two renderers still disagree, because each
is refracting a different world. That is why "tuned in Blender, looks wrong in
the browser" keeps happening.

Written as Radiance .hdr (RGBE) because both sides read it natively:
    Blender   world -> Environment Texture -> studio.hdr
    three.js  RGBELoader / <Environment files="/models/studio.hdr" />

NO HARD-EDGED EMITTERS. A bottle is a lens, so any small bright rectangle
becomes a crisp white card floating in the glass - the single most common
reason CG glass reads as fake. Every emitter here is an ellipse with a
feathered shoulder, over a continuous gradient, which is what a real light
tent does.

    python3 scripts/make_studio_hdri.py
"""
import math, pathlib, struct
import numpy as np

W, H = 1024, 512
OUT = pathlib.Path(__file__).resolve().parents[1] / "studio.hdr"
PUBLIC = pathlib.Path(__file__).resolve().parents[3] / "public" / "models" / "studio.hdr"

# theta = azimuth (0 = toward camera), phi = polar (0 = up)
EMITTERS = [
    # key: large, high, front-left - the main modelling light
    dict(theta=-0.45, phi=0.62, wt=0.95, wp=0.62, i=9.0,  c=(1.00, 0.99, 0.97), soft=0.90),
    # broad fills - the "room"; keeps the body from going dead
    dict(theta= 2.05, phi=1.02, wt=1.15, wp=0.85, i=2.2,  c=(0.93, 0.96, 1.00), soft=1.00),
    dict(theta=-2.15, phi=1.00, wt=1.05, wp=0.80, i=1.9,  c=(1.00, 0.97, 0.93), soft=1.00),
    # the rim pair, behind and narrow: the bright vertical outline that says
    # "transparent". Narrow, but still feathered - never a hard bar.
    dict(theta= math.pi-0.62, phi=1.12, wt=0.13, wp=0.85, i=22.0, c=(1,1,1), soft=0.70),
    dict(theta=-(math.pi-0.62), phi=1.12, wt=0.13, wp=0.85, i=19.0, c=(1,1,1), soft=0.70),
    # overhead scrim - soft falloff down the shoulder
    dict(theta=0.0, phi=0.16, wt=math.pi, wp=0.30, i=2.6, c=(1,1,1), soft=1.00),
]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def build():
    phi = (np.arange(H) + 0.5) / H * math.pi
    theta = (np.arange(W) + 0.5) / W * 2 * math.pi - math.pi
    P, T = np.meshgrid(phi, theta, indexing="ij")

    # DARK AMBIENT, BRIGHT EMITTERS - this is how glass is actually shot.
    # A bright base field fills the whole sphere and BACKLIGHTS the bottle from
    # every direction at once, which floods dense amber to pale cream no matter
    # what the absorption says. Measured: at density 5000 absorbing everything,
    # a bottle in a bright surround still rendered mid-grey - a floor no
    # material value can get under. Drop the ambient and the same material
    # reads as real amber.
    up = np.cos(P)
    sky = 0.030 + 0.075 * smoothstep(-0.85, 0.95, up)
    floor = 0.020 * smoothstep(0.10, -1.00, up)
    img = np.stack([sky * 0.97 + floor * 1.00,
                    sky * 0.98 + floor * 0.96,
                    sky * 1.00 + floor * 0.90], axis=-1)

    for e in EMITTERS:
        dt = np.abs((T - e["theta"] + math.pi) % (2 * math.pi) - math.pi) / e["wt"]
        dp = np.abs(P - e["phi"]) / e["wp"]
        d = np.hypot(dt, dp)
        inner = 1.0 - e["soft"]
        f = smoothstep(1.0, inner, d) if e["soft"] > 0 else (d < 1).astype(float)
        for k in range(3):
            img[..., k] += e["i"] * e["c"][k] * f
    return img.astype(np.float32)


def write_hdr(path, img):
    """Radiance RGBE. Written by hand so this needs nothing but numpy."""
    h, w, _ = img.shape
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        m = img.max(axis=2)
        e = np.zeros_like(m, dtype=np.int32)
        nz = m > 1e-32
        mant, ex = np.frexp(m[nz])
        e[nz] = ex + 128
        scale = np.zeros_like(m)
        scale[nz] = mant * 256.0 / m[nz]
        rgbe = np.zeros((h, w, 4), dtype=np.uint8)
        for k in range(3):
            rgbe[..., k] = np.clip(img[..., k] * scale, 0, 255).astype(np.uint8)
        rgbe[..., 3] = np.clip(e, 0, 255).astype(np.uint8)
        f.write(rgbe.tobytes())


if __name__ == "__main__":
    img = build()
    write_hdr(OUT, img)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    write_hdr(PUBLIC, img)
    print(f"{W}x{H} equirect HDR")
    print(f"  range {img.min():.3f} .. {img.max():.1f}  (values >1 are the light sources)")
    print(f"  -> {OUT}")
    print(f"  -> {PUBLIC}")
