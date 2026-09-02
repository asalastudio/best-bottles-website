#!/usr/bin/env python3
"""
Bake a SCREEN-SPACE thickness map for the 2.5D renderer.

    python3 scripts/bottle25/bake_thickness_2d.py \
        --silhouette <url|path> --diameter-mm 19.98 --wall-mm 2.45 \
        --base-mm 12.7 --out public/bottle25/cylinder-9ml

Why this and not the GLB bake we already ship. `public/models/bodies-thickness/
*.thickness.png` is baked in the MESH's UV space, for a material that wraps it
round the mesh. The 2.5D renderer has no mesh — it draws one plane — so it needs
the path length through glass AT EACH PIXEL OF THE FRAME, registered to the
silhouette it will be composited with. Different space, different bake.

The bake takes its shape from the silhouette rather than from a model, which is
the point: a body with no GLB still bakes, and a shaped bottle (Diva, Elegant)
bakes its real outline instead of a cylinder's. What the model contributes is
the one number a photograph cannot show — how thick the glass is.

The method, per row of the frame:

    the outer half-width w comes from the silhouette's alpha
    the cavity half-width is w - wall, and 0 through the base puck
    a ray at offset x travels
        2*sqrt(w^2 - x^2)                                 outside the cavity
        2*(sqrt(w^2 - x^2) - sqrt(wi^2 - x^2))            through both walls

which is exact for a solid of revolution and a fair approximation for anything
whose front view is symmetric about its axis. The result is written as an 8-bit
PNG normalised by the maximum path, with that maximum in a JSON sidecar so the
shader can read millimetres back out.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ALPHA_FLOOR = 24        # the same ink threshold the kit gates use


def load_silhouette(src: str) -> Image.Image:
    if src.startswith("http"):
        with urllib.request.urlopen(src) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    return Image.open(src).convert("RGBA")


def bake(alpha: np.ndarray, diameter_mm: float, wall_mm: float, base_mm: float):
    h, w = alpha.shape
    edge = alpha > ALPHA_FLOOR
    rows = np.where(edge.any(axis=1))[0]
    if not len(rows):
        raise SystemExit("bake: the silhouette is empty")
    top, bottom = int(rows[0]), int(rows[-1])

    # The OUTLINE is not the mask. Clear glass photographs with a transparent
    # middle, so thresholding alpha returns two walls and a hole -- the first
    # run of this bake reported 0.00mm of glass down the axis where there must
    # be two walls. Fill each row between its outermost ink pixels: for a body
    # shot square-on that IS the silhouette.
    ink = np.zeros_like(edge)
    for y in range(top, bottom + 1):
        xs = np.where(edge[y])[0]
        if len(xs):
            ink[y, xs[0]: xs[-1] + 1] = True

    # px/mm from the widest row: the diameter is the one dimension the drawing
    # and the photograph are guaranteed to agree on
    half = np.zeros(h)
    centre = np.zeros(h)
    for y in range(top, bottom + 1):
        xs = np.where(edge[y])[0]
        if len(xs) == 0:
            continue
        half[y] = (xs[-1] - xs[0]) / 2.0
        centre[y] = (xs[-1] + xs[0]) / 2.0
    px_per_mm = (2 * half.max()) / diameter_mm
    wall_px = wall_mm * px_per_mm

    # the base puck: solid glass for base_mm of height above the floor
    base_px = base_mm * px_per_mm
    inner = np.maximum(half - wall_px, 0.0)
    solid_from = bottom - base_px
    inner[int(max(top, solid_from)): bottom + 1] = 0.0

    xs = np.arange(w)[None, :].astype(np.float64)
    dx = xs - centre[:, None]
    ho = half[:, None]
    hi = inner[:, None]

    outer = np.sqrt(np.clip(ho * ho - dx * dx, 0, None))
    cavity = np.sqrt(np.clip(hi * hi - dx * dx, 0, None))
    path_px = 2.0 * (outer - cavity)
    path_px[~ink] = 0.0
    path_mm = path_px / px_per_mm

    # Curvature, so the shader can light a cylinder without a normal map:
    # the normalised signed offset across each row IS sin(surface angle) for a
    # solid of revolution, whatever its profile. -1 and +1 are the rims.
    with np.errstate(invalid="ignore", divide="ignore"):
        across = np.where(ho > 0, dx / np.maximum(ho, 1e-6), 0.0)
    across = np.clip(across, -1.0, 1.0)
    across[~ink] = 0.0

    # Solidity: 1 where the ray never crosses the cavity -- the side walls and
    # the base puck. This is what lets the base be strengthened on its own
    # without special-casing a rectangle in the shader.
    solid = (np.abs(dx) >= hi).astype(np.float64)
    solid[~ink] = 0.0

    return path_mm, across, solid, ink, dict(
        pxPerMm=round(px_per_mm, 4),
        maxThicknessMm=round(float(path_mm.max()), 4),
        medianWallMm=wall_mm,
        baseMm=base_mm,
        diameterMm=diameter_mm,
        bounds=dict(top=top, bottom=bottom,
                    left=int(np.where(ink.any(axis=0))[0][0]),
                    right=int(np.where(ink.any(axis=0))[0][-1])),
        canvas=dict(width=w, height=h),
        channels="R thickness (mm = R/255 * maxThicknessMm), G curvature (sin of the "
                 "surface angle, remapped to 0..1), B solidity (1 = the ray misses the "
                 "cavity), A coverage",
        note="flipY=false, NoColorSpace -- these are data, not colour.",
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--silhouette", required=True)
    ap.add_argument("--diameter-mm", type=float, required=True)
    ap.add_argument("--wall-mm", type=float, required=True)
    ap.add_argument("--base-mm", type=float, required=True)
    ap.add_argument("--out", required=True, help="path stem; .thickness2d.png/.json are appended")
    a = ap.parse_args()

    img = load_silhouette(a.silhouette)
    alpha = np.array(img.split()[-1], dtype=np.uint8)
    path_mm, across, solid, ink, meta = bake(alpha, a.diameter_mm, a.wall_mm, a.base_mm)

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    # R thickness, G curvature, B solidity, A coverage. Coverage is its own
    # channel because thickness falls to zero at the rim, and a mask taken from
    # thickness would eat the outline exactly where the glass is brightest.
    rgba = np.stack([
        np.clip(path_mm / meta["maxThicknessMm"] * 255.0, 0, 255),
        np.clip((across + 1.0) * 0.5 * 255.0, 0, 255),
        np.clip(solid * 255.0, 0, 255),
        np.where(ink, 255.0, 0.0),
    ], axis=-1).astype(np.uint8)
    Image.fromarray(rgba, mode="RGBA").save(out.with_suffix(".thickness2d.png"), optimize=True)
    meta["source"] = a.silhouette
    out.with_suffix(".thickness2d.json").write_text(json.dumps(meta, indent=2) + "\n")

    print(f"{out.with_suffix('.thickness2d.png')}")
    print(f"  {meta['pxPerMm']} px/mm, max path {meta['maxThicknessMm']}mm, "
          f"wall {a.wall_mm}mm, base {a.base_mm}mm")
    mid = (meta["bounds"]["top"] + meta["bounds"]["bottom"]) // 2
    axis = (meta["bounds"]["left"] + meta["bounds"]["right"]) // 2
    print(f"  at the axis, mid-barrel: {path_mm[mid, axis]:.2f}mm "
          f"(two walls = {2 * a.wall_mm:.2f}mm)")


if __name__ == "__main__":
    main()
