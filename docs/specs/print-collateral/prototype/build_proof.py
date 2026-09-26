"""Build the Boston Round print proof: order insert, line-booklet pages and a catalogue spread.

The proof is a design sign-off piece for PRINT-PLAN.md. Every product fact on it comes from the
August 2026 production export (boston_data.py) or from the locked copy rules in
docs/specs/pdp-item-descriptions/. Photography is the approved catalogue set in public/images/catalog.

    pip install pillow segno playwright pymupdf
    python3 docs/specs/print-collateral/prototype/build_proof.py

Output: boston-round-proof.pdf next to this file, plus PNG previews in build/previews/.
"""
from __future__ import annotations

import html
import re
import statistics
import subprocess
from pathlib import Path

import segno
from PIL import Image, ImageChops, ImageFilter

from boston_data import GLASS_ORDER, load

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CATALOG = ROOT / "public/images/catalog"
BUILD = HERE / "build"
IMAGES = BUILD / "images"
FONTS = BUILD / "fonts"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BONE = (245, 243, 239)
SITE = "https://www.bestbottles.com"
PHONE = "1-800-936-3628"

# One approved photograph per slot. Keys are website SKUs.
PHOTOS = {
    "GBCylAmb9MtlRollBlkDot": "cylinder-pilot-2026-09-22",
    "GBCylAmb9SpryMattSl": "cylinder-pilot-2026-09-22",
    "GBDiva30SpryMtGl": "boston-diva-approved-2026-09-23",
    "GBElg60AnSpTslIvyGl": "elegant-approved-2026-09-23",
    "GBBstnAmb1ozWhtDropperShnGlTrim": "boston-diva-approved-2026-09-23",
    "GBBstnAmb1ozBlkCapSht": "boston-diva-approved-2026-09-23",
    "GBDiva30RdcrShnGl": "boston-diva-approved-2026-09-23",
    "LBDiva30LtnMtGl": "boston-diva-approved-2026-09-23",
    "GB15ApthBlue": "apothecary-approved-2026-09-24",
    "GBVAmb1DrmWhtCapSht": "vials-approved-2026-09-25",
    "GBAtom10Gl": "next-four-approved-2026-09-24",
    "CreamJarAmb40Blkcap": "bone-review",
    "GBBstnAmb15mlWhtDropperGlTrim": "boston-diva-approved-2026-09-23",
    "GBBstnAmb1ozMtlRollonMattSl": "boston-diva-approved-2026-09-23",
    "GBBstnAmb2ozBlkCapSht": "boston-diva-approved-2026-09-23",
    "GBBstnAmb1ozRollonMattGl": "boston-diva-approved-2026-09-23",
    "GBBstnBlu15BlkCapSht": "boston-diva-approved-2026-09-23",
    "GBBstnBlu1ozBlkCapSht": "boston-diva-approved-2026-09-23",
    "GBBstnBlu2ozBlkCapSht": "boston-diva-approved-2026-09-23",
    "GBBstn2ozBlkDrprShnGlTrim": "boston-diva-approved-2026-09-23",
    "GBBstnAmb2ozBlkDropperShnGlTrim": "boston-diva-approved-2026-09-23",
    "GBBstnBlu2ozBlkDropperShnGlTrim": "boston-diva-approved-2026-09-23",
}

# The twelve bottle types, in the order a buyer chooses by use. Wording follows RUBRIC.md §4.2
# and the type nouns in COPY-STRATEGY.md §2.4.
USES = [
    ("GBCylAmb9MtlRollBlkDot", "Roll-On Bottle", "Perfume oil, attar and oil blends diluted in a carrier.", "The ball alone is not a seal; carry it capped."),
    ("GBCylAmb9SpryMattSl", "Fine-Mist Spray Bottle", "Spray perfume, body mist, room and linen spray.", "At 15 ml and under, used for samples and decants."),
    ("GBDiva30SpryMtGl", "Perfume Spray Bottle", "Eau de parfum, eau de toilette and cologne.", "Each press of the pump meters one spray."),
    ("GBElg60AnSpTslIvyGl", "Vintage Bulb Spray Bottle", "Eau de parfum and cologne kept on a dressing table.", "Not a travel bottle."),
    ("GBBstnAmb1ozWhtDropperShnGlTrim", "Dropper Bottle", "Essential oils, beard oil and facial serums.", "Releases one drop at a time."),
    ("GBBstnAmb1ozBlkCapSht", "Pour Bottle", "Beard oil, hair oil, body oil and essential oils.", "No fitment; the oil pours from the neck."),
    ("GBDiva30RdcrShnGl", "Pour Bottle with Reducer", "Splash cologne, aftershave, perfume oil, beard oil.", "The reducer slows the pour to a splash or drip."),
    ("LBDiva30LtnMtGl", "Lotion Pump Bottle", "Body lotion, liquid soap, serums, body and hair oil.", "For liquids that pour; creams go in a jar."),
    ("GB15ApthBlue", "Bottle with Glass Stopper", "Perfume oil and attar kept on a shelf.", "The stopper is not leak-proof."),
    ("GBVAmb1DrmWhtCapSht", "Vials and Drams", "Samples, testers and promotional giveaways.", "Sizes up to 5 ml, plus every vial."),
    ("GBAtom10Gl", "Travel Atomizer", "Decants of eau de parfum or cologne.", "A metal shell around a refillable glass vial."),
    ("CreamJarAmb40Blkcap", "Cream Jar", "Cream, balm, body butter, salve, solid perfume.", "For products too thick to pour."),
]

FAMILIES = [
    "Cylinder", "Tall Cylinder", "Boston Round", "Circle", "Round", "Elegant", "Diva", "Empire",
    "Sleek", "Slim", "Diamond", "Grace", "Tulip", "Bell", "Rectangle", "Square", "Royal", "Flair",
    "Pillar", "Teardrop", "Apothecary", "Vials and Drams", "Travel Atomizers", "Cream Jars",
    "Aluminum and Plastic",
]


# What fits what, by neck finish. Wording follows the 23 Sep 2026 neck-thread sheets
# (data/register/source/neck-thread-2026-09-23) in the locked vocabulary; bottle lists match the
# component register's current bodies (data/register/bodies.csv, 25 Sep 2026).
SHARED_NECKS = [
    ("13-415",
     "Cylinder 5 ml · Tall Cylinder 9 ml · Sleek 5 and 8 ml · Tulip 5 and 6 ml · Pillar 9 ml · Bell 10 ml · "
     "Rectangle and Tall Rectangle 10 ml · Royal 13 ml · Circle, Elegant, Flair and Square 15 ml",
     "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · short ribbed cap · short lined cap · tall lined cap"),
    ("15-415", "Circle and Elegant 30 ml", "Fine-mist sprayer · lined cap"),
    ("17-415", "Cylinder 9 ml",
     "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · treatment pump"),
    ("18-400", "Boston Round 15 ml · 9 ml vial",
     "Boston Round: dropper (66 mm stem) or short screw cap. Vial: short screw cap or cap with glass rod"),
    ("18-415",
     "Circle 50 and 100 · Cylinder 25, 50 and 100 · Diamond 60 · Diva 30, 46 and 100 · Elegant 60 and 100 · "
     "Empire 50 and 100 · Grace 55 · Round 78 and 128 · Sleek and Slim 30, 50 and 100 ml",
     "Fine-mist sprayer · lotion pump · vintage bulb sprayer, with or without tassel · orifice reducer with cap · "
     "faux-leather cap · lined cap · dropper (Circle 50, Cylinder 25, Diva 46, Elegant 60, Empire 50, Round 128, "
     "Sleek 30 and Slim 30 ml)"),
    ("20-400", "Boston Round 30 and 60 ml",
     "Roll-on cap over a steel or plastic roller ball · dropper (76 mm stem on 30 ml, 90 mm on 60 ml) · short screw cap"),
]
COMPLETE_SETS = [
    ("16 mm", "Cylinder 28 and 50 ml", "Steel or plastic roller ball with a black or white cap"),
    ("12 mm", "Cylinder 3 and 4 ml", "Fine-mist sprayer, black or white"),
    ("13-425", "Vials, 2 to 4 ml", "Short black or white cap; dropper on the 4 ml"),
    ("8-425", "Vials, 2 ml", "Short or tall cap"),
    ("Plug", "Vials, 1 ml", "Plug"),
]
OWN_CLASS = [
    ("Stopper", "Apothecary 15 and 30 ml · Pear 118 ml · Teardrop and Rectangle 9 ml · Genie 32 ml · Eternal Flame 35 ml",
     "Ground-glass stopper, matched to its bottle; no screw thread"),
    ("20-410", "Aluminum bottles, 65 to 500 ml", "Sprayer or lotion pump as sold; glass-bottle parts do not apply"),
    ("Atomizer", "Travel atomizers, 5 and 10 ml", "Sold complete"),
    ("Jar", "Cream jars, 3 to 63 ml", "Each lid is matched to its jar"),
]


def esc(text: str) -> str:
    return html.escape(text, quote=True)


# --------------------------------------------------------------------------- assets

def source(sku: str) -> Path:
    matches = sorted((CATALOG / PHOTOS[sku]).glob(f"{sku}.*"))
    if not matches:
        raise FileNotFoundError(sku)
    return matches[0]


def to_bone(img: Image.Image) -> Image.Image:
    """Put the photograph on the exact bone page colour.

    The studio backgrounds drift a few levels from bone and carry a faint gradient, which shows as a
    visible panel on the page. Pixels within a few levels of the background become pure bone; the
    bottle, its shadow and anything else that differs keep their own colour, with a soft edge between.
    """
    img = img.convert("RGB")
    w, h = img.size
    corners = [img.getpixel((x, y)) for x in (4, w - 5) for y in (4, h - 5)]
    gains = [BONE[c] / max(1, statistics.median(p[c] for p in corners)) for c in range(3)]
    img = Image.merge("RGB", [b.point(lambda v, g=g: min(255, round(v * g))) for b, g in zip(img.split(), gains)])
    bone = Image.new("RGB", img.size, BONE)
    r, g, b = ImageChops.difference(img, bone).split()
    diff = ImageChops.lighter(ImageChops.lighter(r, g), b)
    alpha = diff.point(lambda v: 0 if v <= 3 else 255 if v >= 12 else round((v - 3) * 255 / 9))
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    return Image.composite(img, bone, alpha)


def content_box(img: Image.Image, tolerance: int = 8) -> tuple[int, int, int, int]:
    """Bounding box of everything that is not background, shadow included."""
    bone = Image.new("RGB", img.size, BONE)
    r, g, b = ImageChops.difference(img, bone).split()
    diff = ImageChops.lighter(ImageChops.lighter(r, g), b)
    return diff.point(lambda v: 255 if v > tolerance else 0).getbbox() or (0, 0, img.width, img.height)


def prepare(set_name: str, skus: list[str], px_per_card: int = 1500, pad: float = 0.025) -> dict[str, dict]:
    """Crop a set of photographs for one row or grid.

    Every photo in the set shares the same vertical crop and the same scale, measured against the
    10:11 product card, so the bottles keep their relative sizes. Each photo keeps only its own width.
    Returns, per SKU, the file URI and the crop size in card widths.
    """
    IMAGES.mkdir(parents=True, exist_ok=True)
    photos = {sku: to_bone(Image.open(source(sku))) for sku in skus}
    boxes = {}
    for sku, img in photos.items():
        l, t, r, b = content_box(img)
        boxes[sku] = (l / img.width, t / img.width, r / img.width, b / img.width)
    top = max(0.0, min(bx[1] for bx in boxes.values()) - pad)
    bottom = max(bx[3] for bx in boxes.values()) + pad / 2
    out = {}
    for sku, img in photos.items():
        l, _, r, _ = boxes[sku]
        l, r = max(0.0, l - pad), min(1.0, r + pad)
        crop = img.crop((round(l * img.width), round(top * img.width), round(r * img.width), min(img.height, round(bottom * img.width))))
        w = r - l
        h = crop.height / img.width
        crop = crop.resize((round(w * px_per_card), round(h * px_per_card)), Image.LANCZOS)
        path = IMAGES / f"{set_name}-{sku}.jpg"
        crop.save(path, quality=90)
        out[sku] = {"uri": path.as_uri(), "w": w, "h": h}
    return out


def strip(photos: dict, items: list[tuple[str, str]], width: float, height: float, gap: float = 0.1) -> str:
    """A row of photographs at one shared scale, as large as the box allows."""
    total = sum(photos[s]["w"] for s, _ in items)
    tallest = max(photos[s]["h"] for s, _ in items)
    scale = min((width - gap * (len(items) - 1)) / total, height / tallest)
    figures = "".join(
        f"<figure style='width:{photos[s]['w'] * scale:.3f}in'><img class=photo src='{photos[s]['uri']}' alt=''>"
        + (f"<figcaption>{esc(c)}</figcaption>" if c else "")
        + "</figure>"
        for s, c in items
    )
    return f"<div class=strip style='gap:{gap}in'>{figures}</div>"


def fonts() -> str:
    """Local @font-face rules. Cormorant ships with the site; Inter and Plex Mono are fetched once."""
    FONTS.mkdir(parents=True, exist_ok=True)
    faces = []
    for style in ("normal", "italic"):
        woff = ROOT / f"public/fonts/cormorant/cormorant-latin-wght-{style}.woff2"
        faces.append(
            f"@font-face{{font-family:'Cormorant';font-style:{style};font-weight:300 700;"
            f"src:url('{woff.as_uri()}') format('woff2')}}"
        )
    wanted = {
        "Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
        "IBM Plex Mono": "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
    }
    agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36"
    for family, url in wanted.items():
        css_path = FONTS / (re.sub(r"\W+", "-", family).lower() + ".css")
        if not css_path.exists():
            css = subprocess.run(["curl", "-sSfL", "-A", agent, url], capture_output=True, text=True, check=True).stdout
            css_path.write_text(css)
        css = css_path.read_text()
        # Keep the latin subset only, and point each face at a local copy.
        for block in re.findall(r"/\* latin \*/\s*(@font-face\s*{[^}]+})", css):
            remote = re.search(r"url\((https://[^)]+)\)", block).group(1)
            local = FONTS / remote.rsplit("/", 1)[1]
            if not local.exists():
                subprocess.run(["curl", "-sSfL", "-o", str(local), remote], check=True)
            faces.append(block.replace(remote, local.as_uri()))
    return "\n".join(faces)


def qr(url: str) -> str:
    return segno.make(url, error="m").svg_data_uri(dark="#1D1D1F", light=None, border=0, scale=4)


def wordmark() -> str:
    src = Image.open(ROOT / "public/brand/best-bottles-wordmark.png")
    path = IMAGES / "wordmark.png"
    IMAGES.mkdir(parents=True, exist_ok=True)
    src.crop(src.getbbox()).save(path)
    return path.as_uri()


# --------------------------------------------------------------------------- styles

BASE_CSS = """
:root{
  --bone:#F5F3EF; --panel:#EFEAE0; --ink:#1D1D1F; --ink2:#2C2C2E; --mute:#5F5A53;
  --rule:#CDBF9F; --hair:#DDD3BF; --gold:#8B6F42; --gold2:#C5A065;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bone);color:var(--ink);font-family:'Inter',sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:'tnum' 1,'lnum' 1}
.page{position:relative;overflow:hidden;background:var(--bone);break-after:page}
.page:last-child{break-after:auto}
.serif{font-family:'Cormorant',serif}
.mono{font-family:'IBM Plex Mono',monospace}
.kicker{font-size:6.2pt;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.rule{height:.5pt;background:var(--rule)}
.goldrule{width:.42in;height:1pt;background:var(--gold2)}
img.photo{display:block;width:100%;height:auto}
.strip{display:flex;justify-content:center;align-items:flex-end}
.strip figure{margin:0;flex:none}
.strip figcaption{font-size:5.9pt;color:var(--mute);text-align:center;letter-spacing:.03em;margin-top:.03in;white-space:nowrap}
.dot{display:inline-block;width:6.5pt;height:6.5pt;border-radius:50%;background:var(--gold)}
.none{display:inline-block;width:7pt;height:.6pt;background:#B9AE98;vertical-align:middle}
table{border-collapse:collapse;width:100%}
"""

SMALL_CSS = """
@page{size:5in 7in;margin:0}
.page{width:5in;height:7in;padding:.34in .36in}
.top{display:flex;justify-content:space-between;align-items:center}
.top img{height:.105in;width:auto}
.folio{position:absolute;bottom:.26in;font-size:6pt;color:var(--mute);letter-spacing:.08em}
.folio.l{left:.36in}.folio.r{right:.36in}
"""


def page_shell(css: str, body: str, face_css: str) -> str:
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        f"<style>{face_css}\n{BASE_CSS}\n{css}</style></head><body>{body}</body></html>"
    )


# --------------------------------------------------------------------------- shared blocks

def fit_chart(table: list[dict], compact: bool) -> str:
    cols = [("Dropper", "Dropper"), ("Steel roller ball", "Steel roller"), ("Plastic roller ball", "Plastic roller"), ("Short screw cap", "Screw cap")]
    head = "".join(f"<th>{esc(label)}</th>" for _, label in cols)
    rows = []
    for block in table:
        have = {row["fitment"] for row in block["rows"]}
        cells = "".join(
            f"<td>{'<span class=dot></span>' if key in have else '<span class=none></span>'}</td>" for key, _ in cols
        )
        oz = {"15 ml": " (0.5 oz)", "30 ml": " (1 oz)", "60 ml": " (2 oz)"}.get(block["size"], "")
        rows.append(
            f"<tr><th class=size>{esc(block['size'] + oz)}<span class='mono neck'>{esc(block['neck'])}</span></th>{cells}</tr>"
        )
    cls = "fit compact" if compact else "fit"
    return f"<table class='{cls}'><thead><tr><th></th>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table>"


FIT_CSS = """
table.fit th,table.fit td{border-bottom:.5pt solid var(--hair);text-align:center;padding:5pt 2pt}
table.fit thead th{font-size:5.8pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);border-bottom:.75pt solid var(--rule)}
table.fit th.size{text-align:left;font-size:8.4pt;font-weight:500;white-space:nowrap}
table.fit .neck{display:block;font-size:6.4pt;font-weight:400;color:var(--mute);margin-top:1pt}
"""


# --------------------------------------------------------------------------- shared copy

URL = f"{SITE}/catalog/boston-round"
CARE = [
    ("Dropper", "Store it upright; undiluted essential oil softens the rubber bulb over time."),
    ("Roller ball", "Carry it capped and upright; the ball alone is not a seal."),
    ("Screw cap", "With no fitment, the oil pours straight from the neck."),
    ("Glass", "Amber reduces the light that reaches the contents; clear shows the fill level."),
]
FINISHES = [
    ("Dropper", "Black or white bulb; collar to match the bulb, or shiny gold or shiny silver."),
    ("Dropper stem", "66 mm on 15 ml, 76 mm on 30 ml, 90 mm on 60 ml. Each size has its own dropper."),
    ("Roll-on caps", "Matte black, gold or silver; shiny black, gold or silver."),
    ("Screw cap", "Short black cap."),
]
OVERVIEW = (
    "The 30 ml and 60 ml sizes take a dropper, a steel or plastic roller ball, or a screw cap on the same "
    "20-400 neck. The 15 ml takes a dropper or a screw cap on an 18-400 neck."
)


def oz(size: str) -> str:
    return {"15 ml": " (0.5 oz)", "30 ml": " (1 oz)", "60 ml": " (2 oz)"}.get(size, "")


def labelled(rows: list[tuple[str, str]], cls: str) -> str:
    return f"<ul class='{cls}'>" + "".join(f"<li><b>{esc(k)}</b><span>{esc(v)}</span></li>" for k, v in rows) + "</ul>"


LIST_CSS = """
ul.care,ul.fin{list-style:none}
ul.care li,ul.fin li{display:flex;gap:.08in;font-size:7pt;line-height:1.45;color:var(--ink2)}
ul.care li{padding:3.2pt 0;border-bottom:.5pt solid var(--hair)}
ul.fin li{padding:1pt 0}
ul.care b,ul.fin b{flex:0 0 .78in;font-weight:600;color:var(--ink)}
"""


# --------------------------------------------------------------------------- the order insert (5 x 7 in)

def insert_pages(data: dict, photos: dict, mark: str) -> tuple[str, str]:
    table = data["table"]
    hero = strip(
        photos["insert"],
        [("GBBstnAmb15mlWhtDropperGlTrim", "15 ml (0.5 oz) · dropper"), ("GBBstnAmb1ozMtlRollonMattSl", "30 ml (1 oz) · steel roller ball"), ("GBBstnAmb2ozBlkCapSht", "60 ml (2 oz) · screw cap")],
        width=4.5, height=3.2, gap=0.14,
    )
    glass = strip(
        photos["glass"],
        [("GBBstn2ozBlkDrprShnGlTrim", "Clear"), ("GBBstnAmb2ozBlkDropperShnGlTrim", "Amber"), ("GBBstnBlu2ozBlkDropperShnGlTrim", "Cobalt blue")],
        width=1.8, height=0.95, gap=0.12,
    )
    code = qr(URL + "?utm_source=print&utm_medium=insert&utm_campaign=boston-round")
    front = f"""
<section class='page insert-front'>
  <div class=top><img src='{mark}' alt='Best Bottles'><span class=kicker>Family card</span></div>
  <div class=hero>{hero}</div>
  <div class=intro>
    <p class=kicker>Glass · 18-400 and 20-400 necks</p>
    <h1 class=serif>Boston Round</h1>
    <p class=sizes>15 ml (0.5 oz) &nbsp;·&nbsp; 30 ml (1 oz) &nbsp;·&nbsp; 60 ml (2 oz) &nbsp;·&nbsp; clear, amber and cobalt blue glass</p>
    <div class=goldrule></div>
    <p class=body>A round bottle with sloped shoulders and a short neck, used for essential oils, beard oil,
    facial serums and perfume oil. {esc(OVERVIEW)}</p>
  </div>
</section>"""
    back = f"""
<section class='page insert-back'>
  <div class=top><span class=kicker>Fitments and care</span><span class='kicker mute'>Boston Round</span></div>
  <h2 class=serif>What fits each size</h2>
  {fit_chart(table, compact=False)}
  {labelled(FINISHES, 'fin')}
  <p class=note>Not every finish is made in every glass colour. The full list is online.</p>
  <div class=split>
    <div><p class=kicker>Use and care</p>{labelled(CARE, 'care')}</div>
    <div class=glass><p class=kicker>Glass</p>{glass}</div>
  </div>
  <div class=reorder>
    <img src='{code}' alt=''>
    <div>
      <p class=r1>Reorder, or see every size, colour and fitment</p>
      <p class='r2 mono'>bestbottles.com/catalog/boston-round</p>
      <p class=r3>{PHONE} &nbsp;·&nbsp; Item numbers are on your packing slip.</p>
    </div>
  </div>
  <p class=imprint>Best Bottles · Nemat International, Inc. · Union City, California</p>
</section>"""
    css = SMALL_CSS + FIT_CSS + LIST_CSS + """
.insert-front .hero{position:absolute;left:0;right:0;top:.62in;bottom:2.5in;display:flex;align-items:center;justify-content:center}
.insert-front .intro{position:absolute;left:.36in;right:.36in;bottom:.34in}
.insert-front h1{font-size:40pt;font-weight:500;line-height:.95;margin:.05in 0 .07in;letter-spacing:-.005em}
.insert-front .sizes{font-size:7.4pt;line-height:1.55;color:var(--ink2)}
.insert-front .goldrule{margin:.11in 0 .09in}
.insert-front .body{font-size:7.7pt;line-height:1.55;color:var(--ink2)}
.insert-back .mute{color:var(--mute)}
.insert-back h2{font-size:21pt;font-weight:500;margin:.1in 0 .06in;line-height:1.05}
.insert-back ul.fin{margin-top:.1in}
.insert-back .note{color:var(--mute);font-size:6.3pt;margin-top:.03in}
.insert-back .split{display:grid;grid-template-columns:1fr 1.9in;gap:.2in;margin-top:.16in}
.insert-back .split .kicker{margin-bottom:.04in}
.insert-back ul.care b{flex-basis:.66in}
.insert-back .glass .strip{justify-content:space-between}
.insert-back .reorder{position:absolute;left:.36in;right:.36in;bottom:.5in;display:flex;gap:.14in;align-items:center;
  border-top:.75pt solid var(--rule);padding-top:.12in}
.insert-back .reorder img{width:.7in;height:.7in}
.insert-back .r1{font-size:7.4pt;font-weight:600}
.insert-back .r2{font-size:7.4pt;margin:.03in 0;color:var(--gold)}
.insert-back .r3{font-size:6.6pt;color:var(--mute)}
.insert-back .imprint{position:absolute;left:.36in;bottom:.28in;font-size:5.8pt;color:var(--mute);letter-spacing:.04em}
"""
    return css, front + back


# --------------------------------------------------------------------------- the line booklet (5 x 7 in, saddle-stitched)

def booklet_pages(data: dict, photos: dict, mark: str) -> tuple[str, str]:
    cover_row = strip(
        photos["cover"],
        [("GBCylAmb9MtlRollBlkDot", ""), ("GBElg60AnSpTslIvyGl", ""), ("GBBstnAmb1ozWhtDropperShnGlTrim", ""), ("GB15ApthBlue", ""), ("GBAtom10Gl", "")],
        width=4.7, height=2.3, gap=0.02,
    )
    cover = f"""
<section class='page b-cover'>
  <img class=mark src='{mark}' alt='Best Bottles'>
  <div class=title>
    <p class=kicker>2026 edition</p>
    <h1 class=serif>The Line</h1>
    <p class=sub>Glass bottles, fitments and closures</p>
  </div>
  <div class=row>{cover_row}</div>
</section>"""

    def toc(items):
        return "".join(f"<li><span>{esc(a)}</span><i></i><b>{esc(b)}</b></li>" for a, b in items)

    contents = f"""
<section class='page b-contents'>
  <p class=kicker>Contents</p>
  <h2 class=serif>In this book</h2>
  <p class=lede>Every bottle is sold empty, with the fitment and cap shown. Capacities are in millilitres,
  with ounces where buyers use them. Each family page lists its sizes, neck finishes, glass colours and
  the fitments that screw onto it.</p>
  <ul class=toc>{toc([("Glass colours and cap finishes", "3"), ("Choose by use", "4"), ("What fits what: neck finishes", "6")])}</ul>
  <p class='kicker sect'>The families</p>
  <ul class='toc cols'>{toc([(f, str(8 + i)) for i, f in enumerate(FAMILIES)])}</ul>
  <ul class=toc>{toc([("Samples and promotional sizes", "33"), ("Caps and closures sold separately", "34"), ("Ordering and custom work", "35")])}</ul>
  <span class='folio l'>2</span>
</section>"""
    uses = photos["uses"]
    cell_w, cell_h = 2.0, 1.22
    scale = min(min(cell_w / uses[s]["w"] for s, *_ in USES), cell_h / max(uses[s]["h"] for s, *_ in USES))
    cells = [
        f"<div class=cell><div class=ph><img class=photo style='width:{uses[s]['w'] * scale:.3f}in' src='{uses[s]['uri']}' alt=''></div>"
        f"<h3 class=serif>{esc(noun)}</h3><p class=for>{esc(for_line)}</p><p class=fact>{esc(fact)}</p></div>"
        for s, noun, for_line, fact in USES
    ]
    use_a = f"""
<section class='page b-use'>
  <p class=kicker>Choose by use</p>
  <h2 class=serif>What each bottle is for</h2>
  <div class=grid>{''.join(cells[:6])}</div>
  <span class='folio l'>4</span>
</section>"""
    use_b = f"""
<section class='page b-use'>
  <p class=kicker>Choose by use</p>
  <h2 class='serif ghost'>What each bottle is for</h2>
  <div class=grid>{''.join(cells[6:])}</div>
  <span class='folio r'>5</span>
</section>"""
    def neck_rows(rows):
        return "".join(
            f"<div class=nrow><p class='nk mono'>{esc(n)}</p><div><p class=nb>{esc(b)}</p><p class=nf>{esc(f)}</p></div></div>"
            for n, b, f in rows
        )

    fits_a = f"""
<section class='page b-fits'>
  <p class=kicker>Neck finishes</p>
  <h2 class=serif>What fits what</h2>
  <p class=lede>Caps, rollers, sprayers, pumps and droppers screw onto the neck, so every bottle with the same
  neck finish shares the same parts. In <span class=mono>18-415</span>, 18 is the neck's diameter in millimetres
  and 415 is the thread style.</p>
  <p class='kicker sect'>Shared parts</p>
  {neck_rows(SHARED_NECKS)}
  <span class='folio l'>6</span>
</section>"""
    fits_b = f"""
<section class='page b-fits'>
  <p class=kicker>Neck finishes</p>
  <h2 class='serif'>Sold as complete sets</h2>
  <p class=lede>These bottles come with their parts already chosen; the parts are not sold separately.</p>
  {neck_rows(COMPLETE_SETS)}
  <p class='kicker sect'>Their own class</p>
  {neck_rows(OWN_CLASS)}
  <p class=rule-note>A shared neck is where fit starts, not a guarantee: stem length, dip-tube length and how an
  insert seats are checked bottle by bottle. Each product page lists the parts confirmed for that bottle.</p>
  <span class='folio r'>7</span>
</section>"""
    table = data["table"]
    sizes = strip(
        photos["sizes"],
        [("GBBstnBlu15BlkCapSht", "15 ml (0.5 oz)"), ("GBBstnBlu1ozBlkCapSht", "30 ml (1 oz)"), ("GBBstnBlu2ozBlkCapSht", "60 ml (2 oz)")],
        width=4.1, height=1.75, gap=0.22,
    )
    cases = " · ".join(f"{b['size']}: {b['case'][0]}" for b in table if b["case"])
    code = qr(URL + "?utm_source=print&utm_medium=booklet&utm_campaign=the-line-2026")
    family = f"""
<section class='page b-family'>
  <div class=head><p class=kicker>The families · Boston Round</p><p class='kicker mute'>{data['count']} items</p></div>
  <div class=sizes>{sizes}</div>
  <h2 class=serif>Boston Round</h2>
  <p class=lede>A round bottle with sloped shoulders and a short neck, used for essential oils, beard oil,
  facial serums and perfume oil.</p>
  <dl class=facts>
    <dt>Glass</dt><dd>Clear, amber, cobalt blue</dd>
    <dt>Neck</dt><dd><span class=mono>18-400</span> on 15 ml; <span class=mono>20-400</span> on 30 and 60 ml</dd>
    <dt>Case</dt><dd>{esc(cases)} per case</dd>
  </dl>
  {fit_chart(table, compact=True)}
  <div class=more>
    <img src='{code}' alt=''>
    <p>Droppers: black or white bulb, collar to match or shiny gold or silver; each size has its own stem
    (66, 76 or 90 mm). Roll-on caps: matte or shiny black, gold and silver. Every item number:
    <span class=mono>bestbottles.com/catalog/boston-round</span></p>
  </div>
  <span class='folio l'>10</span>
</section>"""
    css = SMALL_CSS + FIT_CSS + """
.b-cover{display:flex;flex-direction:column;align-items:center}
.b-cover .mark{height:.13in;width:auto;margin-top:.1in}
.b-cover .title{text-align:center;margin-top:.9in}
.b-cover h1{font-size:62pt;font-weight:500;line-height:.9;margin:.1in 0 .12in;letter-spacing:-.01em}
.b-cover .sub{font-size:8.4pt;color:var(--ink2);letter-spacing:.04em}
.b-cover .row{position:absolute;left:0;right:0;bottom:.3in}
.b-contents h2,.b-use h2{font-size:22pt;font-weight:500;margin:.06in 0 .12in;line-height:1}
.b-use h2.ghost{visibility:hidden}
.b-contents .lede{font-size:7.4pt;line-height:1.55;color:var(--ink2);margin-bottom:.14in}
.b-contents .sect{margin:.14in 0 .04in}
ul.toc{list-style:none}
ul.toc li{display:flex;align-items:baseline;gap:.05in;font-size:7.2pt;line-height:1.95;color:var(--ink2)}
ul.toc li i{flex:1;border-bottom:.5pt dotted #B9AE98;transform:translateY(-2pt)}
ul.toc li b{font-weight:500;font-size:6.8pt;color:var(--mute)}
ul.toc.cols{columns:2;column-gap:.22in}
ul.toc.cols li{break-inside:avoid;line-height:1.72}
.b-use .grid{display:grid;grid-template-columns:1fr 1fr;column-gap:.2in;row-gap:.07in}
.b-use .cell{border-top:.5pt solid var(--rule);padding-top:.04in}
.b-use .ph{height:1.22in;display:flex;align-items:flex-end;justify-content:center}
.b-use h3{font-size:11pt;font-weight:600;line-height:1.05;margin-top:.03in}
.b-use .for{font-size:6.4pt;line-height:1.38;color:var(--ink2);margin-top:.02in}
.b-use .fact{font-size:6.1pt;line-height:1.38;color:var(--gold);margin-top:.01in}
.b-fits h2{font-size:22pt;font-weight:500;margin:.06in 0 .07in;line-height:1}
.b-fits .lede{font-size:7.3pt;line-height:1.55;color:var(--ink2)}
.b-fits .lede .mono{color:var(--gold)}
.b-fits .sect{margin:.1in 0 .02in}
.b-fits .nrow{display:grid;grid-template-columns:.62in 1fr;gap:.08in;padding:5.2pt 0;border-bottom:.5pt solid var(--hair)}
.b-fits .nk{font-size:8.2pt;color:var(--gold);font-weight:500;padding-top:.5pt}
.b-fits .nb{font-size:7.1pt;line-height:1.42;color:var(--ink);font-weight:500}
.b-fits .nf{font-size:6.7pt;line-height:1.42;color:var(--mute);margin-top:1.6pt}
.b-fits .rule-note{font-size:6.2pt;line-height:1.45;color:var(--mute);margin-top:.12in}
.b-family .head{display:flex;justify-content:space-between}
.b-family .mute{color:var(--mute)}
.b-family .sizes{margin-top:.12in}
.b-family h2{font-size:28pt;font-weight:500;line-height:1;margin:.1in 0 .05in}
.b-family .lede{font-size:7.5pt;line-height:1.5;color:var(--ink2)}
.b-family dl.facts{display:grid;grid-template-columns:.52in 1fr;row-gap:2.5pt;font-size:6.9pt;line-height:1.4;margin:.1in 0 .04in;
  border-top:.5pt solid var(--rule);padding-top:.06in}
.b-family dt{font-weight:600;color:var(--mute);letter-spacing:.06em;text-transform:uppercase;font-size:5.8pt;padding-top:1pt}
.b-family dd{color:var(--ink2)}
.b-family table.fit.compact th,.b-family table.fit.compact td{padding:3.2pt 2pt}
.b-family table.fit.compact th.size{font-size:7.3pt}
.b-family .more{position:absolute;left:.36in;right:.36in;bottom:.5in;display:flex;gap:.12in;align-items:center}
.b-family .more img{width:.56in;height:.56in}
.b-family .more p{font-size:6.4pt;line-height:1.5;color:var(--mute)}
.b-family .more .mono{color:var(--gold)}
"""
    return css, cover + contents + use_a + use_b + fits_a + fits_b + family


# --------------------------------------------------------------------------- the catalogue spread (US Letter)

def catalogue_pages(data: dict, photos: dict, mark: str) -> tuple[str, str]:
    table = data["table"]
    hero = strip(
        photos["fitments"],
        [("GBBstnAmb1ozWhtDropperShnGlTrim", "Dropper"), ("GBBstnAmb1ozMtlRollonMattSl", "Steel roller ball"),
         ("GBBstnAmb1ozRollonMattGl", "Plastic roller ball"), ("GBBstnAmb1ozBlkCapSht", "Short screw cap")],
        width=7.2, height=2.9, gap=0.3,
    )
    glass = strip(
        photos["glass"],
        [("GBBstn2ozBlkDrprShnGlTrim", "Clear"), ("GBBstnAmb2ozBlkDropperShnGlTrim", "Amber"), ("GBBstnBlu2ozBlkDropperShnGlTrim", "Cobalt blue")],
        width=3.3, height=1.55, gap=0.25,
    )
    sizes = strip(
        photos["sizes"],
        [("GBBstnBlu15BlkCapSht", "15 ml (0.5 oz)"), ("GBBstnBlu1ozBlkCapSht", "30 ml (1 oz)"), ("GBBstnBlu2ozBlkCapSht", "60 ml (2 oz)")],
        width=3.3, height=1.45, gap=0.25,
    )
    spec = "".join(
        f"<div><p class=k>{esc(b['size'] + oz(b['size']))}</p>"
        f"<p class='v mono'>{esc(b['neck'])} neck</p><p class=s>{b['case'][0] if b['case'] else '—'} per case</p></div>"
        for b in table
    )
    left = f"""
<section class='page c-left'>
  <header><img src='{mark}' alt='Best Bottles'><span class=kicker>Glass bottles · Boston Round</span></header>
  <div class=hero>{hero}</div>
  <p class=cap>30 ml amber, shown with each fitment sold for the 20-400 neck.</p>
  <div class=titlerow>
    <div>
      <p class=kicker>The families</p>
      <h1 class=serif>Boston Round</h1>
    </div>
    <p class=body>A round bottle with sloped shoulders and a short neck, used for essential oils, beard oil,
    facial serums and perfume oil. {esc(OVERVIEW)}</p>
  </div>
  <div class=specs>{spec}</div>
  <div class=lower>
    <div>
      <p class=kicker>What fits</p>{fit_chart(table, compact=False)}
      {labelled(FINISHES, 'fin')}
      <p class='kicker gap'>Use and care</p>{labelled(CARE, 'care')}
    </div>
    <div class=rows>
      <p class=kicker>Glass</p>{glass}
      <p class='kicker gap'>Sizes</p>{sizes}
    </div>
  </div>
  <footer><span>Best Bottles · The Catalogue 2026</span><span>24</span></footer>
</section>"""
    body_rows = []
    for block in table:
        body_rows.append(
            f"<tr class=group><th colspan=5><span class=serif>{esc(block['size'] + oz(block['size']))}</span>"
            f"<span class=mono>{esc(block['neck'])} neck</span><span>{block['case'][0] if block['case'] else '—'} per case</span></th></tr>"
        )
        last = None
        for row in block["rows"]:
            fit = row["fitment"] if row["fitment"] != last else ""
            last = row["fitment"]
            cells = "".join(
                f"<td class=mono>{esc(row['skus'][g])}</td>" if g in row["skus"] else "<td class=na>—</td>" for g in GLASS_ORDER
            )
            body_rows.append(f"<tr><td class=fit>{esc(fit)}</td><td class=fin>{esc(row['finish'])}</td>{cells}</tr>")
    right = f"""
<section class='page c-right'>
  <header><span class=kicker>Line sheet</span><span class=kicker>Boston Round · {data['count']} items</span></header>
  <table class=ls>
    <thead><tr><th>Fitment</th><th>Finish</th><th>Clear</th><th>Amber</th><th>Cobalt blue</th></tr></thead>
    <tbody>{''.join(body_rows)}</tbody>
  </table>
  <footer><span>Item numbers are the website SKUs. Prices, stock and pack sizes: bestbottles.com or {PHONE}.</span><span>25</span></footer>
</section>"""
    css = FIT_CSS + LIST_CSS + """
@page{size:8.5in 11in;margin:0}
.page{width:8.5in;height:11in;padding:.5in .55in}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:.5pt solid var(--rule);padding-bottom:.08in}
header img{height:.12in;width:auto}
footer{position:absolute;left:.55in;right:.55in;bottom:.32in;display:flex;justify-content:space-between;font-size:6.6pt;color:var(--mute);letter-spacing:.04em}
.c-left .hero{margin-top:.2in}
.c-left .strip figcaption{font-size:6.8pt}
.c-left .cap{font-size:6.6pt;color:var(--mute);text-align:center;margin-top:.08in}
.c-left .titlerow{display:grid;grid-template-columns:2.7in 1fr;gap:.3in;align-items:end;margin-top:.16in;
  border-top:.75pt solid var(--ink);padding-top:.12in}
.c-left h1{font-size:50pt;font-weight:500;line-height:.92;margin-top:.04in;letter-spacing:-.01em}
.c-left .body{font-size:8.5pt;line-height:1.6;color:var(--ink2)}
.c-left .specs{display:grid;grid-template-columns:repeat(3,1fr);margin-top:.16in;border-top:.5pt solid var(--rule);border-bottom:.5pt solid var(--rule)}
.c-left .specs>div{padding:.07in 0 .07in .12in;border-left:.5pt solid var(--hair)}
.c-left .specs>div:first-child{border-left:0;padding-left:0}
.c-left .specs .k{font-family:'Cormorant',serif;font-size:15pt;font-weight:600}
.c-left .specs .v{font-size:7.6pt;color:var(--gold);margin-top:.01in}
.c-left .specs .s{font-size:7pt;color:var(--mute)}
.c-left .lower{display:grid;grid-template-columns:3.65in 1fr;gap:.3in;margin-top:.18in}
.c-left .lower .kicker{margin-bottom:.04in}
.c-left .lower .kicker.gap{margin-top:.16in}
.c-left table.fit th,.c-left table.fit td{padding:3.6pt 2pt}
.c-left table.fit th.size{font-size:8pt}
.c-left ul.fin{margin-top:.08in}
.c-left ul.fin li,.c-left ul.care li{font-size:6.9pt}
.c-right table.ls{margin-top:.12in;font-size:6.9pt}
.c-right thead th{font-size:5.9pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);text-align:left;
  padding:0 0 .05in;border-bottom:.75pt solid var(--ink)}
.c-right tr.group th{text-align:left;padding:.09in 0 .03in;border-bottom:.5pt solid var(--rule)}
.c-right tr.group span{margin-right:.16in;font-size:7pt;color:var(--mute);font-weight:400}
.c-right tr.group span.serif{font-size:13pt;font-weight:600;color:var(--ink)}
.c-right tr.group span.mono{color:var(--gold)}
.c-right td{padding:2.1pt 0;border-bottom:.5pt solid var(--hair);vertical-align:top}
.c-right td.fit{font-weight:600;width:1.12in;color:var(--ink)}
.c-right td.fin{width:1.34in;color:var(--ink2)}
.c-right td.mono{font-size:6.3pt;color:var(--ink2);letter-spacing:-.01em}
.c-right td.na{color:#B9AE98}
"""
    return css, left + right


# --------------------------------------------------------------------------- render

def render(name: str, doc: str) -> Path:
    from playwright.sync_api import sync_playwright

    BUILD.mkdir(parents=True, exist_ok=True)
    html_path = BUILD / f"{name}.html"
    html_path.write_text(doc)
    pdf_path = BUILD / f"{name}.pdf"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files"])
        page = browser.new_page()
        page.goto(html_path.as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
        browser.close()
    return pdf_path


def main() -> None:
    import pymupdf

    data = load()
    face_css = fonts()
    mark = wordmark()
    photos = {
        "insert": prepare("insert", ["GBBstnAmb15mlWhtDropperGlTrim", "GBBstnAmb1ozMtlRollonMattSl", "GBBstnAmb2ozBlkCapSht"]),
        "fitments": prepare("fitments", ["GBBstnAmb1ozWhtDropperShnGlTrim", "GBBstnAmb1ozMtlRollonMattSl", "GBBstnAmb1ozRollonMattGl", "GBBstnAmb1ozBlkCapSht"]),
        "glass": prepare("glass", ["GBBstn2ozBlkDrprShnGlTrim", "GBBstnAmb2ozBlkDropperShnGlTrim", "GBBstnBlu2ozBlkDropperShnGlTrim"], px_per_card=1100),
        "sizes": prepare("sizes", ["GBBstnBlu15BlkCapSht", "GBBstnBlu1ozBlkCapSht", "GBBstnBlu2ozBlkCapSht"], px_per_card=1100),
        "uses": prepare("uses", [u[0] for u in USES], px_per_card=1000),
        "cover": prepare("cover", ["GBCylAmb9MtlRollBlkDot", "GBElg60AnSpTslIvyGl", "GBBstnAmb1ozWhtDropperShnGlTrim", "GB15ApthBlue", "GBAtom10Gl"], px_per_card=1200),
    }
    pieces = []
    for name, (css, body) in [
        ("insert", insert_pages(data, photos, mark)),
        ("booklet", booklet_pages(data, photos, mark)),
        ("catalogue", catalogue_pages(data, photos, mark)),
    ]:
        pieces.append(render(name, page_shell(css, body, face_css)))

    out = HERE / "boston-round-proof.pdf"
    merged = pymupdf.open()
    for piece in pieces:
        merged.insert_pdf(pymupdf.open(piece))
    merged.set_metadata({"title": "Best Bottles print proof: Boston Round", "author": "Best Bottles"})
    merged.save(out, garbage=3, deflate=True)

    previews = BUILD / "previews"
    previews.mkdir(exist_ok=True)
    for i, pg in enumerate(pymupdf.open(out), 1):
        pg.get_pixmap(dpi=110).save(previews / f"page-{i:02d}.png")
    print(out, out.stat().st_size // 1024, "KB,", data["count"], "items")


if __name__ == "__main__":
    main()
