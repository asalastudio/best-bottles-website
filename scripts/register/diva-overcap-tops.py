#!/usr/bin/env python3
"""Give the Diva overcaps back their tops (Jordan, 7 Nov 2026: "the tops of the caps ... on the sidecar seem to be
trimmed from the top ... shaved a little bit, or cut off").

23 of the 24 Diva overcap layers in the 4 Nov masters start fully opaque on their very first row (alpha 255, no
antialiased edge): the cut-out ran through the cap, so the rounded top is missing and the cap stands ~5% short
(height/width 1.72 against 1.80 in the photograph). The pump and sprayer actuators are intact (soft first rows).

Each finish's register plate is the real cap-on photograph, with the whole cap and its rounded top. For every cut
overcap this cuts the cap out of a plate of the same finish (top row to the rim where it meets the neck ring; the
metal is opaque, only its outline is antialiased), upscales it to the layer's resolution and writes it to
public/images/diva-overcaps-2026-11-07/. For each kit using that overcap it records a new box with the same cap
width, centre and bottom rim as before, so only the missing top is restored; approved-component-kits.ts applies it.

  python3 scripts/register/diva-overcap-tops.py [--convex https://precise-raccoon-123.convex.cloud]
Reads published layers and plates over HTTPS; writes the images above and src/lib/paper-doll/diva-overcap-tops.json.
"""
import hashlib
import io
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KITS = ROOT / "src/lib/paper-doll/approved-kits.generated.json"
OUT_JSON = ROOT / "src/lib/paper-doll/diva-overcap-tops.json"
OUT_DIR = ROOT / "public/images/diva-overcaps-2026-11-07"
PUBLIC = "/images/diva-overcaps-2026-11-07"
CONVEX = sys.argv[sys.argv.index("--convex") + 1] if "--convex" in sys.argv else "https://precise-raccoon-123.convex.cloud"
_cache: dict[str, Image.Image] = {}


def fetch(url: str) -> Image.Image:
    if url not in _cache:
        with urllib.request.urlopen(url, timeout=60) as response:
            _cache[url] = Image.open(io.BytesIO(response.read())).convert("RGBA")
    return _cache[url]


def extent(row: np.ndarray):
    cols = np.where(row)[0]
    return (int(cols.min()), int(cols.max())) if len(cols) else None


def plates_for(skus: list[str]) -> dict[str, str]:
    body = json.dumps({"path": "productPlates:forSkus", "args": {"skus": skus}, "format": "json"}).encode()
    request = urllib.request.Request(f"{CONVEX}/api/query", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        value = json.load(response)["value"]
    return {sku: plate["image"] for sku, plate in value["plates"].items() if plate and plate.get("image")}


def cap_from_plate(plate: Image.Image, ratio: float, reach: float = 1.07) -> Image.Image:
    """The whole cap, rounded top to rim, cut from the white studio ground of a cap-on plate. `ratio` is the old
    layer's height/width: its rim is right and only a few percent is missing at the top, so the rim lies just past it."""
    rgb = np.asarray(plate.convert("RGB")).astype(np.float32)
    diff = np.abs(rgb - 255.0).max(axis=2)
    mask = diff > 14
    widths = [(e[1] - e[0]) if (e := extent(mask[y])) else 0 for y in range(mask.shape[0])]
    top = next(y for y, w in enumerate(widths) if w > 20)
    # The rim is where the rows stop looking like the cap: a cylinder repeats the same colours down its straight side,
    # the glass ring below does not (the ring is barely wider than the cap, so width cannot tell). Search only around
    # where the old layer's own proportion puts it, and take the sharpest change there: a shiny finish's highlight
    # bands or frosted glass close to silver can never end it early or late.
    e = extent(mask[top + 60])
    width = e[1] - e[0]
    cols = slice(e[0] + width // 5, e[1] - width // 5)
    body = rgb[top + 30:top + int(width * ratio * 0.7), cols].mean(axis=0)
    distance = np.array([float(np.abs(rgb[y, cols] - body).mean()) for y in range(mask.shape[0])])
    # The real caps are ~1.80x as tall as wide against ~1.72x in the cut layers, so at most ~5% is missing.
    lo, hi = top + int(width * ratio * 0.99), min(mask.shape[0] - 2, top + int(width * ratio * reach))
    step = distance[lo + 1:hi + 1] - distance[lo:hi]
    # The first strong change is the rim; the bottom of the glass ring below it can change more sharply.
    foot = lo + int(np.argmax(step > 0.5 * step.max())) - 1
    left = min(e[0] for y in range(top, foot + 1) if (e := extent(mask[y])))
    right = max(e[1] for y in range(top, foot + 1) if (e := extent(mask[y])))
    pad = 3
    y0, y1, x0, x1 = top - pad, foot + 1, left - pad, right + pad + 1
    alpha = np.clip((diff[y0:y1, x0:x1] - 6.0) / 12.0, 0.0, 1.0)
    # Metal is opaque: a near-white highlight on a silver cap must not read as see-through.
    for r in range(alpha.shape[0]):
        e = extent(mask[y0 + r, x0:x1])
        if e and e[1] - e[0] > 6:
            alpha[r, e[0] + 2:e[1] - 1] = 1.0
    out = np.dstack([rgb[y0:y1, x0:x1], alpha * 255.0]).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def content_box(image: Image.Image):
    """Cap width and centre from the middle of its straight side (a cut-out's stray corner pixels are ignored);
    top and bottom from the rows the cap actually fills."""
    a = np.asarray(image)[:, :, 3] > 40
    filled = [y for y in range(a.shape[0]) if a[y].mean() > 0.2]
    top, bottom = filled[0], filled[-1] + 1
    middle = [extent(a[y]) for y in range(top + (bottom - top) // 4, bottom - (bottom - top) // 4)]
    left = int(np.median([e[0] for e in middle if e]))
    right = int(np.median([e[1] for e in middle if e])) + 1
    return left, right, top, bottom

def main() -> None:
    rows = json.loads(KITS.read_text())["rows"]
    users: dict[str, list[str]] = defaultdict(list)
    for sku, kit in rows.items():
        if not (kit.get("register") or {}).get("bodyId", "").startswith("diva-"):
            continue
        for part in kit["parts"]:
            if part["slot"] == "overcap":
                users[part["image"]["url"]].append(sku)
    plates = plates_for(sorted({s for skus in users.values() for s in skus}))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    table: dict[str, dict] = {}
    for url, skus in sorted(users.items()):
        layer = fetch(url)
        a = np.asarray(layer)[:, :, 3]
        if (a[0] > 200).mean() <= 0.3:
            continue  # its top is intact
        sources = [s for s in sorted(skus) if s in plates]
        if not sources:
            print(f"no plate for {url}; left as it is")
            continue
        ol, orr, ot, ob = content_box(layer)
        # Every SKU sharing this cap has its own plate. Take the first whose cap restores a plausible top: only a few
        # percent is missing, so -3..+10 canvas px; a plate whose rim cannot be told from the ring would overshoot.
        candidates = []
        # A tighter search first only where the usual one overshoots (a rim that cannot be told from the ring).
        for source, reach in [(src, r) for r in (1.07, 1.04, 1.02) for src in sources]:
            cap = cap_from_plate(fetch(plates[source]), (ob - ot) / (orr - ol), reach)
            cl, cr, ct, cb = content_box(cap)
            k = (orr - ol) / (cr - cl)  # same pixel scale as the layer it replaces
            cap = cap.resize((round(cap.width * k), round(cap.height * k)), Image.LANCZOS)
            cl, cr, ct, cb = content_box(cap)
            restored = (cb - ct) - (ob - ot)  # in layer pixels
            candidates.append((restored, source, cap, (cl, cr, ct, cb)))
        box0 = next(p for p in rows[skus[0]]["parts"] if p["slot"] == "overcap")["box"]
        to_canvas = box0["height"] / layer.height
        fits = [c for c in candidates if -3 <= c[0] * to_canvas <= 10]
        restored, source, cap, (cl, cr, ct, cb) = fits[0] if fits else min(candidates, key=lambda c: abs(c[0] * to_canvas - 3))
        buffer = io.BytesIO()
        cap.save(buffer, "WEBP", lossless=True)
        data = buffer.getvalue()
        sha = hashlib.sha256(data).hexdigest()
        name = f"{url.rsplit('/', 1)[-1].split('.')[0][:16]}.{sha[:12]}.webp"
        (OUT_DIR / name).write_bytes(data)
        image = {"url": f"{PUBLIC}/{name}", "key": f"{PUBLIC}/{name}", "sha256": sha, "bytes": len(data), "width": cap.width, "height": cap.height}
        for sku in skus:
            part = next(p for p in rows[sku]["parts"] if p["slot"] == "overcap")
            box = part["box"]
            sx, sy = box["width"] / layer.width, box["height"] / layer.height
            centre = box["x"] + (ol + orr) / 2 * sx
            bottom = box["y"] + ob * sy
            s = (orr - ol) * sx / (cr - cl)  # canvas px per new image px: the cap keeps its width
            new_box = {"x": centre - (cl + cr) / 2 * s, "y": bottom - cb * s, "width": cap.width * s, "height": cap.height * s}
            table[sku] = {"image": image, "box": {k2: round(v, 3) for k2, v in new_box.items()}, "plate": source,
                          "restoredTopPx": round(box["y"] + ot * sy - (new_box["y"] + ct * s), 2)}
        print(f"{name}: from {source}'s plate for {len(skus)} kits; top restored by {table[skus[0]]['restoredTopPx']} canvas px")
    OUT_JSON.write_text(json.dumps({"version": "diva-overcap-tops-v1", "source": "scripts/register/diva-overcap-tops.py",
                                    "rows": dict(sorted(table.items()))}, indent=1) + "\n")


if __name__ == "__main__":
    main()
