"""Kits for the ten Diva 46 ml bulb sprayers with a jewelled bottle ring (GBDiva46AnSp[Tsl]<colour>Rng).

The register has no kit for them. Each starts from the same colour's ring-less bulb kit (GBDiva46AnSp[Tsl]<colour>:
glass, sizing, sprayer, tube) and adds its ring, the "Rng" layer of its own capped PSD in the master library
(25. Diva (Clear) 46 ml./1. Diva (Clear) 46ml PSD), placed by that PSD's bottle: neck top on the stage seat, foot on
the baseline, centred on the axis. The ring is a "collar" layer: it stays on the glass in SIDECAR and is not moved by
the closure seating. Run after build-kits.mts and before seat-and-tubes.py.
Usage: python3 scripts/diva-vial/diva-ring-kits.py
"""
import copy, glob, hashlib, io, json, os
import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/2.  18-415 Bottles /25. Diva (Clear) 46 ml./1. Diva (Clear) 46ml PSD"
KITS = "public/local-kits/diva-masters-2026-11-03/kits.json"
OUT = "public/local-kits/diva-masters-2026-11-03/rings"
RINGS = ["GBDiva46AnSpBlkRng", "GBDiva46AnSpTslBlkRng", "GBDiva46AnSpLvnRng", "GBDiva46AnSpIvySlRng", "GBDiva46AnSpRedRng",
         "GBDiva46AnSpWhtRng", "GBDiva46AnSpTslLvnRng", "GBDiva46AnSpTslIvySlRng", "GBDiva46AnSpTslRedRng", "GBDiva46AnSpTslWhtRng"]


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def main():
    if os.path.isdir(OUT):                                   # psd_tools' bytes vary run to run: start clean
        for old in os.listdir(OUT):
            os.remove(f"{OUT}/{old}")
    kits = json.load(open(KITS)); rows = kits["rows"]
    psds = {os.path.basename(f).split(". ", 1)[1].removesuffix(".psd"): f for f in glob.glob(f"{ROOT}/*.psd")}
    placed = {}
    for sku in sorted(RINGS, key=lambda k: "Tsl" in k):          # ring-only bulbs first: the tassel kits reuse their place
        template = sku.removesuffix("Rng")
        name = next(n for n in psds if n.startswith(template) and n.endswith("Rng"))
        layers = [l for l in PSDImage.open(psds[name]).descendants() if l.kind == "pixel" and l.visible and l.name != "Background"]
        w = lambda l: l.bbox[2] - l.bbox[0]; h = lambda l: l.bbox[3] - l.bbox[1]
        bottle = max((l for l in layers if 550 < w(l) < 750), key=h)
        ring = next(l for l in layers if w(l) > 500 and h(l) < 0.35 * w(l))
        bi = bottle.composite().convert("RGBA"); bb = bi.getchannel("A").getbbox()
        top, foot = bottle.bbox[1] + bb[1], bottle.bbox[1] + bb[3]; axis = bottle.bbox[0] + (bb[0] + bb[2]) / 2
        ri = ring.composite().convert("RGBA"); rb = ri.getchannel("A").getbbox(); ri = ri.crop(rb)
        rx, ry = ring.bbox[0] + rb[0], ring.bbox[1] + rb[1]
        kit = copy.deepcopy(rows[template])
        d = kit["register"]["datum"]; s = (d["baselineY"] - d["seatY"]) / (foot - top)
        box = {"x": round(d["axisX"] + (rx - axis) * s, 3), "y": round(d["seatY"] + (ry - top) * s, 3),
               "width": round(ri.width * s, 3), "height": round(ri.height * s, 3)}
        # The tassel PSDs frame the bottle a little differently (the ring came out 3% wider and 17 px higher); it is the
        # same bottle and ring, so a tassel kit takes the ring place of the same colour's bulb kit.
        plain = sku.replace("AnSpTsl", "AnSp")
        if plain != sku and plain in placed:
            box = dict(placed[plain])
        placed[sku] = box
        body = next(p for p in kit["parts"] if p["slot"] == "body")
        comp = f"PSD-DIVA46-RING-{sku.removeprefix('GBDiva46AnSp').removeprefix('Tsl').removesuffix('Rng').upper()}"
        kit["parts"].append({"slot": "collar", "variantKey": None, "zOrder": body["zOrder"] + 0.5, "explodeIndex": 1,
                             "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)},
                             "assembled": {"x": 0, "y": 0}, "exploded": {"dx": 0, "dy": 0}, "image": save(ri, f"ring-{sku}"),
                             "image2x": None, "mask": None, "derivation": "psd-layer", "box": box, "componentId": comp,
                             "source": f"{name}.psd :: {ring.name}"})
        kit["parts"].sort(key=lambda p: p["zOrder"])
        kit["sku"] = sku
        kit["register"] = {**kit["register"], "componentIds": sorted(set(kit["register"].get("componentIds", [])) | {comp})}
        kit["source"] = {"template": template, "ring": f"{name}.psd :: {ring.name}"}
        rows[sku] = kit
        if sku not in kits["defaultPdpSkus"]:
            kits["defaultPdpSkus"].append(sku)
        print(sku, "from", template, "ring box", box)
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("version", kits["version"])


if __name__ == "__main__":
    main()
