#!/usr/bin/env python3
"""Compose the protected luminous-polished and neutral-surface frames."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-final-lock/"
    "gloss-refraction-bracket-v1/03_COBALT_LUMINOUS_POLISHED.png"
)
OUTPUT_DIR = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-final-lock/"
    "neutral-surface-tint-v1"
)
CANDIDATE = OUTPUT_DIR / "07_COBALT_NEUTRAL_SURFACE_TINT.png"
COMPARISON = OUTPUT_DIR / "08_NEUTRAL_SURFACE_TINT_COMPARISON.png"
DIAGNOSTICS = OUTPUT_DIR / "diagnostics"


def font(size):
    return ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial.ttf", size
    )


def main():
    before = Image.open(SOURCE).convert("RGB")
    after = Image.open(CANDIDATE).convert("RGB")
    if before.size != after.size:
        raise ValueError("before/after dimensions differ")
    width, height = before.size
    footer = 72
    sheet = Image.new("RGB", (width * 2, height + footer), "#D8D1C5")
    sheet.paste(before, (0, 0))
    sheet.paste(after, (width, 0))
    draw = ImageDraw.Draw(sheet)
    labels = (
        "BEFORE — BLUE DIELECTRIC SURFACE",
        "AFTER — NEUTRAL DIELECTRIC SURFACE",
    )
    for column, label in enumerate(labels):
        box = draw.textbbox((0, 0), label, font=font(22))
        text_width = box[2] - box[0]
        draw.text(
            (column * width + (width - text_width) // 2, height + 22),
            label,
            font=font(22),
            fill="#292724",
        )
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(COMPARISON, compress_level=4)

    DIAGNOSTICS.mkdir(parents=True, exist_ok=True)
    body_box = (270, 267, 630, 802)
    body_before = before.crop(body_box).resize((720, 1070), Image.Resampling.LANCZOS)
    body_after = after.crop(body_box).resize((720, 1070), Image.Resampling.LANCZOS)
    body_sheet = Image.new("RGB", (1440, 1140), "#D8D1C5")
    body_sheet.paste(body_before, (0, 0))
    body_sheet.paste(body_after, (720, 0))
    body_draw = ImageDraw.Draw(body_sheet)
    for column, label in enumerate(("BLUE SURFACE", "NEUTRAL SURFACE")):
        box = body_draw.textbbox((0, 0), label, font=font(22))
        text_width = box[2] - box[0]
        body_draw.text(
            (column * 720 + (720 - text_width) // 2, 1088),
            label,
            font=font(22),
            fill="#292724",
        )
    body_sheet.save(
        DIAGNOSTICS / "08_NEUTRAL_SURFACE_BODY_COMPARISON_200.png",
        compress_level=4,
    )
    print("BB_NEUTRAL_SURFACE_COMPARISON", COMPARISON)


if __name__ == "__main__":
    main()
