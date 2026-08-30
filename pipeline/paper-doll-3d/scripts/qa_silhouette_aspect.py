#!/usr/bin/env python3
"""Gate silhouettes against the catalogue's own proportions, before building.

The silhouette supplies SHAPE and the catalogue supplies SIZE, so bottle_bodies
stretches the trace to the measured millimetres no matter what it traced. That
makes the dimension gate blind to the one error that matters here: if the PSD
layer fused the bottle with its closure (some sources are a single flattened
layer), the trace is of bottle+stopper, and stretching THAT to the bare-bottle
height yields a squashed bottle wearing a stopper - at exactly the right
bounding box.

Traced aspect vs catalogue aspect catches it. A silhouette carrying an extra
closure reads noticeably taller than the catalogue says it should be.

  python3 scripts/qa_silhouette_aspect.py --dims bodies-3d-dims.csv
"""
import argparse, csv, pathlib
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--dims", default="bodies-3d-dims.csv")
ap.add_argument("--sil", default="silhouettes")
ap.add_argument("--tol", type=float, default=12.0, help="max %% aspect deviation")
ap.add_argument("--out", default="silhouette-qa.csv")
a = ap.parse_args()

sil = pathlib.Path(a.sil)
rows, ok, bad, capped, nodim = [], 0, 0, 0, 0
with open(a.dims, newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        sku = r["grace_sku"].strip()
        p = sil / f"{sku}.png"
        if not p.exists():
            continue
        def num(k):
            try: return float(r[k])
            except (KeyError, ValueError, TypeError): return None
        h = num("height_mm")
        across = num("diameter_mm") or num("width_mm")
        hc = num("height_capped_mm")
        if not h or not across:
            nodim += 1; continue
        a_img = np.array(Image.open(p).convert("RGBA"))[..., 3] > 128
        ys, xs = np.nonzero(a_img)
        th, tw = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        traced = th / tw
        expect = h / across
        dev = (traced - expect) / expect * 100.0
        # does it match the CAPPED height better? then the closure is in frame
        cap_fit = (hc / across) if hc else None
        looks_capped = cap_fit is not None and abs(traced - cap_fit) < abs(traced - expect)
        status = "OK" if abs(dev) <= a.tol else ("CAPPED?" if looks_capped else "ASPECT")
        if status == "OK": ok += 1
        elif status == "CAPPED?": capped += 1
        else: bad += 1
        rows.append({"grace_sku": sku, "status": status,
                     "traced_aspect": round(traced, 3),
                     "expected_aspect": round(expect, 3),
                     "dev_pct": round(dev, 1),
                     "height_mm": h, "across_mm": across})

print(f"{len(rows)} silhouettes checked")
print(f"   OK       {ok}   (within {a.tol}% of catalogue proportions)")
print(f"   CAPPED?  {capped}   (matches the CAPPED height better - closure fused into the layer)")
print(f"   ASPECT   {bad}   (off proportion for another reason)")
print(f"   skipped  {nodim} without dims")
with open(a.out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print(f"-> {a.out}")
worst = sorted((r for r in rows if r["status"] != "OK"), key=lambda r: -abs(r["dev_pct"]))[:10]
for r in worst:
    print(f"   {r['status']:8} {r['grace_sku']:28} traced {r['traced_aspect']:.2f} "
          f"vs {r['expected_aspect']:.2f}  ({r['dev_pct']:+.0f}%)")
