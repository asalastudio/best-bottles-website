#!/usr/bin/env python3
"""Build the locked-camera Empire closure cascade from original catalog PSDs."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance
from psd_tools import PSDImage


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(
    "/Users/jordanrichter/Projects/Clients/Nemat-International/"
    "Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/"
    "21. Empire 50ml/1. Empire 50ml PSD"
)
OUT_ROOT = ROOT / "public/cinematic"
TOPS_DIR = OUT_ROOT / "tops"
FRAMES_DIR = OUT_ROOT / "frames/cascade"
RANGE_DIR = OUT_ROOT / "range"
RANGE_FRAMES_DIR = OUT_ROOT / "frames/range"
BASE_FRAME = OUT_ROOT / "frames/swingin/frame_0150.jpg"

FRAME_SIZE = (1600, 900)
TARGET_NECK_CENTER_X = 825
TARGET_SHOULDER_Y = 245
# The locked Higgsfield plate is optically wider/shorter than the original
# catalog photograph. Match its width independently; use the tallest real
# atomizer to set the vertical scale so every fitting remains inside 16:9.
SCALE_X = 434 / 531
SCALE_Y = 0.39
FRAME_COUNT = 150
CROSSFADE_FRAMES = 3


@dataclass(frozen=True)
class Closure:
    slug: str
    label: str
    filename: str
    body_layer: int
    top_layers: tuple[int, ...]
    tassel_layer: int | None = None


CLOSURES = (
    Closure("reducer-gold", "Gold reducer", "1. GBEmp50RdcrShnGl...psd", 1, (4,)),
    # This legacy file is layered differently from the other sprayer PSDs: its
    # visible gold cover is layer 4 and the bottle is layer 2.
    Closure("cap-matte-gold", "Matte gold cover", "11. GBEmp50SpryMtGl.psd", 2, (4,)),
    Closure("sprayer-gold", "Shiny gold sprayer", "15. GBEmp50SpryShnGl.psd", 1, (3,)),
    Closure("sprayer-black", "Shiny black sprayer", "19. GBEmp50SpryShnBlk.psd", 1, (3,)),
    Closure("sprayer-silver", "Shiny silver sprayer", "29. GBEmp50SpryShnSl.psd", 1, (3,)),
    Closure("sprayer-copper", "Copper sprayer", "58. GBEmp50SpryCu.psd", 1, (3, 4)),
    Closure("atomizer-lavender", "Lavender bulb atomizer", "33. GBEmp50AnSpLvn.psd", 1, (3,)),
    Closure("atomizer-pink", "Pink bulb atomizer", "34. GBEmp50AnSpPnk.psd", 1, (3,)),
    Closure("atomizer-matte-silver", "Matte silver bulb atomizer", "35. GBEmp50AnSpMtSl.psd", 1, (3,)),
    Closure("atomizer-gold", "Gold bulb atomizer", "37. GBEmp50AnSpGl.psd", 1, (3,)),
    Closure("atomizer-black", "Black bulb atomizer", "39. GBEmp50AnSpBlk.psd", 1, (3,)),
    Closure("tassel-lavender", "Lavender tassel atomizer", "42. GBEmp50AnSpTslLvn.psd", 1, (3, 4), 3),
    Closure("tassel-pink", "Pink tassel atomizer", "46. GBEmp50AnSpTslPnk.psd", 1, (5, 6), 5),
    Closure("tassel-red", "Red tassel atomizer", "47. GBEmp50AnSpTslRed.psd", 1, (5, 6), 5),
    Closure("tassel-black", "Black tassel atomizer", "48. GBEmp50AnSpTslBlk.psd", 1, (5, 7), 5),
)

RANGE_PRODUCTS = (
    (
        "empire-sprayer",
        SOURCE_ROOT / "15. GBEmp50SpryShnGl.psd",
        (252, 128),
        310,
    ),
    (
        "slim-sprayer",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/"
            "15. Slim 50ml/1. Slim 50ml PSD/30. GBSlm50SpryShnSl.psd"
        ),
        (466, 74),
        300,
    ),
    (
        "circle-sprayer",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/15-415 Bottles/"
            "1. Circle Clear 30ml - Capped/Circle 30ml/2. GBCrcl30SpryShnGl.psd"
        ),
        (1150, 92),
        286,
    ),
    (
        "apothecary",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/10. Apothecary/"
            "3. 4oz Apoth/2. GB4ozApthClear.psd"
        ),
        (1320, 355),
        280,
    ),
    (
        "cream-jar",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/Cream Jars/CJAmb30SlCap.psd"
        ),
        (1110, 668),
        190,
    ),
    (
        "heart-tassel",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/Decorative Glass bottles/"
            "Heart shaped small bottles/4. GBHeartFrst4TslRed.psd"
        ),
        (418, 618),
        250,
    ),
    (
        "cylinder-tassel",
        Path(
            "/Users/jordanrichter/Projects/Clients/Nemat-International/"
            "Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/"
            "1. Cylindrical 30ml/1. Cylindrical 30ml PSD/"
            "46. GBCyl30AnSpTslPnk.psd"
        ),
        (110, 390),
        270,
    ),
)


def layer_canvas(psd: PSDImage, indices: tuple[int, ...]) -> Image.Image:
    canvas = Image.new("RGBA", psd.size, (0, 0, 0, 0))
    for index in indices:
        layer = psd[index]
        image = layer.composite()
        if image is None:
            continue
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        canvas.alpha_composite(image, dest=(layer.bbox[0], layer.bbox[1]))
    return canvas


def transform_to_plate(
    source: Image.Image,
    source_body_center_x: float,
    source_attachment_y: float,
) -> Image.Image:
    resized = source.resize(
        (round(source.width * SCALE_X), round(source.height * SCALE_Y)),
        Image.Resampling.LANCZOS,
    )
    result = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    x = round(TARGET_NECK_CENTER_X - source_body_center_x * SCALE_X)
    y = round(TARGET_SHOULDER_Y - source_attachment_y * SCALE_Y)
    result.alpha_composite(resized, dest=(x, y))
    return result


def alpha_scaled(image: Image.Image, opacity: float) -> Image.Image:
    if opacity >= 0.999:
        return image
    copy = image.copy()
    alpha = copy.getchannel("A").point(lambda value: round(value * opacity))
    copy.putalpha(alpha)
    return copy


def warm_grade(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    image = ImageEnhance.Brightness(image).enhance(0.84)
    image.putalpha(alpha)
    return image


def sway(image: Image.Image, angle: float) -> Image.Image:
    if abs(angle) < 0.01:
        return image
    # The rotation is deliberately tiny; it keeps the fitting docked while the
    # long tassel has a living, two-to-three-frame motion at the climax.
    return image.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=(TARGET_NECK_CENTER_X, TARGET_SHOULDER_Y),
    )


def prepare_overlays() -> tuple[list[Image.Image | None], list[Image.Image | None]]:
    TOPS_DIR.mkdir(parents=True, exist_ok=True)
    overlays: list[Image.Image | None] = [None]
    tassels: list[Image.Image | None] = [None]
    for closure in CLOSURES:
        psd = PSDImage.open(SOURCE_ROOT / closure.filename)
        body = psd[closure.body_layer]
        body_center_x = (body.bbox[0] + body.bbox[2]) / 2
        fixed_indices = tuple(i for i in closure.top_layers if i != closure.tassel_layer)
        fixed_source = layer_canvas(psd, fixed_indices)
        fixed_bbox = fixed_source.getbbox()
        if fixed_bbox is None:
            raise SystemExit(f"Empty closure layers for {closure.filename}")
        # The bottom opaque pixel is the photographed closure's attachment
        # edge. Register that edge directly to the generated bottle shoulder;
        # PSD body bounds often include loose transparent/retouching pixels.
        attachment_y = fixed_bbox[3]
        fixed = transform_to_plate(fixed_source, body_center_x, attachment_y)
        fixed = warm_grade(fixed)
        fixed.save(TOPS_DIR / f"{closure.slug}.png", optimize=True)
        overlays.append(fixed)
        if closure.tassel_layer is None:
            tassels.append(None)
        else:
            moving = transform_to_plate(
                layer_canvas(psd, (closure.tassel_layer,)), body_center_x, attachment_y
            )
            tassels.append(warm_grade(moving))
    return overlays, tassels


def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    red, green, blue, _ = rgba.split()
    minimum = ImageChops.darker(red, ImageChops.darker(green, blue))
    alpha = ImageChops.invert(minimum).point(lambda value: min(255, value * 3))
    rgba.putalpha(alpha)
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def prepare_range_products() -> list[tuple[Image.Image, tuple[int, int]]]:
    RANGE_DIR.mkdir(parents=True, exist_ok=True)
    products: list[tuple[Image.Image, tuple[int, int]]] = []
    for slug, path, position, height in RANGE_PRODUCTS:
        if not path.exists():
            raise SystemExit(f"Missing range product source: {path}")
        flattened = PSDImage.open(path).composite()
        if flattened is None:
            raise SystemExit(f"Unable to composite range product: {path}")
        cutout = remove_white_background(flattened)
        width = max(1, round(cutout.width * height / cutout.height))
        cutout = cutout.resize((width, height), Image.Resampling.LANCZOS)
        cutout = ImageEnhance.Brightness(cutout).enhance(0.74)
        cutout.save(RANGE_DIR / f"{slug}.png", optimize=True)
        products.append((cutout, position))
    return products


def render_range(base: Image.Image) -> None:
    RANGE_FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    products = prepare_range_products()
    center = (TARGET_NECK_CENTER_X, 430)
    for frame_index in range(FRAME_COUNT):
        progress = frame_index / (FRAME_COUNT - 1)
        if progress < 0.18:
            amount = 0.0
        elif progress < 0.52:
            amount = (progress - 0.18) / 0.34
        elif progress < 0.72:
            amount = 1.0
        else:
            amount = max(0.0, 1 - (progress - 0.72) / 0.28)
        amount = amount * amount * (3 - 2 * amount)

        frame = base.copy()
        for product, (target_x, target_y) in products:
            x = round(center[0] + (target_x - center[0]) * amount - product.width / 2)
            y = round(center[1] + (target_y - center[1]) * amount - product.height / 2)
            frame.alpha_composite(alpha_scaled(product, amount * 0.94), dest=(x, y))
        output = RANGE_FRAMES_DIR / f"frame_{frame_index + 1:04d}.jpg"
        frame.convert("RGB").save(output, "JPEG", quality=89, optimize=True)


def render_state(
    base: Image.Image,
    overlay: Image.Image | None,
    tassel: Image.Image | None,
    frame: int,
) -> Image.Image:
    image = base.copy()
    if overlay is not None:
        image.alpha_composite(overlay)
    if tassel is not None:
        angle = (-1.15, 0.0, 1.15)[frame % 3]
        image.alpha_composite(sway(tassel, angle))
    return image


def main() -> None:
    if not BASE_FRAME.exists():
        raise SystemExit(f"Missing locked plate: {BASE_FRAME}")
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    base = Image.open(BASE_FRAME).convert("RGBA")
    overlays, tassels = prepare_overlays()
    state_count = len(overlays)
    segment = FRAME_COUNT / state_count

    for frame_index in range(FRAME_COUNT):
        position = frame_index / segment
        state = min(int(position), state_count - 1)
        local = position - state
        current = render_state(base, overlays[state], tassels[state], frame_index)

        transition_start = 1 - CROSSFADE_FRAMES / segment
        if state < state_count - 1 and local >= transition_start:
            mix = (local - transition_start) / (1 - transition_start)
            upcoming = render_state(
                base, overlays[state + 1], tassels[state + 1], frame_index
            )
            current = Image.blend(current, upcoming, max(0.0, min(1.0, mix)))

        output = FRAMES_DIR / f"frame_{frame_index + 1:04d}.jpg"
        current.convert("RGB").save(output, "JPEG", quality=90, optimize=True)

    render_range(base)
    print(f"Rendered {FRAME_COUNT} cascade frames from {len(CLOSURES)} real Empire closures")
    print(f"Rendered {FRAME_COUNT} range frames from {len(RANGE_PRODUCTS)} real catalog products")


if __name__ == "__main__":
    main()
