#!/usr/bin/env python3
"""Read-only: for every Empire SKU in the local kit manifests, what does PROD serve?
No kit -> the builder falls back to the product photograph (white box). A part whose opaque
pixels are mostly white is a plate, not a cut-out. Prints one line per SKU that has a problem."""
import io, json, sys, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
PROD = "https://precise-raccoon-123.convex.cloud/api/query"
rows = {}
for b in ["dist/paper-doll/empire-2026-09-16", "dist/paper-doll/kits-from-published-2026-09-19/families/empire"]:
    for r in json.loads((ROOT / b / "kits/manifest.json").read_text())["rows"]:
        rows.setdefault(r["sku"], r)
def served(sku):
    req = urllib.request.Request(PROD, data=json.dumps({"path": "productKits:forSku", "args": {"graceSku": None, "websiteSku": sku}, "format": "json"}).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))["value"]
by_app = {}
for sku, r in sorted(rows.items()):
    size = "100" if "-100ml-" in r["familyId"] else "50"
    v = served(sku); app = r.get("applicator"); note = []
    if not v:
        note.append(f"NO KIT SERVED (local status {r['status']}: {str(r.get('reason') or '')[:70]})")
    else:
        for p in v["parts"]:
            if p["slot"] == "body": continue
            a = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(p["image"]["url"]).read())).convert("RGBA"))
            op = a[:, :, 3] >= 250; white = (a[:, :, :3].min(2) >= 250) & op
            b = p["bounds"]; box = (b["right"] - b["left"]) * (b["bottom"] - b["top"])
            fill = op.sum() / max(1, box)
            if white.sum() / max(1, op.sum()) > 0.5 and fill > 0.85:
                note.append(f"{p['slot']} is a WHITE PLATE ({int(b['right']-b['left'])}x{int(b['bottom']-b['top'])}, {100*white.sum()/op.sum():.0f}% white, box {100*fill:.0f}% filled)")
    by_app.setdefault((size, app), []).append((sku, note))
for (size, app), items in sorted(by_app.items(), key=lambda kv: (kv[0][0], str(kv[0][1]))):
    bad = [(s, n) for s, n in items if n]
    print(f"\n{size} ml · {app}: {len(items)} SKUs, {len(bad)} with a problem")
    for s, n in bad: print(f"   {s:26s} " + "; ".join(n))
