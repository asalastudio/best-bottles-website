#!/usr/bin/env python3
"""Index leftover Cylinder kits that already reuse published blob parts.

Dry run by default. --apply writes productKits rows and needs
BEST_BOTTLES_CONVEX_WRITE_TOKEN. No new pixels are uploaded.
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONVEX = "https://precise-raccoon-123.convex.cloud"
PART_KEYS = (
    "slot", "variantKey", "zOrder", "explodeIndex", "bounds",
    "assembled", "exploded", "image", "image2x", "mask", "derivation",
)
ASSET_KEYS = ("url", "key", "sha256", "bytes", "width", "height")


def query(path: str, args: dict, url: str):
    req = urllib.request.Request(
        f"{url}/api/query",
        data=json.dumps({"path": path, "args": args, "format": "json"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        body = json.loads(response.read().decode())
    if body.get("status") != "success":
        raise RuntimeError(f"{path} failed: {body}")
    return body["value"]


def mutate(path: str, args: dict, url: str):
    req = urllib.request.Request(
        f"{url}/api/mutation",
        data=json.dumps({"path": path, "args": args, "format": "json"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        body = json.loads(response.read().decode())
    if body.get("status") != "success":
        raise RuntimeError(f"{path} failed: {body}")
    return body["value"]


def asset(value):
    if value is None:
        return None
    return {key: value[key] for key in ASSET_KEYS}


def index_row(row: dict) -> dict:
    return {
        "sku": row["websiteSku"],
        "websiteSku": row.get("websiteSku"),
        "graceSku": row.get("graceSku"),
        "familyId": row["familyId"],
        "plateSha256": row["plateSha256"],
        "canvas": row["canvas"],
        "anchors": row["anchors"],
        "completeness": row["completeness"],
        "parts": [
            {
                **{key: part[key] for key in PART_KEYS if key not in {"image", "image2x", "mask"}},
                "image": asset(part["image"]),
                "image2x": asset(part.get("image2x")),
                "mask": asset(part.get("mask")),
            }
            for part in row["parts"]
        ],
        "three": row.get("three"),
        "source": row["source"],
        "builder": row["builder"],
        "storageProvider": "vercel-blob",
    }


def load_candidates(folder: Path, include_visual_review: bool) -> list[dict]:
    rows = []
    for path in sorted(folder.glob("*.kit.json")):
        row = json.loads(path.read_text())
        if row.get("publishable"):
            rows.append(row)
        elif include_visual_review and (row.get("gates") or {}).get("parity", {}).get("visualReviewBand"):
            rows.append(row)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kits", type=Path, default=HERE.parents[1] / "data/paper-doll/cylinder-leftover-kits")
    parser.add_argument("--convex-url", default=os.environ.get("NEXT_PUBLIC_CONVEX_URL", CONVEX))
    parser.add_argument("--include-visual-review", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    rows = load_candidates(args.kits, args.include_visual_review)
    if not rows:
        raise SystemExit("no leftover kits match the selected gate")
    payload = [index_row(row) for row in rows]
    plates = query("productPlates:forSkus", {"skus": [row["sku"] for row in payload]}, args.convex_url)["plates"]
    ready = []
    held = []
    for row in payload:
        plate = plates.get(row["websiteSku"])
        if not plate:
            held.append({"sku": row["sku"], "reason": "no published plate"})
            continue
        if row["plateSha256"] not in plate["image"]:
            held.append({"sku": row["sku"], "reason": "kit plate hash is not the published front"})
            continue
        ready.append(row)
    report = {
        "target": args.convex_url,
        "apply": args.apply,
        "ready": [row["sku"] for row in ready],
        "held": held,
        "partsAlreadyHosted": True,
    }
    print(json.dumps(report, indent=2))
    if not args.apply:
        return 0
    token = os.environ.get("BEST_BOTTLES_CONVEX_WRITE_TOKEN")
    if not token:
        raise SystemExit("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set")
    results = []
    for start in range(0, len(ready), 25):
        results.extend(mutate(
            "productKits:upsertMany",
            {"writeToken": token, "rows": ready[start:start + 25]},
            args.convex_url,
        ))
    print(json.dumps({"indexed": results}, indent=2))
    if any(row.get("outcome") == "error" for row in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
