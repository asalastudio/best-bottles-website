#!/usr/bin/env python3
"""
Inputs for the Sunburst body-plate samples (Jordan 2026-09-25: five identical-size bodies, higher
fidelity, geometry locked, lighting right so the components fit).

  python3 scripts/register/phase3/sunburst_inputs.py

One master geometry: the Clear plate (it passes the width check, and every component was registered
against the clear photos). It is enlarged x2.2 onto a 768x2304 canvas (Sunburst sizes are multiples of
16), axis on x=384, foot on y=2176. Each other glass's own photo is fitted to the same seat, foot, axis
and barrel width, to serve only as the colour/material reference.

Writes output/register-phase3/pilot/sunburst/inputs/: geometry.png (clear, on white), <glass>-material.png
(on white), master-mask.png, placement.json.
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image

import cut_pilot as cp

W, H, K, AXIS_X, FOOT_Y = 768, 2304, 2.2, 384, 2176
OUT = cp.OUT / "sunburst" / "inputs"
DATA = json.loads(cp.MEASURE.read_text())


def fitted(plate: dict, master: dict) -> Image.Image:
    """The plate scaled so its seat-to-foot and barrel width match the master's (at K), placed on the canvas."""
    plate, master = plate.get("photoPlate", plate), master.get("photoPlate", master)  # always build from the photographs
    img = Image.open(cp.OUT / plate["file"]).convert("RGBA")
    a, ma = plate["anchors"], master["anchors"]
    sy = K * (ma["baselineY"] - ma["seatY"]) / (a["baselineY"] - a["seatY"])
    sx = K * master["checks"]["barrelPx"] / plate["checks"]["barrelPx"]
    big = img.resize((round(img.width * sx), round(img.height * sy)), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(big, (round(AXIS_X - a["axisX"] * sx), round(FOOT_Y - a["baselineY"] * sy)))
    return canvas


def on_white(img: Image.Image) -> Image.Image:
    ground = Image.new("RGBA", img.size, (255, 255, 255, 255))
    return Image.alpha_composite(ground, img).convert("RGB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    plates = {p["glass"]: p for p in DATA["plates"]}
    master = plates["Clear"]
    geometry = fitted(master, master)
    on_white(geometry).save(OUT / "geometry.png")
    mask = (np.asarray(geometry.getchannel("A")) > 127).astype(np.uint8) * 255
    Image.fromarray(mask).save(OUT / "master-mask.png")
    for glass, plate in plates.items():
        if glass != "Clear":
            on_white(fitted(plate, master)).save(OUT / f"{glass.lower().replace(' ', '-')}-material.png")
    a = master.get("photoPlate", master)["anchors"]
    placement = {"canvas": [W, H], "scale": K, "axisX": AXIS_X, "footY": FOOT_Y,
                 "seatY": round(FOOT_Y - (a["baselineY"] - a["seatY"]) * K, 1),
                 "shoulderY": round(FOOT_Y - (a["baselineY"] - a["shoulderY"]) * K, 1),
                 "pxPerMm": round(master["pxPerMm"] * K, 4), "master": "Clear plate x2.2"}
    (OUT / "placement.json").write_text(json.dumps(placement, indent=1) + "\n")
    ys, xs = np.where(mask > 0)
    print(f"canvas {W}x{H}; master silhouette x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}; {placement}")


if __name__ == "__main__":
    main()
