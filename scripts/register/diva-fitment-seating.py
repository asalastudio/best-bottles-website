#!/usr/bin/env python3
"""Seat the Diva lotion-pump and fine-mist fitments on the shoulder (Jordan, 7 Nov 2026: 100 ml first, then 30 and 46 ml).

On the product page and in the builder the 18-415 pump layers of the 4 Nov Diva masters were drawn small: the collar
was narrower than the glass thread band, so thread ridges showed on both sides and the pump looked perched on the neck.

Truth is each SKU's own plate: the register plate is the real cap-on photograph on the SAME 1000x1100 canvas and
scale as the kit (the shoulders match). For every Diva 30/46/100 lotion-pump and sprayer SKU this measures
  - the plate's cap width (median over its straight side), and
  - the kit overcap layer's width on the canvas,
and records scale = plate cap / kit overcap. A clear overcap is too faint to measure, so it takes the median of the
metal finishes on its body and glass. A kit within 3% of its plate keeps its size;
any collar 1 px or more off the neck centre is re-centred. The fitment is scaled about its collar foot (which already rests on the neck ring) and its collar is
centred on the neck. approved-component-kits.ts applies the table to pump/sprayer, overcap and dip-tube boxes.

  python3 scripts/register/diva-fitment-seating.py [--convex https://precise-raccoon-123.convex.cloud]
Reads published layers and plates over HTTPS; writes only src/lib/paper-doll/diva-fitment-seating.json.
"""
import io
import json
import statistics
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KITS = ROOT / "src/lib/paper-doll/approved-kits.generated.json"
OUT = ROOT / "src/lib/paper-doll/diva-fitment-seating.json"
BODY_IDS = ("diva-30ml-18-415", "diva-46ml-18-415", "diva-100ml-18-415")
MIN_SCALE = 1.03   # a smaller size difference is measurement noise, so the kit keeps its size
MIN_OFFSET = 1.0   # px: a collar this far off the neck centre is re-centred (Jordan: "all pumps need alignment")
FITMENT = ("pump", "sprayer")
CONVEX = sys.argv[sys.argv.index("--convex") + 1] if "--convex" in sys.argv else "https://precise-raccoon-123.convex.cloud"
BLOB = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/"
_cache: dict[str, Image.Image] = {}


def fetch(url: str) -> Image.Image:
    if url not in _cache:
        with urllib.request.urlopen(url, timeout=60) as response:
            _cache[url] = Image.open(io.BytesIO(response.read())).convert("RGBA")
    return _cache[url]


def on_canvas(part: dict) -> np.ndarray:
    box = part["box"]
    image = fetch(part["image"]["url"]).resize((round(box["width"]), round(box["height"])), Image.LANCZOS)
    canvas = Image.new("RGBA", (1000, 1100), (0, 0, 0, 0))
    canvas.alpha_composite(image, (round(box["x"]), round(box["y"])))
    return np.asarray(canvas)[:, :, 3] > 40


def width(row: np.ndarray) -> int:
    cols = np.where(row)[0]
    return int(cols.max() - cols.min()) if len(cols) else 0


def centre(row: np.ndarray) -> float | None:
    cols = np.where(row)[0]
    return (cols.max() + cols.min()) / 2 if len(cols) else None


def plates_for(skus: list[str]) -> dict[str, str]:
    body = json.dumps({"path": "productPlates:forSkus", "args": {"skus": skus}, "format": "json"}).encode()
    request = urllib.request.Request(f"{CONVEX}/api/query", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        value = json.load(response)["value"]
    return {sku: plate["image"] for sku, plate in value["plates"].items() if plate and plate.get("image")}


def main() -> None:
    rows = json.loads(KITS.read_text())["rows"]
    skus = sorted(sku for sku, kit in rows.items()
                  if (kit.get("register") or {}).get("bodyId") in BODY_IDS
                  and any(p["slot"] in FITMENT for p in kit["parts"]) and ("Ltn" in sku or "Spry" in sku))
    plates = plates_for(skus)
    measured: dict[str, dict] = {}
    for sku in skus:
        parts = {p["slot"]: p for p in rows[sku]["parts"]}
        fitment = next(parts[s] for s in FITMENT if s in parts)
        body = on_canvas(parts["body"])
        fit = on_canvas(fitment)
        widths = [width(fit[y]) for y in range(1100)]
        widest = max(widths)
        collar_rows = [y for y, w in enumerate(widths) if w >= 0.9 * widest]
        top, foot = min(collar_rows), max(collar_rows)
        collar_centre = statistics.mean(c for y in range(top, foot + 1) if (c := centre(fit[y])) is not None)
        neck_centre = statistics.mean(c for y in range((top + foot) // 2, foot + 1) if (c := centre(body[y])) is not None)
        overcap = on_canvas(parts["overcap"])
        ob = parts["overcap"]["box"]
        overcap_w = statistics.median(width(overcap[y]) for y in range(int(ob["y"] + 40), int(ob["y"] + ob["height"] - 20)))
        plate = np.asarray(fetch(plates[sku]).convert("RGB")).astype(int) if sku in plates else None
        cap_w = statistics.median(width(np.abs(plate[y] - 255).max(axis=1) > 14) for y in range(150, 370)) if plate is not None else None
        measured[sku] = {"bodyId": rows[sku]["register"]["bodyId"], "glass": rows[sku]["register"]["glass"], "collarFootY": foot, "collarCentreX": round(collar_centre, 2), "neckCentreX": round(neck_centre, 2),
                         "kitOvercapPx": overcap_w, "plateCapPx": cap_w, "clearOvercap": "ClOvrCap" in sku}
    for body_glass in {(m["bodyId"], m["glass"]) for m in measured.values()}:
        group = [m for m in measured.values() if (m["bodyId"], m["glass"]) == body_glass]
        metal = [m["plateCapPx"] / m["kitOvercapPx"] for m in group if not m["clearOvercap"] and m["plateCapPx"]]
        median_scale = statistics.median(metal)
        for m in group:
            m["scale"] = round(median_scale if m["clearOvercap"] or not m["plateCapPx"] else m["plateCapPx"] / m["kitOvercapPx"], 4)
    for m in measured.values():
        if m["scale"] < MIN_SCALE:
            m["scale"] = 1.0
    measured = {sku: m for sku, m in measured.items()
                if m["scale"] > 1.0 or abs(m["neckCentreX"] - m["collarCentreX"]) >= MIN_OFFSET}
    OUT.write_text(json.dumps({
        "version": "diva-fitment-seated-v2",
        "bodyIds": list(BODY_IDS),
        "source": "scripts/register/diva-fitment-seating.py: plate cap width / kit overcap width per SKU (1.0 within 3%), collar centred on the neck (Jordan, 2026-11-07)",
        "rows": measured,
    }, indent=1) + "\n")
    for sku, m in measured.items():
        print(f"{sku:24} {m['bodyId']:18} {m['glass']:8} scale {m['scale']:.4f}  centre {m['collarCentreX']} -> {m['neckCentreX']}  foot {m['collarFootY']}")


if __name__ == "__main__":
    main()
