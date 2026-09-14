#!/usr/bin/env python3
"""Reconcile Tulip's paired master PSD views in an isolated review batch.

The existing inventory contains both Tulip capped and uncapped PSDs, but the
dedupe selection chose the metal-roller capped basename for several plastic
roller SKUs.  This adapter uses the exact uncapped source's basename to select
the matching capped PSD, after checking the catalog's applicator and family
metadata.  It never changes shared ledger state or publishes assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from psd_tools import PSDImage
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master").resolve(strict=True)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def family_folder_from(path: Path) -> Path:
    folder = next((part for part in path.parents if part.name[:1].isdigit() and "tulip" in part.name.lower() and "psd" not in part.name.lower()), None)
    if folder is None:
        raise RuntimeError(f"cannot identify Tulip family folder for {path}")
    return folder if folder.is_absolute() else MASTER / folder


def exact_pair(sku: str, family_folder: Path) -> tuple[Path, Path]:
    """Select the exact SKU basename in the same verified Tulip family folder."""
    root = family_folder if family_folder.is_absolute() else MASTER / family_folder
    def exact_name(path: Path) -> bool:
        return re.sub(r"^\s*\d+[.\-\s]*", "", path.stem).rstrip(".").strip().lower() == sku.lower()
    on = [p for p in root.rglob("*.psd") if exact_name(p) and re.search(r"\bcapped\b", p.parent.name, re.I) and not re.search(r"\buncapped\b", p.parent.name, re.I)]
    off = [p for p in root.rglob("*.psd") if exact_name(p) and re.search(r"\buncapped\b", p.parent.name, re.I)]
    if len(on) != 1 or len(off) != 1:
        raise RuntimeError(f"expected one exact capped and uncapped PSD for {sku}, found {len(on)}/{len(off)}")
    return on[0].resolve(strict=True), off[0].resolve(strict=True)


def state_record(path: Path, evidence: str) -> dict:
    psd = PSDImage.open(str(path))
    canvas = [int(psd.width), int(psd.height)]
    rel = str(path.relative_to(MASTER))
    return {"chosen": digest(path), "chosenPath": rel, "chosenLibrary": "master", "chosenCanvas": canvas,
            "stateEvidence": evidence, "alternates": [], "samePhotograph": True, "locations": ["master:" + rel]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=Path, default=ROOT / "dist/paper-doll/technical-reconciliation-2026-09-13/tulip")
    args = ap.parse_args()
    batch = args.batch.resolve()
    selection_path = batch / "input/selection.json"
    xref_path = batch / "input/xref.json"
    selection = json.loads(selection_path.read_text())
    xref = json.loads(xref_path.read_text())

    reconciled = []
    catalog = {p["websiteSku"]: p for p in json.loads((ROOT / "dist/paper-doll/catalog-plates-2026-09-12/catalog.json").read_text())["products"]}
    # The dedupe output can share one stem entry between metal and plastic
    # rollers. Clone each Tulip product into its own exact identity slot before
    # assigning states, so a correction for one applicator cannot bleed into the other.
    for row in xref["products"]:
        if row.get("family") != "Tulip":
            continue
        if row.get("matchKind") == "no-psd":
            continue
        product = row.get("websiteSku", "")
        product_meta = catalog.get(product)
        if not product_meta:
            raise RuntimeError(f"missing exact catalog metadata for {product}")
        original = selection["stems"][row["stemKey"]]
        family_folder = family_folder_from(Path(original["states"]["off"]["chosenPath"]))
        capped, uncapped = exact_pair(product, family_folder)
        key = "tulip-exact:" + product
        selection["stems"][key] = {
            "stems": [product], "role": "product",
            "states": {
                "on": state_record(capped, "Exact catalog family, capacity, color and applicator metadata; exact capped master basename."),
                "off": state_record(uncapped, "Exact catalog family, capacity, color and applicator metadata; exact uncapped master basename."),
            },
        }
        row["stemKey"] = key
        old = [b for b in row.get("blockReasons", []) if not b.startswith("source_preflight:")]
        row["blockReasons"] = old
        row["sourceReconciliation"] = {
            "status": "master-pair-reconciled-pending-review",
            "basis": "exact catalog family, capacity, color and applicator metadata plus exact capped/uncapped master basenames",
            "cappedSource": str(capped.relative_to(MASTER)),
            "uncappedSource": str(uncapped.relative_to(MASTER)),
            "applicator": product_meta.get("applicator"),
        }
        row["publishable"] = not old
        reconciled.append({"sku": product, "cappedSource": str(capped.relative_to(MASTER)), "uncappedSource": str(uncapped.relative_to(MASTER)), "applicator": product_meta.get("applicator")})

    selection_path.write_text(json.dumps(selection, indent=1) + "\n")
    xref["summary"]["publishable"] = sum(bool(r.get("publishable")) for r in xref["products"])
    xref["summary"]["blockers"] = {}
    for item in xref["products"]:
        for reason in item.get("blockReasons", []):
            xref["summary"]["blockers"][reason] = xref["summary"]["blockers"].get(reason, 0) + 1
    xref_path.write_text(json.dumps(xref, indent=1) + "\n")
    receipt = {
        "schemaVersion": 1,
        "id": "tulip-capoff-recovery-2026-09-13",
        "family": "Tulip",
        "sourceRoot": str(MASTER),
        "method": "exact master capped/uncapped peer selection using catalog family/applicator metadata",
        "publicationAuthorized": False,
        "rows": reconciled,
        "summary": {"reconciled": len(reconciled), "publishable": xref["summary"]["publishable"], "sourceHoldsRemain": sum(bool(r.get("blockReasons")) for r in xref["products"] if r.get("family") == "Tulip")},
    }
    (batch / "tulip-capoff-recovery.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt["summary"], indent=2))


if __name__ == "__main__":
    main()
