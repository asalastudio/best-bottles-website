"""The product copy review kit: which products Jordan and Abbas review, and what each review page looks like.

    python3 scripts/print/copy_review_kit.py        # writes out/print/best-bottles-copy-review-kit.pdf

Before the new descriptions are generated for every product, one sample per product type and size is reviewed
on paper (RUBRIC.md §8, Phase 4). This kit lists the 42 bottle samples and 12 parts and packaging samples, and
shows the review page with three examples written by hand. Once the generator is built, the same page is filled
for all 54 samples from the generator's own output.

Reads the product export and the register like family_guides.py; nothing is written to Convex or Shopify.
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import family_guides as fg  # noqa: E402

OUT = fg.OUT / "best-bottles-copy-review-kit.pdf"
CURRENT = fg.ROOT / "data/descriptions/pdp/item-descriptions.json"

# One bottle per product type and size band, plus the cases this review has to settle.
SAMPLES = [
    ("S01", "GBCyl5MtlRollBlkDot", "Roll-on", "Sample, 5 ml", "Samples lead the uses; 13-415 neck"),
    ("S02", "GBCylAmb9MtlRollBlkDot", "Roll-on", "Small, 6–9 ml", "Amber glass line; steel ball"),
    ("S03", "GBCylSwrl9RollBlkDot", "Roll-on", "Small, 6–9 ml", "Plastic ball; swirl glass"),
    ("S04", "GBRect10MtlRollBlkDot", "Roll-on", "Purse, 10–15 ml", "The 10 ml roll-on size"),
    ("S05", "GBBstnBlu1ozMtlRollonMattSl", "Roll-on", "Everyday, 25–60 ml", "Cobalt blue; 20-400 neck; 1 oz"),
    ("S06", "GBMtlRoll28Blk", "Roll-on", "Complete set", "16 mm neck, sold complete"),
    ("S07", "GBSpry3mlClBlk", "Fine-mist spray", "Sample, 3 ml", "12 mm neck, sold complete"),
    ("S08", "GBTulipAmb5SpryGlMatt", "Fine-mist spray", "Sample, 5 ml", "Amber; 13-415"),
    ("S09", "GBCylAmb9SpryMattSl", "Fine-mist spray", "Small, 6–9 ml", "Oil-clog Care note"),
    ("S10", "GBElg15SpryGlMatt", "Fine-mist spray", "Purse, 10–15 ml", "Decants and travel"),
    ("S11", "GBCrcl50SpryMtGl", "Perfume spray", "Everyday, 25–60 ml", "Full retail size; refill line"),
    ("S12", "GBElg30SpryMattGl", "Perfume spray", "Everyday, 25–60 ml", "15-415 neck"),
    ("S13", "GBSpry1ozGl", "Perfume spray", "Everyday, 25–60 ml", "Fixed sprayer: the 30 ml exception"),
    ("S14", "GBRndFrst128SpryMtGl", "Perfume spray", "Full, 78–128 ml", "Frosted glass line"),
    ("S15", "Alu100mlSprayBlack", "Aluminum spray", "Full, 100 ml", "Room spray and air freshener; does not break"),
    ("S16", "LBCylAmb9LtnMtSl", "Treatment pump", "Small, 9 ml", "Treatment pump name (D3)"),
    ("S17", "LBDiva30LtnMtGl", "Lotion pump", "Everyday, 25–60 ml", "Creams belong in a jar"),
    ("S18", "LBCrclFrst100LtnClOvrCap", "Lotion pump", "Full, 78–128 ml", "Clear overcap; frosted"),
    ("S19", "Alu120mlLotionPumpBlack", "Aluminum lotion pump", "Full, 120 ml", "Lotion first; 4 oz size"),
    ("S20", "GBDiva46AnSpGl", "Vintage-style bulb", "Everyday, 25–60 ml", "Travel cap; no room spray"),
    ("S21", "GBElg60AnSpTslIvyGl", "Vintage-style bulb, tassel", "Everyday, 25–60 ml", "Tassel; ivory with gold collar"),
    ("S22", "GBCrcl100AnSpGl", "Vintage-style bulb", "Full, 78–128 ml", "Title length; travel cap"),
    ("S23", "GBRndFrst128AnSpTslRed", "Vintage-style bulb, tassel", "Full, 78–128 ml", "Frosted; longest titles"),
    ("S24", "GBDiva30RdcrShnGl", "Pour with reducer", "Everyday, 25–60 ml", "Reducer under a cap"),
    ("S25", "GBCrcl100RdcrPnkLthr", "Pour with reducer", "Full, 78–128 ml", "Faux-leather cap"),
    ("S26", "GBBstnAmb15mlWhtDropperGlTrim", "Dropper", "Purse, 15 ml", "66 mm stem; 18-400"),
    ("S27", "GBBstn15BlkDrp", "Dropper", "Purse, 15 ml", "Clear: all six finishes (D6)"),
    ("S28", "GBBstnAmb1ozWhtDropperShnGlTrim", "Dropper", "Everyday, 30 ml", "Beard oil default; rubber bulb care"),
    ("S29", "GBCrcl50DrpGl", "Dropper", "Everyday, 25–60 ml", "18-415 collar finish"),
    ("S30", "GBCyl5GlMattSht", "Pour", "Sample, 5 ml", "Short lined cap"),
    ("S31", "GBSleek8Gl", "Pour", "Small, 6–9 ml", "Tall lined cap"),
    ("S32", "GBElg15MinarCu", "Pour", "Purse, 10–15 ml", "Minaret cap"),
    ("S33", "GBBstnAmb1ozBlkCapSht", "Pour", "Everyday, 30 ml", "No liner wording on Boston caps"),
    ("S34", "GBVAmb1DrmWhtCapSht", "Vial", "1 dram, 4 ml", "Dram naming; fill method"),
    ("S35", "GB1mlVBlk", "Vial", "1 ml", "Plug closure"),
    ("S36", "GBVAmb1DrmBlkDrpr", "Vial", "1 dram, 4 ml", "Vial with dropper"),
    ("S37", "GB09BlackCapApp", "Sample vial", "9 ml", "Glass rod; sample vial exception"),
    ("S38", "GB15ApthBlue", "Glass stopper", "Purse, 15 ml", "Hand-made; not leak-proof"),
    ("S39", "GBTrdpBlue", "Glass stopper", "Small, 9 ml", "Decorative teardrop"),
    ("S40", "GBAtom10Gl", "Travel atomizer", "Purse, 10 ml", "Metal shell; refill method"),
    ("S41", "CJClr15Pnk", "Cream jar", "Purse, 15 ml", "Jar uses; no hygiene claims"),
    ("S42", "PbNat16ozFlpWh", "Stock bottle", "Stock, 16 oz", "Plastic flip-top; stock and refills"),
]
PARTS = [
    ("P01", "CPRoll13-415SlDot", "Roll-on cap", "Fits the roller bottles on 13-415"),
    ("P02", "Spry18-415ShnGl", "Fine-mist sprayer", "Tube length by bottle"),
    ("P03", "Ltn17-415MattSl", "Treatment pump", "9 ml Cylinder only"),
    ("P04", "Ltn18-415ShnGl", "Lotion pump", "18-415 bottles"),
    ("P05", "AnSp18-415Red", "Vintage-style bulb sprayer", "Sold alone: travel cap?"),
    ("P06", "CP18-415AnSpTslGl", "Vintage-style bulb sprayer with tassel", "Tassel wording"),
    ("P07", "Drp20-4001ozWhiteBulb", "Dropper", "Stem length matched to 30 ml"),
    ("P08", "CP13-415BlkSht", "Short ribbed cap", "White liner wording"),
    ("P09", "CP18-415BrwnLthr", "Faux-leather cap", "Faux-leather naming"),
    ("P10", "OBagGold4x6", "Organza gift bag", "Packaging: size and use"),
    ("P11", "BoxCWndwWhite", "Window gift box", "Packaging: what fits inside"),
    ("P12", "FunnelMetalGl", "Funnel", "Tools"),
]

# Three review pages written by hand to show the format; the generator writes the rest.
MOCKS = {
    "GBCylAmb9MtlRollBlkDot": dict(
        title="9 ml Amber Cylinder Roll-On Bottle", option="Steel Ball, Black Dotted Cap",
        sentences=["A roll-on bottle for perfume oil, attar and carrier-oil blends, sized for samples, promotions and travel.",
                   "The steel ball lays the oil on in a thin, even line."],
        bullets=[("Included", "Steel roller ball and black dotted cap, fitted"),
                 ("Fits", "17-415 neck; also takes the plastic roller ball, fine-mist sprayer and treatment pump sold for this bottle"),
                 ("Glass", "Amber; reduces the light that reaches the oil")],
        care="Carry it capped and upright; the ball alone is not a seal.",
        question=""),
    "GBCrcl100AnSpGl": dict(
        title="100 ml Clear Circle Vintage-Style Bulb Sprayer", option="Gold Bulb",
        sentences=["A vintage-style bulb-spray bottle for eau de parfum and cologne kept on a dressing table, and for display or gifts.",
                   "Squeeze the bulb to spray."],
        bullets=[("Included", "Gold vintage-style bulb sprayer, packed unattached, and a travel cap"),
                 ("Fits", "18-415 neck; also takes the fine-mist sprayer, lotion pump and orifice reducer sold for this bottle"),
                 ("Glass", "Clear; shows the fill level")],
        care="To carry it, take off the bulb and fit the travel cap.",
        question="Is the travel cap one of the 18-415 lined caps, and in which colour?"),
    "Alu100mlSprayBlack": dict(
        title="100 ml Aluminum Spray Bottle", option="Black Sprayer",
        sentences=["An aluminum spray bottle for perfume, body mist, room spray and air freshener.",
                   "The sprayer turns a thin liquid into a fine, even mist."],
        bullets=[("Included", "Black fine-mist sprayer, fitted"),
                 ("Fits", "20-410 neck"),
                 ("Material", "Aluminum; light, and it does not break")],
        care="Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.",
        question='Title word: "Spray Bottle" rather than "Perfume Spray Bottle", since aluminum is also sold for room spray?'),
}

CSS = """
:root{--bone:#F5F3EF;--ink:#2C2C2E;--obsidian:#1D1D1F;--second:#6B6660;--muted:#9A9590;--rule:#DCD7D0;--sunk:#EEEAE3;--gold:#8B6F42;--gold2:#C5A065}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bone);color:var(--ink);font-family:'Montserrat',Arial,sans-serif;font-size:8.4pt;line-height:1.5;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.mono{font-family:'IBM Plex Mono',monospace}
.kicker{font-size:6.6pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--second)}
h1.p{font-size:22pt;font-weight:600;color:var(--obsidian);margin:.06in 0 .12in}
section{break-after:page}
.cover{page:cover;height:11in;position:relative}
.cover .lockup{position:absolute;top:1.1in;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:.08in}
.cover .lockup img{height:.3in}
.cover .lockup span{font-size:9.4pt;letter-spacing:.32em;text-indent:.32em;text-transform:uppercase;color:var(--obsidian)}
.cover .t{position:absolute;top:3.6in;left:.95in;right:.95in}
.cover h1{font-size:40pt;font-weight:500;line-height:1.05;color:var(--obsidian);margin:.14in 0 0}
.cover .rule{width:.6in;height:1.2pt;background:var(--gold2);margin:.26in 0 .2in}
.cover p.lede{font-size:10.4pt;line-height:1.6;max-width:5in;margin:0}
.cover .foot{position:absolute;bottom:.6in;left:.95in;right:.95in;font-size:7.4pt;color:var(--second);display:flex;justify-content:space-between}
ol.steps{list-style:none;counter-reset:s;margin:0;padding:0;border-top:.75pt solid var(--ink)}
ol.steps li{counter-increment:s;display:grid;grid-template-columns:.36in 1fr;padding:.09in 0;border-bottom:.5pt solid var(--rule);font-size:8.4pt}
ol.steps li::before{content:counter(s);font-size:14pt;font-weight:500;color:var(--obsidian)}
ol.steps b{display:block;font-weight:600;color:var(--obsidian);font-size:9pt}
.two{display:grid;grid-template-columns:1fr 1fr;gap:.3in;margin-top:.2in}
h2.k{font-size:6.6pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--second);margin:.18in 0 .06in}
ul.anat{list-style:none;margin:0;padding:0}
ul.anat li{display:grid;grid-template-columns:.3in 1fr;padding:3pt 0;border-bottom:.5pt solid var(--rule);font-size:7.8pt}
ul.anat li b{font-family:'IBM Plex Mono',monospace;color:var(--gold)}
table.list{border-collapse:collapse;width:100%;font-size:7.3pt}
table.list th{font-size:5.9pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--second);text-align:left;padding:3pt 6pt 3pt 0;border-bottom:.75pt solid var(--ink)}
table.list td{padding:2.5pt 6pt 2.5pt 0;border-bottom:.5pt solid var(--rule);vertical-align:middle}
table.list tr{break-inside:avoid}
table.list td.id{font-weight:600;color:var(--obsidian);width:.36in}
table.list td.ph{width:.46in;height:.46in}
table.list td.ph img{max-height:.42in;max-width:.42in;display:block;margin:0 auto}
table.list td.sku{font-family:'IBM Plex Mono',monospace;font-size:6.4pt;color:var(--gold)}
table.list td.t{color:var(--second)}
table.list thead{display:table-header-group}
.review .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.75pt solid var(--ink);padding-bottom:.08in}
.review .head .id{font-size:26pt;font-weight:500;color:var(--obsidian);line-height:1}
.review .head .meta{font-size:7.6pt;color:var(--second);text-align:right}
.review .head .meta .mono{color:var(--gold)}
.tag{display:inline-block;font-size:6.2pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:1.5pt 7pt;border-radius:8pt;background:#F5EAD2;color:#8A5F0E;margin-left:.08in}
.body{display:grid;grid-template-columns:2.3in 1fr;gap:.3in;margin-top:.16in}
.photo{height:3.1in;display:flex;align-items:flex-end;justify-content:center;border-bottom:.5pt solid var(--rule)}
.photo img{max-height:3in;max-width:2.2in}
.lab{font-size:5.9pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:.12in 0 .03in}
.title{font-size:15pt;font-weight:600;color:var(--obsidian);line-height:1.2}
.option{font-size:8.4pt;color:var(--second);margin-top:.02in}
.count{font-size:6.4pt;color:var(--muted);margin-top:.03in}
p.desc{font-size:9pt;line-height:1.55;margin:.02in 0 .06in}
ul.bul{margin:0;padding-left:.16in;font-size:8.4pt}
ul.bul li{margin:.02in 0}
ul.bul b{font-weight:600;color:var(--obsidian)}
.care{font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:11.5pt;line-height:1.35;color:var(--obsidian);border-left:1.2pt solid var(--gold2);padding:.02in 0 .02in .12in;margin-top:.04in}
table.tech{border-collapse:collapse;width:100%;font-size:7.4pt;margin-top:.02in}
table.tech td{padding:2pt 6pt 2pt 0;border-bottom:.5pt solid var(--rule)}
table.tech td:first-child{color:var(--second);width:1.1in}
.today{background:var(--sunk);padding:.08in .12in;font-size:7.4pt;line-height:1.5;color:var(--second);margin-top:.06in;border-radius:3pt}
.q{font-size:7.6pt;color:#8A5F0E;margin-top:.1in}
.q b{font-weight:600}
.box{border:.75pt solid var(--ink);padding:.1in .14in;margin-top:.16in;break-inside:avoid}
.box .checks{display:flex;gap:.3in;font-size:8.4pt;font-weight:500}
.box .checks span::before{content:'';display:inline-block;width:9pt;height:9pt;border:.8pt solid var(--ink);margin-right:5pt;vertical-align:-1.5pt}
.box .lines{margin-top:.06in}
.box .lines div{height:.26in;border-bottom:.5pt solid #B9AE98}
.box .sign{display:flex;justify-content:space-between;font-size:7pt;color:var(--second);margin-top:.08in}
.marker{font-size:2pt;color:#F5F3EF}
"""


def faces() -> str:
    serif = fg.ROOT / "public/fonts/eb-garamond/eb-garamond-latin-wght-italic.woff2"
    return fg.fonts_css() + f"\n@font-face{{font-family:'EB Garamond';font-style:italic;font-weight:400 800;src:url('{serif.as_uri()}') format('woff2')}}"


def page_css() -> str:
    return ("@page{size:8.5in 11in;margin:.72in .7in .7in;background:#F5F3EF;"
            "@top-left{content:'BEST BOTTLES';font:600 6.4pt Montserrat;letter-spacing:.3em;color:#1D1D1F;vertical-align:bottom;padding-bottom:.12in}"
            "@top-right{content:'Product copy review';font:500 6.4pt Montserrat;letter-spacing:.14em;color:#6B6660;vertical-align:bottom;padding-bottom:.12in;text-transform:uppercase}"
            "@bottom-right{content:counter(page) ' / ' counter(pages);font:400 6.4pt Montserrat;color:#6B6660;vertical-align:top;padding-top:.12in}}"
            "@page cover{margin:0;@top-left{content:none}@top-right{content:none}@bottom-right{content:none}}")


def product_name(item, fam) -> str:
    body = fam.bodies[item.body]
    parts = [f"{fam.name} {body.label}", item.glass.lower() if fam.name not in ("Aluminum Bottle",) else "",
             item.fitment.lower(), item.finish.lower()]
    return ", ".join(p for p in parts if p)


def thumb(sku: str, path: Path | None) -> str:
    if not path:
        return ""
    prep = fg.prepare(f"kit-thumb-{sku}", {sku: path}, px_per_card=320)
    return f"<img src='{prep[sku]['uri']}' alt=''>"


def main() -> None:
    families, meta = fg.load(fg.DEFAULT_EXPORT)
    items = {i.sku: (i, f) for f in families.values() for i in f.items}
    components = {r["websiteSku"]: r for r in csv.DictReader(open(fg.REGISTER / "components.csv"))}
    packaging = {r["websiteSku"]: r for r in meta["packaging"] if r.get("websiteSku")}
    photos = fg.photo_index(set(items) | {p[1] for p in PARTS})
    current = json.load(open(CURRENT))["byWebsiteSku"]
    missing = [s for _, s, *_ in SAMPLES if s not in items] + [s for _, s, *_ in PARTS if s not in components and s not in packaging]
    if missing:
        print("not in the current catalogue:", ", ".join(missing))

    sample_rows = "".join(
        f"<tr><td class=id>{sid}</td><td class=ph>{thumb(sku, photos.get(sku))}</td><td class=sku>{fg.esc(sku)}</td>"
        f"<td>{fg.esc(product_name(*items[sku]) if sku in items else '')}</td><td>{fg.esc(kind)} · {fg.esc(band)}</td>"
        f"<td class=t>{fg.esc(tests)}</td></tr>" for sid, sku, kind, band, tests in SAMPLES)

    def part_name(sku: str) -> str:
        if sku in components:
            part, finish = fg.part_label(components[sku])
            return f"{part}, {finish.lower()}, {components[sku]['neck']}" if finish else part
        if sku in packaging:
            return fg.clean_packaging(packaging[sku].get("itemName") or "")
        return ""
    part_rows = "".join(
        f"<tr><td class=id>{pid}</td><td class=ph>{thumb(sku, photos.get(sku))}</td><td class=sku>{fg.esc(sku)}</td>"
        f"<td>{fg.esc(part_name(sku))}</td><td>{fg.esc(kind)}</td><td class=t>{fg.esc(tests)}</td></tr>"
        for pid, sku, kind, tests in PARTS)

    mark = fg.wordmark_uri()
    cover = f"""
<section class=cover>
  <div class=lockup><img src='{mark}' alt='Best Bottles'><span>Fragrance &amp; Beauty Packaging</span></div>
  <div class=t><p class=kicker>Product copy review</p><h1>Samples and the review page</h1><div class=rule></div>
    <p class=lede>The 54 products to review before new copy is written for the whole catalogue, and the page each one will be
    reviewed on. Mark the list first: swap any sample, add any you want to see.</p></div>
  <div class=foot><span>For Jordan and Abbas</span><span>{dt.date.today():%d %B %Y}</span></div>
</section>"""
    how = f"""
<section>
  <p class=kicker>How the review works</p><h1 class=p>Review a few, then write them all</h1>
  <ol class=steps>
    <li><div><b>Approve the samples.</b>42 bottles, one for each product type and size, plus 12 parts and packaging items (the lists after this page).
      Cross out any you don't need and write in any you want to add.</div></li>
    <li><div><b>Approve the page.</b>The last three pages are review pages written by hand to show the layout. Mark anything about the
      layout itself: order, what is shown, what is missing.</div></li>
    <li><div><b>Review the samples.</b>Once the generator is built, it writes all 54 review pages in this layout. Mark each one
      Approve, Approve with changes, or Rewrite, and write changes on the page.</div></li>
    <li><div><b>A note changes the rule, not just the page.</b>A change to one 9 ml roll-on changes every 9 ml roll-on. Write "this
      product only" when a note is meant for one item.</div></li>
    <li><div><b>Send the pages back.</b>Photos or scans of the marked pages, or typed notes. The notes go into the rules, and every
      product is generated again from them.</div></li>
  </ol>
  <div class=two>
    <div><h2 class=k>What each review page shows</h2><ul class=anat>
      <li><b>A</b><span>Sample number, product type and size, item number</span></li>
      <li><b>B</b><span>The approved photograph</span></li>
      <li><b>C</b><span>New title and option, with the title's length (60 characters at most, for Faire)</span></li>
      <li><b>D</b><span>Description: two or three sentences</span></li>
      <li><b>E</b><span>Included, Fits, Glass or Material, and Good to know when there is one</span></li>
      <li><b>F</b><span>Care note: the one warning line, in the serif, shown beside the tech sheet on the site</span></li>
      <li><b>G</b><span>Tech sheet: capacity, neck, measurements, sets and case</span></li>
      <li><b>H</b><span>Today's description, for comparison</span></li>
      <li><b>I</b><span>Your marks and notes</span></li></ul></div>
    <div><h2 class=k>Rules already decided</h2><ul class=anat>
      <li><b>1</b><span>Measurements live in the tech sheet, never in the description.</span></li>
      <li><b>2</b><span>Quantities are sets and cases: 1, 12 and 144 sets, and a case.</span></li>
      <li><b>3</b><span>One Care note per product, outside the description.</span></li>
      <li><b>4</b><span>Bulb sprayers ship with a travel cap; no room spray or air freshener on them.</span></li>
      <li><b>5</b><span>Aluminum may say "does not break" and list room spray and air freshener.</span></li>
      <li><b>6</b><span>"Vintage-Style Bulb Sprayer" in titles; the few over 60 characters are shortened by hand.</span></li>
      <li><b>7</b><span>Only combinations Best Bottles sells are called a fit.</span></li></ul></div>
  </div>
</section>"""
    lists = f"""
<section>
  <p class=kicker>The samples</p><h1 class=p>42 bottles</h1>
  <table class=list><thead><tr><th>No.</th><th></th><th>Item number</th><th>Product</th><th>Type and size</th><th>What it tests</th></tr></thead>
  <tbody>{sample_rows}</tbody></table>
</section>
<section>
  <p class=kicker>The samples</p><h1 class=p>12 parts and packaging items</h1>
  <table class=list><thead><tr><th>No.</th><th></th><th>Item number</th><th>Product</th><th>Type</th><th>What it tests</th></tr></thead>
  <tbody>{part_rows}</tbody></table>
  <p style="font-size:7.6pt;color:#6B6660;margin-top:.14in">Parts sold separately get the same page. Their Fits line names the bottles
  sold with that part, by neck, instead of the other parts for one bottle.</p>
</section>"""

    pages = []
    ids = {sku: sid for sid, sku, *_ in SAMPLES}
    for sku, m in sorted(MOCKS.items(), key=lambda kv: next(s for s, x, *_ in SAMPLES if x == kv[0])):
        item, fam = items[sku]
        body = fam.bodies[item.body]
        sid = ids[sku]
        kind, band = next((k, b) for s, x, k, b, _ in SAMPLES if x == sku)
        prep = fg.prepare(f"kit-{sku}", {sku: photos[sku]}, px_per_card=1100) if sku in photos else {}
        photo = f"<img src='{prep[sku]['uri']}' alt=''>" if prep else ""
        words = sum(len(s.split()) for s in m["sentences"])
        bullets = "".join(f"<li><b>{fg.esc(k)}:</b> {fg.esc(v)}</li>" for k, v in m["bullets"])
        h = f"{body.height:g} mm ({body.height / 25.4:.2f} in)" if body.height else "—"
        w = f"{body.width:g} mm ({body.width / 25.4:.2f} in)" if body.width else "—"
        case = f"1, 12 or 144 sets, or a case of {item.case:,} sets" if item.case else "1, 12 or 144 sets"
        material = "Aluminum" if fam.name == "Aluminum Bottle" else f"{item.glass} glass"
        today = current.get(sku, {}).get("description", "No description today.")
        question = f"<p class=q><b>Question for Best Bottles:</b> {fg.esc(m['question'])}</p>" if m["question"] else ""
        pages.append(f"""
<section class=review>
  <div class=head><div><span class=id>{sid}</span><span class=tag>Format sample</span></div>
    <div class=meta>{fg.esc(kind)} · {fg.esc(band)}<br><span class=mono>{fg.esc(sku)}</span></div></div>
  <div class=body>
    <div><div class=photo>{photo}</div>
      <p class=lab>Tech sheet</p>
      <table class=tech>
        <tr><td>Capacity</td><td>{fg.esc(body.label)}</td></tr><tr><td>Neck</td><td>{fg.esc(fg.neck_label(body.neck))}</td></tr>
        <tr><td>Height, no cap</td><td>{h}</td></tr><tr><td>Diameter</td><td>{w}</td></tr>
        <tr><td>Material</td><td>{fg.esc(material)}</td></tr><tr><td>Sold as</td><td>{fg.esc(case)}</td></tr></table>
      <p class=lab>Care note</p><p class=care>{fg.esc(m['care'])}</p></div>
    <div>
      <p class=lab>Title and option</p><p class=title>{fg.esc(m['title'])}</p><p class=option>{fg.esc(m['option'])}</p>
      <p class=count>Title {len(m['title'])} characters · description {words} words</p>
      <p class=lab>Description</p><p class=desc>{fg.esc(' '.join(m['sentences']))}</p><ul class=bul>{bullets}</ul>
      {question}
      <p class=lab>Today's description</p><div class=today>{fg.esc(today)}</div>
    </div>
  </div>
  <div class=box><div class=checks><span>Approve</span><span>Approve with changes</span><span>Rewrite</span><span>This product only</span></div>
    <div class=lines><div></div><div></div><div></div><div></div></div>
    <div class=sign><span>Reviewed by</span><span>Date</span></div></div>
</section>""")

    doc = (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Product copy review</title>"
           f"<style>{faces()}\n{page_css()}\n{CSS}</style></head><body>{cover}{how}{lists}{''.join(pages)}</body></html>")
    renderer = fg.Renderer()
    try:
        path = renderer.pdf(doc, OUT)
    finally:
        renderer.close()
    import pymupdf
    print(f"{path}: {pymupdf.open(path).page_count} pages, {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
