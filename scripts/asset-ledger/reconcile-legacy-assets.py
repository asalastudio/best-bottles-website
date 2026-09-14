#!/usr/bin/env python3
"""Reconcile every outstanding plate row against the legacy Best Bottles site.

Jordan's rule, 2026-09-13: the current legacy site is the completeness authority.
Whatever it sells, we can obtain. Whatever it does not carry does not exist.

This script answers, per outstanding plate row, the only two questions that rule
raises:

  1. Does the legacy site carry this product at all?
  2. Which of its image files are actually live right now?

It never infers identity from a SKU string or a filename. A legacy row is matched
only through the exact SKU the legacy product page prints in its own heading (the
sweep already captured that), or through an explicitly recorded alias. Image paths
come from the legacy page's own markup wherever the page records them, which is
what carries the site's real letter-casing; the conventional paths are probed only
as a fallback and are labelled as such.

A legacy image is a FALLBACK source, never an upgrade. The master PSD stays the
preferred source: legacy files are 600x800 or 360x480 GIFs and the plate canvas is
1000x1100. This script records availability, not suitability, and approves nothing.

  python3 scripts/asset-ledger/reconcile-legacy-assets.py [--no-network] [--limit N]

Writes data/asset-ledger/legacy-asset-reconciliation.json for the ledger build.
Nothing is downloaded, published, or written to Convex.
"""
import argparse, concurrent.futures as cf, json, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://www.bestbottles.com/"
UA = {"User-Agent": "Mozilla/5.0 (BestBottles catalogue reconciliation; jordan@asala.ai)"}
WORKERS, DELAY = 6, 0.1
# The legacy site keeps a fixed set of paths per SKU (measured 2026-09-02).
FALLBACK = {
    "capped": "images/store/capped/{sku}.gif",
    "enlarged": "images/store/enlarged_pics/{sku}.gif",
    "listing": "images/store/{sku}.png",
}

norm = lambda s: "".join(ch for ch in str(s or "") if ch.isalnum()).lower()


def load_legacy():
    """Exact-SKU index of the legacy catalogue, plus the recorded alias spellings."""
    catalog = json.loads((ROOT / "data/legacy/legacy-catalog.json").read_text())
    index = {}
    for row in catalog["rows"]:
        if row.get("sku"):
            index.setdefault(norm(row["sku"]), row)
    alias_file = ROOT / "data/legacy/legacy-aliases.json"
    aliases = {}
    if alias_file.exists():
        raw = json.loads(alias_file.read_text())
        # {"aliases": {"<legacy sku>": {"prodSku": "<our sku>", ...}}}
        for legacy_sku, record in (raw.get("aliases") or {}).items():
            our_sku = record.get("prodSku") if isinstance(record, dict) else record
            if isinstance(our_sku, str) and norm(legacy_sku) in index:
                aliases[norm(our_sku)] = norm(legacy_sku)
    return catalog, index, aliases


def head(url):
    request = urllib.request.Request(url, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            length = response.headers.get("Content-Length")
            return {"status": response.status, "bytes": int(length) if length and length.isdigit() else None,
                    "contentType": response.headers.get("Content-Type")}
    except urllib.error.HTTPError as err:
        return {"status": err.code, "bytes": None, "contentType": None}
    except Exception as err:  # network/DNS/timeout - recorded, never guessed at
        return {"status": None, "bytes": None, "contentType": None, "error": f"{type(err).__name__}: {err}"}


def probe_row(entry, check_network):
    """Resolve one row's candidate image URLs and, optionally, their live status."""
    legacy = entry.pop("_legacy", None)
    candidates = []
    if legacy:
        recorded = legacy.get("images") or {}
        for role in ("capped", "enlarged", "listing"):
            value = recorded.get(role)
            if isinstance(value, str) and value:
                candidates.append({"role": role, "path": value, "from": "legacy page markup"})
    known = {c["path"] for c in candidates}
    for role, pattern in FALLBACK.items():
        path = pattern.format(sku=entry["sku"])
        if path not in known:
            candidates.append({"role": role, "path": path, "from": "conventional path"})
    if check_network:
        for candidate in candidates:
            candidate.update(head(BASE + candidate["path"].lstrip("/")))
            time.sleep(DELAY)
    live = [c for c in candidates if c.get("status") == 200] if check_network else []
    entry["candidates"] = candidates
    entry["liveImageRoles"] = sorted({c["role"] for c in live})
    entry["assetAvailable"] = bool(live) if check_network else None
    return entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-network", action="store_true", help="resolve candidate paths without probing the site")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    ledger = json.loads((ROOT / "src/lib/asset-ledger/ledger.json").read_text())
    plan = ledger["platePlan"]
    catalog, index, aliases = load_legacy()

    rows = [r for r in plan["rows"] if r["stage"] != "complete"]
    if args.limit:
        rows = rows[: args.limit]

    entries = []
    for row in rows:
        key = norm(row["sku"])
        legacy = index.get(key) or index.get(aliases.get(key, ""))
        entry = {
            "sku": row["sku"], "graceSku": row.get("graceSku"), "family": row["family"],
            "capacityMl": row.get("capacityMl"), "stage": row["stage"],
            "productGroupId": row.get("productGroupId"), "itemName": row.get("itemName"),
            "legacy": None if not legacy else {
                "sku": legacy["sku"], "url": legacy["url"], "status": legacy.get("status"),
                "matchedBy": "exact sku" if index.get(key) else "recorded alias",
                "description": (legacy.get("description") or "")[:400],
            },
            "_legacy": legacy,
        }
        entries.append(entry)

    check = not args.no_network
    if check:
        print(f"probing {len(entries)} rows against {BASE} ...", file=sys.stderr)
        with cf.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            entries = list(pool.map(lambda e: probe_row(e, True), entries))
    else:
        entries = [probe_row(e, False) for e in entries]

    have = [e for e in entries if e["assetAvailable"]] if check else []
    none = [e for e in entries if check and not e["assetAvailable"]]
    out = {
        "schemaVersion": 1,
        "rule": "Jordan 2026-09-13: the current legacy Best Bottles site is the completeness authority. "
                "An asset it carries can be obtained; a product it does not carry does not exist. "
                "Legacy files are a FALLBACK source (600x800 / 360x480 GIF) and never outrank a master PSD.",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "ledgerGeneratedAt": ledger["generatedAt"],
        "legacyCatalog": {"path": "data/legacy/legacy-catalog.json", "generatedAt": catalog["generatedAt"],
                          "productPages": catalog["productPages"], "parsed": catalog["parsed"]},
        "networkChecked": check,
        "summary": {
            "outstandingRows": len(entries),
            "onLegacySite": sum(1 for e in entries if e["legacy"]),
            "notOnLegacySite": sum(1 for e in entries if not e["legacy"]),
            "withLiveAsset": len(have),
            "withoutLiveAsset": len(none),
        },
        "rows": entries,
    }
    target = ROOT / "data/asset-ledger/legacy-asset-reconciliation.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, indent=1) + "\n")
    print(json.dumps(out["summary"], indent=1))
    if none:
        print("\nrows with no live legacy asset:", file=sys.stderr)
        for e in none:
            print(f"  {e['sku']:<28} {e['family']:<16} {e['stage']}", file=sys.stderr)


if __name__ == "__main__":
    main()
