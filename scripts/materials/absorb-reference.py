#!/usr/bin/env python3
"""absorb-reference.py — read a product photograph, emit geometry + light.

Jordan: "can we train the agent to automatically take the colors and the
qualities and all of the specificities of the object and absorb it into
the render?" This is that. Two things come out of one photograph, and
neither is a guess or a fit:

  --silhouette   the object's LATHE PROFILE, traced.
                 A cap is a surface of revolution, so its outline IS its
                 profile. Fitting a corner radius to it throws away the
                 measurement; tracing keeps it. Jordan: "we need to
                 recreate this exact silhouette in Blender".

  --shading      the ENVIRONMENT that produced the photograph's sheen.
                 On a cylinder shot square on, screen x maps to surface
                 normal azimuth by arcsin, so the horizontal brightness
                 profile is a direct sample of reflected radiance against
                 angle. Invert it and you have the studio that lit the
                 shot -- which is what puts "that light soft colour down
                 the middle and the two pale reflections" on OUR render
                 at the right angles, instead of us dialling sliders
                 until it looks close.

CAMERA. Both rims of a cylinder curve in the frame when the camera sits
off square. The BOTTOM rim of a moulded cap is a sharp cut with no
roundover, so whatever curvature it shows is pure camera and can be
measured and removed. On CpRoll17-415PnkDot that is 0.19 mm, a 1.2 degree
elevation. Small, but it must come off the top too or the photographer's
angle gets baked into the mesh -- where it would be wrong under our
square-on render.

  python3 scripts/materials/absorb-reference.py REF.png --silhouette \
      --height-mm 27.0 --diameter-mm 19.0 --out data/profiles/cap17415.json
  python3 scripts/materials/absorb-reference.py REF.png --shading \
      --out public/models/env-from-ref.hdr
"""
import argparse, json, math, pathlib, sys
import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except ImportError:
    ndimage = None


# ----------------------------------------------------------------- shared

def load_mask(path, thresh=246):
    """The object against its white sweep, plus its bbox in pixels."""
    rgb = np.array(Image.open(path).convert("RGB")).astype(float)
    lum = rgb.mean(axis=2)
    part = lum < thresh
    if not part.any():
        raise SystemExit(f"nothing found in {path} below luminance {thresh}")
    ys, xs = np.where(part)
    return rgb, lum, part, (xs.min(), xs.max(), ys.min(), ys.max())


def half_widths(part, box):
    """Half-width in px per scanline, bottom-up, and the widest value."""
    x0, x1, y0, y1 = box
    rows = []
    for y in range(y0, y1 + 1):
        xr = np.where(part[y])[0]
        if len(xr):
            rows.append(((y1 - y), (xr.max() - xr.min() + 1) / 2.0))
    rows.sort()                    # ascending height: rows[0] IS the bottom
    return rows


def camera_tilt(rows, R_px):
    """Apparent rim curvature at the BOTTOM, in px.

    A moulded cap's bottom is a sharp cut, so this is entirely the camera
    being off square. Returns (px, degrees)."""
    for up, hw in rows:                       # ascending height from the base
        if hw >= 0.97 * R_px:
            return up, math.degrees(math.asin(min(1.0, up / R_px)))
    return 0.0, 0.0


# ------------------------------------------------------------- silhouette

def trace_silhouette(path, height_mm, diameter_mm, points):
    rgb, lum, part, box = load_mask(path)
    x0, x1, y0, y1 = box
    rows = half_widths(part, box)
    R_px = max(hw for _, hw in rows)
    H_px = max(up for up, _ in rows)

    # TWO scales, deliberately. z comes from the published HEIGHT and r from
    # the published DIAMETER; using one scale for both would fold any
    # anisotropy in the photograph into the part's proportions.
    mm_z = height_mm / H_px
    mm_r = (diameter_mm / 2.0) / R_px

    tilt_px, tilt_deg = camera_tilt(rows, R_px)

    prof = []
    for up, hw in rows:
        z, r = up * mm_z, hw * mm_r
        # Below the tilt band the outline is the bottom rim ELLIPSE, not the
        # wall. A sharp moulded cut has no such curvature, so drop it and let
        # the wall run straight down to z = 0.
        if up < tilt_px:
            continue
        prof.append((r, z))
    if not prof:
        raise SystemExit("silhouette trace produced nothing")
    prof.sort(key=lambda p: p[1])

    # STRAIGHTEN THE WALL, TRACE THE CROWN. Two reasons, both physical:
    #
    #  1. A pixel is 0.065 mm here, so a raw trace quantises the radius into
    #     0.033 mm steps. On a lathe those become concentric ridges, and
    #     under a specular lobe you see every one of them.
    #  2. An injection-moulded cap wall is STRAIGHT by construction. The
    #     photograph reads it as flaring 0.46 mm over 24 mm, which is ~7 px
    #     and within its own lens error, and the published listing says it
    #     tapers the other way. A 0.2 mm measurement does not get to
    #     overturn "walls are straight" -- so the wall is least-squares
    #     fitted to a line and the trace is kept only where it carries real
    #     information: the crown, where curvature is large and unambiguous.
    r_all = np.array([q[0] for q in prof]); z_all = np.array([q[1] for q in prof])
    R_max = r_all.max()
    dome_i = len(r_all) - 1
    while dome_i > 0 and r_all[dome_i] < 0.995 * R_max:
        dome_i -= 1
    dome_z = z_all[dome_i]
    wall = z_all <= dome_z
    if wall.sum() >= 8:
        m, b = np.polyfit(z_all[wall], r_all[wall], 1)
        r_all[wall] = m * z_all[wall] + b
    prof = list(zip(r_all.tolist(), z_all.tolist()))

    # square the bottom off at the wall radius the trace actually reaches
    prof.insert(0, (prof[0][0], 0.0))

    # The TOP keeps at most `tilt_px` of the same camera curvature. Removing
    # it exactly would need the rim's 3D pose; at 1.2 deg it is 0.2 mm on a
    # 27 mm part, so it is reported rather than silently "corrected".
    top_resid_mm = tilt_px * mm_z

    prof = decimate(prof, points)
    return dict(
        source=str(path),
        height_mm=height_mm, diameter_mm=diameter_mm,
        px=dict(width=int(2 * R_px), height=int(H_px)),
        wall=dict(straightened_below_mm=round(float(dome_z), 3),
                  taper_mm_per_mm=round(float(m), 5) if wall.sum() >= 8 else None),
        camera=dict(tilt_deg=round(tilt_deg, 2),
                    bottom_rim_mm=round(tilt_px * mm_z, 3),
                    top_residual_mm=round(top_resid_mm, 3)),
        note=("outer wall only, traced bottom-up; z=0 is the cap's bottom "
              "face. The threaded bore is NOT visible in a photograph and "
              "must still be generated."),
        profile=[[round(r, 4), round(z, 4)] for r, z in prof],
    )


def decimate(prof, n):
    """Keep the shape, drop the pixels: densest sampling where it curves."""
    if len(prof) <= n:
        return prof
    r = np.array([p[0] for p in prof]); z = np.array([p[1] for p in prof])
    # curvature proxy = |second difference| of r, so domes and shoulders keep
    # their points and a straight wall spends almost none
    d2 = np.abs(np.gradient(np.gradient(r)))
    w = d2 + d2.max() * 0.02 + 1e-9
    cum = np.cumsum(w); cum /= cum[-1]
    picks = np.interp(np.linspace(0, 1, n), cum, np.arange(len(prof)))
    idx = sorted(set(int(round(i)) for i in picks) | {0, len(prof) - 1})
    return [(float(r[i]), float(z[i])) for i in idx]


# ---------------------------------------------------------------- shading

def absorb_shading(path, diameter_mm, exclude_stones, width, height):
    rgb, lum, part, box = load_mask(path)
    x0, x1, y0, y1 = box
    W = x1 - x0 + 1

    wall = part.copy()
    if exclude_stones and ndimage is not None:
        # stones deviate from their own column's tone in EITHER direction
        col = np.where(part, lum, np.nan)
        with np.errstate(invalid="ignore"):
            med = np.nanmedian(col, axis=0)
        dev = np.nan_to_num(col - med[None, :], nan=0.0)
        st = ndimage.binary_dilation(np.abs(dev) > 20, np.ones((9, 9)))
        wall &= ~st

    # RADIANCE AGAINST NORMAL AZIMUTH. x across the silhouette gives the
    # surface normal directly: u = 2(x-cx)/W = sin(theta).
    cx = (x0 + x1) / 2.0
    prof = []
    for x in range(x0, x1 + 1):
        colmask = wall[:, x]
        if colmask.sum() < 8:
            continue
        u = max(-1.0, min(1.0, 2 * (x - cx) / W))
        theta = math.asin(u)
        prof.append((theta, np.median(rgb[colmask, x], axis=0)))
    if len(prof) < 32:
        raise SystemExit("not enough wall columns to read a profile")

    th = np.array([p[0] for p in prof])
    val = np.array([p[1] for p in prof]) / 255.0

    # sRGB -> linear; radiance is what an environment carries, not sRGB
    lin = np.where(val > 0.04045, ((val + 0.055) / 1.055) ** 2.4, val / 12.92)

    # A MIRROR reflects the direction at 2*theta from the view axis. The wall
    # is not a mirror, so this is the environment convolved with the
    # material's lobe -- which is exactly what we want to reproduce, since
    # the render applies its own lobe on top of a SHARPER source. Deconvolving
    # blind would invent detail the photograph does not contain, so the band
    # is emitted as measured and labelled as such.
    refl = 2.0 * th

    # equirect: phi across, elevation down. The measured band sits at the
    # horizon; above and below it falls off smoothly, because a studio's
    # light is overhead and its floor is dark.
    img = np.zeros((height, width, 3), np.float32)
    phi = (np.arange(width) / width) * 2 * math.pi - math.pi
    band = np.stack([np.interp(phi, refl, lin[:, c], left=lin[0, c],
                               right=lin[-1, c]) for c in range(3)], axis=1)
    el = (np.arange(height) / height) * math.pi - math.pi / 2      # -90..+90
    for j, e in enumerate(el):
        # cosine falloff above, faster falloff below: no horizon-line sources
        f = math.cos(e) ** 2 if e >= 0 else max(0.0, math.cos(e) ** 6)
        img[j] = band * f
    return dict(theta=th, radiance=lin, refl=refl), img


def write_hdr(path, img):
    """Radiance .hdr (RGBE), which is what drei's useEnvironment loads."""
    h, w, _ = img.shape
    b = bytearray(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
    b += f"-Y {h} +X {w}\n".encode()
    m = img.max(axis=2)
    e = np.zeros_like(m, dtype=np.int32)
    nz = m > 1e-32
    e[nz] = np.floor(np.log2(m[nz])).astype(np.int32) + 1
    scale = np.where(nz, 256.0 / (2.0 ** e), 0.0)
    rgbe = np.zeros((h, w, 4), np.uint8)
    rgbe[..., :3] = np.clip(img * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.clip(e + 128, 0, 255).astype(np.uint8)
    rgbe[~nz] = 0
    b += rgbe.tobytes()
    pathlib.Path(path).write_bytes(bytes(b))


# ------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reference")
    ap.add_argument("--silhouette", action="store_true")
    ap.add_argument("--shading", action="store_true")
    ap.add_argument("--height-mm", type=float, default=27.0)
    ap.add_argument("--diameter-mm", type=float, default=19.0)
    ap.add_argument("--points", type=int, default=72)
    ap.add_argument("--keep-stones", action="store_true")
    ap.add_argument("--env-size", type=int, default=512)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if not (a.silhouette or a.shading):
        raise SystemExit("choose --silhouette or --shading")

    if a.silhouette:
        d = trace_silhouette(a.reference, a.height_mm, a.diameter_mm, a.points)
        pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(a.out).write_text(json.dumps(d, indent=2))
        c = d["camera"]
        print(f"traced {len(d['profile'])} points -> {a.out}")
        print(f"  camera {c['tilt_deg']} deg above square "
              f"({c['bottom_rim_mm']} mm of bottom-rim curvature removed; "
              f"up to {c['top_residual_mm']} mm may remain at the crown)")
        r = [p[0] for p in d["profile"]]; z = [p[1] for p in d["profile"]]
        print(f"  r {min(r):.3f}..{max(r):.3f} mm   z {min(z):.3f}..{max(z):.3f} mm")

    if a.shading:
        prof, img = absorb_shading(a.reference, a.diameter_mm,
                                   not a.keep_stones, a.env_size * 2, a.env_size)
        pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        write_hdr(a.out, img)
        lin, th = prof["radiance"], prof["theta"]
        lum = lin.mean(axis=1)
        pk = int(np.argmax(lum))
        print(f"wrote {a.env_size*2}x{a.env_size} equirect -> {a.out}")
        print(f"  radiance {lum.min():.4f} .. {lum.max():.4f}   "
              f"contrast {lum.max()/max(lum.min(),1e-6):.1f}x")
        print(f"  brightest at normal {math.degrees(th[pk]):+.1f} deg "
              f"-> reflected {math.degrees(prof['refl'][pk]):+.1f} deg")
        dark = lin[int(np.argmin(lum))]
        print("  darkest column (the diffuse floor, a base-colour estimate): "
              "#%02x%02x%02x" % tuple(
                  int(255 * (1.055 * c ** (1 / 2.4) - 0.055 if c > 0.0031308
                             else 12.92 * c)) for c in dark))


if __name__ == "__main__":
    main()
