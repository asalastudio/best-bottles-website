#!/usr/bin/env python3
"""Extract bottle-body silhouettes from the layered Photoshop sources.

Blender ships its own Python and does not carry psd_tools, so PSD reading is a
PRE-STEP in system Python rather than something bottle_bodies.py does inside
Blender. That split is worth having anyway: the silhouettes are cached, so
re-running the lathe is instant, and the geometry engine keeps no dependency on
the asset format.

This is NOT a duplicate of scripts/paper-doll-3d/extract-silhouette.py. That
one thresholds a white background out of a FLATTENED photo and deliberately
ignores alpha, because in the flattened reference sets the alpha is a
rectangular tile. Here the input is the layered PSD, where the bottle body is
its own layer with true per-pixel alpha - no thresholding, no background, and
no risk of eroding thin glass edges.

The body is the tallest non-backdrop layer, which is exactly how the 2D
compositor identifies it: one definition serving both lanes.

  python3 scripts/extract_psd_silhouette.py --sku GBCyl9MtlRollMattSl
  python3 scripts/extract_psd_silhouette.py --from-csv bodies-3d-dims.csv --limit 50
"""
import argparse, csv, os, pathlib, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SRC = pathlib.Path.home() / "Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources"


_INDEX = None

def build_index(src_root):
    """Walk the sources ONCE and index by normalised stem.

    Files carry an ordinal prefix ("1. GBCyl9MtlRollMattSl.psd"), so the key is
    the stem with that prefix and all punctuation stripped. Walking the whole
    tree per SKU instead - as the first version did - is O(skus x tree), which
    is minutes per hundred SKUs across 4,400 files."""
    import re
    idx = {}
    for dirpath, _d, files in os.walk(src_root):
        low = dirpath.lower()
        if "composites" in low:
            continue
        side = "aerial and side" in low
        for fn in files:
            if not fn.lower().endswith(".psd"):
                continue
            stem = re.sub(r"^\s*\d+\.\s*", "", fn[:-4])
            key = re.sub(r"[^a-z0-9]", "", stem.lower())
            if not key:
                continue
            # prefer a front view, and prefer the first one seen
            if key not in idx or (side is False and idx[key][1] is True):
                idx[key] = (pathlib.Path(dirpath) / fn, side)
    return idx


def find_psd(src_root, sku):
    global _INDEX
    import re
    if _INDEX is None:
        _INDEX = build_index(src_root)
    hit = _INDEX.get(re.sub(r"[^a-z0-9]", "", sku.lower()))
    return hit[0] if hit else None


def body_layer(psd_path, want_aspect=None):
    """Return the body layer as an RGBA array.

    Selecting the body by a single geometric property does not work - both
    obvious rules were tried and both failed on real SKUs:

      tallest  -> GBRnd128Spry*: the sprayer's dip tube out-heights the squat
                  128 ml body, traced 10.15:1 against a catalogue 1.20:1.
      largest  -> GBSlm50AnSpTsl*: the bulb sprayer and tassel out-AREA the
                  slim body, traced 1.01:1 against a catalogue 3.90:1.

    So choose by the catalogue's own proportions instead. We already hold the
    true height and width/diameter from the live site, and height/width is the
    one property a straight-on silhouette preserves exactly. Pick the layer
    whose aspect is closest to the expected one, breaking ties on area.

    Falls back to largest-area when no expected aspect is supplied."""
    psd = PSDImage.open(psd_path)
    cands = []
    for lyr in psd:
        im = lyr.composite()
        if im is None or im.mode != "RGBA":
            continue
        a = np.array(im)
        if a[..., 3].max() == 0:
            continue
        lit = a[..., :3][a[..., 3] > 128]
        if lit.size == 0 or (lit.mean() > 248 and lit.std() < 6):
            continue                                  # flat white backdrop
        h, w = lyr.bottom - lyr.top, lyr.right - lyr.left
        if w < 12 or h < 12:
            continue
        area = int((a[..., 3] > 128).sum())
        ys, xs = np.nonzero(a[..., 3] > 128)
        if ys.size == 0:
            continue
        aspect = (ys.max() - ys.min() + 1) / max(1, (xs.max() - xs.min() + 1))
        cands.append((a, area, aspect))
    if not cands:
        return None
    if want_aspect:
        best = min(cands, key=lambda c: (abs(c[2] - want_aspect) / want_aspect,
                                         -c[1]))
    else:
        best = max(cands, key=lambda c: c[1])
    return best[0]


ap = argparse.ArgumentParser()
ap.add_argument("--sku", default=None)
ap.add_argument("--from-csv", default=None, help="CSV with a grace_sku column")
ap.add_argument("--limit", type=int, default=None)
ap.add_argument("--src", default=str(DEFAULT_SRC))
ap.add_argument("--out", default=str(ROOT / "silhouettes"))
a = ap.parse_args()

def expected_aspect(row):
    def num(k):
        try: return float(row.get(k) or "")
        except ValueError: return None
    h = num("height_mm"); across = num("diameter_mm") or num("width_mm")
    return (h / across) if (h and across) else None

skus, aspects = [], {}
if a.sku:
    skus = [a.sku]
    if a.from_csv:
        with open(a.from_csv, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r.get("grace_sku", "").strip() == a.sku:
                    aspects[a.sku] = expected_aspect(r)
elif a.from_csv:
    with open(a.from_csv, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            sku = r.get("grace_sku", "").strip()
            if not sku: continue
            skus.append(sku); aspects[sku] = expected_aspect(r)
    if a.limit:
        skus = skus[:a.limit]
else:
    sys.exit("pass --sku or --from-csv")

outdir = pathlib.Path(a.out); outdir.mkdir(parents=True, exist_ok=True)
made = missing = empty = 0
for sku in skus:
    dst = outdir / f"{sku}.png"
    if dst.exists():
        made += 1; continue
    p = find_psd(a.src, sku)
    if p is None:
        missing += 1; continue
    arr = body_layer(p, aspects.get(sku))
    if arr is None:
        empty += 1; continue
    ys, xs = np.nonzero(arr[..., 3] > 128)
    if ys.size == 0:
        empty += 1; continue
    crop = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(crop, "RGBA").save(dst)
    made += 1
    if len(skus) <= 5:
        print(f"  {sku}: {p.name} -> {crop.shape[1]}x{crop.shape[0]}px  {dst}")
print(f"silhouettes: {made} written/present, {missing} no PSD, {empty} no usable layer -> {outdir}")
