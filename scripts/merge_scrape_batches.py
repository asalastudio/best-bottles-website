#!/usr/bin/env python3
"""Merge multiple live scrape raw outputs by productUrl."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True, help="Merged live_scrape_raw.json path")
    parser.add_argument(
        "--inputs",
        type=Path,
        nargs="+",
        required=True,
        help="One or more live_scrape_raw.json files to merge in order",
    )
    args = parser.parse_args()

    merged_by_url: dict[str, dict] = {}
    all_errors: list[dict] = []
    families: list[str] = []
    fetch_modes: list[str] = []
    transport_counts = {"browserless": 0, "direct": 0}

    for input_path in args.inputs:
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        for product in payload.get("products", []):
            url = (product.get("productUrl") or "").strip()
            if not url:
                continue
            merged_by_url[url] = product
        for error in payload.get("errors", []):
            url = (error.get("productUrl") or "").strip()
            if url and url not in merged_by_url:
                all_errors.append(error)
        for family in payload.get("families", []):
            if family not in families:
                families.append(family)
        fetch_mode = payload.get("fetchMode")
        if fetch_mode and fetch_mode not in fetch_modes:
            fetch_modes.append(fetch_mode)
        for key, value in (payload.get("transportCounts") or {}).items():
            transport_counts[key] = transport_counts.get(key, 0) + int(value or 0)

    merged_products = list(merged_by_url.values())
    output_payload = {
        "generatedAt": datetime.now().isoformat(),
        "source": "merged live scrape batches",
        "fetchMode": ",".join(fetch_modes) if fetch_modes else None,
        "families": families,
        "transportCounts": transport_counts,
        "count": len(merged_products),
        "errorCount": len(all_errors),
        "products": merged_products,
        "errors": all_errors,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output_payload, indent=2), encoding="utf-8")
    print(f"Merged {len(args.inputs)} inputs into {args.output}")
    print(f"Products: {len(merged_products)} | Errors: {len(all_errors)}")


if __name__ == "__main__":
    main()
