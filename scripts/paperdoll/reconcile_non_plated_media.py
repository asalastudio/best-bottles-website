#!/usr/bin/env python3
"""Reconcile the exact-plate gap ledger with a live media-gap audit.

This is read-only. It never publishes plates, kits, or product media.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


ACTION_BY_STATUS = {
    "remote_only_healthy": "remote_only_plate_needed",
    "covered_local_fallback": "local_fallback_covered",
    "covered_exact_plate": "plate_alias_reconciliation",
    "source_match_pending": "identity_review",
    "no_verified_source": "source_recovery",
    "unreachable_needs_retry": "delivery_retry",
}


def read_csv(path: Path):
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def flatten_row(ledger_row, audit_row):
    source = audit_row.get("source") or {}
    shopify = audit_row.get("shopify") or {}
    convex = audit_row.get("convex") or {}
    plate = audit_row.get("plate") or {}
    fallback = audit_row.get("localFallback") or {}
    hero = audit_row.get("catalogHero") or {}
    status = audit_row["status"]
    return {
        "websiteSku": ledger_row["websiteSku"],
        "graceSku": ledger_row.get("graceSku") or audit_row.get("graceSku") or "",
        "productId": audit_row.get("productId") or "",
        "family": ledger_row.get("family") or audit_row.get("family") or "",
        "category": ledger_row.get("category") or "",
        "productGroupId": ledger_row.get("productGroupId") or "",
        "mediaStatus": status,
        "reconciliationAction": ACTION_BY_STATUS.get(status, "manual_review"),
        "priority": audit_row.get("priority") or "",
        "shopifyState": shopify.get("variantState") or "",
        "shopifyImageUrl": shopify.get("imageUrl") or "",
        "convexImageUrl": convex.get("imageUrl") or "",
        "plateImageUrl": plate.get("imageUrl") or "",
        "plateSourcePath": plate.get("sourcePath") or "",
        "localFallbackPath": fallback.get("path") or "",
        "localFallbackExists": str(bool(fallback.get("exists"))).lower(),
        "catalogHeroPath": hero.get("path") or "",
        "catalogHeroExists": str(bool(hero.get("exists"))).lower(),
        "sourceMatchKind": source.get("matchKind") or "",
        "sourcePublishable": str(bool(source.get("publishable"))).lower(),
        "legacyProductUrl": source.get("legacyProductUrl") or "",
        "reasons": " | ".join(audit_row.get("reasons") or []),
    }


def reconcile(ledger_rows, audit_rows):
    audit_by_sku = {}
    for row in audit_rows:
        sku = row.get("websiteSku")
        if not sku:
            continue
        if sku in audit_by_sku:
            raise ValueError(f"duplicate website SKU in audit: {sku}")
        audit_by_sku[sku] = row

    result = []
    for ledger_row in ledger_rows:
        sku = ledger_row.get("websiteSku")
        if not sku:
            raise ValueError("plate reconciliation row is missing websiteSku")
        if sku not in audit_by_sku:
            raise ValueError(f"non-plated SKU is missing from live audit: {sku}")
        result.append(flatten_row(ledger_row, audit_by_sku[sku]))
    return result


def build_summary(rows, audit):
    return {
        "generatedAt": (audit.get("inputs") or {}).get("productEvidenceAt"),
        "auditCommit": (audit.get("inputs") or {}).get("commit"),
        "nonPlatedSkus": len(rows),
        "byMediaStatus": dict(sorted(Counter(row["mediaStatus"] for row in rows).items())),
        "byAction": dict(sorted(Counter(row["reconciliationAction"] for row in rows).items())),
        "byPriority": dict(sorted(Counter(row["priority"] for row in rows).items())),
        "byFamily": dict(sorted(Counter(row["family"] for row in rows).items())),
    }


def write_csv(path: Path, rows):
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, summary):
    statuses = summary["byMediaStatus"]
    path.write_text(
        "# Non-plated media reconciliation\n\n"
        f"Live evidence: `{summary['generatedAt']}` at commit `{summary['auditCommit']}`.\n\n"
        f"All **{summary['nonPlatedSkus']}** website SKUs without a direct exact-plate row were matched to the live media audit.\n\n"
        "| State | SKUs | Required action |\n"
        "| --- | ---: | --- |\n"
        f"| Healthy remote image only | {statuses.get('remote_only_healthy', 0)} | Preserve the current exact image as a permanent SKU plate. |\n"
        f"| Working local fallback | {statuses.get('covered_local_fallback', 0)} | Promote the verified fallback into the exact plate index. |\n"
        f"| Exact plate under an alternate SKU key | {statuses.get('covered_exact_plate', 0)} | Reconcile the website/Grace SKU key without changing the image. |\n"
        f"| Source match pending | {statuses.get('source_match_pending', 0)} | Review identity and source comparison before creating a plate. |\n"
        f"| No verified source | {statuses.get('no_verified_source', 0)} | Recover from the legacy site or master asset library. |\n\n"
        "This report is an inventory and release aid. It does not publish or mutate catalog media.\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plate-reconciliation", type=Path, required=True)
    parser.add_argument("--media-audit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    audit = json.loads(args.media_audit.read_text())
    rows = reconcile(read_csv(args.plate_reconciliation), audit["rows"])
    summary = build_summary(rows, audit)
    args.output.mkdir(parents=True, exist_ok=True)
    write_csv(args.output / "non-plated-media-reconciliation.csv", rows)
    (args.output / "non-plated-media-reconciliation.json").write_text(json.dumps({
        "summary": summary, "rows": rows,
    }, indent=2))
    write_markdown(args.output / "non-plated-media-reconciliation.md", summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
