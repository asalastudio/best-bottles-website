#!/usr/bin/env python3
"""Place premium Round candidates on the shared catalog baseline by bottle body.

The AI output is treated as immutable raster artwork. This script applies only a
uniform scale and translation to the complete assembly. Scale is derived from
the glass body radius, never from the cap, sprayer, bulb, tassel, or dropper.
"""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/images/catalog/round-enhancement"
OUTPUT = SOURCE / "aligned"
CANVAS = (1560, 1716)
BASELINE_Y = round(CANVAS[1] * 0.91)
BASE_SCALE = min(CANVAS[0] / 1196, CANVAS[1] / 1315)
BRAND_BONE = (245, 243, 239)
OUTPUT_VERSION = "premium-aligned-v2"

# source center x, source glass baseline y, measured glass radius, layout lane
ASSETS = {
    "GBRnd78SpryCu": (491, 1130, 242, "cap-right", "premium-approved-v2"),
    "GBRnd78AnSpGl": (685, 1106, 256, "bulb-left", "premium-candidate-v1"),
    "GBRnd78AnSpTslGl": (735, 1167, 231, "tassel-left", "premium-candidate-v1"),
    "LBRnd78LtnCu": (485, 1132, 241, "cap-right", "premium-candidate-v1"),
    "GBRnd78RdcrShnGl": (598, 1141, 273, "center", "premium-candidate-v1"),
    "GBRndFrst78AnSpGl": (685, 1153, 245, "bulb-left", "premium-candidate-v1"),
    "GBRndFrst78AnSpTslGl": (735, 1166, 250, "tassel-left", "premium-candidate-v1"),
    "LBRndFrst78LtnMtGl": (490, 1160, 275, "cap-right", "premium-candidate-v1"),
    "GBRndFrst78SpryMtGl": (485, 1189, 289, "cap-right", "premium-candidate-v1"),
    "GBRndFrst78RdcrShnGl": (598, 1085, 285, "center", "premium-candidate-v1"),
    "GBRnd128SpryMtGl": (498, 1156, 298, "cap-right", "premium-approved-v1"),
    "GBRnd128AnSpGl": (650, 1170, 291, "bulb-left", "premium-candidate-v1"),
    "GBRnd128AnSpTslIvyGl": (735, 1169, 284, "tassel-left", "premium-candidate-v1"),
    "GBRnd128DrpGl": (598, 1160, 291, "center", "premium-candidate-v1"),
    "LBRnd128LtnMtGl": (475, 1178, 278, "cap-right", "premium-candidate-v1"),
    "GBRnd128RdcrShnGl": (598, 1226, 316, "center", "premium-candidate-v1"),
    "GBRndFrst128AnSpGl": (675, 1219, 286, "bulb-left", "premium-candidate-v1"),
    "GBRndFrst128DrpGl": (598, 1161, 289, "center", "premium-candidate-v1"),
    "LBRndFrst128LtnMtGl": (480, 1193, 285, "cap-right", "premium-candidate-v1"),
    "GBRndFrst128SpryMtGl": (485, 1147, 285, "cap-right", "premium-candidate-v1"),
    "GBRndFrst128RdcrShnGl": (598, 1155, 291, "center", "premium-candidate-v1"),
}

LANE_X = {
    "center": CANVAS[0] * 0.50,
    "cap-right": CANVAS[0] * 0.41,
    "bulb-left": CANVAS[0] * 0.57,
    "tassel-left": CANVAS[0] * 0.63,
}


def capacity(sku: str) -> int:
    return 128 if "128" in sku else 78


def normalize(sku: str, cx: float, base_y: float, radius: float, lane: str, version: str) -> None:
    src_path = SOURCE / f"{sku}.{version}.png"
    if not src_path.exists():
        raise FileNotFoundError(src_path)
    target_radius = 316 if capacity(sku) == 128 else 275
    scale = BASE_SCALE * target_radius / radius
    dest_x = LANE_X[lane]
    # Pillow's affine coefficients map destination coordinates back to source.
    coeffs = (
        1 / scale,
        0,
        cx - dest_x / scale,
        0,
        1 / scale,
        base_y - BASELINE_Y / scale,
    )
    source = Image.open(src_path).convert("RGB")
    aligned = source.transform(
        CANVAS,
        Image.Transform.AFFINE,
        coeffs,
        resample=Image.Resampling.BICUBIC,
        fillcolor=BRAND_BONE,
    )
    # Normalize only the background connected to the outside of the canvas.
    # This makes the catalog matte exactly #F5F3EF while retaining the bottle,
    # fitment, internal refraction, and grounded contact shadow as raster art.
    matte_size = (CANVAS[0] // 4, CANVAS[1] // 4)
    matte = aligned.resize(matte_size, Image.Resampling.BILINEAR)
    edge_points = (
        (0, 0),
        (matte_size[0] - 1, 0),
        (0, matte_size[1] - 1),
        (matte_size[0] - 1, matte_size[1] - 1),
    )
    matte_marker = (255, 0, 255)
    for point in edge_points:
        ImageDraw.floodfill(matte, point, matte_marker, thresh=18)
    matte_mask = Image.new("L", matte_size)
    matte_mask.putdata([255 if pixel == matte_marker else 0 for pixel in matte.get_flattened_data()])
    matte_mask = matte_mask.resize(CANVAS, Image.Resampling.BILINEAR)
    bone_canvas = Image.new("RGB", CANVAS, BRAND_BONE)
    aligned = Image.composite(bone_canvas, aligned, matte_mask)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    aligned.save(OUTPUT / f"{sku}.{OUTPUT_VERSION}.png")


def main() -> None:
    for sku, values in ASSETS.items():
        normalize(sku, *values)
    print(f"Wrote {len(ASSETS)} aligned Round heroes to {OUTPUT}")


if __name__ == "__main__":
    main()
