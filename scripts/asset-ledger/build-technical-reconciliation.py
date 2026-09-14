#!/usr/bin/env python3
"""Create a family-ordered, read-only queue for the 610 technical plate rows."""
from __future__ import annotations

import html
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "src/lib/asset-ledger/ledger.json"
OUT = ROOT / "docs/reviews/technical-plate-reconciliation-2026-09-13"
PUBLIC = ROOT / "public/reviews/technical-plate-reconciliation-2026-09-13"
DATA = ROOT / "data/asset-ledger/technical-plate-reconciliation-2026-09-13.json"


def action(row: dict) -> str:
    state = row.get("plateState")
    if row.get("stage") == "review":
        return "visual-review-existing-bytes"
    if state == "plated-legacy-source":
        return "replace-with-master-psd"
    if state == "plated-wrong-size":
        return "resolve-glass-sizing"
    if state == "plated-cap-on-only":
        return "recover-cap-off-pair"
    if (row.get("byteDecision") or {}).get("status") == "rejected":
        return "replace-rejected-image"
    if any("source" in r.lower() for r in row.get("reasons", [])):
        return "reconcile-master-source"
    return "technical-check"


def main() -> None:
    ledger = json.loads(LEDGER.read_text())
    rows = [r for r in ledger["platePlan"]["rows"] if r["stage"] in {"review", "reconcile"}]
    if len(rows) != 610:
        raise RuntimeError(f"Expected 610 technical rows, got {len(rows)}")
    records = []
    for row in rows:
        records.append({
            "sku": row["sku"], "family": row["family"], "capacityMl": row.get("capacityMl"),
            "color": row.get("color"), "applicator": row.get("applicator"), "capColor": row.get("capColor"),
            "stage": row["stage"], "plateState": row.get("plateState"), "action": action(row),
            "reasons": row.get("reasons", []), "imageUrl": row.get("imageUrl"), "sha256": row.get("sha256"),
            "sourcePath": row.get("sourcePath"), "productGroupId": row.get("productGroupId"),
        })
    records.sort(key=lambda r: (r["family"], r["action"], r.get("capacityMl") is None, r.get("capacityMl") or 0, r["sku"]))
    by_family = defaultdict(list)
    for row in records: by_family[row["family"]].append(row)
    summary = {
        "total": len(records), "review": sum(r["stage"] == "review" for r in records),
        "reconcile": sum(r["stage"] == "reconcile" for r in records),
        "families": len(by_family), "actions": dict(Counter(r["action"] for r in records)),
        "familyCounts": {family: {"total": len(rs), "review": sum(r["stage"] == "review" for r in rs), "reconcile": sum(r["stage"] == "reconcile" for r in rs), "actions": dict(Counter(r["action"] for r in rs))} for family, rs in sorted(by_family.items(), key=lambda x: (-len(x[1]), x[0]))},
    }
    visual_families = sorted(((family, len([r for r in rs if r["stage"] == "review"])) for family, rs in by_family.items() if any(r["stage"] == "review" for r in rs)), key=lambda x: (-x[1], x[0]))
    reconcile_families = sorted(((family, len([r for r in rs if r["stage"] == "reconcile"])) for family, rs in by_family.items() if any(r["stage"] == "reconcile" for r in rs)), key=lambda x: (-x[1], x[0]))
    batch_plan = {
        "visualReview": {"rows": summary["review"], "method": "one family contact sheet with one batch decision", "familyOrder": [{"family": family, "rows": count} for family, count in visual_families]},
        "technicalReconcile": {"rows": summary["reconcile"], "method": "resolve the recorded action, then prepare that family contact sheet", "familyOrder": [{"family": family, "rows": count} for family, count in reconcile_families]},
    }
    packet = {"schemaVersion": 1, "id": "technical-plate-reconciliation-2026-09-13", "scope": "plate-plan rows at review or reconcile", "summary": summary, "batchPlan": batch_plan, "ledgerGeneratedAt": ledger["generatedAt"], "generatedAt": datetime.now(timezone.utc).isoformat(), "rows": records}
    OUT.mkdir(parents=True, exist_ok=True); PUBLIC.mkdir(parents=True, exist_ok=True)
    (OUT / "packet.json").write_text(json.dumps(packet, indent=2))
    DATA.write_text(json.dumps(packet, indent=2))
    cards = []
    for family, rs in sorted(by_family.items(), key=lambda x: (-len(x[1]), x[0])):
        action_counts = Counter(r["action"] for r in rs)
        batch_link = ''
        if any(r["stage"] == "review" for r in rs):
            batch_url = html.escape(f"/team/asset-ledger?preview=1&view=plates&family={family}&scope=cap-on-appearance", quote=True)
            batch_link = f'<a href="{batch_url}">Open cap-on batch review →</a>'
        items = "".join(f'<li><strong>{html.escape(r["sku"])}</strong> · {html.escape(str(r.get("capacityMl") or "size unresolved"))} mL · {html.escape(str(r.get("color") or "color unresolved"))}<span class="tag {html.escape(r["stage"])}">{html.escape(r["stage"])}</span><span class="action">{html.escape(r["action"])}</span><p>{html.escape(" ".join(r["reasons"]))}</p><details><summary>Evidence</summary><p>Current SHA-256: <code>{html.escape(str(r.get("sha256") or "not indexed"))}</code><br>Source: <code>{html.escape(str(r.get("sourcePath") or "not recorded"))}</code></p></details></li>' for r in rs)
        cards.append(f'<section><h2>{html.escape(family)} <small>{len(rs)} rows · {sum(r["stage"]=="review" for r in rs)} review · {sum(r["stage"]=="reconcile" for r in rs)} reconcile</small></h2><p class="summaryline">{html.escape(" · ".join(f"{n} {a}" for a,n in sorted(action_counts.items())))} {batch_link}</p><ol>{items}</ol></section>')
    visual_order = html.escape(" → ".join(f"{family} ({count})" for family, count in visual_families))
    reconcile_order = html.escape(" → ".join(f"{family} ({count})" for family, count in reconcile_families))
    doc = f'''<!doctype html><meta charset="utf-8"><title>Technical plate reconciliation · 610 rows</title><style>body{{font:15px system-ui;background:#f5f3ef;color:#243b30;margin:0}}main{{max-width:1320px;margin:auto;padding:32px}}h1{{margin:0 0 8px}}.notice{{background:#fff;border:1px solid #c7d6c9;border-radius:12px;padding:18px;margin:18px 0}}.notice strong{{display:block;margin-bottom:6px}}.notice p{{margin:6px 0;color:#65776b}}.notice.visual{{border-color:#b8d2df;background:#f5fafc}}.notice.reconcile{{border-color:#d8c79f;background:#fffaf0}}section{{background:#fff;border:1px solid #d7ded8;border-radius:12px;padding:18px;margin:18px 0}}h2{{margin:0 0 6px;font-size:20px}}h2 small{{font-size:13px;color:#6c7e72;font-weight:400}}.summaryline{{color:#5e7465}}li{{padding:10px 0;border-top:1px solid #e4e9e3}}li:first-child{{border-top:0}}li p{{color:#65776b;margin:6px 0;font-size:13px}}.tag,.action{{display:inline-block;border-radius:999px;padding:3px 7px;margin-left:8px;font-size:11px}}.tag.review{{background:#edf4f8;color:#315f7e}}.tag.reconcile{{background:#faf4e6;color:#86611f}}.action{{background:#f0f3ef;color:#566d5b}}code{{font-size:11px;word-break:break-all}}</style><main><h1>Technical plate reconciliation · 610 rows</h1><p>Family-ordered work queue generated from the current ledger. This page is read-only by design: it does not replace, approve, index, or publish a plate.</p><div class="notice visual"><strong>How you take action: review 316 existing-image rows in family batches.</strong><p>We will create one contact sheet per family. You review the whole sheet and save one batch decision; you do not approve individual rows here. Order: {visual_order or 'none'}.</p></div><div class="notice reconcile"><strong>294 reconciliation rows are preparation work before approval.</strong><p>Resolve the recorded source, size, pairing, or technical finding first. Then the passing rows move into the same family contact-sheet approval flow. Order: {reconcile_order or 'none'}.</p></div><div class="notice"><strong>{summary["review"]} rows need visual review of existing bytes.</strong> <strong>{summary["reconcile"]} rows need technical reconciliation.</strong> The largest queues are {html.escape(", ".join(f"{family} ({len(rs)})" for family, rs in sorted(by_family.items(), key=lambda x: -len(x[1]))[:5]))}. Every action below remains bound to the exact current SKU and SHA-256.</div>{"".join(cards)}</main>'''
    (OUT / "index.html").write_text(doc); (PUBLIC / "index.html").write_text(doc)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
