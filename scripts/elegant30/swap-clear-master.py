"""Put the regenerated 30 ml clear master into every 30 ml clear Elegant kit.

Jordan (3 Nov 2026): the 30 ml clear candidate had a subtle white square inside, as the 60 ml did; its
body was filled near pure white where the stage ground should show through.
scripts/elegant-masters/regenerate-clear.py 30 regenerated it from the register plate (edges within
2-3 px). Each clear kit draws the new image uniformly on its own existing glass: neck top on the
body's bounds.top, foot on bounds.bottom, centred on the bounds' axis, so every sprayer, cap and the
shared dip tube keep their seats. The scaler landmark (the neck base) is measured on the new image as
build-60-100-kits.mts measures it.

Usage: python3 scripts/elegant30/swap-clear-master.py
"""
import hashlib, json
import numpy as np
from PIL import Image

KITS = "public/local-kits/elegant30-master-2026-11-03/kits.json"
MASTER = "public/reviews/elegant-master-candidates-2026-11-03/elegant30-clear-master-r3.png"


def outline(path):
    a = np.asarray(Image.open(path).convert("RGBA"))[..., 3] > 40
    widths = a.sum(1); ys = np.where(widths)[0]; xs = np.where(a.any(0))[0]
    top, bottom = int(ys.min()), int(ys.max())
    neck = sorted(widths[top + 15:top + 60])[22]
    neck_base = top + 20
    while widths[neck_base] <= neck * 1.15:
        neck_base += 1
    return {"top": top, "bottom": bottom, "left": int(xs.min()), "right": int(xs.max()) + 1, "neckBase": neck_base}


def main():
    kits = json.load(open(KITS))
    data = open(MASTER, "rb").read(); im = Image.open(MASTER)
    image = {"url": "/" + MASTER.removeprefix("public/"), "key": "", "sha256": hashlib.sha256(data).hexdigest(),
             "bytes": len(data), "width": im.width, "height": im.height}
    o = outline(MASTER); swapped = []
    for sku, kit in kits["rows"].items():
        if "-clear-" not in kit["familyId"]:
            continue
        body = next(p for p in kit["parts"] if p["slot"] == "body")
        b = body["bounds"]
        s = (b["bottom"] - b["top"]) / (o["bottom"] - o["top"])
        axis = (b["left"] + b["right"]) / 2
        box = {"x": round(axis - (o["left"] + o["right"]) / 2 * s, 3), "y": round(b["top"] - o["top"] * s, 3),
               "width": round(im.width * s, 3), "height": round(im.height * s, 3)}
        body.update({"image": dict(image), "image2x": None, "mask": None, "box": box,
                     "bounds": {"left": round(box["x"] + o["left"] * s, 2), "top": b["top"], "right": round(box["x"] + o["right"] * s, 2), "bottom": b["bottom"]}})
        kit["glassSizing"]["landmarkY"] = round(box["y"] + o["neckBase"] * s, 2)
        swapped.append(sku)
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("clear master in", len(swapped), "kits; version", kits["version"])


if __name__ == "__main__":
    main()
