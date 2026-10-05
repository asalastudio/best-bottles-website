#!/usr/bin/env python3
"""
LIB-18-415-WhtPumpClOvrCp, the white rectangular lotion pump under the clear overcap (2026-10-01, Build Your Bottle
checklist 6a). Nine SKUs are sold with it (Elegant 60/100 clear and frosted, Sleek 30/50/100, Empire 50/100) and it is
not sold loose, so the master library holds it only on those bottle photos. Each SKU is photographed twice: the pump
exposed, and the clear overcap on. On six of them the pump measures the same (collar 26.0-27.5 mm, head 22.2-23.1 mm),
so one cut serves all nine:

- pump: the top layer of the Elegant 60 pump-exposed photo (55. LBElg60WhtClOvrCp.psd, "Layer 2 copy"), collar and the
  dark band under it included, as every photo shows them;
- overcap: the top layer of its capped twin (54., "Layer 1 copy") down to the cover's lower edge, found where the
  cover's two dark wall highlights end. Seated it carries the pump seen through the clear plastic, as photographed.

Both are anchored on their own photo's rim and scaled by the same tie to the Elegant 60 register plate as
cut_components.py: px/mm(photo) = px/mm(plate) x seat-to-foot(photo) / seat-to-foot(plate).

No photo shows the empty cover off the bottle, so the cover drawn beside the bottle (SIDECAR, EXPLODED) is a
gpt-image-2.5-sunburst edit of the seated cover, its geometry locked to the photo (EMPTY_COVER_PROMPT), cut out with
the seated cover's own silhouette:

  python3 scripts/register/components/cut_white_pump.py                          # cut + measure (writes 18-415-measurements.json)
  python3 scripts/register/components/cut_white_pump.py --render                 # also render the empty cover (OPENAI_API_KEY)
  python3 scripts/register/components/cut_white_pump.py --empty-cover <png>      # cut the detached cover from a render

Images go to output/register-components/18-415/ (gitignored); the detached cover to
public/assets/register/overcaps/ltn-18-415-white-rect-clear-overcap.webp, and the entry for
src/lib/register/detached-overcaps.ts is printed.
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
from psd_tools import PSDImage
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_components import PSD_ROOT, REGISTER, ROOT, alpha, crop_save, drop_specks, measure_body, recentre, sha, solid_bottom  # noqa: E402
from cut_boston_parts import layer_canvas  # noqa: E402

NECK = "18-415"
CID = "LIB-18-415-WhtPumpClOvrCp"
OUT = ROOT / "output" / "register-components" / NECK
MEASURE = REGISTER / "components" / f"{NECK}-measurements.json"
PLATE = "elegant-60ml-18-415|Clear"
FOLDER = "2.  18-415 Bottles /17. Elegant 60ml/1. Elegant 60ml PSD"
EXPOSED = (f"{FOLDER}/55. LBElg60WhtClOvrCp.psd", "Layer 22", "Layer 2 copy")
CAPPED = (f"{FOLDER}/54. LBElg60WhtClOvrCp.psd", "Layer 22", "Layer 1 copy")
DETACHED = ROOT / "public" / "assets" / "register" / "overcaps" / "ltn-18-415-white-rect-clear-overcap.webp"
RENDER_SIZE = 1024
RENDER_FIT = 700
EMPTY_COVER_PROMPT = (
    "1. Keep the overcap's geometry locked to the image: the same outline, size, position, rounded top corners, wall thickness and highlights.\n"
    "2. The same clear rectangular plastic overcap standing empty: nothing inside it. Remove the white pump, its head and its collar that are "
    "seen through the clear plastic, so the inside of the cover shows only the plain white background through the clear walls.\n"
    "3. Plain pure white background, no shadow, no floor. Enhance the quality.")


def photo(master: str, body_name: str, part_name: str, plate: dict) -> tuple[Image.Image, dict, float]:
    psd = PSDImage.open(PSD_ROOT / master)
    bm = measure_body(layer_canvas(psd, body_name))
    span = plate["anchors"]["baselineY"] - plate["anchors"]["seatY"]
    return layer_canvas(psd, part_name), bm, plate["pxPerMm"] * (bm["foot"] - bm["rim"]) / span


def cover_rows(img: Image.Image) -> tuple[int, int]:
    """The cover's top and lower edge: the last row where its two dark wall highlights still stand inside the outer
    eighth of the layer on both sides. Below it is the pump's collar, the same in both photos."""
    a = np.asarray(img).astype(float)
    m = a[:, :, 3] > 128
    lum = a[:, :, :3].mean(axis=2)
    rows = np.where(m.any(axis=1))[0]
    walls = []
    for y in range(rows.min(), rows.max() - 40):
        xs = np.where(m[y])[0]
        if xs.size < 50:
            continue
        w = int(0.12 * (xs.max() - xs.min()))
        if (lum[y, xs.min():xs.min() + w] < 150).sum() >= 2 and (lum[y, xs.max() - w:xs.max()] < 150).sum() >= 2:
            walls.append(y)
    return int(rows.min()), int(max(walls))


def top_half_width(img: Image.Image) -> int:
    """The cover's width: the median opaque row width over its top half."""
    m = alpha(img) > 128
    rows = np.where(m.any(axis=1))[0]
    half = rows[: max(1, len(rows) // 2)]
    return int(np.median([np.where(m[y])[0].max() - np.where(m[y])[0].min() + 1 for y in half]))


def render_input(cover: Image.Image) -> tuple[Image.Image, Image.Image, tuple[float, int, int]]:
    """The seated cover centred on a white square, and its silhouette there; (scale, x, y) of the placement."""
    scale = min(RENDER_FIT / cover.height, RENDER_FIT / cover.width)
    fitted = cover.resize((round(cover.width * scale), round(cover.height * scale)), Image.LANCZOS)
    x, y = (RENDER_SIZE - fitted.width) // 2, (RENDER_SIZE - fitted.height) // 2
    canvas = Image.new("RGB", (RENDER_SIZE, RENDER_SIZE), (255, 255, 255))
    canvas.paste(fitted, (x, y), fitted)
    silhouette = Image.new("L", (RENDER_SIZE, RENDER_SIZE), 0)
    silhouette.paste(fitted.split()[-1], (x, y))
    return canvas, silhouette, (scale, x, y)


def render(inp: Path, out: Path) -> None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        for line in (ROOT / ".env.local").read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in {"model": "gpt-image-2.5-sunburst", "prompt": EMPTY_COVER_PROMPT, "size": f"{RENDER_SIZE}x{RENDER_SIZE}", "quality": "high", "n": "1"}.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="{inp.name}"\r\nContent-Type: image/png\r\n\r\n').encode() + inp.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    request = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(request, timeout=400) as response:
        out.write_bytes(base64.b64decode(json.load(response)["data"][0]["b64_json"]))


def ink_box(rgb: np.ndarray) -> tuple[int, int, int, int]:
    """The box of the pixels that are not the white ground (left, top, right, bottom; inclusive)."""
    ink = rgb.mean(axis=2) < 235
    rows, cols = np.where(ink.any(axis=1))[0], np.where(ink.any(axis=0))[0]
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


def detached_cover(rendered: Path, canvas: Image.Image, silhouette: Image.Image) -> dict:
    """Cut the empty cover from the render. The render keeps the cover's shape but not its exact box (the first one
    stood about 3.5% taller), so the render's cover box is fitted onto the photo cover's box, and the seated cover's
    own silhouette cuts it out: beside the bottle it is exactly the size of the cover on the bottle."""
    out = Image.open(rendered).convert("RGB").resize((RENDER_SIZE, RENDER_SIZE), Image.LANCZOS)
    il, it, ir, ib = ink_box(np.asarray(canvas).astype(float))
    ol, ot, orr, ob = ink_box(np.asarray(out).astype(float))
    fitted = out.crop((ol, ot, orr + 1, ob + 1)).resize((ir - il + 1, ib - it + 1), Image.LANCZOS)
    aligned = Image.new("RGB", (RENDER_SIZE, RENDER_SIZE), (255, 255, 255))
    aligned.paste(fitted, (il, it))
    rgba = aligned.convert("RGBA")
    rgba.putalpha(silhouette)
    cover = rgba.crop(rgba.getbbox())
    DETACHED.parent.mkdir(parents=True, exist_ok=True)
    cover.save(DETACHED, "WEBP", quality=92, method=6)
    return {"width": cover.width, "height": cover.height, "coverWidth": top_half_width(cover),
            "fit": {"x": round((ir - il + 1) / (orr - ol + 1), 4), "y": round((ib - it + 1) / (ob - ot + 1), 4)}}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--render", action="store_true", help="render the empty cover with gpt-image-2.5-sunburst (about $0.20)")
    ap.add_argument("--empty-cover", type=Path, help="cut the detached cover from this render instead of rendering")
    args = ap.parse_args()
    plates = {p["plateKey"]: p for p in json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text())}
    plate = plates[PLATE]
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MEASURE.read_text())
    entries = {c["componentId"]: c for c in data["components"]}

    pump_img, pump_bm, pump_ppm = photo(*EXPOSED, plate)
    pump_img, pump_specks = drop_specks(pump_img, "pump")
    pump_cut, px, py = crop_save(pump_img, OUT / f"{CID}--0-pump.png")

    capped_img, capped_bm, capped_ppm = photo(*CAPPED, plate)
    top, bottom = cover_rows(capped_img)
    a = np.asarray(capped_img).copy()
    a[bottom + 1:, :, 3] = 0           # the collar below the cover is the pump's, drawn by the pump layer
    cover_img, cover_specks = drop_specks(Image.fromarray(a), "overcap")
    cover_cut, cx, cy = crop_save(cover_img, OUT / f"{CID}--overcap.png")

    entry = {
        "componentId": CID, "websiteSku": "", "type": "lotion-pump", "psd": None,
        "reference": {"psd": EXPOSED[0], "sku": "LBElg60WhtClOvrCp", "bodyId": plate["bodyId"], "glass": plate["glass"], "plateKey": PLATE,
                      "bottlePxPerMm": round(pump_ppm, 4), "rimY": pump_bm["rim"], "axisX": round(pump_bm["axisX"], 1),
                      "seatToFootPx": pump_bm["foot"] - pump_bm["rim"], "plateSeatToFootPx": plate["anchors"]["baselineY"] - plate["anchors"]["seatY"],
                      "bodyLayer": EXPOSED[1], "overcapPsd": CAPPED[0]},
        "layers": [
            {"slot": "pump", "layerName": f"{EXPOSED[2]} ({Path(EXPOSED[0]).name})", "file": f"{CID}--0-pump.png", "width": pump_cut.width, "height": pump_cut.height,
             "sha256": sha(pump_cut), "pxPerMm": round(pump_ppm, 4), "anchor": {"x": round(pump_bm["axisX"] - px, 1), "y": pump_bm["rim"] - py},
             "z": "front", "explodeIndex": 1, "solidBottomY": solid_bottom(pump_cut)},
            {"slot": "overcap", "layerName": f"{CAPPED[2]} ({Path(CAPPED[0]).name}), rows {top}-{bottom}", "file": f"{CID}--overcap.png",
             "width": cover_cut.width, "height": cover_cut.height, "sha256": sha(cover_cut), "pxPerMm": round(capped_ppm, 4),
             "anchor": {"x": round(capped_bm["axisX"] - cx, 1), "y": capped_bm["rim"] - cy}, "z": "front", "explodeIndex": 2, "solidBottomY": solid_bottom(cover_cut)},
        ],
        "checks": {"status": "cut from the Elegant 60 bottle photos (cut_white_pump.py); no library PSD holds this pump", "approvable": True,
                   "specksCleared": {"pump": pump_specks, "overcap": cover_specks}, "coverRows": [top, bottom],
                   "photoScales": {"exposed": round(pump_ppm, 4), "capped": round(capped_ppm, 4)}},
    }
    entry["checks"]["recentredMm"] = recentre(entry, OUT)
    entries[CID] = entry
    data["components"] = [entries[k] for k in sorted(entries)]
    MEASURE.write_text(json.dumps(data, indent=1) + "\n")
    mm = lambda px_, ppm: round(px_ / ppm, 2)  # noqa: E731
    print(f"pump    {pump_cut.width}x{pump_cut.height} at {pump_ppm:.2f} px/mm ({mm(pump_cut.width, pump_ppm)} x {mm(pump_cut.height, pump_ppm)} mm), rim {pump_bm['rim']}")
    print(f"overcap {cover_cut.width}x{cover_cut.height} at {capped_ppm:.2f} px/mm ({mm(cover_cut.width, capped_ppm)} x {mm(cover_cut.height, capped_ppm)} mm), rows {top}-{bottom}")
    print(f"wrote {MEASURE.relative_to(ROOT)}")

    if args.render or args.empty_cover:
        seated = Image.open(OUT / f"{CID}--overcap.png").convert("RGBA")
        canvas, silhouette, _ = render_input(seated)
        canvas.save(OUT / f"{CID}--empty-cover-input.png")
        rendered = args.empty_cover or OUT / f"{CID}--empty-cover-render.png"
        if args.render:
            render(OUT / f"{CID}--empty-cover-input.png", rendered)
        cut = detached_cover(Path(rendered), canvas, silhouette)
        print(json.dumps({CID: {"seatedLayerSha256": entry["layers"][1]["sha256"], "seatedCoverWidth": top_half_width(seated),
                                "url": "/" + str(DETACHED.relative_to(ROOT / "public")), "width": cut["width"], "height": cut["height"], "coverWidth": cut["coverWidth"],
                                "source": f"gpt-image-2.5-sunburst edit of the seated cover ({Path(CAPPED[0]).name}), geometry locked; cut with the seated silhouette"}}, indent=1))
        print(f"render box fitted onto the photo cover: x {cut['fit']['x']}, y {cut['fit']['y']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
