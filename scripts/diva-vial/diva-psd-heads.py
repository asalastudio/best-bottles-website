"""Diva's own sprayer and lotion pump heads and overcaps, from the master library PSDs.

Jordan (3 Nov 2026): the 46 ml Diva spray "needs to be fixed". The register draws the generic 18-415 sprayer and
pump, whose long collar is made for long-necked bottles: seated on Diva's very short neck it stands far above the
glass (the copper collar 0.59 of the glass's height against 0.34 in the Diva photograph). Every Diva spray and lotion
SKU has a "parked" PSD in the master library (2. 18-415 Bottles / 23.-27. Diva ...): the bottle, the head on its
neck and the overcap standing beside it. Each kit takes that head and that overcap:
- placed by the PSD's own bottle: neck top on the stage seat, foot on the baseline, centred on the axis;
- the overcap seated over the head, its foot on the head's collar foot (as in the capped PSDs) and centred;
- the white film flap above a cap's top trimmed;
- a clear lotion cover multiplied, so the one pump shows through it; it parks as itself (no separate parked look).
Kits whose SKU has no parked PSD keep the register's parts. seat-and-tubes.py then seats the head on the shoulder
and moves the overcap with it. Run after build-kits.mts and diva-ring-kits.py.
Usage: python3 scripts/diva-vial/diva-psd-heads.py
"""
import glob, hashlib, io, json, os
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/2.  18-415 Bottles "
KITS = "public/local-kits/diva-masters-2026-11-03/kits.json"
OUT = "public/local-kits/diva-masters-2026-11-03/heads"


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def prune(folder, rows):
    """Remove only the files in `folder` that no row references any more (after the rows are built, so a failed run
    leaves the committed manifest's files in place)."""
    keep = {p["image"]["url"].rsplit("/", 1)[1] for kit in rows.values() for p in kit["parts"]
            if isinstance(p.get("image"), dict) and p["image"].get("url", "").startswith("/" + folder.removeprefix("public/") + "/")}
    for old in os.listdir(folder):
        if old not in keep:
            os.remove(f"{folder}/{old}")


def piece(layer, size):
    c = Image.new("RGBA", size, (0, 0, 0, 0)); c.alpha_composite(layer.composite().convert("RGBA"), (max(0, layer.bbox[0]), max(0, layer.bbox[1])))
    bb = c.getchannel("A").getbbox(); return c.crop(bb), bb


def without_flap(img):
    """The overcap photographs carry a white flap of film above the cap's top: keep the cap from its first full row."""
    import numpy as np
    a = np.asarray(img).astype(int); solid = (a[..., 3] > 200) & (a[..., :3].min(axis=2) < 225)   # coloured, not white
    widths = solid.sum(1); top = int(np.argmax(widths >= 0.85 * widths.max()))
    a[:top, :, 3] = 0
    out = Image.fromarray(a.astype("uint8")); return out.crop(out.getchannel("A").getbbox())


def parked(sku, psds):
    """(bottle bbox, head, head bbox, cover, cover bbox) from the SKU's PSD that parks the overcap beside the bottle."""
    for f in psds.get(sku, []):
        p = PSDImage.open(f)
        layers = [l for l in p.descendants() if l.kind == "pixel" and l.visible and l.bbox[2] - l.bbox[0] < p.width * 0.95]
        if len(layers) != 3:
            continue
        bottle = max(layers, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]))
        rest = [l for l in layers if l is not bottle]
        cx = (bottle.bbox[0] + bottle.bbox[2]) / 2
        cover = next((l for l in rest if l.bbox[0] > cx and l.bbox[3] > bottle.bbox[3] - 60), None)
        head = next((l for l in rest if l is not cover), None)
        if cover is None or head is None:
            continue
        b_img, bb = piece(bottle, p.size); h_img, hb = piece(head, p.size); c_img, cb = piece(cover, p.size)
        return bb, h_img, hb, c_img, cb, os.path.basename(f)
    return None


def main():
    psds = {}
    for f in glob.glob(f"{ROOT}/2[3-7]. Diva*/**/*.psd", recursive=True):
        psds.setdefault(os.path.basename(f).split(". ", 1)[-1].strip().removesuffix(".psd").rstrip("."), []).append(f)
    kits = json.load(open(KITS)); rows = kits["rows"]; done = []
    for sku, kit in rows.items():
        head_part = next((p for p in kit["parts"] if p["slot"] in ("sprayer", "pump")), None)
        cover_part = next((p for p in kit["parts"] if p["slot"] == "overcap"), None)
        if head_part is None or cover_part is None:
            continue
        found = parked(sku, psds)
        if not found:
            continue
        bb, h_img, hb, c_img, cb, name = found
        if "ClOvr" not in sku:                       # a clear cover has no film flap and no solid colour to measure
            trimmed = without_flap(c_img); c_img = trimmed
        top, foot, axis = bb[1], bb[3], (bb[0] + bb[2]) / 2
        d = kit["register"]["datum"]; s = (d["baselineY"] - d["seatY"]) / (foot - top)
        hbox = {"x": round(d["axisX"] + (hb[0] - axis) * s, 3), "y": round(d["seatY"] + (hb[1] - top) * s, 3),
                "width": round(h_img.width * s, 3), "height": round(h_img.height * s, 3)}
        # The cover seated over the head: its foot on the head's collar foot, centred on the head.
        cw, ch = c_img.width * s, c_img.height * s
        cbox = {"x": round(hbox["x"] + hbox["width"] / 2 - cw / 2, 3), "y": round(hbox["y"] + hbox["height"] - ch, 3),
                "width": round(cw, 3), "height": round(ch, 3)}
        for part, img, box, tag in ((head_part, h_img, hbox, "head"), (cover_part, c_img, cbox, "cover")):
            part.update({"image": save(img, f"{sku}-{tag}"), "image2x": None, "mask": None, "box": box, "derivation": "psd-layer",
                         "source": f"{name} ({tag})",
                         "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
        cover_part.pop("detached", None)
        if "ClOvr" in sku:
            cover_part["blendMode"] = "multiply"
        else:
            cover_part.pop("blendMode", None)
        done.append(sku)
    if os.path.isdir(OUT):
        prune(OUT, rows)
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print(len(done), "Diva kits on their own PSD head and overcap; version", kits["version"])


if __name__ == "__main__":
    main()
