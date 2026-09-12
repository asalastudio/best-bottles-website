#!/usr/bin/env python3
"""Measure every served plate so the ledger can tell a correct plate from a wrong one.

A plate that exists is not a plate that is right. On 2026-09-12 Jordan saw the clear
15 ml Boston Round short cap "looking small" next to its amber and cobalt twins; the
clear one was correct and the other two were 27 % too big. The ledger counted all
three as done. This script gives it the number to disagree with.

The test is the builder's own ruler applied to the FINISHED plate: the glass body
width — the widest run in the lower 60 % of the product — must be one number for
one bottle, where a bottle is family + capacity + neck with the glass colours merged
and the tall variants split out. Hanging closures (antique bulb, tassel, atomizer)
widen that band and so never vote or get judged. Anything more than 5 % off its
bottle's median is wrong-sized, and the expected width is recorded beside it.

  python3 scripts/asset-ledger/measure-plates.py   (needs NEXT_PUBLIC_CONVEX_URL; reads .env.local)

Writes src/lib/asset-ledger/plate-geometry.json for build.mjs. Plate images are cached
in data/asset-ledger/plates-cache/ (gitignored); nothing is written anywhere else.
"""
import json, os, re, sys, subprocess, urllib.request, collections
import concurrent.futures as cf
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, "data/asset-ledger/plates-cache"); os.makedirs(CACHE, exist_ok=True)
OUT = os.path.join(ROOT, "src/lib/asset-ledger/plate-geometry.json")
HANG = re.compile(r"AnSp|Tsl|Atom")
NECK = re.compile(r"^(\d+-\d+|\d+mm|Press-Fit|Specialty)$", re.I)
TOL = 0.05

def env_url():
    if os.environ.get("NEXT_PUBLIC_CONVEX_URL"): return os.environ["NEXT_PUBLIC_CONVEX_URL"]
    p = os.path.join(ROOT, ".env.local")
    if os.path.exists(p):
        for line in open(p):
            if line.startswith("NEXT_PUBLIC_CONVEX_URL="): return line.split("=", 1)[1].strip().strip('"')
    sys.exit("NEXT_PUBLIC_CONVEX_URL is not set")

def list_plates():
    """Every plate row the storefront can see, via the same queries the site uses."""
    js = """
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { ConvexHttpClient } = require('convex/browser');
const { api } = await import('./convex/_generated/api.js');
const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const out = [];
for (const f of await c.query(api.productPlates.families, {})) {
  let cursor = null;
  for (;;) { const r = await c.query(api.productPlates.byFamily, { familyId: f.familyId, cursor, limit: 500 });
    for (const p of r.page) out.push({ sku: p.websiteSku || p.sku, familyId: f.familyId, image: p.image, capOff: !!p.imageCapOff, source: p.sourcePath || '' });
    if (r.isDone) break; cursor = r.continueCursor; }
}
process.stdout.write(JSON.stringify(out));
"""
    env = dict(os.environ, NEXT_PUBLIC_CONVEX_URL=env_url())
    r = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, env=env, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-800:])
    return json.loads(r.stdout)

def fetch(p):
    dest = os.path.join(CACHE, p["sku"] + ".webp")
    if os.path.exists(dest) and os.path.getsize(dest) > 0: return True
    try: urllib.request.urlretrieve(p["image"], dest); return True
    except Exception: return False

def bottle_key(sku, fid):
    parts = fid.split("-"); cap = next((i for i, s in enumerate(parts) if re.fullmatch(r"\d+ml", s)), None)
    if cap is None: return None
    if len(parts) >= 2 and NECK.match("-".join(parts[-2:])): neck = "-".join(parts[-2:])
    elif NECK.match(parts[-1]): neck = parts[-1]
    else: return None
    return ("tall-" if sku.startswith("GBTall") else "") + "-".join(parts[:cap]) + "-" + parts[cap] + "-" + neck

def measure(p):
    try: a = np.array(Image.open(os.path.join(CACHE, p["sku"] + ".webp")).convert("RGB")).astype(float)
    except Exception: return None
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)      # the plate's own background
    d = np.abs(a - bg).max(axis=2)
    lab, _ = ndimage.label(d <= 10)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    m = ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=2)
    ys = np.where(m.any(axis=1))[0]
    if not len(ys): return None
    y0, y1 = int(ys.min()), int(ys.max())
    cols = np.where(m[y0 + int(0.4 * (y1 - y0)):y1 + 1].any(axis=0))[0]
    return dict(sku=p["sku"], familyId=p["familyId"], bottle=bottle_key(p["sku"], p["familyId"]),
                bodyWidth=int(cols.max() - cols.min() + 1), height=int(y1 - y0 + 1), foot=y1,
                hanging=bool(HANG.search(p["sku"])), legacySource=p["source"].startswith("http"), capOff=p["capOff"])

def main():
    plates = list_plates()
    with cf.ThreadPoolExecutor(16) as ex: got = sum(ex.map(fetch, plates))
    print(f"{len(plates)} plates listed, {got} images on hand", file=sys.stderr)
    with cf.ThreadPoolExecutor(8) as ex: rows = [r for r in ex.map(measure, plates) if r]
    by_bottle = collections.defaultdict(list)
    for r in rows:
        if r["bottle"] and not r["hanging"]: by_bottle[r["bottle"]].append(r["bodyWidth"])
    medians = {b: float(np.median(w)) for b, w in by_bottle.items() if len(w) >= 2}
    for r in rows:
        med = medians.get(r["bottle"]) if not r["hanging"] else None
        r["expectedWidth"] = round(med) if med else None
        r["sizeDeviation"] = round(r["bodyWidth"] / med - 1, 3) if med else None
        r["wrongSize"] = bool(med and abs(r["bodyWidth"] / med - 1) > TOL)
    summary = dict(plates=len(rows), bottlesWithTwoOrMore=len(medians), wrongSize=sum(r["wrongSize"] for r in rows),
                   legacySource=sum(r["legacySource"] for r in rows), tolerance=TOL)
    json.dump(dict(generatedAt=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(timespec="seconds"),
                   rule="glass body width (widest run in the lower 60% of the product) must match the bottle's median; bottle = family+capacity+neck, colours merged, tall split; hanging closures excluded",
                   summary=summary, plates={r["sku"]: r for r in rows}), open(OUT, "w"), indent=1)
    print(json.dumps(summary))

if __name__ == "__main__": main()
