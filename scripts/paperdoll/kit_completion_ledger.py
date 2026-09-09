#!/usr/bin/env python3
"""Build a read-only completion ledger for exact plates and photographic kits.

The ledger never publishes. It separates already indexed kits, local candidates,
explicit holds, products where a component kit is not applicable, and remaining
build work. Product records without an exact plate are reported separately.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


COMPONENT_FAMILIES = {
    "Sprayer", "Roll-On Cap", "Dropper", "Cap/Closure", "Lotion Pump",
}


def load_rows(path: Path, *keys: str):
    payload = json.loads(path.read_text())
    if isinstance(payload, list):
        return payload
    for key in keys:
        if isinstance(payload.get(key), list):
            return payload[key]
    raise ValueError(f"{path} does not contain any of {keys}")


def product_index(products):
    grouped = defaultdict(list)
    for row in products:
        if row.get("websiteSku"):
            grouped[row["websiteSku"]].append(row)
    return grouped


def one_product(rows, sku):
    matches = rows.get(sku, [])
    if not matches:
        raise ValueError(f"plate SKU has no product record: {sku}")
    identities = {
        (row.get("family"), row.get("category"), row.get("graceSku"), row.get("productGroupId"))
        for row in matches
    }
    if len(identities) != 1:
        raise ValueError(f"plate SKU has ambiguous product identity: {sku}")
    return matches[0]


def load_candidate_states(paths):
    candidates = {}
    holds = defaultdict(list)
    for path in paths:
        for row in load_rows(path, "rows", "kits", "candidates"):
            sku = row.get("websiteSku") or row.get("sku")
            if not sku:
                continue
            if row.get("status") == "candidate":
                if sku in candidates and candidates[sku].get("plateSha256") != row.get("plateSha256"):
                    raise ValueError(f"candidate plate hash conflict: {sku}")
                candidates[sku] = row
            elif row.get("reason"):
                holds[sku].append(row["reason"])
    return candidates, holds


def load_holds(paths, existing):
    holds = defaultdict(list, {sku: list(reasons) for sku, reasons in existing.items()})
    for path in paths:
        for row in load_rows(path, "rows", "holds"):
            sku = row.get("websiteSku") or row.get("sku")
            reason = row.get("reason") or row.get("detail")
            if sku and reason:
                holds[sku].append(reason)
    return {sku: list(dict.fromkeys(reasons)) for sku, reasons in holds.items()}


def load_source_readiness(paths):
    result = {}
    for path in paths:
        with path.open(newline="") as handle:
            for row in csv.DictReader(handle):
                sku = row.get("websiteSku")
                if not sku:
                    continue
                if sku in result and result[sku] != row:
                    raise ValueError(f"conflicting source-readiness rows: {sku}")
                result[sku] = row
    return result


def standalone_skus(policy_dir: Path | None):
    result = set()
    if not policy_dir or not policy_dir.exists():
        return result
    for path in policy_dir.glob("*.json"):
        result.update(json.loads(path.read_text()).get("standaloneAssemblies", []))
    return result


def build_ledger(products, plates, kits, candidates, holds, standalone, readiness=None):
    readiness = readiness or {}
    indexed = product_index(products)
    kit_by_sku = {row.get("websiteSku") or row.get("sku"): row for row in kits}
    plate_skus = set()
    rows = []
    for plate in plates:
        sku = plate.get("websiteSku") or plate.get("sku")
        if not sku or sku in plate_skus:
            raise ValueError(f"missing or duplicate plate SKU: {sku}")
        plate_skus.add(sku)
        product = one_product(indexed, sku)
        family = product.get("family") or "(unknown)"
        category = product.get("category") or "(unknown)"
        plate_hash = (plate.get("front") or {}).get("sha256")
        reason = []
        if family in COMPONENT_FAMILIES:
            state = "kit_not_applicable"
            reason.append("Component product supplies a photographed part to container kits.")
        elif sku in standalone:
            state = "kit_not_applicable"
            reason.append("Confirmed standalone assembly; no interchangeable component kit required.")
        elif sku in kit_by_sku:
            state = "kit_complete"
            kit_hash = kit_by_sku[sku].get("plateSha256")
            if plate_hash and kit_hash != plate_hash:
                state = "held_with_reason"
                reason.append(f"Indexed kit is stale for current plate: {kit_hash} != {plate_hash}")
        elif sku in candidates:
            state = "kit_candidate"
            candidate_hash = candidates[sku].get("plateSha256")
            if plate_hash and candidate_hash != plate_hash:
                state = "held_with_reason"
                reason.append(f"Candidate is stale for current plate: {candidate_hash} != {plate_hash}")
        elif sku in holds:
            state = "held_with_reason"
            reason.extend(holds[sku])
        elif sku in readiness:
            state = "held_with_reason"
            source = readiness[sku]
            if source.get("publishable", "").lower() == "true":
                reason.append("Qualified source still requires explicit component-layer mapping.")
            else:
                detail = source.get("blockReasons") or "No qualified editable source."
                reason.append("Source recovery or identity reconciliation required: " + detail)
        else:
            state = "pending_build"
        rows.append({
            "websiteSku": sku,
            "graceSku": product.get("graceSku"),
            "family": family,
            "category": category,
            "familyId": plate.get("familyId"),
            "productGroupId": product.get("productGroupId"),
            "plateSha256": plate_hash,
            "state": state,
            "reason": " | ".join(dict.fromkeys(reason)),
        })

    product_skus = set(indexed)
    missing_plate = sorted(product_skus - plate_skus)
    summary = {
        "productSkus": len(product_skus),
        "plateRows": len(rows),
        "productSkusWithoutExactPlate": len(missing_plate),
        "states": dict(sorted(Counter(row["state"] for row in rows).items())),
        "families": dict(sorted(Counter(row["family"] for row in rows).items())),
        "pendingByFamily": dict(sorted(Counter(
            row["family"] for row in rows if row["state"] == "pending_build"
        ).items(), key=lambda item: (-item[1], item[0]))),
    }
    missing_rows = []
    for sku in missing_plate:
        product = indexed[sku][0]
        missing_rows.append({
            "websiteSku": sku,
            "graceSku": product.get("graceSku"),
            "family": product.get("family"),
            "category": product.get("category"),
            "productGroupId": product.get("productGroupId"),
            "state": "plate_reconciliation",
        })
    return summary, rows, missing_rows


def write_csv(path: Path, rows):
    if not rows:
        return
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--products", type=Path, required=True)
    parser.add_argument("--plates", type=Path, required=True)
    parser.add_argument("--kits", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, action="append", default=[])
    parser.add_argument("--holds", type=Path, action="append", default=[])
    parser.add_argument("--source-readiness", type=Path, action="append", default=[])
    parser.add_argument("--policy-dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    products = load_rows(args.products, "products")
    plates = load_rows(args.plates, "plates")
    kits = load_rows(args.kits, "kits", "rows")
    candidates, candidate_holds = load_candidate_states(args.candidate)
    holds = load_holds(args.holds, candidate_holds)
    readiness = load_source_readiness(args.source_readiness)
    summary, rows, missing = build_ledger(
        products, plates, kits, candidates, holds, standalone_skus(args.policy_dir), readiness
    )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "kit-completion-ledger.json").write_text(json.dumps({
        "summary": summary, "rows": rows, "plateReconciliation": missing,
    }, indent=2))
    write_csv(args.output / "kit-completion-ledger.csv", rows)
    write_csv(args.output / "plate-reconciliation.csv", missing)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
