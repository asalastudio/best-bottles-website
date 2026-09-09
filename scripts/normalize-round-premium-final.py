#!/usr/bin/env python3
"""Place every premium Round hero so its glass lands on the saved shoulder target.

Jordan returned all 21 images in `round-premium-family-2026-09-07-v3` and set one
target per capacity group: 42 for 78 ml and 49 for 128 ml, measured glass base to
shoulder against the 91% baseline. The 128 target was first levelled to 50.4,
where `GBRnd128AnSpTslIvyGl` already sat, then settled at 49 on review.

Shoulder, on a round bottle. There is no conventional shoulder on a sphere, so
the line Jordan draws is the top of the glass -- where the bottom of the cap
meets the ball. That is what "shoulder" means for this family, and it is what
this script measures.

Why the v2 pass missed. Its scale came from a glass radius hand-measured per SKU
into `normalize-round-premium-candidates.py`. Those measurements vary in quality,
so bottles in one capacity group do not land on one height: the 128 ml group
spans 45.2% to 51.6%, which is why `GBRnd128AnSpGl` reads visibly smaller than
`GBRnd128AnSpTslIvyGl` beside it. A single family radius cannot fix that, because
the error is per bottle.

So each bottle is corrected individually. Because the assembly is scaled
uniformly about the baseline, the glass top's height above that baseline is
exactly proportional to scale, so one measurement of the v2 placement gives the
correction in closed form: radius = v2 radius x target / measured. The result is
re-measured to confirm. This removes the hand-measurement error rather than
inheriting it. Scale is still uniform and still derived from the glass; nothing
is stretched, and the closure, sprayer, bulb, tassel and dropper never affect it.

Measuring past a bulb or tassel. The span of a whole row would include the bulb
or the spare cap standing beside the bottle. Rows are therefore measured only
within a window centred on the bottle's own axis, wide enough for the ball and
narrow enough to exclude anything set beside it.

Matte. The v2 matte flood-filled the background from the four corners at
thresh=18 with nothing to stop it. On `GBRndFrst128RdcrShnGl` the frosted rim
contrast falls under that threshold, the fill walked inside, and 41.8% of the
bottle was erased -- the "center is all removed and looks blotchy" rejection.
The fill is now bounded by a guard built two ways at once, so background
normalisation cannot cross the glass edge at any scale.

Originals are never overwritten; output goes to a new `aligned-v4` directory.
This writes candidates for review. It does not publish or touch the registry.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = ROOT / "scripts/normalize-round-premium-candidates.py"
OUTPUT = ROOT / "public/images/catalog/round-enhancement/aligned-v4"
REPORT = ROOT / "docs/reviews/round-enhancement/aligned-v4-report.json"
OUTPUT_VERSION = "premium-aligned-v4"

# Saved review targets: glass base to shoulder, percent of canvas height.
SAVED_TARGET = {78: 42.0, 128: 49.0}
# What the old review screen displayed. Recorded only to note that it was a
# constant in `build-round-premium-review.mjs`, not a measurement. Never used.
SHOWN_AT_REVIEW = {78: 49.0, 128: 54.5}
V2_RADIUS = {78: 275.0, 128: 316.0}

# One canvas row is 0.058%, and the plateau edge is only locatable to a few
# rows, so anything inside half a point is the same height.
SOLVE_TOLERANCE = 0.4
SOLVE_MAX_PASSES = 6
# The v2 placements measure 38-52%, so no bottle needs more than about a tenth
# either way. A measurement outside these bounds is the plateau detector locking
# onto the wrong edge, not a bottle that needs resizing; the solver refuses it
# instead of chasing it.
RADIUS_BAND = (0.80, 1.25)
# The v2 placements measure 38-52%. A reading outside this band is the detector
# losing the plateau, not a bottle of an unexpected size.
PLAUSIBLE_SHOULDER = (35.0, 60.0)
AXIS_WINDOW_FACTOR = 1.08
PLATEAU_ROWS = 20
PLATEAU_FLATNESS = 6
PLATEAU_CEILING = 0.62

MATTE_THRESHOLD = 18
# Measurement reads the placement before the background is normalised, where
# faint haze still sits within the matte threshold. Reading only unambiguous
# artwork keeps the silhouette the detector sees clean.
# Tried in order; the first reading that lands in the plausible band wins. The
# stricter threshold ignores background haze, the looser one recovers a bottle
# whose glass edge is too soft to survive it.
MEASURE_THRESHOLDS = (40, 18)
GUARD_WALL = 40
GUARD_MIN_COMPONENT_PX = 400
GUARD_DILATION = 8
GUARD_CONSERVATIVE_THRESHOLD = 8


def _load_base():
    spec = importlib.util.spec_from_file_location("round_premium_base", BASE_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BASE = _load_base()
CANVAS = BASE.CANVAS
BONE = BASE.BRAND_BONE
BONE_ARRAY = np.array(BONE)


def place(sku: str, radius: float) -> Image.Image:
    """Uniform scale and translation only, identical in form to the v2 pass."""
    source_x, source_base_y, source_radius, lane, version = BASE.ASSETS[sku]
    source_path = BASE.SOURCE / f"{sku}.{version}.png"
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    scale = BASE.BASE_SCALE * radius / source_radius
    destination_x = BASE.LANE_X[lane]
    coeffs = (
        1 / scale,
        0,
        source_x - destination_x / scale,
        0,
        1 / scale,
        source_base_y - BASE.BASELINE_Y / scale,
    )
    return Image.open(source_path).convert("RGB").transform(
        CANVAS,
        Image.Transform.AFFINE,
        coeffs,
        resample=Image.Resampling.BICUBIC,
        fillcolor=BONE,
    )


def axis_spans(image: Image.Image, sku: str, threshold: int) -> np.ndarray:
    """Ink width per row, seen only through a window on the bottle's own axis.

    The window is fixed at the v2 scale for every measurement. Letting it follow
    the trial scale moves the frame the detector reads, which is what made an
    earlier iterative version lose the plateau and run away.
    """
    lane = BASE.ASSETS[sku][3]
    axis = BASE.LANE_X[lane]
    half = BASE.BASE_SCALE * V2_RADIUS[BASE.capacity(sku)] * AXIS_WINDOW_FACTOR
    pixels = np.asarray(image).astype(int)
    ink = np.abs(pixels - BONE_ARRAY).sum(axis=2) > threshold
    window = ink[:, max(0, int(axis - half)): min(CANVAS[0], int(axis + half))]
    columns = np.arange(window.shape[1])
    spans = np.zeros(window.shape[0], int)
    for row in range(window.shape[0]):
        present = columns[window[row]]
        if present.size:
            spans[row] = present[-1] - present[0] + 1
    return spans


def glass_top(spans: np.ndarray) -> int | None:
    """The row where the closure's flat column meets the top of the ball.

    Walking up from the widest row, the glass narrows continuously and then the
    cap, sprayer or dropper collar takes over as a column of near-constant width.
    The first such plateau is the shoulder Jordan marks.
    """
    equator = int(np.argmax(spans))
    widest = spans[equator]
    row = equator
    while row - PLATEAU_ROWS > 0:
        row -= 1
        if spans[row] > PLATEAU_CEILING * widest:
            continue
        segment = spans[row - PLATEAU_ROWS:row]
        if segment.min() > 0 and segment.max() - segment.min() <= PLATEAU_FLATNESS:
            return row
    return None


def shoulder_percent(image: Image.Image, sku: str) -> float | None:
    for threshold in MEASURE_THRESHOLDS:
        top = glass_top(axis_spans(image, sku, threshold))
        if top is None:
            continue
        percent = 100 * (BASE.BASELINE_Y - top) / CANVAS[1]
        if PLAUSIBLE_SHOULDER[0] <= percent <= PLAUSIBLE_SHOULDER[1]:
            return percent
    return None


def solve_radius(sku: str) -> tuple[float, list, float | None]:
    """Correct this bottle's radius so its glass top lands on the saved target."""
    group = BASE.capacity(sku)
    target = SAVED_TARGET[group]
    start = V2_RADIUS[group]

    measured = shoulder_percent(place(sku, start), sku)
    steps = [{"stage": "v2 placement", "radiusPx": start,
              "measuredPercent": None if measured is None else round(measured, 3)}]
    if measured is None:
        return start, steps, None
    if abs(measured - target) < SOLVE_TOLERANCE:
        steps.append({"stage": "already on target", "radiusPx": start,
                      "measuredPercent": round(measured, 3)})
        return start, steps, measured

    radius = min(max(start * target / measured, start * RADIUS_BAND[0]), start * RADIUS_BAND[1])
    confirmed = shoulder_percent(place(sku, radius), sku)
    steps.append({"stage": "corrected", "radiusPx": round(radius, 3),
                  "measuredPercent": None if confirmed is None else round(confirmed, 3)})
    return radius, steps, confirmed


def _outside_fill(image: Image.Image, threshold: int) -> np.ndarray:
    """Background connected to the canvas edge, as a full-resolution mask."""
    size = (CANVAS[0] // 4, CANVAS[1] // 4)
    work = image.resize(size, Image.Resampling.BILINEAR)
    marker = (255, 0, 255)
    for corner in ((0, 0), (size[0] - 1, 0), (0, size[1] - 1), (size[0] - 1, size[1] - 1)):
        ImageDraw.floodfill(work, corner, marker, thresh=threshold)
    mask = Image.new("L", size)
    mask.putdata([255 if pixel == marker else 0 for pixel in work.get_flattened_data()])
    return np.asarray(mask.resize(CANVAS, Image.Resampling.BILINEAR)) > 127


def guard_silhouette(image: Image.Image) -> np.ndarray:
    """The assembly the matte must never touch, established two independent ways.

    Anchoring on unambiguous artwork keeps the guard tight around the bottle, and
    a conservative fill that cannot cross even a low-contrast frosted rim catches
    what that misses. Either is usually enough; together they hold at any scale.
    """
    pixels = np.asarray(image).astype(int)
    strong = np.abs(pixels - BONE_ARRAY).sum(axis=2) > GUARD_WALL
    labels, count = ndimage.label(strong)
    artwork = np.zeros_like(strong)
    if count:
        areas = ndimage.sum(strong, labels, range(1, count + 1))
        for index, area in enumerate(areas, start=1):
            if area >= GUARD_MIN_COMPONENT_PX:
                artwork |= labels == index
    artwork = ndimage.binary_fill_holes(ndimage.binary_dilation(artwork, iterations=GUARD_DILATION))

    solid = ndimage.binary_fill_holes(~_outside_fill(image, GUARD_CONSERVATIVE_THRESHOLD))
    labels, count = ndimage.label(solid)
    if count:
        areas = ndimage.sum(solid, labels, range(1, count + 1))
        solid = labels == int(np.argmax(areas)) + 1
    return artwork | solid


def normalize(sku: str) -> dict:
    radius, steps, _ = solve_radius(sku)
    placed = place(sku, radius)
    measured = shoulder_percent(placed, sku)

    guard = guard_silhouette(placed)
    matte = _outside_fill(placed, MATTE_THRESHOLD) & ~guard

    pixels = np.asarray(placed).astype(int)
    ink = np.abs(pixels - BONE_ARRAY).sum(axis=2) > MATTE_THRESHOLD
    erased = int((ink & matte).sum())

    bone_canvas = Image.new("RGB", CANVAS, BONE)
    aligned = Image.composite(bone_canvas, placed, Image.fromarray((matte * 255).astype(np.uint8)))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    aligned.save(OUTPUT / f"{sku}.{OUTPUT_VERSION}.png")

    rows = np.where(ink.any(axis=1))[0]
    columns = np.where(ink.any(axis=0))[0]
    group = BASE.capacity(sku)
    return {
        "sku": sku,
        "capacityMl": group,
        "sourceVersion": BASE.ASSETS[sku][4],
        "lane": BASE.ASSETS[sku][3],
        "targetShoulderPercent": SAVED_TARGET[group],
        "measuredShoulderPercent": None if measured is None else round(measured, 2),
        "shoulderSolved": measured is not None
        and abs(measured - SAVED_TARGET[group]) < SOLVE_TOLERANCE,
        "solvedRadiusPx": round(radius, 3),
        "scaleRatioAppliedToV2": round(radius / V2_RADIUS[group], 6),
        "solverTrace": steps,
        "inkTop": int(rows.min()),
        "inkBottom": int(rows.max()),
        "inkLeft": int(columns.min()),
        "inkRight": int(columns.max()),
        "baselineY": BASE.BASELINE_Y,
        "clippedAtCanvasEdge": bool(
            rows.min() == 0
            or rows.max() >= CANVAS[1] - 1
            or columns.min() == 0
            or columns.max() >= CANVAS[0] - 1
        ),
        "assemblyPixelsErasedByMatte": erased,
        "assemblyPixelsErasedPercent": round(100 * erased / max(int(ink.sum()), 1), 3),
    }


def main() -> None:
    measurements = [normalize(sku) for sku in BASE.ASSETS]
    worst = max(measurements, key=lambda row: row["assemblyPixelsErasedPercent"])
    unsolved = [r["sku"] for r in measurements if not r["shoulderSolved"]]
    clipped = [r["sku"] for r in measurements if r["clippedAtCanvasEdge"]]
    report = {
        "outputVersion": OUTPUT_VERSION,
        "sourceCollection": "round-premium-family-2026-09-07-v3",
        "savedTargetByCapacityMl": SAVED_TARGET,
        "targetMeasurement": "glass base to the top of the glass, where the closure meets it",
        "shownAtReviewByCapacityMl": SHOWN_AT_REVIEW,
        "shownAtReviewWasAConstant": True,
        "baselinePercent": 91,
        "background": "#F5F3EF",
        "transform": "uniform scale and translation only; per-SKU scale solved against the measured glass",
        "worstMatteErasurePercent": worst["assemblyPixelsErasedPercent"],
        "worstMatteErasureSku": worst["sku"],
        "shoulderUnsolved": unsolved,
        "clipped": clipped,
        "scope": "review candidates only; not published and not referenced by catalog-heroes.json",
        "rows": measurements,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(f"{json.dumps(report, indent=2)}\n")

    print(f"Wrote {len(measurements)} Round heroes to {OUTPUT}")
    for group in sorted(SAVED_TARGET):
        got = [r["measuredShoulderPercent"] for r in measurements
               if r["capacityMl"] == group and r["measuredShoulderPercent"] is not None]
        ratios = [r["scaleRatioAppliedToV2"] for r in measurements if r["capacityMl"] == group]
        print(f"  {group:3d} mL  target {SAVED_TARGET[group]}  "
              f"measured {min(got):.1f}-{max(got):.1f}  "
              f"scale on v2 {min(ratios):.3f}-{max(ratios):.3f}")
    print(f"Worst matte erasure {worst['assemblyPixelsErasedPercent']}% on {worst['sku']}")
    print("Shoulder unsolved: " + (", ".join(unsolved) if unsolved else "none"))
    print("Clipped at the canvas edge: " + (", ".join(clipped) if clipped else "none"))


if __name__ == "__main__":
    main()
