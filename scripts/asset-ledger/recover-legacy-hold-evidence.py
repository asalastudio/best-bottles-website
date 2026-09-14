#!/usr/bin/env python3
"""Put a photograph in front of every plate row that is held with no candidate.

The 223-row acquisition packet shows 74 prepared candidates beside their master
PSD composite, and 149 rows with no image at all - a text card reading "No plate
candidate. The row remains an explicit hold." Those 149 are the rows Jordan was
about to close out, and a decision to discard 149 products should not be taken
against an empty card.

The legacy reconciliation established that all 149 are still sold, or at least
still served, by the live Best Bottles site. This script downloads that exact
product's legacy photograph so each held row becomes something you can look at.

What it is NOT: the downloaded file is evidence for a scope decision, not a plate
and not a candidate. Legacy files are 600x800 or 360x480 GIFs against a 1000x1100
plate canvas. Nothing here is indexed, published, approved, or promoted to master
lineage, and no catalog record is modified.

  python3 scripts/asset-ledger/recover-legacy-hold-evidence.py [--limit N]

Writes public/reviews/legacy-hold-evidence/<sku>.<ext> plus a manifest at
data/asset-ledger/legacy-hold-evidence.json.
"""
import argparse, concurrent.futures as cf, hashlib, json, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.bestbottles.com/"
UA = {"User-Agent": "Mozilla/5.0 (BestBottles catalogue reconciliation; jordan@asala.ai)"}
OUT_DIR = ROOT / "public/reviews/legacy-hold-evidence"
# Cap-on first: it is the larger, cleaner view on the legacy site.
ROLE_ORDER = ("capped", "enlarged", "listing")


def fetch(url):
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read(), response.headers.get("Content-Type", "")


def recover(entry):
    """Download the best available legacy view for one held row."""
    live = [c for c in entry.get("candidates", []) if c.get("status") == 200]
    if not live:
        return {**identity(entry), "recovered": False, "reason": "no live legacy view"}
    live.sort(key=lambda c: ROLE_ORDER.index(c["role"]) if c["role"] in ROLE_ORDER else 9)
    chosen = live[0]
    url = BASE + chosen["path"].lstrip("/")
    try:
        body, content_type = fetch(url)
    except Exception as err:
        return {**identity(entry), "recovered": False, "reason": f"{type(err).__name__}: {err}"}
    if not body:
        return {**identity(entry), "recovered": False, "reason": "empty response"}
    ext = ".gif" if "gif" in content_type else ".png" if "png" in content_type else ".jpg" if "jpeg" in content_type else ".bin"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{entry['sku']}{ext}"
    (OUT_DIR / name).write_bytes(body)
    return {
        **identity(entry), "recovered": True, "role": chosen["role"],
        "sourceUrl": url, "file": f"public/reviews/legacy-hold-evidence/{name}",
        "url": f"/reviews/legacy-hold-evidence/{name}",
        "bytes": len(body), "contentType": content_type,
        "sha256": hashlib.sha256(body).hexdigest(),
    }


def identity(entry):
    return {k: entry.get(k) for k in ("sku", "graceSku", "family", "capacityMl", "stage", "productGroupId", "itemName")} | {
        "legacyUrl": (entry.get("legacy") or {}).get("url"),
        "legacySku": (entry.get("legacy") or {}).get("sku"),
        "legacyDescription": (entry.get("legacy") or {}).get("description"),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    recon = json.loads((ROOT / "data/asset-ledger/legacy-asset-reconciliation.json").read_text())
    acquisition = json.loads((ROOT / "data/asset-ledger/missing-plate-acquisition-2026-09-13.json").read_text())
    # The rows with no defensible candidate - exactly the cards showing no image.
    held = {r["sku"] for r in acquisition["rows"] if r["status"] == "hold"}
    targets = [e for e in recon["rows"] if e["sku"] in held]
    if args.limit:
        targets = targets[: args.limit]

    print(f"recovering legacy evidence for {len(targets)} held rows ...", file=sys.stderr)
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(recover, targets))

    ok = [r for r in results if r["recovered"]]
    out = {
        "schemaVersion": 1,
        "purpose": "Evidence for a scope decision on plate rows held with no candidate. "
                   "A legacy photograph here is NOT a plate, NOT a candidate, and NOT approved. "
                   "It shows the product exists and can still be obtained.",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "heldRows": len(targets),
        "recovered": len(ok),
        "failed": len(results) - len(ok),
        "rows": sorted(results, key=lambda r: (r["family"] or "", r["sku"])),
    }
    target = ROOT / "data/asset-ledger/legacy-hold-evidence.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps({k: out[k] for k in ("heldRows", "recovered", "failed")}, indent=1))
    for r in results:
        if not r["recovered"]:
            print(f"  FAILED {r['sku']}: {r['reason']}", file=sys.stderr)


if __name__ == "__main__":
    main()
