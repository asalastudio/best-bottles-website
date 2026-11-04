"""Circle 30 ml (15-415) review kits from the original Photoshop sources.

The register has no Circle 30 ml kit, so the seven production SKUs (five fine-mist sprayers, two caps)
are drawn from their own PSDs (15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml, one per SKU):
- One master glass for every SKU: the bottle layer of 1. GBCrcl30SpryBlk (regenerated as clear glass by
  regenerate-circle30.py), neck top on the stage seat,
  foot on the baseline, centred on the axis, at the size's bare height (74 mm, catalog-scale).
- Each SKU's own closure layers, placed by its PSD's bottle: the sprayer head (with its small detail
  layers) and its overcap, or the cap.
- A placeholder dip tube, so seat-and-tubes.py draws the PSD tube of 30 ml (psd-tubes.py "30-spray").
Rows are added to the Circle kits; run after build-circle-kits.mts and before seat-and-tubes.py.
Usage: python3 scripts/circle-boston/circle30-kits.py
"""
import hashlib, io, json, os
import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml"
KITS = "public/local-kits/circle-masters-2026-11-03/kits.json"
OUT = "public/local-kits/circle-masters-2026-11-03/circle30"
SCALE = json.load(open("src/lib/register/catalog-scale.generated.json"))["circle-30ml-15-415"]
SKUS = {"GBCrcl30SpryBlk": "1. GBCrcl30SpryBlk.psd", "GBCrcl30SpryShnGl": "2. GBCrcl30SpryShnGl.psd",
        "GBCrcl30SpryShSl": "3. GBCrcl30SpryShSl.psd", "GBCrcl30SpryMattSl": "4. GBCrcl30SpryMattSl.psd",
        "GBCrcl30SpryMattGl": "5. GBCrcl30SpryMattGl.psd", "GBCrcl30SlCap": "6. GBCrcl30SlCap..psd", "GBCrcl30GlCap": "7. GBCrcl30GlCap..psd"}
W, H, AXIS, BASE = 1000, 1100, 500, 1061
BARE_PX = 800                                     # neck top to foot on the kit canvas
PX_PER_MM = round(BARE_PX / SCALE["heightBareMm"], 3)
SEAT = BASE - BARE_PX


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.startswith(name + "."):
            os.remove(f"{OUT}/{old}")
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def layers(psd):
    p = PSDImage.open(f"{ROOT}/{psd}")
    pixel = [l for l in p.descendants() if l.kind == "pixel" and l.visible and (l.bbox[2] - l.bbox[0]) < p.width * 0.95]
    out = []
    for l in pixel:
        im = l.composite().convert("RGBA"); bb = im.getchannel("A").getbbox()
        if bb:
            out.append((l, im.crop(bb), (l.bbox[0] + bb[0], l.bbox[1] + bb[1])))
    return out


def part(slot, image, xy, frame, z, explode, component, derivation="psd-layer"):
    s, ox, oy = frame
    box = {"x": round(AXIS + (xy[0] - ox) * s, 3), "y": round(SEAT + (xy[1] - oy) * s, 3),
           "width": round(image["width"] * s, 3), "height": round(image["height"] * s, 3)}
    return {"slot": slot, "variantKey": None, "zOrder": z, "explodeIndex": explode,
            "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)},
            "assembled": {"x": 0, "y": 0}, "exploded": {"dx": 0, "dy": 0}, "image": image, "image2x": None, "mask": None,
            "derivation": derivation, "box": box, "componentId": component}


def main():
    kits = json.load(open(KITS)); rows = kits["rows"]
    master = layers(SKUS["GBCrcl30SpryBlk"])
    bottle = max(master, key=lambda t: t[1].width * t[1].height)
    # The regenerated master (regenerate-circle30.py: clear glass, cut with this layer's alpha) when present.
    regenerated = "public/local-kits/circle-masters-2026-11-03/circle30-master/circle30-clear-master.png"
    glass = Image.open(regenerated).convert("RGBA") if os.path.exists(regenerated) else bottle[1]
    assert glass.size == bottle[1].size, "The regenerated master must keep the PSD layer's frame"
    body_img = save(glass, "body-circle-30ml-15-415-clear")
    top, foot = bottle[2][1], bottle[2][1] + bottle[1].height
    s = BARE_PX / (foot - top)
    # The neck base: the first row 15% wider than the neck (the landmark the scaler sizes from). The top rows are
    # the narrower rim, so the neck is measured on the thread band (rows 40-160 of the 940 px layer).
    a = np.asarray(bottle[1])[..., 3] > 40; widths = a.sum(1)
    neck = float(np.median(widths[40:160])); row = 40
    while widths[row] <= neck * 1.15:
        row += 1
    landmark = round(SEAT + row * s, 2)
    for sku, psd in SKUS.items():
        found = layers(psd)
        own = max(found, key=lambda t: t[1].width * t[1].height)            # this PSD's bottle places its closures
        frame = (s, own[2][0] + own[1].width / 2, own[2][1])
        rest = [t for t in found if t is not own]
        tube = [t for t in rest if t[1].width < 100 and t[1].height > 400]
        closures = [t for t in rest if t not in tube]
        big = sorted((t for t in closures if t[1].width > 100), key=lambda t: t[1].height)
        details = [t for t in closures if t[1].width <= 100]
        finish = sku.removeprefix("GBCrcl30").removeprefix("Spry").removesuffix("Cap")
        body = part("body", body_img, bottle[2], (s, bottle[2][0] + bottle[1].width / 2, top), 0, 0, None)
        if "Spry" in sku:
            head, cover = big[0], big[-1]
            x0, y0 = head[2]
            canvas = Image.new("RGBA", head[1].size, (0, 0, 0, 0)); canvas.alpha_composite(head[1])
            for d in details:                                                # gloss and actuator-hole layers on the head
                canvas.alpha_composite(d[1], (d[2][0] - x0, d[2][1] - y0))
            comp = f"PSD-CRCL30-SPR-{finish.upper()}"
            sprayer = part("sprayer", save(canvas, f"sprayer-{finish}"), head[2], frame, 2, 1, comp)
            overcap = part("overcap", save(cover[1], f"overcap-{finish}"), cover[2], frame, 3, 2, comp)
            ref = tube[0] if tube else None
            tube_part = part("diptube", {"url": "/local-kits/circle-30ml-15-415-clear-spray.placeholder.png", "width": 1, "height": 1},
                             ref[2] if ref else head[2], frame, 1, 1, comp, "placeholder")
            tube_part["views"] = ["sidecar", "capon"]
            parts, components = [body, tube_part, sprayer, overcap], [comp]
        else:
            comp = f"PSD-CRCL30-CAP-{finish.upper()}"
            cap = part("cap", save(big[-1][1], f"cap-{finish}"), big[-1][2], frame, 1, 1, comp)
            parts, components = [body, cap], [comp]
        body["bounds"] = {"left": body["box"]["x"], "right": round(body["box"]["x"] + body["box"]["width"], 3), "top": SEAT, "bottom": BASE}
        rows[sku] = {"sku": sku, "familyId": "register:circle-30ml-15-415|Clear", "plateSha256": "", "canvas": {"width": W, "height": H},
                     "anchors": {"axisX": AXIS, "neckAxisX": AXIS, "seatY": SEAT, "baselineY": BASE, "pxPerMm": PX_PER_MM},
                     "completeness": "full", "parts": parts, "three": None, "conflicts": [],
                     "register": {"bodyId": "circle-30ml-15-415", "plateKey": "circle-30ml-15-415|Clear", "glass": "Clear",
                                  "datum": {"axisX": AXIS, "seatY": SEAT, "baselineY": BASE}, "pxPerMm": PX_PER_MM,
                                  "componentIds": components, "source": f"PSD 15-415 Bottles/1. Circle Clear 30ml - Capped/{psd}"},
                     "glassSizing": {"heightPct": SCALE["targetPct"], "baselinePct": SCALE["baselinePct"], "landmarkY": landmark,
                                     "source": SCALE["source"]}}
    kits["defaultPdpSkus"] = sorted(set(kits["defaultPdpSkus"]) | set(SKUS))
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print(f"Circle 30 ml: {len(SKUS)} kits, {PX_PER_MM} px/mm, landmark {landmark}")


if __name__ == "__main__":
    main()
