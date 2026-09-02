#!/usr/bin/env python3
"""Standalone Best Bottles legacy-PDP probe.

Faithful port of the parsing logic in scripts/scrape_live_catalog.py so it can
run without the repo checked out. Python 3.9+, standard library only — no pip
install, no npm install, no .env.local.

Output matches the repo's live_scrape_raw.json shape exactly, so the result
drops straight into the existing audit pipeline.

Usage
-----
    python3 bb-probe.py orphan-urls.json

    # if the spec block turns out to be client-rendered:
    python3 bb-probe.py orphan-urls.json --browserless-token TOKEN
    python3 bb-probe.py orphan-urls.json --firecrawl-key KEY

Re-running resumes: URLs already present in the output file are skipped.
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# ── Ported verbatim from scripts/scrape_live_catalog.py ──────────────────────
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


def strip_html_to_text(html: str) -> str:
    no_script = re.sub(r"<script.*?</script>", " ", html, flags=re.I | re.S)
    no_style = re.sub(r"<style.*?</style>", " ", no_script, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", no_style)
    text = html_mod.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_specs(page_text: str) -> dict:
    data: dict = {}
    for label in SPEC_LABELS:
        pattern = rf"{re.escape(label)}:\s*(.+?)(?=(?:{STOP_PATTERN})\:|1\s*pcs?\s*[-\u2013]|\Z)"
        match = re.search(pattern, page_text, flags=re.I | re.S)
        if not match:
            continue
        value = re.sub(r"\s+", " ", match.group(1)).strip()
        value = re.sub(r"\s*Purchase:.*$", "", value, flags=re.I).strip()
        value = re.sub(r"\s*Nemat International.*$", "", value, flags=re.I).strip()
        if value:
            data[LABEL_TO_FIELD[label]] = value
    return data


def extract_prices(page_text: str) -> dict:
    out: dict = {}
    for qty, key in ((1, "webPrice1pc"), (10, "webPrice10pc"), (12, "webPrice12pc")):
        m = re.search(rf"{qty}\s*pcs?\s*[-\u2013]\s*\$([0-9.]+)\s*/\s*pc", page_text, re.I)
        if m:
            out[key] = float(m.group(1))
    return out


def extract_website_sku(html: str, page_text: str, url: str):
    m = re.search(r"Item Name:\s*([A-Za-z0-9._-]+)", page_text, re.I)
    if m:
        return m.group(1).strip(), "item_name_label"
    m = re.search(
        r"""src=["'][^"']*(?:enlarged_pics|store/capped)/([^"'/]+\.(?:jpg|jpeg|png|webp))["']""",
        html,
        re.I,
    )
    if m:
        return m.group(1).rsplit(".", 1)[0].strip(), "image_filename"
    tail = url.rstrip("/").split("/")[-1]
    if tail:
        cleaned = re.sub(r"[^A-Za-z0-9._-]", "", tail) or None
        if cleaned:
            return cleaned, "url_tail"
    return None, None


# ── Fetch transports ─────────────────────────────────────────────────────────
def fetch_direct(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def fetch_browserless(url: str, token: str, timeout: int = 45) -> str:
    endpoint = f"https://production-sfo.browserless.io/content?token={token}"
    payload = json.dumps({"url": url}).encode()
    req = urllib.request.Request(
        endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_firecrawl(url: str, key: str, timeout: int = 60) -> str:
    # rawHtml, not markdown — markdown reflows the label/value layout the parser needs
    payload = json.dumps({"url": url, "formats": ["rawHtml"]}).encode()
    req = urllib.request.Request(
        "https://api.firecrawl.dev/v1/scrape",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = json.loads(r.read().decode("utf-8", errors="replace"))
    return (body.get("data") or {}).get("rawHtml") or ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls_file", type=Path, help="JSON with {'urls': [...]}")
    ap.add_argument("--out", type=Path, default=Path("live_scrape_raw.json"))
    ap.add_argument("--delay", type=float, default=0.8)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--browserless-token")
    ap.add_argument("--firecrawl-key")
    args = ap.parse_args()

    urls = json.loads(args.urls_file.read_text())["urls"]
    if args.limit:
        urls = urls[: args.limit]

    products, errors, done = [], [], set()
    if args.out.exists():
        try:
            prev = json.loads(args.out.read_text())
            products = prev.get("products", [])
            errors = prev.get("errors", [])
            done = {p.get("productUrl") for p in products}
            if done:
                print(f"Resuming — {len(done)} already fetched")
        except Exception:
            pass

    if args.firecrawl_key:
        transport = "firecrawl"
    elif args.browserless_token:
        transport = "browserless"
    else:
        transport = "direct"
    print(f"Transport: {transport}   URLs: {len(urls)}\n")

    todo = [u for u in urls if u not in done]
    for i, url in enumerate(todo, 1):
        try:
            if transport == "firecrawl":
                html = fetch_firecrawl(url, args.firecrawl_key)
            elif transport == "browserless":
                html = fetch_browserless(url, args.browserless_token)
            else:
                html = fetch_direct(url)

            text = strip_html_to_text(html)
            entry = {"productUrl": url, "fetchTransport": transport}
            entry.update(extract_specs(text))
            entry.update(extract_prices(text))
            sku, src = extract_website_sku(html, text, url)
            if sku:
                entry["websiteSku"] = sku
                entry["websiteSkuSource"] = src
            products.append(entry)
        except Exception as exc:
            errors.append({"productUrl": url, "error": f"{type(exc).__name__}: {exc}"})

        if i % 10 == 0 or i == len(todo):
            got = sum(1 for p in products if p.get("neckThreadSize"))
            print(f"  {i}/{len(todo)}   neckThreadSize captured on {got}", flush=True)
            args.out.write_text(json.dumps(_payload(products, errors, transport), indent=2))

        time.sleep(args.delay)

    args.out.write_text(json.dumps(_payload(products, errors, transport), indent=2))

    got = sum(1 for p in products if p.get("neckThreadSize"))
    clos = sum(1 for p in products if p.get("closureType"))
    print(f"\nWrote {args.out}")
    print(f"  products        : {len(products)}")
    print(f"  neckThreadSize  : {got}")
    print(f"  closureType     : {clos}")
    print(f"  errors          : {len(errors)}")
    if products and got == 0:
        print("\n  !! Zero spec fields captured. The block is likely client-rendered —")
        print("     re-run with --browserless-token or --firecrawl-key.")
    return 0


def _payload(products, errors, transport):
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "bb-probe.py",
        "fetchMode": transport,
        "count": len(products),
        "errorCount": len(errors),
        "products": products,
        "errors": errors,
    }


if __name__ == "__main__":
    sys.exit(main())
