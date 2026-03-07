#!/usr/bin/env python3
"""
Build a refined audit cohort of product URLs for target glass bottle families.

Uses Convex snapshot as the primary source of truth, with optional union of
sitemap URLs that pass strict inclusion rules. Excludes aluminum, lotion,
plastic, and decorative products that slip in via loose slug matching.

Usage:
  python scripts/build_audit_cohort.py --convex data/audits/2026-03-06/convex_snapshot.json \\
    --families "Cylinder,Boston Round,Royal,Square,Elegant" \\
    --output data/audits/2026-03-06/cohort_urls.json

  python scripts/build_audit_cohort.py --convex data/audits/2026-03-06/convex_snapshot.json \\
    --families "Cylinder,Boston Round,Royal,Square,Elegant" \\
    --union-sitemap \\
    --output data/audits/2026-03-06/cohort_urls.json
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def resolve_path(p: Path) -> Path:
    """Resolve relative paths against project root."""
    if not p.is_absolute():
        return (ROOT / p).resolve()
    return p
SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# Target families: glass bottle design families only
DEFAULT_FAMILIES = ["Cylinder", "Boston Round", "Royal", "Square", "Elegant"]

# Family-specific URL patterns that indicate valid glass-bottle PDPs.
FAMILY_URL_PATTERNS: dict[str, list[str]] = {
    "Cylinder": [r"cylinder-design-", r"tall-cylinder-design-"],
    "Boston Round": [r"boston-round"],
    "Royal": [r"royal-design-"],
    "Square": [r"square-design-"],
    "Elegant": [r"elegant-design-"],
    "Circle": [r"circle-design-"],
    "Sleek": [r"sleek-design-"],
    "Round": [r"round-design-"],
    "Diva": [r"diva-design-"],
    "Slim": [r"slim-design-"],
    "Empire": [r"empire-design-"],
    "Rectangle": [r"rectangle-design-"],
    "Tulip": [r"tulip-design-"],
    "Grace": [r"grace-design-"],
    "Diamond": [r"diamond-design-"],
    "Flair": [r"flair-design-"],
    "Vial": [r"vial-design-", r"vial-style-"],
    "Bell": [r"bell-design-"],
    "Apothecary": [r"apothecary"],
    "Pillar": [r"pillar-design-"],
    "Teardrop": [r"teardrop-design-"],
}

# URL path patterns to exclude (aluminum, lotion, plastic, decorative)
EXCLUDE_PATTERNS = [
    r"cylinder-shaped",        # Aluminum cylinder-shaped bottles
    r"Cylinder-shaped",
    r"Lotion-bottle",
    r"Lotion-bottle-",
    r"Aluminum",
    r"aluminum",
    r"plastic-bottle",
    r"PbClear",
    r"PbNat",
    r"Royal-Cylindrical-decorative",  # Decorative, not core Royal glass
]


def fetch_sitemap() -> list[str]:
    req = urllib.request.Request(SITEMAP_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as response:
        xml_text = response.read().decode("utf-8", errors="replace")
    root = ET.fromstring(xml_text)
    urls: list[str] = []
    for child in root:
        for sub in child:
            if "loc" in sub.tag and sub.text and "/product/" in sub.text:
                urls.append(sub.text.strip())
    return urls


def get_include_patterns(families: list[str]) -> list[str]:
    patterns: list[str] = []
    for family in families:
        patterns.extend(FAMILY_URL_PATTERNS.get(family, []))
    return patterns


def url_passes_strict_filter(url: str, families: list[str]) -> bool:
    path = url.rstrip("/").split("/product/")[-1] if "/product/" in url else ""
    if any(re.search(p, path, re.I) for p in EXCLUDE_PATTERNS):
        return False
    include_patterns = get_include_patterns(families)
    return any(re.search(p, path, re.I) for p in include_patterns)


def build_cohort_from_convex(
    convex_path: Path,
    families: list[str],
    category_filter: str = "Glass Bottle",
) -> tuple[list[str], dict[str, Any]]:
    payload = json.loads(resolve_path(convex_path).read_text(encoding="utf-8"))
    products = payload.get("products", [])
    family_set = {f.strip().lower() for f in families if f.strip()}
    urls: list[str] = []
    by_family: dict[str, int] = {}
    excluded_by_url = 0
    for p in products:
        fam = str(p.get("family") or "").strip().lower()
        cat = str(p.get("category") or "").strip()
        if fam not in family_set:
            continue
        if category_filter and cat.lower() != category_filter.lower():
            continue
        u = (p.get("productUrl") or "").strip()
        if not u:
            continue
        if not url_passes_strict_filter(u, families):
            excluded_by_url += 1
            continue
        if u not in urls:
            urls.append(u)
            by_family[fam] = by_family.get(fam, 0) + 1
    return urls, {
        "fromConvex": len(urls),
        "excludedByStrictUrlFilter": excluded_by_url,
        "byFamily": by_family,
    }


def union_sitemap_strict(urls: list[str], families: list[str]) -> tuple[list[str], int]:
    sitemap_urls = fetch_sitemap()
    existing = set(urls)
    added = 0
    for u in sitemap_urls:
        if u in existing:
            continue
        if url_passes_strict_filter(u, families):
            urls.append(u)
            existing.add(u)
            added += 1
    return urls, added


def main() -> None:
    parser = argparse.ArgumentParser(description="Build refined audit cohort URL list")
    parser.add_argument("--convex", type=Path, required=True, help="Path to convex_snapshot.json")
    parser.add_argument(
        "--families",
        type=str,
        default=",".join(DEFAULT_FAMILIES),
        help="Comma-separated family names",
    )
    parser.add_argument(
        "--category",
        type=str,
        default="Glass Bottle",
        help="Convex category filter (default: Glass Bottle)",
    )
    parser.add_argument(
        "--union-sitemap",
        action="store_true",
        help="Union with sitemap URLs that pass strict inclusion rules",
    )
    parser.add_argument("--output", type=Path, required=True, help="Output JSON path")
    args = parser.parse_args()

    convex_path = resolve_path(args.convex)
    output_path = resolve_path(args.output)

    if not convex_path.exists():
        raise SystemExit(f"Convex snapshot not found: {args.convex}")

    families = [f.strip() for f in args.families.split(",") if f.strip()]
    urls, stats = build_cohort_from_convex(convex_path, families, args.category)
    sitemap_added = 0
    if args.union_sitemap:
        urls, sitemap_added = union_sitemap_strict(urls, families)
        stats["fromSitemapUnion"] = sitemap_added

    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "families": families,
        "categoryFilter": args.category,
        "unionSitemap": args.union_sitemap,
        "stats": stats,
        "urlCount": len(urls),
        "urls": sorted(urls),
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Built cohort: {len(urls)} URLs")
    print(f"  From Convex: {stats['fromConvex']}")
    print(f"  Excluded by strict URL filter: {stats['excludedByStrictUrlFilter']}")
    if args.union_sitemap:
        print(f"  From sitemap union: {sitemap_added}")
    print(f"  Saved: {output_path}")


if __name__ == "__main__":
    main()
