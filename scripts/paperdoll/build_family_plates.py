#!/usr/bin/env python3
"""
Build web-ready paper-doll plates for one bottle family from the PSD master library.

The PSD library ships one flattened studio photograph per (bottle x closure) SKU.
Within a family every plate shares a single pixel scale and a byte-identical bottle
body -- only the canvas crop moves. So registration is a pure translation, recovered
exactly by normalised cross-correlation against a bottle-foot template.

Output: one plate per SKU, all on a common canvas with the bottle pinned to the same
spot, plus a manifest joining each plate to its catalogue row.

Usage: python3 scripts/paperdoll/build_family_plates.py
"""
import csv, glob, json, os, re, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy.signal import fftconvolve
from scipy import ndimage

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB = ("/Users/jordanrichter/Projects/Clients/Nemat-International/"
       "Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images")

# A family is a folder of PSDs plus the SKU stem that identifies its bottle.
# Registration reference and template are derived from the plates themselves,
# so adding a family is a config entry, not a hand-measured rectangle.
FAMILIES = [
    {"id": "diva-46-clear",     "name": "Diva 46 ml — Clear",
     "psd_glob": ("2. 18-415 Bottles", "25*", "1.*PSD"),
     "body": "Diva46",  "neck_finish": "18-415"},
    {"id": "diva-46-frosted",   "name": "Diva 46 ml — Frosted",
     "psd_glob": ("2. 18-415 Bottles", "26*", "1.*PSD"),
     "body": "DivaFrst46", "neck_finish": "18-415"},
    {"id": "cylinder-50ml-clear", "name": "Cylinder 50 ml — Clear",
     "psd_glob": ("2. 18-415 Bottles", "2. Cylindrical 50ml*", "1.*PSD*"),
     "body": "Cyl50",   "neck_finish": "18-415"},
    {"id": "cylinder-100ml-clear", "name": "Cylinder 100 ml — Clear",
     "psd_glob": ("2. 18-415 Bottles", "3. Cylindrical 100ml*", "1.*PSD*"),
     "body": "Cyl100",  "neck_finish": "18-415"},
]

OUT_W, OUT_H = 1000, 1100          # 10:11, matches the PDP hero aspect
PAD = 40

# ---------------------------------------------------------------- SKU grammar
# Longest token first so AnSpTsl beats AnSp and ShnBlkTall beats ShnBlk.
CLOSURES = [
    ("AnSpTsl", "bulb-tassel", "Vintage Bulb Sprayer + Tassel"),
    ("AnSp",    "bulb",        "Vintage Bulb Sprayer"),
    ("Rdcr",    "reducer",     "Reducer + Cap"),
    ("Spry",    "spray",       "Perfume Spray Pump"),
    ("Ltn",     "lotion",      "Lotion Pump"),
    ("Drp",     "dropper",     "Glass Dropper"),
]
COLORS = [
    ("ClOvrCap", "Clear Overcap", "#dfe4e6"), ("LBrwnLthr", "Light Brown Leather", "#b98a5e"),
    ("BrwnLthr", "Brown Leather", "#7a4b2a"), ("BlkLthr", "Black Leather", "#241f1d"),
    ("PnkLthr", "Pink Leather", "#d9a3a8"),   ("IvyLthr", "Ivory Leather", "#e8dcc6"),
    ("ShnBlkTall", "Shiny Black (Tall)", "#15120f"), ("MtSlTall", "Matte Silver (Tall)", "#b9bcc0"),
    ("ShnBlk", "Shiny Black", "#15120f"),     ("ShnGl", "Shiny Gold", "#c9a227"),
    ("ShnSl", "Shiny Silver", "#cfd3d7"),     ("MtGl", "Matte Gold", "#b8973f"),
    ("MtSl", "Matte Silver", "#b9bcc0"),      ("IvyGl", "Ivory + Gold", "#efe3cb"),
    ("IvySl", "Ivory + Silver", "#eceae4"),   ("Lvn", "Lavender", "#b9a7cf"),
    ("Pnk", "Pink", "#e3a7b5"),               ("Red", "Red", "#a52a2a"),
    ("Wht", "White", "#f2f0ec"),              ("Blk", "Black", "#15120f"),
    ("Gl", "Gold", "#c9a227"),                ("Sl", "Silver", "#cfd3d7"),
    ("Cu", "Copper", "#b06a3b"),
]

def parse_sku(stem, body):
    """GBDiva46AnSpTslGl -> (closure_id, closure_label, color_label, swatch)."""
    m = re.match(r"^(?:GB|LB)" + re.escape(body) + r"(.+)$", stem)
    if not m:
        return None                      # bare-bottle plates and other bodies
    rest = m.group(1)
    for token, cid, clabel in CLOSURES:
        if rest.startswith(token):
            tail = rest[len(token):]
            if tail.endswith("Rng"):          # decorative-ring SKUs: not in catalogue
                return None
            for ctok, clr, hexv in COLORS:
                if tail == ctok:
                    return cid, clabel, clr, hexv
            return cid, clabel, tail or "Standard", "#cccccc"
    return None

# ---------------------------------------------------------------- registration
def ncc_offset(patch, target):
    t = target.astype(np.float64)
    p = patch.astype(np.float64); p = p - p.mean()
    num = fftconvolve(t, p[::-1, ::-1], mode="valid")
    ones = np.ones_like(p)
    s1 = fftconvolve(t, ones, mode="valid")
    s2 = fftconvolve(t * t, ones, mode="valid")
    var = s2 - (s1 * s1) / p.size
    var[var < 1e-6] = 1e-6
    score = num / np.sqrt(var)
    iy, ix = np.unravel_index(np.argmax(score), score.shape)
    return int(iy), int(ix), float(score[iy, ix])

def ink_bbox(gray, thr=245):
    ink = gray < thr
    ys, xs = np.where(ink)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

def blob_count(gray, thr=245, min_area=2000):
    lab, n = ndimage.label(gray < thr)
    if n == 0:
        return 0
    return int((np.bincount(lab.ravel())[1:] >= min_area).sum())

# ---------------------------------------------------------------- catalogue
def load_catalog():
    rows = {}
    path = os.path.join(REPO, "Nemat_Product_Catalog.csv")
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            rows[r["websiteSku"]] = r
    return rows

def price_of(row):
    for key in ("webPrice1pc", "qbPrice"):
        v = (row.get(key) or "").strip()
        if v:
            try:
                return float(v)
            except ValueError:
                pass
    return None

def closure_axis(gray):
    """Horizontal centre of the closure -- i.e. the bottle's axis."""
    ink = gray < 245
    ys, _ = np.where(ink)
    y0, y1 = ys.min(), ys.max()
    band = ink[y0:y0 + max(8, int((y1 - y0) * 0.20))]
    cols = np.where(band.any(axis=0))[0]
    return (cols.min() + cols.max()) / 2.0


def verify_output(out_dir, entries):
    """Check the shipped plates against the spec they are framed to.

    A plainly capped bottle is framed on its closure axis, so the check is
    that the closure sits on the canvas centre line -- not that the bottle
    lands at some fixed x. Bulb and tassel plates are framed as whole
    compositions and are excluded by design.
    """
    bad, worst = [], 0.0
    for e in entries:
        if e["closure"] in ("bulb", "bulb-tassel"):
            continue
        a = np.array(Image.open(
            os.path.join(out_dir, f"{e['sku']}.webp")).convert("L"))
        off = abs(closure_axis(a) - OUT_W / 2)
        worst = max(worst, off)
        # The axis is read off a thresholded edge, so it quantises to half a
        # pixel and moves a little on a soft-edged cap like faux leather. Two
        # pixels on a 1000px canvas is a fifth of a percent -- below anything
        # visible, and comfortably inside that noise.
        if off > 2.0:
            bad.append(e["sku"])
    return bad, worst


# ---------------------------------------------------------------- build
def build_family(fam, catalog):
    matches = glob.glob(os.path.join(LIB, *fam["psd_glob"]))
    if not matches:
        print(f"!! {fam['id']}: no PSD folder matched {fam['psd_glob']}", file=sys.stderr)
        return None
    psd_dir = matches[0]

    # 1. flatten every PSD once
    plates = {}   # stem -> dict(gray, rgb, blobs, source)
    for path in sorted(glob.glob(os.path.join(psd_dir, "*.psd"))):
        base = os.path.basename(path)
        stem = base[:-4].split(". ", 1)[-1].strip()
        if parse_sku(stem, fam["body"]) is None:
            continue
        rgb = PSDImage.open(path).composite().convert("RGB")
        gray = np.array(rgb.convert("L"))
        blobs = blob_count(gray)
        shot = {"rgb": rgb, "gray": gray, "blobs": blobs, "source": base,
                "closure": parse_sku(stem, fam["body"])[0]}
        # Pump SKUs ship two shots: the assembly under its overcap (one blob),
        # and the pump exposed with the overcap resting beside it (two blobs).
        # The second is the only way a buyer can see it really is a lotion pump,
        # so keep both and let the PDP toggle between them.
        plates.setdefault(stem, []).append(shot)
    # Within a SKU the shot with fewer separate objects is the assembled one;
    # the extra object in the other shot is the overcap resting beside it.
    # Compared relatively, not against a fixed count -- these plates carry a
    # small constant retouch mark that also registers as its own component.
    for stem, shot_list in plates.items():
        shot_list.sort(key=lambda sh: sh["blobs"])
        plates[stem] = {"on": shot_list[0]}
        if len(shot_list) > 1 and shot_list[-1]["blobs"] > shot_list[0]["blobs"]:
            plates[stem]["off"] = shot_list[-1]
    pairs = sum(1 for v in plates.values() if "off" in v)
    print(f"flattened {len(plates)} unique SKUs from {os.path.basename(psd_dir)}"
          f" ({pairs} with a cap-off shot)")

    # 2. Register every plate against a bottle-foot template.
    #    The reference is chosen, not configured: the narrowest assembled plate
    #    is a plainly capped bottle with nothing hanging off it, so a band
    #    across its lower body and foot is bottle and only bottle -- the one
    #    feature every plate in the family shares.
    shots = [sh for v in plates.values() for sh in v.values()]
    if not shots:
        print(f"!! {fam['id']}: no plates parsed", file=sys.stderr)
        return None
    def width_of(sh):
        x0, _, x1, _ = ink_bbox(sh["gray"])
        return x1 - x0
    assembled = [v["on"] for v in plates.values()]
    # A bulb or tassel hangs off the bottle, so its plate is a poor reference.
    plain = [sh for sh in assembled
             if sh["closure"] not in ("bulb", "bulb-tassel")] or assembled
    ref = min(plain, key=width_of)
    rx0, ry0, rx1, ry1 = ink_bbox(ref["gray"])
    rh = ry1 - ry0
    H, W = ref["gray"].shape
    # The template must straddle the base edge and both side walls. A band of
    # bare body is not enough: a cylinder's lower wall is featureless, so a
    # body-only template slides vertically and the match is meaningless. The
    # glass-to-white boundary at the base plus the two vertical edges give a
    # feature that pins both axes on a smooth bottle as well as a moulded one.
    ty0 = max(0, ry1 - int(rh * 0.22))
    ty1 = min(H, ry1 + max(8, int(rh * 0.02)))
    tx0 = max(0, rx0 - 12)
    tx1 = min(W, rx1 + 12)
    patch = ref["gray"][ty0:ty1, tx0:tx1]
    print(f"  registration reference: {ref['source']}")
    for sh in shots:
        iy, ix, score = ncc_offset(patch, sh["gray"])
        sh["dx"] = ix - tx0          # target = reference + (dx, dy)
        sh["dy"] = iy - ty0
        sh["score"] = score
    # Gate on what actually matters: after alignment, does the reference's
    # bottle region land on identical pixels in every plate? NCC score spread
    # is not a proxy for that -- a template carrying white margin scores
    # differently on plates that are nonetheless perfectly aligned.
    ph, pw = patch.shape
    resid = []
    for sh in shots:
        win = sh["gray"][ty0 + sh["dy"]:ty0 + sh["dy"] + ph,
                         tx0 + sh["dx"]:tx0 + sh["dx"] + pw]
        if win.shape != patch.shape:
            resid.append(255.0)
            continue
        resid.append(float(np.abs(win.astype(np.int16)
                                  - patch.astype(np.int16)).mean()))
    worst = max(resid)
    print(f"registration: worst post-alignment residual {worst:.2f}/255 "
          f"(0 = bottle lands on identical pixels)")
    if worst > 12.0:
        # Every plate in a family is meant to be one photograph of one bottle,
        # so a spread here means the assumption does not hold and the output
        # would be silently misregistered. Refuse the family rather than ship
        # art that drifts.
        print(f"!! {fam['id']}: residual {worst:.2f}/255 -- plates are not a single "
              f"photographic master. Family skipped, nothing written.", file=sys.stderr)
        return None
    # Residual alone is a soft signal: it also picks up genuine differences in
    # the shadow under the bottle between shots. The hard check runs after the
    # plates are written (verify_output), against the shipped files.

    # 3. Vertical framing is shared so the bottle never bobs: measure every
    #    shot's ink in reference space and keep one vertical band. Horizontal
    #    framing is per-plate (step 5) so plain closures sit centred.
    uy0 = 10**9; uy1 = -10**9; max_w = 0
    for sh in shots:
        x0, y0, x1, y1 = ink_bbox(sh["gray"])
        uy0 = min(uy0, y0 - sh["dy"]); uy1 = max(uy1, y1 - sh["dy"])
        max_w = max(max_w, x1 - x0)
    uh = uy1 - uy0
    print(f"shared vertical band {uh}px; widest single plate {max_w}px")

    # 4. One scale for the whole family -- the bottle must be the same size on
    #    every plate -- sized so the widest plate (the tassel) still fits.
    scale = min((OUT_W - 2 * PAD) / max_w, (OUT_H - 2 * PAD) / uh)
    out_dir = os.path.join(REPO, "public", "paper-doll", fam["id"])
    os.makedirs(out_dir, exist_ok=True)

    def cap_axis(gray):
        """Horizontal centre of the closure itself.

        The closure is a cylinder sitting on the neck, so its centre is the
        bottle's axis. The moulded glass is not quite symmetric in these
        photographs -- its bounding box runs a few px wide on the right -- so
        centring the ink box leaves the cap visibly off-centre, and by a
        different amount per closure, which reads as a shift when swapping.
        """
        ink = gray < 245
        ys, xs = np.where(ink)
        y0, y1 = ys.min(), ys.max()
        band = ink[y0:y0 + max(8, int((y1 - y0) * 0.20))]
        cols = np.where(band.any(axis=0))[0]
        return (cols.min() + cols.max()) / 2.0

    def render(sh, name, on_axis):
        """Place one shot: vertical registered to the shared band. Horizontal
        is centred on the closure axis for a plain capped bottle, and on the
        whole composition when something hangs off the bottle (a bulb, a
        tassel, or the overcap resting beside it)."""
        if on_axis:
            ox = OUT_W / 2 - cap_axis(sh["gray"]) * scale
        else:
            x0, _, x1, _ = ink_bbox(sh["gray"])
            ox = (OUT_W - (x1 - x0) * scale) / 2 - x0 * scale
        oy = (PAD - (uy0 + sh["dy"]) * scale
              + ((OUT_H - 2 * PAD) - uh * scale) / 2)
        inv = 1.0 / scale
        # Scale and translate in ONE resampling pass -- resize-then-paste at an
        # integer offset rounds the bottle 1px between plates, which reads as a
        # twitch when the customer swaps.
        canvas = sh["rgb"].transform(
            (OUT_W, OUT_H), Image.AFFINE,
            (inv, 0, -ox * inv, 0, inv, -oy * inv),
            resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        canvas.save(os.path.join(out_dir, f"{name}.webp"), "WEBP",
                    quality=88, method=6)

        # Rail thumbnail: the plate is mostly whitespace, so at 58px the
        # assembly is unreadable. Crop each plate to its own ink instead --
        # the rail tells closures apart, it does not compare scale.
        tx0, ty0, tx1, ty1 = ink_bbox(np.array(canvas.convert("L")))
        side = max(tx1 - tx0, ty1 - ty0) + 24
        cx, cy = (tx0 + tx1) // 2, (ty0 + ty1) // 2
        # Crop onto an explicit white square: it usually overruns the plate
        # edge, and PIL.crop pads out-of-bounds with black.
        square = Image.new("RGB", (side, side), (255, 255, 255))
        square.paste(canvas, (-(cx - side // 2), -(cy - side // 2)))
        square.resize((240, 240), Image.LANCZOS).save(
            os.path.join(out_dir, f"{name}.thumb.webp"), "WEBP",
            quality=82, method=6)

    entries = []
    for stem in sorted(plates):
        shots_for_sku = plates[stem]
        cid, clabel, color, swatch = parse_sku(stem, fam["body"])
        # A plate without a catalogue row still ships: the photograph is
        # real, and it matches by website SKU the moment the catalogue
        # carries the product (the frosted Diva droppers, 2026-09-01).
        row = catalog.get(stem) or {}
        on = shots_for_sku.get("on") or shots_for_sku.get("off")
        off = shots_for_sku.get("off") if "on" in shots_for_sku else None
        # A bulb or tassel hangs well off the bottle, so those compose better
        # centred as a whole; the user reads them as a different composition.
        plain = cid not in ("bulb", "bulb-tassel")
        render(on, stem, on_axis=plain)
        if off:
            render(off, f"{stem}-capoff", on_axis=False)

        entries.append({
            "sku": stem,
            "graceSku": row.get("graceSku") or None,
            "closure": cid,
            "closureLabel": clabel,
            "color": color,
            "swatch": swatch,
            "image": f"/paper-doll/{fam['id']}/{stem}.webp",
            "thumb": f"/paper-doll/{fam['id']}/{stem}.thumb.webp",
            "imageCapOff": (f"/paper-doll/{fam['id']}/{stem}-capoff.webp"
                            if off else None),
            "thumbCapOff": (f"/paper-doll/{fam['id']}/{stem}-capoff.thumb.webp"
                            if off else None),
            "price": price_of(row),
            "stock": row.get("stockStatus") or None,
            "applicator": row.get("applicator") or None,
            "productUrl": row.get("productUrl") or None,
            "capacityMl": row.get("capacityMl") or None,
            "sourcePsd": on["source"],

        })

    order = [c[1] for c in CLOSURES]
    entries.sort(key=lambda e: (order.index(e["closure"]), e["color"]))
    manifest = {
        "id": fam["id"],
        "name": fam["name"],
        "neckFinish": fam["neck_finish"],
        "canvas": {"width": OUT_W, "height": OUT_H},
        "closures": [
            {"id": cid, "label": clabel,
             "count": sum(1 for e in entries if e["closure"] == cid)}
            for _, cid, clabel in CLOSURES
            if any(e["closure"] == cid for e in entries)
        ],
        "variants": entries,
    }
    with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    bad, worst_off = verify_output(out_dir, entries)
    if bad:
        print(f"!! {fam['id']}: {len(bad)} capped plates are off centre: "
              f"{', '.join(bad[:5])}", file=sys.stderr)
    print(f"  wrote {len(entries)} SKUs -> dist/paper-doll/legacy/{fam['id']}/ "
          f"(closure centred within {worst_off:.1f}px on every capped plate)")
    for c in manifest["closures"]:
        print(f"    {c['label']:32s} {c['count']:>2} colourways")
    return manifest


def main():
    catalog = load_catalog()
    only = sys.argv[1:] or None
    index = []
    for fam in FAMILIES:
        if only and fam["id"] not in only:
            continue
        print(f"\n=== {fam['name']} ({fam['id']}) ===")
        man = build_family(fam, catalog)
        if man:
            index.append({"id": man["id"], "name": man["name"],
                          "neckFinish": man["neckFinish"],
                          "variantCount": len(man["variants"])})
    # The index lists every family ON DISK, not just the ones this run
    # built -- a single-family rebuild must never hide the others.
    out = os.path.join(REPO, "public", "paper-doll", "families.json")
    index = []
    for mp in sorted(glob.glob(os.path.join(REPO, "public", "paper-doll", "*", "manifest.json"))):
        man = json.load(open(mp))
        index.append({"id": man["id"], "name": man["name"],
                      "neckFinish": man["neckFinish"],
                      "variantCount": len(man["variants"])})
    with open(out, "w") as fh:
        json.dump(index, fh, indent=2)
    print(f"\nindex: {len(index)} families -> dist/paper-doll/legacy/families.json")


if __name__ == "__main__":
    main()
