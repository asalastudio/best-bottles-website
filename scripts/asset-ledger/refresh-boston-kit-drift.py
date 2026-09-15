#!/usr/bin/env python3
"""Re-render kit rows whose approved plate hash changed after review.

The current plate bytes are the measured ledger bytes. Components are still
rendered from the exact PSD layers in BB-PSD-Files-Master, then registered to
the current plate footprint. The prior approval is retained as superseded
evidence and the refreshed row is returned to the review lane.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = Path.cwd()
RELEASE = ROOT / "dist/paper-doll/boston-kit-release-2026-09-12"
PARTS = RELEASE / "parts"
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master")
ADDENDUM = ROOT / "data/paper-doll/catalog-master-kit-candidates-addendum-2026-09-08.json"
TARGETS = {
    "GBBstn15BlkCapSht": ("public/images/boston-plate-candidates/cf53147c7cedde10e6154507dd6bb559fe0850111513ab481af9d09cd884d3c8.webp", "dist/paper-doll/boston-master/plates/boston-round-15ml-clear-18-400/_registration-Bstn15Blk.json"),
    "GBBstn1ozBlkCapSht": ("public/images/boston-plate-candidates/f6c79efe149e59031cfdf39405346e6fe2c1b278843fcf79a7056c126f650c8e.webp", "dist/paper-doll/boston-master/plates/boston-round-30ml-clear-20-400/_registration-Bstn1ozBlk.json"),
    "GBBstn2ozBlkCapSht": ("public/images/boston-plate-candidates/8a8a2489ea3d689d70eb9a18e1e69750656df041702fc9110a3a7257e956518c.webp", "dist/paper-doll/boston-master/plates/boston-round-60ml-clear-20-400/_registration-Bstn2ozBlk.json"),
    "GBBstnAmb1ozMtlRollonShnSl": ("public/images/boston-plate-candidates/fe0d86ec7dd51a6c6079d113d3879dab56f15493f033c3d2d270dfe49dd1acee.webp", "dist/paper-doll/boston-master/plates/boston-round-30ml-amber-20-400/_registration-BstnAmb1oz.json"),
}

spec = importlib.util.spec_from_file_location("prepare", ROOT / "scripts/asset-ledger/prepare-boston-kit-release.py")
prepare = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(prepare)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bbox(im: Image.Image):
    a = np.asarray(im.convert("RGB"))
    ys, xs = np.where(a.min(axis=2) < 245)
    return (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()))


def asset(path: Path) -> dict:
    raw = path.read_bytes()
    return {"url": f"/images/boston-kit-release-2026-09-12/parts/{path.name}", "key": path.name,
            "sha256": sha(path), "bytes": len(raw), "width": 1000, "height": 1100}


def main() -> None:
    manifest = json.loads((RELEASE / "manifest.json").read_text())
    rows = {row["sku"]: row for row in manifest["rows"]}
    addendum = {row["websiteSku"]: row for row in json.loads(ADDENDUM.read_text())["rows"]}
    drift = []
    for sku, (plate_rel, registration) in TARGETS.items():
        row = rows[sku]
        prior = dict(row.get("approval") or {})
        current_plate = ROOT / plate_rel
        current_hash = sha(current_plate)
        if current_hash != row.get("plateSha256"):
            old = row.get("plateSha256")
            drift.append({"sku": sku, "approvedPlateSha256": old, "currentPlateSha256": current_hash})
        plate_box = bbox(Image.open(current_plate))
        old_comp = Image.new("RGBA", (1000, 1100), "white")
        for part in row["parts"]:
            old_comp.alpha_composite(Image.open(PARTS / part["image"]["key"]).convert("RGBA"))
        old_box = bbox(old_comp)
        old_w, old_h = old_box[1] - old_box[0] + 1, old_box[3] - old_box[2] + 1
        target_w, target_h = plate_box[1] - plate_box[0] + 1, plate_box[3] - plate_box[2] + 1
        factor = target_h / old_h
        candidate = addendum[sku]
        source = MASTER / candidate["sourcePath"]
        if sha(source) != candidate["sourceSha256"]:
            raise ValueError(f"source hash drift: {sku}")
        psd = PSDImage.open(source)
        layers = list(psd.descendants())
        visible = [i for i, layer in enumerate(layers) if layer.is_visible()]
        foreground = [i for i in visible if i != 0]
        product_applicator = row.get("applicator") or ""
        roller = len(foreground) == 3 or "Roller" in product_applicator
        role_indices = {"body": foreground[:2], "cap": foreground[2:]} if roller else {"body": foreground[:1], "cap": foreground[1:]}
        reg = json.loads((ROOT / registration).read_text())
        target = reg["plates"][f"{sku}.front-on"]
        session = next(s for s in reg["sessions"] if s["index"] == target["session"])
        scale = reg["scale"] * session["scaleFactor"] * factor
        ox, oy = target["ox"], target["oy"]
        first = {slot: prepare.render_selected(psd, indices, scale, ox, oy) for slot, indices in role_indices.items()}
        initial = Image.new("RGBA", (1000, 1100), "white")
        for im in first.values(): initial.alpha_composite(im)
        got = bbox(initial)
        dx = (plate_box[0] + plate_box[1] - got[0] - got[1]) / 2
        dy = (plate_box[2] + plate_box[3] - got[2] - got[3]) / 2
        rendered = {slot: prepare.render_selected(psd, indices, scale, ox + dx, oy + dy) for slot, indices in role_indices.items()}
        composite = Image.new("RGBA", (1000, 1100), "white")
        parts = []
        gates = []
        for slot, im in rendered.items():
            gate = prepare.alpha_gate(im)
            part_path = PARTS / "part.tmp.webp"
            im.save(part_path, format="WEBP", lossless=True)
            key = f"{sha(part_path)}.webp"
            dest = PARTS / key
            if dest.exists(): part_path.unlink()
            else: part_path.replace(dest)
            part_asset = asset(dest)
            decoded = Image.open(dest).convert("RGBA")
            composite.alpha_composite(decoded)
            b = decoded.getbbox()
            parts.append({"slot": slot, "variantKey": None, "zOrder": len(parts), "explodeIndex": 0 if slot == "body" else 1,
                          "bounds": {"left": b[0], "top": b[1], "right": b[2], "bottom": b[3]},
                          "assembled": {"x": 0, "y": 0}, "exploded": {"dx": 0, "dy": 0 if slot == "body" else -110},
                          "image": part_asset, "image2x": None, "mask": None, "derivation": "psd-layer"})
            gates.append({"slot": slot, "indices": role_indices[slot], **gate})
        parity = prepare.parity(composite, Image.open(current_plate))
        row["plateSha256"] = current_hash
        row["parts"] = parts
        row["gates"] = {"alpha": gates, "parity": parity}
        row["publishable"] = False
        row["approval"] = {"status": "pending", "reason": "Plate bytes changed after approval; refreshed PSD render requires Jordan re-approval.",
                            "supersededApproval": prior, "plateSha256": current_hash}
    manifest["approvedPilotSkus"] = [row["sku"] for row in manifest["rows"] if row.get("approval", {}).get("status") == "approved"]
    manifest["approvedBatch"]["status"] = "partially-stale"
    manifest["approvedBatch"]["supersededSkus"] = sorted(TARGETS)
    (RELEASE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    review_dir = ROOT / "docs/reviews/boston-kit-release-2026-09-12"
    review_dir.mkdir(parents=True, exist_ok=True)
    (review_dir / "hash-drift.json").write_text(json.dumps({"release": manifest["id"], "detectedOn": "2026-09-12", "rows": drift, "action": "Four rows re-rendered from BB-PSD-Files-Master and returned to review."}, indent=2) + "\n")
    print(json.dumps({"refreshed": sorted(TARGETS), "drift": drift, "parity": {sku: rows[sku]["gates"]["parity"] for sku in TARGETS}}, indent=2))


if __name__ == "__main__":
    main()
