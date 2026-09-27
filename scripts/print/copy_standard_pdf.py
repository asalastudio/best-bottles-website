"""Print the product copy standard (docs/specs/pdp-item-descriptions/) as one PDF to download and keep.

    pip install markdown-it-py playwright pymupdf pillow segno
    python3 scripts/print/copy_standard_pdf.py      # writes out/print/best-bottles-copy-standard.pdf

The markdown files stay the source; this only lays them out, in the catalogue's design, with a cover,
contents and page numbers. The use-line audit (CSV) is printed as an appendix.
"""
from __future__ import annotations

import csv
import datetime as dt
import re
import sys
from pathlib import Path

from markdown_it import MarkdownIt

sys.path.insert(0, str(Path(__file__).resolve().parent))
import family_guides as fg  # noqa: E402  (fonts, wordmark, renderer)

SOURCE = fg.ROOT / "docs/specs/pdp-item-descriptions"
PARTS = [  # file, short name for the contents
    ("TEMPLATE.md", "The item description template"),
    ("COPY-STRATEGY.md", "Titles, vocabulary, claims and channels"),
    ("RUBRIC.md", "What each product type may say"),
    ("SYNTHESIS.md", "Neck sheets, register and copy: one direction"),
    ("market-research.md", "How the market writes product information"),
    ("community-research.md", "What buyers ask"),
]
AUDIT = "use-line-audit.csv"
OUT = fg.OUT / "best-bottles-copy-standard.pdf"

CSS = """
:root{--bone:#F5F3EF;--ink:#2C2C2E;--obsidian:#1D1D1F;--second:#6B6660;--rule:#DCD7D0;--sunk:#EEEAE3;--gold:#8B6F42;--gold2:#C5A065}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bone);color:var(--ink);font-family:'Montserrat',Arial,sans-serif;font-size:8.6pt;line-height:1.55;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover{page:cover;height:11in;position:relative;break-after:page}
.cover .lockup{position:absolute;top:1.1in;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:.08in}
.cover .lockup img{height:.3in}
.cover .lockup span{font-size:9.4pt;letter-spacing:.32em;text-indent:.32em;text-transform:uppercase;color:var(--obsidian)}
.cover .t{position:absolute;top:3.6in;left:.95in;right:.95in}
.cover .k{font-size:8pt;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--second)}
.cover h1{font-size:40pt;font-weight:500;line-height:1.05;letter-spacing:-.01em;color:var(--obsidian);margin:.14in 0 0}
.cover .rule{width:.6in;height:1.2pt;background:var(--gold2);margin:.26in 0 .2in}
.cover p.lede{font-size:10.4pt;line-height:1.6;max-width:5in;margin:0}
.cover .foot{position:absolute;bottom:.6in;left:.95in;right:.95in;font-size:7.4pt;color:var(--second);display:flex;justify-content:space-between}
.contents{break-after:page}
.contents h1{font-size:24pt;font-weight:600;color:var(--obsidian);margin:.06in 0 .16in}
.kicker{font-size:6.6pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--second)}
ol.toc{list-style:none;margin:0;padding:0;border-top:.75pt solid var(--ink)}
ol.toc li{display:grid;grid-template-columns:.4in 1fr auto .5in;gap:.12in;align-items:baseline;padding:.1in 0;border-bottom:.5pt solid var(--rule)}
ol.toc .n{font-size:14pt;font-weight:500;color:var(--obsidian)}
ol.toc b{display:block;font-size:10pt;font-weight:600;color:var(--obsidian)}
ol.toc span.d{font-size:7.6pt;color:var(--second)}
ol.toc .st{font-size:6.6pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:1.5pt 6pt;border-radius:8pt;white-space:nowrap}
ol.toc .p{text-align:right;color:var(--second)}
.st.locked{background:#E3EFE6;color:#3F7A57}.st.draft{background:#F5EAD2;color:#8A5F0E}.st.proposed{background:#EDE3F2;color:#6A4A86}.st.research{background:#E9E5DF;color:#6B6660}
.contents .note{font-size:7.6pt;color:var(--second);margin-top:.18in;max-width:6in}
section.part{break-before:page}
.part-head{border-bottom:.75pt solid var(--ink);padding-bottom:.1in;margin-bottom:.14in;display:flex;justify-content:space-between;align-items:flex-end;gap:.2in}
.part-head .st{font-size:6.8pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:2pt 8pt;border-radius:8pt;white-space:nowrap}
.doc h1{font-size:22pt;font-weight:600;line-height:1.15;color:var(--obsidian);margin:.02in 0 .12in;break-after:avoid}
.doc h2{font-size:13pt;font-weight:600;color:var(--obsidian);margin:.24in 0 .06in;padding-top:.08in;border-top:.5pt solid var(--rule);break-after:avoid}
.doc h3{font-size:10pt;font-weight:600;color:var(--obsidian);margin:.18in 0 .04in;break-after:avoid}
.doc h4{font-size:8.8pt;font-weight:600;color:var(--gold);margin:.16in 0 .03in;break-after:avoid;letter-spacing:.02em}
.doc p{margin:.05in 0}
.doc ul,.doc ol{margin:.04in 0 .06in;padding-left:.2in}
.doc li{margin:.02in 0}
.doc li>p{margin:.02in 0}
.doc strong{color:var(--obsidian);font-weight:600}
.doc code{font-family:'IBM Plex Mono',monospace;font-size:7.4pt;background:var(--sunk);padding:0 2pt;border-radius:2pt;overflow-wrap:anywhere}
.doc pre{background:var(--sunk);padding:.08in .1in;border-radius:3pt;white-space:pre-wrap;font-size:7.2pt;break-inside:avoid}
.doc pre code{background:none;padding:0}
.doc blockquote{margin:.08in 0;padding:.02in .14in;border-left:1.2pt solid var(--gold2);color:var(--second)}
.doc hr{border:none;border-top:.5pt solid var(--rule);margin:.16in 0}
.doc table{border-collapse:collapse;width:100%;margin:.08in 0 .12in;font-size:7.2pt;line-height:1.4}
.doc th{font-size:6pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--second);text-align:left;padding:3pt 6pt 3pt 0;border-bottom:.75pt solid var(--ink);vertical-align:bottom}
.doc td{padding:3pt 6pt 3pt 0;border-bottom:.5pt solid var(--rule);vertical-align:top;overflow-wrap:anywhere}
.doc tr{break-inside:avoid}
.doc thead{display:table-header-group}
.audit table{font-size:6.6pt}
.audit td.sku{font-family:'IBM Plex Mono',monospace;font-size:6.2pt;white-space:nowrap}
.marker{font-size:2pt;color:#F5F3EF;letter-spacing:0;text-transform:none;font-weight:400}
"""


def page_css(title: str) -> str:
    return ("@page{size:8.5in 11in;margin:.72in .7in .7in;background:#F5F3EF;"
            "@top-left{content:'BEST BOTTLES';font:600 6.4pt Montserrat;letter-spacing:.3em;color:#1D1D1F;vertical-align:bottom;padding-bottom:.12in}"
            f"@top-right{{content:'{title}';font:500 6.4pt Montserrat;letter-spacing:.14em;color:#6B6660;vertical-align:bottom;padding-bottom:.12in;text-transform:uppercase}}"
            "@bottom-left{content:'Source: docs/specs/pdp-item-descriptions';font:400 6.4pt Montserrat;color:#6B6660;vertical-align:top;padding-top:.12in}"
            "@bottom-right{content:counter(page) ' / ' counter(pages);font:400 6.4pt Montserrat;color:#6B6660;vertical-align:top;padding-top:.12in}}"
            "@page cover{margin:0;@top-left{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}")


def status_of(text: str) -> tuple[str, str]:
    m = re.search(r"^Status:\s*(.+)$", text, re.M)
    line = (m.group(1) if m else "").lower()
    if "locked" in line:
        return "locked", "Locked"
    if "draft" in line:
        return "draft", "Draft"
    if "proposed" in line:
        return "proposed", "Proposed"
    return "research", "Research"


def audit_html() -> str:
    rows = list(csv.DictReader(open(SOURCE / AUDIT, newline="")))
    body = "".join(
        f"<tr><td class=sku>{fg.esc(r['websiteSku'])}</td><td>{fg.esc(r['family'])}</td><td>{fg.esc(r['applicator'])}</td>"
        f"<td>{fg.esc(r['issues'])}</td><td>{fg.esc(r['currentUses'])}</td></tr>" for r in rows)
    return (f"<p>{len(rows)} product pages whose current \"for use with\" line lists a use the product type should not carry "
            "(RUBRIC.md §3). The rubric's excluded lists fix these when descriptions are regenerated.</p>"
            "<table><thead><tr><th>Item number</th><th>Family</th><th>Applicator</th><th>Issue</th><th>Uses listed today</th></tr></thead>"
            f"<tbody>{body}</tbody></table>")


def build(pages: dict[str, int] | None, mark: str) -> str:
    md = MarkdownIt("commonmark", {"html": False}).enable("table")
    pg = lambda k: str(pages.get(k, "00")) if pages else "00"
    toc, parts = [], []
    for n, (name, short) in enumerate(PARTS, 1):
        text = (SOURCE / name).read_text()
        key = re.sub(r"[^a-z0-9]+", "-", name.lower().removesuffix(".md"))
        cls, label = status_of(text)
        title = re.search(r"^#\s+(.+)$", text, re.M).group(1)
        toc.append(f"<li><span class=n>{n}</span><div><b>{fg.esc(title)}</b><span class=d>{fg.esc(short)} · {fg.esc(name)}</span></div>"
                   f"<span class='st {cls}'>{label}</span><span class=p>{pg(key)}</span></li>")
        parts.append(f"<section class=part><div class=part-head><span class=kicker>Part {n} · {fg.esc(name)}"
                     f"<span class=marker>§SEC:{key}§</span></span><span class='st {cls}'>{label}</span></div>"
                     f"<div class=doc>{md.render(text)}</div></section>")
    n = len(PARTS) + 1
    toc.append(f"<li><span class=n>{n}</span><div><b>Appendix: use-line audit</b><span class=d>Wrong-use lines on today's pages · {AUDIT}</span></div>"
               f"<span class='st research'>Research</span><span class=p>{pg('audit')}</span></li>")
    parts.append(f"<section class='part audit'><div class=part-head><span class=kicker>Appendix · {AUDIT}<span class=marker>§SEC:audit§</span></span>"
                 f"<span class='st research'>Research</span></div><div class=doc><h1>Use-line audit</h1>{audit_html()}</div></section>")
    cover = f"""
<section class=cover>
  <div class=lockup><img src='{mark}' alt='Best Bottles'><span>Fragrance &amp; Beauty Packaging</span></div>
  <div class=t><p class=k>Product copy standard</p><h1>Titles, descriptions and every product word</h1><div class=rule></div>
    <p class=lede>The approved description template, the naming and claims rules, the rubric for each product type, the neck-sheet
    synthesis and the research behind them, in one document.</p></div>
  <div class=foot><span>bestbottles.com · 1-800-936-3628</span><span>Printed {dt.date.today():%d %B %Y}</span></div>
</section>"""
    contents = f"""
<section class=contents><p class=kicker>Contents</p><h1>In this document</h1><ol class=toc>{''.join(toc)}</ol>
  <p class=note>Locked parts are approved by Best Bottles. Draft and proposed parts are for review. The markdown files in the
  repository remain the source; this PDF is rebuilt from them with scripts/print/copy_standard_pdf.py.</p></section>"""
    return cover + contents + "".join(parts)


def main() -> None:
    import pymupdf

    face_css, mark = fg.fonts_css(), fg.wordmark_uri()
    title = "Product copy standard"
    doc_html = lambda body: (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{title}</title>"
                             f"<style>{face_css}\n{page_css(title)}\n{CSS}</style></head><body>{body}</body></html>")
    renderer = fg.Renderer()
    try:
        path = renderer.pdf(doc_html(build(None, mark)), OUT)
        pages = {}
        for i, page in enumerate(pymupdf.open(path)):
            for key in re.findall(r"§SEC:([a-z0-9-]+)§", page.get_text()):
                pages.setdefault(key, i + 1)
        path = renderer.pdf(doc_html(build(pages, mark)), OUT)
    finally:
        renderer.close()
    print(f"{path}: {pymupdf.open(path).page_count} pages, {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
