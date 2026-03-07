#!/usr/bin/env python3
"""Scrape live bestbottles product pages into a dated audit folder."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
DEFAULT_BROWSERLESS_BASE_URL = "https://production-sfo.browserless.io"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

SPEC_LABELS = [
    "Item Type",
    "Item Name",
    "Item Description",
    "Item Capacity",
    "Item Height with Cap",
    "Item Height without Cap",
    "Item Diameter",
    "Item Width",
    "Item Depth",
    "Neck Thread Size",
    "Closure Type",
]
STOP_PATTERN = "|".join(re.escape(label) for label in SPEC_LABELS)
LABEL_TO_FIELD = {
    "Item Type": "itemType",
    "Item Name": "itemName",
    "Item Description": "itemDescription",
    "Item Capacity": "capacity",
    "Item Height with Cap": "heightWithCap",
    "Item Height without Cap": "heightWithoutCap",
    "Item Diameter": "diameter",
    "Item Width": "width",
    "Item Depth": "depth",
    "Neck Thread Size": "neckThreadSize",
    "Closure Type": "closureType",
}


def load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


def slugify_family_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")


def filter_urls_by_families(urls: list[str], families: list[str]) -> list[str]:
    if not families:
        return urls
    family_slugs = {slugify_family_name(f) for f in families if f.strip()}
    return [url for url in urls if any(f"/product/{slug}" in url.lower() or f"-{slug}-" in url.lower() for slug in family_slugs)]


def load_cohort_urls(path: Path) -> list[str]:
    """Load URL list from cohort JSON (from build_audit_cohort.py)."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("urls", [])


def fetch_text(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_via_browserless(url: str, timeout: int = 45) -> str:
    token = os.environ.get("BROWSERLESS_API_TOKEN")
    if not token:
        raise RuntimeError("Missing BROWSERLESS_API_TOKEN")

    base_url = os.environ.get("BROWSERLESS_BASE_URL", DEFAULT_BROWSERLESS_BASE_URL).rstrip("/")
    endpoint = f"{base_url}/content?token={token}"
    payload = json.dumps({"url": url}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_product_page(url: str, fetch_mode: str, timeout: int = 45) -> tuple[str, str]:
    if fetch_mode == "direct":
        return fetch_text(url, timeout=min(timeout, 20)), "direct"
    if fetch_mode == "browserless":
        return fetch_via_browserless(url, timeout=timeout), "browserless"

    try:
        return fetch_via_browserless(url, timeout=timeout), "browserless"
    except Exception:
        return fetch_text(url, timeout=min(timeout, 20)), "direct"


def parse_sitemap_urls(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    urls: list[str] = []
    for child in root:
        for sub in child:
            if "loc" in sub.tag and sub.text and "/product/" in sub.text:
                urls.append(sub.text.strip())
    return urls


def strip_html_to_text(html: str) -> str:
    no_script = re.sub(r"<script.*?</script>", " ", html, flags=re.I | re.S)
    no_style = re.sub(r"<style.*?</style>", " ", no_script, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", no_style)
    return re.sub(r"\s+", " ", text).strip()


def extract_specs(page_text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for label in SPEC_LABELS:
        pattern = (
            rf"{re.escape(label)}:\s*(.+?)(?=(?:{STOP_PATTERN})\:|1\s*pcs?\s*[-–]|\Z)"
        )
        match = re.search(pattern, page_text, flags=re.I | re.S)
        if not match:
            continue
        value = re.sub(r"\s+", " ", match.group(1)).strip()
        value = re.sub(r"\s*Purchase:.*$", "", value, flags=re.I).strip()
        value = re.sub(r"\s*Nemat International.*$", "", value, flags=re.I).strip()
        field = LABEL_TO_FIELD[label]
        if value:
            data[field] = value
    return data


def extract_prices(page_text: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    one_pc = re.search(r"1\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    ten_pc = re.search(r"10\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    twelve_pc = re.search(r"12\s*pcs?\s*[-–]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
    if one_pc:
        out["webPrice1pc"] = float(one_pc.group(1))
    if ten_pc:
        out["webPrice10pc"] = float(ten_pc.group(1))
    if twelve_pc:
        out["webPrice12pc"] = float(twelve_pc.group(1))
    return out


def extract_website_sku(html: str, page_text: str, url: str) -> tuple[str | None, str | None]:
    # Most reliable source on these pages is still "Item Name: SKU"
    sku_match = re.search(r"Item Name:\s*([A-Za-z0-9._-]+)", page_text, re.I)
    if sku_match:
        return sku_match.group(1).strip(), "item_name_label"

    image_match = re.search(
        r"""src=["'][^"']*(?:enlarged_pics|store/capped)/([^"'/]+\.(?:jpg|jpeg|png|webp))["']""",
        html,
        re.I,
    )
    if image_match:
        return image_match.group(1).rsplit(".", 1)[0].strip(), "image_filename"

    url_tail = url.rstrip("/").split("/")[-1]
    if url_tail:
        cleaned = re.sub(r"[^A-Za-z0-9._-]", "", url_tail) or None
        if cleaned:
            return cleaned, "url_tail"
        return None, None
    return None, None


def get_default_audit_dir() -> Path:
    day = datetime.now().strftime("%Y-%m-%d")
    return ROOT / "data" / "audits" / day


def build_payload(
    *,
    fetch_mode: str,
    requested_families: list[str],
    transport_counts: dict[str, int],
    scraped: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    processed_count: int,
    total_url_count: int,
    status: str,
) -> dict[str, Any]:
    return {
        "generatedAt": datetime.now().isoformat(),
        "source": "bestbottles.com sitemap + product pages",
        "fetchMode": fetch_mode,
        "families": requested_families,
        "transportCounts": transport_counts,
        "count": len(scraped),
        "errorCount": len(errors),
        "processedCount": processed_count,
        "remainingCount": max(total_url_count - processed_count, 0),
        "totalUrlCount": total_url_count,
        "status": status,
        "completed": status == "completed",
        "products": scraped,
        "errors": errors,
    }


def save_payload(output_path: Path, payload: dict[str, Any]) -> None:
    temp_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp_path.replace(output_path)


def load_payload(output_path: Path) -> dict[str, Any] | None:
    if not output_path.exists():
        return None
    return json.loads(output_path.read_text(encoding="utf-8"))


def main() -> None:
    load_env_local()
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=get_default_audit_dir())
    parser.add_argument("--limit", type=int, default=0, help="Optional URL limit")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay between requests")
    parser.add_argument(
        "--families",
        type=str,
        default="",
        help="Comma-separated family names to restrict the scrape, e.g. 'Cylinder,Boston Round'",
    )
    parser.add_argument(
        "--fetch-mode",
        choices=["auto", "browserless", "direct"],
        default="auto",
        help="How product pages should be fetched",
    )
    parser.add_argument(
        "--urls-file",
        type=Path,
        default=None,
        help="Path to cohort_urls.json from build_audit_cohort.py (overrides --families)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from an existing live_scrape_raw.json checkpoint in the output directory",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / "live_scrape_raw.json"

    if args.urls_file and args.urls_file.exists():
        urls = load_cohort_urls(args.urls_file)
        requested_families = []  # Cohort is pre-filtered
        print(f"Loaded {len(urls)} URLs from cohort: {args.urls_file}")
    else:
        print(f"Fetching sitemap: {SITEMAP_URL}")
        sitemap_xml = fetch_text(SITEMAP_URL)
        urls = parse_sitemap_urls(sitemap_xml)
        requested_families = [value.strip() for value in args.families.split(",") if value.strip()]
        if requested_families:
            urls = filter_urls_by_families(urls, requested_families)
            print(f"Filtered to {len(urls)} product URLs across families: {', '.join(requested_families)}")
    if args.limit > 0:
        urls = urls[: args.limit]
    print(f"Will scrape {len(urls)} product URLs")

    total_url_count = len(urls)
    scraped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    transport_counts = {"browserless": 0, "direct": 0}
    processed_count = 0
    urls_to_process = urls

    if args.resume:
        existing_payload = load_payload(output_path)
        if existing_payload is None:
            print(f"No checkpoint found at {output_path}; starting fresh.")
        else:
            existing_total = existing_payload.get("totalUrlCount")
            if existing_total not in (None, total_url_count):
                raise RuntimeError(
                    f"Checkpoint totalUrlCount={existing_total} does not match current URL count={total_url_count}"
                )

            existing_fetch_mode = existing_payload.get("fetchMode")
            if existing_fetch_mode and existing_fetch_mode != args.fetch_mode:
                raise RuntimeError(
                    f"Checkpoint fetchMode={existing_fetch_mode} does not match requested fetchMode={args.fetch_mode}"
                )

            scraped = list(existing_payload.get("products", []))
            errors = list(existing_payload.get("errors", []))
            existing_transport_counts = existing_payload.get("transportCounts", {})
            transport_counts = {
                "browserless": int(existing_transport_counts.get("browserless", 0)),
                "direct": int(existing_transport_counts.get("direct", 0)),
            }

            processed_urls = {
                item.get("productUrl")
                for item in scraped
                if isinstance(item, dict) and item.get("productUrl")
            }
            processed_urls.update(
                item.get("productUrl")
                for item in errors
                if isinstance(item, dict) and item.get("productUrl")
            )
            urls_to_process = [url for url in urls if url not in processed_urls]
            processed_count = len(processed_urls)

            print(
                "Resuming from checkpoint: "
                f"processed={processed_count} scraped={len(scraped)} errors={len(errors)} "
                f"remaining={len(urls_to_process)}"
            )

            if processed_count >= total_url_count:
                save_payload(
                    output_path,
                    build_payload(
                        fetch_mode=args.fetch_mode,
                        requested_families=requested_families,
                        transport_counts=transport_counts,
                        scraped=scraped,
                        errors=errors,
                        processed_count=processed_count,
                        total_url_count=total_url_count,
                        status="completed",
                    ),
                )
                print(f"Checkpoint already covers all URLs: {output_path}")
                return

    try:
        for url in urls_to_process:
            try:
                html, transport = fetch_product_page(url, args.fetch_mode)
                transport_counts[transport] = transport_counts.get(transport, 0) + 1
                text = strip_html_to_text(html)
                entry: dict[str, Any] = {"productUrl": url, "fetchTransport": transport}
                entry.update(extract_specs(text))
                entry.update(extract_prices(text))
                sku, sku_source = extract_website_sku(html, text, url)
                if sku:
                    entry["websiteSku"] = sku
                    entry["websiteSkuSource"] = sku_source
                scraped.append(entry)
            except Exception as exc:  # noqa: BLE001
                errors.append({"productUrl": url, "error": str(exc)})

            processed_count += 1
            if processed_count % 50 == 0 or processed_count == total_url_count:
                print(
                    f"[{processed_count}/{total_url_count}] scraped={len(scraped)} errors={len(errors)} "
                    f"browserless={transport_counts.get('browserless', 0)} direct={transport_counts.get('direct', 0)}"
                )
                save_payload(
                    output_path,
                    build_payload(
                        fetch_mode=args.fetch_mode,
                        requested_families=requested_families,
                        transport_counts=transport_counts,
                        scraped=scraped,
                        errors=errors,
                        processed_count=processed_count,
                        total_url_count=total_url_count,
                        status="in_progress",
                    ),
                )
            time.sleep(args.delay)
    except KeyboardInterrupt:
        print("Interrupted; saving partial scrape output before exit...")
        save_payload(
            output_path,
            build_payload(
                fetch_mode=args.fetch_mode,
                requested_families=requested_families,
                transport_counts=transport_counts,
                scraped=scraped,
                errors=errors,
                processed_count=processed_count,
                total_url_count=total_url_count,
                status="interrupted",
            ),
        )
        print(f"Saved partial scrape output: {output_path}")
        return

    save_payload(
        output_path,
        build_payload(
            fetch_mode=args.fetch_mode,
            requested_families=requested_families,
            transport_counts=transport_counts,
            scraped=scraped,
            errors=errors,
            processed_count=processed_count,
            total_url_count=total_url_count,
            status="completed",
        ),
    )
    print(f"Saved scrape output: {output_path}")


if __name__ == "__main__":
    main()
