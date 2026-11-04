"""One 15 ml Boston Round master glass per colour, on one shared outline (Sunburst gpt-image-2.5-sunburst).

The register has no 15 ml (18-400) Boston Round. The master library's capped PSDs hold each bottle:
the clear one (5. GBBstn15BlkDrp) is a clean cutout; the amber and cobalt layers run past their canvas
with white halos and stray opaque patches. So the clear layer is the one outline for every colour:
- Clear: the PSD layer itself.
- Amber and cobalt: Sunburst redraws that outline (first image, shape locked) in the colour and glass
  of the same bottle's own photograph (second image: its PSD layer, largest piece, on bone); the output
  is registered onto the outline (height-led, never stretched) and cut with its alpha.

Writes public/local-kits/boston-masters-2026-11-03/boston15-master/<colour>.png and report.json.
Usage: python3 scripts/circle-boston/regenerate-boston15.py <work-dir>
"""
import glob, json, os, sys
from importlib import import_module
import numpy as np
from PIL import Image
from psd_tools import PSDImage

sys.path.insert(0, "scripts/elegant-masters")
pipeline = import_module("regenerate-frosted")
ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/1.  20-400 (1 oz & 2 oz) the 15ml 18-400 Boston Round/1. Boston Round  Dropper Bottles/5.  (.5 ounce:15ml) Boston Round (Capped)"
SOURCES = {"clear": ("*/*/5.  GBBstn15BlkDrp.psd", "Layer 4"),
           "amber": ("*/*/5. GBBstnAmb15mlBlkDropper.psd", "Layer 2"),
           "cobalt": ("*/5. GBBstnBlu15BlkDrp.psd", "Layer 3")}
OUT = "public/local-kits/boston-masters-2026-11-03/boston15-master"
GLASS = {"amber": "deep amber (brown) glass", "cobalt": "deep cobalt blue glass"}
PROMPT = """1. Keep geometry locked to the first image: the same Boston round bottle outline, neck threads, neck bead, shoulder, body and base, at the same position and size in the frame. Do not redraw the shape.
2. Material from the second image, a studio photograph of this same bottle: {glass}, its colour, depth, transparency and highlights; darker along the edges, lighter through the middle, the base thicker and denser. Not opaque, not painted, no white halo or fringe on the edges.
3. Enhance the quality: crisp neck threads, clean edges, photographic studio packshot. No closure, no dropper, no liquid, no label.
Plain flat background #F5F3EF, no shadow, no floor, no props, no text."""


def layer(colour):
    pattern, name = SOURCES[colour]
    p = PSDImage.open(glob.glob(f"{ROOT}/{pattern}")[0]); l = {x.name: x for x in p.descendants()}[name]
    canvas = Image.new("RGBA", p.size, (0, 0, 0, 0)); canvas.alpha_composite(l.composite().convert("RGBA"), (l.bbox[0], l.bbox[1]))
    a = np.asarray(canvas)[..., 3] > 128
    # The largest connected piece is the bottle; the stray white patches are separate.
    from scipy import ndimage
    labels, n = ndimage.label(a)
    keep = labels == (1 + int(np.argmax(ndimage.sum(a, labels, range(1, n + 1)))))
    arr = np.asarray(canvas).copy(); arr[..., 3] = np.where(keep, arr[..., 3], 0)
    img = Image.fromarray(arr); return img.crop(img.getchannel("A").getbbox())


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    outline = layer("clear"); outline.save(f"{OUT}/clear.png")
    target = np.asarray(outline)[..., 3] > 40
    W = max(outline.width, round(outline.height / 1.5)); H = round(W * 1.5)
    pipeline.on_bone(outline, (W, H)).convert("RGB").save(f"{work}/geometry.png")
    report = {"clear": {"source": SOURCES["clear"][0], "derivation": "psd-layer"}}
    for colour in ("amber", "cobalt"):
        photo = layer(colour)
        pipeline.on_bone(photo, (photo.width, round(photo.width * 1.5)) if photo.height <= photo.width * 1.5 else (round(photo.height / 1.5), photo.height)).convert("RGB").save(f"{work}/{colour}.material.png")
        pipeline.PROMPT = PROMPT.format(glass=GLASS[colour])
        raw = f"{work}/{colour}.raw.png"
        if not os.path.exists(raw):
            pipeline.edit([f"{work}/geometry.png", f"{work}/{colour}.material.png"], raw)
        out = Image.open(raw).convert("RGB"); a = np.asarray(out).astype(int)
        bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
        got = np.abs(a - bg).max(axis=2) > 8
        (gy, gx), (ty, tx) = np.where(got), np.where(target)
        s = (ty.max() - ty.min()) / (gy.max() - gy.min())
        scaled = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
        dx = round((tx.min() + tx.max()) / 2 - (gx.min() + gx.max()) / 2 * s); dy = round(ty.min() - gy.min() * s)
        aligned = Image.new("RGB", outline.size, tuple(int(v) for v in bg)); aligned.paste(scaled, (dx, dy))
        g = np.zeros(target.shape, bool)
        sm = np.asarray(Image.fromarray(got).resize(scaled.size, Image.NEAREST))
        y0, x0 = max(dy, 0), max(dx, 0); y1, x1 = min(dy + sm.shape[0], g.shape[0]), min(dx + sm.shape[1], g.shape[1])
        g[y0:y1, x0:x1] = sm[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
        for y in np.where(g.any(1))[0]:
            xs = np.where(g[y])[0]; g[y, xs.min():xs.max() + 1] = True
        iou = (g & target).sum() / max(1, (g | target).sum())
        master = aligned.convert("RGBA"); master.putalpha(outline.getchannel("A")); master.save(f"{OUT}/{colour}.png")
        report[colour] = {"registeredOutlineIoU": round(float(iou), 4), "scale": round(float(s), 4), "shift": [dx, dy],
                          "geometry": SOURCES["clear"][0], "material": SOURCES[colour][0], "alpha": "clear PSD layer alpha"}
        print(colour, report[colour])
    json.dump(report, open(f"{OUT}/report.json", "w"), indent=1)


if __name__ == "__main__":
    main()
