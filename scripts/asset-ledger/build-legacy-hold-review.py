#!/usr/bin/env python3
"""Build the visual page for the plate rows held with no candidate.

One card per held row, showing the product's legacy photograph, so the scope
decision is made against bottles rather than against an empty text card.

Read-only: the page approves, indexes and publishes nothing.

  python3 scripts/asset-ledger/build-legacy-hold-review.py
"""
import html, json, time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/reviews/legacy-hold-evidence/index.html"

CSS = """
*{box-sizing:border-box}
body{margin:0;padding:28px 22px 64px;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#23211e;background:#faf8f5}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
.lede{margin:0 0 18px;color:#5c574f;max-width:80ch}
.note{border:1px solid #e3d9c6;background:#fdf8ed;border-radius:10px;padding:12px 14px;margin:0 0 26px;max-width:100ch;color:#5a4c32}
.note strong{color:#3f382b}
h2{font-size:16px;margin:34px 0 12px;padding-bottom:7px;border-bottom:1px solid #e7e1d6;letter-spacing:.01em}
h2 span{color:#8a8376;font-weight:400;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:16px}
.card{border:1px solid #e7e1d6;border-radius:10px;background:#fff;overflow:hidden;display:flex;flex-direction:column}
.shot{aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;background:#f5f3ef;padding:10px}
.shot img{max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply}
.meta{padding:10px 12px 12px;border-top:1px solid #efeae1}
.sku{font:600 12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.name{color:#6b655b;font-size:12px;margin:5px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.tag{display:inline-block;margin-top:8px;font-size:11px;color:#6d6456;background:#f2ede3;border-radius:999px;padding:2px 8px}
a{color:#7a6a46}
"""


def main():
    data = json.loads((ROOT / "data/asset-ledger/legacy-hold-evidence.json").read_text())
    rows = [r for r in data["rows"] if r.get("recovered")]
    by_family = defaultdict(list)
    for r in rows:
        by_family[r["family"] or "Unclassified"].append(r)

    parts = [
        "<!doctype html><meta charset=utf-8>",
        f"<title>Held plate rows · {len(rows)} products · legacy evidence</title>",
        f"<style>{CSS}</style>",
        f"<h1>Held plate rows &middot; {len(rows)} products</h1>",
        "<p class=lede>Every plate row that the acquisition packet holds with no candidate, shown with that exact "
        "product&rsquo;s photograph from the live Best Bottles site.</p>",
        "<div class=note><strong>These are not plates and not candidates.</strong> Each image is the legacy "
        "site&rsquo;s own photograph, 600&times;800 or smaller, against a 1000&times;1100 plate canvas. They are here "
        "so a decision to close these rows out is made against bottles, not against an empty card. Nothing on this "
        "page is approved, indexed, or published.</div>",
    ]
    for family in sorted(by_family, key=lambda f: (-len(by_family[f]), f)):
        items = sorted(by_family[family], key=lambda r: (r.get("capacityMl") or 0, r["sku"]))
        parts.append(f"<h2>{html.escape(family)} <span>&middot; {len(items)} held</span></h2><div class=grid>")
        for r in items:
            size = f"{r['capacityMl']} mL" if r.get("capacityMl") is not None else "size unresolved"
            link = f'<a href="{html.escape(r["legacyUrl"])}" target=_blank rel=noreferrer>legacy page</a>' if r.get("legacyUrl") else "image only"
            parts.append(
                f'<div class=card><div class=shot><img loading=lazy src="{html.escape(r["url"])}" '
                f'alt="{html.escape(r["sku"])}"></div><div class=meta>'
                f'<div class=sku>{html.escape(r["sku"])}</div>'
                f'<p class=name>{html.escape((r.get("itemName") or "")[:150])}</p>'
                f'<span class=tag>{html.escape(size)} &middot; {html.escape(r.get("role") or "")}</span> '
                f'<span class=tag>{link}</span></div></div>'
            )
        parts.append("</div>")
    parts.append(f'<p class=lede style="margin-top:34px">Generated {time.strftime("%Y-%m-%d %H:%M")} from '
                 f'data/asset-ledger/legacy-hold-evidence.json.</p>')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts))
    print(f"wrote {OUT.relative_to(ROOT)} · {len(rows)} products · {len(by_family)} families")


if __name__ == "__main__":
    main()
