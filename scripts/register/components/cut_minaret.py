#!/usr/bin/env python3
"""
LIB-13-415-MinarCu and LIB-13-415-MinarSl, the Minaret cap in matte copper and shiny silver (2026-10-01, Build Your
Bottle checklist 7a). Ten SKUs are sold with it (Elegant 15 clear and frosted, Flair 15, Footed Rectangle 10 and
Royal 13, in each finish) and it is not sold loose. No library PSD or master photo holds it: the only photographs are
bestbottles.com's, the cap alone (images/store/caps/13-415MinarCu.png, 300 x 400) and each bottle capped
(images/store/capped/<sku>.gif).

- copper: the cap-alone photo, cut from its white ground (edge pixels un-blended from the white);
- size: its height is the mean of the capped photos that fit their register plates (hero_fit.fit, score >= 0.5: the
  Flair 15, Footed Rectangle 10 and Royal 13 photos; the Elegant 15 photos do not fit), about 22.8 mm;
- seat: its top 12.4 mm above the rim, from the catalogue's height with cap less without (12, 12, 13 mm on Elegant 15,
  Flair 15 and Royal 13; the Footed Rectangle 10's 21 mm is an outlier) and the Flair photo's 12.8 mm. The seat-drop
  audit (scripts/register/seats/audit-seats.ts --local-component) then rests the skirt on each glass's shoulder;
- silver: regenerated from the copper with gpt-image-2.5-sunburst, as Jordan asked (checklist 7a), its geometry locked,
  and cut with the copper's own silhouette, so the two finishes are one cap.

  python3 scripts/register/components/cut_minaret.py --fetch            # download the legacy photos (gitignored output/)
  python3 scripts/register/components/cut_minaret.py                    # cut + measure (writes 13-415-measurements.json)
  python3 scripts/register/components/cut_minaret.py --render           # also render the silver (OPENAI_API_KEY)
  python3 scripts/register/components/cut_minaret.py --silver <png>     # cut the silver from a render
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.request
import uuid
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tubes"))
from cut_components import REGISTER, ROOT, crop_save, recentre, sha, solid_bottom  # noqa: E402
from hero_fit import fit  # noqa: E402

COPPER, SILVER = "LIB-13-415-MinarCu", "LIB-13-415-MinarSl"
MEASURE = REGISTER / "components" / "13-415-measurements.json"
OUT = ROOT / "output" / "register-components" / "13-415"
SRC = ROOT / "output" / "register-components" / "minaret-src"
SITE = "https://www.bestbottles.com/images/store/"
CAP_PHOTO = "caps/13-415MinarCu.png"
CAPPED = {  # the capped photo of each copper SKU and its register plate
    "GBElg15MinarCu": "elegant-15ml-13-415|Clear", "GBElgFrst15MinarCu": "elegant-15ml-13-415|Frosted",
    "GBFlair15MinarCu": "flair-15ml-13-415|Clear", "GBRect10MinarCu": "footed-rectangle-10ml-13-415|Clear",
    "GBRoyal13MinarCu": "royal-13ml-13-415|Clear",
}
MIN_FIT = 0.5
TOP_ABOVE_RIM_MM = 12.4
BONE = (245, 243, 239)
RENDER_SIZE, RENDER_FIT = 1024, 820
SILVER_PROMPT = (
    "1. Keep the cap's geometry locked to the image: the same outline, size, position and proportions, the same pointed tip, "
    "onion dome, step and skirt band.\n"
    "2. The same Minaret cap in shiny silver: polished, bright silver metal with crisp highlights and soft reflections, "
    "in place of the matte copper.\n"
    "3. Plain pure white background, no shadow, no floor. Enhance the quality.")


def fetch() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    for path in [CAP_PHOTO] + [f"capped/{sku}.gif" for sku in CAPPED]:
        to = SRC / Path(path).name if path == CAP_PHOTO else SRC / f"capped-{Path(path).name}"
        to.write_bytes(urllib.request.urlopen(SITE + path, timeout=60).read())
        print("fetched", to.relative_to(ROOT))


def cap_from_white(path: Path) -> Image.Image:
    """The cap on its white ground: alpha 1 inside its outline, a ramp on the edge, the white un-blended from the edge."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    ink = (255 - a).max(-1)
    solid = ndimage.binary_fill_holes(ndimage.binary_closing(ink > 40, iterations=2))
    lab, n = ndimage.label(solid)
    keep = lab == (int(np.argmax(ndimage.sum(solid, lab, range(1, n + 1)))) + 1)
    edge = ndimage.binary_dilation(keep, iterations=2) & ~ndimage.binary_erosion(keep, iterations=2)
    alpha = np.where(edge, np.clip(ink / 60.0, 0, 1), keep.astype(float))
    al = alpha[..., None]
    rgb = np.where(al > 0.05, (a - (1 - al) * 255) / np.maximum(al, 1e-3), a).clip(0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8))


def on_bone(path: Path) -> np.ndarray:
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    a[a.min(-1) > 248] = BONE      # the legacy photos stand on pure white; the fit expects the stage bone
    return a.astype(np.uint8)


def plate_rgb(p: dict) -> np.ndarray:
    im = Image.open(ROOT / "output" / "register-bodies" / p["file"]).convert("RGBA")
    return np.asarray(Image.alpha_composite(Image.new("RGBA", im.size, BONE + (255,)), im).convert("RGB"))


def copper_rows(photo: np.ndarray) -> tuple[int, int]:
    """The copper cap's top and bottom rows in a capped photo: the largest copper-coloured piece."""
    a = photo.astype(float) / 255
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    m = (sat > 0.22) & (a[..., 0] > a[..., 1]) & (a[..., 1] >= a[..., 2] * 0.85) & (mx > 0.15)
    lab, n = ndimage.label(m)
    cap = lab == (int(np.argmax(ndimage.sum(m, lab, range(1, n + 1)))) + 1)
    rows = np.where(cap.any(axis=1))[0]
    return int(rows.min()), int(rows.max())


def measure_height(plates: dict) -> tuple[float, dict]:
    """The cap's height in mm from each capped photo fitted onto its plate (cached in OUT); the mean of the good fits."""
    cache = OUT / "minaret-fits.json"
    fits = json.loads(cache.read_text()) if cache.exists() else {}
    for sku, pk in CAPPED.items():
        if sku in fits:
            continue
        p = plates[pk]
        photo = on_bone(SRC / f"capped-{sku}.gif")
        f = fit(plate_rgb(p), p["anchors"], photo, frosted=p["glass"] == "Frosted")
        top, bottom = copper_rows(photo)
        mm_per_px = 1 / (f["scale"] * p["pxPerMm"])
        seat = f["ty"] + f["scale"] * p["anchors"]["seatY"]
        fits[sku] = {"plate": pk, "score": round(f["score"], 3), "heightMm": round((bottom - top + 1) * mm_per_px, 2),
                     "topAboveRimMm": round((seat - top) * mm_per_px, 2), "bottomBelowRimMm": round((bottom - seat) * mm_per_px, 2)}
        cache.write_text(json.dumps(fits, indent=1))
    good = [v["heightMm"] for v in fits.values() if v["score"] >= MIN_FIT]
    if len(good) < 2:
        raise SystemExit(f"only {len(good)} capped photo(s) fit their plate; cannot size the cap")
    return float(np.mean(good)), fits


def render_input(cap: Image.Image) -> tuple[Image.Image, Image.Image]:
    """The cap centred on a white square, and its silhouette there."""
    scale = min(RENDER_FIT / cap.height, RENDER_FIT / cap.width)
    fitted = cap.resize((round(cap.width * scale), round(cap.height * scale)), Image.LANCZOS)
    x, y = (RENDER_SIZE - fitted.width) // 2, (RENDER_SIZE - fitted.height) // 2
    canvas = Image.new("RGB", (RENDER_SIZE, RENDER_SIZE), (255, 255, 255))
    canvas.paste(fitted, (x, y), fitted)
    silhouette = Image.new("L", (RENDER_SIZE, RENDER_SIZE), 0)
    silhouette.paste(fitted.split()[-1], (x, y))
    return canvas, silhouette


def render(inp: Path, out: Path) -> None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        for line in (ROOT / ".env.local").read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in {"model": "gpt-image-2.5-sunburst", "prompt": SILVER_PROMPT, "size": f"{RENDER_SIZE}x{RENDER_SIZE}", "quality": "high", "n": "1"}.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="{inp.name}"\r\nContent-Type: image/png\r\n\r\n').encode() + inp.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    request = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(request, timeout=400) as response:
        out.write_bytes(base64.b64decode(json.load(response)["data"][0]["b64_json"]))


def ink_box(rgb: np.ndarray) -> tuple[int, int, int, int]:
    ink = rgb.mean(axis=2) < 235
    rows, cols = np.where(ink.any(axis=1))[0], np.where(ink.any(axis=0))[0]
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


def silver_from_render(rendered: Path, canvas: Image.Image, silhouette: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, dict]:
    """The render's cap box fitted onto the copper's box, cut with the copper's silhouette, at the copper layer's size."""
    out = Image.open(rendered).convert("RGB").resize((RENDER_SIZE, RENDER_SIZE), Image.LANCZOS)
    il, it, ir, ib = ink_box(np.asarray(canvas).astype(float))
    ol, ot, orr, ob = ink_box(np.asarray(out).astype(float))
    fitted = out.crop((ol, ot, orr + 1, ob + 1)).resize((ir - il + 1, ib - it + 1), Image.LANCZOS)
    aligned = Image.new("RGB", (RENDER_SIZE, RENDER_SIZE), (255, 255, 255))
    aligned.paste(fitted, (il, it))
    rgba = aligned.convert("RGBA")
    rgba.putalpha(silhouette)
    cap = rgba.crop(silhouette.getbbox()).resize(size, Image.LANCZOS)
    return cap, {"x": round((ir - il + 1) / (orr - ol + 1), 4), "y": round((ib - it + 1) / (ob - ot + 1), 4)}


def entry_for(cid: str, finish: str, cap: Image.Image, file: str, ppm: float, cx: float, top: int, fits: dict, source: str, extra: dict) -> dict:
    return {
        "componentId": cid, "websiteSku": "", "type": "cap", "psd": None,
        "reference": {"photo": SITE + CAP_PHOTO, "finish": finish, "cappedPhotos": fits, "topAboveRimMm": TOP_ABOVE_RIM_MM},
        "layers": [{"slot": "cap", "layerName": source, "file": file, "width": cap.width, "height": cap.height, "sha256": sha(cap),
                    "pxPerMm": round(ppm, 4), "anchor": {"x": round(cx, 1), "y": round(top + TOP_ABOVE_RIM_MM * ppm, 1)},
                    "z": "front", "explodeIndex": 1, "solidBottomY": solid_bottom(cap)}],
        "checks": {"status": "cut from bestbottles.com's photos (cut_minaret.py); no library PSD or master photo holds the Minaret",
                   "approvable": True, **extra},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="store_true", help="download the legacy photos into output/register-components/minaret-src/")
    ap.add_argument("--render", action="store_true", help="render the silver with gpt-image-2.5-sunburst (about $0.20)")
    ap.add_argument("--silver", type=Path, help="cut the silver from this render instead of rendering")
    args = ap.parse_args()
    if args.fetch:
        fetch()
    plates = {p["plateKey"]: p for p in json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text())}
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MEASURE.read_text())
    entries = {c["componentId"]: c for c in data["components"]}

    height_mm, fits = measure_height(plates)
    copper = cap_from_white(SRC / Path(CAP_PHOTO).name)
    cut, x0, y0 = crop_save(copper, OUT / f"{COPPER}--cap.png")
    rows = np.where((np.asarray(cut.getchannel("A")) > 128).any(axis=1))[0]
    ppm = (rows.max() - rows.min() + 1) / height_mm
    skirt = np.asarray(cut.getchannel("A"))[rows.max() - int(1.0 * ppm)] > 128      # the skirt band 1 mm above the bottom edge
    cx = float(np.where(skirt)[0].mean())
    entry = entry_for(COPPER, "Matte Copper", cut, f"{COPPER}--cap.png", ppm, cx, int(rows.min()), fits,
                      f"bestbottles.com {CAP_PHOTO}", {"heightMm": round(height_mm, 2)})
    entry["checks"]["recentredMm"] = recentre(entry, OUT)
    entries[COPPER] = entry
    print(f"copper  {cut.width}x{cut.height} at {ppm:.2f} px/mm ({cut.width / ppm:.2f} x {cut.height / ppm:.2f} mm); "
          f"capped photos: " + ", ".join(f"{k} {v['heightMm']} mm (fit {v['score']})" for k, v in fits.items()))

    rendered = args.silver or (OUT / f"{SILVER}--render.png")
    if args.render or args.silver or rendered.exists():
        canvas, silhouette = render_input(cut)
        canvas.save(OUT / f"{SILVER}--render-input.png")
        if args.render:
            render(OUT / f"{SILVER}--render-input.png", rendered)
        silver, fit_xy = silver_from_render(Path(rendered), canvas, silhouette, cut.size)
        silver.save(OUT / f"{SILVER}--cap.png", optimize=True)
        s_entry = entry_for(SILVER, "Shiny Silver", silver, f"{SILVER}--cap.png", ppm, entry["layers"][0]["anchor"]["x"], int(rows.min()), fits,
                            f"gpt-image-2.5-sunburst edit of {COPPER} (geometry locked), cut with its silhouette",
                            {"heightMm": round(height_mm, 2), "renderBoxFit": fit_xy})
        entries[SILVER] = s_entry
        print(f"silver  {silver.width}x{silver.height}, render box fitted onto the copper: x {fit_xy['x']}, y {fit_xy['y']}")
    else:
        print("silver: no render yet (--render)")
    data["components"] = [entries[k] for k in sorted(entries)]
    MEASURE.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {MEASURE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
