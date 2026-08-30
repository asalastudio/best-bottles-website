#!/usr/bin/env python3
"""Harvest true millimetre dimensions from the live bestbottles.com PDPs.

Every PDP prints a spec block:

    Item Height with Cap: 65 +/-1 mm   Item Height without Cap: 52 +/-1 mm
    Item Width: 26 +/-0.5 mm           Item Depth: 26 +/-0.5 mm
    Neck Thread Size: 13-415

This matters for the 3D lane specifically: a silhouette cannot reveal DEPTH, so
the plan assumed boxy bodies without a calipered depth had to be skipped. They
do not - the live site publishes width and depth separately, and the live site
is already the founder-designated tie-breaker for dimensions.

  python3 scripts/harvest_live_dims.py --grep square_design_15
  python3 scripts/harvest_live_dims.py --all --out bodies-3d-dims.csv
"""
import argparse, csv, html, pathlib, re, sys

CACHE = pathlib.Path("/tmp/bb_live_cache")
NUM = r"([0-9]+(?:\.[0-9]+)?)"
PATTERNS = {
    "height_capped_mm": rf"Item Height with Cap:\s*{NUM}",
    "height_mm":        rf"Item Height without Cap:\s*{NUM}",
    "width_mm":         rf"Item Width\s*:\s*{NUM}",
    "depth_mm":         rf"Item Depth\s*:\s*{NUM}",
    "diameter_mm":      rf"Item Diameter\s*:\s*{NUM}",
    "capacity_ml":      rf"Item Capacity:\s*{NUM}",
}
NECK = re.compile(r"Neck Thread Size:\s*([0-9]{1,2}-[0-9]{3})", re.I)
IMG = re.compile(r'images/store/(?:capped|enlarged_pics|uncapped)/([A-Za-z0-9_.\-]+)\.(?:gif|png|jpg)', re.I)

def text_of(p):
    t = p.read_text(errors="ignore")
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))), t

def parse(p):
    flat, raw = text_of(p)
    row = {"page": p.name}
    for k, pat in PATTERNS.items():
        m = re.search(pat, flat, re.I)
        if m: row[k] = float(m.group(1))
    m = NECK.search(flat)
    if m: row["neck_finish"] = m.group(1)
    m = IMG.search(raw)
    if m: row["grace_sku"] = m.group(1)
    return row

ap = argparse.ArgumentParser()
ap.add_argument("--grep", default=None, help="substring of the cached page filename")
ap.add_argument("--all", action="store_true")
ap.add_argument("--out", default=None)
a = ap.parse_args()

if not CACHE.exists():
    sys.exit(f"no page cache at {CACHE} - rebuild with sweep_live_dims.py")

pages = sorted(CACHE.glob("*.html"))
if a.grep: pages = [p for p in pages if a.grep.lower() in p.name.lower()]
if not (a.all or a.grep): sys.exit("pass --grep or --all")

rows, complete = [], 0
for p in pages:
    r = parse(p)
    if "grace_sku" not in r: continue
    rows.append(r)
    if r.get("height_mm") and (r.get("diameter_mm") or (r.get("width_mm") and r.get("depth_mm"))):
        complete += 1

print(f"{len(pages)} pages -> {len(rows)} with a SKU, {complete} dimensionally complete")
cols = ["grace_sku", "neck_finish", "capacity_ml", "height_mm", "height_capped_mm",
        "diameter_mm", "width_mm", "depth_mm", "page"]
if a.out:
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"-> {a.out}")
else:
    for r in rows[:12]:
        print("  " + "  ".join(f"{c}={r.get(c)}" for c in cols[:8] if r.get(c) is not None))
