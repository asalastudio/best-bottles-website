#!/usr/bin/env python3
"""Render the size-consistency audit as one self-contained HTML page (proof images embedded).

  python3 scripts/audit/size-consistency/render_report.py <out-dir> <proof-dir>
"""
from __future__ import annotations

import base64
import html
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "output" / "size-audit"
R = json.loads((OUT / "report.json").read_text())
VAL = json.loads((OUT / "validation-results.json").read_text())
out_dir, proof_dir = Path(sys.argv[1]), Path(sys.argv[2])

P, B, BB = R["pdp"]["summary"], R["byb"]["summary"], R["bybBody"]["summary"]
e = html.escape


def img(name: str, alt: str) -> str:
    data = base64.b64encode((proof_dir / f"{name}.webp").read_bytes()).decode()
    return f'<img src="data:image/webp;base64,{data}" alt="{e(alt)}" loading="lazy" width="646">'


def pct(x: float) -> str:
    return f"{x * 100:+.0f}%".replace("-", "−")


CAUSE_NAME = {"frame": "Framing", "photo": "Photo fallback", "kit": "Legacy kit", "image": "Image scale"}
SOURCE_NAME = {"register": "register", "kit": "legacy kit", "photo": "photo", "body": "bare body"}


def chips(causes: dict) -> str:
    return "".join(f'<span class="chip c-{k}">{CAUSE_NAME[k]} <b>{v}</b></span>' for k, v in sorted(causes.items(), key=lambda kv: -kv[1]))


def worst_signed(g: dict) -> float:
    r = max(g["rows"], key=lambda r: abs(r["dev"]))
    return r["dev"]


def glass_rows(part: str) -> str:
    rows = []
    for g in R[part]["glasses"]:
        if not g["off"]:
            continue
        if part == "pdp":
            label = g["label"]
        else:
            name, neck, *_ = g["key"].split("|")
            fam, _, cap = name.rpartition("-")
            label = f'{fam.replace("-", " ").title()} {cap.replace("ml", " ml")} · {neck}'.replace("Ml", "ml")
        sev = "major" if g["major"] else "minor"
        off = [r for r in g["rows"] if r["cause"]]
        items = "".join(
            f'<li><code>{e(r["websiteSku"] or "")}</code><span class="dev {"up" if r["dev"] > 0 else "down"}">{pct(r["dev"])}</span>'
            f'<span class="why">{CAUSE_NAME[r["cause"]]} · {SOURCE_NAME.get(r["source"], r["source"])}</span></li>'
            for r in off[:60])
        more = f'<li class="more">and {len(off) - 60} more</li>' if len(off) > 60 else ""
        rows.append(
            f'<details class="glass {sev}" data-q="{e((label + " " + " ".join(r["websiteSku"] or "" for r in off)).lower())}">'
            f'<summary><span class="gname">{e(label)}</span><span class="num">{g["variants"]}</span>'
            f'<span class="num"><b>{g["off"]}</b></span><span class="num">{pct(worst_signed(g))}</span>'
            f'<span class="chips">{chips(g["causes"])}</span></summary>'
            f'<ul class="skus">{items}{more}</ul></details>')
    return "\n".join(rows)


psd_rows = "".join(
    f'<tr><td>{e(x["key"])}</td><td>{"Published kit layers" if x["kind"] == "kit layer" else "Plates"}</td>'
    f'<td class="num">{x["n"]}</td><td class="num">{x["spread"] * 100:.0f}%</td>'
    f'<td>{", ".join(f"<code>{e(o["sku"])}</code> {pct(o["dev"])}" for o in x["off"][:3]) or "—"}</td></tr>'
    for x in R["psd"] if x["spread"] > 0.08 and x["n"] >= 3)

val_rows = []
for v in VAL:
    live = (v.get("measuredLive") or {}).get("width")
    if v["sku"] in {"GBSleek5SlMattSht", "GBElg15MinarCu", "GBRect10BlkShSht", "GBBstn1ozBlkCapSht"}:
        continue
    if live:
        val_rows.append((v["sku"], v["source"], v["screen"], live))
val_rows += [("GBSleek5SlMattSht", "photo", 150.9, 151.0), ("GBElg15MinarCu", "photo", 234.4, 237.0), ("GBRect10BlkShSht", "photo", 211.8, 212.0), ("GBBstn1ozBlkCapSht", "photo", 121.3, 117.0)]
val_html = "".join(f'<tr><td><code>{s}</code></td><td>{SOURCE_NAME.get(src, src)}</td><td class="num">{p:.0f}</td><td class="num">{l:.0f}</td><td class="num">{(l / p - 1) * 100:+.1f}%</td></tr>' for s, src, p, l in val_rows)

page = f"""<title>One Glass, One Size</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {{
  --bg: #FAF9F6; --surface: #FFFFFF; --bone: #F3F1EC; --ink: #1E1D1B; --muted: #6B6760; --line: #E3DFD7;
  --accent: #8A6A3A; --bad: #B4432F; --bad-soft: #F6E4DF; --warn: #A5691B; --warn-soft: #F7ECD9; --ok: #3F7D5A;
  --c-frame: #5B6E8C; --c-photo: #B4432F; --c-kit: #8A6A3A; --c-image: #6E5B8C;
  --display: "Montserrat", "Helvetica Neue", Arial, sans-serif; --body: "Source Sans 3", "Helvetica Neue", Arial, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  color-scheme: dark; --bg: #151412; --surface: #1D1C19; --bone: #26241F; --ink: #EDEAE4; --muted: #A39E94; --line: #34312B;
  --accent: #C9A46A; --bad: #E07A64; --bad-soft: #3A221C; --warn: #E0A84A; --warn-soft: #36291A; --ok: #7FBF96;
  --c-frame: #8FA3C4; --c-photo: #E07A64; --c-kit: #C9A46A; --c-image: #A994CB; }} }}
:root[data-theme="dark"] {{
  color-scheme: dark; --bg: #151412; --surface: #1D1C19; --bone: #26241F; --ink: #EDEAE4; --muted: #A39E94; --line: #34312B;
  --accent: #C9A46A; --bad: #E07A64; --bad-soft: #3A221C; --warn: #E0A84A; --warn-soft: #36291A; --ok: #7FBF96;
  --c-frame: #8FA3C4; --c-photo: #E07A64; --c-kit: #C9A46A; --c-image: #A994CB; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 16px/1.55 var(--body); margin: 0; padding-inline: 20px; padding-block: 36px 72px; }}
.wrap {{ max-width: 1040px; margin: 0 auto; display: grid; gap: 56px; }}
h1, h2, h3 {{ font-family: var(--display); letter-spacing: -.01em; text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(30px, 5vw, 44px); font-weight: 700; }}
h2 {{ font-size: 24px; font-weight: 600; }}
h3 {{ font-size: 18px; font-weight: 600; }}
p {{ margin: 0; max-width: 68ch; }}
.eyebrow {{ font: 600 12px/1 var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }}
header {{ display: grid; gap: 14px; }}
header .lede {{ font-size: 18px; color: var(--muted); }}
.figures {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }}
.fig {{ background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 18px; display: grid; gap: 6px; align-content: start; }}
.fig .n {{ font: 700 34px/1 var(--display); font-variant-numeric: tabular-nums; }}
.fig .n small {{ font-size: 16px; color: var(--muted); font-weight: 600; }}
.fig .l {{ color: var(--muted); font-size: 14px; }}
section {{ display: grid; gap: 18px; }}
.pair {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }}
figure {{ margin: 0; display: grid; gap: 10px; align-content: start; max-width: 646px; }}
figure img {{ width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--bone); }}
figcaption {{ color: var(--muted); font-size: 14px; }}
.cause {{ border-top: 1px solid var(--line); padding-top: 22px; display: grid; gap: 14px; }}
.cause-head {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 16px; }}
.tag {{ font: 600 12px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; padding: 6px 9px; border-radius: 4px; color: #fff; }}
.t-frame {{ background: var(--c-frame); }} .t-photo {{ background: var(--c-photo); }} .t-kit {{ background: var(--c-kit); }} .t-image {{ background: var(--c-image); }} .t-lock {{ background: var(--warn); }} .t-wrong {{ background: var(--bad); }}
.counts {{ font-family: var(--mono); font-size: 13px; color: var(--muted); }}
.fix {{ background: var(--surface); border-left: 3px solid var(--ok); padding: 12px 14px; border-radius: 0 6px 6px 0; }}
.fix b {{ font-family: var(--display); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--ok); margin-right: 6px; }}
ol.plan {{ margin: 0; padding-left: 22px; display: grid; gap: 12px; max-width: 76ch; }}
ol.plan li::marker {{ font-family: var(--display); font-weight: 700; color: var(--accent); }}
.decide {{ background: var(--warn-soft); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; display: grid; gap: 8px; }}
.toolbar {{ display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }}
.toolbar input {{ font: 15px var(--body); padding: 9px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); min-width: 0; flex: 1 1 260px; }}
.toolbar input:focus-visible, summary:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.list {{ border: 1px solid var(--line); border-radius: 8px; background: var(--surface); overflow: hidden; }}
.list-head, summary {{ display: grid; grid-template-columns: minmax(150px, 1.4fr) 64px 64px 72px minmax(160px, 2fr); gap: 10px; align-items: center; padding: 10px 14px; }}
.list-head {{ font: 600 11px/1.2 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line); }}
.list-head span:nth-child(n+2):nth-child(-n+4), summary .num {{ text-align: right; }}
details.glass {{ border-bottom: 1px solid var(--line); }}
details.glass:last-child {{ border-bottom: 0; }}
summary {{ cursor: pointer; list-style: none; }}
summary::-webkit-details-marker {{ display: none; }}
summary:hover {{ background: var(--bone); }}
.gname {{ font-weight: 600; }}
details.major .gname::before {{ content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--bad); margin-right: 8px; vertical-align: middle; }}
details.minor .gname::before {{ content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); margin-right: 8px; vertical-align: middle; }}
.num {{ font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 14px; }}
.chips {{ display: flex; flex-wrap: wrap; gap: 4px; }}
.chip {{ font-size: 12px; padding: 2px 7px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; }}
.chip b {{ font-family: var(--mono); font-weight: 500; }}
.c-frame {{ color: var(--c-frame); }} .c-photo {{ color: var(--c-photo); }} .c-kit {{ color: var(--c-kit); }} .c-image {{ color: var(--c-image); }}
ul.skus {{ list-style: none; margin: 0; padding: 4px 14px 14px 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 4px 16px; background: var(--bone); }}
ul.skus li {{ display: flex; gap: 8px; align-items: baseline; font-size: 13px; min-width: 0; }}
ul.skus code {{ font-family: var(--mono); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; }}
.dev {{ font-family: var(--mono); font-size: 12.5px; }} .dev.up {{ color: var(--bad); }} .dev.down {{ color: var(--c-frame); }}
.why {{ color: var(--muted); font-size: 12px; white-space: nowrap; }}
.more {{ color: var(--muted); }}
.scroll {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; }}
th, td {{ text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }}
th {{ font: 600 11px/1.2 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }}
td.num, th.num {{ text-align: right; }}
td code {{ font-family: var(--mono); font-size: 12.5px; }}
tr:last-child td {{ border-bottom: 0; }}
.muted {{ color: var(--muted); }}
@media (max-width: 720px) {{
  .list-head {{ display: none; }}
  summary {{ grid-template-columns: 1fr auto auto; }}
  summary .num:nth-of-type(2) {{ display: none; }}
  summary .chips {{ grid-column: 1 / -1; }}
  ul.skus {{ padding-left: 14px; grid-template-columns: 1fr; }}
}}
@media (prefers-reduced-motion: reduce) {{ * {{ transition: none !important; }} }}
</style>

<div class="wrap">
<header>
  <span class="eyebrow">Best Bottles · size consistency audit · production, 27 September 2026</span>
  <h1>One glass, one size</h1>
  <p class="lede">Every variant of the same glass should show that glass at the same size, whatever the colour, cap or fitment. This audit measured every live SKU on the product pages and every configuration in Build Your Bottle, and found where that breaks and why.</p>
</header>

<div class="figures">
  <div class="fig"><span class="n">{P["glassesInconsistent"]}<small> of {P["glasses"]}</small></span><span class="l">glasses change size on the product page when you swap colour, cap or fitment</span></div>
  <div class="fig"><span class="n">{P["variantsOff"]}<small> SKUs</small></span><span class="l">show their glass more than 3% off its standard size on the product page; {P["variantsMajor"]} are more than 8% off</span></div>
  <div class="fig"><span class="n">{B["glassesInconsistent"]}<small> of {B["glasses"]}</small></span><span class="l">bottles change size in Build Your Bottle; {B["variantsOff"]} configurations are off, {B["variantsMajor"]} by more than 8%</span></div>
  <div class="fig"><span class="n">30<small> SKUs</small></span><span class="l">draw the wrong glass: every Footed Rectangle 10 ml is drawn with the Tall Rectangle's glass</span></div>
</div>

<section>
  <span class="eyebrow">What you saw</span>
  <h2>The 5 ml and the Sleek swap</h2>
  <p>On the 5 ml Cylinder, the six <b>short lined caps</b> are still drawn from old per-SKU kits cut from their own Photoshop files. The black ribbed cap and the tall caps are drawn from the component register. Swapping between them changes the glass by about 40%, on the product page and in the builder alike. The Tall 9 ml has the same split (+22%).</p>
  <p>On the Sleek 5 ml and 8 ml cap pages, six of the ten caps have no layers at all. They show the old store photograph, which fills the stage, while the other four draw from the register. The register ones are then shrunk again by an old size lock (0.64) that was written for the flat plates. The result is a bottle that grows 2½ times when you pick a short cap.</p>
  <div class="pair">
    <figure>{img("pdp-5ml-clear-caps", "5 ml clear Cylinder: register short ribbed black cap next to legacy-kit short lined silver cap")}<figcaption>Product page, 5 ml clear Cylinder, same page, two caps.</figcaption></figure>
    <figure>{img("pdp-sleek-5ml-caps", "Sleek 5 ml: register black short cap next to the store photo of the matte silver short cap")}<figcaption>Product page, Sleek 5 ml, same page, two caps.</figcaption></figure>
  </div>
</section>

<section>
  <span class="eyebrow">Why it happens</span>
  <h2>Six causes, in order of reach</h2>
  <p class="muted">Counts are product page SKUs and Build Your Bottle configurations more than 3% off their glass's standard size (the size its register variants share). "Obvious" is more than 8%.</p>

  <div class="cause">
    <div class="cause-head"><span class="tag t-frame">Framing</span><h3>The product page sizes the assembly, not the glass</h3></div>
    <p class="counts">Product page: {P["byCause"].get("frame", 0)} SKUs, {P["byCauseMajor"].get("frame", 0)} obvious · Build Your Bottle: {B["byCause"].get("frame", 0)}</p>
    <p>The stage shrinks the whole bottle until the tallest or widest part fits, including the cap placed beside it. A vintage bulb sprayer with its tassel therefore makes the glass up to 31% smaller than a lotion pump on the same bottle, and a reducer makes it bigger. It is the largest single cause and it is one piece of code. The builder already avoids it by framing every configuration of a bottle with one camera.</p>
    <figure>{img("pdp-round-78-frame", "Round 78 ml clear: lotion pump next to bulb sprayer with tassel, the glass visibly smaller")}<figcaption>Round 78 ml clear, lotion pump against bulb sprayer with tassel: the same glass, 31% smaller.</figcaption></figure>
    <p class="fix"><b>Fix</b>Frame each glass once, from the largest assembly any of its variants needs, and draw every variant with that scale (the builder's method). Code only, no image work.</p>
  </div>

  <div class="cause">
    <div class="cause-head"><span class="tag t-lock">Size locks</span><h3>Old plate-size locks now shrink register drawings</h3></div>
    <p class="counts">About 200 register SKUs: Slim 50 ml at 0.40 (41), Sleek 30 ml at 0.63 (35), Sleek 5 ml at 0.64 (30), Circle 15 ml at 0.775 (30), Empire 50 ml at 0.88 (32), frosted Elegant 60 ml at 0.80 (35)</p>
    <p>The size locks in the product page's standards file were written to shrink oversized flat plates until they were re-exported. The register already draws every glass from its millimetres, and the locks still apply on top. So the 50 ml Slim shows smaller than the 30 ml, and clear Elegant 60 ml is 25% bigger than frosted, because only frosted has a lock.</p>
    <div class="pair">
      <figure>{img("pdp-slim-30-vs-50-lock", "Slim 30 ml next to Slim 50 ml: the 50 ml drawn far smaller")}<figcaption>Slim 30 ml against Slim 50 ml: the bigger bottle drawn at 0.40.</figcaption></figure>
      <figure>{img("pdp-elegant-60-colour-lock", "Elegant 60 ml clear and frosted with the same sprayer, clear visibly larger")}<figcaption>Elegant 60 ml, same sprayer, clear against frosted.</figcaption></figure>
    </div>
    <p class="fix"><b>Fix</b>Apply the locks only to flat plates, never to register drawings. Code only, same change as framing.</p>
  </div>

  <div class="cause">
    <div class="cause-head"><span class="tag t-photo">Photo fallback</span><h3>Variants with no layers show a flat photo at its own scale</h3></div>
    <p class="counts">Product page: {P["byCause"].get("photo", 0)} SKUs, {P["byCauseMajor"].get("photo", 0)} obvious · Build Your Bottle: {B["byCause"].get("photo", 0)} · mostly short liner caps (83), then rollers, Minaret caps and vintage sprayers with rings</p>
    <p>When a variant has neither register parts nor a published kit, the stage shows a photograph instead: an old store GIF, a plate, or a catalogue image. Each is framed its own way and drawn in a smaller box, so it can be anywhere from 40% smaller to 2½ times larger than its register siblings. In the builder these show as a flat photo at 88%.</p>
    <p class="fix"><b>Fix</b>Bring the missing closures into the register (short liner caps first; they are already the open question in the 13-415 lane), so these variants draw from layers like the rest.</p>
  </div>

  <div class="cause">
    <div class="cause-head"><span class="tag t-kit">Legacy kit</span><h3>Old per-SKU kits on glasses the register already draws</h3></div>
    <p class="counts">Product page: {P["byCause"].get("kit", 0)} SKUs, {P["byCauseMajor"].get("kit", 0)} obvious · Build Your Bottle: {B["byCause"].get("kit", 0)}, {B["byCauseMajor"].get("kit", 0)} obvious · mostly reducers (51), short liner caps (25), 9 ml amber rollers (20, −5%)</p>
    <p>Where the register has no part for a closure, the page falls back to the SKU's published kit. Those kits were cut from individual Photoshop files at whatever scale each file had, so the glass lands 5% to 69% off its register siblings. Reducers are the biggest group in the builder.</p>
    <div class="pair">
      <figure>{img("byb-5ml-caps", "Build Your Bottle 5 ml: short ribbed black cap next to short lined matte copper, the second glass larger")}<figcaption>Build Your Bottle, 5 ml clear, two screw caps on one step.</figcaption></figure>
      <figure>{img("pdp-tall-9ml-caps", "Tall Cylinder 9 ml: register short ribbed white next to legacy kit short lined matte gold")}<figcaption>Product page, Tall Cylinder 9 ml, same page, two caps.</figcaption></figure>
    </div>
    <p class="fix"><b>Fix</b>Same as photo fallback: register parts for reducers and short liner caps retire these kits.</p>
  </div>

  <div class="cause">
    <div class="cause-head"><span class="tag t-image">Image scale</span><h3>Photoshop sets that disagree with themselves</h3></div>
    <p class="counts">Product page: {P["byCause"].get("image", 0)} SKUs, {P["byCauseMajor"].get("image", 0)} obvious · Empire 100 ml (29), 4 ml vials, Boston Round, Elegant 30 ml</p>
    <p>Some glasses have no register body yet, so every variant is a legacy kit, and the kits disagree. Empire 100 ml's lotion pump and bulb sprayer kits draw the glass 23% smaller than its perfume spray kits. The 4 ml vial droppers are 20% small. The table below lists every Photoshop set whose glass size spreads by more than 8%.</p>
    <figure>{img("pdp-empire-100-image", "Empire 100 ml perfume spray next to the lotion pump, the lotion pump glass smaller")}<figcaption>Empire 100 ml, perfume spray against lotion pump: both legacy kits, 23% apart.</figcaption></figure>
    <p class="fix"><b>Fix</b>Register bodies for these glasses. Empire 50 and 100 ml are already built on dev (PR #293); vials, Boston Round and Elegant 30 ml follow.</p>
  </div>

  <div class="cause">
    <div class="cause-head"><span class="tag t-wrong">Wrong glass</span><h3>Footed Rectangle 10 ml draws the Tall Rectangle</h3></div>
    <p class="counts">30 SKUs on the three Footed Rectangle pages</p>
    <p>The register has a single 10 ml Rectangle body. The catalogue has two different glasses: Footed Rectangle (50 mm tall, 29 × 19 mm) and Tall Rectangle (101 mm tall, 17 × 17 mm). The register body is the tall one, so every footed SKU shows the wrong bottle. This is not a size problem, and the audit only caught it because the footed photos looked 240% larger.</p>
    <figure>{img("pdp-rectangle-wrong-glass", "Footed Rectangle roll-on drawn as a tall slim glass next to the real footed rectangle photo")}<figcaption>Footed Rectangle 10 ml: the register drawing (left) against the product's own photo (right).</figcaption></figure>
    <p class="fix"><b>Fix</b>Split the register body in two and cut the footed glass from its master Photoshop file. Needs the footed PSD.</p>
  </div>
</section>

<section>
  <span class="eyebrow">What to do, in order</span>
  <h2>Fix plan</h2>
  <ol class="plan">
    <li><b>One code change for the product page.</b> Frame each glass once across all its variants, and stop applying plate-era size locks to register drawings. This clears the {P["byCause"].get("frame", 0)} framing cases and the lock shrink on about 200 register SKUs (Slim 50, Sleek 5 and 30, Circle 15, Empire 50, frosted Elegant 60), with no image work.</li>
    <li><b>Split the 10 ml Rectangle register body</b> into Footed and Tall, and cut the footed glass. 30 SKUs currently show the wrong bottle.</li>
    <li><b>Register parts for short liner caps and reducers.</b> These two closure types account for most photo and legacy-kit fallbacks on both pages (160 product page SKUs and 65 builder configurations).</li>
    <li><b>Register bodies for the glasses still on legacy kits:</b> Empire 50/100 ml (built on dev, PR #293), then the 4 ml vials, Boston Round and Elegant 30 ml.</li>
    <li><b>Remaining photo-only closures:</b> Minaret caps and vintage sprayers with rings. Each is a small batch once the register parts exist.</li>
  </ol>
  <div class="decide">
    <h3>Decisions needed from you</h3>
    <p>Approve step 1 as a pull request (code only, verifiable with this audit's scripts). Confirm the short liner cap source, which is still open in the 13-415 register lane. Point to the Footed Rectangle 10 ml master Photoshop file for step 2.</p>
  </div>
</section>

<section>
  <span class="eyebrow">Every glass</span>
  <h2>Product page, glass by glass</h2>
  <p class="muted">Open a row to see its SKUs. The red dot marks a glass with at least one variant more than 8% off; amber is 3 to 8%. {P["glasses"] - P["glassesInconsistent"]} glasses are consistent and not listed.</p>
  <div class="toolbar"><label class="sr" for="q-pdp" hidden>Filter glasses</label><input id="q-pdp" type="search" placeholder="Filter by glass or SKU, e.g. sleek or GBCyl5" data-list="list-pdp"><span class="legend">{chips({"frame": P["byCause"].get("frame", 0), "photo": P["byCause"].get("photo", 0), "kit": P["byCause"].get("kit", 0), "image": P["byCause"].get("image", 0)})}</span></div>
  <div class="list" id="list-pdp">
    <div class="list-head"><span>Glass</span><span>SKUs</span><span>Off</span><span>Worst</span><span>Causes</span></div>
    {glass_rows("pdp")}
  </div>
</section>

<section>
  <h2>Build Your Bottle, bottle by bottle</h2>
  <p class="muted">The builder frames every configuration of a bottle with one camera, so framing matters much less here. What remains is photo fallbacks and legacy kits. At the glass step, {BB["glassesInconsistent"]} of {BB["glasses"]} bottles show a glass colour at a different size.</p>
  <div class="toolbar"><input id="q-byb" type="search" placeholder="Filter by bottle or SKU" data-list="list-byb" aria-label="Filter bottles"></div>
  <div class="list" id="list-byb">
    <div class="list-head"><span>Bottle</span><span>Configs</span><span>Off</span><span>Worst</span><span>Causes</span></div>
    {glass_rows("byb")}
  </div>
</section>

<section>
  <h2>Photoshop sets that disagree with themselves</h2>
  <p class="muted">Glass width in pixels per millimetre of catalogue diameter, per glass, for images cut from the master Photoshop files (published kit layers and plates). Within one glass these should match. Register drawings are sized from millimetres and are not listed.</p>
  <div class="scroll"><table>
    <thead><tr><th>Glass</th><th>Images</th><th class="num">Count</th><th class="num">Spread</th><th>Furthest off</th></tr></thead>
    <tbody>{psd_rows}</tbody>
  </table></div>
</section>

<section>
  <span class="eyebrow">How it was measured</span>
  <h2>Method and checks</h2>
  <p>Every live SKU on production (2,479 on 27 September) was resolved the way the product page resolves it: register parts first, then the published kit, then the fallback photo. The audit then ran the page's own layout code. Build Your Bottle ran the builder's loaders and its own body framing for all 1,948 previews. Glass width was measured from solid pixels across the glass band, never from bounding boxes, so a clear glass's faint halo cannot move it. Sizes are desktop pixels at 1440 × 900 (product page stage 672 × 540, builder preview 410 × 472).</p>
  <p>To check the arithmetic, 16 variants were opened on the live site and the glass was measured in the screenshot. Most agree within 2%, and photos within 1% when the page shows the same image. Four clear-glass cases differ by 4% to 23%. Clear glass on the bone stage is hard to measure from a screenshot, so there the screenshot is the weaker number. The difference between variants still matches: the Empire 100 ml pair is 21% apart live and 23% computed. Clear glass in a white photo carries about ±5% uncertainty. Phones scale the same frames down evenly, so the percentages hold there too. Metal atomizers are left out: they are metal cases, and their photos show three pieces side by side.</p>
  <div class="scroll"><table>
    <thead><tr><th>SKU</th><th>Drawn from</th><th class="num">Computed px</th><th class="num">Live px</th><th class="num">Difference</th></tr></thead>
    <tbody>{val_html}</tbody>
  </table></div>
  <p class="muted">Scripts: <code>scripts/audit/size-consistency/</code> (pdp-stage.ts, byb-preview.ts, measure.py, analyse.py). Re-run after each fix to confirm the counts fall.</p>
</section>
</div>

<script>
document.querySelectorAll('input[data-list]').forEach(input => {{
  const list = document.getElementById(input.dataset.list);
  input.addEventListener('input', () => {{
    const q = input.value.trim().toLowerCase();
    list.querySelectorAll('details.glass').forEach(row => {{ row.hidden = q !== '' && !row.dataset.q.includes(q); }});
  }});
}});
</script>
"""
(out_dir / "index.html").write_text(page)
print("wrote", out_dir / "index.html", len(page) // 1024, "KB")
