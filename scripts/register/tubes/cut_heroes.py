#!/usr/bin/env python3
"""Cut the dip tube and pump shaft of every (plate, fitment family) out of its released catalogue hero.

Jordan 2026-09-30: the tube must look the way the product shows up in the real world, with the pump mechanism the
tube rides into ("we don't want to edit that out"), consistent with the catalogue heroes: "cut it from the hero that
we have ... and then apply this to the set if it fits and the measurement is consistent".

For each slot in data/register/tubes/hero-sources.json (a released hero, or for the two Empire lotion pumps the
master library photograph): fit the hero onto the plate (hero_fit.py), resample it onto
the plate's pixels, and cut the shaft and tube from under the collar to where the tube ends (tube_cut.py). A master
photograph that keeps the tube on its own layer gives that layer instead (tube_cut.cut_layer). Six at a time; fits are
cached. Then scripts/register/tubes/finalize_tubes.py picks one layer per slot.

    python3 scripts/register/tubes/cut_heroes.py [slot,slot,...]

Reads the plates from output/register-bodies/, the heroes from public/. Writes output/register-tubes/.
"""
import json
import os
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from hero_fit import fit, refine, warp, warp_rgba  # noqa: E402
from tube_cut import cut, cut_layer  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "output" / "register-tubes"
PLATES = {p["plateKey"]: p for p in json.loads((ROOT / "data/register/bodies/bodies-measurements.json").read_text())}
SOURCES = json.loads((ROOT / "data/register/tubes/hero-sources.json").read_text())
SLOTS, FLOOR = SOURCES["slots"], SOURCES["floorMmAboveFoot"]["values"]
BONE = (245, 243, 239, 255)


def photo_placement(source, anchors):
    """A master library photograph's glass is its own layer (the largest one): its top is the neck's seat, its bottom
    the foot, its centre the axis. That places the plate on the photograph before the outline refines it."""
    from psd_tools import PSDImage
    root = Path(json.loads((ROOT / "data/paper-doll/component-library-inventory.json").read_text())["root"])
    layers = [l for l in PSDImage.open(root / source[4:]) if l.is_visible() and l.name != "Background"]
    x0, y0, x1, y1 = max(layers, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1])).bbox
    s = (y1 - y0) / (anchors["baselineY"] - anchors["seatY"])
    return s, (x0 + x1) / 2 - anchors["axisX"] * s, y0 - anchors["seatY"] * s


def hero_rgb(source):
    """A released hero (public/...), or a master library photograph (psd:...) laid on the stage bone like one."""
    if source.startswith("psd:"):
        from psd_tools import PSDImage
        root = Path(json.loads((ROOT / "data/paper-doll/component-library-inventory.json").read_text())["root"])
        psd = PSDImage.open(root / source[4:])
        im = psd.composite(layer_filter=lambda layer: layer.is_visible() and layer.name != "Background").convert("RGBA")
        return np.asarray(Image.alpha_composite(Image.new("RGBA", im.size, BONE), im).convert("RGB"))
    return np.asarray(Image.open(ROOT / ("public" + source)).convert("RGB"))


def tube_layer(source):
    """A master photograph's own tube layer, as RGBA on the photograph's canvas, and its name; (None, None) when the
    photograph has none: the one layer that is neither the glass (the largest) nor the closure (the one standing
    highest), narrower than half the glass and standing on its axis."""
    from psd_tools import PSDImage
    root = Path(json.loads((ROOT / "data/paper-doll/component-library-inventory.json").read_text())["root"])
    psd = PSDImage.open(root / source[4:])
    layers = [l for l in psd if l.is_visible() and l.name != "Background" and l.kind == "pixel"]
    if len(layers) < 3:
        return None, None
    glass = max(layers, key=lambda l: l.width * l.height)
    closure = min(layers, key=lambda l: l.top)
    axis = (glass.left + glass.right) / 2
    tubes = [l for l in layers if l is not glass and l is not closure and l.width < 0.5 * glass.width
             and abs((l.left + l.right) / 2 - axis) < 0.15 * glass.width]
    if len(tubes) != 1:
        return None, None
    tube = tubes[0]
    canvas = np.zeros((psd.height, psd.width, 4), float)
    pixels = np.asarray(tube.topil().convert("RGBA")).astype(float)
    x0, y0 = max(0, tube.left), max(0, tube.top)
    sub = pixels[y0 - tube.top:, x0 - tube.left:][:psd.height - y0, :psd.width - x0]
    canvas[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]] = sub
    return canvas, tube.name


def plate_rgb(p):
    im = Image.open(ROOT / "output/register-bodies" / p["file"]).convert("RGBA")
    return np.asarray(Image.alpha_composite(Image.new("RGBA", im.size, BONE), im).convert("RGB"))


def one(slot):
    try:
        pk = "|".join(slot.split("|")[:2]); p = PLATES[pk]; key = slot.replace("|", "_")
        plate = plate_rgb(p)
        hero = hero_rgb(SLOTS[slot]["hero"])
        cached = OUT / f"{key}.fit.json"
        if cached.exists():
            f = json.loads(cached.read_text())
        else:
            if SLOTS[slot]["hero"].startswith("psd:"):
                f = refine(plate, p["anchors"], hero, *photo_placement(SLOTS[slot]["hero"], p["anchors"]))
            else:
                f = fit(plate, p["anchors"], hero, frosted=p["glass"] == "Frosted")
            cached.write_text(json.dumps(f))
        floor_y = int(p["anchors"]["baselineY"] - FLOOR[p["bodyId"]] * p["pxPerMm"])
        own, own_name = tube_layer(SLOTS[slot]["hero"]) if SLOTS[slot]["hero"].startswith("psd:") else (None, None)
        if own is not None:
            layer, info = cut_layer(warp_rgba(own, f, plate.shape), p["anchors"], p["pxPerMm"], floor_y)
        else:
            layer, info = cut(plate, warp(hero, f, plate.shape), p["anchors"], p["pxPerMm"], floor_y)
        if layer is None:
            return slot, {"error": info, "fit": f}
        Image.fromarray(layer).save(OUT / f"{key}.tube.png")
        return slot, {**info, "fit": f, "hero": SLOTS[slot]["hero"], "sku": SLOTS[slot]["sku"], **({"tubeLayer": own_name} if own_name else {})}
    except Exception as error:  # one bad slot must not stop the rest
        return slot, {"error": repr(error)[:200]}


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    slots = sys.argv[1].split(",") if len(sys.argv) > 1 else sorted(SLOTS)
    started = time.time()
    with Pool(6) as pool:
        results = dict(pool.map(one, slots))
    path = OUT / "cuts.json"
    cuts = json.loads(path.read_text()) if path.exists() else {}
    cuts.update(results)
    path.write_text(json.dumps(cuts, indent=1))
    failed = {k: v for k, v in results.items() if "error" in v}
    print(f"{len(results)} slots in {time.time() - started:.0f}s; {len(failed)} without a cut")
    for k, v in failed.items():
        print("  ", k, v["error"])
