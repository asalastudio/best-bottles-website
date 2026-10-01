#!/usr/bin/env python3
"""
LIB-18-415-DivaRng{Blk,Ivy,Lvn,Red}, the Diva 46 jeweled rings (2026-10-01, Build Your Bottle checklist 9b): an ornate
silver band set with coloured stones that sits on the glass's shoulder under the bulb sprayer's collar. Ten Diva 46
bulb sprayers are sold with one and it is not sold loose. The master library photographs each ring bottle with the
ring on its own layer; the plain-bulb photo of each colour gives the ring:

    black     60. GBDiva46AnSpBlkBlkRng.psd       ivory (clear stones; the white bulb's too) 62. GBDiva46AnSpIvySlIvyRng.psd
    lavender  66. GBDiva46AnSpLvnLvnRng.psd       red   68. GBDiva46AnSpRedRedRng.psd

The bulb sprayer stands where it stands in the same bottle's plain-bulb photo (33. GBDiva46AnSpLvn.psd has the same
glass and sprayer boxes as 66.), so a ring bottle is its bulb's parts plus the ring. The ring is a part of the glass
(src/lib/register/compose.ts BODY_FIXED_SLOTS): anchored on the photo's rim and scaled by the same tie to the Diva 46
plate as cut_components.py, px/mm(photo) = px/mm(plate) x rim-to-foot(photo) / seat-to-foot(plate), it is drawn exactly
where the photo shows it on the shoulder, in every view.

    python3 scripts/register/components/cut_diva_rings.py     # cut + measure (writes 18-415-measurements.json)

Images go to output/register-components/18-415/ (gitignored).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from psd_tools import PSDImage

sys.path.insert(0, str(Path(__file__).parent))
from cut_components import PSD_ROOT, REGISTER, ROOT, crop_save, drop_specks, measure_body, sha  # noqa: E402
from cut_boston_parts import layer_canvas  # noqa: E402

NECK = "18-415"
OUT = ROOT / "output" / "register-components" / NECK
MEASURE = REGISTER / "components" / f"{NECK}-measurements.json"
PLATE = "diva-46ml-18-415|Clear"
FOLDER = "2.  18-415 Bottles /25. Diva (Clear) 46 ml./1. Diva (Clear) 46ml PSD"
RINGS = {  # componentId: (bottle photo, the ring's layer, the SKU it was photographed on)
    "LIB-18-415-DivaRngBlk": ("60. GBDiva46AnSpBlkBlkRng.psd", "Layer 35", "GBDiva46AnSpBlkRng"),
    "LIB-18-415-DivaRngIvy": ("62. GBDiva46AnSpIvySlIvyRng.psd", "Layer 35", "GBDiva46AnSpIvySlRng"),
    "LIB-18-415-DivaRngLvn": ("66. GBDiva46AnSpLvnLvnRng.psd", "Layer 30", "GBDiva46AnSpLvnRng"),
    "LIB-18-415-DivaRngRed": ("68. GBDiva46AnSpRedRedRng.psd", "Redrng", "GBDiva46AnSpRedRng"),
}


def glass_layer(psd: PSDImage) -> str:
    """The glass: the largest pixel layer that is not the full-canvas background."""
    layers = [l for l in psd if l.kind == "pixel" and l.is_visible() and (l.width, l.height) != (psd.width, psd.height)]
    return max(layers, key=lambda l: l.width * l.height).name


def main() -> int:
    plates = {p["plateKey"]: p for p in json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text())}
    plate = plates[PLATE]
    span = plate["anchors"]["baselineY"] - plate["anchors"]["seatY"]
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MEASURE.read_text())
    entries = {c["componentId"]: c for c in data["components"]}
    for cid, (master, ring_name, sku) in RINGS.items():
        psd = PSDImage.open(PSD_ROOT / FOLDER / master)
        body_name = glass_layer(psd)
        bm = measure_body(layer_canvas(psd, body_name))
        ppm = plate["pxPerMm"] * (bm["foot"] - bm["rim"]) / span
        ring, specks = drop_specks(layer_canvas(psd, ring_name), "ring")
        cut, x0, y0 = crop_save(ring, OUT / f"{cid}--ring.png")
        entries[cid] = {
            "componentId": cid, "websiteSku": "", "type": "ring", "psd": None,
            "reference": {"psd": f"{FOLDER}/{master}", "sku": sku, "bodyId": plate["bodyId"], "glass": plate["glass"], "plateKey": PLATE,
                          "bottlePxPerMm": round(ppm, 4), "rimY": bm["rim"], "axisX": round(bm["axisX"], 1),
                          "seatToFootPx": bm["foot"] - bm["rim"], "plateSeatToFootPx": span, "bodyLayer": body_name},
            "layers": [{"slot": "ring", "layerName": f"{ring_name} ({master})", "file": f"{cid}--ring.png", "width": cut.width, "height": cut.height,
                        "sha256": sha(cut), "pxPerMm": round(ppm, 4), "anchor": {"x": round(bm["axisX"] - x0, 1), "y": bm["rim"] - y0},
                        "z": "front", "explodeIndex": 0}],
            "checks": {"status": "cut from the Diva 46 ring bottle photo (cut_diva_rings.py); the ring is its own layer there", "approvable": True,
                       "specksCleared": specks},
        }
        print(f"{cid}  {cut.width}x{cut.height} at {ppm:.2f} px/mm ({cut.width / ppm:.1f} x {cut.height / ppm:.1f} mm), "
              f"top {(y0 - bm['rim']) / ppm:+.1f} mm from the rim; glass layer {body_name}")
    data["components"] = [entries[k] for k in sorted(entries)]
    MEASURE.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {MEASURE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
