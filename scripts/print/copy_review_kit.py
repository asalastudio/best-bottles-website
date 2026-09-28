"""The product copy review kit: which products Jordan and Abbas review, and what each review page looks like.

    python3 scripts/print/copy_review_kit.py        # writes out/print/best-bottles-copy-review-kit.pdf

Before the new copy goes to every product, one sample per product type and size is reviewed on paper (RUBRIC.md
§8, Phase 4). The book lists the 42 bottle samples and 12 parts and packaging samples, the choices and open
questions to settle first, and one review page per sample filled from data/descriptions/pdp/product-copy.json
(run scripts/pdp-descriptions/product_copy.py first).

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
COPY = fg.ROOT / "data/descriptions/pdp/product-copy.json"  # scripts/pdp-descriptions/product_copy.py

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

# Questions printed on one sample's page; questions that touch many pages are on the "Open questions" page.
QUESTIONS = {
    "GBMtlRoll28Blk": "Sold complete on a 16 mm neck: does any other part fit it?",
    "GBSpry3mlClBlk": "Sold complete on a 12 mm neck: is the sprayer crimped on or screwed on?",
    "GBCylAmb9SpryMattSl": "The overcap comes from the old product pages (29 of 31 of these sprayers): is it on every 17-415 sprayer?",
    "GBSpry1ozGl": "Fixed top and base in the register: is the sprayer crimped, so the bottle cannot be refilled?",
    "Alu100mlSprayBlack": "Is the aluminum lined inside, and is there any liquid it should not hold?",
    "Alu120mlLotionPumpBlack": "Same question as S15: lining, and liquids to avoid.",
    "GBDiva46AnSpGl": "Which cap is the travel cap (an 18-415 lined cap?), and in which colour?",
    "GBCrcl100AnSpGl": "Which cap is the travel cap, and in which colour?",
    "GBDiva30RdcrShnGl": "What plastic is the orifice reducer?",
    "GBBstn15BlkDrp": "D6: all six dropper finishes are to be added to this bottle. Item numbers and prices are needed.",
    "GBBstnAmb1ozWhtDropperShnGlTrim": "Is the dropper bulb natural rubber or another material?",
    "GBCyl5GlMattSht": "The liner line is on every 13-415 cap. Confirm it for the short lined caps.",
    "GBElg15MinarCu": "Is the minaret cap lined like the other 13-415 caps?",
    "GB1mlVBlk": "Is the 1 ml closure a plug applicator only, or a plug under a cap?",
    "GBTrdpBlue": "The old pages say the apothecary stoppers are made by hand. Are the teardrop stoppers too?",
    "GBAtom10Gl": "Does the atomizer fill from the top or from the bottom?",
    "CJClr15Pnk": "Is there a liner in the jar lid?",
    "PbNat16ozFlpWh": "Filed as a glass bottle in production; the correction file moves it to Plastic Bottle. What plastic is it?",
    "CPRoll13-415SlDot": "Is the roll-on cap sold for both the steel and the plastic roller?",
    "Spry18-415ShnGl": "Is the dip tube cut for one bottle, or trimmed by the buyer?",
    "AnSp18-415Red": "Sold alone: does it come with a travel cap?",
    "Drp20-4001ozWhiteBulb": "The stem is matched to the 30 ml Boston round. Is that right for every 1 oz dropper?",
    "CP18-415BrwnLthr": "Does the faux-leather cap fit over the reducer only, or on a plain 18-415 neck too?",
    "OBagGold4x6": "Does the bag close with a drawstring?",
    "BoxCWndwWhite": "Which bottles fit the size C window box (the name says \"Size 0.75\")?",
    "FunnelMetalGl": "Which necks does the small funnel fit?",
}

# Choices the generator makes that the copy standard does not settle yet. Approve or change each.
CHOICES = [
    ("Tassel bulbs", "The title says \"with Tassel\", so the option names only the bulb: \"Gold Bulb\", not \"Gold Bulb and Tassel\"."),
    ("Perfume spray pumps", "The option says \"Matte Gold Sprayer\" and Included says \"fine-mist sprayer\", as the printed catalogue does, "
                            "instead of \"Pump\", which reads like a lotion pump."),
    ("Fits line", "\"18-415 neck; takes the fine-mist sprayer, lotion pump and reducer sold for this bottle\". \"Also\" is dropped so "
                  "the longest lists fit two phone lines; caps are listed as \"caps\"."),
    ("Vials with a dropper", "Titled \"1 Dram (4 ml) Amber Vial with Dropper\"."),
    ("Refill line", "Sprayers on a screw neck: \"The sprayer turns a thin liquid into a fine, even mist, and unscrews so the bottle "
                    "can be refilled.\" Not on crimped or fixed tops."),
    ("\"Fitted\"", "Included ends with \"fitted\" on rollers, sprayers, pumps, reducers and droppers. The bulb says \"packed unattached\"."),
    ("No Care note", "Pour bottles, vials, jars and stock bottles have no warning line."),
    ("Options over 30 characters", "40 labels such as \"Plastic Ball, Silver Dotted Cap\" (31). Keep them, or shorten \"Dotted\" to \"Dot\"."),
    ("Parts", "\"Roll-On Cap for 13-415 Necks\" with the finish as the option; droppers by bottle: \"Dropper for 30 ml (1 oz) Bottles, "
              "20-400 Neck\". Counted by the item: \"1, 12 or 144 caps\"."),
    ("Packaging", "Colour in the title, size as the option: \"Gold Organza Gift Bag\", \"4 x 6 in\"."),
]

# Questions that touch many pages (most were sent to Abbas on 28 Sep).
OPEN_QUESTIONS = [
    ("Shipping", "Do rollers, sprayers, pumps, reducers and droppers ship fitted to the bottle? The copy says \"fitted\"."),
    ("Travel cap", "Which cap is packed with each bulb sprayer, and in which colour?"),
    ("Dropper bulb", "Natural rubber, or another material? The Care note names rubber."),
    ("Plastics", "What plastic are the roller housings and the orifice reducers?"),
    ("Atomizers", "Do they fill from the top or from the bottom?"),
    ("Aluminum", "Is it lined inside? Which liquids should it not hold?"),
    ("18-415 droppers", "Which bottles is each 18-415 dropper's stem cut for?"),
    ("22-400 and 24-400 caps", "No bottle in the catalogue uses these necks. Which bottles are they for?"),
    ("Data to correct", "Three plastic flip-top bottles filed as glass; the 4 oz flip-top recorded as 114 ml; "
                        "the 1.5 ml vial recorded as 2 ml. These go in the correction file."),
]

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
p.intro{font-size:8.4pt;color:var(--second);max-width:6in;margin:0 0 .12in}
table.list td.tick{width:.4in;border-left:.5pt solid var(--rule)}
.nophoto{font-size:7.4pt;color:var(--muted);align-self:center}
.nocare{font-size:7.6pt;color:var(--muted);margin:.02in 0}
.flag{font-size:7pt;color:var(--muted);margin-top:.06in}
table.tech[small]{font-size:6.8pt}
table.tech[small] td:first-child{width:.95in}
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

    generated = json.load(open(COPY))["bySku"] if COPY.exists() else {}
    source = json.load(open(COPY)).get("source", {}) if COPY.exists() else {}
    absent = [s for _, s, *_ in SAMPLES + PARTS if s not in generated]
    if absent:
        print("no generated copy for:", ", ".join(absent))

    mark = fg.wordmark_uri()
    cover = f"""
<section class=cover>
  <div class=lockup><img src='{mark}' alt='Best Bottles'><span>Fragrance &amp; Beauty Packaging</span></div>
  <div class=t><p class=kicker>Product copy review</p><h1>54 samples of the new product copy</h1><div class=rule></div>
    <p class=lede>New titles, options, descriptions and Care notes for one product of every type and size, written by the
    generator from the rules agreed on 26 and 28 September. Approve, change or rewrite each page; a change to one page changes the
    rule for every product like it.</p></div>
  <div class=foot><span>For Jordan and Abbas</span><span>{dt.date.today():%d %B %Y}</span></div>
</section>"""
    how = f"""
<section>
  <p class=kicker>How the review works</p><h1 class=p>Review 54, then write them all</h1>
  <ol class=steps>
    <li><div><b>Read the two pages after this one.</b>The first lists choices the generator makes that the copy standard did not
      settle yet; tick or change each. The second lists questions for Best Bottles that affect many products.</div></li>
    <li><div><b>Review the samples.</b>42 bottles, then 12 parts and packaging items. Mark each page Approve, Approve with changes,
      or Rewrite, and write changes on the page.</div></li>
    <li><div><b>A note changes the rule, not just the page.</b>A change to one 9 ml roll-on changes every 9 ml roll-on. Tick
      "This product only" when a note is meant for one item.</div></li>
    <li><div><b>Send the pages back.</b>Photos or scans of the marked pages, or typed notes. The notes go into the rules, every
      product is generated again, and the approved copy goes to the site and Shopify.</div></li>
  </ol>
  <div class=two>
    <div><h2 class=k>What each review page shows</h2><ul class=anat>
      <li><b>A</b><span>Sample number, product type and size, item number</span></li>
      <li><b>B</b><span>The approved photograph</span></li>
      <li><b>C</b><span>Title and option, with the title's length (60 characters at most, for Faire)</span></li>
      <li><b>D</b><span>Description: two or three sentences, then the bullets</span></li>
      <li><b>E</b><span>Care note: the one warning line, in the serif, shown beside the tech sheet on the site</span></li>
      <li><b>F</b><span>Item-type line, meta description and image alt text</span></li>
      <li><b>G</b><span>Tech sheet: capacity, neck, measurements, sets and case</span></li>
      <li><b>H</b><span>Today's description, for comparison</span></li>
      <li><b>I</b><span>Your marks and notes</span></li></ul></div>
    <div><h2 class=k>Rules already decided</h2><ul class=anat>
      <li><b>1</b><span>Measurements live in the tech sheet, never in the description.</span></li>
      <li><b>2</b><span>Bottles are sold in sets and cases: 1, 12 and 144 sets, and a case. Parts and packaging are counted by the item.</span></li>
      <li><b>3</b><span>One Care note per product at most, outside the description.</span></li>
      <li><b>4</b><span>Bulb sprayers ship with a travel cap; no room spray or air freshener on them.</span></li>
      <li><b>5</b><span>Aluminum may say "does not break" and list room spray and air freshener.</span></li>
      <li><b>6</b><span>Ounces only on Boston rounds and the standard 4, 8, 12 and 16 oz sizes.</span></li>
      <li><b>7</b><span>Only combinations Best Bottles sells are called a fit.</span></li></ul></div>
  </div>
</section>"""
    choice_rows = "".join(f"<tr><td class=id>{i}</td><td><b>{fg.esc(k)}</b></td><td>{fg.esc(v)}</td><td class=tick></td></tr>"
                          for i, (k, v) in enumerate(CHOICES, 1))
    question_rows = "".join(f"<tr><td class=id>{i}</td><td><b>{fg.esc(k)}</b></td><td>{fg.esc(v)}</td></tr>"
                            for i, (k, v) in enumerate(OPEN_QUESTIONS, 1))
    decide = f"""
<section>
  <p class=kicker>Before the samples</p><h1 class=p>Choices to approve</h1>
  <p class=intro>The generator had to settle these to write the copy. Each is applied to every product; tick it, or write the change.</p>
  <table class=list><thead><tr><th>No.</th><th>Topic</th><th>What the copy does</th><th>OK</th></tr></thead><tbody>{choice_rows}</tbody></table>
</section>
<section>
  <p class=kicker>Before the samples</p><h1 class=p>Open questions for Best Bottles</h1>
  <p class=intro>Until these are answered the copy says only what is known. Most were sent to Abbas on 28 September.</p>
  <table class=list><thead><tr><th>No.</th><th>Topic</th><th>Question</th></tr></thead><tbody>{question_rows}</tbody></table>
  <p class=intro style="margin-top:.16in">Generated from <span class=mono>{fg.esc(source.get("export", ""))}</span>
  ({fg.esc(source.get("deployment") or "")}). The final run reads production.</p>
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

    def tech_rows(sku: str, c: dict) -> str:
        t = c["tech"]
        if c["mode"] in ("PART", "PACKAGING"):
            rows = [("Neck", t.get("neck")), ("Finish", t.get("finish")), ("Stem", f"{t['stemMm']} mm" if t.get("stemMm") else None),
                    ("Size", t.get("size")), ("Sold as", t.get("soldAs"))]
        else:
            item, fam = items[sku]
            body = fam.bodies[item.body]
            h = f"{body.height:g} mm ({body.height / 25.4:.2f} in)" if body.height else "—"
            w = f"{body.width:g} mm ({body.width / 25.4:.2f} in)" if body.width else "—"
            rows = [("Capacity", t["capacity"]), ("Neck", t["neck"]), ("Height, no cap", h), ("Diameter", w),
                    ("Material", t["material"]), ("Sold as", t["soldAs"])]
        return "".join(f"<tr><td>{fg.esc(k)}</td><td>{fg.esc(v)}</td></tr>" for k, v in rows if v)

    pages = []
    entries = [(sid, sku, f"{kind} · {band}") for sid, sku, kind, band, _ in SAMPLES] + [(pid, sku, kind) for pid, sku, kind, _ in PARTS]
    for sid, sku, kind in entries:
        c = generated.get(sku)
        if not c:
            continue
        prep = fg.prepare(f"kit-{sku}", {sku: photos[sku]}, px_per_card=1100) if sku in photos else {}
        photo = f"<img src='{prep[sku]['uri']}' alt=''>" if prep else "<span class=nophoto>No approved photograph yet</span>"
        words = sum(len(x.split()) for x in c["sentences"])
        bullets = "".join(f"<li><b>{fg.esc(k)}:</b> {fg.esc(v)}</li>" for k, v in c["bullets"])
        today = current.get(sku, {}).get("description") or packaging.get(sku, {}).get("itemName") or \
            components.get(sku, {}).get("itemName") or "No description today."
        question = f"<p class=q><b>Question for Best Bottles:</b> {fg.esc(QUESTIONS[sku])}</p>" if sku in QUESTIONS else ""
        findings = [f for f in c["lint"]] + [n for n in c["notes"] if not n.startswith("register status")]
        flag = f"<p class=flag>Generator note: {fg.esc('; '.join(findings))}</p>" if findings else ""
        care = f"<p class=care>{fg.esc(c['care'])}</p>" if c["care"] else "<p class=nocare>No Care note for this type.</p>"
        option = f"<p class=option>Option: {fg.esc(c['option'])}</p>" if c["option"] else ""
        pages.append(f"""
<section class=review>
  <div class=head><div><span class=id>{sid}</span><span class=tag>Generated</span></div>
    <div class=meta>{fg.esc(kind)}<br><span class=mono>{fg.esc(sku)}</span></div></div>
  <div class=body>
    <div><div class=photo>{photo}</div>
      <p class=lab>Tech sheet</p><table class=tech>{tech_rows(sku, c)}</table>
      <p class=lab>Care note</p>{care}</div>
    <div>
      <p class=lab>Title and option</p><p class=title>{fg.esc(c['title'])}</p>{option}
      <p class=count>Title {len(c['title'])} characters · option {len(c['option'])} · description {words} words</p>
      <p class=lab>Description</p><p class=desc>{fg.esc(' '.join(c['sentences']))}</p><ul class=bul>{bullets}</ul>
      {question}{flag}
      <p class=lab>On the page and in search</p>
      <table class=tech small><tr><td>Item type</td><td>{fg.esc(c['itemType'])}</td></tr>
        <tr><td>Meta description</td><td>{fg.esc(c['metaDescription'])}</td></tr>
        <tr><td>Image alt text</td><td>{fg.esc(c['altText'])}</td></tr></table>
      <p class=lab>Today's description</p><div class=today>{fg.esc(today)}</div>
    </div>
  </div>
  <div class=box><div class=checks><span>Approve</span><span>Approve with changes</span><span>Rewrite</span><span>This product only</span></div>
    <div class=lines><div></div><div></div><div></div></div>
    <div class=sign><span>Reviewed by</span><span>Date</span></div></div>
</section>""")

    doc = (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Product copy review</title>"
           f"<style>{faces()}\n{page_css()}\n{CSS}</style></head><body>{cover}{how}{decide}{lists}{''.join(pages)}</body></html>")
    renderer = fg.Renderer()
    try:
        path = renderer.pdf(doc, OUT)
    finally:
        renderer.close()
    import pymupdf
    print(f"{path}: {pymupdf.open(path).page_count} pages, {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
