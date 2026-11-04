"""Regenerate the Circle 15/30/50/100 ml dip tubes from the original Photoshop sources.

The same pipeline as the Elegant tubes (scripts/elegant-masters/psd-tubes-60-100.py, whose helpers
this imports): the PSD layer fixes shape, size and position against the bottle layer in the same
file; Sunburst redraws its material after the approved 9 ml Cylinder tube; the output is registered
onto the layer's outline. The bulb atomizer's plain tube is swept along the PSD centre line in the
material of the same size's spray tube.

Circle sources: the spray and atomizer PSDs of each size, and the 100 ml lotion PSD. The 50 ml lotion
PSD (58. LBCrcl50LtnCu) photographs the spray tube, so the 50 ml lotion kits share the spray tube.
The 100 ml spray tube layer runs past the canvas: it is cut at the bottle's foot.

Writes public/local-kits/circle-masters-2026-11-03/tubes/<size>-<kind>.<sha>.png and tubes.json.
Usage: python3 scripts/circle-boston/psd-tubes.py <work-dir> [--prepare]
"""
import concurrent.futures, hashlib, importlib.util, io, json, os, sys
from PIL import Image
from psd_tools import PSDImage

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources"
OUT = "public/local-kits/circle-masters-2026-11-03/tubes"
C50 = "2. 18-415 Bottles/4. Circle Glass 50ml/1. Circle Glass 50ml PSD"
C100 = "2. 18-415 Bottles/5. Circle Glass Bottle 100ml (clear)/1. Circle Glass 100ml PSD"
# (size, kind): (PSD, bottle layer, tube layer)
SOURCES = {
    ("30", "spray"): ("15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml/1. GBCrcl30SpryBlk.psd", "Layer 2", "Layer 3"),
    ("15", "spray"): ("5. 13-415 Bottles PSD/17. Circle 15ml/6. GBCrcl15SpryGlSh.psd", "Layer 7", "Layer 16"),
    ("50", "spray"): (f"{C50}/56. GBCrcl50SpryCu.psd", "Layer 13", "Layer 10"),
    ("50", "atomizer"): (f"{C50}/39. GBCrcl50AnSpBlk.psd", "Layer 29", "Layer 4 copy"),
    ("100", "spray"): (f"{C100}/53. GBCrcl100SpryCu.psd", "Layer 1", "Layer 2"),
    ("100", "lotion"): (f"{C100}/55. LBCrcl100LtnCu.psd", "Layer 1", "Layer 4"),
    ("100", "atomizer"): (f"{C100}/39. GBCrcl100AnSpBlk.psd", "Layer 1", "Layer 4 copy"),
}
TOP = {
    "spray": "the small clear plastic fitting at the top of the tube, the same outline",
    "lotion": "the lotion pump's narrow clear fitting at the top and the small weighted end at the bottom, the same outlines",
    "atomizer": "no pump body: the tube runs straight to its cut top end",
}


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    cyl = Image.open(E.MATERIAL).convert("RGBA")
    import numpy as np
    w = (np.asarray(cyl)[..., 3] > 30).sum(1); run_ = np.median(w[len(w) // 2:][w[len(w) // 2:] > 0])
    collar_end = int(np.where(w[: len(w) // 3] > run_ * 1.8)[0].max()) + 6
    E.framed(cyl.crop((0, collar_end, cyl.width, cyl.height))).save(f"{work}/material.png")
    layers, geometry = {}, {}
    for (size, kind), (psd, bottle_name, tube_name) in SOURCES.items():
        p = PSDImage.open(f"{ROOT}/{psd}"); named = {l.name: l for l in p.descendants()}
        bottle, tube = named[bottle_name], named[tube_name]
        bi, ti = bottle.composite(), tube.composite()
        bb = bi.getchannel("A").getbbox()
        top, foot = bottle.bbox[1] + bb[1], bottle.bbox[1] + bb[3]
        axis = bottle.bbox[0] + (bb[0] + bb[2]) / 2
        ti = ti.crop((0, 0, ti.width, min(ti.height, foot - tube.bbox[1])))   # never below the foot
        tb = ti.getchannel("A").getbbox(); ti = ti.crop(tb)
        h = foot - top
        x0, y0 = tube.bbox[0] + tb[0], tube.bbox[1] + tb[1]
        geometry[f"{size}-{kind}"] = {"psd": psd, "layer": tube_name,
                                      "left": (x0 - axis) / h, "top": (y0 - top) / h, "width": ti.width / h, "height": ti.height / h}
        layers[(size, kind)] = ti
        ti.save(f"{work}/{size}-{kind}.layer.png")
        E.framed(ti, ground=E.GREY).save(f"{work}/{size}-{kind}.geometry.png")
    if "--prepare" in sys.argv:
        print(json.dumps(geometry, indent=1)); return

    def run(item):
        (size, kind), layer = item
        raw = f"{work}/{size}-{kind}.raw.png"
        if kind != "atomizer" and not os.path.exists(raw):
            E.edit([f"{work}/{size}-{kind}.geometry.png", f"{work}/material.png"], E.PROMPT.format(top=TOP[kind]), raw)
        return (size, kind), raw
    with concurrent.futures.ThreadPoolExecutor(3) as pool:
        raws = dict(pool.map(run, layers.items()))
    report, cuts = {}, {}
    for (size, kind), layer in sorted(layers.items(), key=lambda item: item[0][1] == "atomizer"):
        if kind == "atomizer":
            cut, rep = E.swept(layer, cuts[(size, "spray")]), {"swept": f"{size}-spray material along the PSD centre line"}
        else:
            fr = E.framed(layer); raw = Image.open(raws[(size, kind)]).resize(fr.size, Image.LANCZOS)
            ox, oy = (fr.width - layer.width) // 2, (fr.height - layer.height) // 2
            pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(layer, (ox, oy))
            cut, rep = E.register(raw, pad)
            cut = cut.crop((ox, oy, ox + layer.width, oy + layer.height))
        cuts[(size, kind)] = cut
        buf = io.BytesIO(); cut.save(buf, "PNG", optimize=True)
        path = f"{OUT}/{size}-{kind}.{hashlib.sha256(buf.getvalue()).hexdigest()[:12]}.png"
        for old in os.listdir(OUT):
            if old.startswith(f"{size}-{kind}.") and old.endswith(".png"):
                os.remove(f"{OUT}/{old}")
        open(path, "wb").write(buf.getvalue())
        report[f"{size}-{kind}"] = {**geometry[f"{size}-{kind}"], **rep, "file": "/" + path.removeprefix("public/"), "pixels": [cut.width, cut.height]}
        print(size, kind, rep)
    report["50-lotion"] = {**report["50-spray"], "sharedWith": "50-spray (58. LBCrcl50LtnCu photographs the spray tube)"}
    json.dump(report, open(f"{OUT}/tubes.json", "w"), indent=1)


if __name__ == "__main__":
    main()
