#!/usr/bin/env python3
"""
Prepare, fit, lock and review Sunburst re-renders of one register body plate.

  python3 scripts/register/plates/fit_plate.py prepare --body cylinder-9ml-17-415 --glass Clear
  python3 scripts/register/plates/fit_plate.py qa      --body cylinder-9ml-17-415 --glass Clear

prepare: from the plate on dev (output/register-plates/<body>/<glass>/dev-<glass>.png, the current
         Sunburst plate with its locked alpha), writes inputs/geometry.png (the plate un-baked from the
         bone, on white), inputs/master-mask.png (its alpha, the locked outline), inputs/lighting.png
         (the Amber plate on white, a lighting reference) and inputs/placement.json (the dev anchors).
qa:      for every renders/<candidate>.png, fits the render back onto the master (rim -> seat, foot ->
         foot, barrel width, axis), locks its alpha to the master outline, levels its paper white and
         bakes it on the hero bone (#F5F3EF, scripts/register/phase3/sunburst_qa.py's rule for clear
         glass), measures the row-filled silhouette against the master, writes final/<candidate>.png,
         qa.json and review-<glass>.png (current plate vs candidates, on bone, with a neck close-up).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[3]
BONE = (0xF5, 0xF3, 0xEF)
WHITE_FLOOR = 245  # a pixel this light on every channel is paper, not glass


def slug(glass: str) -> str:
    return glass.lower().replace(" ", "-")


def base(body: str, glass: str) -> Path:
    return ROOT / "output" / "register-plates" / body / slug(glass)


def silhouette(img: Image.Image) -> np.ndarray:
    """Row-filled silhouette: alpha where the image has it, else everything that is not paper white."""
    rgba = np.asarray(img.convert("RGBA"))
    if rgba[..., 3].min() < 255:
        mask = rgba[..., 3] > 127
    else:
        mask = rgba[..., :3].min(axis=2) < WHITE_FLOOR
    filled = np.zeros_like(mask)
    for y in np.flatnonzero(mask.any(axis=1)):
        xs = np.flatnonzero(mask[y])
        filled[y, xs[0]:xs[-1] + 1] = True
    return filled


def measure(mask: np.ndarray) -> dict:
    rows = np.flatnonzero(mask.any(axis=1))
    rim, foot = int(rows[0]), int(rows[-1])
    band = [y for y in rows if rim + 0.3 * (foot - rim) <= y <= rim + 0.7 * (foot - rim)]
    widths, centres = [], []
    for y in band:
        xs = np.flatnonzero(mask[y])
        widths.append(xs[-1] - xs[0] + 1)
        centres.append((xs[0] + xs[-1]) / 2)
    return {"rim": rim, "foot": foot, "barrelPx": float(np.median(widths)), "axisX": float(np.median(centres))}


def compare(a: np.ndarray, b: np.ndarray) -> dict:
    edge = lambda x: x ^ ndi.binary_erosion(x)
    iou = (a & b).sum() / max(1, (a | b).sum())
    da, db = ndi.distance_transform_edt(~edge(b)), ndi.distance_transform_edt(~edge(a))
    dev = np.concatenate([da[edge(a)], db[edge(b)]])
    return {"iou": round(float(iou), 4), "edgeMaxPx": round(float(dev.max()), 1), "edgeP95Px": round(float(np.percentile(dev, 95)), 1)}


def on_bone(img: Image.Image) -> Image.Image:
    ground = Image.new("RGBA", img.size, BONE + (255,))
    return Image.alpha_composite(ground, img.convert("RGBA"))


def unbake(plate: Image.Image) -> Image.Image:
    """The dev plate is levelled white multiplied onto the bone; divide it back out, then put it on white."""
    rgba = np.asarray(plate.convert("RGBA")).astype(np.float32)
    rgb = np.minimum(rgba[..., :3] / (np.array(BONE, dtype=np.float32) / 255.0), 255.0)
    alpha = rgba[..., 3:4] / 255.0
    out = rgb * alpha + 255.0 * (1 - alpha)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")


def prepare(body: str, glass: str) -> None:
    b = base(body, glass)
    inputs = b / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    dev = Image.open(b / f"dev-{slug(glass)}.png").convert("RGBA")
    unbake(dev).save(inputs / "geometry.png")
    mask = (np.asarray(dev.getchannel("A")) > 127).astype(np.uint8) * 255
    Image.fromarray(mask).save(inputs / "master-mask.png")
    amber = b / "dev-amber.png"
    if amber.exists():
        Image.alpha_composite(Image.new("RGBA", dev.size, (255, 255, 255, 255)), Image.open(amber).convert("RGBA")).convert("RGB").save(inputs / "lighting.png")
    m = measure(np.asarray(mask) > 127)
    placement = json.loads((b / "placement.json").read_text()) if (b / "placement.json").exists() else {}
    placement.update({"canvas": list(dev.size), "measured": m})
    (inputs / "placement.json").write_text(json.dumps(placement, indent=1) + "\n")
    print(f"prepared {inputs}: canvas {dev.size}, rim {m['rim']} foot {m['foot']} barrel {m['barrelPx']:.0f}px axis {m['axisX']:.0f}")


def fit(render: Image.Image, master: np.ndarray) -> Image.Image:
    r = measure(silhouette(render))
    ref = measure(master)
    sx = ref["barrelPx"] / r["barrelPx"]
    sy = (ref["foot"] - ref["rim"]) / (r["foot"] - r["rim"])
    big = render.convert("RGBA").resize((round(render.width * sx), round(render.height * sy)), Image.LANCZOS)
    out = Image.new("RGBA", render.size, (255, 255, 255, 255))
    out.paste(big, (round(ref["axisX"] - r["axisX"] * sx), round(ref["rim"] - r["rim"] * sy)))
    return out, {"scaleX": round(sx, 4), "scaleY": round(sy, 4), "raw": r}


def lock_and_bake(fitted: Image.Image, master: np.ndarray) -> tuple[Image.Image, list[int]]:
    soft = ndi.gaussian_filter(master.astype(float), 0.8).clip(0, 1)
    rgba = np.asarray(fitted.convert("RGBA")).astype(np.float32)
    solid = (soft > 0.98) & (rgba[..., :3].min(axis=2) >= 235)
    if solid.sum() > 100:
        white = np.array([np.bincount(rgba[..., c][solid].astype(np.int64), minlength=256).argmax() for c in range(3)], dtype=np.float32)
    else:
        white = np.array([255, 255, 255], dtype=np.float32)
    levelled = np.minimum(rgba[..., :3] * (255.0 / white), 255.0)
    rgba[..., :3] = np.round(levelled * (np.array(BONE, dtype=np.float32) / 255.0))
    rgba[..., 3] = np.round(soft * 255.0)
    return Image.fromarray(rgba.clip(0, 255).astype(np.uint8), "RGBA"), white.astype(int).tolist()


def font(size: int):
    for candidate in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf"]:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def qa(body: str, glass: str) -> None:
    b = base(body, glass)
    master = np.asarray(Image.open(b / "inputs" / "master-mask.png")) > 127
    dev = Image.open(b / f"dev-{slug(glass)}.png").convert("RGBA")
    (b / "final").mkdir(exist_ok=True)
    results = {"body": body, "glass": glass, "master": measure(master), "current": compare(silhouette(dev), master), "candidates": {}}
    finals: dict[str, Image.Image] = {}
    for render_path in sorted((b / "renders").glob("*.png")):
        name = render_path.stem
        render = Image.open(render_path)
        raw = compare(silhouette(render), master)
        fitted, fit_info = fit(render, master)
        locked, white = lock_and_bake(fitted, master)
        locked.save(b / "final" / f"{name}.png", optimize=True)
        finals[name] = locked
        meta = json.loads((b / "renders" / f"{name}.png.json").read_text()) if (b / "renders" / f"{name}.png.json").exists() else {}
        fitted_cmp = compare(silhouette(fitted), master)
        results["candidates"][name] = {"raw": raw, "fit": fit_info, "fitted": fitted_cmp, "paperWhite": white,
                                       "prompt": meta.get("prompt"), "costUsd": meta.get("costUsd"), "final": f"final/{name}.png"}
        print(f"{name:10} raw IoU {raw['iou']:.4f} (max {raw['edgeMaxPx']:.0f}px) -> fitted IoU {fitted_cmp['iou']:.4f} (p95 {fitted_cmp['edgeP95Px']:.1f}px, max {fitted_cmp['edgeMaxPx']:.0f}px), scale {fit_info['scaleX']}x{fit_info['scaleY']}, paper white {white}")
    (b / "qa.json").write_text(json.dumps(results, indent=1) + "\n")

    # ---------- review sheet: current dev plate, then every candidate; a neck close-up under each ----------
    cw, ch = 256, 768
    zoom_w, zoom_h = 256, 300
    names = ["current"] + list(finals)
    images = {"current": dev, **finals}
    sheet = Image.new("RGB", (30 + len(names) * (cw + 24), 70 + ch + 70 + zoom_h + 60), BONE)
    d = ImageDraw.Draw(sheet)
    fb, fs = font(15), font(12)
    d.text((16, 14), f"{glass} {body}: current register plate vs Sunburst 2.5 candidates (fitted to the locked outline, baked on #F5F3EF). Below: neck and shoulder at 2x.", fill=(30, 30, 30), font=fb)
    m = results["master"]
    for i, name in enumerate(names):
        x = 16 + i * (cw + 24)
        img = on_bone(images[name])
        sheet.paste(img.resize((cw, ch), Image.LANCZOS).convert("RGB"), (x, 50))
        stats = results["current"] if name == "current" else results["candidates"][name]["fitted"]
        d.text((x, 50 + ch + 8), name if name != "current" else "current (dev)", fill=(30, 30, 30), font=fb)
        d.text((x, 50 + ch + 30), f"IoU {stats['iou']:.3f} · p95 {stats['edgeP95Px']:.1f}px · max {stats['edgeMaxPx']:.0f}px", fill=(60, 60, 60), font=fs)
        # neck close-up: from just above the rim down to the shoulder, centred on the axis, at 2x
        top = max(0, m["rim"] - 40)
        crop_h = zoom_h // 2
        crop_w = zoom_w // 2
        left = int(m["axisX"] - crop_w / 2)
        zoom = img.crop((left, top, left + crop_w, top + crop_h)).resize((zoom_w, zoom_h), Image.LANCZOS)
        sheet.paste(zoom.convert("RGB"), (x, 50 + ch + 60))
        d.rectangle((x, 50 + ch + 60, x + zoom_w - 1, 50 + ch + 60 + zoom_h - 1), outline=(190, 185, 175))
    out = b / f"review-{slug(glass)}.png"
    sheet.save(out, optimize=True)
    print(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["prepare", "qa"])
    ap.add_argument("--body", default="cylinder-9ml-17-415")
    ap.add_argument("--glass", default="Clear")
    args = ap.parse_args()
    (prepare if args.step == "prepare" else qa)(args.body, args.glass)


if __name__ == "__main__":
    sys.exit(main())
