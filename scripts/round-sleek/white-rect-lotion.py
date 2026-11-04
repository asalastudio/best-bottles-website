"""Kits for the three Sleek white rectangle lotion pumps with clear overcap (LBSlk30/50/100WhtRectClOverCap).

The register has no kit for them. As for the Elegant white treatment pumps (scripts/elegant-masters/
white-lotion-kits-60-100.py, whose helpers this uses): each kit starts from the same size's clear-overcap lotion
kit and swaps in the PSD's pump and its clear rectangular overcap, drawn as the empty cover (Sunburst redraws the
cover cut from the cap-on layer without the pump inside), so the pump never prints twice.

Differences from Elegant:
- Only the 30 ml PSD (46.) has the pump on its own layer; the 50 and 100 ml PSDs hold the capped pump only. Their
  pump is the same 18-415 pump, placed inside their own cap-on layer as the 30 ml PSD places it inside its own.
- The Sleek 50 ml bottle layer carries a white smear down one side, so each bottle is measured on its largest solid
  piece: top and foot from its rows, the axis from its neck.

Run after build-kits.mts and before seat-and-tubes.py (which seats them and draws the lotion tube).
Usage: python3 scripts/round-sleek/white-rect-lotion.py <work-dir>
"""
import copy, glob, hashlib, importlib.util, json, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage

spec = importlib.util.spec_from_file_location("elegant_white", "scripts/elegant-masters/white-lotion-kits-60-100.py")
W = importlib.util.module_from_spec(spec); spec.loader.exec_module(W)
W.OUT = "public/local-kits/round-sleek-masters-2026-11-03/white-rect"
W.COVER_PROMPT = W.COVER_PROMPT.replace("square clear overcap shell", "rectangular clear overcap shell")

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles"
KITS = "public/local-kits/round-sleek-masters-2026-11-03/kits.json"
PUMP_PSD = ("46. LBSlk30WhtRectClOverCap.psd", "Layer 32", "Layer 2 copy", "Layer 1 copy")    # bottle, pump, cap-on
CAPPED = {"30": ("46. LBSlk30WhtRectClOverCap.psd", "Layer 32", "Layer 1 copy"),
          "50": ("51. LBSlk50WhtRectClOverCap.psd", "new", "Layer 1 copy"),
          "100": ("51. LBSlk100WhtRectClOverCap.psd", "Layer 4", "Layer 1 copy")}
SKUS = {"30": ("LBSlk30WhtRectClOverCap", "LBSlk30LtnClOvrCap"), "50": ("LBSlk50WhtRectClOverCap", "LBSlk50LtnClOvrCap"),
        "100": ("LBSlk100WhtRectClOverCap", "LBSlk100LtnClOvrCap")}


def open_psd(name):
    p = PSDImage.open(sorted(glob.glob(f"{ROOT}/**/{name}", recursive=True))[0])
    return p, {l.name: l for l in p.descendants()}


def piece(layer):
    """The layer cropped to its alpha, with its absolute top-left."""
    im = layer.composite().convert("RGBA"); bb = im.getchannel("A").getbbox()
    return im.crop(bb), (layer.bbox[0] + bb[0], layer.bbox[1] + bb[1])


def bottle_frame(layer, size):
    """(top, foot, axis) of the bottle in PSD px: its largest solid piece within the canvas (the Sleek 50 ml smear runs
    past the canvas foot), the axis from its neck."""
    im = Image.new("RGBA", size, (0, 0, 0, 0)); im.alpha_composite(layer.composite().convert("RGBA"), (max(0, layer.bbox[0]), max(0, layer.bbox[1])))
    a = np.asarray(im)[..., 3] > 200
    lab, n = ndimage.label(a); keep = lab == (1 + int(np.argmax(ndimage.sum(a, lab, range(1, n + 1)))))
    ys = np.where(keep.any(1))[0]; top = int(ys.min())
    neck = [np.where(keep[y])[0] for y in range(top, top + 40)]
    axis = float(np.median([(r.min() + r.max() + 1) / 2 for r in neck]))
    # The foot: the last row where the glass spans the axis (the smear stands beside the bottle, not under it).
    col = keep[:, int(round(axis))]; foot = int(np.where(col)[0].max()) + 1
    return top, foot, axis


def as_part(img, xy, frame, name, source):
    top, foot, axis = frame; h = foot - top
    # Pump and cover are coaxial with the neck: centre them on the axis (the 50 ml smear pulls a measured axis aside).
    return {"image": W.save(img, name), "layer": img, "h": h, "source": source,
            "left": -img.width / 2 / h, "top": (xy[1] - top) / h, "width": img.width / h, "height": img.height / h}


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True)
    if os.path.isdir(W.OUT):                                  # psd_tools' bytes vary run to run: start clean
        for old in os.listdir(W.OUT):
            os.remove(f"{W.OUT}/{old}")
    kits = json.load(open(KITS)); rows = kits["rows"]
    # The pump inside the 30 ml cover, as a box relative to that cover.
    _, named = open_psd(PUMP_PSD[0])
    pump_img, pump_xy = piece(named[PUMP_PSD[2]]); cap30_img, cap30_xy = piece(named[PUMP_PSD[3]])
    for size, (name, bottle_name, cap_name) in CAPPED.items():
        psd, named = open_psd(name)
        frame = bottle_frame(named[bottle_name], psd.size)
        cap_img, cap_xy = piece(named[cap_name])
        r = cap_img.width / cap30_img.width
        p_img = pump_img.resize((round(pump_img.width * r), round(pump_img.height * r)), Image.LANCZOS)
        p_xy = (cap_xy[0] + (pump_xy[0] - cap30_xy[0]) * r, cap_xy[1] + (pump_xy[1] - cap30_xy[1]) * r)
        parts = {"pump": as_part(p_img, p_xy, frame, f"pump-{size}", f"{PUMP_PSD[0]} :: {PUMP_PSD[2]}" + ("" if size == "30" else f", placed in {name}")),
                 "overcap": as_part(cap_img, cap_xy, frame, f"capon-{size}", f"{name} :: {cap_name}")}
        cover_img, frac = W.empty_cover(size, parts["pump"], parts["overcap"], work)
        sku, template = SKUS[size]
        kit = copy.deepcopy(rows[template])
        d = kit["register"]["datum"]; H = d["baselineY"] - d["seatY"]
        for part in kit["parts"]:
            src = parts.get(part["slot"])
            if not src:
                continue
            box = {"x": round(d["axisX"] + src["left"] * H, 3), "y": round(d["seatY"] + src["top"] * H, 3),
                   "width": round(src["width"] * H, 3), "height": round(src["height"] * H, 3)}
            part.update({"image": dict(src["image"]), "image2x": None, "mask": None, "box": box, "derivation": "psd-layer",
                         "componentId": f"PSD-SLK-WHTRECT-LTN", "source": src["source"],
                         "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
            part.pop("detached", None); part.pop("blendMode", None)
            if part["slot"] == "overcap":
                cb = {**box, "height": round(box["height"] * frac, 3)}
                cover = W.save(cover_img, f"cover-empty-{size}")
                cbounds = {"left": cb["x"], "top": cb["y"], "right": round(cb["x"] + cb["width"], 3), "bottom": round(cb["y"] + cb["height"], 3)}
                part.update({"image": dict(cover), "box": cb, "bounds": cbounds, "source": part["source"] + " (cover above the collar, emptied by Sunburst)"})
                part["detached"] = {"image": {k: v for k, v in cover.items() if k in ("url", "width", "height")}, "box": dict(cb), "bounds": dict(cbounds)}
        for p in kit["parts"]:
            if p["slot"] == "diptube":
                p["componentId"] = "PSD-SLK-WHTRECT-LTN"
        kit["sku"] = sku
        kit["register"] = {**kit["register"], "componentIds": ["PSD-SLK-WHTRECT-LTN"], "seatSignature": None}
        kit["source"] = {"template": template, "psd": {slot: src["source"] for slot, src in parts.items()}}
        rows[sku] = kit
        if sku not in kits["defaultPdpSkus"]:
            kits["defaultPdpSkus"].append(sku)
        print(size, sku, "frame", [round(v, 1) for v in frame])
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("version", kits["version"])


if __name__ == "__main__":
    main()
