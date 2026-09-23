#!/usr/bin/env python3
"""Build cap-split kits from a SKU's published cap-on and cap-off plates.

No Photoshop source, no publishing. The published plate pair is the authority:
the cap-off photograph is the body-plus-fitment assembly, and the removable
closure is the pixel difference against the cap-on plate. A kit is a candidate
only when it reassembles to that plate inside the existing parity gate.

    python3 scripts/paperdoll/build_plate_pair_kits.py --sku GBCyl9RollBlkDot
    python3 scripts/paperdoll/build_plate_pair_kits.py --skus-file leftovers.json --out dist/paper-doll/plate-pair-kits
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, binary_propagation, gaussian_filter

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from build_cyl9_kits import alpha_gate, save_part


def parity(composite, plate):
    assembled = np.asarray(composite.convert("RGB")).astype(np.int16)
    target = np.asarray(plate.convert("RGB")).astype(np.int16)
    ink = (assembled.min(axis=2) < 245) | (target.min(axis=2) < 245)
    if not ink.any():
        return {"ok": False, "reason": "empty composite"}
    diff = np.abs(assembled - target).max(axis=2)[ink]
    mean = float(np.abs(assembled - target)[ink].mean())
    tail = float((diff > 40).mean())
    return {"ok": mean <= 6 and tail <= 0.01, "mean": round(mean, 4), "tailOver40": round(tail, 6)}

CONVEX = "https://precise-raccoon-123.convex.cloud"
CANVAS = (1000, 1100)
SHA_IN_KEY = re.compile(r"/([0-9a-f]{64})\.")
OVERCAP_APPLICATORS = {
    "Fine Mist Sprayer",
    "Perfume Spray Pump",
    "Lotion Pump",
    "Vintage Bulb Sprayer",
    "Vintage Bulb Sprayer with Tassel",
    "Antique Bulb Sprayer",
    "Antique Bulb Sprayer with Tassel",
    "Atomizer",
}


def convex_query(path: str, args: dict | None = None, url: str = CONVEX):
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


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_from_url(url: str) -> str | None:
    match = SHA_IN_KEY.search(url)
    return match.group(1) if match else None


def download_image(url: str) -> tuple[Image.Image, bytes]:
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    image = Image.open(io.BytesIO(data)).convert("RGBA")
    return image, data


def matte_studio_white(rgba: np.ndarray, threshold: int = 248) -> np.ndarray:
    """Flood-fill pale studio canvas from the edges. Never invents bottle pixels."""
    out = rgba.copy()
    if out.shape[2] == 3:
        alpha = np.full(out.shape[:2], 255, dtype=np.uint8)
        out = np.dstack([out, alpha])
    pale = out[:, :, :3].min(axis=2) >= threshold
    seed = np.zeros(pale.shape, dtype=bool)
    seed[0] = pale[0]
    seed[-1] = pale[-1]
    seed[:, 0] = pale[:, 0]
    seed[:, -1] = pale[:, -1]
    out[binary_propagation(seed, mask=pale), 3] = 0
    return soften_cutout(out)


def soften_cutout(rgba: np.ndarray, sigma: float = 0.8) -> np.ndarray:
    """Give a hard studio matte the same 1 px anti-aliased edge PSD layers have."""
    out = rgba.copy()
    alpha = out[:, :, 3].astype(np.float32)
    ink = alpha > 0
    if not ink.any():
        return out
    halo = binary_dilation(ink, iterations=2)
    feathered = gaussian_filter(alpha, sigma=sigma)
    out[:, :, 3] = np.where(halo, np.clip(feathered, 0, 255), 0).astype(np.uint8)
    return out


def extract_closure(on_rgba: np.ndarray, off_rgba: np.ndarray, delta: int = 18) -> np.ndarray:
    """Keep cap-on pixels that the cap-off plate does not share."""
    if on_rgba.shape != off_rgba.shape:
        raise ValueError("cap-on and cap-off plates must be the same size")
    on = on_rgba[:, :, :3].astype(np.int16)
    off = off_rgba[:, :, :3].astype(np.int16)
    changed = np.abs(on - off).max(axis=2) >= delta
    closure = on_rgba.copy()
    if closure.shape[2] == 3:
        closure = np.dstack([closure, np.full(closure.shape[:2], 255, dtype=np.uint8)])
    closure[~changed, 3] = 0
    return matte_studio_white(closure)


def removable_slot(applicator: str | None) -> str:
    return "overcap" if applicator in OVERCAP_APPLICATORS else "cap"


def exploded_parts(parts: list[dict]) -> list[dict]:
    body = next(part for part in parts if part["slot"] == "body")
    ceiling = body["bounds"]["top"]
    movable = sorted((part for part in parts if part["slot"] != "body"), key=lambda part: part["bounds"]["bottom"], reverse=True)
    for index, part in enumerate(movable, 1):
        part["explodeIndex"] = index
        part["exploded"] = {
            "dx": 0,
            "dy": min(-90 * index, ceiling - part["bounds"]["bottom"] - 24),
        }
        ceiling = part["bounds"]["top"] + part["exploded"]["dy"]
    return parts


def write_part(rgba: np.ndarray, slot: str, dest: Path, sku: str) -> dict:
    dest.mkdir(parents=True, exist_ok=True)
    tmp = dest / f"{sku}.{slot}.tmp.webp"
    asset = save_part(rgba, str(tmp))
    name = f"{asset['sha256']}.{slot}.webp"
    path = dest / name
    tmp.replace(path)
    image = Image.open(path).convert("RGBA")
    bounds = image.getbbox()
    if bounds is None:
        raise ValueError(f"{slot} is empty after encoding")
    return {
        "slot": slot,
        "variantKey": None,
        "zOrder": 0,
        "explodeIndex": 0,
        "bounds": dict(zip(["left", "top", "right", "bottom"], bounds)),
        "assembled": {"x": 0, "y": 0},
        "exploded": {"dx": 0, "dy": 0},
        "image": f"parts/{name}",
        "storeKey": f"kits/plate-pair/{name}",
        **asset,
        "width": image.width,
        "height": image.height,
        "derivation": "pair-difference",
        "sourceRel": str(path),
    }


def build_kit_from_plates(
    on_image: Image.Image,
    off_image: Image.Image,
    *,
    website_sku: str,
    grace_sku: str | None,
    family_id: str,
    applicator: str | None,
    plate_sha256: str,
    plate_url: str,
    out: Path,
) -> dict:
    if on_image.size != CANVAS or off_image.size != CANVAS:
        raise ValueError(f"plates must be {CANVAS[0]}x{CANVAS[1]}, got on={on_image.size} off={off_image.size}")
    on_rgba = np.asarray(on_image.convert("RGBA"))
    off_rgba = np.asarray(off_image.convert("RGBA"))
    body_rgba = matte_studio_white(off_rgba)
    closure_rgba = extract_closure(on_rgba, off_rgba)
    slot = removable_slot(applicator)
    gates = []
    for name, rgba in (("body", body_rgba), (slot, closure_rgba)):
        ok, gate = alpha_gate(rgba)
        gates.append({"slot": name, "ok": ok, **gate})
        if not ok:
            raise ValueError(f"{name} alpha gate: {gate}")
    parts_dir = out / "parts"
    body = write_part(body_rgba, "body", parts_dir, website_sku)
    closure = write_part(closure_rgba, slot, parts_dir, website_sku)
    body["zOrder"] = 0
    closure["zOrder"] = 1
    parts = exploded_parts([body, closure])
    composite = Image.new("RGBA", CANVAS, "white")
    for part in parts:
        composite.alpha_composite(Image.open(out / part["image"]).convert("RGBA"))
    plate_check = parity(composite, on_image)
    if not plate_check["ok"]:
        raise ValueError(f"assembled parity failed {plate_check}")
    sku_dir = out / website_sku
    sku_dir.mkdir(parents=True, exist_ok=True)
    composite.convert("RGB").save(sku_dir / "assembled.webp", quality=90)
    row = {
        "sku": website_sku,
        "websiteSku": website_sku,
        "graceSku": grace_sku,
        "familyId": family_id,
        "status": "candidate",
        "publishable": False,
        "plateSha256": plate_sha256,
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "parts": [{k: v for k, v in part.items() if k != "sourceRel"} for part in parts],
        "completeness": "capSplit",
        "three": None,
        "source": {
            "library": "published-plate-pair",
            "path": plate_url,
            "releaseVersion": plate_sha256,
        },
        "gates": {"alpha": gates, "parity": plate_check},
        "anchors": {
            "axisX": 500,
            "neckAxisX": 500,
            "seatY": body["bounds"]["top"],
            "baselineY": body["bounds"]["bottom"],
            "pxPerMm": None,
        },
        "builder": {"name": "build_plate_pair_kits.py", "version": "1.0.0", "builtAt": int(time.time() * 1000)},
        "notes": [
            "Cap-off plate is the photographed body-plus-fitment assembly.",
            f"Removable {slot} is the cap-on/cap-off pixel difference.",
        ],
    }
    (sku_dir / "kit.json").write_text(json.dumps(row, indent=1) + "\n")
    return row


def load_plate_index(skus: list[str], convex_url: str) -> dict[str, dict]:
    plates = {}
    for i in range(0, len(skus), 200):
        result = convex_query("productPlates:forSkus", {"skus": skus[i:i + 200]}, convex_url)
        plates.update(result["plates"])
        if result.get("conflicts"):
            raise ValueError(f"plate lookup conflicts: {result['conflicts']}")
    return plates


def load_products(skus: set[str], convex_url: str) -> dict[str, dict]:
    found = {}
    cursor = None
    while True:
        page = convex_query("products:getAllForPlates", {"limit": 1000, "cursor": cursor}, convex_url)
        for row in page["page"]:
            sku = (row.get("websiteSku") or "").strip()
            if sku in skus:
                found[sku] = row
        if page["isDone"]:
            break
        cursor = page["continueCursor"]
    return found


def family_id_for(product: dict) -> str:
    family = product.get("family") or "unknown"
    capacity = product.get("capacityMl")
    color = product.get("color") or "mixed"
    neck = product.get("neckThreadSize") or "none"

    def slug(value) -> str:
        return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value).lower())).strip("-")

    cap = f"{capacity:g}" if isinstance(capacity, (int, float)) else str(capacity)
    return f"{slug(family)}-{cap}ml-{slug(color)}-{slug(neck)}"


def process_sku(sku: str, plate: dict, product: dict, out: Path) -> dict:
    if not plate.get("imageCapOff"):
        raise ValueError("published plate has no cap-off view")
    on_image, on_bytes = download_image(plate["image"])
    off_image, _off_bytes = download_image(plate["imageCapOff"])
    plate_sha = sha256_from_url(plate["image"])
    if not plate_sha:
        plate_sha = sha256_bytes(on_bytes)
    elif sha256_bytes(on_bytes) != plate_sha:
        raise ValueError("downloaded cap-on plate hash does not match content-addressed URL")
    return build_kit_from_plates(
        on_image,
        off_image,
        website_sku=sku,
        grace_sku=product.get("graceSku"),
        family_id=family_id_for(product),
        applicator=product.get("applicator"),
        plate_sha256=plate_sha,
        plate_url=plate["image"],
        out=out,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sku", action="append", default=[])
    parser.add_argument("--skus-file", type=Path)
    parser.add_argument("--out", type=Path, default=REPO / "dist/paper-doll/plate-pair-kits")
    parser.add_argument("--convex-url", default=CONVEX)
    args = parser.parse_args()
    skus = list(args.sku)
    if args.skus_file:
        payload = json.loads(args.skus_file.read_text())
        if isinstance(payload, list):
            skus.extend(payload)
        else:
            skus.extend(payload.get("skus") or [row["websiteSku"] for row in payload.get("rows", [])])
    skus = list(dict.fromkeys(sku.strip() for sku in skus if sku and sku.strip()))
    if not skus:
        raise SystemExit("pass --sku or --skus-file")
    args.out.mkdir(parents=True, exist_ok=True)
    plates = load_plate_index(skus, args.convex_url)
    products = load_products(set(skus), args.convex_url)
    rows = []
    for sku in skus:
        result = {"websiteSku": sku, "status": "review"}
        try:
            if sku not in plates:
                raise ValueError("no published plate")
            if sku not in products:
                raise ValueError("no exact product record")
            row = process_sku(sku, plates[sku], products[sku], args.out)
            result = {**row, "status": "candidate"}
        except Exception as error:
            result["reason"] = str(error)
        rows.append(result)
        print(json.dumps({
            "websiteSku": sku,
            "status": result.get("status"),
            "reason": result.get("reason"),
            "parity": (result.get("gates") or {}).get("parity"),
        }), flush=True)
    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "builder": "build_plate_pair_kits.py",
        "convexUrl": args.convex_url,
        "counts": dict(Counter(row.get("status") for row in rows)),
        "rows": rows,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest["counts"]))
    return 0 if manifest["counts"].get("review", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
