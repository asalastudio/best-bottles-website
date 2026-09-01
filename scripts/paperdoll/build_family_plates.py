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

FAMILY = {
    "id": "diva-46-clear",
    "name": "Diva 46 ml — Clear",
    "psd_glob": ("2. 18-415 Bottles", "25*", "1.*PSD"),
    "reference": "13. GBDiva46SpryMtGl.psd",   # clean assembled plate, bottle centred
    "template": (1250, 1660, 380, 660),        # y0,y1,x0,x1 of bottle lower body + foot
    "neck_finish": "18-415",
}

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

def parse_sku(stem):
    """GBDiva46AnSpTslGl -> (closure_id, closure_label, color_label, swatch)."""
    m = re.match(r"^(?:GB|LB)Diva46(.+)$", stem)
    if not m:
        return None
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

# ---------------------------------------------------------------- main
def main():
    psd_dir = glob.glob(os.path.join(LIB, *FAMILY["psd_glob"]))[0]
    catalog = load_catalog()

    # 1. flatten every PSD once
    plates = {}   # stem -> dict(gray, rgb, blobs, source)
    for path in sorted(glob.glob(os.path.join(psd_dir, "*.psd"))):
        base = os.path.basename(path)
        stem = base[:-4].split(". ", 1)[-1].strip()
        if parse_sku(stem) is None:
            continue
        rgb = PSDImage.open(path).composite().convert("RGB")
        gray = np.array(rgb.convert("L"))
        blobs = blob_count(gray)
        prev = plates.get(stem)
        # Prefer the assembled shot (one blob) over the "overcap resting beside" shot.
        if prev is None or blobs < prev["blobs"]:
            plates[stem] = {"rgb": rgb, "gray": gray, "blobs": blobs, "source": base}
    print(f"flattened {len(plates)} unique SKUs from {os.path.basename(psd_dir)}")

    # 2. register every plate against the reference bottle-foot template
    ref_path = os.path.join(psd_dir, FAMILY["reference"])
    ref_gray = np.array(PSDImage.open(ref_path).composite().convert("L"))
    ty0, ty1, tx0, tx1 = FAMILY["template"]
    patch = ref_gray[ty0:ty1, tx0:tx1]

    for stem, p in plates.items():
        iy, ix, score = ncc_offset(patch, p["gray"])
        p["dx"] = ix - tx0          # target = reference + (dx, dy)
        p["dy"] = iy - ty0
        p["score"] = score
    scores = [p["score"] for p in plates.values()]
    spread = (max(scores) - min(scores)) / max(scores)
    print(f"registration: NCC spread {spread:.6f} (0 = every bottle byte-identical)")
    if spread > 0.02:
        print("WARNING: plates are not a single photographic master; review before shipping",
              file=sys.stderr)

    # 3. union of all ink, expressed in reference coordinates
    ux0 = uy0 = 10**9; ux1 = uy1 = -10**9
    for p in plates.values():
        bb = ink_bbox(p["gray"])
        x0, y0, x1, y1 = bb
        ux0 = min(ux0, x0 - p["dx"]); uy0 = min(uy0, y0 - p["dy"])
        ux1 = max(ux1, x1 - p["dx"]); uy1 = max(uy1, y1 - p["dy"])
    uw, uh = ux1 - ux0, uy1 - uy0
    print(f"union ink in reference space: {uw}x{uh}px")

    # 4. one canvas for the whole family: contain the union, keep OUT_W:OUT_H
    scale = min((OUT_W - 2 * PAD) / uw, (OUT_H - 2 * PAD) / uh)
    out_dir = os.path.join(REPO, "public", "paper-doll", FAMILY["id"])
    os.makedirs(out_dir, exist_ok=True)

    entries = []
    for stem in sorted(plates):
        p = plates[stem]
        cid, clabel, color, swatch = parse_sku(stem)
        row = catalog.get(stem)
        if row is None:
            continue
        src = p["rgb"]
        # Scale and translate in ONE resampling pass. Resizing and then pasting
        # at an integer offset would round the bottle 1px between plates, which
        # reads as a twitch when the customer swaps closures.
        ox = (PAD - (ux0 + p["dx"]) * scale
              + ((OUT_W - 2 * PAD) - uw * scale) / 2)
        oy = (PAD - (uy0 + p["dy"]) * scale
              + ((OUT_H - 2 * PAD) - uh * scale) / 2)
        inv = 1.0 / scale
        canvas = src.transform(
            (OUT_W, OUT_H), Image.AFFINE,
            (inv, 0, -ox * inv, 0, inv, -oy * inv),
            resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        canvas.save(os.path.join(out_dir, f"{stem}.webp"), "WEBP", quality=88, method=6)

        # Rail thumbnail: the registered plate is mostly whitespace, so at 58px
        # the assembly is unreadable. Crop each plate to its own ink instead --
        # the rail is for telling closures apart, not for comparing scale.
        tb = ink_bbox(np.array(canvas.convert("L")))
        tx0, ty0, tx1, ty1 = tb
        side = max(tx1 - tx0, ty1 - ty0) + 24
        cx, cy = (tx0 + tx1) // 2, (ty0 + ty1) // 2
        # Crop onto an explicit white square: the square usually overruns the
        # plate edge, and PIL.crop pads out-of-bounds with black.
        square = Image.new("RGB", (side, side), (255, 255, 255))
        square.paste(canvas, (-(cx - side // 2), -(cy - side // 2)))
        thumb = square.resize((240, 240), Image.LANCZOS)
        thumb.save(os.path.join(out_dir, f"{stem}.thumb.webp"),
                   "WEBP", quality=82, method=6)

        entries.append({
            "sku": stem,
            "graceSku": row.get("graceSku") or None,
            "closure": cid,
            "closureLabel": clabel,
            "color": color,
            "swatch": swatch,
            "image": f"/paper-doll/{FAMILY['id']}/{stem}.webp",
            "thumb": f"/paper-doll/{FAMILY['id']}/{stem}.thumb.webp",
            "price": price_of(row),
            "stock": row.get("stockStatus") or None,
            "applicator": row.get("applicator") or None,
            "productUrl": row.get("productUrl") or None,
            "capacityMl": row.get("capacityMl") or None,
            "sourcePsd": p["source"],
        })

    order = [c[1] for c in CLOSURES]
    entries.sort(key=lambda e: (order.index(e["closure"]), e["color"]))
    manifest = {
        "id": FAMILY["id"],
        "name": FAMILY["name"],
        "neckFinish": FAMILY["neck_finish"],
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

    print(f"\nwrote {len(entries)} plates -> public/paper-doll/{FAMILY['id']}/")
    for c in manifest["closures"]:
        print(f"  {c['label']:34s} {c['count']:>2} colourways")

if __name__ == "__main__":
    main()
