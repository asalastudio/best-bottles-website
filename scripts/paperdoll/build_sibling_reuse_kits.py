#!/usr/bin/env python3
"""Assemble leftover Cylinder kits from already published sibling parts.

No new photography. Each recipe names a body/fitment donor and a closure donor
whose parts are already indexed. The composite must reconstruct the leftover's
current published plate. Strict gate is mean ≤ 6 and tail ≤ 0.01; the existing
visual-review band is mean ≤ 12 and tail ≤ 0.08.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import time
import urllib.request
from collections import Counter
from pathlib import Path

from PIL import Image
import numpy as np

CONVEX = "https://precise-raccoon-123.convex.cloud"
HERE = Path(__file__).resolve().parent
SHA_IN_KEY = re.compile(r"/([0-9a-f]{64})\.")
CLOSURE_SLOTS = {"cap", "overcap"}


def query(path, args=None, url=CONVEX):
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


def download(url: str, cache: dict) -> Image.Image:
    if url not in cache:
        with urllib.request.urlopen(url, timeout=60) as response:
            cache[url] = Image.open(io.BytesIO(response.read())).convert("RGBA")
    return cache[url]


def sha256_from_url(url: str) -> str:
    match = SHA_IN_KEY.search(url)
    if not match:
        raise ValueError(f"content-addressed hash missing from {url}")
    return match.group(1)


def parity(composite: Image.Image, plate: Image.Image) -> dict:
    assembled = np.asarray(composite.convert("RGB")).astype(np.int16)
    target = np.asarray(plate.convert("RGB")).astype(np.int16)
    ink = (assembled.min(axis=2) < 245) | (target.min(axis=2) < 245)
    if not ink.any():
        return {"ok": False, "reason": "empty composite"}
    diff = np.abs(assembled - target)
    mean = float(diff[ink].mean())
    tail = float((diff.max(axis=2)[ink] > 40).mean())
    return {
        "ok": mean <= 6 and tail <= 0.01,
        "visualReviewBand": mean <= 12 and tail <= 0.08,
        "mean": round(mean, 4),
        "tailOver40": round(tail, 6),
    }


def kit_for(sku: str, cache: dict):
    if sku not in cache:
        kit = query("productKits:forSku", {"websiteSku": sku, "graceSku": None})
        if not kit:
            raise ValueError(f"donor has no usable kit: {sku}")
        cache[sku] = kit
    return cache[sku]


def selected_parts(body_kit: dict, closure_kit: dict, closure_slots: list[str]) -> list[dict]:
    parts = [part for part in body_kit["parts"] if part["slot"] not in CLOSURE_SLOTS]
    chosen = [part for part in closure_kit["parts"] if part["slot"] in closure_slots]
    if not any(part["slot"] == "body" for part in parts):
        raise ValueError("body donor is missing a body part")
    if not chosen:
        raise ValueError(f"closure donor is missing {closure_slots}")
    ordered = parts + chosen
    for index, part in enumerate(ordered):
        part = dict(part)
        part["zOrder"] = index
        ordered[index] = part
    return ordered


def stack(parts: list[dict], images: dict) -> Image.Image:
    canvas = Image.new("RGBA", (1000, 1100), "white")
    for part in parts:
        canvas.alpha_composite(download(part["image"]["url"], images))
    return canvas


def build_row(recipe: dict, product: dict, plate_url: str, parts: list[dict], gate: dict) -> dict:
    return {
        "sku": recipe["websiteSku"],
        "websiteSku": recipe["websiteSku"],
        "graceSku": product.get("graceSku"),
        "familyId": recipe["familyId"],
        "status": "candidate" if gate["ok"] or gate["visualReviewBand"] else "review",
        "publishable": bool(gate["ok"]),
        "plateSha256": sha256_from_url(plate_url),
        "canvas": {"width": 1000, "height": 1100},
        "parts": parts,
        "completeness": "full",
        "three": None,
        "source": {
            "library": "published-sibling-reuse",
            "path": plate_url,
            "releaseVersion": sha256_from_url(plate_url),
        },
        "gates": {"parity": gate},
        "anchors": {
            "axisX": 500,
            "neckAxisX": 500,
            "seatY": next(part["bounds"]["top"] for part in parts if part["slot"] == "body"),
            "baselineY": next(part["bounds"]["bottom"] for part in parts if part["slot"] == "body"),
            "pxPerMm": None,
        },
        "builder": {"name": "build_sibling_reuse_kits.py", "version": "1.0.0", "builtAt": int(time.time() * 1000)},
        "donors": {
            "bodyDonor": recipe["bodyDonor"],
            "closureDonor": recipe["closureDonor"],
            "closureSlots": recipe["closureSlots"],
        },
        "notes": [
            "Reuses already published photographic parts. No new pixels were created.",
            f"Body/fitment from {recipe['bodyDonor']}; closure from {recipe['closureDonor']}.",
        ],
    }


def load_products(skus: set[str], url: str) -> dict:
    found = {}
    cursor = None
    while True:
        page = query("products:getAllForPlates", {"limit": 1000, "cursor": cursor}, url)
        for row in page["page"]:
            sku = (row.get("websiteSku") or "").strip()
            if sku in skus:
                found[sku] = row
        if page["isDone"]:
            break
        cursor = page["continueCursor"]
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipes", type=Path, default=HERE / "cylinder_leftover_kit_recipes.json")
    parser.add_argument("--out", type=Path, default=HERE.parents[1] / "data/paper-doll/cylinder-leftover-kits")
    parser.add_argument("--convex-url", default=CONVEX)
    args = parser.parse_args()
    recipes = json.loads(args.recipes.read_text())["recipes"]
    skus = [row["websiteSku"] for row in recipes] + [row["bodyDonor"] for row in recipes] + [row["closureDonor"] for row in recipes]
    plates = {}
    for i in range(0, len(skus), 200):
        plates.update(query("productPlates:forSkus", {"skus": skus[i:i + 200]}, args.convex_url)["plates"])
    products = load_products(set(row["websiteSku"] for row in recipes), args.convex_url)
    kit_cache, image_cache, rows = {}, {}, []
    args.out.mkdir(parents=True, exist_ok=True)
    for recipe in recipes:
        sku = recipe["websiteSku"]
        result = {"websiteSku": sku, "status": "review"}
        try:
            if sku not in plates:
                raise ValueError("leftover has no published plate")
            body_kit = kit_for(recipe["bodyDonor"], kit_cache)
            closure_kit = kit_for(recipe["closureDonor"], kit_cache)
            if body_kit["familyId"] != recipe["familyId"] and sku != "GBSpry3mlClBlk":
                raise ValueError(f"body donor family {body_kit['familyId']} != {recipe['familyId']}")
            parts = selected_parts(body_kit, closure_kit, recipe["closureSlots"])
            composite = stack(parts, image_cache)
            plate = download(plates[sku]["image"], image_cache).convert("RGB")
            gate = parity(composite, plate)
            row = build_row(recipe, products.get(sku) or {}, plates[sku]["image"], parts, gate)
            if not gate["ok"] and not gate["visualReviewBand"]:
                row["reason"] = f"assembled parity failed {gate}"
            result = row
            (args.out / f"{sku}.kit.json").write_text(json.dumps(row, indent=2) + "\n")
            composite.convert("RGB").save(args.out / f"{sku}.assembled.webp", quality=90)
        except Exception as error:
            result["reason"] = str(error)
        rows.append(result)
        print(json.dumps({
            "websiteSku": sku,
            "status": result.get("status"),
            "publishable": result.get("publishable"),
            "parity": (result.get("gates") or {}).get("parity"),
            "reason": result.get("reason"),
            "donors": result.get("donors"),
        }), flush=True)
    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "builder": "build_sibling_reuse_kits.py",
        "convexUrl": args.convex_url,
        "counts": dict(Counter(row.get("status") for row in rows)),
        "publishable": sum(1 for row in rows if row.get("publishable")),
        "rows": rows,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"counts": manifest["counts"], "publishable": manifest["publishable"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
