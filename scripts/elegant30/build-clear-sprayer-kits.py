"""Build the three missing clear 30 ml Elegant sprayer kits from their own capped PSDs.

The reviewed clear kits (GBElg30SpryMattGl, GBElg30SpryMattSl) are the capped
PSD's own layers on the 1000 x 1100 plate: the photograph scaled by S, the bottle
foot on FOOT_Y and the overcap centred on the axis, with the shared clear
candidate body fitted over the PSD bottle. `--check` rebuilds those two from
their PSDs and reports how far each part lands from the reviewed kit; the build
only runs when that error is small.

Usage:
  python3 scripts/elegant30/build-clear-sprayer-kits.py --check
  python3 scripts/elegant30/build-clear-sprayer-kits.py --write
Needs the Achive drive (BB_PSD_MASTER_ROOT).
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = os.environ.get("BB_PSD_MASTER_ROOT", "/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master")
CAPPED = f"{ROOT}/4.  15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30"
KITS = "public/local-kits/elegant30-master-2026-11-03/kits.json"
PARTS_DIR = "public/local-kits/elegant30-master-2026-11-03/parts"
CANVAS = (1000, 1100)

# Catalog SKU -> its own capped PSD (the file names spell two finishes differently).
TARGETS = {
    "GBElg30SpryShGl": "2. GBElg30SpryShnGl.psd",   # shiny gold
    "GBElg30SpryShnSl": "3. GBElg30SpryShSl.psd",   # shiny silver
    "GBElg30SpryBlk": "1. GBElg30SpryBlk..psd",     # black
}
REFERENCE = {"GBElg30SpryMattGl": "5. GBElg30SpryMattGl.psd", "GBElg30SpryMattSl": "4. GBElg30SpryMattSl.psd"}


def classify(psd):
    """Split the capped PSD into bottle, dip tube, overcap and sprayer layers."""
    slots = {"bottle": [], "diptube": [], "overcap": [], "sprayer": [], "skipped": []}
    layers = [l for l in psd if l.name != "Background" and l.visible]
    for l in layers:
        w, h = l.width, l.height
        if (w, h) == psd.size:
            slots["skipped"].append((l.name, "full-canvas backdrop"))
        elif w > 500 and h > 800:
            slots["bottle"].append(l)
        elif w < 100 and h > 500:
            slots["diptube"].append(l)
        elif l.top < 75 and h > 470:
            slots["overcap"].append(l)
        elif w < 60 and h < 60:
            slots["sprayer"].append(l)  # nozzle orifice details sit on the actuator
        elif h > 400:
            slots["sprayer"].append(l)
        else:
            slots["skipped"].append((l.name, f"{w}x{h} at {l.left},{l.top}: bottle detail (neck threads)"))
    assert len(slots["bottle"]) == 1 and len(slots["diptube"]) == 1 and len(slots["overcap"]) == 1 and slots["sprayer"], slots
    return slots


def transform(slots, s, foot_y):
    """Bottle foot on foot_y; overcap centred on x=500."""
    bottle, over = slots["bottle"][0], slots["overcap"][0]
    ty = foot_y - bottle.bbox[3] * s
    tx = 500 - (over.bbox[0] + over.bbox[2]) / 2 * s
    return tx, ty


def render(layers, s, tx, ty):
    """Composite the layers (bottom to top) on the plate."""
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    for l in layers:
        im = l.composite().convert("RGBa")
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS).convert("RGBA")
        x, y = round(l.left * s + tx), round(l.top * s + ty)
        layer = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        sx, sy = max(0, -x), max(0, -y)
        crop = im.crop((sx, sy, min(im.width, CANVAS[0] - x), min(im.height, CANVAS[1] - y)))
        layer.alpha_composite(crop, dest=(max(0, x), max(0, y)))
        out.alpha_composite(layer)
    return out


def bounds(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return {"left": bb[0], "top": bb[1], "right": bb[2], "bottom": bb[3]}


def build(psd_name, s, foot_y):
    psd = PSDImage.open(f"{CAPPED}/{psd_name}")
    slots = classify(psd)
    tx, ty = transform(slots, s, foot_y)
    parts = {slot: render(slots[slot], s, tx, ty) for slot in ("diptube", "sprayer", "overcap")}
    b = slots["bottle"][0].bbox
    bottle = {"left": b[0] * s + tx, "top": b[1] * s + ty, "right": b[2] * s + tx, "bottom": b[3] * s + ty}
    return parts, bottle, slots, (tx, ty)


def calibrate(kits):
    """Scale from the reference kits' bottle bounds; foot from their mean."""
    ss, feet = [], []
    for sku, name in REFERENCE.items():
        slots = classify(PSDImage.open(f"{CAPPED}/{name}"))
        b = slots["bottle"][0].bbox
        body = next(p for p in kits["rows"][sku]["parts"] if p["slot"] == "body")["bounds"]
        ss.append((body["right"] - body["left"]) / (b[2] - b[0]))
        feet.append(body["bottom"])
    return float(np.mean(ss)), float(np.mean(feet))


def check(kits, s, foot_y):
    worst = 0
    for sku, name in REFERENCE.items():
        parts, _, _, _ = build(name, s, foot_y)
        for p in kits["rows"][sku]["parts"]:
            if p["slot"] not in parts:
                continue
            got = bounds(parts[p["slot"]])
            err = max(abs(got[k] - p["bounds"][k]) for k in got)
            worst = max(worst, err)
            print(f"  {sku} {p['slot']:8} kit {p['bounds']} rebuilt {got} max error {err:.1f}px")
    return worst


def save_part(im, slot):
    buf = io.BytesIO()
    im.save(buf, "WEBP", lossless=True)
    data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(PARTS_DIR, exist_ok=True)
    path = f"{PARTS_DIR}/{sha}.{slot}.webp"
    open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": CANVAS[0], "height": CANVAS[1]}


def main():
    kits = json.load(open(KITS))
    s, foot_y = calibrate(kits)
    print(f"scale {s:.5f}  foot {foot_y:.2f}")
    worst = check(kits, s, foot_y)
    print(f"worst reference error {worst:.1f}px")
    if "--write" not in sys.argv:
        return
    assert worst <= 6, "transform does not reproduce the reviewed kits"
    template = kits["rows"]["GBElg30SpryMattGl"]
    tbody = next(p for p in template["parts"] if p["slot"] == "body")
    for sku, name in TARGETS.items():
        parts, bottle, slots, _ = build(name, s, foot_y)
        # Fit the shared clear candidate over this PSD's bottle, as the reviewed kits do.
        k = (bottle["bottom"] - bottle["top"]) / (tbody["bounds"]["bottom"] - tbody["bounds"]["top"])
        box = {key: tbody["box"][key] * k for key in ("width", "height")}
        box["x"] = (bottle["left"] + bottle["right"]) / 2 - ((tbody["bounds"]["left"] + tbody["bounds"]["right"]) / 2 - tbody["box"]["x"]) * k
        box["y"] = bottle["bottom"] - (tbody["bounds"]["bottom"] - tbody["box"]["y"]) * k
        body = json.loads(json.dumps(tbody))
        body["box"] = {key: round(box[key], 2) for key in ("x", "y", "width", "height")}
        body["bounds"] = {key: round(bottle[key], 2) for key in ("left", "right", "top", "bottom")}
        new_parts = [body]
        for z, slot in enumerate(("diptube", "sprayer", "overcap"), start=1):
            ref = next(p for p in template["parts"] if p["slot"] == slot)
            part = json.loads(json.dumps(ref))
            part["image"] = save_part(parts[slot], slot)
            part["bounds"] = bounds(parts[slot])
            part["zOrder"] = z
            new_parts.append(part)
        row = json.loads(json.dumps(template))
        row["sku"] = sku
        row["parts"] = new_parts
        row["plateSha256"] = ""
        tube = next(p for p in new_parts if p["slot"] == "diptube")
        row["anchors"]["seatY"] = tube["bounds"]["bottom"]  # the clear kits record the tube floor here
        # Same scaler landmark rule as the other clear kits: the candidate's neck base mapped through the box.
        a = np.asarray(Image.open("public" + body["image"]["url"]).convert("RGBA"))[..., 3] > 40
        w = a.sum(axis=1); rows = np.where(w > 0)[0]; top = rows.min(); neckw = np.median(w[top + 15:top + 60])
        base = int(min(r for r in rows if r > top + 20 and w[r] > neckw * 1.15))
        landmark = body["box"]["y"] + base * body["box"]["height"] / body["image"]["height"]
        row["glassSizing"] = {**template["glassSizing"], "landmarkY": round(landmark, 2)}
        row["source"] = {"psd": f"4.  15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30/{name}",
                         "skippedLayers": slots["skipped"], "builtBy": "scripts/elegant30/build-clear-sprayer-kits.py"}
        kits["rows"][sku] = row
        if sku not in kits["defaultPdpSkus"]:
            kits["defaultPdpSkus"].append(sku)
        print(f"built {sku} from {name}: body {body['bounds']} landmark {landmark:.1f}; skipped {slots['skipped']}")
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("version", kits["version"])


if __name__ == "__main__":
    main()
