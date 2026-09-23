#!/usr/bin/env python3
"""What is left to finish every plate, and whether a source file exists for it.

Reads the live plate index (prod and dev), the catalogue from a read-only dev
export, and indexes BOTH photo libraries by filename. For every sellable bottle
with no plate, it reports whether a master PSD, a BBUAT PSD, or nothing at all
carries its SKU. It also reports which plated rows still owe a cap-off image
and whether an uncapped source exists for them.

Read-only. Writes one JSON report and prints a summary.

    python3 scripts/asset-ledger/plate-completion-scope.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRATCH = Path(os.environ.get("PLATE_SCOPE_SCRATCH", "/private/tmp/claude-501/-Users-jordanrichter-Projects-Clients-Nemat-International-Best-Bottles-Website-02-20-2026--claude-worktrees-threejs-blender-render-location-96d90c/d8eea6e4-189b-4e12-bd58-ad68f8718777/scratchpad"))
LIBRARIES = {
    "master": Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master"),
    "bbuat": Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files"),
    "original": Path("/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources"),
}
PROD = "https://precise-raccoon-123.convex.cloud"
OUT = ROOT / "data/asset-ledger/plate-completion-scope.json"

# Categories that are a photographed bottle or jar. Everything else (components,
# caps, gift bags, tools) is not a plate row, which is what the ledger already says.
PLATE_CATEGORIES = {
    "Glass Bottle", "Glass Jar", "Roll-On Bottle", "Lotion Bottle",
    "Plastic Bottle", "Aluminum Bottle", "Metal Atomizer",
}


def convex_query(url: str, path: str, args: dict):
    body = json.dumps({"path": path, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(f"{url}/api/query", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        payload = json.load(r)
    if payload.get("status") != "success":
        raise RuntimeError(payload.get("errorMessage", payload))
    return payload["value"]


def plated_skus(url: str) -> set[str]:
    skus: set[str] = set()
    for family in convex_query(url, "productPlates:families", {}):
        cursor = None
        while True:
            page = convex_query(url, "productPlates:byFamily", {"familyId": family["familyId"], "cursor": cursor, "limit": 500})
            skus.update(row["sku"] for row in page["page"])
            if page["isDone"]:
                break
            cursor = page["continueCursor"]
    return skus


def plated_rows(url: str) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for family in convex_query(url, "productPlates:families", {}):
        cursor = None
        while True:
            page = convex_query(url, "productPlates:byFamily", {"familyId": family["familyId"], "cursor": cursor, "limit": 500})
            for row in page["page"]:
                rows[row["sku"]] = row
            if page["isDone"]:
                break
            cursor = page["continueCursor"]
    return rows


def norm(value: str) -> str:
    """Filenames carry spaces, numbering prefixes and punctuation; SKUs do not."""
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


# The libraries spell one product several ways. These are spelling variants of the
# same words, never identity guesses: a match found this way still has to be looked
# at before it is used as a source.
ALIASES = [
    (r"^gbvial", "gbv"), (r"^creamjar", "cj"), (r"black", "blk"), (r"white", "wht"),
    (r"silver", "sl"), (r"copper", "cu"), (r"gold", "gl"), (r"shiny", "shn"),
    (r"shn", "sh"), (r"matte", "matt"), (r"shsht", "sht"), (r"capsht", "sht"),
    (r"spray", "spry"), (r"dropper", "drpr"), (r"rollon", "roll"),
    (r"copy\d*$", ""), (r"\d+$", ""),
]


def alias_key(value: str) -> str:
    v = re.sub(r"^\d+", "", norm(value))
    for pattern, repl in ALIASES:
        v = re.sub(pattern, repl, v)
    return v


def index_libraries() -> dict[str, list[tuple[str, Path]]]:
    """normalised filename stem -> [(library, path)], plus every path for substring work."""
    index: dict[str, list[tuple[str, Path]]] = defaultdict(list)
    for name, root in LIBRARIES.items():
        if not root.exists():
            print(f"  !! library missing: {root}", file=sys.stderr)
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".psd", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
                index[norm(path.stem)].append((name, path))
                key = alias_key(path.stem)
                if key != norm(path.stem):
                    index.setdefault("alias:" + key, []).append((name, path))
    return index


def find(sku: str, grace: str | None, index: dict[str, list[tuple[str, Path]]]) -> list[tuple[str, Path, str]]:
    """Exact normalised stem first, then a stem that contains the SKU."""
    hits: list[tuple[str, Path, str]] = []
    for key in filter(None, [norm(sku), norm(grace or "")]):
        for library, path in index.get(key, []):
            hits.append((library, path, "exact filename"))
    if hits:
        return hits
    # a spelling variant of the same words (Shn/Sh, V/Vial, CJ/CreamJar)
    for library, path in index.get("alias:" + alias_key(sku), []) + index.get(alias_key(sku), []):
        hits.append((library, path, "spelling variant, needs a look before use"))
    if hits:
        return hits
    needle = norm(sku)
    if len(needle) >= 8:
        for stem, entries in index.items():
            if needle in stem:
                for library, path in entries:
                    hits.append((library, path, "filename contains the SKU"))
    return hits


def main() -> None:
    products_file = SCRATCH / "ex/products/documents.jsonl"
    if not products_file.exists():
        raise SystemExit(f"need a dev export at {products_file} (npx convex export, then unzip products/)")
    products = [json.loads(line) for line in products_file.read_text().splitlines() if line.strip()]

    prod_rows = plated_rows(PROD)
    dev_skus = plated_skus(os.environ["NEXT_PUBLIC_CONVEX_URL"]) if os.environ.get("NEXT_PUBLIC_CONVEX_URL") else set()
    plated = set(prod_rows) | dev_skus

    sellable = [
        p for p in products
        if p.get("category") in PLATE_CATEGORIES
        and p.get("websiteSku")
        and p.get("productGroupId")
        and p.get("stockStatus") != "Discontinued"
        and "__RETIRED__" not in p["websiteSku"]
    ]
    missing = [p for p in sellable if p["websiteSku"] not in plated]
    print(f"sellable bottles in the catalogue: {len(sellable)}")
    print(f"already plated: {len(sellable) - len(missing)}")
    print(f"NO PLATE: {len(missing)}")

    index = index_libraries()
    print(f"library files indexed: {sum(len(v) for v in index.values())}")

    report = {"generatedAt": None, "sellable": len(sellable), "plated": len(sellable) - len(missing), "missing": len(missing), "rows": []}
    found = Counter()
    by_family = Counter()
    for p in sorted(missing, key=lambda r: (r.get("family") or "", r["websiteSku"])):
        hits = find(p["websiteSku"], p.get("graceSku"), index)
        libs = sorted({library for library, _, _ in hits})
        state = "+".join(libs) if libs else "no source found"
        found[state] += 1
        by_family[(p.get("family") or "?", state)] += 1
        report["rows"].append({
            "websiteSku": p["websiteSku"], "graceSku": p.get("graceSku"), "family": p.get("family"),
            "capacityMl": p.get("capacityMl"), "color": p.get("color"), "applicator": p.get("applicator"),
            "capColor": p.get("capColor"), "itemName": (p.get("itemName") or "")[:120],
            "sources": [{"library": lib, "path": str(path.relative_to(LIBRARIES[lib])), "match": how} for lib, path, how in hits[:6]],
            "sourceCount": len(hits),
        })
    print("\nsource for the missing plates:")
    for state, count in found.most_common():
        print(f"  {state}: {count}")

    print("\nby family (missing -> source):")
    fams = sorted({f for f, _ in by_family})
    for fam in fams:
        parts = [f"{state} {n}" for (f, state), n in by_family.items() if f == fam]
        print(f"  {fam}: " + ", ".join(sorted(parts)))

    # cap-off debt: plated rows on prod with no cap-off image
    owed = [sku for sku, row in prod_rows.items() if not row.get("imageCapOff")]
    uncapped_hits = 0
    for sku in owed:
        if any(lib == "bbuat" and "uncapped" in str(path).lower() for lib, path, _ in find(sku, None, index)):
            uncapped_hits += 1
    print(f"\nplated on prod with no cap-off image: {len(owed)}")
    print(f"  of those, an UNCAPPED source exists in BBUAT: {uncapped_hits}")
    report["capOff"] = {"owed": len(owed), "uncappedSourceFound": uncapped_hits}

    from datetime import datetime, timezone
    report["generatedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(report, indent=1) + "\n")
    print(f"\nreport: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
