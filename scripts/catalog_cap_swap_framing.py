#!/usr/bin/env python3
"""
Calibrate the catalog card's cap swap against each approved hero.

A catalog hero is one bone (#F5F3EF) photograph per product group. When a
buyer picks another cap on the card, the card shows that SKU's catalogue
plate instead. Plates are white, framed tighter (the bottle is larger) and
come in two layouts: capped ("front-on") and cap beside ("front-off").

For every hero this script finds which plate layout matches the hero's
composition, and the scale and offset that put the hero SKU's own plate
exactly over the hero's bottle: a coarse fit on object masks, then a fine fit
on outlines (edge correlation), which also holds for frosted glass on bone. Every cap in a group shares
the bottle and the plate framing, so the same transform places any sibling
cap's plate where the hero's bottle stands.

Plates carry no shadow, so the script also keeps the hero's own contact
shadow as a small greyscale layer: the hero divided by bone, with the bottle
and cap blanked out. The card multiplies bone × shadow layer × plate, so a
swapped cap reads as the same photograph, shadow included. Nothing is drawn
or invented: every shadow pixel comes from the approved hero.

Output: src/lib/products/catalog-cap-swap-framing.json, keyed by hero URL:
    { plate: "capOff" | "capped", scale, x, y, match, shadow }
where a plate point p (0..1 of the plate) lands at scale * p + (x, y) in the
hero image (0..1), `match` is the outline correlation (1 = identical) and
`shadow` is the layer under public/. Heroes whose match is below --min-match
are left out; the card keeps the hero for them rather than show a mismatch.
0.74 was set by eye on 2026-09-25: every overlay from 0.742 up had the bottle
exactly on the hero's; the worst accepted case at 0.6 (frosted Tall Cylinder
roll-on, 0.677) had its bottle 3% off. Frosted glass on bone is the usual miss.

Usage:
    python3 scripts/catalog_cap_swap_framing.py            # dev Convex from .env.local
    python3 scripts/catalog_cap_swap_framing.py --convex-url https://<deployment>.convex.cloud
    python3 scripts/catalog_cap_swap_framing.py --skus GBRoyal13Gl GBSqr15Gl   # only these heroes;
        other entries and shadow layers are kept, entries for heroes no longer in any registry are dropped
"""

from __future__ import annotations

import argparse
import glob
import io
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import hashlib

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "src/lib/products/catalog-cap-swap-framing.json")
SHADOW_DIR = "images/catalog/cap-swap-shadows"
SHADOW_SIZE = (390, 429)  # a quarter of the 1560 × 1716 heroes; shadows are soft
BONE = (245, 243, 239)
WHITE = (255, 255, 255)
W, H = 240, 264  # 10:11, like heroes and plates
THRESHOLD = 35


def convex_url_from_env() -> str:
    path = os.path.join(ROOT, ".env.local")
    for line in open(path, encoding="utf8"):
        if line.startswith("NEXT_PUBLIC_CONVEX_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("NEXT_PUBLIC_CONVEX_URL is not set in .env.local; pass --convex-url")


def convex_query(url: str, path: str, args: dict) -> dict:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/api/query",
        data=json.dumps({"path": path, "args": args, "format": "json"}).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.load(response)
    if body.get("status") != "success":
        raise RuntimeError(f"{path} failed: {body.get('errorMessage')}")
    return body["value"]


def hero_rows() -> list[dict]:
    rows: dict[str, dict] = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "src/lib/products/catalog-hero*.json"))):
        for row in json.load(open(path, encoding="utf8")):
            if row.get("url") and row.get("websiteSku"):
                rows.setdefault(row["url"], row)
    return list(rows.values())


def read_image(url: str) -> Image.Image:
    if url.startswith("/"):
        return Image.open(os.path.join(ROOT, "public", url.lstrip("/")))
    with urllib.request.urlopen(url, timeout=60) as response:
        return Image.open(io.BytesIO(response.read()))


def mask(image: Image.Image, background: tuple[int, int, int]) -> np.ndarray:
    rgba = image.convert("RGBA")
    flat = Image.new("RGBA", rgba.size, background + (255,))
    flat.alpha_composite(rgba)
    pixels = np.asarray(flat.convert("RGB").resize((W, H), Image.LANCZOS)).astype(int)
    return np.abs(pixels - np.array(background)).max(axis=2) > THRESHOLD


def bbox(m: np.ndarray):
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return None
    return xs.min(), xs.max(), ys.min(), ys.max()


GRID_Y, GRID_X = np.mgrid[0:H, 0:W]


def iou_for(hero: np.ndarray, plate: np.ndarray, scale: float, x: float, y: float) -> float:
    # Pull each hero pixel back into the plate: p = (h - offset) / scale.
    hy, hx = GRID_Y, GRID_X
    px = np.rint(((hx + 0.5) / W - x) / scale * W - 0.5).astype(int)
    py = np.rint(((hy + 0.5) / H - y) / scale * H - 0.5).astype(int)
    inside = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    warped = np.zeros_like(hero)
    warped[inside] = plate[py[inside], px[inside]]
    union = np.logical_or(hero, warped).sum()
    return float(np.logical_and(hero, warped).sum() / union) if union else 0.0


def fit(hero: np.ndarray, plate: np.ndarray):
    hb, pb = bbox(hero), bbox(plate)
    if not hb or not pb:
        return None
    # Start from the tops and horizontal extents (a contact shadow only adds below the foot).
    scale0 = (hb[1] - hb[0] + 1) / (pb[1] - pb[0] + 1)
    x0 = (hb[0] - pb[0] * scale0) / W
    y0 = (hb[2] - pb[2] * scale0) / H
    best = (-1.0, scale0, x0, y0)
    for step, span in ((0.02, 6), (0.005, 4)):
        _, s_c, x_c, y_c = best
        for ds in np.arange(-span, span + 1) * step:
            scale = s_c * (1 + ds)
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    x = x_c + dx / W
                    y = y_c + dy / H
                    score = iou_for(hero, plate, scale, x, y)
                    if score > best[0]:
                        best = (score, scale, x, y)
    return best


def edge_map(image: Image.Image, background: tuple[int, int, int]) -> np.ndarray:
    """Outlines, independent of the backdrop: luminance relative to the background, Sobel, soft blur."""
    rgba = image.convert("RGBA")
    flat = Image.new("RGBA", rgba.size, background + (255,))
    flat.alpha_composite(rgba)
    lum = (np.asarray(flat.convert("RGB").resize((W, H), Image.LANCZOS)).astype(float) / np.array(background)).mean(axis=2)
    return ndimage.gaussian_filter(np.hypot(ndimage.sobel(lum, 0), ndimage.sobel(lum, 1)), 1.2)


def warp(plate: np.ndarray, scale: float, x: float, y: float) -> np.ndarray:
    px = np.rint(((GRID_X + 0.5) / W - x) / scale * W - 0.5).astype(int)
    py = np.rint(((GRID_Y + 0.5) / H - y) / scale * H - 0.5).astype(int)
    inside = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    out = np.zeros(plate.shape, dtype=plate.dtype)
    out[inside] = plate[py[inside], px[inside]]
    return out


def edge_score(hero: np.ndarray, plate: np.ndarray, scale: float, x: float, y: float) -> float:
    warped = warp(plate, scale, x, y)
    if warped.std() == 0:
        return 0.0
    return float(np.corrcoef(hero.ravel(), warped.ravel())[0, 1])


def refine(hero: np.ndarray, plate: np.ndarray, start: tuple[float, float, float]):
    best = (edge_score(hero, plate, *start), *start)
    for step, span, reach in ((0.01, 5, 4), (0.0025, 4, 2)):
        _, s_c, x_c, y_c = best
        for ds in np.arange(-span, span + 1) * step:
            scale = s_c * (1 + ds)
            for dx in range(-reach, reach + 1):
                for dy in range(-reach, reach + 1):
                    candidate = (scale, x_c + dx / W, y_c + dy / H)
                    score = edge_score(hero, plate, *candidate)
                    if score > best[0]:
                        best = (score, *candidate)
    return best


def object_mask(image: Image.Image, background: tuple[int, int, int], threshold: int) -> np.ndarray:
    pixels = np.asarray(image.convert("RGB")).astype(int)
    found = np.abs(pixels - np.array(background)).max(axis=2) > threshold
    return ndimage.binary_fill_holes(ndimage.binary_closing(found, iterations=3))


def write_shadow(row: dict, plate_url: str, scale: float, x: float, y: float) -> str:
    """The hero's shadow alone: hero ÷ bone, with the objects (hero's and plate's) set to white."""
    width, height = SHADOW_SIZE
    hero = read_image(row["url"]).convert("RGB").resize(SHADOW_SIZE, Image.LANCZOS)
    placed = Image.new("RGB", SHADOW_SIZE, WHITE)
    plate = read_image(plate_url).convert("RGB").resize((round(width * scale), round(height * scale)), Image.LANCZOS)
    placed.paste(plate, (round(x * width), round(y * height)))
    objects = object_mask(hero, BONE, 45) | object_mask(placed, WHITE, 20)
    objects = ndimage.binary_dilation(objects, iterations=2)
    ratio = np.clip(np.asarray(hero).astype(float) / np.array(BONE), 0, 1).mean(axis=2)
    ratio[objects] = 1.0
    digest = hashlib.sha1(row["url"].encode()).hexdigest()[:10]
    name = f"{row['websiteSku']}.{digest}.webp"
    os.makedirs(os.path.join(ROOT, "public", SHADOW_DIR), exist_ok=True)
    Image.fromarray((ratio * 255).round().astype(np.uint8), "L").save(
        os.path.join(ROOT, "public", SHADOW_DIR, name), "WEBP", quality=82, method=6)
    return f"/{SHADOW_DIR}/{name}"


def calibrate(row: dict, plates: dict, min_match: float = 0.0) -> tuple[str, dict | None, str]:
    plate = plates.get(row["websiteSku"])
    if not plate:
        return row["url"], None, "no plate for the hero SKU"
    try:
        hero_image = read_image(row["url"])
        hero_mask, hero_edges = mask(hero_image, BONE), edge_map(hero_image, BONE)
        candidates = {"capped": plate.get("image"), "capOff": plate.get("imageCapOff")}
        results = []
        for kind, url in candidates.items():
            if not url:
                continue
            plate_image = read_image(url)
            coarse = fit(hero_mask, mask(plate_image, WHITE))
            if coarse:
                results.append((*refine(hero_edges, edge_map(plate_image, WHITE), coarse[1:]), kind))
        if not results:
            return row["url"], None, "no usable plate"
        match, scale, x, y, kind = max(results)
        result = {"plate": kind, "scale": round(float(scale), 5), "x": round(float(x), 5), "y": round(float(y), 5), "match": round(match, 3)}
        if match >= min_match:
            result["shadow"] = write_shadow(row, candidates[kind], scale, x, y)
        return row["url"], result, ""
    except Exception as error:  # a broken image must not stop the batch
        return row["url"], None, f"error: {error}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--convex-url", default=None)
    parser.add_argument("--min-match", type=float, default=0.74)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--skus", nargs="*", default=None, help="calibrate only these website SKUs; keep the rest")
    args = parser.parse_args()
    convex = args.convex_url or convex_url_from_env()

    all_rows = hero_rows()
    rows = [row for row in all_rows if row["websiteSku"] in set(args.skus)] if args.skus else all_rows
    if args.skus:  # a SKU may carry several registry rows (an older photo and a newer release)
        missing = sorted(set(args.skus) - {row["websiteSku"] for row in rows})
        if missing:
            raise SystemExit(f"not in any hero registry: {', '.join(missing)}")
    skus = sorted({row["websiteSku"] for row in rows})
    plates: dict = {}
    for start in range(0, len(skus), 150):
        plates.update(convex_query(convex, "productPlates:forSkus", {"skus": skus[start:start + 150]})["plates"])

    shadow_dir = os.path.join(ROOT, "public", SHADOW_DIR)
    framing: dict = {}
    if args.skus:
        # Keep every calibration whose hero is still registered and not being redone; drop the rest
        # (a superseded hero's entry and shadow layer must not outlive it).
        live_urls = {row["url"] for row in all_rows}
        redo_urls = {row["url"] for row in rows}
        if os.path.exists(OUT):
            with open(OUT, encoding="utf8") as handle:
                previous = json.load(handle)
            for url, entry in previous.items():
                if url in live_urls and url not in redo_urls:
                    framing[url] = entry
                elif entry.get("shadow"):
                    stale = os.path.join(ROOT, "public", entry["shadow"].lstrip("/"))
                    if os.path.exists(stale):
                        os.remove(stale)
    elif os.path.isdir(shadow_dir):  # layers are regenerated; stale ones must not ship
        for name in os.listdir(shadow_dir):
            os.remove(os.path.join(shadow_dir, name))

    skipped: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for url, result, reason in pool.map(lambda row: calibrate(row, plates, args.min_match), rows):
            if result and result["match"] >= args.min_match:
                framing[url] = result
            else:
                skipped.append((url, reason or f"outline match {result['match'] if result else 0}"))

    with open(OUT, "w", encoding="utf8") as handle:
        json.dump(dict(sorted(framing.items())), handle, indent=2)
        handle.write("\n")
    print(f"{len(framing)} of {len(rows)} heroes calibrated → {os.path.relpath(OUT, ROOT)}")
    for url, reason in sorted(skipped):
        print(f"  skipped {url}: {reason}", file=sys.stderr)


if __name__ == "__main__":
    main()
