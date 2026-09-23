#!/usr/bin/env python3
"""Read-only survey of plated kitable SKUs that still need photographic kits."""
from __future__ import annotations

import argparse
import json
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

CONVEX = "https://precise-raccoon-123.convex.cloud"
COMPONENT_CATEGORIES = {
    "Component", "Cap/Closure", "Accessory", "Packaging",
}
CLOSED_ATOMIZER = {"Metal Atomizer"}
FLIP_TOP_SKUS = {"PbClear4ozFlpWh", "PbClear8ozFlpWh", "PbNat16ozFlpWh"}
PRIORITY = ("Boston Round", "Rectangle", "Tulip", "Elegant", "Circle", "Sleek")


def query(path: str, args: dict | None = None, url: str = CONVEX):
    req = urllib.request.Request(
        f"{url}/api/query",
        data=json.dumps({"path": path, "args": args or {}, "format": "json"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        body = json.loads(response.read().decode())
    if body.get("status") != "success":
        raise RuntimeError(f"{path} failed: {body}")
    return body["value"]


def kitable(row: dict) -> bool:
    sku = (row.get("websiteSku") or "").strip()
    if not sku or sku in FLIP_TOP_SKUS:
        return False
    if row.get("category") in COMPONENT_CATEGORIES or row.get("category") in CLOSED_ATOMIZER:
        return False
    if row.get("family") in COMPONENT_CATEGORIES or row.get("family") == "Metal Atomizer":
        return False
    neck = (row.get("neckThreadSize") or "").strip()
    return bool(neck) and neck.upper() not in {"N/A", "NONE", "NA"}


def all_products(url: str) -> list[dict]:
    rows, cursor = [], None
    while True:
        page = query("products:getAllForPlates", {"limit": 1000, "cursor": cursor}, url)
        rows.extend(page["page"])
        if page["isDone"]:
            break
        cursor = page["continueCursor"]
    return rows


def lookup(skus: list[str], path: str, key: str, url: str) -> dict:
    found = {}
    for i in range(0, len(skus), 200):
        chunk = skus[i:i + 200]
        if path == "productKits:forSku":
            for sku in chunk:
                kit = query(path, {"websiteSku": sku, "graceSku": None}, url)
                if kit:
                    found[sku] = kit
        else:
            found.update(query(path, {"skus": chunk}, url)[key])
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--convex-url", default=CONVEX)
    parser.add_argument("--out", type=Path, default=Path("/tmp/plated-kit-gaps.json"))
    parser.add_argument("--families", nargs="*", default=list(PRIORITY))
    args = parser.parse_args()
    products = [row for row in all_products(args.convex_url) if (row.get("websiteSku") or "").strip()]
    kitable_rows = [row for row in products if kitable(row)]
    skus = [row["websiteSku"] for row in kitable_rows]
    plates = lookup(skus, "productPlates:forSkus", "plates", args.convex_url)
    priority_plated = [
        row for row in kitable_rows
        if row["websiteSku"] in plates and (row.get("family") in args.families)
    ]
    kits = lookup(
        [row["websiteSku"] for row in priority_plated],
        "productKits:forSku",
        "kits",
        args.convex_url,
    )
    gaps = defaultdict(list)
    for row in priority_plated:
        sku = row["websiteSku"]
        if kits.get(sku):
            continue
        plate = plates[sku]
        gaps[row.get("family") or "Unknown"].append({
            "websiteSku": sku,
            "productGroupId": row.get("productGroupId"),
            "capacityMl": row.get("capacityMl"),
            "color": row.get("color"),
            "neck": row.get("neckThreadSize"),
            "applicator": row.get("applicator"),
            "hasCapOff": bool(plate.get("imageCapOff")),
        })
    summary = {
        "convexUrl": args.convex_url,
        "kitable": len(kitable_rows),
        "platedKitable": sum(1 for row in kitable_rows if row["websiteSku"] in plates),
        "priorityPlated": len(priority_plated),
        "priorityWithKit": len(kits),
        "priorityWithoutKit": sum(len(rows) for rows in gaps.values()),
        "priority": {
            family: {
                "count": len(gaps[family]),
                "withCapOff": sum(1 for row in gaps[family] if row["hasCapOff"]),
                "byApplicator": dict(Counter(row["applicator"] or "unknown" for row in gaps[family])),
                "skus": [row["websiteSku"] for row in gaps[family]],
            }
            for family in args.families
        },
    }
    args.out.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({
        "kitable": summary["kitable"],
        "platedKitable": summary["platedKitable"],
        "priorityPlated": summary["priorityPlated"],
        "priorityWithKit": summary["priorityWithKit"],
        "priorityWithoutKit": summary["priorityWithoutKit"],
        "priorityCounts": {family: summary["priority"][family]["count"] for family in args.families},
        "priorityCapOff": {family: summary["priority"][family]["withCapOff"] for family in args.families},
        "out": str(args.out),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
