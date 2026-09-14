#!/usr/bin/env python3
"""Build a read-only Tulip 6 mL clear cap-off review packet.

The packet is deliberately limited to the clear family named by Jordan's
master PSD path. It copies the exact prepared plate bytes, downloads the exact
currently indexed cap-on bytes for same-zoom comparison, and records every
source/image SHA-256. It does not mutate the ledger, approve a plate, upload a
plate, or publish anything.
"""
from __future__ import annotations

import hashlib
import html
import json
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master").resolve(strict=True)
BATCH = ROOT / "dist/paper-doll/technical-reconciliation-2026-09-13/tulip"
PLATES = BATCH / "plates/manifest.json"
LEDGER = ROOT / "src/lib/asset-ledger/ledger.json"
CATALOG = ROOT / "dist/paper-doll/catalog-plates-2026-09-12/catalog.json"
LOCAL_CURRENT_ROOT = ROOT / "public/images/plate-contact-sheets"
DOCS = ROOT / "docs/reviews/tulip-clear-capoff-recovery-2026-09-13"
PUBLIC = ROOT / "public/reviews/tulip-clear-capoff-recovery-2026-09-13"
CLEAR_FAMILY_ID = "tulip-6ml-clear-13-415"
CLEAR_SOURCE_FOLDER = "5.  13-415 Bottles/19. Tulip 6ml Clear/1. Tulip 6ml (Uncapped) PSD "
CLEAR_SOURCE_PREFIX = str((MASTER / CLEAR_SOURCE_FOLDER).resolve())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch_exact(url: str, destination: Path, expected: str) -> int:
    request = urllib.request.Request(url, headers={"User-Agent": "Best-Bottles-asset-review/1"})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    destination.write_bytes(data)
    actual = sha256(destination)
    if actual != expected:
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"current bytes changed for {url}: expected {expected}, got {actual}")
    return len(data)


def visible_box(path: Path) -> list[int] | None:
    """Return the non-white pixel box as [left, top, right, bottom]."""
    with Image.open(path).convert("RGB") as image:
        pixels = image.load()
        points = [(x, y) for y in range(image.height) for x in range(image.width) if min(pixels[x, y]) < 248]
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return [min(xs), min(ys), max(xs) + 1, max(ys) + 1]


def esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def image(path: str, label: str, alt: str, record: dict | None = None) -> str:
    box = (record or {}).get("visibleBox")
    metric = f'<span class="metric">1000 × 1100 canvas · visible box {" × ".join(str(v) for v in box)}</span>' if box else '<span class="metric">1000 × 1100 canvas</span>'
    return f'<figure><figcaption>{esc(label)}{metric}</figcaption><a href="{esc(path)}" target="_blank" rel="noreferrer"><img src="{esc(path)}" width="1000" height="1100" loading="lazy" alt="{esc(alt)}"></a></figure>'


def main() -> None:
    plate_manifest = json.loads(PLATES.read_text())
    ledger = json.loads(LEDGER.read_text())
    catalog = {row["websiteSku"]: row for row in json.loads(CATALOG.read_text())["products"]}
    ledger_rows = {row["sku"]: row for row in ledger["rows"] if row.get("family") == "Tulip"}
    rows = [row for row in plate_manifest["rows"] if row.get("familyId") == CLEAR_FAMILY_ID]
    if len(rows) != 29:
        raise RuntimeError(f"Expected 29 Tulip clear prepared rows, got {len(rows)}")
    if any(not row.get("plateCapOff", {}).get("sourceRelPath", "").startswith(CLEAR_SOURCE_FOLDER) for row in rows):
        raise RuntimeError("An clear cap-off source is outside Jordan's supplied master folder")

    assets = DOCS / "assets"
    if DOCS.exists():
        shutil.rmtree(DOCS)
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    assets.mkdir(parents=True)
    (PUBLIC / "assets").mkdir(parents=True)
    records: list[dict] = []
    for prepared in sorted(rows, key=lambda row: row["websiteSku"]):
        sku = prepared["websiteSku"]
        current = ledger_rows.get(sku)
        if not current:
            raise RuntimeError(f"Missing exact ledger identity for {sku}")
        meta = catalog.get(sku, {})
        if (meta.get("family"), meta.get("capacityMl"), meta.get("color"), meta.get("neckThreadSize")) != ("Tulip", 6, "Clear", "13-415"):
            raise RuntimeError(f"Catalog identity is not the Tulip 6 mL Clear 13-415 profile for {sku}")
        source_off = prepared["plateCapOff"]["sourceRelPath"]
        source_on = prepared["plate"]["sourceRelPath"]
        if not source_off.startswith(CLEAR_SOURCE_FOLDER) or not source_on.startswith(CLEAR_SOURCE_FOLDER.replace("1. Tulip 6ml (Uncapped) PSD ", "2. Tulip 6ml (Capped) PSD ")):
            raise RuntimeError(f"Unexpected Tulip clear source pair for {sku}")

        prepared_on_src = BATCH / "plates" / prepared["plate"]["key"]
        prepared_off_src = BATCH / "plates" / prepared["plateCapOff"]["key"]
        if not prepared_on_src.is_file() or not prepared_off_src.is_file():
            raise RuntimeError(f"Prepared rendered pair missing for {sku}")
        if sha256(prepared_on_src) != prepared["plate"]["sha256"] or sha256(prepared_off_src) != prepared["plateCapOff"]["sha256"]:
            raise RuntimeError(f"Prepared rendered bytes changed for {sku}")
        on_name = f"{sku}.on.webp"
        off_name = f"{sku}.off.webp"
        shutil.copy2(prepared_on_src, assets / on_name)
        shutil.copy2(prepared_off_src, assets / off_name)
        shutil.copy2(prepared_on_src, PUBLIC / "assets" / on_name)
        shutil.copy2(prepared_off_src, PUBLIC / "assets" / off_name)

        current_url = current.get("plate", {}).get("imageUrl")
        current_name = f"{sku}.current-on.webp"
        current_record = None
        if current_url:
            expected_current = current["plate"].get("sha256", "")
            cached_current = LOCAL_CURRENT_ROOT / f"{expected_current}.webp"
            if cached_current.is_file() and sha256(cached_current) == expected_current:
                shutil.copy2(cached_current, assets / current_name)
                current_bytes = cached_current.stat().st_size
                current_origin = "local plate-contact-sheet cache"
            else:
                current_bytes = fetch_exact(current_url, assets / current_name, expected_current)
                current_origin = "recorded Blob URL"
            shutil.copy2(assets / current_name, PUBLIC / "assets" / current_name)
            current_record = {"url": current_url, "sha256": expected_current, "bytes": current_bytes, "path": f"assets/{current_name}", "width": 1000, "height": 1100, "visibleBox": visible_box(assets / current_name), "verifiedFrom": current_origin}

        records.append({
            "websiteSku": sku,
            "graceSku": prepared.get("graceSku"),
            "familyId": CLEAR_FAMILY_ID,
            "family": "Tulip",
            "capacityMl": meta.get("capacityMl", current.get("capacityMl", 6)),
            "color": meta.get("color", current.get("color", "Clear")),
            "applicator": meta.get("applicator", current.get("applicator")),
            "capColor": meta.get("capColor", current.get("capColor")),
            "currentCapOn": current_record,
            "preparedCapOn": {"path": f"assets/{on_name}", "visibleBox": visible_box(assets / on_name), **prepared["plate"]},
            "preparedCapOff": {"path": f"assets/{off_name}", "visibleBox": visible_box(assets / off_name), **prepared["plateCapOff"]},
            "sources": {"capped": source_on, "uncapped": source_off, "uncappedAbsolute": str((MASTER / source_off).resolve(strict=True))},
            "status": "pending-review",
        })

    manifest = {
        "schemaVersion": 1,
        "id": "tulip-clear-capoff-recovery-2026-09-13",
        "family": "Tulip",
        "scope": "Tulip 6 mL Clear 13-415 only",
        "sourceRoot": str(MASTER),
        "userSuppliedUncappedFolder": CLEAR_SOURCE_PREFIX,
        "userSuppliedUncappedFolderRelative": CLEAR_SOURCE_FOLDER,
        "method": "exact catalog identity plus paired capped/uncapped PSD basenames in the supplied master family folder",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "ledgerGeneratedAt": ledger.get("generatedAt"),
        "approvalAuthorized": False,
        "publicationAuthorized": False,
        "summary": {"rows": len(records), "currentCapOnVerified": sum(bool(row["currentCapOn"]) for row in records), "preparedCapOn": len(records), "preparedCapOff": len(records), "amberRowsIncluded": 0},
        "rows": records,
    }
    packet_text = json.dumps(manifest, indent=2) + "\n"
    (DOCS / "manifest.json").write_text(packet_text)
    (PUBLIC / "manifest.json").write_text(packet_text)

    cards = []
    for row in records:
        current = image(row["currentCapOn"]["path"], "Current indexed cap-on", row["websiteSku"] + " current cap-on", row["currentCapOn"]) if row["currentCapOn"] else '<div class="empty">Current cap-on bytes unavailable</div>'
        prepared_on = image(row["preparedCapOn"]["path"], "Prepared cap-on · master PSD", row["websiteSku"] + " prepared cap-on", row["preparedCapOn"])
        prepared_off = image(row["preparedCapOff"]["path"], "Prepared cap-off · supplied master PSD", row["websiteSku"] + " prepared cap-off", row["preparedCapOff"])
        cards.append(f'''<article><div class="badge">PENDING REVIEW</div><p class="eyebrow">{esc(row['family'])} · 6 mL Clear · {esc(row.get('applicator'))}</p><h2>{esc(row['websiteSku'])}</h2><p class="meta">{esc(row.get('graceSku'))} · {esc(row.get('capColor'))}</p><div class="grid">{current}{prepared_on}{prepared_off}</div><details><summary>Exact source and byte evidence</summary><p><b>Capped master</b><br><code>{esc(row['sources']['capped'])}</code></p><p><b>Uncapped master</b><br><code>{esc(row['sources']['uncapped'])}</code></p><p>Prepared cap-on SHA-256<br><code>{esc(row['preparedCapOn']['sha256'])}</code></p><p>Prepared cap-off SHA-256<br><code>{esc(row['preparedCapOff']['sha256'])}</code></p><p>Current cap-on SHA-256<br><code>{esc((row['currentCapOn'] or {}).get('sha256', 'not indexed'))}</code></p></details></article>''')
    doc = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tulip 6 mL Clear · cap-off recovery review</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#f5f3ef;color:#243b30;font:15px/1.5 system-ui}}main{{max-width:1500px;margin:auto;padding:30px 22px 70px}}h1{{font:500 clamp(34px,5vw,60px)/1.08 Georgia,serif;margin:12px 0}}h2{{font:600 17px/1.2 system-ui;margin:8px 0;overflow-wrap:anywhere}}a{{color:#31573f}}.eyebrow{{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#557261;margin:0 0 7px}}.intro{{max-width:920px;color:#5b6f61}}.notice{{background:#e8f1e7;border:1px solid #bdd1bf;border-radius:12px;padding:17px 20px;margin:18px 0}}.notice strong{{display:block;margin-bottom:4px}}.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}}.stat{{background:#fff;border:1px solid #d5dfd3;border-top:4px solid #6d9675;border-radius:10px;padding:13px 15px}}.stat strong{{display:block;font-size:29px}}.meta,code{{font-size:12px;color:#617064;overflow-wrap:anywhere}}article{{background:#fff;border:1px solid #d5dfd3;border-radius:12px;padding:16px;margin:16px 0;break-inside:avoid}}.badge{{display:inline-block;border-radius:999px;background:#fff0d7;color:#795615;font-size:11px;font-weight:800;padding:4px 9px;letter-spacing:.04em}}.grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:15px}}figure{{margin:0;min-width:0}}figure img{{display:block;width:100%;height:auto;aspect-ratio:10/11;object-fit:contain;background:#fff;border:1px solid #e1e7df}}figcaption{{font-size:12px;color:#4c6655;padding:6px 0;min-height:38px}}.metric{{display:block;color:#829084;font-size:10px;margin-top:2px}}.empty{{aspect-ratio:10/11;border:1px dashed #c8d1c7;display:grid;place-items:center;color:#7c887e;text-align:center;padding:15px;font-size:13px}}details{{font-size:12px;margin-top:12px}}summary{{cursor:pointer;font-weight:700}}.toolbar{{position:sticky;top:0;background:#f5f3ef;padding:10px 0;border-bottom:1px solid #d3dbd2;z-index:2}}input{{width:100%;max-width:500px;padding:10px 12px;border:1px solid #b6c4b8;border-radius:7px;font:inherit}}footer{{margin-top:22px;color:#64776a;font-size:12px}}@media(max-width:900px){{.grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}.stats{{grid-template-columns:repeat(2,1fr)}}}}@media(max-width:600px){{main{{padding:20px 12px 55px}}.grid{{grid-template-columns:1fr}}.stats{{grid-template-columns:repeat(2,1fr)}}}}[hidden]{{display:none!important}}</style><main><a href="/team/asset-ledger?preview=1&view=plates&family=Tulip">← Tulip in asset ledger</a><p class="eyebrow" style="margin-top:25px">Plates · cap-off recovery</p><h1>Tulip 6 mL Clear</h1><p class="intro">Review the 29 exact clear capped/uncapped pairs from the master PSD folder you supplied. Every image uses the same 1000 × 1100 plate canvas. The amber Tulip family is intentionally excluded from this packet.</p><div class="notice"><strong>What this packet proves</strong> The supplied uncapped master folder contains one exact uncapped PSD for every clear catalog SKU, paired to its exact capped PSD in the sibling folder. This is a read-only review; no approval, indexing, upload, or release has happened.</div><div class="stats"><div class="stat"><strong>29</strong>clear SKUs</div><div class="stat"><strong>29</strong>prepared cap-off views</div><div class="stat"><strong>29</strong>current cap-on bytes</div><div class="stat"><strong>0</strong>amber rows included</div></div><div class="toolbar"><label for="search">Find an exact SKU, applicator, or finish</label><input id="search" type="search" placeholder="e.g. GBTulip6Roll or matte silver"></div><section id="cards">{''.join(cards)}</section><footer>Review packet: <code>tulip-clear-capoff-recovery-2026-09-13</code><br>Approval remains pending Jordan's visual review. A later approval must bind to these exact bytes; any re-render returns to review.</footer></main><script>const q=document.querySelector('#search');q.addEventListener('input',()=>{{const needle=q.value.toLowerCase();document.querySelectorAll('article').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(needle));}});</script></html>'''
    (DOCS / "index.html").write_text(doc)
    (PUBLIC / "index.html").write_text(doc)
    print(json.dumps(manifest["summary"], indent=2))


if __name__ == "__main__":
    main()
