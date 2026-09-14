#!/usr/bin/env python3
"""Prepare exact-byte, family-batched appearance sheets for technical review rows.

This is a visual-review preparation step for existing indexed plates. It copies
the current served bytes to the local review store, verifies each SHA-256, and
creates one sheet per family. It does not replace, approve, index, or publish a
plate, and it never creates a cap-off view.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "src/lib/asset-ledger/ledger.json"
SHEETS = ROOT / "data/asset-ledger/family-plate-sheets"
IMAGES = ROOT / "public/images/plate-contact-sheets"
OUT = ROOT / "data/asset-ledger/technical-appearance-batches-2026-09-13.json"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def family_key(value: str) -> str:
    return value.lower().replace(" ", "-")


def fetch(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".public.blob.vercel-storage.com"):
        raise RuntimeError(f"Plate URL is outside the recorded asset store: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "best-bottles-technical-review/1"})
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"Plate fetch returned HTTP {response.status}: {url}")
        return response.read()


def main() -> None:
    ledger = json.loads(LEDGER.read_text())
    rows = [r for r in ledger["platePlan"]["rows"] if r["stage"] == "review"]
    if len(rows) != 316:
        raise RuntimeError(f"Expected 316 technical appearance rows, got {len(rows)}")
    by_family: dict[str, list[dict]] = defaultdict(list)
    failed: list[dict] = []
    IMAGES.mkdir(parents=True, exist_ok=True)
    for row in rows:
        try:
            if not row.get("imageUrl") or not row.get("sha256"):
                raise RuntimeError("Current plate bytes are not recorded")
            data = fetch(row["imageUrl"])
            actual = digest(data)
            if actual != row["sha256"]:
                raise RuntimeError(f"SHA-256 mismatch: expected {row['sha256']}, got {actual}")
            target = IMAGES / f"{actual}.webp"
            if target.exists():
                if digest(target.read_bytes()) != actual:
                    raise RuntimeError(f"Existing local review bytes changed: {target.name}")
            else:
                target.write_bytes(data)
            by_family[row["family"]].append({
                "sku": row["sku"], "graceSku": row.get("graceSku"), "productGroupId": row.get("productGroupId"),
                "capacityMl": row.get("capacityMl"), "color": row.get("color"), "applicator": row.get("applicator"),
                "capColor": row.get("capColor"), "itemName": row.get("itemName"), "groupSlug": row.get("groupSlug"),
                "familyId": row.get("groupSlug"), "views": [{
                    "label": "Cap on", "sourceUrl": row["imageUrl"], "sha256": actual,
                    "url": f"/images/plate-contact-sheets/{actual}.webp", "width": 1000, "height": 1100,
                }], "error": None,
            })
        except Exception as error:
            failed.append({"sku": row.get("sku"), "family": row.get("family"), "error": str(error)})
    if failed:
        raise RuntimeError(json.dumps({"failed": failed}, indent=2))
    generated = datetime.now(timezone.utc).isoformat()
    packet = {"schemaVersion": 1, "id": "technical-appearance-batches-2026-09-13", "scope": "plate-plan rows at review", "method": "one cap-on appearance decision per family; full plate and technical approval remain separate", "ledgerAt": ledger["generatedAt"], "generatedAt": generated, "families": {}}
    SHEETS.mkdir(parents=True, exist_ok=True)
    for family, family_rows in sorted(by_family.items()):
        family_rows.sort(key=lambda r: (r.get("capacityMl") is None, r.get("capacityMl") or 0, r.get("color") or "", r["sku"]))
        sheet = {"schemaVersion": 1, "id": f"technical-appearance-{family_key(family)}-2026-09-13", "family": family, "createdAt": generated, "ledgerAt": ledger["generatedAt"], "scope": "cap-on-appearance-review", "canvas": {"width": 1000, "height": 1100}, "rows": family_rows}
        path = SHEETS / f"{family_key(family)}.json"
        path.write_text(json.dumps(sheet, indent=2))
        packet["families"][family] = {"rows": len(family_rows), "sheet": str(path.relative_to(ROOT)), "reviewUrl": f"/team/asset-ledger?preview=1&view=plates&family={family}&scope=cap-on-appearance"}
    packet["summary"] = {"rows": len(rows), "families": len(by_family), "imagesVerified": len(rows), "capOffViewsAdded": 0}
    OUT.write_text(json.dumps(packet, indent=2))
    print(json.dumps(packet["summary"], indent=2))


if __name__ == "__main__":
    main()
