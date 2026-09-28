#!/usr/bin/env python3
"""Size-consistency audit: measure the glass in every image the product page and
Build Your Bottle draw, and turn it into on-screen pixels.

Inputs (written by pdp-stage.ts and byb-preview.ts):
  output/size-audit/pdp-stage.json    one row per live SKU: stage source, frame, body layer or fallback image
  output/size-audit/byb-preview.json  one row per builder preview: frame (SVG viewBox), body layer or fallback

Glass width is measured, never read from bounding boxes: rows of solid pixels
(alpha > 128, or colour distance from the image's own background when the image
is opaque), the component that holds the most pixels, and the median width of
the glass band (rows at least 60% as wide as the widest row). A clear glass's
faint halo cannot move it (the builder's bounding-box normaliser saw 259 vs 241 px
on the 5 ml clear and cobalt layers for the same glass).

Screen geometry (desktop, measured on production at 1440 x 900):
  PDP layered: canvas box = STAGE_H * 10/11 wide; glass px = img px * (box.width/img.width for a
               register part, 1 for a full-canvas kit layer) * frame.scale * canvasBox/1000
  PDP photo:   .stageFallback box (stage - 24/24/48 insets), object-fit contain
  BYB layered: SVG viewBox = frame, preserveAspectRatio meet in the preview box
  BYB photo:   object-fit contain in the preview box, then scale(0.88)

  python3 scripts/audit/size-consistency/measure.py
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import statistics
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "output" / "size-audit"
CACHE = OUT / "img"
PUBLIC = ROOT / "public"

# Desktop geometry, measured on production (see the report's method section).
GEOM = json.loads((OUT / "geometry.json").read_text()) if (OUT / "geometry.json").exists() else {
    "pdpStageW": 700.0, "pdpStageH": 540.0, "bybBoxW": 430.0, "bybBoxH": 600.0,
}


def fetch(url: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    if url.startswith("/"):
        local = PUBLIC / url.lstrip("/").split("?")[0]
        return local if local.exists() else None
    fn = CACHE / (hashlib.sha1(url.encode()).hexdigest() + Path(url.split("?")[0]).suffix[:6])
    if fn.exists() and fn.stat().st_size > 0:
        return fn
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "best-bottles-size-audit"})
            fn.write_bytes(urllib.request.urlopen(req, timeout=60).read())
            return fn
        except Exception:
            if attempt == 2:
                return None
    return None


def glass_width(path: Path) -> dict | None:
    """Median solid width of the glass band, in image px, plus where the glass sits."""
    try:
        im = Image.open(path)
        im.seek(0)
        im = im.convert("RGBA")
    except Exception:
        return None
    a = np.asarray(im)
    alpha = a[..., 3]
    h, w = alpha.shape
    border = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
    if (border < 200).mean() > 0.5:                      # transparent surround: use alpha
        mask = alpha > 128
        mode = "alpha"
    else:                                                # opaque photo: distance from its own background
        rgb = a[..., :3].astype(np.int16)
        edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bg = np.median(edge, axis=0)
        mask = np.abs(rgb - bg).max(axis=2) > 24
        mask = ndi.binary_opening(mask, iterations=1)
        mode = "background"
    labels, n = ndi.label(mask)
    if n == 0:
        return None
    sizes = ndi.sum(mask, labels, range(1, n + 1))
    main = labels == (int(np.argmax(sizes)) + 1)
    rows = np.where(main.any(axis=1))[0]
    lefts = np.array([np.argmax(main[y]) for y in rows])
    rights = np.array([w - 1 - np.argmax(main[y][::-1]) for y in rows])
    widths = rights - lefts + 1
    wmax = int(np.percentile(widths, 98))
    band = widths >= 0.6 * wmax
    band_rows = rows[band]
    return {
        "mode": mode, "imgW": w, "imgH": h,
        "width": float(np.median(widths[band])),
        "bandTop": int(band_rows.min()), "bandBottom": int(band_rows.max()),
        "top": int(rows.min()), "bottom": int(rows.max()),
        "axis": float(np.median((lefts[band] + rights[band]) / 2)),
    }


def photo_glass_width(path: Path) -> dict | None:
    """Glass width in a flat photo (opaque, usually white). The glass and its closure stack make the photo's
    tallest column, so the centre line is the peak of the vertical projection (a bulb, tassel or beside cap is
    shorter). Walking up from that column's foot, each row's width is the filled run through the centre line;
    where a clear glass's pale interior leaves the centre unfilled, the nearest wall on each side is run out to
    its outer edge instead. The glass band is the rows at least 60% as wide as the widest."""
    try:
        im = Image.open(path)
        im.seek(0)
        im = im.convert("RGBA")
    except Exception:
        return None
    a = np.asarray(im)
    h, w = a.shape[:2]
    rgb = a[..., :3].astype(np.int16)
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(edge, axis=0)
    mask = (np.abs(rgb - bg).max(axis=2) > 8) & (a[..., 3] > 128)
    mask = ndi.binary_opening(mask, iterations=1)
    mask = ndi.binary_closing(mask, iterations=2)
    if mask.sum() < 50:
        return None
    filled = ndi.binary_fill_holes(mask)
    proj = ndi.uniform_filter1d(filled.sum(axis=0).astype(float), size=max(3, w // 100))
    ax = int(np.argmax(proj))
    col = np.where(filled[:, ax])[0]
    if len(col) == 0:
        return None
    bottom = int(col.max())
    top = int(col.min())
    widths, used = [], []
    for y in range(bottom - 2, top + int((bottom - top) * 0.35), -1):
        row, fill = mask[y], filled[y]
        if fill[ax]:
            left = right = ax
            while left > 0 and fill[left - 1]:
                left -= 1
            while right < w - 1 and fill[right + 1]:
                right += 1
        else:
            left = ax
            while left > 0 and not row[left]:
                left -= 1
            while left > 0 and row[left - 1]:
                left -= 1
            right = ax
            while right < w - 1 and not row[right]:
                right += 1
            while right < w - 1 and row[right + 1]:
                right += 1
            if not (row[left] and row[right]):
                continue
        if right > left:
            widths.append(right - left + 1)
            used.append(y)
    if not widths:
        return None
    widths = np.array(widths)
    wmax = np.percentile(widths, 95)
    keep = widths >= 0.6 * wmax
    band = np.array(used)[keep]
    return {"mode": "photo", "imgW": w, "imgH": h, "width": float(np.median(widths[keep])),
            "bandTop": int(band.min()), "bandBottom": int(band.max()), "top": top, "bottom": bottom, "axis": float(ax)}

def parse_scale(transform: str | None) -> float:
    if not transform:
        return 1.0
    k = 1.0
    for m in re.finditer(r"scale\(\s*([-\d.eE]+)(?:[ ,]+([-\d.eE]+))?\s*\)", transform):
        k *= float(m.group(1))
    return k


def main() -> None:
    pdp = json.loads((OUT / "pdp-stage.json").read_text())
    byb = json.loads((OUT / "byb-preview.json").read_text())
    urls = set()
    for r in pdp:
        if r.get("body"):
            urls.add(r["body"]["url"])
        elif r.get("fallback"):
            urls.add(r["fallback"])
    for r in byb:
        if r.get("body"):
            urls.add(r["body"]["url"])
        elif r.get("fallback"):
            urls.add(r["fallback"])
    urls = sorted(urls)
    with ThreadPoolExecutor(16) as pool:
        files = dict(zip(urls, pool.map(fetch, urls)))
    missing = [u for u, f in files.items() if f is None]
    photo_urls = {r["fallback"] for r in pdp if not r.get("body") and r.get("fallback")} | {r["fallback"] for r in byb if not r.get("body") and r.get("fallback")}
    measures = {}
    for u, f in files.items():
        if f is not None:
            measures[u] = photo_glass_width(f) if u in photo_urls else glass_width(f)
    print(f"images: {len(urls)}  downloaded {len(urls) - len(missing)}  unmeasurable {sum(1 for v in measures.values() if v is None)}  missing {len(missing)}")

    box_w = GEOM["pdpStageH"] * 10 / 11                 # the canvas box (stage is wider than 10:11)
    fb_w, fb_h = GEOM["pdpStageW"] - 48, GEOM["pdpStageH"] - 72
    for r in pdp:
        r["screen"] = None
        if r.get("body"):
            m = measures.get(r["body"]["url"])
            if not m:
                continue
            b = r["body"]
            img2canvas = (b["box"]["width"] / b["imageWidth"]) if b.get("box") else (r["canvas"]["width"] / m["imgW"])
            canvas_w = m["width"] * img2canvas
            r["glassCanvasPx"] = canvas_w
            r["screen"] = canvas_w * r["frame"]["scale"] * box_w / r["canvas"]["width"]
            r["measureMode"] = m["mode"]
        elif r.get("fallback"):
            m = measures.get(r["fallback"])
            if not m:
                continue
            fit = min(fb_w / m["imgW"], fb_h / m["imgH"], 1e9)
            r["screen"] = m["width"] * fit
            r["measureMode"] = m["mode"]
    for r in byb:
        r["screen"] = None
        if r.get("body"):
            m = measures.get(r["body"]["url"])
            if not m or not r.get("frame"):
                continue
            b = r["body"]
            img2canvas = (b["box"]["width"] / b["imageWidth"]) if b.get("box") else 1.0
            layer = parse_scale(b.get("transform")) if not b.get("box") else 1.0
            f = r["frame"]
            bw, bh = (GEOM["bybBodyBoxW"], GEOM["bybBodyBoxH"]) if r["stage"] == "body" else (GEOM["bybBoxW"], GEOM["bybBoxH"])
            meet = min(bw / f["width"], bh / f["height"])
            r["glassCanvasPx"] = m["width"] * img2canvas * layer
            r["frameScale"] = meet
            r["screen"] = r["glassCanvasPx"] * meet
            r["measureMode"] = m["mode"]
        elif r.get("fallback"):
            m = measures.get(r["fallback"])
            if not m:
                continue
            bw, bh = (GEOM["bybBodyBoxW"], GEOM["bybBodyBoxH"]) if r["stage"] == "body" else (GEOM["bybBoxW"], GEOM["bybBoxH"])
            fit = min(bw / m["imgW"], bh / m["imgH"])
            r["screen"] = m["width"] * fit * 0.88
            r["measureMode"] = m["mode"]

    (OUT / "measures.json").write_text(json.dumps(measures, indent=1))
    (OUT / "pdp-measured.json").write_text(json.dumps(pdp, indent=1))
    (OUT / "byb-measured.json").write_text(json.dumps(byb, indent=1))
    print("pdp measured", sum(1 for r in pdp if r["screen"]), "of", len(pdp), "| byb measured", sum(1 for r in byb if r["screen"]), "of", len(byb))


if __name__ == "__main__":
    main()
