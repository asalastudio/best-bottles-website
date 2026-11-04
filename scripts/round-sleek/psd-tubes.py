"""Regenerate the Round 78/128 ml and Sleek 30/50/100 ml dip tubes from the original Photoshop sources.

The Circle pipeline (scripts/circle-boston/psd-tubes.py, after the Elegant one) placed each tube by its PSD bottle.
The Round and Sleek bottle layers are not usable for that: the Round 78 ml clear layers have no neck and the Sleek
50 ml layers carry a white smear down one side, so their proportions are off (Sleek 50: 3.2 tall to wide against
the bottle's 5.0). The tube layers are clean, so this keeps only their shape: each is redrawn with Sunburst in the
approved Cylinder tube material (the Elegant helpers) and seat-and-tubes.py fits it to the register tube's place
in the kit (its top at the pump, its foot near the floor). Where a PSD has no tube layer or a smeared one, the
same fitment's tube from the family's sibling size stands in (fitted to this size's length).

Writes public/local-kits/round-sleek-masters-2026-11-03/tubes/<size>-<kind>.<sha>.png and tubes.json.
Usage: python3 scripts/round-sleek/psd-tubes.py <work-dir>
"""
import glob, hashlib, importlib.util, io, json, os, sys
from PIL import Image
from psd_tools import PSDImage

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles"
OUT = "public/local-kits/round-sleek-masters-2026-11-03/tubes"
# (size, kind): (PSD file name, tube layer)
SOURCES = {
    ("round78", "spray"): ("53. GBRnd78SpryCu.psd", "Layer 11"),
    ("round78", "lotion"): ("58. LBRnd128LtnCu.psd", "Layer 18"),          # no 78 ml lotion tube layer: the 128 ml one
    ("round78", "atomizer"): ("39. GBRnd78AnSpBlk.psd", "Layer 4 copy"),
    ("round128", "spray"): ("57. GBRnd128SpryCu.psd", "Layer 18"),
    ("round128", "lotion"): ("58. LBRnd128LtnCu.psd", "Layer 18"),
    ("round128", "atomizer"): ("39. GBRnd128AnSpBlk.psd", "Layer 4 copy"),
    ("sleek30", "spray"): ("49. GBSlk30SpryCu.psd", "Layer 19"),
    ("sleek30", "lotion"): ("51. LBSlk30LtnCu.psd", "Layer 21"),
    ("sleek30", "atomizer"): ("39. GBSlk30AnSpBlk.psd", "Layer 4 copy"),
    ("sleek50", "spray"): ("56. GBSlk100SpryCu.psd", "Layer 32"),          # the 50 ml tube layers are smeared: 100 ml's
    ("sleek50", "lotion"): ("57. LBSlk100LtnCu.psd", "Layer 30"),
    ("sleek50", "atomizer"): ("39. GBSlk100AnSpBlk.psd", "Layer 11"),
    ("sleek100", "spray"): ("56. GBSlk100SpryCu.psd", "Layer 32"),
    ("sleek100", "lotion"): ("57. LBSlk100LtnCu.psd", "Layer 30"),
    ("sleek100", "atomizer"): ("39. GBSlk100AnSpBlk.psd", "Layer 11"),
}
TOP = {
    "spray": "the small clear plastic fitting at the top of the tube, the same outline",
    "lotion": "the lotion pump's narrow clear fitting at the top and the weighted end at the bottom, the same outlines",
    "atomizer": "no pump body: the tube runs straight to its cut top end",
}


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    import numpy as np
    cyl = Image.open(E.MATERIAL).convert("RGBA")
    w = (np.asarray(cyl)[..., 3] > 30).sum(1); run_ = np.median(w[len(w) // 2:][w[len(w) // 2:] > 0])
    collar_end = int(np.where(w[: len(w) // 3] > run_ * 1.8)[0].max()) + 6
    E.framed(cyl.crop((0, collar_end, cyl.width, cyl.height))).save(f"{work}/material.png")
    layers, sources = {}, {}
    for (size, kind), (name, layer_name) in SOURCES.items():
        psd = sorted(glob.glob(f"{ROOT}/**/{name}", recursive=True))[0]
        ti = {l.name: l for l in PSDImage.open(psd).descendants()}[layer_name].composite().convert("RGBA")
        ti = ti.crop(ti.getchannel("A").getbbox())
        layers[(size, kind)] = ti; sources[(size, kind)] = (psd.removeprefix(ROOT + "/"), layer_name)
        ti.save(f"{work}/{size}-{kind}.layer.png")
        E.framed(ti, ground=E.GREY).save(f"{work}/{size}-{kind}.geometry.png")

    def run(item):
        (size, kind), layer = item
        raw = f"{work}/{size}-{kind}.raw.png"
        if kind != "atomizer" and not os.path.exists(raw):
            E.edit([f"{work}/{size}-{kind}.geometry.png", f"{work}/material.png"], E.PROMPT.format(top=TOP[kind]), raw)
        return (size, kind), raw
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
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
        report[f"{size}-{kind}"] = {"psd": sources[(size, kind)][0], "layer": sources[(size, kind)][1], **rep,
                                    "file": "/" + path.removeprefix("public/"), "pixels": [cut.width, cut.height]}
        print(size, kind, rep)
    json.dump(report, open(f"{OUT}/tubes.json", "w"), indent=1)


if __name__ == "__main__":
    main()
