"""Kits for the four 60/100 ml Elegant white treatment pumps with clear overcap (WhtClOvrCp).

The register has no kit for LBElg60WhtClOvrCp, LBElgFrst60WhtClOvrCp, LBElg100WhtClOvrCp or
LBElgFrst100WhtClOvrCp. Their capped PSDs hold the component as two layers: the pump alone
(the "2 copy" layer) and the pump with its square clear overcap on (the "1 copy" layer), which
is the register's convention for an overcap part (the cap-on image, pump inside). Each kit starts
from the same size and glass's clear-overcap lotion kit (glass, sizing, datum, views) and swaps in
the two PSD layers, placed by the PSD's own bottle: neck top on the stage seat, foot on the
baseline, centred on the axis, never stretched. universal-dip-tube-60-100.py then seats both on
the shoulder and draws the size's lotion tube, as for every other lotion kit.

The overcap is drawn as its empty square cover, seated (on the pump's collar) and parked beside the
glass alike: the cap-on layer is a second photograph of the pump under the cover, head locked down,
so drawn over the pump layer it printed the pump twice (Jordan, 3 Nov 2026). No PSD has the cover
empty, so Sunburst redraws the cover cut from the cap-on layer (everything above the pump's collar)
without the pump inside; the result is cut to that cover's outline, its alpha taken from how far
each pixel stands off the ground, so the clear shell stays see-through.

Run after build-60-100-kits.mts and before universal-dip-tube-60-100.py.
Usage: python3 scripts/elegant-masters/white-lotion-kits-60-100.py <work-dir>
"""
import copy, hashlib, io, json, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles"
KITS = "public/local-kits/elegant60-100-masters-2026-11-03/kits.json"
OUT = "public/local-kits/elegant60-100-masters-2026-11-03/white-lotion"
# size: {part: (PSD, bottle layer, component layer)}
SOURCES = {
    "60": {"pump": ("17. Elegant 60ml/1. Elegant 60ml PSD/55. LBElg60WhtClOvrCp.psd", "Layer 22", "Layer 2 copy"),
           "overcap": ("17. Elegant 60ml/1. Elegant 60ml PSD/54. LBElg60WhtClOvrCp.psd", "Layer 22", "Layer 1 copy")},
    "100": {"pump": ("18. Elegant 100ml/1. Elegant 100ml PSD/54. LBElg100WhtClOvrCp.psd", "Layer 25", "Layer 2 copy"),
            "overcap": ("18. Elegant 100ml/1. Elegant 100ml PSD/53. LBElg100WhtClOvrCp.psd", "Layer 25", "Layer 1 copy")},
}
SKUS = {  # new SKU: template kit of the same size and glass
    "LBElg60WhtClOvrCp": "LBElg60LtnClrOvrCap", "LBElgFrst60WhtClOvrCp": "LBElgFrst60LtnClOvrCap",
    "LBElg100WhtClOvrCp": "LBElg100LtnClOvrCap", "LBElgFrst100WhtClOvrCp": "LBElgFrst100LtnClOvrCap",
}


BONE = (245, 243, 239)
GREY = (150, 150, 150)
COVER_PROMPT = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same square clear overcap shell, the same outline, size, corners and wall thickness, at the same position in the frame.
2. Remove the white lotion pump that shows through it: the cover is empty, a clear acrylic shell with soft grey edges and a light top rim, its inside clear and see-through to the background.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no pump, no bottle, no props, no text."""


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{name}-{sha[:12]}.png"
    open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def empty_cover(size, pump, cap, work):
    """The cap-on layer above the pump's collar, redrawn empty by Sunburst; returns (image, cover height fraction)."""
    sys.path.insert(0, os.path.dirname(__file__))
    from importlib import import_module
    psdtubes = import_module("psd-tubes-60-100")
    pa = np.asarray(pump["layer"])[..., 3] > 60; widths = pa.sum(1)
    collar_top = pump["top"] + int(np.argmax(widths >= widths.max() * 0.92)) / pump["h"]   # the white collar block, in bottle fractions
    rows = round((collar_top - cap["top"]) * cap["h"])
    cover = cap["layer"].crop((0, 0, cap["layer"].width, rows))
    cover.save(f"{work}/{size}-cover.layer.png")
    psdtubes.framed(cover, ground=GREY).save(f"{work}/{size}-cover.geometry.png")
    raw = f"{work}/{size}-cover.raw.png"
    if not os.path.exists(raw):
        psdtubes.edit([f"{work}/{size}-cover.geometry.png"], COVER_PROMPT, raw)
    fr = psdtubes.framed(cover)
    ox, oy = (fr.width - cover.width) // 2, (fr.height - cover.height) // 2
    pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(cover, (ox, oy))
    cut, _ = psdtubes.register(Image.open(raw).resize(fr.size, Image.LANCZOS), pad)
    rgb = np.asarray(cut.convert("RGB")).astype(float)[oy:oy + cover.height, ox:ox + cover.width]
    outline = np.asarray(cover)[..., 3].astype(float) / 255
    a = np.clip(np.abs(rgb - BONE).max(axis=2) / 40, 0.1, 1) * outline           # see-through where it matches the ground
    colour = np.clip((rgb - np.array(BONE) * (1 - a[..., None])) / np.maximum(a[..., None], 1e-3), 0, 255)
    out = Image.fromarray(np.dstack([colour, a * 255]).astype(np.uint8))
    return out, rows / cap["layer"].height


def layer(psd, bottle_name, name):
    """The component cut from its PSD, with its box as fractions of the bottle's neck-top-to-foot height."""
    p = PSDImage.open(f"{ROOT}/{psd}"); named = {l.name: l for l in p.descendants()}
    bottle, part = named[bottle_name], named[name]
    bi, pi = bottle.composite(), part.composite()
    bb, pb = bi.getchannel("A").getbbox(), pi.getchannel("A").getbbox()
    top, foot = bottle.bbox[1] + bb[1], bottle.bbox[1] + bb[3]
    axis = bottle.bbox[0] + (bb[0] + bb[2]) / 2; h = foot - top
    img = pi.crop(pb)
    return {"image": save(img, name.split()[1]), "layer": img, "h": h,
            "left": (part.bbox[0] + pb[0] - axis) / h, "top": (part.bbox[1] + pb[1] - top) / h, "width": img.width / h, "height": img.height / h,
            "source": f"{psd} :: {name}"}


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True)
    kits = json.load(open(KITS)); rows = kits["rows"]
    parts = {size: {slot: layer(*src) for slot, src in spec.items()} for size, spec in SOURCES.items()}
    covers = {size: empty_cover(size, p["pump"], p["overcap"], work) for size, p in parts.items()}
    for sku, template in SKUS.items():
        kit = copy.deepcopy(rows[template])
        size = kit["register"]["bodyId"].split("-")[1].removesuffix("ml")
        d = kit["register"]["datum"]; H = d["baselineY"] - d["seatY"]
        for part in kit["parts"]:
            src = parts[size].get(part["slot"])
            if not src:
                continue
            box = {"x": round(d["axisX"] + src["left"] * H, 3), "y": round(d["seatY"] + src["top"] * H, 3),
                   "width": round(src["width"] * H, 3), "height": round(src["height"] * H, 3)}
            part.update({"image": dict(src["image"]), "image2x": None, "mask": None, "box": box, "derivation": "psd-layer",
                         "componentId": None, "source": src["source"],
                         "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
            part.pop("detached", None)
            if part["slot"] == "overcap":
                # The cap-on layer is a second photograph of the pump under the cover (its head locked down),
                # so drawn over the pump layer it prints the pump twice. Seated and parked, the overcap is the
                # empty cover alone, standing on the pump's collar; the one pump shows through it.
                img, frac = covers[size]
                cb = {**box, "height": round(box["height"] * frac, 3)}
                cover = save(img, "cover-empty")
                cbounds = {"left": cb["x"], "top": cb["y"], "right": round(cb["x"] + cb["width"], 3), "bottom": round(cb["y"] + cb["height"], 3)}
                part.update({"image": dict(cover), "box": cb, "bounds": cbounds, "source": part["source"] + " (cover above the collar, emptied by Sunburst)"})
                part["detached"] = {"image": {k: v for k, v in cover.items() if k in ("url", "width", "height")}, "box": dict(cb), "bounds": dict(cbounds)}
        kit["sku"] = sku
        kit["register"] = {**kit["register"], "componentIds": [], "seatSignature": None}
        kit["source"] = {"template": template, "psd": {slot: src["source"] for slot, src in parts[size].items()}}
        rows[sku] = kit
        if sku not in kits["defaultPdpSkus"]:
            kits["defaultPdpSkus"].append(sku)
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("added", ", ".join(SKUS), "version", kits["version"])


if __name__ == "__main__":
    main()
