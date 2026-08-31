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

import sys
PROFILE = ("room" if "--room" in sys.argv
           else "browser" if "--browser" in sys.argv else "cycles")

W, H = (2048, 1024) if PROFILE == "room" else (1024, 512)
_name = {"browser": "studio-browser.hdr", "room": "studio-room.hdr",
         "cycles": "studio.hdr"}[PROFILE]
OUT = pathlib.Path(__file__).resolve().parents[1] / _name
PUBLIC = pathlib.Path(__file__).resolve().parents[3] / "public" / "models" / _name

# theta = azimuth (0 = toward camera), phi = polar (0 = up)
# TWO PROFILES, because the renderers need opposite things.
#
# cycles  : dark ambient, hot emitters. A bright full-sphere field backlights
#           dense glass and floods it - measured, at density 5000 absorbing
#           everything a bottle in a bright surround still rendered mid-grey.
#
# browser : brighter ambient, and crucially WIDER, DIMMER emitters. three.js
#           shows the environment as a mirror on the surface, so a narrow hot
#           source becomes a hard white STRIPE down a cylinder - and that stripe
#           swims across the glass as the bottle rotates. Broad, feathered,
#           lower-contrast sources give a moving gradient instead, which is what
#           real studio glass looks like.
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
] if PROFILE == "cycles" else [
    # key: very large and soft - a broad gradient across the whole face
    dict(theta=-0.50, phi=0.70, wt=1.60, wp=1.00, i=5.5, c=(1.00,0.99,0.97), soft=1.00),
    dict(theta= 1.90, phi=1.00, wt=1.50, wp=1.10, i=2.6, c=(0.94,0.96,1.00), soft=1.00),
    dict(theta=-2.30, phi=1.00, wt=1.40, wp=1.00, i=2.2, c=(1.00,0.97,0.94), soft=1.00),
    # rim: WIDE and dim, not narrow and hot. A wide source wraps the edge; a
    # narrow one paints a stripe that swims when the bottle turns.
    dict(theta= math.pi-0.75, phi=1.15, wt=0.55, wp=1.10, i=6.0, c=(1,1,1), soft=1.00),
    dict(theta=-(math.pi-0.75), phi=1.15, wt=0.55, wp=1.10, i=5.0, c=(1,1,1), soft=1.00),
    dict(theta=0.0, phi=0.18, wt=math.pi, wp=0.42, i=2.4, c=(1,1,1), soft=1.00),
    # overhead scrim - soft falloff down the shoulder
    dict(theta=0.0, phi=0.16, wt=math.pi, wp=0.30, i=2.6, c=(1,1,1), soft=1.00),
] if PROFILE == "browser" else [
    # ROOM profile: the reflections themselves are the product feature
    # (Aesop-style sheen). The tent's field is featureless on purpose; a room
    # needs a FEW identifiable shapes - but the feathering law is identical:
    # soft=1.0 on everything, nothing narrow-and-hot. An in-scene Lightformer
    # version of this rig painted hard vertical lines down the cylinder
    # (2026-08-30) because rects have no falloff - that is why the room is an
    # HDRI and not JSX.
    # THE RULE, final form (settled v2-v8 against IMG_5048): an environment
    # lives at INFINITY, so ANY above-ambient source near the horizon paints
    # a FULL-HEIGHT line down a straight cylinder wall — no softness or
    # dimming trick survives, because the wall mirrors the horizon band
    # along its entire height. A real studio light sits at a finite height
    # ABOVE the bottle, so its reflection lives on the threads and shoulder
    # and never on the wall. The env equivalent (Jordan: "one or two lights
    # at the top"): ALL punch goes HIGH in the sphere (small phi), which
    # only upward-facing surfaces can mirror; the horizon band stays a
    # near-uniform gentle field so the wall carries a gradient and NOTHING
    # ELSE. No rim columns, no face dome, no window shape. Ever.
    # top light 1: warm, above front-left — thread/shoulder/ledge accents
    dict(theta=-0.50, phi=0.35, wt=1.00, wp=0.45, i=7.0, c=(1.00,0.99,0.96), soft=0.80),
    # top light 2: cooler, above right — the second accent
    dict(theta= 0.90, phi=0.40, wt=0.60, wp=0.40, i=5.0, c=(0.94,0.96,1.00), soft=0.70),
    # horizon band: one VERY wide, VERY gentle warm gradient for the body
    dict(theta=-0.35, phi=0.95, wt=1.60, wp=1.10, i=1.5, c=(1.00,0.99,0.96), soft=1.00),
    # behind: wide soft bounce, keeps the far wall alive through the glass
    dict(theta= math.pi, phi=1.05, wt=1.30, wp=1.00, i=1.4, c=(1.00,0.98,0.95), soft=1.00),
    # overhead scrim - soft; mirrors on the shelf and thread tops
    dict(theta=0.0, phi=0.16, wt=math.pi, wp=0.34, i=2.6, c=(1,1,1), soft=0.90),
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
    if PROFILE == "browser":
        sky = 0.28 + 0.55 * smoothstep(-0.85, 0.95, up)
        floor = 0.22 * smoothstep(0.10, -1.00, up)
    elif PROFILE == "room":
        # a touch darker than the tent so the window and key READ in the
        # reflection; floor warmed toward the Aesop tan work surface
        sky = 0.20 + 0.42 * smoothstep(-0.85, 0.95, up)
        floor = 0.26 * smoothstep(0.10, -1.00, up)
    else:
        sky = 0.030 + 0.075 * smoothstep(-0.85, 0.95, up)
        floor = 0.020 * smoothstep(0.10, -1.00, up)
    fw = (1.00, 0.96, 0.90) if PROFILE != "room" else (1.06, 0.94, 0.80)
    img = np.stack([sky * 0.97 + floor * fw[0],
                    sky * 0.98 + floor * fw[1],
                    sky * 1.00 + floor * fw[2]], axis=-1)

    if PROFILE == "room":
        # dark zones BEFORE the emitters: a cylinder's flanks mirror the
        # sideways/behind directions, and reflections only read where the
        # mirrored world is darker or brighter than the transmitted backdrop.
        # A uniform bright field erases them - measured on the 9 ml amber,
        # which rendered matte until these went in. Fully feathered.
        # v5 (Aesop reference): side dark zones REMOVED — they occupied the
        # directions the silhouette edges mirror, erasing the thin bright rim
        # lines that are Aesop glass's signature. Edge darkness comes free
        # from tangential absorption; the env's job at the sides is the
        # BRIGHT line, not more dark. Only the behind-camera zone remains,
        # for front-face sheen contrast.
        for zt, zp, wt, wp, depth in [(3.14159, 1.10, 0.80, 0.90, 0.55)]:
            dt = np.abs((T - zt + math.pi) % (2 * math.pi) - math.pi) / wt
            dp = np.abs(P - zp) / wp
            f = smoothstep(1.0, 0.0, np.hypot(dt, dp))
            img *= (1.0 - depth * f)[..., None]

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
