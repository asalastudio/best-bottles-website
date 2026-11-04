"""Regenerate the Circle 30 ml clear master glass with Sunburst (gpt-image-2.5-sunburst).

Jordan (3 Nov 2026): regenerate the 30 ml Circle. The PSD bottle layer (1. GBCrcl30SpryBlk) is the only
source for this size (the register has no Circle 30 ml plate) and its body is filled near white, as the
Elegant clear masters were. The same treatment as scripts/elegant-masters/regenerate-clear.py: the PSD
layer on bone is the locked geometry (first image), the approved Elegant 30 ml clear master (the same
15-415 clear glass) the material reference (second image); regenerate-frosted.py's pipeline registers
the output uniformly onto the layer's outline and cuts it with the layer's own alpha.

Writes public/local-kits/circle-masters-2026-11-03/circle30-master/circle30-clear-master.png, which
circle30-kits.py draws as every 30 ml SKU's glass.
Usage: python3 scripts/circle-boston/regenerate-circle30.py <work-dir>
"""
import json, os, sys
from importlib import import_module
import numpy as np
from PIL import Image
from psd_tools import PSDImage

sys.path.insert(0, "scripts/elegant-masters")
pipeline = import_module("regenerate-frosted")
clear = import_module("regenerate-clear")
PSD = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml/1. GBCrcl30SpryBlk.psd"
REFERENCE = "public/reviews/elegant-master-candidates-2026-11-03/elegant30-clear-master-r3.png"
OUT = "public/local-kits/circle-masters-2026-11-03/circle30-master"
PROMPT = clear.PROMPT.replace("(the second image is a photograph of this same bottle)",
                              "(the second image is approved clear glass of the same maker and neck finish, for material only, not shape)")


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    named = {l.name: l for l in PSDImage.open(PSD).descendants()}
    layer = named["Layer 2"].composite().convert("RGBA"); layer = layer.crop(layer.getchannel("A").getbbox())
    W = max(layer.width, round(layer.height / 1.5)); H = round(W * 1.5)
    pipeline.on_bone(layer, (W, H)).convert("RGB").save(f"{work}/circle30.geometry.png")
    ref = Image.open(REFERENCE).convert("RGBA")
    pipeline.on_bone(ref, (ref.width, round(ref.width * 1.5))).convert("RGB").save(f"{work}/circle30.material.png")
    pipeline.PROMPT = PROMPT
    raw = f"{work}/circle30.raw.png"
    if not os.path.exists(raw):
        pipeline.edit([f"{work}/circle30.geometry.png", f"{work}/circle30.material.png"], raw)
    out = Image.open(raw).convert("RGB"); a = np.asarray(out).astype(int)
    bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
    got = np.abs(a - bg).max(axis=2) > 5
    target = np.asarray(layer)[..., 3] > 40
    (gy, gx), (ty, tx) = np.where(got), np.where(target)
    s = (ty.max() - ty.min()) / (gy.max() - gy.min())
    scaled = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    dx = round((tx.min() + tx.max()) / 2 - (gx.min() + gx.max()) / 2 * s); dy = round(ty.min() - gy.min() * s)
    aligned = Image.new("RGB", layer.size, tuple(int(v) for v in bg)); aligned.paste(scaled, (dx, dy))
    g = np.zeros(target.shape, bool)
    sm = np.asarray(Image.fromarray(got).resize(scaled.size, Image.NEAREST))
    y0, x0 = max(dy, 0), max(dx, 0); y1, x1 = min(dy + sm.shape[0], g.shape[0]), min(dx + sm.shape[1], g.shape[1])
    g[y0:y1, x0:x1] = sm[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    # Clear glass shows the ground inside, so the output's own mask is the rim and threads: fill each row
    # between its outer edges before comparing outlines with the PSD layer's filled alpha.
    for y in np.where(g.any(1))[0]:
        xs = np.where(g[y])[0]; g[y, xs.min():xs.max() + 1] = True
    iou = (g & target).sum() / max(1, (g | target).sum())
    master = aligned.convert("RGBA"); master.putalpha(layer.getchannel("A"))
    master.save(f"{OUT}/circle30-clear-master.png")
    report = {"registeredOutlineIoU": round(float(iou), 4), "scale": round(float(s), 4), "shift": [dx, dy],
              "geometry": PSD + " (Layer 2)", "material": REFERENCE, "alpha": "PSD layer alpha"}
    json.dump(report, open(f"{OUT}/report.json", "w"), indent=1)
    print(report)


if __name__ == "__main__":
    main()
