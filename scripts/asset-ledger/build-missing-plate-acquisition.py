#!/usr/bin/env python3
"""Build an isolated review packet for the active no-plate queue.

The packet is deliberately review-only. It copies prepared WebP candidates to
the local preview surface, records their exact master PSD and rendered-byte
hashes, and preserves every row without a defensible candidate as a hold.
It never writes to Convex, Blob storage, or the published plate index.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master").resolve(strict=True)
SCOPE = ROOT / "dist/paper-doll/missing-plates-2026-09-13/scope.json"
LEDGER = ROOT / "src/lib/asset-ledger/ledger.json"
OUT = ROOT / "docs/reviews/missing-plate-acquisition-2026-09-13"
PUBLIC = ROOT / "public/images/missing-plate-acquisition-2026-09-13"
PUBLIC_REVIEW = ROOT / "public/reviews/missing-plate-acquisition-2026-09-13"


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for block in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def source_preview(source_path: Path, out: Path) -> dict:
    """Flatten the original PSD onto a 1000x1100 white review canvas."""
    rgb = PSDImage.open(str(source_path)).composite()
    if rgb is None:
        raise RuntimeError("PSD has no composite")
    rgb = rgb.convert("RGBA")
    white = Image.new("RGBA", rgb.size, (255, 255, 255, 255))
    white.alpha_composite(rgb)
    rgb = white.convert("RGB")
    canvas = Image.new("RGB", (1000, 1100), (255, 255, 255))
    scale = min(1000 / rgb.width, 1100 / rgb.height)
    fitted = rgb.resize((max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((1000 - fitted.width) // 2, (1100 - fitted.height) // 2))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "WEBP", quality=90, method=6)
    return {"url": "/reviews/missing-plate-acquisition-2026-09-13/" + out.name,
            "sha256": sha(out), "bytes": out.stat().st_size, "width": 1000, "height": 1100}


def main() -> None:
    ledger = json.loads(LEDGER.read_text())
    missing = [r for r in ledger["platePlan"]["rows"] if r["stage"] == "missing"]
    missing_by_sku = {r["sku"]: r for r in missing}
    if len(missing_by_sku) != len(missing):
        raise RuntimeError("The active no-plate scope contains duplicate exact SKUs")
    scope = json.loads(SCOPE.read_text())
    existing = json.loads((ROOT / "data/asset-ledger/local-plate-evidence.json").read_text())
    existing_holds = {r.get("sku"): r for r in existing.get("holds", [])}
    prepared: dict[str, dict] = {}
    source_previews: dict[str, dict] = {}

    for family in scope["families"]:
        family_dir = ROOT / Path(family["catalog"]).parent
        xref_path = family_dir / "input/xref.json"
        manifest_path = family_dir / "plates/manifest.json"
        if not xref_path.exists():
            raise RuntimeError(f"Missing prepared xref for {family['family']}: {xref_path}")
        xref = json.loads(xref_path.read_text())
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"rows": []}
        manifest_by_sku = {r["websiteSku"]: r for r in manifest.get("rows", [])}
        for row in xref["products"]:
            sku = row["websiteSku"]
            if sku not in missing_by_sku or not row.get("publishable"):
                continue
            rendered = manifest_by_sku.get(sku)
            if not rendered or not rendered.get("plate"):
                continue
            plate = rendered["plate"]
            candidate_path = family_dir / "plates" / plate["key"]
            # build_plates uses a family/key path in the manifest; resolve it
            # under the isolated batch and fail closed if it escapes.
            candidate_path = candidate_path.resolve(strict=True)
            if not candidate_path.is_relative_to(family_dir.resolve()):
                raise RuntimeError(f"Candidate escapes its isolated batch: {candidate_path}")
            public_path = PUBLIC / f"{sku}.webp"
            public_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(candidate_path, public_path)
            rendered_hash = sha(candidate_path)
            if rendered_hash != plate["sha256"]:
                raise RuntimeError(f"Rendered candidate hash changed: {sku}")
            source_path = (MASTER / plate["sourceRelPath"]).resolve(strict=True)
            if not source_path.is_relative_to(MASTER):
                raise RuntimeError(f"Master source escapes canonical root: {plate['sourceRelPath']}")
            source_sha = sha(source_path)
            if source_sha != plate["sourceSha256"]:
                raise RuntimeError(f"Master source hash changed: {sku}")
            source_file = OUT / "source-previews" / f"{sku}.webp"
            source_view = source_preview(source_path, source_file)
            # The review packet is served from docs/reviews in the local Next
            # app; mirror the source preview under the same packet directory.
            packet_source = OUT / source_file.relative_to(OUT)
            source_view["url"] = "/reviews/missing-plate-acquisition-2026-09-13/source-previews/" + source_file.name
            hold = existing_holds.get(sku)
            prepared[sku] = {
                "sku": sku,
                "family": missing_by_sku[sku]["family"],
                "familyId": rendered["familyId"],
                "productGroupId": missing_by_sku[sku].get("productGroupId"),
                "capacityMl": missing_by_sku[sku].get("capacityMl"),
                "color": missing_by_sku[sku].get("color"),
                "applicator": missing_by_sku[sku].get("applicator"),
                "capColor": missing_by_sku[sku].get("capColor"),
                "status": "pending-review" if not hold else "pending-reconciliation",
                "holdReasons": hold.get("reasons", []) if hold else [],
                "presentation": "prepared cap-on candidate; cap-off not inferred",
                "source": {"library": "master", "path": plate["sourceRelPath"], "sha256": source_sha,
                           "stateEvidence": plate.get("sourceStateEvidence")},
                "sourcePreview": source_view,
                "candidate": {"url": "/images/missing-plate-acquisition-2026-09-13/" + public_path.name,
                              "path": str(public_path.relative_to(ROOT)), "sha256": rendered_hash,
                              "bytes": public_path.stat().st_size, "width": plate["width"], "height": plate["height"]},
                "batchManifest": str(manifest_path.relative_to(ROOT)),
                "preparedAt": datetime.now(timezone.utc).isoformat(),
            }
            source_previews[sku] = source_view

    rows = []
    for row in missing:
        rec = prepared.get(row["sku"])
        if rec:
            rows.append(rec)
            continue
        # Use the prepared xref blocker text where available; no row is silently
        # dropped just because the canonical master has no exact candidate.
        reasons = ["No defensible prepared candidate from BB-PSD-Files-Master."]
        for family in scope["families"]:
            xref_path = ROOT / Path(family["catalog"]).parent / "input/xref.json"
            xref = json.loads(xref_path.read_text())
            found = next((x for x in xref["products"] if x["websiteSku"] == row["sku"]), None)
            if found:
                reasons = found.get("blockReasons") or reasons
                break
        rows.append({"sku": row["sku"], "family": row["family"], "familyId": row.get("groupSlug"),
                     "productGroupId": row.get("productGroupId"), "capacityMl": row.get("capacityMl"),
                     "color": row.get("color"), "applicator": row.get("applicator"), "capColor": row.get("capColor"),
                     "status": "hold", "holdReasons": reasons, "candidate": None,
                     "source": None, "sourcePreview": None})

    rows.sort(key=lambda r: (r["family"], r.get("capacityMl") is None, r.get("capacityMl") or 0, r["sku"]))
    summary = {
        "total": len(rows),
        "candidatePrepared": sum(r["candidate"] is not None for r in rows),
        "reviewEligible": sum(r["status"] == "pending-review" for r in rows),
        "candidateHeldForPriorReconciliation": sum(r["status"] == "pending-reconciliation" for r in rows),
        "noCandidateHolds": sum(r["candidate"] is None for r in rows),
    }
    if summary["total"] != 223:
        raise RuntimeError(f"Expected 223 active missing rows, got {summary['total']}")
    OUT.mkdir(parents=True, exist_ok=True)
    packet = {"schemaVersion": 1, "id": "missing-plate-acquisition-2026-09-13", "scope": "active plate rows with stage=missing",
              "sourceRoot": str(MASTER), "canvas": {"width": 1000, "height": 1100}, "summary": summary,
              "rows": rows, "ledgerGeneratedAt": ledger["generatedAt"], "generatedAt": datetime.now(timezone.utc).isoformat()}
    (OUT / "packet.json").write_text(json.dumps(packet, indent=2))

    cards = []
    for row in rows:
        title = html.escape(f"{row['family']} · {row.get('capacityMl') or 'size unresolved'} mL · {row.get('color') or 'color unresolved'}")
        status = "Candidate prepared · awaiting review" if row["status"] == "pending-review" else "Candidate held · prior reconciliation remains" if row["status"] == "pending-reconciliation" else "Hold · no defensible candidate"
        status_class = "ready" if row["status"] == "pending-review" else "held"
        if row.get("candidate"):
            source = row["sourcePreview"]["url"]
            candidate = row["candidate"]["url"]
            visual = f'<div class="visuals"><figure><figcaption>Master PSD composite · same 1000 × 1100 review canvas</figcaption><img src="{source}" alt="Master source composite for {html.escape(row["sku"])}"></figure><figure><figcaption>Prepared plate · {row["candidate"]["sha256"][:12]}…</figcaption><img src="{candidate}" alt="Prepared plate for {html.escape(row["sku"])}"></figure></div>'
            evidence = f'<details><summary>Exact source and byte evidence</summary><p>SKU: <code>{html.escape(row["sku"])}</code><br>Master PSD: <code>{html.escape(row["source"]["path"])}</code><br>Source SHA-256: <code>{row["source"]["sha256"]}</code><br>Prepared plate SHA-256: <code>{row["candidate"]["sha256"]}</code><br>Bytes: {row["candidate"]["bytes"]}</p></details>'
        else:
            visual = '<div class="empty">No plate candidate. The row remains an explicit hold.</div>'
            evidence = f'<p class="reasons">{html.escape(" ".join(row.get("holdReasons") or []))}</p>'
        cards.append(f'<article class="card {status_class}"><div class="top"><span class="status">{status}</span><span>{title}</span></div><h2>{html.escape(row["sku"])}</h2>{visual}{evidence}</article>')
    html_doc = f'''<!doctype html><meta charset="utf-8"><title>Missing plate acquisition · 223 rows</title>
<style>body{{font:16px system-ui;background:#f5f3ef;color:#243b30;margin:0}}main{{max-width:1500px;margin:auto;padding:32px}}h1{{margin:0 0 8px}}.summary{{background:#fff;border:1px solid #c7d6c9;padding:18px;border-radius:12px;margin:18px 0}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(600px,1fr));gap:18px}}.card{{background:#fff;border:1px solid #d7ded8;border-radius:12px;padding:16px}}.card.held{{border-color:#d6b16b;background:#fffaf0}}.top{{display:flex;justify-content:space-between;gap:12px;color:#486452;font-weight:600}}.status{{padding:4px 8px;border-radius:999px;background:#e4f1e6;color:#24613d;font-size:13px}}.held .status{{background:#f7e8c8;color:#8a5b10}}h2{{font-size:16px;margin:14px 0}}.visuals{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}figure{{margin:0}}figcaption{{font-size:12px;color:#687b6f;margin:0 0 6px}}img{{width:100%;height:auto;background:#fff;border:1px solid #e5e9e5}}.empty{{padding:60px 12px;text-align:center;background:#fbefec;color:#974b45}}code{{word-break:break-all;font-size:12px}}.reasons{{color:#8a5b10}}details{{margin-top:10px}}</style>
<main><h1>Missing plate acquisition · 223 active rows</h1><p>Review-only packet sourced from <code>{html.escape(str(MASTER))}</code>. No row is indexed or published by this packet.</p><section class="summary"><strong>{summary["candidatePrepared"]} prepared candidates</strong> · {summary["reviewEligible"]} ready for visual review · {summary["candidateHeldForPriorReconciliation"]} held behind prior source decisions · {summary["noCandidateHolds"]} without a defensible candidate. A missing “before” image is intentional: these rows have no indexed plate.</section><section class="cards">{"".join(cards)}</section></main>'''
    (OUT / "index.html").write_text(html_doc)
    PUBLIC_REVIEW.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT / "index.html", PUBLIC_REVIEW / "index.html")
    if (OUT / "source-previews").exists():
        shutil.copytree(OUT / "source-previews", PUBLIC_REVIEW / "source-previews", dirs_exist_ok=True)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
