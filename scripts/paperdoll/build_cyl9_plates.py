#!/usr/bin/env python3
"""
Static plates for the 9 mL · 17-415 Cylinder, composited from the 26 layer
PNGs with no CMS in the loop.

The 9 mL was photographed as LAYERS (5 bodies, 10 caps, 2 rollers, 6 sprayers,
3 pumps), all on one shared 1000x1300 canvas, so a configuration is a straight
alpha-over stack in the family's layer order -- exactly what the storefront
canvas did at runtime from Sanity. Here it is done once, on disk, into the same
dist/paper-doll/legacy/<family>/ shape the Diva and Cylinder 50 plates use:

    <graceSku>.webp             the configuration, 1000x1100, on white
    <graceSku>.thumb.webp       240px ink-cropped rail thumbnail
    <graceSku>-capoff.webp      roll-ons only: cap layer omitted, roller visible
    manifest.json               one row per configuration, keyed by graceSku

Inputs
    data/paper-doll/CYL-9ML/configurations.json   145 rows, from Convex via
        scripts/paperdoll/export-cyl9-configurations.ts (same mapping the PDP uses)
    pipeline/paper-doll/_archive/2026-04-regeneration/output/CYL-9ML/   the layers

One scale for the whole family: the tallest assembly (sprayer/pump) fits the
plate, and every other configuration shares that scale and baseline, so the
bottle never moves when the customer swaps a component.
"""
import json, os, sys
import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAIN = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026"
LAYERS = os.path.join(MAIN, "pipeline/paper-doll/_archive/2026-04-regeneration/output/CYL-9ML")
CONFIGS = os.path.join(REPO, "data/paper-doll/CYL-9ML/configurations.json")

FAMILY_ID = "cylinder-9ml-17-415"
FAMILY_NAME = "Cylinder 9 mL — 17-415"
OUT_DIR = os.path.join(REPO, "dist/paper-doll/legacy", FAMILY_ID)
SRC_W, SRC_H = 1000, 1300
OUT_W, OUT_H = 1000, 1100          # 10:11, the PDP plate aspect (same as Diva)
PAD = 40

ORDER = {"rollon": ["body", "roller", "cap"], "spray": ["body", "sprayer"], "lotion": ["body", "pump"]}

def layer_file(slot, key):
    if slot == "body":    return f"bottles/CYL-{key}-9ML-body.png"
    if slot == "cap":     return f"caps/CYL-9ML-{key}-cap.png"
    if slot == "sprayer": return f"sprayers/CYL-9ML-SPR-{key}-sprayer.png"
    if slot == "pump":    return f"lotion-pumps/CYL-9ML-LPM-{key}-pump.png"
    if slot == "roller":  return {"MTL-ROLL": "fitments/CYL-9ML-MRL-fitment.png",
                                  "PLS-ROLL": "fitments/CYL-9ML-ROL-fitment.png"}[key]
    raise KeyError(slot)

SWATCH = {
    "Black": "#15120f", "Shiny Black": "#15120f", "Black Dotted": "#15120f",
    "White": "#f2f0ec", "Gold": "#c9a227", "Shiny Gold": "#c9a227",
    "Matte Gold": "#b8973f", "Shiny Silver": "#cfd3d7", "Silver Dotted": "#cfd3d7",
    "Matte Silver": "#b9bcc0", "Matte Copper": "#b06a3b", "Red": "#a52a2a",
    "Turquoise": "#3fb1b5", "Pink Dotted": "#e3a7b5",
}

CLOSURES = [
    ("rollon-metal",   "Roll-On · Metal roller",   lambda c: c["mode"] == "rollon" and c["layerKeys"].get("roller") == "MTL-ROLL"),
    ("rollon-plastic", "Roll-On · Plastic roller", lambda c: c["mode"] == "rollon" and c["layerKeys"].get("roller") == "PLS-ROLL"),
    ("spray",          "Fine Mist Sprayer",              lambda c: c["mode"] == "spray"),
    ("lotion",         "Lotion Pump",                    lambda c: c["mode"] == "lotion"),
]

_cache = {}
def load(slot, key):
    f = layer_file(slot, key)
    if f not in _cache:
        im = Image.open(os.path.join(LAYERS, f)).convert("RGBA")
        assert im.size == (SRC_W, SRC_H), (f, im.size)
        _cache[f] = im
    return _cache[f]

def alpha_bbox(im, thr=8):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > thr)
    return xs.min(), ys.min(), xs.max(), ys.max()

def ink_bbox(gray, thr=245):
    ys, xs = np.where(gray < thr)
    return xs.min(), ys.min(), xs.max(), ys.max()

def main():
    cfgs = json.load(open(CONFIGS))
    assert len(cfgs) == 145 and len({c["graceSku"] for c in cfgs}) == 145, "expected the 145 cohort"
    os.makedirs(OUT_DIR, exist_ok=True)

    # The family frame: union of every layer's alpha, so every plate shares
    # one scale and one baseline. The horizontal axis is the BODY's axis.
    x0 = y0 = 10**9; x1 = y1 = -1
    for c in cfgs:
        for slot in ORDER[c["mode"]]:
            bx0, by0, bx1, by1 = alpha_bbox(load(slot, c["layerKeys"][slot]))
            x0, y0, x1, y1 = min(x0, bx0), min(y0, by0), max(x1, bx1), max(y1, by1)
    # The shared datum is the NECK, and it is measured from the closures:
    # every cap, roller, sprayer and pump was placed on the same neck, so
    # their solid silhouettes agree on one axis. The bodies are not used --
    # the fluted swirl's silhouette is asymmetric even though its neck is
    # not -- and the canvas centre is not assumed: it is ~5px off.
    closure_axes = {}
    for c in cfgs:
        for slot in ORDER[c["mode"]][1:]:
            key = c["layerKeys"][slot]
            if (slot, key) in closure_axes:
                continue
            a = np.array(load(slot, key))[:, :, 3] > 128          # solid silhouette only
            xs = np.where(a.any(axis=0))[0]
            closure_axes[(slot, key)] = (xs.min() + xs.max()) / 2
    # the translucent plastic roller reads narrow on one side; it is a
    # follower here, not a datum
    datum = [v for (slot, key), v in closure_axes.items() if key != "PLS-ROLL"]
    axis = float(np.median(datum))
    spread = max(datum) - min(datum)
    print(f"neck axis from {len(datum)} closure layers: x={axis:.1f} (spread {spread:.1f}px)")
    for (slot, key), v in sorted(closure_axes.items()):
        if abs(v - axis) > 2.5:
            print(f"  note: {slot}:{key} silhouette centre {v - axis:+.1f}px from the datum", file=sys.stderr)
    scale = min((OUT_W - 2 * PAD) / (x1 - x0 + 1), (OUT_H - 2 * PAD) / (y1 - y0 + 1))
    # baseline (bottle bottom) sits PAD above the plate edge; axis on centre
    ox = OUT_W / 2 - axis * scale
    oy = (OUT_H - PAD) - (y1 + 1) * scale
    print(f"family frame: {x1-x0+1}x{y1-y0+1}px @ scale {scale:.4f}")

    def render(layers, name):
        stack = Image.new("RGBA", (SRC_W, SRC_H), (0, 0, 0, 0))
        for im in layers:
            stack.alpha_composite(im)
        inv = 1 / scale
        plate = Image.new("RGBA", (OUT_W, OUT_H), (255, 255, 255, 255))
        moved = stack.transform((OUT_W, OUT_H), Image.AFFINE, (inv, 0, -ox * inv, 0, inv, -oy * inv),
                                resample=Image.BICUBIC)
        plate.alpha_composite(moved)
        rgb = plate.convert("RGB")
        rgb.save(os.path.join(OUT_DIR, f"{name}.webp"), "WEBP", quality=88, method=6)
        # rail thumbnail: ink-cropped square, as the Diva plates
        tx0, ty0, tx1, ty1 = ink_bbox(np.array(rgb.convert("L")))
        side = max(tx1 - tx0, ty1 - ty0) + 24
        cx, cy = (tx0 + tx1) // 2, (ty0 + ty1) // 2
        sq = Image.new("RGB", (side, side), (255, 255, 255))
        sq.paste(rgb, (-(cx - side // 2), -(cy - side // 2)))
        sq.resize((240, 240), Image.LANCZOS).save(os.path.join(OUT_DIR, f"{name}.thumb.webp"), "WEBP", quality=82, method=6)
        return rgb

    entries = []
    worst_axis = 0.0
    for i, c in enumerate(cfgs):
        sku = c["graceSku"]
        order = ORDER[c["mode"]]
        layers = [load(s, c["layerKeys"][s]) for s in order]
        rgb = render(layers, sku)
        # verification, on the shipped plate: the top layer's solid
        # silhouette, put through the same transform, sits on the centre
        # line. The body is excluded on purpose -- the swirl's asymmetry
        # would otherwise be reported as a centring fault.
        top = np.array(layers[-1])[:, :, 3] > 128
        xs = np.where(top.any(axis=0))[0]
        got = ((xs.min() + xs.max()) / 2) * scale + ox
        worst_axis = max(worst_axis, abs(got - OUT_W / 2))
        capoff = None
        if c["mode"] == "rollon":
            render(layers[:2], f"{sku}-capoff")
            capoff = f"/paper-doll/{FAMILY_ID}/{sku}-capoff"
        cid, clabel = next((cid, cl) for cid, cl, pred in CLOSURES if pred(c))
        entries.append({
            "sku": sku,
            "graceSku": sku,
            "closure": cid,
            "closureLabel": clabel,
            "color": f"{c['glassLabel']} · {c['finishLabel']}",
            "swatch": SWATCH.get(c["finishLabel"], "#cccccc"),
            "image": f"/paper-doll/{FAMILY_ID}/{sku}.webp",
            "thumb": f"/paper-doll/{FAMILY_ID}/{sku}.thumb.webp",
            "imageCapOff": f"{capoff}.webp" if capoff else None,
            "thumbCapOff": f"{capoff}.thumb.webp" if capoff else None,
            "price": c.get("price1pc"),
            "stock": c.get("stockStatus"),
            "applicator": c.get("applicatorLabel"),
            "productUrl": f"/products/{c['productGroupSlug']}",
            "capacityMl": "9",
            "sourcePsd": ", ".join(layer_file(s, c["layerKeys"][s]) for s in order),
            # 9 mL-specific axes the PDP selects on
            "glass": c["glassLabel"], "glassKey": c["glassKey"],
            "finish": c["finishLabel"], "mode": c["mode"],
            "roller": c["layerKeys"].get("roller"),
            "websiteSku": c.get("websiteSku"),
        })
        if (i + 1) % 29 == 0:
            print(f"  {i+1}/145")

    manifest = {
        "id": FAMILY_ID, "name": FAMILY_NAME, "neckFinish": "17-415",
        "canvas": {"width": OUT_W, "height": OUT_H},
        "closures": [{"id": cid, "label": cl, "count": sum(1 for e in entries if e["closure"] == cid)}
                     for cid, cl, _ in CLOSURES],
        "variants": entries,
    }
    json.dump(manifest, open(os.path.join(OUT_DIR, "manifest.json"), "w"), indent=2)

    idx_path = os.path.join(REPO, "dist/paper-doll/legacy/families.json")
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else []
    index = [f for f in index if f["id"] != FAMILY_ID]
    index.append({"id": FAMILY_ID, "name": FAMILY_NAME, "neckFinish": "17-415", "variantCount": len(entries)})
    json.dump(index, open(idx_path, "w"), indent=2)

    n_files = len([f for f in os.listdir(OUT_DIR) if f.endswith(".webp")])
    size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR)) / 1e6
    print(f"wrote {len(entries)} configurations ({n_files} webp, {size:.1f} MB) -> dist/paper-doll/legacy/{FAMILY_ID}/")
    print(f"neck datum centred within {worst_axis:.2f}px on every plate")
    for cl in manifest["closures"]:
        print(f"    {cl['label']:28s} {cl['count']:>3}")

if __name__ == "__main__":
    main()
