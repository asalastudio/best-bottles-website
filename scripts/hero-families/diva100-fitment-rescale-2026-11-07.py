#!/usr/bin/env python3
"""Diva 100 ml lotion pump and perfume spray heroes: seat the fitment on the shoulder (Jordan, 7 Nov 2026).

The 23 Sep Sunburst renders (docs/hero-families/boston-diva-2026-09-23) drew the 18-415 pump collar narrower than the
clear neck ring under it, so ~45 px of glass ring showed between the collar and the Diva shoulder and the pump looked
perched on top ("too small ... needs to be enlarged so it can sit on top of the Diva shoulder"). The plates (real
photographs, cap on) and the old bestbottles.com photo show the closure covering the ring down to the shoulder.

For each render this:
  1. measures the pump (gold pixels above the neck), the neck ring under it and the shoulder ledge (first row below the
     collar wider than 1.3x the collar);
  2. erases the old pump and the loose cap row by row with the bone sampled beside them (nothing else is touched);
  3. scales the pump uniformly by ring width / collar width and seats the collar's foot on the shoulder ledge;
  4. scales the loose cap by the same factor about its foot, so it still fits the pump, keeping its ground contact.
Glass, background, framing (canvas, baseline) and all other pixels are unchanged. Uniform scale only: no stretch,
no recolouring.

  python3 scripts/hero-families/diva100-fitment-rescale-2026-11-07.py <in.png> <out.png> [--report report.json]
"""
import json
import sys

import numpy as np
from PIL import Image

BONE = np.array([245, 243, 239], dtype=np.float32)


def soft_alpha(rgb: np.ndarray) -> np.ndarray:
    diff = np.abs(rgb - BONE).max(axis=2)
    return np.clip((diff - 3.0) / 10.0, 0.0, 1.0)


def gold_mask(rgb: np.ndarray) -> np.ndarray:
    return (rgb[:, :, 0] - rgb[:, :, 2] > 60) & (rgb[:, :, 0] > 90)


def row_extent(mask_row: np.ndarray):
    cols = np.where(mask_row)[0]
    return (int(cols.min()), int(cols.max())) if len(cols) else None


def solidify(alpha: np.ndarray, metal: np.ndarray) -> None:
    """Metal is opaque. Its specular highlight is nearly bone-white, so the colour-difference alpha reads it as
    see-through and, once scaled, the glass under it showed through. Inside each row's metal extent the part is
    fully opaque; only the outermost 2 px keep their antialiased edge."""
    for r in range(alpha.shape[0]):
        ext = row_extent(metal[r])
        if ext and ext[1] - ext[0] > 6:
            alpha[r, ext[0] + 2:ext[1] - 1] = 1.0


def erase(rgb: np.ndarray, alpha: np.ndarray, top: int, bottom: int, left: int, right: int) -> None:
    """Replace the object pixels in the box with the bone sampled just outside it on the same row."""
    width = rgb.shape[1]
    for y in range(top, bottom + 1):
        sample = np.concatenate([rgb[y, max(0, left - 40):max(0, left - 8)], rgb[y, min(width, right + 8):min(width, right + 40)]])
        fill = sample.mean(axis=0) if len(sample) else BONE
        a = alpha[y, left:right + 1, None]
        rgb[y, left:right + 1] = rgb[y, left:right + 1] * (1 - a) + fill * a


def paste_scaled(rgb: np.ndarray, src: np.ndarray, src_alpha: np.ndarray, scale: float, anchor_src, anchor_dst) -> None:
    h, w = src_alpha.shape
    nw, nh = round(w * scale), round(h * scale)
    rgba = np.dstack([src, src_alpha * 255.0]).clip(0, 255).astype(np.uint8)
    big = np.asarray(Image.fromarray(rgba, "RGBA").resize((nw, nh), Image.LANCZOS)).astype(np.float32)
    x0 = round(anchor_dst[0] - anchor_src[0] * scale)
    y0 = round(anchor_dst[1] - anchor_src[1] * scale)
    a = (big[:, :, 3:4] / 255.0)
    region = rgb[y0:y0 + nh, x0:x0 + nw]
    region[:] = big[:, :, :3] * a + region * (1 - a)


def main() -> None:
    src_path, out_path = sys.argv[1], sys.argv[2]
    report_path = sys.argv[sys.argv.index("--report") + 1] if "--report" in sys.argv else None
    image = Image.open(src_path).convert("RGB")
    rgb = np.asarray(image).astype(np.float32)
    alpha = soft_alpha(rgb)
    gold = gold_mask(rgb)
    height, width = alpha.shape

    # The bottle stands left of centre and the loose cap right of it; split at the emptiest column between them.
    lo, hi = int(width * 0.55), int(width * 0.75)
    bottle_right = lo + int(np.argmin((alpha[:, lo:hi] > 0.15).sum(axis=0)))

    # 1. pump: gold rows in the upper bottle area
    pump_gold = gold.copy()
    pump_gold[:, bottle_right:] = False
    pump_gold[int(height * 0.45):, :] = False
    # The pump is a solid block of gold; the glass below only reflects scattered gold. Keep the first run of rows
    # whose gold fills most of its own extent, so a reflection in the glass is never taken for the collar.
    def solid(y):
        ext = row_extent(pump_gold[y])
        return bool(ext) and ext[1] - ext[0] > 40 and pump_gold[y, ext[0]:ext[1] + 1].mean() > 0.45
    first = next(y for y in range(height) if solid(y))
    y = first
    # A shaded step between actuator and collar can leave a few rows thin (and the nozzle hole ~40 rows); reflections in the glass are sparse.
    while y + 1 < height and any(solid(y + k) for k in range(1, 41) if y + k < height):
        y += 1
    pump_top, collar_foot = first, y
    pump_gold[collar_foot + 1:, :] = False
    rows = np.arange(pump_top, collar_foot + 1)
    rows = np.array([r for r in rows if row_extent(pump_gold[r])])
    collar_width = max(row_extent(pump_gold[r])[1] - row_extent(pump_gold[r])[0] for r in rows[-80:])
    p_left = min(row_extent(pump_gold[y])[0] for y in rows) - 6
    p_right = max(row_extent(pump_gold[y])[1] for y in rows) + 6
    centre_x = (p_left + p_right) / 2

    # Clear glass sits close to the bone, so a low alpha threshold finds the ring's true edge.
    bottle = alpha > 0.15
    bottle[:, bottle_right:] = False
    shoulder = None
    ring = []
    for y in range(collar_foot + 1, collar_foot + 200):
        ext = row_extent(bottle[y])
        if not ext:
            continue
        w = ext[1] - ext[0]
        if w > 1.3 * collar_width:
            shoulder = y
            break
        ring.append(w)
    if shoulder is None or len(ring) < 6:
        raise SystemExit("could not find the neck ring and shoulder under the collar")
    # The ring's steady band: drop the flare into the shoulder (last rows) and take the upper quartile.
    ring_width = int(np.percentile(ring[:-3], 75))
    if ring_width <= collar_width:
        raise SystemExit(f"neck ring ({ring_width}px) is not wider than the collar ({collar_width}px): nothing to fix")
    scale = ring_width / collar_width

    # 2. cut the pump and the cap before erasing
    pump_src = rgb[pump_top - 4:collar_foot + 1, p_left:p_right + 1].copy()
    pump_alpha = alpha[pump_top - 4:collar_foot + 1, p_left:p_right + 1].copy()
    pump_anchor = (centre_x - p_left, collar_foot - (pump_top - 4))
    solidify(pump_alpha, pump_gold[pump_top - 4:collar_foot + 1, p_left:p_right + 1])

    cap_gold = gold.copy()
    cap_gold[:, :bottle_right] = False
    cap_rows = np.where(cap_gold.any(axis=1))[0]
    cap_top, cap_foot = int(cap_rows.min()), int(cap_rows.max())
    c_left = min(row_extent(cap_gold[y])[0] for y in cap_rows) - 6
    c_right = max(row_extent(cap_gold[y])[1] for y in cap_rows) + 6
    shadow = 50  # keep the contact shadow under the cap with it
    cap_src = rgb[cap_top - 4:cap_foot + shadow, c_left - 20:c_right + 21].copy()
    cap_alpha = alpha[cap_top - 4:cap_foot + shadow, c_left - 20:c_right + 21].copy()
    cap_anchor = ((c_left + c_right) / 2 - (c_left - 20), cap_foot - (cap_top - 4))
    cap_rows_alpha = cap_alpha[:cap_foot - (cap_top - 4) + 1]
    solidify(cap_rows_alpha, cap_gold[cap_top - 4:cap_foot + 1, c_left - 20:c_right + 21])

    erase(rgb, alpha, pump_top - 4, collar_foot, p_left, p_right)
    erase(rgb, alpha, cap_top - 4, cap_foot, c_left, c_right)

    # 3 + 4. scaled pump seated on the shoulder; scaled cap on its own foot
    paste_scaled(rgb, pump_src, pump_alpha, scale, pump_anchor, (centre_x, shoulder))
    paste_scaled(rgb, cap_src, cap_alpha, scale, cap_anchor, ((c_left + c_right) / 2, cap_foot))

    Image.fromarray(rgb.clip(0, 255).round().astype(np.uint8), "RGB").save(out_path, optimize=True)
    report = {
        "source": src_path, "output": out_path, "scale": round(scale, 4),
        "collarWidthPx": collar_width, "neckRingWidthPx": ring_width,
        "pump": {"top": pump_top, "collarFoot": collar_foot, "seatedOnShoulderY": shoulder, "centreX": centre_x},
        "cap": {"top": cap_top, "foot": cap_foot},
    }
    print(json.dumps(report))
    if report_path:
        with open(report_path, "w") as fh:
            json.dump(report, fh, indent=1)


if __name__ == "__main__":
    main()
