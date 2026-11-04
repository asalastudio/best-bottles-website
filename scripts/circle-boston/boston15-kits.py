"""Boston Round 15 ml (18-400) review kits from the original Photoshop sources.

The register has no 15 ml Boston Round, so its 16 production SKUs (amber, cobalt and clear; droppers and
short black caps) are drawn from the master library's capped PSDs, one per SKU:
- One master glass per colour on one outline (regenerate-boston15.py), neck top on the stage seat, foot on
  the baseline, at the 30 and 60 ml kits' px/mm and the size's bare height (68 mm, catalog-scale).
- Each SKU's own dropper or cap layer, placed by its own PSD's bottle (largest piece of the bottle layer;
  the amber and cobalt layers carry stray white patches past their canvas).
- The glass pipette of the clear PSD for every dropper, seen through the glass: multiplied in amber and
  cobalt; it lifts with the dropper in EXPLODED. The plain white droppers are the master library's clean
  standalone 18-400 white dropper, at the black dropper's collar.
- Sized from the shoulder, as the register sizes Boston Round: the first row 92% of the glass's width.

Writes public/local-kits/boston-masters-2026-11-03/kits.json.
Usage: python3 scripts/circle-boston/boston15-kits.py <boston-prod.json from production-variants.mts>
"""
import glob, hashlib, io, json, os, re, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/1.  20-400 (1 oz & 2 oz) the 15ml 18-400 Boston Round/1. Boston Round  Dropper Bottles/5.  (.5 ounce:15ml) Boston Round (Capped)"
DIR = "public/local-kits/boston-masters-2026-11-03"
OUT = f"{DIR}/boston15"
SCALE = json.load(open("src/lib/register/catalog-scale.generated.json"))["boston-round-15ml-18-400"]
W, H, AXIS, BASE, PX_PER_MM = 1000, 1100, 500, 1061, 9.87     # the 30/60 ml register kits' px/mm
BARE_PX = round(SCALE["heightBareMm"] * PX_PER_MM)
SEAT = BASE - BARE_PX
SHOULDER = 0.92
RIM_COVER = 2                   # px a collar's top reaches above the glass rim
THROUGH_GLASS = 2.6              # how much darker the pipette's walls read through amber and cobalt glass
GLASS = {"Amb": ("amber", "Amber"), "Blu": ("cobalt", "Cobalt Blue"), "": ("clear", "Clear")}
PSDS = {os.path.basename(f).split(". ", 1)[1].strip().removesuffix(".psd"): f for f in glob.glob(f"{ROOT}/**/*.psd", recursive=True)}


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.startswith(name + "."):
            os.remove(f"{OUT}/{old}")
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def pieces(psd):
    """(layer image cropped to its alpha, absolute top-left) per layer, clipped to the canvas, largest piece only."""
    p = PSDImage.open(psd); out = []
    for l in p.descendants():
        if l.kind != "pixel" or not l.visible or l.bbox[2] - l.bbox[0] >= p.width * 0.98 and l.bbox[0] <= 0:
            continue
        c = Image.new("RGBA", p.size, (0, 0, 0, 0)); c.alpha_composite(l.composite().convert("RGBA"), (max(0, l.bbox[0]), max(0, l.bbox[1])))
        a = np.asarray(c)[..., 3] > 128
        if not a.any():
            continue
        labels, n = ndimage.label(a)
        keep = labels == (1 + int(np.argmax(ndimage.sum(a, labels, range(1, n + 1)))))
        arr = np.asarray(c).copy(); arr[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=2), arr[..., 3], 0)
        img = Image.fromarray(arr); bb = img.getchannel("A").getbbox()
        out.append((l.name, img.crop(bb), (bb[0], bb[1])))
    return out


WHITE = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/Boston Rnd Bottles 20-400 (1oz and 2oz) + 18-400 half oz/20-400 and 18-400 Droppers only images/1. 18-400Drp15mlWhiteBulb.psd"


_white = {}


def collar(img):
    """(width, centre x, bottom y) of a dropper's collar in its image: the widest band at its foot."""
    m = np.asarray(img)[..., 3] > 128; ys = np.where(m.any(1))[0]; bottom = int(ys.max()) + 1
    rows = [np.where(m[y])[0] for y in range(bottom - max(8, img.height // 12), bottom) if m[y].any()]
    left = float(np.median([r.min() for r in rows])); right = float(np.median([r.max() for r in rows])) + 1
    return right - left, (left + right) / 2, bottom


def white_dropper(black_part):
    """Jordan (3 Nov 2026): the capped PSDs' plain white dropper carries white flaps of its cut-out beside the collar.
    The master library's standalone 18-400 white dropper (bulb and collar layer) is clean: draw it at the plain black
    dropper's collar width, its collar on the same collar line and axis."""
    if "img" not in _white:                          # composited once: psd_tools' bytes vary run to run
        l = {x.name: x for x in PSDImage.open(WHITE).descendants()}["Layer 1"]
        img = l.composite().convert("RGBA"); _white["img"] = img.crop(img.getchannel("A").getbbox())
        _white["image"] = save(_white["img"], "dropper-white-18-400")
    img = _white["img"]
    black = Image.open("public" + black_part["image"]["url"]).convert("RGBA")
    bw, bx, bb = collar(black); k = black_part["box"]["width"] / black.width
    ww, wx, wb = collar(img); s = bw * k / ww
    image = _white["image"]
    # Its collar is ~2 mm shorter than the capped photographs': on their collar line its top sat under the glass
    # rim, which showed beside the bulb (Jordan, 3 Nov 2026). Its collar's top covers the rim instead, which seats
    # its foot on the neck bead.
    m = np.asarray(img)[..., 3] > 128; widths = m.sum(1); top = int(np.where(widths >= 0.85 * widths.max())[0].min())
    box = {"x": round(black_part["box"]["x"] + bx * k - wx * s, 3), "y": round(SEAT - RIM_COVER - top * s, 3),
           "width": round(img.width * s, 3), "height": round(img.height * s, 3)}
    return image, box


def part(slot, image, xy, frame, z, explode, component, views=None):
    s, ox, oy = frame
    box = {"x": round(AXIS + (xy[0] - ox) * s, 3), "y": round(SEAT + (xy[1] - oy) * s, 3),
           "width": round(image["width"] * s, 3), "height": round(image["height"] * s, 3)}
    p = {"slot": slot, "variantKey": None, "zOrder": z, "explodeIndex": explode,
         "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)},
         "assembled": {"x": 0, "y": 0}, "exploded": {"dx": 0, "dy": 0}, "image": image, "image2x": None, "mask": None,
         "derivation": "psd-layer", "box": box, "componentId": component}
    if views:
        p["views"] = views
    return p


def frame_of(bottle):
    """Scale and origin mapping this PSD's bottle (neck top to foot) onto the stage datum."""
    _, img, (x, y) = bottle
    return (BARE_PX / img.height, x + img.width / 2, y)


def main():
    prod = [v for v in json.load(open(sys.argv[1])) if v["capacityMl"] == 15]
    masters = {}
    for code, (colour, _) in GLASS.items():
        img = Image.open(f"{DIR}/boston15-master/{colour}.png").convert("RGBA")
        masters[code] = (save(img, f"body-boston-round-15ml-18-400-{colour}"), img)
    outline = masters[""][1]
    s0 = BARE_PX / outline.height
    widths = (np.asarray(outline)[..., 3] > 40).sum(1)
    landmark = round(SEAT + int(np.argmax(widths >= SHOULDER * widths.max())) * s0, 2)
    # The clear PSD's glass pipette, placed by that PSD's bottle.
    clear = pieces(PSDS["GBBstn15BlkDrp"])
    clear_bottle = max(clear, key=lambda t: t[1].width * t[1].height)
    tube = next(t for t in clear if t[1].width < 80 and t[1].height > 400)
    pipette_img = save(tube[1], "pipette-18-400")
    a = np.asarray(tube[1]).astype(np.float32)
    dark = 255 - (255 - a[..., :3]) * THROUGH_GLASS
    through_glass = save(Image.fromarray(np.dstack([dark.clip(0, 255), a[..., 3]]).astype(np.uint8)), "pipette-18-400-through-glass")
    rows = {}
    for v in prod:
        sku = v["websiteSku"]
        psd = PSDS.get(sku) or PSDS.get(sku.replace("Drpr", "Drp"))
        if not psd:
            print("no PSD for", sku); continue
        code = "Amb" if "Amb" in sku else "Blu" if "Blu" in sku else ""
        colour, glass = GLASS[code]
        found = pieces(psd)
        bottle = max(found, key=lambda t: t[1].width * t[1].height)
        rest = [t for t in found if t is not bottle and not (t[1].width < 80 and t[1].height > 400)]
        closure = max(rest, key=lambda t: t[1].width * t[1].height)
        frame = frame_of(bottle)
        body_img = masters[code][0]
        body = part("body", body_img, (0, 0), (s0, outline.width / 2, 0), 1, 0, None)
        finish = sku.split("15", 1)[1].removeprefix("ml")
        if "Cap" in sku:
            comp = "PSD-BSTN15-CAP-BLK"
            parts = [body, part("cap", save(closure[1], f"cap-{colour}-{finish}"), closure[2], frame, 2, 1, comp)]
        else:
            comp = f"PSD-BSTN15-DRP-{finish.upper()}"
            fit = part("fitment", save(closure[1], f"dropper-{colour}-{finish}"), closure[2], frame, 3, 1, comp)
            # Jordan (3 Nov 2026): the glass applicator shows behind the glass. Seated over the body and multiplied,
            # the clear pipette darkens with the amber or cobalt glass around it, as a glass tube seen through it does.
            seated = part("pipette", pipette_img, tube[2], frame_of(clear_bottle), 2, 1, comp)
            if code:
                # The clear photograph is near white, which multiplies to nothing on amber or cobalt: draw its walls
                # THROUGH_GLASS times darker (multiplied, the tube reads as the glass's own deeper tone).
                seated.update({"blendMode": "multiply", "image": through_glass})
            parts = sorted([body, seated, fit], key=lambda p: p["zOrder"])
        body["bounds"] = {"left": body["box"]["x"], "right": round(body["box"]["x"] + body["box"]["width"], 3), "top": SEAT, "bottom": BASE}
        rows[sku] = {"sku": sku, "familyId": f"register:boston-round-15ml-18-400|{glass}", "plateSha256": "", "canvas": {"width": W, "height": H},
                     "anchors": {"axisX": AXIS, "neckAxisX": AXIS, "seatY": SEAT, "baselineY": BASE, "pxPerMm": PX_PER_MM},
                     "completeness": "full", "parts": parts, "three": None, "conflicts": [],
                     "register": {"bodyId": "boston-round-15ml-18-400", "plateKey": f"boston-round-15ml-18-400|{glass}", "glass": glass,
                                  "datum": {"axisX": AXIS, "seatY": SEAT, "baselineY": BASE}, "pxPerMm": PX_PER_MM, "componentIds": [comp],
                                  "source": psd.removeprefix(ROOT + "/")},
                     "glassSizing": {"heightPct": SCALE["targetPct"], "baselinePct": SCALE["baselinePct"], "landmarkY": landmark, "source": SCALE["source"]}}
    for sku, kit in rows.items():
        if not re.search(r"WhtDr(?:op)?pe?r?$|WhtDrp$", sku):
            continue
        black = next((k for s_, k in rows.items() if s_ != sku and k["register"]["glass"] == kit["register"]["glass"]
                      and re.search(r"Blk(?:Dropper|Drpr|Drp)$", s_)), None)
        black = black or rows["GBBstnAmb15mlBlkDropper"]
        image, box = white_dropper(next(p for p in black["parts"] if p["slot"] == "fitment"))
        fit = next(p for p in kit["parts"] if p["slot"] == "fitment")
        fit.update({"image": image, "box": box, "source": "Droppers only images/1. 18-400Drp15mlWhiteBulb.psd (Layer 1)",
                    "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
    used = {p["image"]["url"].rsplit("/", 1)[1] for k in rows.values() for p in k["parts"]}
    for name in os.listdir(OUT):                    # the replaced plain white dropper layers
        if name not in used:
            os.remove(f"{OUT}/{name}")
    version = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    os.makedirs(DIR, exist_ok=True)
    json.dump({"version": version, "rows": rows, "defaultPdpSkus": sorted(rows)}, open(f"{DIR}/kits.json", "w"), indent=1)
    open(f"{DIR}/kits.json", "a").write("\n")
    print(f"Boston Round 15 ml: {len(rows)} kits of {len(prod)}, landmark {landmark}, version {version}")


if __name__ == "__main__":
    main()
