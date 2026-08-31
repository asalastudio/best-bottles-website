#!/usr/bin/env python3
"""Check every built body against the LIVE product photograph.

Jordan 2026-08-30: "we should be setting up a loop where you'll go to the main
website and confirm that all the shapes are, in fact, reflecting the reality of
what they have."

For each body it takes the representative SKU, pulls
bestbottles.com/images/store/enlarged_pics/<SKU>.gif, traces the silhouette,
and reports the two SHAPE facts a photo can settle that the catalogue numbers
cannot:

    aspect          height / width, against the ledger's mm
    shoulder_mm     how tall the turn from body into neck actually is

Scale comes from the ledger's own width, so this does NOT re-check absolute
size (already gated to 0.5%). It checks FORM.

Caveats that matter when reading the output:
  * Photos are of CAPPED bottles. Total pixel height includes the closure, so
    height is measured to the shoulder, never to the top of the frame.
  * Many shots have a loose cap standing beside the bottle. Only the largest
    connected blob is measured, so that cap is excluded rather than fused in
    (the same closure-fusion trap that rejected 121 silhouettes upstream).
  * A 360x480 GIF resolves ~4 px/mm on a 20 mm body. Sub-0.3 mm differences
    are noise; a 2x disagreement is not.

    python3 scripts/shape_truth.py --limit 10
    python3 scripts/shape_truth.py --body Cyl-round-17-415-70x20
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
LANE = HERE.parent
CACHE = LANE / "cache" / "product-photos"
URL = "https://www.bestbottles.com/images/store/enlarged_pics/{sku}.gif"
UA = "Mozilla/5.0 (compatible; BestBottles-shape-audit/1.0)"


def fetch(sku):
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / f"{sku}.gif"
    if dst.exists() and dst.stat().st_size > 0:
        return dst
    req = urllib.request.Request(URL.format(sku=sku), headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except Exception as exc:
        return None if not dst.exists() else dst
    if len(data) < 500:
        return None
    dst.write_bytes(data)
    return dst


def largest_blob(mask):
    """Keep only the blob containing the widest row's centre — the bottle.

    Nearly every product shot has a LOOSE CAP standing beside the bottle. If it
    is not excluded, the traced silhouette fuses the two and every shape number
    is wrong. This is the same closure-fusion failure that rejected 121
    silhouettes upstream, so it gets a real connected-component pass.

    Dependency-free on purpose: an earlier version imported scipy.ndimage and
    fell back to a column-band heuristic when the import failed. scipy is NOT
    installed here, so the fallback ran for all 42 bodies and silently produced
    garbage — the 9 ml read 0.68 mm against a hand-measured 1.21 mm. A missing
    optional import must never degrade into plausible-looking wrong numbers.
    """
    h, w = mask.shape
    rows = mask.sum(axis=1)
    y0 = int(np.argmax(rows))                 # widest row = the bottle body
    xs = np.where(mask[y0])[0]
    if len(xs) == 0:
        return mask
    seed = (y0, int((xs.min() + xs.max()) // 2))
    if not mask[seed]:
        seed = (y0, int(xs[len(xs) // 2]))

    out = np.zeros_like(mask)
    stack = [seed]
    out[seed] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                stack.append((ny, nx))
    return out


def silhouette(path):
    a = np.array(Image.open(path).convert("L"))
    mask = a < 235
    try:
        mask = largest_blob(mask)
    except Exception:
        mask = largest_blob_fallback(mask)
    prof = {}
    for y in range(mask.shape[0]):
        xs = np.where(mask[y])[0]
        if len(xs) > 2:
            prof[y] = xs.max() - xs.min()
    return prof


def measure(prof, width_mm):
    """Return (aspect, shoulder_mm, body_px) measured to the SHOULDER."""
    if not prof:
        return None
    ys = sorted(prof)
    body = max(prof.values())
    scale = body / width_mm                       # px per mm
    full_ys = [y for y in ys if prof[y] >= body - max(2, body * 0.02)]
    if not full_ys:
        return None
    top_full, bot_full = min(full_ys), max(full_ys)

    # shoulder: from the last row still near neck width up to the first full row
    above = [y for y in ys if y < top_full]
    if not above:
        return None
    neck_like = [y for y in above if prof[y] <= 0.80 * body]
    if not neck_like:
        return None
    shoulder_start = max(neck_like)
    shoulder_mm = (top_full - shoulder_start) / scale

    height_mm = (bot_full - shoulder_start) / scale   # shoulder -> base
    return dict(aspect=height_mm / width_mm, shoulder_mm=shoulder_mm,
                body_px=body, scale=scale, height_to_shoulder_mm=height_mm)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--body", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default="shape-truth.csv")
    args = ap.parse_args()

    ledger = {r["body_id"]: r for r in csv.DictReader(open(LANE / "bodies.csv"))}
    built = {f[:-4] for f in os.listdir(LANE.parent.parent / "public/models/bodies")
             if f.endswith(".glb")}

    rows, todo = [], []
    for bid, r in ledger.items():
        if bid not in built:
            continue
        if args.body and bid != args.body:
            continue
        todo.append((bid, r))
    if args.limit:
        todo = todo[:args.limit]

    print(f"checking {len(todo)} bodies against the live site\n")
    print(f"{'body':38s} {'sku':26s} {'W mm':>6} {'aspect':>7} {'photo':>7} "
          f"{'shoulder':>9} {'w-frac':>7}")
    for bid, r in todo:
        sku = r["grace_sku"] or r["representative_sku"]
        w = float(r["width_mm"] or r["diameter_mm"] or 0)
        h = float(r["height_mm"] or 0)
        if not w:
            continue
        p = fetch(sku)
        if p is None:
            print(f"{bid:38s} {sku:26s} {'':>6}  NO PHOTO")
            rows.append(dict(body_id=bid, sku=sku, status="no-photo"))
            continue
        m = measure(silhouette(p), w)
        if not m:
            print(f"{bid:38s} {sku:26s} {w:6.1f}  UNREADABLE")
            rows.append(dict(body_id=bid, sku=sku, status="unreadable"))
            continue
        ledger_aspect = h / w
        frac = m["shoulder_mm"] / w
        print(f"{bid:38s} {sku:26s} {w:6.1f} {ledger_aspect:7.2f} "
              f"{m['aspect']:7.2f} {m['shoulder_mm']:8.2f}mm {frac:7.3f}")
        rows.append(dict(body_id=bid, sku=sku, width_mm=w,
                         ledger_aspect=round(ledger_aspect, 3),
                         photo_aspect=round(m["aspect"], 3),
                         shoulder_mm=round(m["shoulder_mm"], 2),
                         shoulder_frac_of_width=round(frac, 4),
                         status="ok"))

    out = LANE / args.out
    if rows:
        keys = sorted({k for r in rows for k in r})
        with open(out, "w", newline="") as fh:
            wtr = csv.DictWriter(fh, fieldnames=keys)
            wtr.writeheader()
            wtr.writerows(rows)
        ok = [r for r in rows if r.get("status") == "ok"]
        if ok:
            fr = [r["shoulder_frac_of_width"] for r in ok]
            print(f"\nshoulder as a fraction of body width, across {len(ok)} bodies:")
            print(f"  median {np.median(fr):.4f}  mean {np.mean(fr):.4f}  "
                  f"min {min(fr):.4f}  max {max(fr):.4f}")
        print(f"\nwrote {out}")


if __name__ == "__main__":
    sys.exit(main())
