#!/usr/bin/env python3
"""
Dimension drawings, step 3: fit each Sunburst trace to its reference, key the paper out,
lay the SKU's real measurements over it, and build the review sheet.

  python3 scripts/register/drawings/finish.py --body cylinder-9ml-17-415 \
      --dims rollon=83,70,20,17-415 --dims finemist=96,70,20,17-415

Each --dims is <closure>=<height with cap mm>,<height without cap mm>,<diameter mm>,<neck>.
The trace is fitted (top of the closure -> the reference's closure top, foot -> foot, barrel
width -> barrel width, axis -> axis), so the dimension lines can be placed from the
reference's placement.json rather than measured off the drawing. Only what is given is drawn:
a missing figure drops its line (the tech sheet's data rule).

Writes output/register-drawings/<body>/final/<closure>-<style>.png (2x of the 200 px slot,
transparent, ink on nothing so it sits on the tech sheet's white card) and
review-drawings.png (every candidate at slot size and at 2x).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[3]
INK = (28, 28, 30)
GOLD = (158, 129, 74)
PAPER_FLOOR = 232       # lighter than this on every channel is paper
SLOT = (200, 280)       # the tech sheet's drawing column, CSS px
SCALE = 2               # final PNG is 2x


def font(size: int, weight: str = "Regular"):
    for candidate in [ROOT / "public" / "fonts" / "montserrat" / f"Montserrat-{weight}.woff2",
                      Path("/System/Library/Fonts/Supplemental/Arial.ttf"), Path("/System/Library/Fonts/Helvetica.ttc")]:
        try:
            return ImageFont.truetype(str(candidate), size)
        except OSError:
            continue
    return ImageFont.load_default()


def silhouette(img: Image.Image) -> np.ndarray:
    rgb = np.asarray(img.convert("RGB"))
    mask = rgb.min(axis=2) < PAPER_FLOOR
    filled = np.zeros_like(mask)
    for y in np.flatnonzero(mask.any(axis=1)):
        xs = np.flatnonzero(mask[y])
        filled[y, xs[0]:xs[-1] + 1] = True
    return filled


def measure(mask: np.ndarray, seat_y: int | None = None) -> dict:
    rows = np.flatnonzero(mask.any(axis=1))
    top, foot = int(rows[0]), int(rows[-1])
    lo = seat_y if seat_y is not None else top
    band = [y for y in rows if lo + 0.3 * (foot - lo) <= y <= lo + 0.7 * (foot - lo)]
    widths, centres = [], []
    for y in band:
        xs = np.flatnonzero(mask[y])
        widths.append(xs[-1] - xs[0] + 1)
        centres.append((xs[0] + xs[-1]) / 2)
    return {"top": top, "foot": foot, "barrelPx": float(np.median(widths)), "axisX": float(np.median(centres))}


def fit(render: Image.Image, reference: Image.Image, seat_y: int) -> tuple[Image.Image, dict]:
    """Scale and place the trace so its closure top, foot, barrel and axis land on the reference's."""
    r = measure(silhouette(render))
    ref = measure(silhouette(reference), seat_y)
    r_glass = measure(silhouette(render), int(round(r["top"] + (seat_y - ref["top"]) * (r["foot"] - r["top"]) / max(1, ref["foot"] - ref["top"]))))
    sx = ref["barrelPx"] / r_glass["barrelPx"]
    sy = (ref["foot"] - ref["top"]) / max(1, r["foot"] - r["top"])
    big = render.convert("RGB").resize((round(render.width * sx), round(render.height * sy)), Image.LANCZOS)
    out = Image.new("RGB", render.size, (255, 255, 255))
    out.paste(big, (round(ref["axisX"] - r_glass["axisX"] * sx), round(ref["top"] - r["top"] * sy)))
    return out, {"scaleX": round(sx, 4), "scaleY": round(sy, 4), "raw": r, "reference": ref}


def key_out(img: Image.Image) -> Image.Image:
    """Paper to alpha: the darker the mark, the more opaque; the ink keeps its own tone."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    lum = rgb.mean(axis=2)
    alpha = np.clip((255.0 - lum) / (255.0 - 40.0), 0, 1)     # 40 = full ink
    alpha[lum >= PAPER_FLOOR] = 0
    alpha = ndi.gaussian_filter(alpha, 0.4)
    out = np.dstack([rgb, alpha * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def compare(a: np.ndarray, b: np.ndarray) -> dict:
    edge = lambda x: x ^ ndi.binary_erosion(x)
    iou = (a & b).sum() / max(1, (a | b).sum())
    da, db = ndi.distance_transform_edt(~edge(b)), ndi.distance_transform_edt(~edge(a))
    dev = np.concatenate([da[edge(a)], db[edge(b)]])
    return {"iou": round(float(iou), 4), "edgeP95Px": round(float(np.percentile(dev, 95)), 1), "edgeMaxPx": round(float(dev.max()), 1)}


def draw_dimensioned(art: Image.Image, placement: dict, closure: str, dims: dict | None) -> Image.Image:
    """The final drawing at 2x slot size: art centred, dimension lines from placement, figures from data."""
    W, H = SLOT[0] * SCALE, SLOT[1] * SCALE
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    closure_top = placement["closures"][closure]["closureTopY"] or placement["seatY"]
    foot = placement["footY"]
    axis = placement["axisX"]
    glass = placement["glass"]
    src_h = foot - closure_top
    # leave 12% at the top and bottom for the diameter line and breathing room; 84 px each side for figures
    target_h = H * 0.70
    s = target_h / src_h
    crop_top = closure_top - int(0.06 * H / s)
    crop = art.crop((0, max(0, crop_top), art.width, min(art.height, foot + int(0.10 * H / s))))
    scaled = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    ox = round(W / 2 - axis * s)
    oy = round(H * 0.10 - (closure_top - max(0, crop_top)) * s)
    canvas.alpha_composite(scaled, (ox, oy))
    y_of = lambda y: oy + (y - max(0, crop_top)) * s
    x_of = lambda x: ox + x * s
    d = ImageDraw.Draw(canvas)
    fl, fs = font(9 * SCALE, "Medium"), font(8 * SCALE)
    tick = 3 * SCALE
    line_w = 1
    gl, gr = x_of(glass["left"]), x_of(glass["right"])
    y_top, y_seat, y_foot = y_of(closure_top), y_of(placement["seatY"]), y_of(foot)

    def vline(x, y0, y1, label):
        d.line([(x, y0), (x, y1)], fill=GOLD, width=line_w)
        d.line([(x - tick, y0), (x + tick, y0)], fill=GOLD, width=line_w)
        d.line([(x - tick, y1), (x + tick, y1)], fill=GOLD, width=line_w)
        tw = d.textlength(label, font=fl)
        d.text((x - tw / 2, (y0 + y1) / 2 - 7 * SCALE), label, fill=INK, font=fl)

    def hline(y, x0, x1, label):
        d.line([(x0, y), (x1, y)], fill=GOLD, width=line_w)
        d.line([(x0, y - tick), (x0, y + tick)], fill=GOLD, width=line_w)
        d.line([(x1, y - tick), (x1, y + tick)], fill=GOLD, width=line_w)
        tw = d.textlength(label, font=fl)
        d.text(((x0 + x1) / 2 - tw / 2, y + 4 * SCALE), label, fill=INK, font=fl)

    if dims:
        gap = 14 * SCALE
        if dims.get("hCap") and closure != "bare":
            x = gr + gap * 2.2
            d.line([(gr + 4, y_top), (x + tick, y_top)], fill=GOLD, width=line_w)
            d.line([(gr + 4, y_foot), (x + tick, y_foot)], fill=GOLD, width=line_w)
            vline(x, y_top, y_foot, f"{dims['hCap']} mm")
        if dims.get("hBare"):
            x = gl - gap * 2.2
            d.line([(x - tick, y_seat), (gl - 4, y_seat)], fill=GOLD, width=line_w)
            d.line([(x - tick, y_foot), (gl - 4, y_foot)], fill=GOLD, width=line_w)
            vline(x, y_seat, y_foot, f"{dims['hBare']} mm")
        if dims.get("dia"):
            y = y_foot + gap * 1.1
            d.line([(gl, y_foot + 4), (gl, y + tick)], fill=GOLD, width=line_w)
            d.line([(gr, y_foot + 4), (gr, y + tick)], fill=GOLD, width=line_w)
            hline(y, gl, gr, f"Ø {dims['dia']} mm")
        if dims.get("neck"):
            # leader from the neck to a label at the top left
            nx, ny = gl + 2 * SCALE, y_seat + 4 * SCALE
            lx, ly = gl - gap * 2.6, y_top - 2 * SCALE
            d.line([(nx, ny), (lx + 26 * SCALE, ly + 6 * SCALE)], fill=GOLD, width=line_w)
            d.ellipse([(nx - 2, ny - 2), (nx + 2, ny + 2)], fill=GOLD)
            d.text((lx - 8 * SCALE, ly - 10 * SCALE), f"Neck {dims['neck']}", fill=INK, font=fs)
    return canvas


WEB_HEIGHT = 800   # the derivative's height in px (2x of a ~400 px tall slot at most)


def export_web(art: Image.Image, placement: dict, closure: str, style: str, body: str) -> dict:
    """Crop the keyed-out trace to the bottle, scale it, save a WebP under public/, return its geometry."""
    closure_top = placement["closures"][closure]["closureTopY"] or placement["seatY"]
    foot, axis, glass = placement["footY"], placement["axisX"], placement["glass"]
    pad = int((foot - closure_top) * 0.04)
    top, bottom = max(0, closure_top - pad), min(art.height, foot + pad)
    half = max(axis - glass["left"], glass["right"] - axis) * 1.6
    left, right = int(max(0, axis - half)), int(min(art.width, axis + half))
    crop = art.crop((left, top, right, bottom))
    s = WEB_HEIGHT / crop.height
    web = crop.resize((round(crop.width * s), WEB_HEIGHT), Image.LANCZOS)
    out_dir = ROOT / "public" / "assets" / "drawings" / body
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"{closure}-{style}.webp"
    web.save(out_dir / name, "WEBP", quality=88, method=6)
    return {"src": f"/assets/drawings/{body}/{name}", "width": web.width, "height": web.height,
            "closureTopY": round((closure_top - top) * s, 1), "seatY": round((placement["seatY"] - top) * s, 1), "footY": round((foot - top) * s, 1),
            "axisX": round((axis - left) * s, 1), "glassLeft": round((glass["left"] - left) * s, 1), "glassRight": round((glass["right"] - left) * s, 1),
            "bytes": (out_dir / name).stat().st_size}


def parse_dims(items: list[str]) -> dict[str, dict]:
    out = {}
    for item in items:
        closure, values = item.split("=", 1)
        h_cap, h_bare, dia, neck = (values.split(",") + ["", "", "", ""])[:4]
        out[closure] = {"hCap": h_cap or None, "hBare": h_bare or None, "dia": dia or None, "neck": neck or None}
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body", default="cylinder-9ml-17-415")
    ap.add_argument("--dims", action="append", default=[])
    args = ap.parse_args()
    base = ROOT / "output" / "register-drawings" / args.body
    placement = json.loads((base / "inputs" / "placement.json").read_text())
    dims = parse_dims(args.dims)
    (base / "final").mkdir(exist_ok=True)
    results = {}
    registry: dict[str, dict] = {}
    finals: list[tuple[str, Image.Image]] = []
    for render_path in sorted((base / "renders").glob("*.png")):
        name = render_path.stem
        closure, style = name.rsplit("-", 1)
        reference = Image.open(base / "inputs" / f"{closure}.png")
        render = Image.open(render_path)
        fitted, info = fit(render, reference, placement["seatY"])
        quality = compare(silhouette(fitted), silhouette(reference))
        art = key_out(fitted)
        art.save(base / "final" / f"{name}-art.png", optimize=True)
        drawing = draw_dimensioned(art, placement, closure, dims.get(closure))
        drawing.save(base / "final" / f"{name}.png", optimize=True)
        finals.append((name, drawing))
        web = export_web(art, placement, closure, style, args.body)
        results[name] = {"fit": info, "silhouette": quality, "dims": dims.get(closure), "web": web}
        registry.setdefault(closure, {})[style] = {k: v for k, v in web.items() if k != "bytes"}
        print(f"{name:20} fitted IoU {quality['iou']:.4f} p95 {quality['edgeP95Px']:.1f}px max {quality['edgeMaxPx']:.0f}px  scale {info['scaleX']}x{info['scaleY']}")
    (base / "qa.json").write_text(json.dumps(results, indent=1) + "\n")
    data_dir = ROOT / "data" / "register" / "drawings"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / f"{args.body}.json").write_text(json.dumps({"body": args.body, "canvas": placement["canvas"], "source": "scripts/register/drawings (Sunburst 2.5 traces of the register composition; figures are drawn by the page from the SKU's data)", "closures": registry}, indent=1) + "\n")
    print(f"web derivatives + {data_dir / (args.body + '.json')}: " + ", ".join(f"{n} {r['web']['bytes'] // 1024} KB" for n, r in results.items()))

    # ---------- review sheet: slot size on the white tech-sheet card, and 2x ----------
    n = len(finals)
    W2, H2 = SLOT[0] * SCALE, SLOT[1] * SCALE
    sheet = Image.new("RGB", (40 + n * (W2 + 30), 60 + H2 + 40 + SLOT[1] + 60), (0xF5, 0xF3, 0xEF))
    d = ImageDraw.Draw(sheet)
    d.text((16, 14), f"Dimension drawings, {args.body}: Sunburst 2.5 traces fitted to the register geometry, figures from the SKU's data. Top: 2x. Bottom: at the tech sheet's 200 px slot.", fill=INK, font=font(15))
    for i, (name, drawing) in enumerate(finals):
        x = 20 + i * (W2 + 30)
        card = Image.new("RGB", (W2, H2), (255, 255, 255))
        card.paste(drawing, (0, 0), drawing)
        sheet.paste(card, (x, 50))
        d.rectangle((x, 50, x + W2 - 1, 50 + H2 - 1), outline=(226, 222, 214))
        d.text((x, 50 + H2 + 8), name, fill=INK, font=font(14, "Medium"))
        q = results[name]["silhouette"]
        d.text((x + 140, 50 + H2 + 9), f"IoU {q['iou']:.3f} · p95 {q['edgeP95Px']:.1f}px", fill=(90, 90, 90), font=font(12))
        small = Image.new("RGB", SLOT, (255, 255, 255))
        small.paste(drawing.resize(SLOT, Image.LANCZOS), (0, 0), drawing.resize(SLOT, Image.LANCZOS))
        sheet.paste(small, (x, 50 + H2 + 40))
        d.rectangle((x, 50 + H2 + 40, x + SLOT[0] - 1, 50 + H2 + 40 + SLOT[1] - 1), outline=(226, 222, 214))
    out = base / "review-drawings.png"
    sheet.save(out, optimize=True)
    print(out)


if __name__ == "__main__":
    main()
