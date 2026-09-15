#!/usr/bin/env python3
"""Build the Boston Round kit release from reviewed master PSD candidates.

This is a local, review-only build. It uses the exact PSD source paths and
current Boston plate manifest, writes content-addressed part files, and never
publishes or changes Convex. Droppers remain one assembled body part. Rollers
remain seated in the body; only the removable cap is separated.
"""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = Path.cwd()
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
BATCH = ROOT / "dist/paper-doll/boston-master"
OUT = ROOT / "dist/paper-doll/boston-kit-release-2026-09-12"
PARTS = OUT / "parts"
ADDENDUM = ROOT / "data/paper-doll/catalog-master-kit-candidates-addendum-2026-09-08.json"
PILOT = ROOT / "data/asset-ledger/boston-kit-pilot.json"

sha = lambda b: hashlib.sha256(b).hexdigest()


def digest(path: Path) -> str:
    return sha(path.read_bytes())


def asset(path: Path, url_prefix: str) -> dict:
    raw = path.read_bytes()
    h = sha(raw)
    return {"url": f"{url_prefix}/{path.name}", "key": path.name, "sha256": h,
            "bytes": len(raw), "width": 1000, "height": 1100}


def save_part(im: Image.Image) -> dict:
    tmp = PARTS / "part.tmp.webp"
    im.save(tmp, format="WEBP", lossless=True)
    h = digest(tmp)
    dest = PARTS / f"{h}.webp"
    if not dest.exists():
        tmp.replace(dest)
    else:
        tmp.unlink()
    return asset(dest, "/images/boston-kit-release-2026-09-12/parts")


def alpha_gate(im: Image.Image) -> dict:
    a = np.asarray(im.convert("RGBA"))
    alpha = a[:, :, 3]
    ink = alpha > 8
    if not ink.any():
        raise ValueError("empty component")
    return {"transparentFraction": round(float((alpha == 0).mean()), 4),
            "semiTransparentPixels": int(((alpha > 0) & (alpha < 255)).sum()),
            "touchesOwnEdge": bool(ink[0].any() or ink[-1].any() or ink[:, 0].any() or ink[:, -1].any())}


def parity(composite: Image.Image, plate: Image.Image) -> dict:
    a = np.asarray(composite.convert("RGB")).astype(np.int16)
    b = np.asarray(plate.convert("RGB")).astype(np.int16)
    ink = (a.min(axis=2) < 245) | (b.min(axis=2) < 245)
    diff = np.abs(a - b)
    mean = float(diff[ink].mean()) if ink.any() else 999.0
    tail = float((diff.max(axis=2)[ink] > 40).mean()) if ink.any() else 1.0
    return {"ok": mean <= 6 and tail <= .01, "mean": round(mean, 4), "tailOver40": round(tail, 6)}


def transform(psd: PSDImage, plate_row: dict) -> tuple[float, float, float]:
    reg_dir = BATCH / "plates" / plate_row["familyId"]
    reg = json.loads((reg_dir / f"_registration-{plate_row['body']}.json").read_text())
    target = reg["plates"][f"{plate_row['websiteSku']}.front-on"]
    session = next(s for s in reg["sessions"] if s["index"] == target["session"])
    return reg["scale"] * session["scaleFactor"], target["ox"], target["oy"]


def render_selected(psd: PSDImage, indices: list[int], scale: float, ox: float, oy: float) -> Image.Image:
    layers = list(psd.descendants())
    selected = {id(layers[i]) for i in indices}
    return psd.composite(force=True, ignore_preview=True, color=1, alpha=0,
                         layer_filter=lambda layer: layer.is_group() or id(layer) in selected).convert("RGBA").transform(
        (1000, 1100), Image.Transform.AFFINE,
        (1 / scale, 0, -ox / scale, 0, 1 / scale, -oy / scale),
        Image.Resampling.BICUBIC,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PARTS.mkdir(parents=True, exist_ok=True)
    addendum = json.loads(ADDENDUM.read_text())["rows"]
    candidates = [r for r in addendum if r.get("family") == "Boston Round"]
    plates = {r["websiteSku"]: r for r in json.loads((BATCH / "plates/manifest.json").read_text())["rows"]}
    products = {r["websiteSku"]: r for r in json.loads((BATCH / "input/xref.json").read_text())["products"]}
    pilot = json.loads(PILOT.read_text())["rows"]
    rows = []
    for candidate in candidates:
        sku = candidate["websiteSku"]
        p = plates.get(sku)
        if not p or not p.get("publishable"):
            rows.append({"sku": sku, "status": "held", "reason": "current Boston plate is not publishable"})
            continue
        source = MASTER / candidate["sourcePath"]
        if not source.resolve().is_relative_to(MASTER.resolve()):
            raise ValueError(f"source outside BB-PSD-Files-Master: {candidate['sourcePath']}")
        if digest(source) != candidate["sourceSha256"]:
            raise ValueError(f"source hash drift: {sku}")
        plate_file = BATCH / "plates" / p["plate"]["key"]
        if digest(plate_file) != p["plate"]["sha256"]:
            raise ValueError(f"plate hash drift: {sku}")
        psd = PSDImage.open(source)
        layers = list(psd.descendants())
        visible = [i for i, layer in enumerate(layers) if layer.is_visible()]
        if not visible or visible[0] != 0 or any(layer.kind != "pixel" for layer in layers):
            raise ValueError(f"non-pixel or unexpected source layers: {sku}")
        foreground = [i for i in visible if i != 0]
        if len(foreground) != 2 and len(foreground) != 3:
            raise ValueError(f"unreviewed layer count for {sku}: {foreground}")
        product = products[sku]
        applicator = product.get("applicator")
        dropper = applicator == "Dropper"
        roller = applicator in {"Metal Roller Ball", "Plastic Roller Ball"}
        # These roles come from the reviewed candidate addendum and the PSD's
        # physical layer order. They do not use SKU or filename inference.
        if roller and len(foreground) == 3:
            role_indices = {"body": foreground[:2], "cap": foreground[2:]}
        elif len(foreground) == 2:
            role_indices = {"body": foreground} if dropper else {"body": foreground[:1], "cap": foreground[1:]}
        else:
            raise ValueError(f"ambiguous component layers for {sku}")
        scale, ox, oy = transform(psd, p)
        parts = []
        composite = Image.new("RGBA", (1000, 1100), "white")
        gates = []
        for slot, indices in role_indices.items():
            im = render_selected(psd, indices, scale, ox, oy)
            gate = alpha_gate(im)
            if gate["touchesOwnEdge"]:
                raise ValueError(f"{sku} {slot} touches frame edge")
            part_asset = save_part(im)
            decoded = Image.open(PARTS / part_asset["key"]).convert("RGBA")
            composite.alpha_composite(decoded)
            bbox = decoded.getbbox()
            parts.append({"slot": slot, "variantKey": None, "zOrder": len(parts),
                          "explodeIndex": 0 if slot == "body" else 1,
                          "bounds": {"left": bbox[0], "top": bbox[1], "right": bbox[2], "bottom": bbox[3]},
                          "assembled": {"x": 0, "y": 0},
                          "exploded": {"dx": 0, "dy": 0 if slot == "body" else -110},
                          "image": part_asset, "image2x": None, "mask": None, "derivation": "psd-layer"})
            gates.append({"slot": slot, "indices": indices, **gate})
        pg = parity(composite, Image.open(plate_file))
        if not pg["ok"]:
            raise ValueError(f"plate parity failed for {sku}: {pg}")
        release_row = {"sku": sku, "websiteSku": sku, "graceSku": product.get("graceSku"),
                       "familyId": p["familyId"], "plateSha256": p["plate"]["sha256"],
                       "canvas": {"width": 1000, "height": 1100},
                       "anchors": {"axisX": 500, "neckAxisX": 500, "seatY": next(x["bounds"]["top"] for x in parts if x["slot"] == "body"),
                                   "baselineY": 1100, "pxPerMm": None},
                       "completeness": "bodyOnly" if dropper else "capSplit", "parts": parts,
                       "three": None, "source": {"library": "BB-PSD-Files-Master", "path": candidate["sourcePath"], "releaseVersion": candidate["sourceSha256"]},
                       "builder": {"name": "prepare-boston-kit-release.py", "version": "1.0.0", "builtAt": 0},
                       "storageProvider": "vercel-blob", "sourceSha256": candidate["sourceSha256"],
                       "sourceParts": candidate["parts"], "gates": {"alpha": gates, "parity": pg},
                       "publicationAuthorized": False, "publishable": False,
                       "approval": {"status": "pending", "reason": "kit-specific approval required"}}
        if sku in pilot:
            # The four pilot rows were explicitly approved in the conversation;
            # keep that approval bound to this exact plate and every part hash.
            pilot_row = pilot[sku]
            release_row["approval"] = {"status": "approved", "reviewKind": "kit", "reviewer": "Jordan Richter",
                                        "evidence": ["docs/reviews/boston-kit-pilot/browser.json", "docs/reviews/boston-kit-pilot/comparison.html"],
                                        "scope": "Four 30 mL amber roll-on pilot SKUs only",
                                        "plateSha256": p["plate"]["sha256"],
                                        "viewHashes": {state: {"parts": [part["image"]["sha256"] for part in pilot_row[state]["parts"]],
                                                                "fallback": pilot_row["checks"][state]["fallback"]["sha256"],
                                                                "reconstruction": pilot_row["checks"][state]["reconstruction"]["sha256"]} for state in ("on", "off")}}
        rows.append(release_row)
    manifest = {"schemaVersion": 1, "id": "boston-round-kit-release-2026-09-12",
                "family": "Boston Round", "publicationAuthorized": False,
                "reviewRequired": "Batch visual approval is required for each candidate; no kit rows are published by this build.",
                "approvedPilotSkus": [sku for sku, r in [(x["sku"], x) for x in rows] if r.get("approval", {}).get("status") == "approved"],
                "rows": rows}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    counts = {}
    for row in rows:
        state = row.get("approval", {}).get("status", row.get("status", "held"))
        counts[state] = counts.get(state, 0) + 1
    print(json.dumps({"manifest": str(OUT / "manifest.json"), "rows": len(rows), "counts": counts,
                      "parts": len(list(PARTS.glob("*.webp"))), "publicationAuthorized": False}, indent=2))


if __name__ == "__main__":
    main()
