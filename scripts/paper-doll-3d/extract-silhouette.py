#!/usr/bin/env python3
"""
Paper Doll 3D — silhouette extraction from a product photograph.

A Boston Round is a solid of revolution, so a single straight-on photograph
fully determines its OUTER profile. This script recovers that profile as a
(radius, height) curve in millimetres, which build-boston-round.py can then
lathe instead of using its parametric bezier shoulder.

What the photo CAN give:      outer silhouette — heel, wall, shoulder curve.
What the photo CANNOT give:   wall thickness, base thickness, interior cavity.
Those stay parametric until someone measures a physical sample.

Scale comes from the body DIAMETER, not the height: diameter is unoccluded in
every product shot, whereas the top of the finish is usually hidden under a
closure. Diameter is verified at 33 mm for the 30 ml (see
pipeline/paper-doll-3d/pilot/subject-boston-round/09_notes/dimensions.md).

The alpha channel is deliberately IGNORED. In the Best Bottles reference sets
the alpha is a rectangular tile, not a subject cutout — thresholding against
the white background is what actually isolates the bottle.

Usage:
  python3 scripts/paper-doll-3d/extract-silhouette.py \\
      --image <reference.png> --diameter 33 \\
      --out-json <profile.json> --out-overlay <check.png>

  # inspect without writing:
  python3 scripts/paper-doll-3d/extract-silhouette.py --image <ref.png> --report
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: needs numpy + Pillow.", file=sys.stderr)
    raise SystemExit(2)


BG_THRESHOLD = 236          # pixels brighter than this on all channels = backdrop
MIN_OBJECT_COLUMNS = 40     # ignore specks / dust when splitting objects


def load_on_white(path: Path) -> np.ndarray:
    """RGB array, alpha composited over white. Alpha is NOT used as a mask."""
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[3])
    return np.asarray(bg).astype(np.int16)


def subject_mask(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel is darker or more saturated than the white backdrop."""
    darker = rgb.max(axis=2) < BG_THRESHOLD
    saturated = (rgb.max(axis=2) - rgb.min(axis=2)) > 18
    return darker | saturated


def split_objects(mask: np.ndarray) -> List[Tuple[int, int]]:
    """
    Column ranges of horizontally separated objects.

    Product shots in this library place the bottle and its detached closure
    side by side with clear backdrop between them, so a column-occupancy split
    separates them without needing a full connected-component pass.
    """
    occupied = mask.any(axis=0)
    runs: List[Tuple[int, int]] = []
    start: Optional[int] = None
    for x, on in enumerate(occupied):
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start >= MIN_OBJECT_COLUMNS:
                runs.append((start, x - 1))
            start = None
    if start is not None and len(occupied) - start >= MIN_OBJECT_COLUMNS:
        runs.append((start, len(occupied) - 1))
    return runs


def pick_bottle(mask: np.ndarray, runs: List[Tuple[int, int]]) -> Tuple[int, int]:
    """The bottle is the tallest object in frame — closures are much shorter."""
    best, best_h = runs[0], -1
    for x0, x1 in runs:
        rows = np.where(mask[:, x0:x1 + 1].any(axis=1))[0]
        h = (rows.max() - rows.min()) if rows.size else 0
        if h > best_h:
            best, best_h = (x0, x1), h
    return best


def extract_profile(mask: np.ndarray, x0: int, x1: int) -> Dict[str, object]:
    """Per-row half-width of the subject, in pixels, from base upward."""
    sub = mask[:, x0:x1 + 1]
    rows = np.where(sub.any(axis=1))[0]
    y_top, y_base = int(rows.min()), int(rows.max())

    half: List[Optional[float]] = []
    centre: List[Optional[float]] = []
    for y in range(y_top, y_base + 1):
        xs = np.where(sub[y])[0]
        if xs.size < 2:
            half.append(None)
            centre.append(None)
            continue
        half.append((xs.max() - xs.min()) / 2.0)
        centre.append((xs.max() + xs.min()) / 2.0)

    widths = [h for h in half if h is not None]
    r_max_px = max(widths)

    # Axis: median centre over rows at ≥97% of max width — i.e. the straight
    # cylindrical wall, which is the least perspective-distorted part of the shot.
    wall_centres = [c for c, h in zip(centre, half)
                    if c is not None and h is not None and h >= 0.97 * r_max_px]
    axis_px = float(np.median(wall_centres)) if wall_centres else float(np.median(
        [c for c in centre if c is not None]))

    return {
        "y_top": y_top, "y_base": y_base,
        "half_px": half, "centre_px": centre,
        "r_max_px": float(r_max_px), "axis_px": axis_px,
    }


def to_mm(prof: Dict[str, object], diameter_mm: float,
          step: int) -> Tuple[List[Tuple[float, float]], float]:
    """Convert the pixel profile to (r, z) mm with z=0 at the base."""
    mm_per_px = (diameter_mm / 2.0) / prof["r_max_px"]
    y_base, y_top = prof["y_base"], prof["y_top"]
    half = prof["half_px"]

    pts: List[Tuple[float, float]] = []
    for i in range(0, len(half), step):
        h = half[i]
        if h is None:
            continue
        y = y_top + i
        pts.append((h * mm_per_px, (y_base - y) * mm_per_px))
    pts.sort(key=lambda p: p[1])
    return pts, mm_per_px


def find_landmarks(pts: List[Tuple[float, float]], r_body: float) -> Dict[str, float]:
    """Locate where the straight wall ends and the shoulder begins."""
    wall = [z for r, z in pts if r >= 0.985 * r_body]
    shoulder_start = max(wall) if wall else 0.0
    narrow = [z for r, z in pts if r <= 0.62 * r_body and z > shoulder_start]
    neck_start = min(narrow) if narrow else max(z for _, z in pts)
    return {
        "wall_top_mm": round(shoulder_start, 2),
        "neck_start_mm": round(neck_start, 2),
        "shoulder_height_mm": round(neck_start - shoulder_start, 2),
        "visible_height_mm": round(max(z for _, z in pts), 2),
    }


def draw_overlay(path: Path, out: Path, prof: Dict[str, object],
                 x0: int, bottle_span: Tuple[int, int]) -> None:
    """Trace the detected outline back onto the photo so it can be eyeballed."""
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[3])
    d = ImageDraw.Draw(bg)

    y_top = prof["y_top"]
    axis = x0 + prof["axis_px"]
    left, right = [], []
    for i, (h, c) in enumerate(zip(prof["half_px"], prof["centre_px"])):
        if h is None or c is None:
            continue
        y = y_top + i
        left.append((x0 + c - h, y))
        right.append((x0 + c + h, y))
    if len(left) > 1:
        d.line(left, fill=(255, 40, 40), width=4)
        d.line(right, fill=(255, 40, 40), width=4)
    d.line([(axis, prof["y_top"]), (axis, prof["y_base"])], fill=(0, 140, 255), width=3)
    d.line([(bottle_span[0], prof["y_base"]), (bottle_span[1], prof["y_base"])],
           fill=(0, 200, 90), width=4)
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out)


def main() -> int:
    p = argparse.ArgumentParser(prog="extract-silhouette.py")
    p.add_argument("--image", type=Path, required=True)
    p.add_argument("--diameter", type=float, default=33.0,
                   help="known body diameter in mm — the scale reference (default 33)")
    p.add_argument("--step", type=int, default=6,
                   help="sample every Nth image row (default 6)")
    p.add_argument("--out-json", type=Path)
    p.add_argument("--out-overlay", type=Path)
    p.add_argument("--report", action="store_true")
    args = p.parse_args()

    rgb = load_on_white(args.image)
    mask = subject_mask(rgb)
    runs = split_objects(mask)
    if not runs:
        print("ERROR: no subject found — is the backdrop white?", file=sys.stderr)
        return 1
    x0, x1 = pick_bottle(mask, runs)

    prof = extract_profile(mask, x0, x1)
    pts, mm_per_px = to_mm(prof, args.diameter, args.step)
    r_body = args.diameter / 2.0
    marks = find_landmarks(pts, r_body)

    print(f"image        {args.image.name}")
    print(f"objects      {len(runs)} found, bottle at columns {x0}-{x1}")
    print(f"scale        {1/mm_per_px:.2f} px/mm  ({mm_per_px:.4f} mm/px)")
    print(f"body dia     {args.diameter} mm  (scale reference)")
    print(f"visible h    {marks['visible_height_mm']} mm")
    print(f"wall top     {marks['wall_top_mm']} mm")
    print(f"neck start   {marks['neck_start_mm']} mm")
    print(f"shoulder h   {marks['shoulder_height_mm']} mm")
    print(f"samples      {len(pts)} profile points")

    if args.report:
        print("\n  z (mm)   r (mm)")
        for r, z in pts[::max(1, len(pts) // 30)]:
            print(f"  {z:7.2f}  {r:6.2f}")

    payload = {
        "source_image": str(args.image),
        "diameter_mm": args.diameter,
        "mm_per_px": mm_per_px,
        "landmarks": marks,
        "note": "OUTER profile only. Wall/base thickness are not recoverable "
                "from a photograph and remain parametric.",
        "profile_rz_mm": [[round(r, 4), round(z, 4)] for r, z in pts],
    }
    if args.out_json:
        args.out_json.parent.mkdir(parents=True, exist_ok=True)
        args.out_json.write_text(json.dumps(payload, indent=2))
        print(f"\nwrote {args.out_json}")
    if args.out_overlay:
        draw_overlay(args.image, args.out_overlay, prof, x0, (x0, x1))
        print(f"wrote {args.out_overlay}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
