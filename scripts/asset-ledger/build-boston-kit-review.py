#!/usr/bin/env python3
"""Create the review-only Boston kit contact sheet at the same 1000x1100 zoom."""
import html
import json
from pathlib import Path
from PIL import Image

ROOT = Path.cwd()
release = ROOT / "dist/paper-doll/boston-kit-release-2026-09-12"
review = ROOT / "docs/reviews/boston-kit-release-2026-09-12"
assets = review / "assets"
assets.mkdir(parents=True, exist_ok=True)
manifest = json.loads((release / "manifest.json").read_text())
plates = {r["websiteSku"]: r for r in json.loads((ROOT / "dist/paper-doll/boston-master/plates/manifest.json").read_text())["rows"]}
plate_cache = ROOT / "data/asset-ledger/plates-cache"
cards = []
for row in manifest["rows"]:
    if row.get("status") == "held":
        cards.append(f"<article class='card held'><h2>{html.escape(row['sku'])}</h2><p>Held: {html.escape(row.get('reason',''))}</p></article>")
        continue
    assembled = Image.new("RGBA", (1000, 1100), "white")
    for part in sorted(row["parts"], key=lambda p: p["zOrder"]):
        assembled.alpha_composite(Image.open(release / "parts" / part["image"]["key"]).convert("RGBA"))
    kit_path = assets / f"{row['sku']}.webp"
    assembled.convert("RGB").save(kit_path, format="WEBP", lossless=True)
    plate = plates[row["websiteSku"]]
    cached = plate_cache / f"{row['plateSha256']}.webp"
    plate_path = cached if cached.exists() else ROOT / "dist/paper-doll/boston-master/plates" / plate["plate"]["key"]
    before = assets / f"{row['sku']}-plate.webp"
    Image.open(plate_path).convert("RGB").save(before, format="WEBP", lossless=True)
    status = row["approval"]["status"]
    mode = "Dropper · assembled only" if row["completeness"] == "bodyOnly" else "Cap split · roller stays seated"
    cards.append(f"""<article class='card {status}'>
      <h2>{html.escape(row['sku'])}</h2><p><strong>{html.escape(mode)}</strong> · {status}</p>
      <div class='pair'><figure><figcaption>Current indexed plate</figcaption><img src='assets/{html.escape(before.name)}'></figure>
      <figure><figcaption>Release kit reconstruction</figcaption><img src='assets/{html.escape(kit_path.name)}'></figure></div>
      <p class='meta'>plate SHA-256 <code>{row['plateSha256']}</code><br>source SHA-256 <code>{row['sourceSha256']}</code></p>
    </article>""")
page = f"""<!doctype html><meta charset='utf-8'><title>Boston Round kit release · 2026-09-12</title>
<style>body{{font:16px system-ui;margin:32px;background:#f5f3ef;color:#243b30}}h1{{margin:0 0 8px}}.note{{max-width:1000px;background:#fff;border:1px solid #b5c7bd;border-radius:12px;padding:16px;margin:16px 0 24px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:20px}}.card{{background:#fff;border:2px solid #b5c7bd;border-radius:12px;padding:14px}}.card.approved{{border-color:#2f855a}}.card.pending{{border-color:#d69e2e}}.card.held{{border-color:#c53030}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}figure{{margin:0}}figcaption{{font-weight:650;margin-bottom:6px}}img{{width:100%;height:auto;background:white;border:1px solid #ddd}}.meta{{font-size:12px;color:#52645a;overflow-wrap:anywhere}}code{{font-size:11px}}</style>
<h1>Boston Round · kit release 2026-09-12</h1><div class='note'>Same-zoom comparison for all 25 source-qualified candidates. Green rows have a current SHA-bound approval; amber rows need re-approval after a plate-byte change; red rows are preserved holds. Publication remains gated by the exact kit ship instruction.</div><main class='grid'>{''.join(cards)}</main>"""
(review / "comparison.html").write_text(page)
(review / "manifest.json").write_text(json.dumps({"release": manifest["id"], "rows": len(manifest["rows"]), "approved": len(manifest["approvedPilotSkus"]), "pending": len(manifest["rows"]) - len(manifest["approvedPilotSkus"]), "publicationAuthorized": False}, indent=2) + "\n")
print(json.dumps({"review": str(review / "comparison.html"), "rows": len(manifest["rows"]), "approved": len(manifest["approvedPilotSkus"]), "pending": len(manifest["rows"]) - len(manifest["approvedPilotSkus"])}, indent=2))
