#!/usr/bin/env python3
"""
The three 20-400 parts the generic cutter cannot take from the Boston Round masters (2026-09-29).

- LIB-20-400-PlsticRollon, LIB-20-400-MtlRollon, the roller inserts. The master library holds no bare 20-400 roller, and
  on the uncapped Boston masters the bottle is painted on a white rectangle and the metal insert sits on a white patch,
  so cut_components.py measures the rectangle, not the bottle. Here each white ground (near-white pixels connected to the
  layer's edge) is cleared first; the plastic insert is a clean layer of its own.
- CMP-ROC-SBLK-20400-T, the tall shiny black roll-on cap. The library file (23. CPRoll20-400TallShnBlk.psd) is a wider,
  squatter cap than the one on every Boston photo (registration IoU 0.66; the plain "Blk" and the "ShBlk" SKUs show the
  same slim cap), so this cap is cut from a capped photo, as the droppers are.

Every part is anchored on the bottle's rim and scaled by the same tie to the body's register plate as cut_components.py:
px/mm(photo) = px/mm(plate) x seat-to-foot(photo) / seat-to-foot(plate). The entries are merged into
data/register/components/20-400-measurements.json; the images go to output/register-components/20-400/.

  python3 scripts/register/components/cut_boston_parts.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_components import (PSD_ROOT, REGISTER, ROLLER_CLIP_BELOW_RIM, ROOT, crop_save, drop_specks, measure_body,  # noqa: E402
                            recentre, sha, solid_bottom)

NECK = "20-400"
OUT = ROOT / "output" / "register-components" / NECK
MEASURE = REGISTER / "components" / f"{NECK}-measurements.json"
BOSTON = "1.  20-400 (1 oz & 2 oz) the 15ml 18-400 Boston Round/1. Boston Round  Dropper Bottles"
UNCAPPED_AMBER_1OZ = f"{BOSTON}/3. (1ounce:30ml) Boston Round (Uncapped)/1. Amber Bottle (1oz)/Amber - Alternating Caps"
CAPPED_CLEAR_1OZ = f"{BOSTON}/4. (1ounce:30ml) Boston Round  (Capped)/3. Clear Bottle (1oz) (capped)/Clear - Alternating Caps (capped)"
WHITE = 245   # a ground pixel: every channel at least this bright

# (componentId, type, slot, master, SKU, body layer, part layer, plate, how)
PARTS = [
    ("LIB-20-400-PlsticRollon", "roller-insert", "roller", f"{UNCAPPED_AMBER_1OZ}/7. GBBstnAmb1ozRollonShnSl.psd", "GBBstnAmb1ozRollonShnSl",
     "Layer 5", "Layer 13", "boston-round-30ml-20-400|Amber", "insert"),
    ("LIB-20-400-MtlRollon", "roller-insert", "roller", f"{UNCAPPED_AMBER_1OZ}/2. GBBstnAmb1ozMtlRollonShnSl.psd", "GBBstnAmb1ozMtlRollonShnSl",
     "Layer 5", "Layer 7", "boston-round-30ml-20-400|Amber", "insert"),
    ("CMP-ROC-SBLK-20400-T", "roll-on-cap", "cap", f"{CAPPED_CLEAR_1OZ}/19. GBBstn1ozRollShBlk.psd", "GBBstn1ozRollShBlk",
     "Layer 22", None, "boston-round-30ml-20-400|Clear", "cap"),
]


def layer_canvas(psd: PSDImage, name: str) -> Image.Image:
    """One named pixel layer on the document canvas."""
    layer = next(l for l in psd.descendants() if l.kind == "pixel" and l.name == name)
    canvas = Image.new("RGBA", (psd.width, psd.height), (0, 0, 0, 0))
    img = layer.composite().convert("RGBA")
    x, y = layer.bbox[0], layer.bbox[1]
    crop = img.crop((max(0, -x), max(0, -y), img.width, img.height))
    canvas.alpha_composite(crop, (max(0, x), max(0, y)))
    return canvas


def clear_white_ground(img: Image.Image) -> tuple[Image.Image, int]:
    """Clear the near-white ground a part was painted on: near-white opaque pixels connected to the opaque area's edge."""
    a = np.asarray(img).copy()
    opaque = a[:, :, 3] > 0
    white = opaque & (a[:, :, :3].min(axis=2) >= WHITE)
    # the ground touches the outside of the opaque area: label the white runs and keep only those that touch it
    outside = ndimage.binary_dilation(~opaque, iterations=1)
    labels, n = ndimage.label(white)
    touching = set(np.unique(labels[white & outside])) - {0}
    ground = np.isin(labels, list(touching))
    a[ground, 3] = 0
    return Image.fromarray(a), int(ground.sum())


def main() -> int:
    plates = {p["plateKey"]: p for p in json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text())}
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(MEASURE.read_text())
    entries = {c["componentId"]: c for c in data["components"]}
    for cid, ctype, slot, master, sku, body_name, part_name, plate_key, how in PARTS:
        psd = PSDImage.open(PSD_ROOT / master)
        body, cleared_body = clear_white_ground(layer_canvas(psd, body_name))
        bm = measure_body(body)
        plate = plates[plate_key]
        span = plate["anchors"]["baselineY"] - plate["anchors"]["seatY"]
        px_per_mm = plate["pxPerMm"] * (bm["foot"] - bm["rim"]) / span
        if how == "insert":
            part, cleared_part = clear_white_ground(layer_canvas(psd, part_name))
            a = np.asarray(part).copy()
            a[bm["rim"] + ROLLER_CLIP_BELOW_RIM:, :, 3] = 0   # the part inside the neck is behind the glass
            part = Image.fromarray(a)
            z, explode, layer_name = "behind-body", 0, f"{part_name} (uncapped bottle photo, white patch cleared, cleared from {ROLLER_CLIP_BELOW_RIM} px below the rim)"
        else:
            # the cap: every layer but the body and the background, as it sits on the neck of the capped photo
            names = [l.name for l in psd.descendants() if l.kind == "pixel" and l.name not in (body_name, "Background")]
            part = Image.new("RGBA", (psd.width, psd.height), (0, 0, 0, 0))
            for name in names:
                part.alpha_composite(layer_canvas(psd, name))
            part, cleared_part = clear_white_ground(part)
            z, explode, layer_name = "front", 1, ", ".join(names) + " (capped bottle photo)"
        part, specks = drop_specks(part, slot)
        name = f"{cid}--{slot}.png"
        cut, ox, oy = crop_save(part, OUT / name)
        entry = {
            "componentId": cid, "websiteSku": entries.get(cid, {}).get("websiteSku", ""), "type": ctype, "psd": None,
            "reference": {"psd": master, "sku": sku, "bodyId": plate["bodyId"], "glass": plate["glass"], "plateKey": plate_key,
                          "bottlePxPerMm": round(px_per_mm, 4), "rimY": bm["rim"], "axisX": round(bm["axisX"], 1),
                          "seatToFootPx": bm["foot"] - bm["rim"], "plateSeatToFootPx": span, "bodyLayer": body_name},
            "layers": [{"slot": slot, "layerName": layer_name, "file": name, "width": cut.width, "height": cut.height, "sha256": sha(cut),
                        "pxPerMm": round(px_per_mm, 4), "anchor": {"x": round(bm["axisX"] - ox, 1), "y": bm["rim"] - oy},
                        "z": z, "explodeIndex": explode, "solidBottomY": solid_bottom(cut)}],
            "checks": {"status": "cut from the " + ("uncapped" if how == "insert" else "capped") + " Boston Round photo (cut_boston_parts.py)",
                       "approvable": True, "whiteGroundClearedPx": {"body": cleared_body, "part": cleared_part}, "specksCleared": specks},
        }
        if how == "insert":
            entry["checks"]["clippedBelowRimPx"] = ROLLER_CLIP_BELOW_RIM
        if cid == "CMP-ROC-SBLK-20400-T":
            entry["checks"]["libraryNotUsed"] = "23. CPRoll20-400TallShnBlk.psd is a wider, squatter cap than the photographed one (IoU 0.66)"
        entry["checks"]["recentredMm"] = recentre(entry, OUT)
        entries[cid] = entry
        print(f"{cid:26} {ctype:14} {cut.width}x{cut.height} at {px_per_mm:.2f} px/mm; rim {bm['rim']}, body ground cleared {cleared_body} px, part {cleared_part} px")
    data["components"] = [entries[k] for k in sorted(entries)]
    MEASURE.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {MEASURE.relative_to(ROOT)}: {len(data['components'])} components")
    return 0


if __name__ == "__main__":
    sys.exit(main())
