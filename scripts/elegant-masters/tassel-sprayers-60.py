"""The 60 ml Elegant vintage bulb sprayers with tassel, from their own Photoshop sources.

Jordan (3 Nov 2026): the 60 ml clear and frosted tassel sprayers were clipped off the stage. The
register drew them with art that hangs the tassel 20 mm below this bottle's foot and 116 mm to the
side; in the 60 ml PSDs (one per colour) the tassel lies on the floor beside the bottle. Each tassel
kit, clear and frosted, takes its colour's PSD: every layer but the bottle and the dip tube (the
atomizer head with its collar, the hose, bulb and tassel), composited in the PSD's own order into
one sprayer image and placed by the PSD's bottle: neck top on the stage seat, foot on the baseline,
centred on the axis, never stretched. universal-dip-tube-60-100.py then seats the collar on the
shoulder and moves the glass axis right so the whole assembly stands on the stage.

Run after build-60-100-kits.mts and before universal-dip-tube-60-100.py.
Usage: python3 scripts/elegant-masters/tassel-sprayers-60.py
"""
import hashlib, io, json, os, re
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/17. Elegant 60ml/1. Elegant 60ml PSD"
KITS = "public/local-kits/elegant60-100-masters-2026-11-03/kits.json"
OUT = "public/local-kits/elegant60-100-masters-2026-11-03/tassel"


def sprayer(psd_name):
    p = PSDImage.open(f"{ROOT}/{psd_name}")
    pixels = [l for l in p.descendants() if l.kind == "pixel" and l.name != "Background" and l.visible]
    bottle = max(pixels, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]) if (l.bbox[2] - l.bbox[0]) < 900 else 0)
    # The dip tube is the tall, narrow layer; some PSDs (GBElg60AnSpTslGl) also hold a smaller, narrower blob,
    # so the narrowest layer alone is not the tube (it put the tube on the frosted glass).
    tube = max((l for l in pixels if (l.bbox[2] - l.bbox[0]) < 150), key=lambda l: l.bbox[3] - l.bbox[1])
    keep = {id(l) for l in pixels if l is not bottle and l is not tube}
    bi = bottle.composite(); bb = bi.getchannel("A").getbbox()
    top, foot = bottle.bbox[1] + bb[1], bottle.bbox[1] + bb[3]
    axis = bottle.bbox[0] + (bb[0] + bb[2]) / 2; h = foot - top
    img = Image.new("RGBA", p.size, (0, 0, 0, 0))
    for l in pixels:                                  # PSD order, bottom to top
        if id(l) in keep:
            layer = Image.new("RGBA", p.size, (0, 0, 0, 0)); layer.paste(l.composite(), (l.bbox[0], l.bbox[1]))
            img = Image.alpha_composite(img, layer)
    box = img.getchannel("A").getbbox(); img = img.crop(box)
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{psd_name.split('. ')[1].removesuffix('.psd')}-{sha[:12]}.png"
    open(path, "wb").write(data)
    return {"image": {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height},
            "left": (box[0] - axis) / h, "top": (box[1] - top) / h, "width": img.width / h, "height": img.height / h,
            "source": f"17. Elegant 60ml/1. Elegant 60ml PSD/{psd_name} (all layers but the bottle and dip tube)"}


def main():
    kits = json.load(open(KITS)); rows = kits["rows"]
    psds = {re.sub(r"^\d+\. GBElg60AnSpTsl|\.psd$", "", f): f for f in os.listdir(ROOT) if "AnSpTsl" in f and f.endswith(".psd")}
    made = {}
    for sku, kit in rows.items():
        m = re.match(r"GBElg(?:Frst)?60AnSpTsl(\w+)$", sku)
        if not m:
            continue
        colour = m.group(1)
        if colour not in made:
            made[colour] = sprayer(psds[colour])
        src = made[colour]
        d = kit["register"]["datum"]; H = d["baselineY"] - d["seatY"]
        part = next(p for p in kit["parts"] if p["slot"] == "sprayer")
        box = {"x": round(d["axisX"] + src["left"] * H, 3), "y": round(d["seatY"] + src["top"] * H, 3),
               "width": round(src["width"] * H, 3), "height": round(src["height"] * H, 3)}
        part.update({"image": dict(src["image"]), "image2x": None, "mask": None, "box": box, "derivation": "psd-layer", "source": src["source"],
                     "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("tassel sprayers from PSD:", ", ".join(sorted(made)), "version", kits["version"])


if __name__ == "__main__":
    main()
