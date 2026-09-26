"""Build the Best Bottles family compatibility guides and the complete catalogue.

One run produces, from the same data and the same page designs:

- out/print/family-guides/<family-slug>.pdf   one guide per family, for the download link on /catalog/<slug>
- out/print/best-bottles-catalogue.pdf        every family in one document, with a cover, contents,
                                              "choose by use" and "what fits what" pages
- out/print/manifest.json                      family, file, pages, size, checksum, source export
- out/print/build-report.md                    counts, photo gaps and data questions per family

Sources (read-only):
- a Convex product export (default: data/register/source/convex-products-2026-09-25.json.gz)
- the component register (data/register/assemblies.csv, bodies.csv): body, neck, class and status
- approved catalogue photography (public/images/catalog/*-approved-*, the pilots, then bone-review)
- the copy rules in docs/specs/pdp-item-descriptions/ (vocabulary, uses, care lines, claims)

    pip install pillow segno playwright pymupdf
    python3 scripts/print/family_guides.py                   # every family + the complete catalogue
    python3 scripts/print/family_guides.py --family "Boston Round" --family Cylinder
    python3 scripts/print/family_guides.py --export path/to/prod-export.json.gz

Nothing here writes to Convex, Shopify or the website.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import hashlib
import html
import json
import re
import statistics
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import segno
from PIL import Image, ImageChops, ImageFilter

import neck_sheets
import operations as ops

ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "data/register"
DEFAULT_EXPORT = REGISTER / "source/convex-products-2026-09-25.json.gz"
CATALOG_IMAGES = ROOT / "public/images/catalog"
OUT = ROOT / "out/print"
WORK = OUT / "work"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BONE = (245, 243, 239)
SITE = "https://www.bestbottles.com"
SITE_LABEL = "bestbottles.com"
PHONE = "1-800-936-3628"
IMPRINT = "Best Bottles · Nemat International, Inc. · Union City, California"

BOTTLE_CATEGORIES = {"Glass Bottle", "Glass Jar", "Cream Jar", "Aluminum Bottle", "Plastic Bottle", "Metal Atomizer", "Lotion Bottle"}

# Merchandising order from src/lib/catalogFilters.ts (FAMILY_ORDER, then PRODUCT_TYPE_FAMILIES).
FAMILY_ORDER = [
    "Cylinder", "Elegant", "Circle", "Sleek", "Diva", "Empire", "Boston Round", "Slim", "Diamond", "Royal",
    "Round", "Square", "Rectangle", "Flair", "Tulip", "Bell", "Grace", "Vial", "Apothecary", "Decorative",
    "Teardrop", "Pillar", "Atomizer", "Tall Cylinder", "Cream Jar", "Aluminum Bottle", "Lotion Bottle", "Plastic Bottle",
]

# The shape half of sentence 1 (PRINT-PLAN.md §3): physical description only. Written where the
# approved photographs make the shape unambiguous; every line is a draft for Best Bottles to confirm.
# Families without a line open with their name instead.
FAMILY_SHAPES = {
    "Boston Round": "A round bottle with sloped shoulders and a short neck",
    "Cylinder": "A straight-sided round bottle",
    "Circle": "A flat round bottle that reads as a full circle from the front",
    "Round": "A near-spherical bottle on a flat base",
    "Square": "A small square bottle",
    "Rectangle": "A small rectangular bottle",
    "Teardrop": "A small teardrop-shaped bottle with a glass stopper",
    "Apothecary": "A round apothecary bottle with a ground-glass stopper",
    "Bell": "A small bottle that widens toward the base",
    "Vial": "A narrow glass tube",
    "Cream Jar": "A wide-mouth jar with a screw lid",
    "Atomizer": "A metal-shell travel atomizer around a refillable glass vial",
    "Aluminum Bottle": "A round aluminum bottle with a rounded shoulder",
}
FAMILY_USES = {  # RUBRIC.md §4.2 VIAL: samples lead for vials and drams, whatever the closure
    "Vial": ["samples", "testers", "promotional giveaways"],
}
FAMILY_PLURAL = {
    "Vial": "Vials", "Cream Jar": "Cream jars", "Atomizer": "Travel atomizers", "Aluminum Bottle": "Aluminum bottles",
    "Plastic Bottle": "Plastic bottles", "Lotion Bottle": "Lotion bottles", "Decorative": "Decorative bottles",
}

GLASS_ORDER = ["Clear", "Frosted", "Amber", "Cobalt Blue", "Green", "Swirl", "Pink", "Black", "White", "Silver", "Gold", "Red", "Lavender"]
GLASS_ALIAS = {"blue": "Cobalt Blue", "cobalt": "Cobalt Blue", "frost": "Frosted", "brown": "Amber", "natural": "Clear"}

# Customer words for parts (SYNTHESIS.md §3), in the order the fit chart shows them.
FITMENTS = [
    ("Steel roller ball", "Steel roller"),
    ("Plastic roller ball", "Plastic roller"),
    ("Fine-mist sprayer", "Fine-mist sprayer"),
    ("Lotion pump", "Lotion pump"),
    ("Treatment pump", "Treatment pump"),
    ("Vintage-style bulb sprayer", "Vintage-style bulb"),
    ("Vintage-style bulb sprayer with tassel", "Vintage-style bulb + tassel"),
    ("Dropper", "Dropper"),
    ("Orifice reducer with cap", "Reducer + cap"),
    ("Screw cap", "Screw cap"),
    ("Cap", "Cap"),
    ("Cap with glass rod", "Glass-rod cap"),
    ("Glass stopper", "Stopper"),
    ("Flip-top cap", "Flip-top cap"),
    ("Lid", "Lid"),
    ("Atomizer", "Atomizer"),
]
FIT_INDEX = {name: i for i, (name, _) in enumerate(FITMENTS)}
FIT_SHORT = dict(FITMENTS)

# Uses by fitment (RUBRIC.md §4.2 primaries), used for the family's third sentence.
USES_BY_FIT = {
    "Steel roller ball": ["perfume oil", "attar", "roll-on oil blends"],
    "Plastic roller ball": ["perfume oil", "attar", "roll-on oil blends"],
    "Fine-mist sprayer": ["spray perfume", "body mist", "room and linen spray"],
    "Lotion pump": ["body lotion", "liquid soap", "serums"],
    "Treatment pump": ["serums", "facial oils"],
    "Vintage-style bulb sprayer": ["eau de parfum and cologne kept on a dressing table"],
    "Vintage-style bulb sprayer with tassel": ["eau de parfum and cologne kept on a dressing table"],
    "Dropper": ["essential oils", "beard oil", "facial serums"],
    "Orifice reducer with cap": ["splash cologne", "aftershave", "perfume oil"],
    "Screw cap": ["beard oil", "hair oil", "essential oils"],
    "Cap with glass rod": ["perfume oil samples"],
    "Glass stopper": ["perfume oil and attar kept on a shelf"],
    "Lid": ["cream", "balm", "body butter", "solid perfume"],
    "Atomizer": ["decants of eau de parfum or cologne"],
}
# Care and carry lines, word for word from RUBRIC.md §4.2, §4.6 and SYNTHESIS.md §4.1.
CARE_BY_FIT = {
    "Steel roller ball": ("Roller ball", "Carry it capped and upright; the ball alone is not a seal."),
    "Plastic roller ball": ("Roller ball", "Carry it capped and upright; the ball alone is not a seal."),
    "Fine-mist sprayer": ("Fine-mist sprayer", "On thread necks the sprayer unscrews, so the bottle can be refilled."),
    "Lotion pump": ("Pump", "For liquids that pour; thick creams belong in a jar."),
    "Treatment pump": ("Pump", "For liquids that pour; thick creams belong in a jar."),
    "Vintage-style bulb sprayer": ("Vintage-style bulb", "Not a travel bottle."),
    "Vintage-style bulb sprayer with tassel": ("Vintage-style bulb", "Not a travel bottle."),
    "Dropper": ("Dropper", "Store it upright; undiluted essential oil softens the rubber bulb over time."),
    "Orifice reducer with cap": ("Orifice reducer", "The reducer turns a pour into a controlled splash or drip; very thick oils drip slowly."),
    "Screw cap": ("Screw cap", "With no fitment, the oil pours straight from the neck."),
    "Glass stopper": ("Glass stopper", "The stopper seats by friction and is not leak-proof, so it is not a travel bottle."),
}
GLASS_LINES = {
    "Amber": "Amber reduces the light that reaches the contents.",
    "Clear": "Clear shows the fill level.",
    "Frosted": "Frosted is a surface finish, not a light filter.",
    "Swirl": "Swirl is a spiral moulded into the glass.",
}

SHARED_NECKS = {"13-415", "15-415", "17-415", "18-400", "18-415", "20-400"}
OWN_CLASSES = {"metal-atomizer": "Atomizer", "aluminum-bottle": "Aluminum", "glass-jar": "Jar", "cream-jar": "Jar",
               "plastic-bottle": "Plastic", "glass-Ground": "Stopper"}
OZ = {118: "4", 120: "4", 227: "8", 355: "12", 454: "16"}
# Register heights that the sources contradict: printed as "—" until the register is corrected.
HEIGHT_HOLD = {
    "vial-9ml-18-400": "register says 79.4 mm; the legacy product pages give 47-50 mm with a cap (18-400 neck sheet README)",
}
BOSTON_OZ = {15: "0.5", 30: "1", 60: "2"}


def esc(text) -> str:
    return html.escape(str(text), quote=True)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# --------------------------------------------------------------------------- data


@dataclass
class Item:
    sku: str
    grace: str
    family: str
    body: str
    glass: str
    fitment: str
    finish: str
    neck: str
    case: int | None
    status: str
    ml: float


@dataclass
class Body:
    body_id: str
    ml: float
    neck: str
    shape: str
    klass: str
    height: float | None
    width: float | None
    items: list[Item] = field(default_factory=list)

    @property
    def label(self) -> str:
        return size_label(self.ml, self.items[0].family if self.items else "", self.shape, self.neck)


@dataclass
class Family:
    name: str
    bodies: dict[str, Body] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @property
    def slug(self) -> str:
        return slugify(self.name)

    @property
    def items(self) -> list[Item]:
        return [i for b in self.bodies.values() for i in b.items]

    def ordered_bodies(self) -> list[Body]:
        return sorted(self.bodies.values(), key=lambda b: (b.ml, neck_label(b.neck), b.shape))

    def glasses(self) -> list[str]:
        return glass_sorted({i.glass for i in self.items})

    def fitments(self) -> list[str]:
        return sorted({i.fitment for i in self.items}, key=lambda f: FIT_INDEX.get(f, 99))


def glass_sorted(values) -> list[str]:
    return sorted(values, key=lambda g: (GLASS_ORDER.index(g) if g in GLASS_ORDER else 50, g))


def canonical_glass(value: str | None) -> str:
    v = (value or "").strip()
    if not v:
        return "Clear"
    return GLASS_ALIAS.get(v.lower(), v.title() if v.islower() else v)


def neck_label(neck: str | None) -> str:
    if not neck:
        return "—"
    if neck == "Ground":
        return "Ground glass"
    m = re.fullmatch(r"([\d.]+)mm", neck)
    if m:
        return f"{m.group(1)} mm"
    return neck.replace("/", "-")


def size_label(ml: float, family: str, shape: str, neck: str) -> str:
    ml = 3 if ml == 3.3 else ml  # the owner's standard label for the 12 mm Cylinder (SYNTHESIS.md §2)
    text = f"{ml:g} ml"
    if family == "Boston Round" and ml in BOSTON_OZ:
        text += f" ({BOSTON_OZ[ml]} oz)"
    elif round(ml) in OZ and abs(ml - round(ml)) < 0.01:
        text += f" ({OZ[round(ml)]} oz)"
    if family == "Cylinder" and ml == 9 and neck == "13-415":
        text += " tall"
    if shape and shape.lower() not in family.lower() and shape.lower() not in ("standard",):
        text = f"{shape} {text}"
    return text


SKU_FITMENT = [  # when Convex has no applicator, the website SKU still names the part
    (r"AnSpTsl", "Vintage Bulb Sprayer with Tassel"), (r"AnSp", "Vintage Bulb Sprayer"), (r"Rdcr", "Reducer"),
    (r"Ltn", "Lotion Pump"), (r"Drp|Dropper", "Dropper"), (r"Mtl\w*Roll", "Metal Roller Ball"), (r"Roll", "Plastic Roller Ball"),
    (r"Spry|Spray", "Fine Mist Sprayer"), (r"App$", "Glass Rod"),
]


def fitment_of(row: dict, klass: str) -> str:
    app = (row.get("applicator") or "").strip()
    sku = row.get("websiteSku") or ""
    neck = row.get("neckThreadSize") or ""
    if app in ("", "None", "N/A", "Cap/Closure"):
        for pattern, value in SKU_FITMENT:
            if re.search(pattern, sku):
                app = value
                break
    if app == "Metal Roller Ball":
        return "Steel roller ball"
    if app == "Plastic Roller Ball":
        return "Plastic roller ball"
    if app in ("Fine Mist Sprayer", "Perfume Spray Pump"):
        return "Fine-mist sprayer"
    if app == "Lotion Pump":
        return "Treatment pump" if neck == "17-415" else "Lotion pump"
    if app.startswith("Vintage Bulb Sprayer"):
        return "Vintage-style bulb sprayer with tassel" if ("Tassel" in app or "Tsl" in sku) else "Vintage-style bulb sprayer"
    if app == "Dropper":
        return "Dropper"
    if app == "Reducer":
        return "Orifice reducer with cap"
    if app == "Glass Rod":
        return "Cap with glass rod"
    if app == "Glass Stopper" or klass == "glass-Ground":
        return "Glass stopper"
    if app == "Atomizer" or klass == "metal-atomizer":
        return "Atomizer"
    if klass in ("glass-jar", "cream-jar") or row.get("category") in ("Glass Jar", "Cream Jar"):
        return "Lid"
    if "Flp" in sku:
        return "Flip-top cap"
    if neck in ("Plug", "Snap-On", "PRESS-FIT"):
        return "Cap"
    return "Screw cap"


SKU_FINISH = [  # SKU tokens, used only when the Convex cap colour says nothing about the part
    ("BluMatt", "Matte blue"), ("MattBlu", "Matte blue"), ("BluMt", "Matte blue"), ("BlkMt", "Matte black"),
    ("GlMt", "Matte gold"), ("SlMt", "Matte silver"), ("CuMt", "Matte copper"), ("ClWh", "White"), ("Black", "Black"), ("White", "White"),
    ("IvyGl", "Ivory, gold collar"), ("IvySl", "Ivory, silver collar"), ("MtSl", "Matte silver"), ("MattSl", "Matte silver"),
    ("SlMatt", "Matte silver"), ("MtGl", "Matte gold"), ("MattGl", "Matte gold"), ("GlMatt", "Matte gold"),
    ("ShnGl", "Shiny gold"), ("GlSh", "Shiny gold"), ("ShnSl", "Shiny silver"), ("SlSh", "Shiny silver"),
    ("ShnBlk", "Shiny black"), ("BlkSh", "Shiny black"), ("BlkDot", "Black dotted"), ("SlDot", "Silver dotted"),
    ("PnkDot", "Pink dotted"), ("Lvn", "Lavender"), ("Pnk", "Pink"), ("Red", "Red"), ("Wht", "White"), ("Blk", "Black"),
    ("Cu", "Copper"), ("Gl", "Gold"), ("Sl", "Silver"),
]


def sentence(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:].lower() if text else text


def finish_of(row: dict, fitment: str, glass: str) -> str:
    sku = row.get("websiteSku") or ""
    raw = (row.get("capColor") or "").strip()
    style = (row.get("capStyle") or "").strip()
    neck = row.get("neckThreadSize") or ""
    low = raw.lower()

    if fitment == "Dropper" and neck in ("18-400", "20-400", "13-425"):
        bulb = "White" if "Wht" in sku else "Black"
        if re.search(r"GlTrim|ShnGl", sku):
            return f"{bulb} bulb, shiny gold collar"
        if re.search(r"SlTrim|ShnSl", sku):
            return f"{bulb} bulb, shiny silver collar"
        return f"{bulb} bulb, {bulb.lower()} collar"
    if fitment == "Dropper":
        # 18-415 droppers come with a copper, gold or silver collar (18-415 neck sheet, 23 Sep 2026)
        colour = re.sub(r"^(shiny|matte)\s+", "", low) or "standard"
        return f"{sentence(colour)} collar"
    if fitment == "Screw cap" and neck == "13-415" and re.search(r"(?<!Sh)(Blk|Wht)Sht$", sku):
        # CP13-415BlkSht / WhtSht are the short ribbed caps (13-415 cap identity review)
        return "Short ribbed " + ("black" if "Blk" in sku[-6:] else "white") + " cap"

    uninformative = not raw or low in ("clear", "frosted", "n/a") or low == glass.lower()
    if fitment == "Fine-mist sprayer" and low in ("silver", "gold", "black"):
        uninformative = True  # the SKU often says whether it is matte or shiny
    if uninformative:
        parts = re.split(r"AnSpTsl|AnSp|Spry|Rdcr|Roll(?:on)?|Ltn|Cap|Drp", sku)
        found = None
        for chunk in (parts[-1], sku):  # the part after the fitment code first, then the whole SKU
            chunk = re.sub(r"Amb|Frst|Clr|Clear|Blu(?!Matt)|Green|Grn|Swrl", "", chunk) if chunk is sku else chunk
            found = next((name for token, name in SKU_FINISH if token in chunk), None)
            if found:
                break
        if found:
            raw, low = found, found.lower()
        else:
            raw, low = ("Clear overcap" if "OvrCap" in sku or "OverCap" in sku else (raw or "Standard")), None
            low = raw.lower()

    bulb = fitment in ("Vintage-style bulb sprayer", "Vintage-style bulb sprayer with tassel")
    if bulb:
        colour = raw.split(" / ")[0].strip() if raw else "Standard"
        if colour.lower().startswith("ivory"):
            collar = "gold" if ("IvyGl" in sku or "gold" in low) else "silver" if ("IvySl" in sku or "silver" in low) else ""
            return f"Ivory, {collar} collar" if collar else "Ivory"
        return sentence(re.sub(r"^shiny\s+", "", colour.lower()))
    if "dot" in low:
        text = f"{low.split()[0]} dotted"
    elif "leather" in low:
        text = f"{low.replace('faux', '').replace('leather', '').strip()} faux-leather"
    elif " / " in raw:
        colour, collar = raw.split(" / ", 1)
        text = f"{colour}, {collar.lower()}"
    elif low.startswith("regular "):
        text = "tall " + low[len("regular "):]
    elif low.startswith("short ribbed"):
        text = low
    elif low in ("ivory gold", "ivory silver"):
        text = f"ivory, {low.split()[1]} collar"
    else:
        text = low
    capped = fitment in ("Steel roller ball", "Plastic roller ball", "Screw cap", "Orifice reducer with cap")
    if capped:
        text = {"gold": "shiny gold", "silver": "shiny silver", "copper": "matte copper"}.get(text, text)
        if fitment in ("Steel roller ball", "Plastic roller ball") and text == "black":
            text = "shiny black"  # every black roll-on cap on the neck sheets is shiny black
        text = re.sub(r"^(short|tall) (gold|silver)$", r"\1 shiny \2", text)
    elif text == "copper":
        text = "matte copper"
    if fitment in ("Screw cap",) and style in ("Short", "Tall") and not text.startswith(("short", "tall")):
        text = f"{style.lower()} {text}"
    if fitment == "Screw cap" and sku.endswith("Sht") and not text.startswith("short"):
        text = f"short {text}"
    if "Minar" in sku:
        text = f"minaret {text}"
    if fitment == "Screw cap" and neck in ("13-415", "15-415", "18-415") and "ribbed" not in text:
        # Lined caps (RUBRIC.md §4.7; SYNTHESIS.md decision D1)
        text = text + " lined" if text.startswith(("short", "tall")) or neck != "13-415" else text
    text = sentence(text)
    if fitment in ("Steel roller ball", "Plastic roller ball", "Screw cap", "Orifice reducer with cap", "Cap") and not text.endswith("cap"):
        text += " cap"
    if fitment == "Lid" and not text.endswith("lid"):
        text += " lid"
    return text


def load(export_path: Path) -> tuple[dict[str, Family], dict]:
    with gzip.open(export_path) if export_path.suffix == ".gz" else open(export_path) as fh:
        export = json.load(fh)
    rows = export["rows"] if isinstance(export, dict) else export
    meta = {k: export.get(k) for k in ("collectedAt", "deployment", "source")} if isinstance(export, dict) else {}
    assemblies = {r["graceSku"]: r for r in csv.DictReader(open(REGISTER / "assemblies.csv"))}
    bodies = {r["bodyId"]: r for r in csv.DictReader(open(REGISTER / "bodies.csv"))}
    families: dict[str, Family] = {}
    skipped = Counter()
    meta["packaging"] = [r for r in rows if r.get("category") in ("Packaging", "Accessory")]
    for row in rows:
        if row.get("category") not in BOTTLE_CATEGORIES:
            continue
        reg = assemblies.get(row.get("graceSku"))
        if not reg:
            skipped["not in register"] += 1
            continue
        if reg["status"] == "retired":
            skipped["retired"] += 1
            continue
        body_row = bodies.get(reg["bodyId"], {})
        klass = body_row.get("compatibilityClass") or reg.get("compatibilityClass") or ""
        family_name = row.get("family") or "Other"
        fam = families.setdefault(family_name, Family(family_name))
        body = fam.bodies.get(reg["bodyId"])
        if body is None:
            def num(v):
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None
            body = Body(reg["bodyId"], float(row.get("capacityMl") or body_row.get("capacityMl") or 0), reg["neck"],
                        body_row.get("shape") or "", klass,
                        None if reg["bodyId"] in HEIGHT_HOLD else num(body_row.get("heightWithoutCapMm")),
                        num(body_row.get("diameterMm")) or num(body_row.get("widthMm")))
            fam.bodies[reg["bodyId"]] = body
        glass = canonical_glass(row.get("color"))
        fitment = fitment_of(row, klass)
        body.items.append(Item(
            sku=row["websiteSku"], grace=row["graceSku"], family=family_name, body=reg["bodyId"], glass=glass,
            fitment=fitment, finish=finish_of(row, fitment, glass), neck=reg["neck"],
            case=row.get("caseQuantity"), status=reg["status"], ml=body.ml,
        ))
    meta["skipped"] = dict(skipped)
    return families, meta


# --------------------------------------------------------------------------- photographs


def photo_index(skus: set[str]) -> dict[str, Path]:
    dirs = sorted(p for p in CATALOG_IMAGES.iterdir() if p.is_dir())
    ordered = [d for d in dirs if "approved" in d.name] + [d for d in dirs if "pilot" in d.name] + [d for d in dirs if d.name == "bone-review"]
    index: dict[str, Path] = {}
    for d in ordered:
        for f in sorted(d.iterdir()):
            sku = f.name.split(".")[0]
            if sku in skus and sku not in index and f.suffix.lower() in (".png", ".webp", ".jpg"):
                index[sku] = f
    return index


def to_bone(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    corners = [img.getpixel((x, y)) for x in (4, w - 5) for y in (4, h - 5)]
    gains = [BONE[c] / max(1, statistics.median(p[c] for p in corners)) for c in range(3)]
    img = Image.merge("RGB", [b.point(lambda v, g=g: min(255, round(v * g))) for b, g in zip(img.split(), gains)])
    bone = Image.new("RGB", img.size, BONE)
    r, g, b = ImageChops.difference(img, bone).split()
    diff = ImageChops.lighter(ImageChops.lighter(r, g), b)
    alpha = diff.point(lambda v: 0 if v <= 3 else 255 if v >= 12 else round((v - 3) * 255 / 9)).filter(ImageFilter.GaussianBlur(1.2))
    return Image.composite(img, bone, alpha)


def content_box(img: Image.Image, tolerance: int = 8):
    bone = Image.new("RGB", img.size, BONE)
    r, g, b = ImageChops.difference(img, bone).split()
    diff = ImageChops.lighter(ImageChops.lighter(r, g), b)
    return diff.point(lambda v: 255 if v > tolerance else 0).getbbox() or (0, 0, img.width, img.height)


_BONED: dict[Path, Image.Image] = {}


def prepare(set_name: str, photos: dict[str, Path], px_per_card: int = 1300, pad: float = 0.025) -> dict[str, dict]:
    """Crop one row with a shared vertical crop and scale, so bottle sizes stay comparable."""
    (WORK / "images").mkdir(parents=True, exist_ok=True)
    imgs = {}
    for sku, path in photos.items():
        if path not in _BONED:
            _BONED[path] = to_bone(Image.open(path))
        imgs[sku] = _BONED[path]
    boxes = {}
    for sku, img in imgs.items():
        l, t, r, b = content_box(img)
        boxes[sku] = (l / img.width, t / img.width, r / img.width, b / img.width)
    top = max(0.0, min(bx[1] for bx in boxes.values()) - pad)
    bottom = max(bx[3] for bx in boxes.values()) + pad / 2
    out = {}
    for sku, img in imgs.items():
        l, _, r, _ = boxes[sku]
        l, r = max(0.0, l - pad), min(1.0, r + pad)
        crop = img.crop((round(l * img.width), round(top * img.width), round(r * img.width), min(img.height, round(bottom * img.width))))
        w, h = r - l, crop.height / img.width
        # Never more than twice the source pixels: small sheet thumbnails stay small files.
        px = min(px_per_card, 2 * img.width)
        crop = crop.resize((max(1, round(w * px)), max(1, round(h * px))), Image.LANCZOS)
        path = WORK / "images" / f"{set_name}-{sku}.jpg"
        crop.save(path, quality=88)
        out[sku] = {"uri": path.as_uri(), "w": w, "h": h}
    return out


def strip(prepared: dict, items: list[tuple[str, str]], width: float, height: float, gap: float = 0.18,
          raw: bool = False, cls: str = "", min_fig: float = 0.0, scale: float | None = None) -> str:
    """A row of photographs at one shared scale. `raw` captions are HTML; `min_fig` widens narrow figures
    (inches) so their captions have room, without changing the picture's size."""
    items = [(s, c) for s, c in items if s in prepared]
    if not items:
        return ""
    min_fig = min(min_fig, (width - gap * (len(items) - 1)) / len(items))
    widths = lambda sc: [max(prepared[s]["w"] * sc, min_fig) for s, _ in items]
    total = sum(prepared[s]["w"] for s, _ in items)
    tallest = max(prepared[s]["h"] for s, _ in items)
    scale = scale or min((width - gap * (len(items) - 1)) / total, height / tallest)
    while sum(widths(scale)) + gap * (len(items) - 1) > width + 1e-6 and scale > 0.01:
        scale *= 0.97
    figs = "".join(
        f"<figure style='width:{fw:.3f}in'><img style='width:{prepared[s]['w'] * scale:.3f}in' src='{prepared[s]['uri']}' alt=''>"
        + (f"<figcaption>{c if raw else esc(c)}</figcaption>" if c else "") + "</figure>"
        for (s, c), fw in zip(items, widths(scale))
    )
    return f"<div class='strip {cls}' style='gap:{gap}in'>{figs}</div>"


def pick(items: list[Item], photos: dict[str, Path], **prefer) -> Item | None:
    """The best photographed item: prefer clear glass, then the most common body, then in-list order."""
    have = [i for i in items if i.sku in photos]
    if not have:
        return None
    body_count = Counter(i.body for i in have)
    return sorted(have, key=lambda i: (
        0 if i.glass == prefer.get("glass", "Clear") else 1,
        0 if i.body == prefer.get("body") else 1,
        -body_count[i.body],
    ))[0]


# --------------------------------------------------------------------------- copy


def join(words: list[str]) -> str:
    words = [w for w in words if w]
    if len(words) <= 1:
        return "".join(words)
    return ", ".join(words[:-1]) + " and " + words[-1]


def plural_fitment(name: str) -> str:
    return {
        "Steel roller ball": "steel roller balls", "Plastic roller ball": "plastic roller balls",
        "Fine-mist sprayer": "fine-mist sprayers", "Lotion pump": "lotion pumps", "Treatment pump": "treatment pumps",
        "Vintage-style bulb sprayer": "vintage-style bulb sprayers",
        "Vintage-style bulb sprayer with tassel": "vintage-style bulb sprayers with tassel",
        "Dropper": "droppers", "Orifice reducer with cap": "orifice reducers with caps", "Screw cap": "screw caps",
        "Cap with glass rod": "caps with a glass rod", "Glass stopper": "glass stoppers", "Flip-top cap": "flip-top caps",
        "Lid": "screw lids", "Atomizer": "",
    }.get(name, name.lower())


def description(fam: Family) -> str:
    bodies = fam.ordered_bodies()
    labels = list(dict.fromkeys(b.label for b in bodies))
    sizes = join(labels) if len(labels) <= 6 else f"{len(labels)} sizes from {labels[0]} to {labels[-1]}"
    glasses = [g.lower() for g in fam.glasses()]
    glass_categories = any(b.klass.startswith("glass") for b in bodies)
    opening = FAMILY_SHAPES.get(fam.name) or f"{FAMILY_PLURAL.get(fam.name, fam.name + ' bottles')}"
    first = f"{opening}, in {sizes}" + (f", in {join(glasses)} glass" if glass_categories and glasses else "") + "."
    counts = Counter(i.fitment for i in fam.items)
    fits = [plural_fitment(f) for f in fam.fitments() if plural_fitment(f)]
    # Merge the two roller materials into one phrase.
    if "steel roller balls" in fits and "plastic roller balls" in fits:
        fits = ["steel or plastic roller balls" if f == "steel roller balls" else f for f in fits if f != "plastic roller balls"]
    if "vintage-style bulb sprayers" in fits and "vintage-style bulb sprayers with tassel" in fits:
        fits = ["vintage-style bulb sprayers, with or without tassel" if f == "vintage-style bulb sprayers" else f
                for f in fits if f != "vintage-style bulb sprayers with tassel"]
    second = f"Sold with {join(fits)}." if fits else ""
    uses = []
    for f, _ in ([("", 0)] if fam.name in FAMILY_USES else counts.most_common()):
        for u in FAMILY_USES.get(fam.name) or USES_BY_FIT.get(f, []):
            if u not in uses:
                uses.append(u)
        if len(uses) >= 5:
            break
    third = f"Used for {join(uses[:5])}." if uses else ""
    return " ".join(x for x in (first, second, third) if x)


# --------------------------------------------------------------------------- page parts


def fonts_css() -> str:
    faces = [
        f"@font-face{{font-family:'Montserrat';font-weight:100 900;src:url('{(ROOT / 'public/fonts/montserrat/montserrat-latin-wght-normal.woff2').as_uri()}') format('woff2')}}"
    ]
    fonts = WORK / "fonts"
    fonts.mkdir(parents=True, exist_ok=True)
    css_path = fonts / "plex-mono.css"
    agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36"
    if not css_path.exists():
        css_path.write_text(subprocess.run(
            ["curl", "-sSfL", "-A", agent, "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"],
            capture_output=True, text=True, check=True).stdout)
    for block in re.findall(r"/\* latin \*/\s*(@font-face\s*{[^}]+})", css_path.read_text()):
        remote = re.search(r"url\((https://[^)]+)\)", block).group(1)
        local = fonts / remote.rsplit("/", 1)[1]
        if not local.exists():
            subprocess.run(["curl", "-sSfL", "-o", str(local), remote], check=True)
        faces.append(block.replace(remote, local.as_uri()))
    return "\n".join(faces)


def wordmark_uri() -> str:
    src = Image.open(ROOT / "public/brand/best-bottles-wordmark-supplied.png").convert("RGBA")
    path = WORK / "wordmark.png"
    (WORK).mkdir(parents=True, exist_ok=True)
    src.crop(src.getbbox()).save(path)
    return path.as_uri()


def qr(url: str) -> str:
    return segno.make(url, error="m").svg_data_uri(dark="#2C2C2E", light=None, border=0, scale=4)


def lockup(mark: str, size: str = "") -> str:
    return (f"<div class='lockup {size}'><img src='{mark}' alt='Best Bottles'>"
            "<span>Fragrance &amp; Beauty Packaging</span></div>")


CSS = """
:root{--bone:#F5F3EF;--ink:#2C2C2E;--obsidian:#1D1D1F;--second:#6B6660;--muted:#9A9590;--rule:#DCD7D0;
  --sunken:#EEEAE3;--gold:#8B6F42;--gold2:#C5A065}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bone);color:var(--ink);font-family:'Montserrat',Arial,sans-serif;font-size:8.4pt;line-height:1.5;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:'tnum' 1,'lnum' 1}
.mono{font-family:'IBM Plex Mono',monospace}
img{display:block;max-width:100%}
.kicker{font-size:6.4pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--second)}
h2.k{font-size:6.6pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--second);margin:.2in 0 .06in;break-after:avoid}
.lockup{display:inline-flex;flex-direction:column;align-items:center;gap:.045in}
.lockup img{height:.15in;width:auto}
.lockup span{font-size:4.9pt;font-weight:400;letter-spacing:.32em;text-indent:.32em;text-transform:uppercase;color:var(--obsidian);white-space:nowrap}
.lockup.big img{height:.3in}.lockup.big span{font-size:9.4pt;gap:.08in}
.strip{display:flex;justify-content:center;align-items:flex-end}
.strip figure{flex:none}
.strip figcaption{font-size:6.3pt;color:var(--second);text-align:center;margin-top:.04in;white-space:nowrap}
table{border-collapse:collapse;width:100%}
.dot{display:inline-block;width:6pt;height:6pt;border-radius:50%;background:var(--ink)}
.none{display:inline-block;width:7pt;height:.6pt;background:#C9C2B6;vertical-align:middle}

/* family guide */
.fam-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:.5pt solid var(--rule);padding-bottom:.1in}
.fam-title{display:grid;grid-template-columns:2.6in 1fr;gap:.32in;align-items:end;margin-top:.16in}
.fam-title h1{font-size:30pt;font-weight:600;line-height:1;letter-spacing:-.01em;color:var(--obsidian)}
.fam-title .rule{width:.5in;height:1.2pt;background:var(--gold2);margin-top:.1in}
.fam-title p{font-size:8.6pt;line-height:1.6;color:var(--ink)}
.hero{margin:.2in 0 .04in;break-inside:avoid}
.cap{font-size:6.4pt;color:var(--second);text-align:center}
table.sizes th,table.sizes td{padding:3.4pt 6pt 3.4pt 0;border-bottom:.5pt solid var(--rule);text-align:left;vertical-align:top}
table.sizes thead th,table.fit thead th,table.ls thead tr.cols th{font-size:5.9pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--second);border-bottom:.75pt solid var(--ink)}
table.sizes td.s{font-weight:600;white-space:nowrap}
table.sizes td.n,table.fit .n{font-family:'IBM Plex Mono',monospace;font-size:7pt;white-space:nowrap}
table.sizes td.g{color:var(--second)}
table.sizes tr,table.fit tr,table.ls tr{break-inside:avoid}
table.fit th,table.fit td{padding:3.6pt 2pt;border-bottom:.5pt solid var(--rule);text-align:center;vertical-align:middle}
table.fit thead th{font-size:5.5pt;letter-spacing:.06em;line-height:1.25;vertical-align:bottom}
table.fit th.size{text-align:left;font-size:7.8pt;font-weight:600;white-space:nowrap;padding-right:8pt}
table.fit th.size .n{display:block;font-weight:400;color:var(--second);font-size:6.4pt;margin-top:1pt}
table.fit td.tag{font-size:6pt;color:var(--second);text-align:left;padding-left:6pt;white-space:nowrap}
.two{display:grid;grid-template-columns:1fr 1fr;gap:.34in;break-inside:avoid}
ul.kv{list-style:none}
ul.kv li{display:grid;grid-template-columns:1.05in 1fr;gap:.08in;font-size:7.3pt;line-height:1.45;padding:2.6pt 0;border-bottom:.5pt solid var(--rule)}
ul.kv b{font-weight:600;color:var(--obsidian)}
.rows{display:grid;grid-template-columns:1fr 1fr;gap:.34in;margin-top:.1in;break-inside:avoid}
.shared{font-size:7.1pt;line-height:1.5;color:var(--second);margin-top:.14in;break-inside:avoid}
.shared b{color:var(--ink);font-weight:600}
.ls-title{break-before:page}
table.ls{margin-bottom:.14in;font-size:7pt;table-layout:fixed}
table.ls thead tr.group th{text-align:left;padding:.08in 0 .03in;border-bottom:.5pt solid var(--rule);font-weight:400}
table.ls thead tr.group .sz{font-size:11pt;font-weight:600;color:var(--obsidian);margin-right:.14in}
table.ls thead tr.group .meta{font-size:7pt;color:var(--second);margin-right:.16in}
table.ls thead tr.group .meta.mono{color:var(--gold)}
table.ls thead tr.cols th{text-align:left;padding:.04in 0}
table.ls td{padding:2.1pt 4pt 2.1pt 0;border-bottom:.5pt solid var(--rule);vertical-align:top}
table.ls td.fit{font-weight:600;width:1.2in;color:var(--obsidian)}
table.ls td.fin{width:1.55in}
table.ls td.mono{font-size:6.2pt;letter-spacing:-.02em;overflow-wrap:anywhere}
table.ls td.na{color:#C9C2B6}
.reorder{display:flex;gap:.16in;align-items:center;border-top:.75pt solid var(--rule);padding-top:.12in;margin-top:.2in;break-inside:avoid}
.reorder img{width:.72in;height:.72in}
.reorder .r1{font-weight:600;font-size:7.8pt}
.reorder .r2{font-family:'IBM Plex Mono',monospace;color:var(--gold);margin:.02in 0;font-size:7.6pt}
.reorder .r3{color:var(--second);font-size:6.8pt}
.note{font-size:6.6pt;color:var(--second);margin-top:.05in}


/* fit systems: the neck sheet's matrix */
.fsx{--acc:#8B6F42}
.fsx-head{display:grid;grid-template-columns:auto 1fr auto;gap:.22in;align-items:end;border-bottom:1pt solid var(--acc);padding-bottom:.08in;margin-bottom:.14in}
.fsx-head h1{font-size:30pt;font-weight:600;line-height:.95;color:var(--obsidian);letter-spacing:-.01em}
.fsx-head .a{font-size:15pt;font-weight:400;letter-spacing:.06em;text-transform:uppercase;color:var(--obsidian);line-height:1.1}
.fsx-head .b{font-size:5.9pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--second);margin-top:.04in}
.fsx-head .src{font-size:6.2pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);text-align:right}
.fsx-head .src span{display:block;color:var(--second);font-weight:500;letter-spacing:.1em;margin-top:.03in}
.fsx-cards{display:flex;flex-wrap:wrap;gap:.15in .12in}
.fsx-card{position:relative;border:.6pt solid #D3CBBF;border-radius:4pt;padding:.07in .1in .06in;break-inside:avoid}
.fsx-card::after{content:'';position:absolute;left:50%;top:100%;height:.15in;border-left:.8pt solid var(--acc)}
.fsx-card h3{font-size:8.6pt;font-weight:600;color:var(--obsidian)}
.fsx-card h3 span{font-weight:500;color:var(--obsidian)}
.fsx-card p{font-size:5.9pt;color:var(--second);margin:.01in 0 .07in}
.fsx-card .strip figcaption{white-space:normal;line-height:1.2;font-size:5.6pt;color:var(--second)}
.fsx-rail{position:relative;height:.3in;margin:0 0 .15in;break-after:avoid}
.fsx-rail::before{content:'';position:absolute;left:0;right:0;top:50%;border-top:1pt solid var(--acc)}
.fsx-rail span{position:relative;display:block;width:max-content;margin:0 auto;top:50%;transform:translateY(-50%);background:var(--bone);
  border:1pt solid var(--acc);border-radius:9pt;padding:2.2pt 14pt;font-size:7.4pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
.fsx-bottles{display:flex;flex-wrap:wrap;justify-content:center;gap:.15in .1in}
.fsx-bottle{position:relative;border:.6pt solid #D3CBBF;border-radius:4pt;padding:.06in .05in .05in;
  text-align:center;break-inside:avoid;display:flex;flex-direction:column;align-items:center}
.fsx-bottle::before{content:'';position:absolute;left:50%;bottom:100%;height:.15in;border-left:.8pt solid var(--acc)}
.fsx-bottle h4{font-size:6.5pt;font-weight:600;color:var(--obsidian);line-height:1.2;min-height:2.4em;display:flex;align-items:center}
.fsx-bottle .ph{display:flex;align-items:flex-end;justify-content:center;margin:.03in 0 .04in}
.fsx-bottle span{display:block;font-size:5.6pt;line-height:1.35;color:var(--second)}
.fsx-bottle span.mono{font-family:'IBM Plex Mono',monospace;font-size:5.3pt;color:var(--ink);letter-spacing:-.02em}
.fsx-bottle span.pg{color:var(--acc);font-weight:600}
.fsx-foot{margin-top:.1in;font-size:6.6pt;line-height:1.5;color:var(--second)}
.fsx-foot b{font-size:6pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);margin-right:.12in}
.fsx-foot p+p{margin-top:.03in}
/* catalogue front matter */
.cover{page:cover;height:11in;position:relative;break-after:page;display:flex;flex-direction:column;align-items:center}
.cover .lockup{margin-top:1.1in}
.cover h1{font-size:40pt;font-weight:500;letter-spacing:-.01em;margin-top:1.1in;color:var(--obsidian)}
.cover .sub{font-size:10pt;color:var(--second);margin-top:.12in;letter-spacing:.02em}
.cover .row{position:absolute;left:.6in;right:.6in;bottom:.9in}
.cover .foot{position:absolute;bottom:.45in;font-size:7pt;color:var(--second);letter-spacing:.06em}
.front{break-after:page}
.front h1{font-size:24pt;font-weight:600;color:var(--obsidian);margin:.06in 0 .12in}
.front .lede{font-size:8.6pt;line-height:1.6;max-width:6.4in;margin-bottom:.14in}
ul.toc{list-style:none;columns:2;column-gap:.5in}
ul.toc li{display:flex;gap:.06in;align-items:baseline;font-size:8.4pt;line-height:2;break-inside:avoid}
ul.toc li i{flex:1;border-bottom:.5pt dotted #B9AE98;transform:translateY(-2.5pt)}
ul.toc li b{font-weight:500;color:var(--second)}
.uses{display:grid;grid-template-columns:repeat(4,1fr);gap:.12in .22in}
.uses .cell{border-top:.5pt solid var(--rule);padding-top:.05in;break-inside:avoid}
.uses .ph{height:1.25in;display:flex;align-items:flex-end;justify-content:center}
.uses h3{font-size:8.2pt;font-weight:600;margin-top:.05in;color:var(--obsidian)}
.uses p{font-size:6.8pt;line-height:1.4;color:var(--ink)}
.uses p.f{color:var(--second)}
table.necks td,table.necks th{padding:5pt 8pt 5pt 0;border-bottom:.5pt solid var(--rule);text-align:left;vertical-align:top}
table.necks thead th{font-size:5.9pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--second);border-bottom:.75pt solid var(--ink)}
table.necks td.n{font-family:'IBM Plex Mono',monospace;color:var(--gold);white-space:nowrap;width:.8in}
table.necks td.b{width:3.1in;font-weight:500}
.marker{font-size:2pt;color:#F5F3EF;letter-spacing:0;text-transform:none;font-weight:400}
.parts h1{font-size:20pt}
.index h1{font-size:20pt}
ul.idx{list-style:none;columns:4;column-gap:.22in;font-family:'IBM Plex Mono',monospace;font-size:5.6pt;line-height:1.5}
ul.idx li{display:flex;justify-content:space-between;gap:.06in;break-inside:avoid;border-bottom:.3pt solid #E6E1D8}
ul.idx li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
ul.idx li b{font-weight:400;color:#6B6660}
.back{page:cover;height:11in;break-before:page;position:relative}
.back .inner{position:absolute;left:0;right:0;top:3.4in;display:flex;flex-direction:column;align-items:center;gap:.3in;text-align:center}
/* parts of the book */
.strip.left{justify-content:flex-start}
.strip figure img{margin:0 auto}
.strip figcaption span{display:block;color:var(--muted);font-size:5.8pt}
.opener{page:cover;height:11in;position:relative;break-before:page;break-after:page}
.opener .o-text{position:absolute;left:.95in;right:.95in;top:1.7in}
.o-num{font-size:8pt;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--second)}
.opener h1{font-size:46pt;font-weight:500;letter-spacing:-.015em;line-height:1.04;color:var(--obsidian);margin-top:.16in}
.opener .rule{width:.6in;height:1.2pt;background:var(--gold2);margin:.24in 0 .2in}
.o-lede{font-size:10.4pt;line-height:1.62;max-width:4.9in}
.opener .o-row{position:absolute;left:.7in;right:.7in;bottom:1.05in}
ul.parts-toc{line-height:1.62}
ul.parts-toc li{line-height:1.62}
ul.parts-toc li.ph{font-weight:600;color:var(--obsidian);margin-top:.07in;break-after:avoid}
ul.parts-toc li.ph i{border:none}
ul.parts-toc li.sub span{padding-left:.2in}
ul.parts-toc li.ph em{font-style:normal;display:inline-block;width:.2in;color:var(--second);font-weight:500}
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:.12in;border-top:.75pt solid var(--ink);border-bottom:.5pt solid var(--rule);padding:.1in 0 .08in;margin:.02in 0 0}
.glance h2.k{margin:.14in 0 .04in}
.glance table.ref td,.glance table.ref th{padding:1.1pt 6pt 1.1pt 0;font-size:6.8pt}
.glance .bar{padding:0;line-height:1.36}
.glance .stats b{font-size:19pt}
.stats b{display:block;font-size:21pt;font-weight:500;color:var(--obsidian);line-height:1.1}
.stats span{font-size:5.8pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--second)}
.bars{display:grid;grid-template-columns:1fr 1fr;gap:.42in;break-inside:avoid}
.bar{display:grid;grid-template-columns:1.9in 1fr .38in;align-items:center;gap:.08in;font-size:6.8pt;padding:.6pt 0;border-bottom:.3pt solid #E6E1D8}
.bar i{display:block;height:4.5pt;background:var(--ink)}
.bar em{font-style:normal;text-align:right;color:var(--second)}
table.ref{margin-bottom:.06in}
table.ref td,table.ref th{padding:2.5pt 6pt 2.5pt 0;border-bottom:.5pt solid var(--rule);text-align:left;vertical-align:top;font-size:7.2pt}
table.ref thead th{font-size:5.8pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--second);border-bottom:.75pt solid var(--ink)}
table.ref .r{text-align:right}
table.ref td.f{font-weight:600;color:var(--obsidian)}
table.ref td.mono{font-family:'IBM Plex Mono',monospace;font-size:6.6pt}
table.ref td.x{color:var(--second)}
table.ref tr{break-inside:avoid}
table.bodies tr.first td{border-top:.75pt solid #CFC8BE}
ol.partlist{list-style:none;counter-reset:p;margin:.06in 0 .12in}
ol.partlist li{counter-increment:p;display:grid;grid-template-columns:.34in 1.6in 1fr .4in;gap:.08in;padding:.08in 0;border-bottom:.5pt solid var(--rule);align-items:baseline}
ol.partlist li::before{content:counter(p);font-size:15pt;font-weight:500;color:var(--obsidian)}
ol.partlist b{font-size:9pt;font-weight:600;color:var(--obsidian)}
ol.partlist span{font-size:7.8pt;line-height:1.5}
ol.partlist em{font-style:normal;text-align:right;color:var(--second)}
ul.kv2{list-style:none}
ul.kv2 li{display:grid;grid-template-columns:1.1in 1fr;gap:.08in;font-size:7.4pt;line-height:1.45;padding:3pt 0;border-bottom:.5pt solid var(--rule)}
ul.kv2 b{font-weight:600;color:var(--obsidian)}
table.necks td.p,table.necks th.p{text-align:right;width:.4in;color:var(--second)}
.fs-head{display:grid;grid-template-columns:2.1in 1fr;gap:.3in;align-items:end;margin:.02in 0 .12in}
.fs-head h1{font-family:'IBM Plex Mono',monospace;font-size:36pt;font-weight:500;line-height:1;color:var(--obsidian);letter-spacing:-.02em}
.fs-head .lede{margin:0}
.fs-meta{font-size:6.8pt;color:var(--second);margin-top:.05in}
ol.paths{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:.07in .26in;border-top:.75pt solid var(--ink);border-bottom:.5pt solid var(--rule);padding:.09in 0 .08in}
ol.paths li{font-size:7.2pt;line-height:1.45}
ol.paths b{display:block;font-size:5.9pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--obsidian)}
.fs-groups{display:flex;flex-wrap:wrap;gap:.18in .26in;align-items:flex-end}
.fs-group{break-inside:avoid}
.fs-group h3{font-size:7.2pt;font-weight:600;color:var(--obsidian);border-bottom:.5pt solid var(--rule);padding-bottom:.03in;margin-bottom:.07in;white-space:nowrap}
.fs-group h3 span{font-weight:400;color:var(--second);margin-left:.05in}
.fs .strip figcaption{white-space:normal;line-height:1.25;font-size:6pt}
.fs-bottles .strip{margin-bottom:.12in;break-inside:avoid}
.fs-bottles .strip figcaption{color:var(--ink);font-weight:500}
h2.fs-b{break-before:auto}
.ops .lede{max-width:6.6in}
.ops p.body{font-size:8pt;margin-bottom:.04in}
.anatomy{display:flex;gap:.05in;margin:.08in 0 .14in;flex-wrap:wrap}
.tok{display:flex;flex-direction:column;align-items:flex-start}
.tok .t{font-size:21pt;color:var(--obsidian);border-bottom:1.4pt solid var(--gold2);padding:0 .03in .04in;line-height:1.1}
.tok .t.small{font-size:13pt}
.tok .l{font-size:5.8pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--second);margin-top:.06in;padding-left:.03in}
.tok .m{font-size:7.2pt;padding-left:.03in}
.anatomy.code{margin:.06in 0 .1in}
.tokgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.16in .3in;margin-bottom:.06in}
.tokgrid table.kvt{margin-bottom:.08in}
.ops h3,.tokgrid h3{font-size:7.6pt;font-weight:600;color:var(--obsidian);margin-bottom:.04in}
table.kvt{width:100%}
table.kvt td{font-size:7pt;padding:1.7pt 6pt 1.7pt 0;border-bottom:.5pt solid var(--rule);vertical-align:top}
table.kvt td.mono{font-family:'IBM Plex Mono',monospace;color:var(--gold);white-space:nowrap;width:1%}
ol.rules{list-style:none;counter-reset:r;margin-top:.04in}
ol.rules li{counter-increment:r;display:grid;grid-template-columns:.36in 1fr;padding:.09in 0;border-bottom:.5pt solid var(--rule);break-inside:avoid;font-size:8pt;line-height:1.5}
ol.rules li::before{content:counter(r,decimal-leading-zero);font-family:'IBM Plex Mono',monospace;color:var(--second);font-size:8pt}
ol.rules b{display:block;font-size:9pt;font-weight:600;color:var(--obsidian);margin-bottom:.02in}
.check{border:.75pt solid var(--ink);padding:.16in .2in;margin-top:.24in;break-inside:avoid}
.check h3{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;margin-bottom:.06in}
.check ol{margin-left:.2in}
.check li{font-size:8.2pt;line-height:1.7}
.qa{display:grid;grid-template-columns:1fr 1fr;gap:0 .36in}
.qa div{border-top:.5pt solid var(--rule);padding:.09in 0 .11in;break-inside:avoid}
.qa h3{font-size:8.6pt}
.qa p{font-size:7.8pt;line-height:1.55}
p.formula{font-family:'IBM Plex Mono',monospace;font-size:13pt;color:var(--obsidian);padding:.1in 0;border-top:.75pt solid var(--ink);border-bottom:.5pt solid var(--rule);margin:.04in 0 .1in}
.chips{display:flex;flex-wrap:wrap;gap:.05in}
.chips span{border:.5pt solid #CFC8BE;padding:1.6pt 6pt;font-size:6.9pt;border-radius:1pt}
ol.plain,ul.plain{margin-left:.18in}
ol.plain li,ul.plain li{font-size:7.6pt;line-height:1.55;padding:1pt 0}
.flow{display:grid;grid-template-columns:repeat(3,1fr);gap:.2in .26in;margin:.08in 0 .1in}
.flow div{border-top:1pt solid var(--ink);padding-top:.07in;break-inside:avoid}
.flow span{font-size:7pt;color:var(--second)}
.flow b{display:block;font-size:9.6pt;font-weight:600;color:var(--obsidian);margin:.03in 0}
.flow p{font-size:7.6pt;line-height:1.5}
.flow i{display:block;font-style:normal;font-size:6.6pt;color:var(--gold);margin-top:.04in}
dl.gloss{columns:2;column-gap:.42in;margin-top:.06in}
dl.gloss div{break-inside:avoid;padding:.06in 0;border-bottom:.5pt solid var(--rule)}
dl.gloss dt{font-weight:600;font-size:8pt;color:var(--obsidian)}
dl.gloss dd{font-size:7.5pt;line-height:1.5}

.back img.qr{width:1.1in;height:1.1in}
.back p{font-size:9pt;color:var(--ink)}
"""


def page_css(families: list[Family], title: str) -> str:
    rules = [
        "@page{size:8.5in 11in;margin:.72in .6in .7in;background:#F5F3EF;"
        "@top-left{content:'BEST BOTTLES';font:600 6.4pt Montserrat;letter-spacing:.3em;color:#1D1D1F;vertical-align:bottom;padding-bottom:.12in}"
        f"@top-right{{content:'{title}';font:500 6.4pt Montserrat;letter-spacing:.14em;color:#6B6660;vertical-align:bottom;padding-bottom:.12in;text-transform:uppercase}}"
        f"@bottom-left{{content:'{SITE_LABEL}  ·  {PHONE}';font:400 6.4pt Montserrat;color:#6B6660;vertical-align:top;padding-top:.12in}}"
        "@bottom-right{content:counter(page) ' / ' counter(pages);font:400 6.4pt Montserrat;color:#6B6660;vertical-align:top;padding-top:.12in}}",
        "@page cover{margin:0;background:#F5F3EF;@top-left{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-right{content:none}}",
        "@page :first{@top-left{content:none}@top-right{content:none}}",
    ]
    for fam in families:
        rules.append(
            f"@page fam-{fam.slug}{{@top-right{{content:'{fam.name} · Compatibility guide';font:500 6.4pt Montserrat;"
            "letter-spacing:.14em;color:#6B6660;vertical-align:bottom;padding-bottom:.12in;text-transform:uppercase}}"
        )
        rules.append(f"@page fam-{fam.slug}:first{{@top-left{{content:none}}@top-right{{content:none}}}}")
        rules.append(f".fam-{fam.slug}{{page:fam-{fam.slug}}}")
    return "\n".join(rules)


def fit_chart(fam: Family) -> str:
    fits = fam.fitments()
    head = "".join(f"<th>{esc(FIT_SHORT.get(f, f))}</th>" for f in fits)
    rows = []
    for body in fam.ordered_bodies():
        have = {i.fitment for i in body.items}
        cells = "".join(f"<td>{'<span class=dot></span>' if f in have else '<span class=none></span>'}</td>" for f in fits)
        tag = body_tag(body)
        rows.append(f"<tr><th class=size>{esc(body.label)}<span class=n>{esc(neck_label(body.neck))}</span></th>{cells}"
                    f"<td class=tag>{esc(tag)}</td></tr>")
    return f"<table class=fit><thead><tr><th></th>{head}<th></th></tr></thead><tbody>{''.join(rows)}</tbody></table>"


def body_tag(body: Body) -> str:
    if body.body_id == "cylinder-30ml-18-415":
        return "Fixed sprayer"
    if body.klass in OWN_CLASSES:
        return "Own class"
    if body.neck not in SHARED_NECKS:
        return "Complete set"
    return ""


def sizes_table(fam: Family) -> str:
    rows = []
    for body in fam.ordered_bodies():
        cases = Counter(i.case for i in body.items if i.case)
        case = f"{cases.most_common(1)[0][0]:,}" if cases else "—"
        h = f"{body.height:g} mm ({body.height / 25.4:.2f} in)" if body.height else "—"
        w = f"{body.width:g} mm ({body.width / 25.4:.2f} in)" if body.width else "—"
        glass = ", ".join(glass_sorted({i.glass for i in body.items}))
        rows.append(f"<tr><td class=s>{esc(body.label)}</td><td class=n>{esc(neck_label(body.neck))}</td><td>{h}</td><td>{w}</td>"
                    f"<td class=g>{esc(glass)}</td><td>{len(body.items)}</td><td>{case}</td></tr>")
    return ("<table class=sizes><thead><tr><th>Size</th><th>Neck</th><th>Height, no cap</th><th>Diameter or width</th>"
            f"<th>Glass</th><th>Items</th><th>Case</th></tr></thead><tbody>{''.join(rows)}</tbody></table>")


def options_list(fam: Family) -> list[tuple[str, str]]:
    out = []
    for f in fam.fitments():
        finishes = sorted({i.finish for i in fam.items if i.fitment == f})
        if finishes and not (len(finishes) == 1 and finishes[0] in ("Standard", "Standard cap")):
            out.append((f, "; ".join(finishes)))
    return out


def care_list(fam: Family) -> list[tuple[str, str]]:
    out, seen = [], set()
    for f in fam.fitments():
        entry = CARE_BY_FIT.get(f)
        if not entry or entry in seen:
            continue
        if f == "Fine-mist sprayer" and not any(b.neck in SHARED_NECKS - {"18-400", "20-400"} and b.body_id != "cylinder-30ml-18-415"
                                                 for b in fam.bodies.values() if any(i.fitment == f for i in b.items)):
            continue
        seen.add(entry)
        out.append(entry)
    glass_lines = [GLASS_LINES[g] for g in fam.glasses() if g in GLASS_LINES]
    if glass_lines and any(b.klass.startswith("glass") for b in fam.bodies.values()):
        out.append(("Glass", " ".join(glass_lines)))
    return out


def neck_sharing(fam: Family, all_families: dict[str, Family], pages: dict[str, int] | None = None, catalogue: bool = False) -> str:
    lines = []
    for neck in sorted({b.neck for b in fam.bodies.values() if b.neck in SHARED_NECKS and b.klass.startswith("glass")}):
        others = sorted({f.name for f in all_families.values() if f.name != fam.name
                         and any(b.neck == neck and b.klass.startswith("glass") for b in f.bodies.values())},
                        key=lambda n: FAMILY_ORDER.index(n) if n in FAMILY_ORDER else 99)
        if others:
            ref = f" (fit system, page {pg(pages, 'fit-' + neck)})" if catalogue and neck in FIT_NECKS else ""
            lines.append(f"<b class=mono>{esc(neck)}</b> is shared with {esc(join(others))}{ref}.")
    if not lines:
        return ""
    return ("<p class=shared><b>Same neck, same parts.</b> " + " ".join(lines) +
            " A shared neck is where fit starts, not a guarantee: stem length, dip-tube length and how an insert seats are "
            "checked bottle by bottle, and each product page lists the parts confirmed for that bottle.</p>")


def line_sheet(fam: Family) -> str:
    tables = []
    for body in fam.ordered_bodies():
        glasses = glass_sorted({i.glass for i in body.items})
        cases = Counter(i.case for i in body.items if i.case)
        case = f"{cases.most_common(1)[0][0]:,} per case" if cases else ""
        span = 2 + (len(glasses) if len(glasses) <= 3 else 2)
        group = (f"<tr class=group><th colspan={span}><span class=sz>{esc(body.label)}</span>"
                 f"<span class='meta mono'>{esc(neck_label(body.neck))} neck</span><span class=meta>{esc(case)}</span>"
                 f"<span class=meta>{len(body.items)} items</span></th></tr>")
        items = sorted(body.items, key=lambda i: (FIT_INDEX.get(i.fitment, 99), i.finish, glasses.index(i.glass)))
        if len(glasses) <= 3:
            cells: dict[tuple, list[dict]] = defaultdict(list)
            for it in items:
                key = (it.fitment, it.finish)
                for slot in cells[key]:
                    if it.glass not in slot:
                        slot[it.glass] = it.sku
                        break
                else:
                    cells[key].append({it.glass: it.sku})
            rows, last = [], None
            for (fit, fin), slots in cells.items():
                for slot in slots:
                    tds = "".join(f"<td class=mono>{esc(slot[g])}</td>" if g in slot else "<td class=na>—</td>" for g in glasses)
                    rows.append(f"<tr><td class=fit>{esc(fit if fit != last else '')}</td><td class=fin>{esc(fin)}</td>{tds}</tr>")
                    last = fit
            cols = "".join(f"<th>{esc(g)}</th>" for g in glasses)
            head = f"<tr class=cols><th>Fitment</th><th>Finish</th>{cols}</tr>"
        else:
            rows, last = [], None
            for it in items:
                rows.append(f"<tr><td class=fit>{esc(it.fitment if it.fitment != last else '')}</td><td class=fin>{esc(it.finish)}</td>"
                            f"<td>{esc(it.glass)}</td><td class=mono>{esc(it.sku)}</td></tr>")
                last = it.fitment
            head = "<tr class=cols><th>Fitment</th><th>Finish</th><th>Glass</th><th>Item number</th></tr>"
        ncols = len(glasses) if len(glasses) <= 3 else 2
        colgroup = "<colgroup><col style='width:1.15in'><col style='width:1.6in'>" + "".join("<col>" for _ in range(ncols)) + "</colgroup>"
        tables.append(f"<table class=ls>{colgroup}<thead>{group}{head}</thead><tbody>{''.join(rows)}</tbody></table>")
    return "".join(tables)


def family_section(fam: Family, all_families: dict[str, Family], photos: dict[str, Path], mark: str, marker: bool = False,
                   pages: dict[str, int] | None = None) -> str:
    items = fam.items
    # Hero: one photograph per fitment type, preferring clear glass and the family's most photographed body.
    hero_items = []
    main_body = Counter(i.body for i in items if i.sku in photos).most_common(1)
    main_body = main_body[0][0] if main_body else None
    for f in fam.fitments():
        chosen = pick([i for i in items if i.fitment == f], photos, body=main_body)
        if chosen and len(hero_items) < 5:
            hero_items.append(chosen)
    hero_html, caption = "", ""
    if len(fam.fitments()) == 1 and len(fam.bodies) > 1:
        sized = [c for c in (pick(b.items, photos) for b in fam.ordered_bodies()) if c][:5]
        if len(sized) > 1:
            prepared = prepare(f"{fam.slug}-hero", {i.sku: photos[i.sku] for i in sized})
            hero_html = strip(prepared, [(i.sku, fam.bodies[i.body].label) for i in sized], width=7.1, height=2.2, gap=0.3)
            caption = "Sizes, shown side by side."
            hero_items = []
    if hero_items:
        prepared = prepare(f"{fam.slug}-hero", {i.sku: photos[i.sku] for i in hero_items})
        labels = [(i.sku, FIT_SHORT.get(i.fitment, i.fitment) if len(hero_items) > 1 else "") for i in hero_items]
        hero_html = strip(prepared, labels, width=7.1, height=2.6 if len(hero_items) > 1 else 2.0, gap=0.26)
        same_body = len({i.body for i in hero_items}) == 1
        if same_body and len(hero_items) > 1:
            b = fam.bodies[hero_items[0].body]
            caption = f"{b.label} {hero_items[0].glass.lower()}, shown with each fitment sold for the {neck_label(b.neck)} neck."
        elif len(hero_items) > 1:
            caption = "One bottle for each fitment sold in this family."
    # Glass and size rows.
    glass_row = size_row = ""
    glasses = fam.glasses()
    if len(glasses) > 1:
        chosen = []
        for g in glasses:
            c = pick([i for i in items if i.glass == g], photos, glass=g, body=main_body)
            if c:
                chosen.append(c)
        if len(chosen) > 1:
            prep = prepare(f"{fam.slug}-glass", {c.sku: photos[c.sku] for c in chosen}, px_per_card=1000)
            glass_row = "<h2 class=k>Glass</h2>" + strip(prep, [(c.sku, c.glass) for c in chosen], width=3.4, height=1.4, gap=0.18)
    bodies = fam.ordered_bodies()
    if len(bodies) > 1:
        chosen = []
        for b in bodies:
            c = pick(b.items, photos)
            if c:
                chosen.append(c)
        chosen = chosen[:6]
        if len(chosen) > 1:
            prep = prepare(f"{fam.slug}-sizes", {c.sku: photos[c.sku] for c in chosen}, px_per_card=1000)
            size_row = "<h2 class=k>Sizes</h2>" + strip(prep, [(c.sku, fam.bodies[c.body].label) for c in chosen], width=3.4, height=1.4, gap=0.14)
    options = options_list(fam)
    care = care_list(fam)
    kv = lambda rows: "<ul class=kv>" + "".join(f"<li><b>{esc(k)}</b><span>{esc(v)}</span></li>" for k, v in rows) + "</ul>"
    url = f"{SITE}/catalog/{fam.slug}"
    code = qr(url + f"?utm_source=print&utm_medium=family-guide&utm_campaign={fam.slug}")
    marker_html = f"<span class=marker>§FAM:{fam.slug}§</span>" if marker else ""
    return f"""
<section class='fam fam-{fam.slug}'>
  {"" if marker else f"<div class=fam-head>{lockup(mark)}<span class=kicker>Compatibility guide</span></div>"}
  <div class=fam-title>
    <div><p class=kicker>Family · {len(items)} items{marker_html}</p><h1>{esc(fam.name)}</h1><div class=rule></div></div>
    <p>{esc(description(fam))}</p>
  </div>
  {f"<div class=hero>{hero_html}</div><p class=cap>{esc(caption)}</p>" if hero_html else ""}
  <h2 class=k>Sizes</h2>{sizes_table(fam)}
  <h2 class=k>What fits each size</h2>{fit_chart(fam)}
  <p class=note>A dot means Best Bottles sells that size with that part. Item numbers for every combination are in the line sheet.</p>
  <div class=two>
    <div><h2 class=k>Finishes</h2>{kv(options)}</div>
    <div><h2 class=k>Use and care</h2>{kv(care)}</div>
  </div>
  {f"<div class=rows><div>{glass_row}</div><div>{size_row}</div></div>" if (glass_row or size_row) else ""}
  {neck_sharing(fam, all_families, pages, catalogue=marker)}
  <h2 class='k{" ls-title" if len(items) > 40 else ""}'>Line sheet · {esc(fam.name)}</h2>
  {line_sheet(fam)}
  <p class=note>Item numbers are the website SKUs; type one into the search at {SITE_LABEL}. Prices, stock and pack sizes are on the site
  and at {PHONE}. Capacities are nominal; heights are the glass without a cap.</p>
  <div class=reorder><img src='{code}' alt=''><div><p class=r1>Every {esc(fam.name)} item, with prices and stock</p>
    <p class=r2>{SITE_LABEL}/catalog/{fam.slug}</p><p class=r3>{IMPRINT}</p></div></div>
</section>"""


# --------------------------------------------------------------------------- catalogue front matter

USES = [  # the twelve bottle types (RUBRIC.md §4.2; COPY-STRATEGY.md §2.4), with the approved photo for each
    ("GBCylAmb9MtlRollBlkDot", "Roll-On Bottle", "Perfume oil, attar and oil blends diluted in a carrier.", "The ball alone is not a seal; carry it capped."),
    ("GBCylAmb9SpryMattSl", "Fine-Mist Spray Bottle", "Spray perfume, body mist, room and linen spray.", "Up to 15 ml: samples and decants."),
    ("GBDiva30SpryMtGl", "Perfume Spray Bottle", "Eau de parfum, eau de toilette and cologne.", "From 25 ml: full retail sizes."),
    ("GBElg60AnSpTslIvyGl", "Vintage-Style Bulb Spray Bottle", "Eau de parfum and cologne kept on a dressing table.", "Not a travel bottle."),
    ("GBBstnAmb1ozWhtDropperShnGlTrim", "Dropper Bottle", "Essential oils, beard oil and facial serums.", "Releases one drop at a time."),
    ("GBBstnAmb1ozBlkCapSht", "Pour Bottle", "Beard oil, hair oil, body oil and essential oils.", "No fitment; the oil pours from the neck."),
    ("GBDiva30RdcrShnGl", "Pour Bottle with Reducer", "Splash cologne, aftershave, perfume oil, beard oil.", "The reducer slows the pour to a splash or drip."),
    ("LBDiva30LtnMtGl", "Lotion Pump Bottle", "Body lotion, liquid soap, serums, body and hair oil.", "For liquids that pour; creams go in a jar."),
    ("GB15ApthBlue", "Bottle with Glass Stopper", "Perfume oil and attar kept on a shelf.", "The stopper is not leak-proof."),
    ("GBVAmb1DrmWhtCapSht", "Vials and Drams", "Samples, testers and promotional giveaways.", "Sizes up to 5 ml, plus every vial."),
    ("GBAtom10Gl", "Travel Atomizer", "Decants of eau de parfum or cologne.", "A metal shell around a refillable glass vial."),
    ("CreamJarAmb40Blkcap", "Cream Jar", "Cream, balm, body butter, salve, solid perfume.", "For products too thick to pour."),
]
NECK_ROWS = [  # what fits what (SYNTHESIS.md §1), shared parts first
    ("13-415", "Cylinder 5 ml · Tall Cylinder 9 ml · Sleek 5 and 8 ml · Tulip 5 and 6 ml · Pillar 9 ml · Bell 10 ml · Rectangle and Tall Rectangle 10 ml · Royal 13 ml · Circle, Elegant, Flair and Square 15 ml",
     "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · short ribbed cap · short lined cap · tall lined cap"),
    ("15-415", "Circle and Elegant 30 ml", "Fine-mist sprayer · lined cap"),
    ("17-415", "Cylinder 9 ml", "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · treatment pump"),
    ("18-400", "Boston Round 15 ml · 9 ml vial", "Boston Round: dropper (66 mm stem) or short screw cap. Vial: short screw cap or cap with glass rod"),
    ("18-415", "Circle 50 and 100 · Cylinder 25, 50 and 100 · Diamond 60 · Diva 30, 46 and 100 · Elegant 60 and 100 · Empire 50 and 100 · Grace 55 · Round 78 and 128 · Sleek and Slim 30, 50 and 100 ml",
     "Fine-mist sprayer · lotion pump · vintage-style bulb sprayer, with or without tassel · orifice reducer with cap · faux-leather cap · lined cap · dropper on some sizes"),
    ("20-400", "Boston Round 30 and 60 ml", "Roll-on cap over a steel or plastic roller ball · dropper (76 mm stem on 30 ml, 90 mm on 60 ml) · short screw cap"),
]
NECK_SETS = [
    ("16 mm", "Cylinder 28 and 50 ml", "Sold complete: steel or plastic roller ball with a black or white cap"),
    ("12 mm", "Cylinder 3 and 4 ml", "Sold complete: fine-mist sprayer, black or white"),
    ("13-425", "Vials, 2 to 4 ml", "Sold complete: short black or white cap; dropper on the 4 ml"),
    ("8-425", "Vials, 2 ml", "Sold complete: short or tall cap"),
    ("Plug", "Vials, 1 ml", "Sold complete: plug"),
    ("Stopper", "Apothecary, Pear, Teardrop, Rectangle 9 ml, Genie, Eternal Flame", "Own class: ground-glass stopper, matched to its bottle"),
    ("20-410", "Aluminum bottles, 65 to 500 ml", "Own class: sprayer or lotion pump as sold"),
    ("—", "Travel atomizers; cream jars", "Own class: sold complete; each lid is matched to its jar"),
]


def pg(pages: dict[str, int] | None, key: str) -> str:
    """Page number from the first pass, or a two-digit placeholder that keeps the layout stable."""
    return str(pages.get(key, "00")) if pages else "00"


def mk(key: str) -> str:
    return f"<span class=marker>§SEC:{key}§</span>"


FIT_NECKS = ["13-415", "15-415", "17-415", "18-400", "18-415", "20-400"]
OPS_PAGES = [
    ("ops-sku", "Reading an item number"), ("ops-fit", "Confirming a fit"), ("ops-questions", "Answering common questions"),
    ("ops-samples", "Samples and small sizes"), ("ops-naming", "Naming products"), ("ops-describing", "Describing products"),
    ("ops-bodies", "Every bottle, measured"), ("ops-data", "Where product information lives"), ("ops-glossary", "Glossary"),
]


def cover(order: list[Family], photos_all: dict[str, Path], mark: str) -> str:
    cover_skus = ["GBCylAmb9MtlRollBlkDot", "GBElg60AnSpTslIvyGl", "GBBstnAmb1ozWhtDropperShnGlTrim", "GB15ApthBlue", "GBAtom10Gl"]
    cover_prep = prepare("cover", {s: photos_all[s] for s in cover_skus if s in photos_all}, px_per_card=1200, pad=0.02)
    cover_row = strip(cover_prep, [(s, "") for s in cover_skus], width=7.3, height=3.0, gap=0.04)
    total = sum(len(f.items) for f in order)
    return f"""
<section class=cover>
  {lockup(mark, 'big')}
  <h1>The Catalogue</h1>
  <p class=sub>{len(order)} families · {total:,} items · fit systems, family guides and every item number</p>
  <div class=row>{cover_row}</div>
  <p class=foot>{SITE_LABEL} · {PHONE} · {dt.date.today():%B %Y}</p>
</section>"""


def contents(order: list[Family], pages: dict[str, int] | None, house: bool) -> str:
    rows = [("ph", "The range", None), ("sub", "The range at a glance", "glance"), ("sub", "How to use this book", "howto"),
            ("sub", "Choose by use", "uses"),
            ("ph", "Fit systems", "part-fit"), ("sub", "What fits what", "necks")]
    rows += [("sub", f"The {n} neck", f"fit-{n}") for n in FIT_NECKS]
    rows += [("ph", "The families", "part-families")] + [("sub", f.name, f.slug) for f in order]
    rows += [("ph", "Parts and packaging", "part-parts"), ("sub", "Parts sold separately", "parts"),
             ("sub", "Packaging and accessories", "packaging")]
    if house:
        rows += [("ph", "Working with the range", "part-ops")] + [("sub", t, k) for k, t in OPS_PAGES]
    rows += [("ph", "Index by item number", "index")]
    number = iter(range(1, 10))
    items = "".join(
        f"<li class={c}><span>{f'<em>{next(number)}</em>' if c == 'ph' and label != 'Index by item number' else ''}{esc(label)}</span>"
        f"<i></i><b>{pg(pages, key) if key else ''}</b></li>" for c, label, key in rows)
    return f"""
<section class=front>
  <p class=kicker>Contents</p><h1>In this catalogue</h1>
  <p class=lede>Every bottle is sold empty, with the fitment and cap shown. The book opens with the range as a whole, then the
  fit systems: the six shared neck finishes, with every part made for each one. Each family then has its compatibility guide,
  the same one that can be downloaded from its page at {SITE_LABEL}.{" The last part is a working reference for the team." if house else ""}</p>
  <ul class='toc parts-toc'>{items}</ul>
</section>"""


def opener(num: int, key: str, title: str, lede: str, row_html: str) -> str:
    return f"""
<section class=opener>
  <div class=o-text><p class=o-num>Part {num}{mk(key)}</p><h1>{esc(title)}</h1><div class=rule></div><p class=o-lede>{esc(lede)}</p></div>
  <div class=o-row>{row_html}</div>
</section>"""


def bar_rows(counter: Counter, labels: list[str]) -> str:
    top = max(counter.values()) if counter else 1
    return "".join(f"<div class=bar><span>{esc(l)}</span><i style='width:{counter[l] / top * 100:.1f}%'></i><em>{counter[l]:,}</em></div>"
                   for l in labels if counter.get(l))


def range_glance(order: list[Family], components: list[dict], pages: dict[str, int] | None) -> str:
    items = [i for f in order for i in f.items]
    bodies = [b for f in order for b in f.bodies.values()]
    stats = [(len(order), "Families"), (len(items), "Bottle items"), (len(bodies), "Bottle sizes"),
             (len({i.glass for i in items}), "Glass colours"), (len(SHARED_NECKS), "Shared necks"),
             (len([c for c in components if c["websiteSku"] not in PART_EXCLUDE]), "Parts sold separately")]
    by_fit = Counter(i.fitment for i in items)
    by_neck = Counter(neck_label(i.neck) if i.neck in SHARED_NECKS else "Complete sets and own class" for i in items)
    neck_labels = [n for n in FIT_NECKS] + ["Complete sets and own class"]
    rows = []
    for f in order:
        mls = sorted({b.ml for b in f.bodies.values()})
        cap = f"{size_label(mls[0], f.name, '', '').split(' (')[0]}" + (f" to {mls[-1]:g} ml" if len(mls) > 1 else "")
        cap = cap.replace(" ml to ", " to ")
        necks = sorted({neck_label(b.neck) for b in f.bodies.values() if b.neck})
        neck_text = ", ".join(necks) if len(necks) <= 3 else f"{len(necks)} neck finishes"
        rows.append(f"<tr><td class=f>{esc(f.name)}</td><td class=r>{len(f.items):,}</td><td class=r>{len(f.bodies)}</td><td>{esc(cap)}</td>"
                    f"<td class=mono>{esc(neck_text)}</td><td class=r>{len(f.glasses())}</td><td class=r>{len(f.fitments())}</td>"
                    f"<td class=r>{pg(pages, f.slug)}</td></tr>")
    return f"""
<section class='front glance'>
  <p class=kicker>The range{mk('glance')}</p><h1>The range at a glance</h1>
  <div class=stats>{''.join(f"<div><b>{n:,}</b><span>{esc(l)}</span></div>" for n, l in stats)}</div>
  <div class=bars>
    <div><h2 class=k>Items by fitment</h2>{bar_rows(by_fit, [f for f, _ in FITMENTS])}</div>
    <div><h2 class=k>Items by neck finish</h2>{bar_rows(by_neck, neck_labels)}
      <p class=note>Six shared necks carry most of the range.</p></div>
  </div>
  <h2 class=k>Families</h2>
  <table class=ref><thead><tr><th>Family</th><th class=r>Items</th><th class=r>Sizes</th><th>Capacity</th><th>Neck finishes</th>
    <th class=r>Glass</th><th class=r>Fitments</th><th class=r>Page</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
</section>"""


def how_to_use(pages: dict[str, int] | None, house: bool) -> str:
    parts = [
        ("The range", "The numbers, this page, and a guide to choosing a bottle by what goes in it.", "glance"),
        ("Fit systems", "The six shared necks. Each page shows every part made for the neck and every bottle that has it.", "part-fit"),
        ("The families", "One compatibility guide per family: sizes and measurements, what fits each size, finishes, use and "
         "care, and a line sheet with every item number.", "part-families"),
        ("Parts and packaging", "Caps, rollers, sprayers, pumps and droppers sold on their own, by neck; then gift bags, "
         "boxes and supplies.", "part-parts"),
    ]
    if house:
        parts.append(("Working with the range", "For the team: item numbers, fit rules, customer questions, naming, "
                      "every bottle measured, and where product information lives.", "part-ops"))
    guide = [
        ("Sizes", "Capacity, neck finish, height without a cap, diameter, glass colours and case quantity."),
        ("What fits each size", "A dot means Best Bottles sells that size with that part. No dot is not a promise that it fits."),
        ("Finishes", "Every finish sold for each part, in the words used on the website."),
        ("Use and care", "What each part is for, and the one thing to know before filling."),
        ("Line sheet", "Every item number, by size, fitment, finish and glass."),
        ("QR code", "Opens the family page, with prices and stock."),
    ]
    part_rows = "".join(f"<li><b>{esc(t)}</b><span>{esc(d)}</span><em>{pg(pages, k)}</em></li>" for t, d, k in parts)
    guide_rows = "".join(f"<li><b>{esc(t)}</b><span>{esc(d)}</span></li>" for t, d in guide)
    return f"""
<section class='front howto'>
  <p class=kicker>The range{mk('howto')}</p><h1>How to use this book</h1>
  <p class=lede>Find a bottle by use, by family or by item number. Find a part by its neck finish: every bottle with the same
  neck takes the same parts, and the fit system pages show them all.</p>
  <ol class=partlist>{part_rows}</ol>
  <div class=two>
    <div><h2 class=k>Reading a family guide</h2><ul class=kv2>{guide_rows}</ul></div>
    <div><h2 class=k>Conventions</h2><ul class=kv2>
      <li><b>Sizes</b><span>Millilitres first; ounces in brackets on the sizes customers name in ounces.</span></li>
      <li><b>Measurements</b><span>Glass without a cap, in millimetres and inches. Capacities are nominal.</span></li>
      <li><b>Neck finish</b><span>18-415 means 18 mm across, thread style 415. Necks outside the thread system read "16 mm".</span></li>
      <li><b>Item numbers</b><span>The website SKUs. Type one into the search at {SITE_LABEL}.</span></li>
      <li><b>Prices and stock</b><span>Not printed. They are on the website and at {PHONE}.</span></li>
    </ul></div>
  </div>
</section>"""


def uses_page(photos_all: dict[str, Path]) -> str:
    use_prep = prepare("uses", {u[0]: photos_all[u[0]] for u in USES if u[0] in photos_all}, px_per_card=900)
    scale = min(min(1.6 / use_prep[s]["w"] for s, *_ in USES if s in use_prep), 1.25 / max(use_prep[s]["h"] for s, *_ in USES if s in use_prep))

    def use_img(sku: str) -> str:
        if sku not in use_prep:
            return ""
        return f"<img style='width:{use_prep[sku]['w'] * scale:.3f}in' src='{use_prep[sku]['uri']}' alt=''>"

    cells = "".join(
        f"<div class=cell><div class=ph>{use_img(s)}</div><h3>{esc(n)}</h3><p>{esc(a)}</p><p class=f>{esc(b)}</p></div>"
        for s, n, a, b in USES)
    return f"""
<section class=front>
  <p class=kicker>Choose by use{mk('uses')}</p><h1>What each bottle is for</h1>
  <div class=uses>{cells}</div>
</section>"""


def necks_page(pages: dict[str, int] | None) -> str:
    shared = "".join(f"<tr><td class=n>{esc(n)}</td><td class=b>{esc(b)}</td><td>{esc(f)}</td><td class=p>{pg(pages, 'fit-' + n)}</td></tr>"
                     for n, b, f in NECK_ROWS)
    sets = "".join(f"<tr><td class=n>{esc(n)}</td><td class=b>{esc(b)}</td><td>{esc(f)}</td><td class=p></td></tr>" for n, b, f in NECK_SETS)
    return f"""
<section class=front>
  <p class=kicker>Neck finishes{mk('necks')}</p><h1>What fits what</h1>
  <p class=lede>Caps, rollers, sprayers, pumps and droppers screw onto the neck, so every bottle with the same neck finish shares
  the same parts. In <span class=mono>18-415</span>, 18 is the neck's diameter in millimetres and 415 is the thread style.</p>
  <table class=necks><thead><tr><th>Neck</th><th>Bottles</th><th>Parts that fit</th><th class=p>Page</th></tr></thead><tbody>{shared}</tbody></table>
  <h2 class=k>Sold as complete sets, and bottles in their own class</h2>
  <table class=necks><tbody>{sets}</tbody></table>
  <p class=note>A shared neck is where fit starts, not a guarantee: stem length, dip-tube length and how an insert seats are checked
  bottle by bottle. Each family guide shows the combinations Best Bottles sells.</p>
</section>"""


# --------------------------------------------------------------------------- fit systems (the neck sheets)

# Picture height and width allowance per part group, in inches, and the order groups are laid out in.
GROUP_SIZE = {"roll-on-cap": (.5, .52), "roller": (.5, .62), "sprayer": (.62, .46), "treatment": (.62, .5), "lotion": (.66, .46),
              "ribbed": (.42, .58), "short-lined": (.42, .54), "tall-lined": (.56, .54), "faux": (.5, .6), "lined": (.5, .5),
              "reducer": (.5, .62), "bulb": (.62, .58), "dropper": (.9, .5), "tassel": (.78, .74), "photo": (1.15, .62)}
GROUP_ORDER = list(GROUP_SIZE)


def prepare_each(set_name: str, pics: list[tuple[str, Path, float]], px_per_card: int = 900) -> dict[str, dict]:
    """Crop each sheet picture on its own, then size it by its width on the sheet (points), so parts and
    bottles keep the relative sizes the neck sheet gives them."""
    out = {}
    for key, path, pt_w in pics:
        one = prepare(f"{set_name}-{key}", {key: path}, px_per_card=px_per_card, pad=0.03)[key]
        if pt_w:
            one = {**one, "w": one["w"] * pt_w / 72, "h": one["h"] * pt_w / 72}
        out[key] = one
    return out


# What each card says under its title: the neck sheets' card notes, in customer words. (neck, key) overrides key.
CARD_NOTES = {
    "roll-on-cap": "Solid and dotted; one cap for either roller ball",
    "roller": "Plastic or steel ball; the insert is a separate part",
    "sprayer": "Screw-on spray heads, for thin liquids",
    ("18-415", "sprayer"): "Check the dip-tube length for each bottle",
    "treatment": "For lotions and serums, not spray",
    "lotion": "For liquids that pour; one with a clear overcap",
    "ribbed": "Black or white, with a white liner",
    "short-lined": "Black and five metal-look finishes",
    "tall-lined": "Gold and silver, 24 mm tall; not roll-on caps",
    "lined": "Screw caps with a liner; not roll-on caps",
    ("18-415", "lined"): "Short and tall screw caps with a liner",
    "faux": "Five faux-leather finishes",
    "reducer": "An insert under the cap; not a cap finish",
    "bulb": "Nine colours",
    "tassel": "The same nine colours, with a tassel",
    "dropper": "Copper, gold or silver collar",
}
# The rule printed at the foot of each fit system, after the neck sheets' "thread rule" lines.
THREAD_RULES = {
    "13-415": "A 13-415 neck is required. How a roller insert seats, the liner and the sprayer's tube length are still "
              "checked bottle by bottle. The tall lined caps are 24 mm; the short gold and silver lined caps are separate options.",
    "15-415": "Two lined caps and five sprayers are made for 15-415. Check a sprayer's dip-tube length before pairing it "
              "with a bottle it is not sold on.",
    "17-415": "Choose the 17-415 neck first, then one path: a roller (an insert and one of the roll-on caps), a sprayer or "
              "a treatment pump. Insert seating and tube length are confirmed for each assembly.",
    "18-400": "The 66 mm dropper is made for the 15 ml Boston Round. The 9 ml vial takes the short cap or the cap with "
              "glass rod, not a dropper.",
    "18-415": "The shared 18-415 neck marks the bottles a part can go on; the parts sold vary by bottle. The reducer is "
              "an insert under a cap. The 30 ml Cylinder pair has a fixed sprayer and takes none of the other Cylinder options.",
    "20-400": "Droppers are matched by size: a 76 mm stem for 30 ml and 90 mm for 60 ml. Every roll-on cap fits either "
              "roller ball.",
}
DATA_CARDS = [  # necks without a sheet: (title, fitments, key for its note, note)
    ("Roll-on caps", ("Steel roller ball",), "photo", "Tall caps over a steel or plastic roller ball; shown on the bottle"),
    ("Droppers", ("Dropper",), "photo", "Stem matched to the bottle; shown on the bottle"),
    ("Short screw cap", ("Screw cap",), "photo", "Shown on the bottle"),
    ("Cap with glass rod", ("Cap with glass rod",), "photo", "For the 9 ml vial"),
]


def neck_bodies(families: dict[str, Family], neck: str) -> list[tuple[Family, Body]]:
    ordered = sorted(families.values(), key=lambda f: FAMILY_ORDER.index(f.name) if f.name in FAMILY_ORDER else 99)
    return [(f, b) for f in ordered for b in f.ordered_bodies() if b.neck == neck and b.klass.startswith("glass")]


def fit_system_page(neck: str, families: dict[str, Family], photos: dict[str, Path], pages: dict[str, int] | None,
                    sheet, report: list[str]) -> str:
    """One neck as a matrix, the way the neck sheets lay it out: part cards, the finish rail, then a card for
    each bottle. A sheet printed on two pages (18-415) stays two pages."""
    fb = neck_bodies(families, neck)
    items = [i for _, b in fb for i in b.items]
    cards = []  # (sheet page, key, title, count, note, prepared, [(picture key, caption)])
    if sheet:
        for g in sorted(sheet.groups, key=lambda g: (g.page, GROUP_ORDER.index(g.key))):
            pics = [x for x in g.pictures if not x.note]  # "*" parts are seen only on assembled bottles
            prep = prepare_each(f"fs-{neck}-{g.key}", [(x.path.stem, x.path, x.pt_w) for x in pics])
            note = CARD_NOTES.get((neck, g.key)) or CARD_NOTES.get(g.key, "")
            cards.append((g.page, g.key, g.title, str(len(pics)), note, prep, [(x.path.stem, x.finish) for x in pics]))
    else:
        main = Counter(i.body for i in items if i.sku in photos).most_common(1)
        main = main[0][0] if main else None
        for title, fits, key, note in DATA_CARDS:
            cand = [i for i in items if i.fitment in fits]
            finishes = sorted({i.finish for i in cand})
            chosen = [c for c in (pick([i for i in cand if i.finish == fin], photos, glass="Amber", body=main) for fin in finishes) if c]
            if not chosen:
                continue
            if len(chosen) < len(finishes):
                note += f" ({len(chosen)} of {len(finishes)} photographed)"
            prep = prepare(f"fs-{neck}-{slugify(title)}", {c.sku: photos[c.sku] for c in chosen}, px_per_card=1000)
            cards.append((1, key, title, str(len(finishes)), note, prep, [(c.sku, c.finish) for c in chosen]))
    bottles = []  # (sheet page, picture key, path, points wide, title, detail lines, family slug)
    if sheet:
        for sb in sheet.bodies:
            fam = families.get(sb.family.replace("Tall ", "", 1)) or families.get(sb.family)
            body = next((b for b in fam.bodies.values() if b.neck == neck and abs(b.ml - sb.ml) < 0.6), None) if fam else None
            if not body:
                report.append(f"- {neck} sheet: {sb.family} {sb.ml:g} ml is not a current body; left out of the fit system page.")
                continue
            height = sb.mm or body.height
            lines = [sb.sku] if sb.sku else []
            if sb.exception:
                lines.append(sb.exception)
            elif height:
                lines.append(f"{sb.glass} · {height:g} mm" if sb.glass else f"{height:g} mm body")
            else:
                lines.append(sb.glass)
            bottles.append((sb.page, sb.path.stem, sb.path, sb.pt_w, f"{sb.family} {sb.ml:g} ml", lines, fam.slug))
        prep_b = prepare_each(f"fs-{neck}-bottles", [(k, path, pt) for _, k, path, pt, *_ in bottles], px_per_card=1000)
    else:
        for f, b in fb:
            for g in glass_sorted({i.glass for i in b.items}):
                pool = [i for i in b.items if i.glass == g]
                c = pick([i for i in pool if i.fitment == "Screw cap"], photos, glass=g) or pick(pool, photos, glass=g)
                if c:
                    bottles.append((1, c.sku, photos[c.sku], 0, f"{f.name} {b.label}", [g + (f" · {b.height:g} mm" if b.height else "")], f.slug))
        prep_b = prepare(f"fs-{neck}-bottles", {k: path for _, k, path, *_ in bottles}, px_per_card=1000) if bottles else {}
    sheet_pages = max([c[0] for c in cards] + [b[0] for b in bottles] + [1])
    most = max([sum(1 for b in bottles if b[0] == n) for n in range(1, sheet_pages + 1)] + [1])
    per_row = 8 if most > 6 else 6
    img_h = 1.0 if -(-most // per_row) <= 2 else 0.8
    card_w = (7.3 - .1 * (per_row - 1)) / per_row
    scale = min(img_h / max(prep_b[k]["h"] for _, k, *_ in bottles), (card_w - .12) / max(prep_b[k]["w"] for _, k, *_ in bottles)) if bottles else 1
    out = []
    for n in range(1, sheet_pages + 1):
        card_html = []
        for _, key, title, count, note, prep, pics in (c for c in cards if c[0] == n):
            h, w = GROUP_SIZE.get(key, (.55, .55))
            basis = len(pics) * w + .2
            row = strip(prep, [(k, esc(cap)) for k, cap in pics], width=basis - .2, height=h, gap=.06, raw=True, min_fig=.42)
            card_html.append(f"<div class=fsx-card style='flex:1 1 {basis:.2f}in'><h3>{esc(title)}<span> / {esc(count)}</span></h3>"
                             f"<p>{esc(note)}</p>{row}</div>")
        bottle_html = []
        for _, k, _, _, title, lines, slug in (b for b in bottles if b[0] == n):
            img = f"<img style='width:{prep_b[k]['w'] * scale:.3f}in' src='{prep_b[k]['uri']}' alt=''>"
            detail = "".join(f"<span class={'mono' if re.match(r'^(GB|LB)', line) else 'd'}>{esc(line)}</span>" for line in lines if line)
            bottle_html.append(f"<div class=fsx-bottle style='width:{card_w:.3f}in'><h4>{esc(title)}</h4><div class=ph style='height:{img_h:.2f}in'>{img}</div>"
                               f"{detail}<span class=pg>p. {pg(pages, slug)}</span></div>")
        first = n == 1
        count = ("Source check · 23 Sep 2026" if sheet else "From the catalogue photography") + (f" · {n:02d} / {sheet_pages:02d}" if sheet_pages > 1 else "")
        refs = f"Page numbers lead to each family guide; item numbers for every part are on page {pg(pages, 'parts')}."
        foot = (f"<p><b>Thread rule</b>{esc(THREAD_RULES[neck])} {refs}</p>" if first else f"<p>{refs}</p>")
        out.append(f"""
<section class='front fsx'>
  <div class=fsx-head><h1>{esc(neck)}</h1><div class=t><p class=a>Fit system{mk('fit-' + neck) if first else ''}</p>
    <p class=b>Parts follow the neck finish across bottle families</p></div>
    <p class=src>{esc(count)}<span>{len(fb)} bottle sizes · {len(items):,} items</span></p></div>
  <div class=fsx-cards>{''.join(card_html)}</div>
  <div class=fsx-rail><span>{esc(neck)} finish</span></div>
  <div class=fsx-bottles>{''.join(bottle_html)}</div>
  <div class=fsx-foot>{foot}</div>
</section>""")
    return "".join(out)


def fit_systems(families: dict[str, Family], photos: dict[str, Path], pages: dict[str, int] | None, sheets: dict, report: list[str]) -> str:
    return necks_page(pages) + "".join(fit_system_page(n, families, photos, pages, sheets.get(n), report) for n in FIT_NECKS)


# --------------------------------------------------------------------------- working with the range (house edition)


def ops_sku() -> str:
    anatomy = "".join(f"<div class=tok><span class='t mono'>{esc(t)}</span><span class=l>{esc(l)}</span><span class=m>{esc(m)}</span></div>"
                      for t, l, m in ops.SKU_EXAMPLE)
    tokens = dict(ops.SKU_TOKENS)
    block = lambda group: (f"<h3>{esc(group)}</h3><table class=kvt>"
                           + "".join(f"<tr><td class=mono>{esc(c)}</td><td>{esc(m)}</td></tr>" for c, m in tokens[group]) + "</table>")
    grid = "".join(f"<div>{''.join(block(g) for g in col)}</div>" for col in (("Type", "Glass", "Size"), ("Family",), ("Fitment", "Finish")))
    parts = "".join(f"<tr><td class=mono>{esc(p)}</td><td>{esc(m)}</td><td class=mono>{esc(e)}</td></tr>" for p, m, e in ops.PART_PREFIXES)
    code, fields = ops.GRACE_EXAMPLE
    code_html = "".join(f"<div class=tok><span class='t mono small'>{esc(seg)}</span><span class=l>{esc(f)}</span></div>"
                        for seg, f in zip(code.split("-", 5), fields))
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-sku')}</p><h1>Reading an item number</h1>
  <p class=lede>Every item has a website item number (its SKU), built from short codes in a fixed order: what it is, the family,
  the glass, the size, the fitment and the finish. Type the whole number into the search at {SITE_LABEL} to open the item.</p>
  <div class=anatomy>{anatomy}</div>
  <div class=tokgrid>{grid}</div>
  <h2 class=k>Parts sold separately</h2>
  <table class=ref><thead><tr><th>Starts with</th><th>Part</th><th>Example</th></tr></thead><tbody>{parts}</tbody></table>
  <h2 class=k>The structured code</h2>
  <p class=body>Part numbers carry the neck finish after the prefix, then the finish. The product records also give every item a
  structured code, with the same fields separated by hyphens. The codes grew over time, so a few differ (Sleek is both Slk and
  Sleek): read a code as a guide and confirm on the product page.</p>
  <div class='anatomy code'>{code_html}</div>
</section>"""


def ops_fit(pages: dict[str, int] | None) -> str:
    rules = "".join(f"<li><div><b>{esc(t)}</b>{esc(d)}</div></li>" for t, d in ops.FIT_RULES)
    check = "".join(f"<li>{esc(c)}</li>" for c in ops.FIT_CHECKLIST)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-fit')}</p><h1>Confirming a fit</h1>
  <p class=lede>"Which parts fit this bottle?" is the question customers ask most. The answer always starts with the neck
  finish, and ends with what Best Bottles sells on that bottle. The fit systems start on page {pg(pages, 'part-fit')}.</p>
  <ol class=rules>{rules}</ol>
  <div class=check><h3>Before promising a fit</h3><ol>{check}</ol></div>
</section>"""


def ops_questions() -> str:
    cells = "".join(f"<div><h3>{esc(q)}</h3><p>{esc(a)}</p></div>" for q, a in ops.QUESTIONS)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-questions')}</p><h1>Answering common questions</h1>
  <p class=lede>Short answers in the words the website uses. Each one follows the claims policy: no bottle is described as
  leak-proof, airtight, spill-proof or TSA-approved.</p>
  <div class=qa>{cells}</div>
</section>"""


def ops_samples(order: list[Family], pages: dict[str, int] | None) -> str:
    bands = "".join(f"<tr><td class=f>{esc(b)}</td><td>{esc(ml)}</td><td>{esc(use)}</td></tr>" for b, ml, use in ops.SIZE_BANDS)
    rows = []
    for f in order:
        for b in f.ordered_bodies():
            if b.ml <= 5 or f.name == "Vial":
                fits = [FIT_SHORT.get(x, x) for x in sorted({i.fitment for i in b.items}, key=lambda x: FIT_INDEX.get(x, 99))]
                rows.append(f"<tr><td class=f>{esc(f.name)}</td><td>{esc(b.label)}</td><td class=mono>{esc(neck_label(b.neck))}</td>"
                            f"<td>{esc(', '.join(fits))}</td><td class=r>{len(b.items)}</td><td class=r>{pg(pages, f.slug)}</td></tr>")
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-samples')}</p><h1>Samples and small sizes</h1>
  <p class=lede>Size decides what a bottle is for. At 5 ml and under, and for every vial, samples, testers and promotional
  giveaways come first.</p>
  <table class=ref><thead><tr><th>Band</th><th>Capacity</th><th>Leads with</th></tr></thead><tbody>{bands}</tbody></table>
  <h2 class=k>Every sample size in the range</h2>
  <table class=ref><thead><tr><th>Family</th><th>Size</th><th>Neck</th><th>Sold with</th><th class=r>Items</th><th class=r>Page</th></tr></thead>
  <tbody>{''.join(rows)}</tbody></table>
</section>"""


def ops_naming() -> str:
    examples = "".join(f"<tr><td class=mono>{esc(s)}</td><td>{esc(t)}</td><td>{esc(v)}</td></tr>" for s, t, v in ops.TITLE_EXAMPLES)
    nouns = "".join(f"<span>{esc(n)}</span>" for n in ops.TYPE_NOUNS)
    units = "".join(f"<tr><td class=f>{esc(a)}</td><td>{esc(b)}</td><td class=x>{esc(c)}</td></tr>" for a, b, c in ops.UNITS)
    vocab = "".join(f"<tr><td>{esc(a)}</td><td class=x>{esc(b)}</td></tr>" for a, b in ops.VOCABULARY)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-naming')}</p><h1>Naming products</h1>
  <p class=lede>One name everywhere: the website, checkout, Faire, feeds and print all use the same title, built the same way.
  Titles stay within 60 characters, Faire's limit.</p>
  <p class=formula>{esc(ops.TITLE_FORMULA)}</p>
  <table class=ref><thead><tr><th>Item number</th><th>Title</th><th>Option</th></tr></thead><tbody>{examples}</tbody></table>
  <h2 class=k>The last words of every title</h2><div class=chips>{nouns}</div>
  <h2 class=k>Units and names</h2>
  <table class=ref><thead><tr><th></th><th>Write</th><th>Never</th></tr></thead><tbody>{units}</tbody></table>
  <h2 class=k>Part names</h2>
  <table class=ref><thead><tr><th>Write</th><th>Never</th></tr></thead><tbody>{vocab}</tbody></table>
</section>"""


def ops_describing() -> str:
    fmt = "".join(f"<li>{esc(x)}</li>" for x in ops.DESCRIPTION_FORMAT)
    never = "".join(f"<tr><td class=f>{esc(a)}</td><td>{esc(b)}</td></tr>" for a, b in ops.NEVER_WORDS)
    allowed = "".join(f"<li>{esc(a)}</li>" for a in ops.ALLOWED_CLAIMS)
    check = "".join(f"<li>{esc(c)}</li>" for c in ops.PUBLISH_CHECKLIST)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-describing')}</p><h1>Describing products</h1>
  <p class=lede>Every description has the same shape, so a customer finds the same facts in the same place on every page.</p>
  <div class=two>
    <div><h2 class=k>The item description</h2><ol class=plain>{fmt}</ol></div>
    <div><h2 class=k>Claims allowed, in these words only</h2><ul class=plain>{allowed}</ul></div>
  </div>
  <h2 class=k>Words never used</h2><table class=ref><tbody>{never}</tbody></table>
  <div class=check><h3>Before publishing a product</h3><ol>{check}</ol></div>
</section>"""


def ops_bodies(order: list[Family], pages: dict[str, int] | None) -> str:
    rows = []
    for f in order:
        first = True
        for b in f.ordered_bodies():
            cases = Counter(i.case for i in b.items if i.case)
            case = f"{cases.most_common(1)[0][0]:,}" if cases else "—"
            h = f"{b.height:g} mm ({b.height / 25.4:.2f} in)" if b.height else "—"
            w = f"{b.width:g} mm ({b.width / 25.4:.2f} in)" if b.width else "—"
            rows.append(f"<tr{' class=first' if first else ''}><td class=f>{esc(f.name) if first else ''}</td><td>{esc(b.label)}</td>"
                        f"<td class=mono>{esc(neck_label(b.neck))}</td><td>{h}</td><td>{w}</td><td class=r>{case}</td>"
                        f"<td class=r>{len(b.items)}</td><td>{esc(body_tag(b))}</td><td class=r>{pg(pages, f.slug) if first else ''}</td></tr>")
            first = False
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-bodies')}</p><h1>Every bottle, measured</h1>
  <p class=lede>Every bottle size in the range, with its neck, height without a cap, diameter or width, and case quantity. Most
  items are listed at five quantity breaks: 1, 12 and 144 units, then two larger quantities set for each item, the last five
  times the one before. Prices for every break are on the product page; this book carries none.</p>
  <table class='ref bodies'><thead><tr><th>Family</th><th>Size</th><th>Neck</th><th>Height, no cap</th><th>Diameter or width</th>
    <th class=r>Case</th><th class=r>Items</th><th>Note</th><th class=r>Page</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
</section>"""


def ops_data(pages: dict[str, int] | None) -> str:
    flow = "".join(f"<div><span class=mono>{n:02d}</span><b>{esc(t)}</b><p>{esc(d)}</p><i class=mono>{esc(where)}</i></div>"
                   for n, (t, d, where) in enumerate(ops.DATA_FLOW, 1))
    steps = "".join(f"<li>{esc(s)}</li>" for s in ops.REBUILD)
    lookup = "".join(f"<tr><td class=f>{esc(q)}</td><td>{esc(a)}</td><td class=r>{pg(pages, k) if k else ''}</td></tr>"
                     for q, a, k in ops.LOOKUP)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-data')}</p><h1>Where product information lives</h1>
  <p class=lede>Every fact in this book comes from two records: the component register, which says what fits what, and the
  product records, which hold every item number. Correct a fact there and every surface follows, this book included.</p>
  <div class=flow>{flow}</div>
  <h2 class=k>Where to look it up</h2>
  <table class=ref><tbody>{lookup}</tbody></table>
  <h2 class=k>Keeping this book current</h2>
  <ol class=plain>{steps}</ol>
  <p class=note>This edition was built on {dt.date.today():%d %B %Y}.</p>
</section>"""


def ops_glossary() -> str:
    items = "".join(f"<div><dt>{esc(t)}</dt><dd>{esc(d)}</dd></div>" for t, d in ops.GLOSSARY)
    return f"""
<section class='front ops'>
  <p class=kicker>Working with the range{mk('ops-glossary')}</p><h1>Glossary</h1>
  <dl class=gloss>{items}</dl>
</section>"""


def operations_part(order: list[Family], pages: dict[str, int] | None) -> str:
    return (ops_sku() + ops_fit(pages) + ops_questions() + ops_samples(order, pages) + ops_naming() + ops_describing()
            + ops_bodies(order, pages) + ops_data(pages) + ops_glossary())


# --------------------------------------------------------------------------- parts, packaging, index

PART_NECK_ORDER = ["13-415", "15-415", "17-415", "18-400", "18-415", "20-400", "13-425", "8-425", "22-400", "24-400"]
PART_ORDER = ["Roll-on cap", "Tall roll-on cap", "Fine-mist sprayer", "Treatment pump", "Lotion pump", "Vintage-style bulb sprayer",
              "Vintage-style bulb sprayer with tassel", "Dropper", "Short ribbed cap", "Short lined cap", "Tall lined cap", "Lined cap",
              "Faux-leather cap", "Short screw cap", "Tall screw cap", "Screw cap", "Cap with glass rod"]
PART_EXCLUDE = {"Droppers1ozElg"}  # filed under 17-415 in Convex; its product page says 18-400 (17-415 remedy register)


def part_label(r: dict) -> tuple[str, str]:
    """Customer part name (SYNTHESIS.md §3) and finish for a component record."""
    sku, name, kind, neck = r["websiteSku"], (r.get("itemName") or ""), r["type"], r["neck"]
    low = name.lower()
    m = re.search(r"\b(matte?|matt|shiny)\s+(black|gold|silver|copper|red|turquoise|blue)", low)
    finish = f"{'matte' if m.group(1).startswith('mat') else 'shiny'} {m.group(2)}" if m else ""
    if re.search(r"(black|pink|silver)\s+(?:cap\s+)?with dots", low):
        finish = re.search(r"(black|pink|silver)\s+(?:cap\s+)?with dots", low).group(1) + " dotted"
    if not finish:
        tail = re.split(r"\d+-\d+|\d+mm", sku)[-1] or sku
        finish = next((n.lower() for t, n in SKU_FINISH if t in tail), (r.get("finish") or "").lower())
    if kind == "roll-on-cap" and sku.startswith(("CPRoll", "CpRoll")):
        return ("Tall roll-on cap" if "Tall" in sku else "Roll-on cap"), sentence(finish)
    if sku in ("CP13-415Gl", "CP13-415Sl"):
        return "Tall lined cap", sentence(finish or ("shiny gold" if sku.endswith("Gl") else "shiny silver"))
    if sku in ("CP13-415BlkSht", "CP13-415WhtSht"):
        return "Short ribbed cap", ("Black" if "Blk" in sku else "White") + ", white liner"
    if sku.startswith("CP15-415"):
        return "Lined cap", sentence(finish)
    if kind == "faux-leather-cap":
        colour = re.search(r"(light brown|brown|black|ivory|pink)\s+faux", low)
        return "Faux-leather cap", sentence(colour.group(1) if colour else finish)
    if kind == "cap" and neck == "18-415":
        height = "Tall" if ("Tall" in sku or "tall" in low) else "Short"
        return f"{height} lined cap", sentence(finish or (r.get("finish") or "").lower())
    if kind == "fine-mist-sprayer":
        return "Fine-mist sprayer", sentence(finish)
    if kind == "lotion-pump":
        return ("Treatment pump" if neck == "17-415" else "Lotion pump"), sentence(finish) + (", clear overcap" if "overcap" in low else "")
    if kind in ("vintage-bulb-sprayer", "tassel-bulb-sprayer"):
        colour = next((n for t, n in SKU_FINISH if t in sku.split("18-415")[-1]), None) or sentence(finish)
        colour = {"Matte silver": "Matte silver", "Gold": "Gold"}.get(colour, colour)
        return ("Vintage-style bulb sprayer with tassel" if kind.startswith("tassel") else "Vintage-style bulb sprayer"), colour
    if kind == "dropper":
        bulb = "White" if re.search(r"white rubber", low) else "Black"
        collar = re.search(r"(shiny gold|shiny silver|shiny copper) collar", low)
        stem = re.search(r"stem length is (\d+) ?mm", low)
        label = f"{bulb} bulb, " + (f"{collar.group(1)} collar" if collar else f"{bulb.lower()} collar")
        return "Dropper" + (f", {stem.group(1)} mm stem" if stem else ""), sentence(label)
    if "applicator" in low:
        return "Cap with glass rod", "Black"
    height = "Tall" if ("Tall" in sku or "tall" in low) else "Short" if ("Short" in sku or "short" in low) else ""
    return (f"{height} screw cap".strip().capitalize() if height else "Screw cap"), sentence(finish or (r.get("finish") or "").lower())


def parts_section(components: list[dict]) -> str:
    bottles = {n: b for n, b, _ in NECK_ROWS}
    blocks = []
    for neck in PART_NECK_ORDER:
        rows = [c for c in components if c["neck"] == neck and c["websiteSku"] not in PART_EXCLUDE]
        if not rows:
            continue
        labelled = sorted(((part_label(c), c["websiteSku"]) for c in rows),
                          key=lambda x: (PART_ORDER.index(x[0][0].split(",")[0]) if x[0][0].split(",")[0] in PART_ORDER else 99, x[0][0], x[0][1]))
        trs, last = [], None
        for (part, finish), sku in labelled:
            trs.append(f"<tr><td class=fit>{esc(part if part != last else '')}</td><td class=fin>{esc(finish)}</td><td class=mono>{esc(sku)}</td></tr>")
            last = part
        fits = bottles.get(neck, "")
        head = (f"<tr class=group><th colspan=3><span class=sz>{esc(neck)}</span>"
                f"<span class=meta>{esc(fits)}</span></th></tr>"
                "<tr class=cols><th>Part</th><th>Finish</th><th>Item number</th></tr>")
        blocks.append("<table class=ls><colgroup><col style='width:1.9in'><col style='width:2.2in'><col></colgroup>"
                      f"<thead>{head}</thead><tbody>{''.join(trs)}</tbody></table>")
    return f"""
<section class='front parts'>
  <p class=kicker>Parts sold separately<span class=marker>§SEC:parts§</span></p><h1>Caps, rollers, sprayers, pumps and droppers</h1>
  <p class=lede>Grouped by neck finish. Each part fits the bottles listed with its neck; stem length, dip-tube length and how an
  insert seats are checked bottle by bottle, and each family guide shows the combinations Best Bottles sells.</p>
  {''.join(blocks)}
</section>"""


def clean_packaging(name: str) -> str:
    text = re.sub(r"\*+[^*]*\*+", "", name)
    text = text.replace('\\', '"').replace('"""', '"').replace('""', '"')
    text = re.sub(r"\s*Size\s*:\s*", ", ", text)
    text = re.sub(r"Christmas green", "Green", text, flags=re.I)
    text = re.sub(r"\.\s*,", ",", text)
    text = re.sub(r"\s+", " ", text).strip().rstrip(".").strip('" ')
    return text[:1].upper() + text[1:]


def packaging_section(rows: list[dict]) -> str:
    groups = [("Gift Bag", "Gift bags"), ("Gift Box", "Gift boxes"), ("Unknown", "Gift boxes"), ("Packaging Supply", "Packaging supplies"), ("Tool", "Tools")]
    blocks = []
    for key, title in [("Gift Bag", "Gift bags"), ("Gift Box", "Gift boxes"), ("Packaging Supply", "Packaging supplies"), ("Tool", "Tools")]:
        items = [r for r in rows if (r.get("family") == key) and r.get("websiteSku")]
        if not items:
            continue
        trs = "".join(f"<tr><td>{esc(clean_packaging(r.get('itemName') or ''))}</td><td class=mono>{esc(r['websiteSku'])}</td></tr>"
                      for r in sorted(items, key=lambda r: r["websiteSku"]))
        blocks.append(f"<table class=ls><colgroup><col><col style='width:1.9in'></colgroup><thead><tr class=group><th colspan=2>"
                      f"<span class=sz>{esc(title)}</span><span class=meta>{len(items)} items</span></th></tr>"
                      f"<tr class=cols><th>Description</th><th>Item number</th></tr></thead><tbody>{trs}</tbody></table>")
    return f"""
<section class='front parts'>
  <p class=kicker>Packaging and accessories<span class=marker>§SEC:packaging§</span></p><h1>Gift bags, boxes and supplies</h1>
  {''.join(blocks)}
</section>"""


def index_section(skus: list[str], pages: dict[str, int] | None) -> str:
    items = "".join(f"<li><span>{esc(s)}</span><b>{pages.get(s, '000') if pages else '000'}</b></li>"
                    for s in sorted(skus, key=str.lower))
    return f"""
<section class='front index'>
  <p class=kicker>Index<span class=marker>§SEC:index§</span></p><h1>Every item number</h1>
  <p class=lede>{len(skus):,} item numbers, in alphabetical order, with the page each appears on.</p>
  <ul class=idx>{items}</ul>
</section>"""


def back_page(mark: str) -> str:
    return f"""
<section class=back><div class=inner>
  {lockup(mark, 'big')}
  <img class=qr src='{qr(SITE + "?utm_source=print&utm_medium=catalogue&utm_campaign=catalogue")}' alt=''>
  <p>{SITE_LABEL} · {PHONE}</p><p class=note>{IMPRINT}</p>
</div></section>"""


# --------------------------------------------------------------------------- render


class Renderer:
    def __init__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files"])

    def pdf(self, html_doc: str, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        src = WORK / (path.stem + ".html")
        src.write_text(html_doc)
        page = self.browser.new_page()
        page.goto(src.as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.pdf(path=str(path), prefer_css_page_size=True, print_background=True)
        page.close()
        return path

    def close(self):
        self.browser.close()
        self._pw.stop()


def document(body: str, families: list[Family], title: str, face_css: str) -> str:
    return ("<!doctype html><html lang='en'><head><meta charset='utf-8'>"
            f"<title>{esc(title)}</title><style>{face_css}\n{page_css(families, title)}\n{CSS}</style></head><body>{body}</body></html>")


def opener_rows(families: dict[str, Family], photos: dict[str, Path], sheets: dict) -> dict[str, str]:
    """One photograph row per part opener."""
    rows = {}
    caps = next(g for g in sheets["17-415"].groups if g.key == "roll-on-cap")
    prep = prepare("open-fit", {p.path.stem: p.path for p in caps.pictures}, px_per_card=900)
    rows["fit"] = strip(prep, [(p.path.stem, "") for p in caps.pictures], width=6.9, height=1.25, gap=.16)
    chosen = []
    for name in ("Cylinder", "Elegant", "Circle", "Diva", "Empire", "Boston Round", "Round", "Diamond"):
        c = pick(families[name].items, photos) if name in families else None
        if c:
            chosen.append(c)
    prep = prepare("open-families", {c.sku: photos[c.sku] for c in chosen}, px_per_card=1000)
    rows["families"] = strip(prep, [(c.sku, "") for c in chosen], width=7.1, height=2.7, gap=.06)
    tassels = next(g for g in sheets["18-415"].groups if g.key == "tassel")
    prep = prepare("open-parts", {p.path.stem: p.path for p in tassels.pictures}, px_per_card=900)
    rows["parts"] = strip(prep, [(p.path.stem, "") for p in tassels.pictures], width=7.1, height=1.5, gap=.1)
    heads = [x for g in sheets["17-415"].groups if g.key in ("sprayer", "treatment") for x in g.pictures]
    prep = prepare("open-ops", {x.path.stem: x.path for x in heads}, px_per_card=900)
    rows["ops"] = strip(prep, [(x.path.stem, "") for x in heads], width=6.9, height=1.4, gap=.16)
    return rows


def main() -> None:
    import pymupdf

    ap = argparse.ArgumentParser()
    ap.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    ap.add_argument("--family", action="append", help="build only these families (repeatable)")
    ap.add_argument("--no-catalogue", action="store_true")
    ap.add_argument("--no-guides", action="store_true", help="skip the per-family PDFs")
    ap.add_argument("--edition", choices=["both", "house", "web"], default="both",
                    help="house: with Working with the range (for the team); web: without it (for download)")
    args = ap.parse_args()

    families, meta = load(args.export)
    order = sorted(families.values(), key=lambda f: (FAMILY_ORDER.index(f.name) if f.name in FAMILY_ORDER else 99, f.name))
    if args.family:
        order = [f for f in order if f.name in args.family]
    photos = photo_index({i.sku for f in families.values() for i in f.items} | {u[0] for u in USES})
    face_css, mark = fonts_css(), wordmark_uri()
    renderer = Renderer()
    guides = OUT / "family-guides"
    source_meta = {k: v for k, v in meta.items() if k != "packaging"}
    manifest = {"builtAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "source": {**source_meta, "export": str(args.export.relative_to(ROOT))}, "families": []}
    report = [f"# Family guides build report\n\nBuilt {manifest['builtAt']} from `{manifest['source']['export']}` "
              f"({meta.get('deployment')}, collected {meta.get('collectedAt')}). Skipped rows: {meta.get('skipped')}.\n",
              "| Family | Items | Sizes | Fitment types | Photographed items | Pages | Shape line |", "|---|---|---|---|---|---|---|"]
    try:
        for fam in ([] if args.no_guides else order):
            html_doc = document(family_section(fam, families, photos, mark), [fam], f"{fam.name} · Compatibility guide", face_css)
            path = renderer.pdf(html_doc, guides / f"{fam.slug}.pdf")
            n = pymupdf.open(path).page_count
            data = path.read_bytes()
            manifest["families"].append({"family": fam.name, "slug": fam.slug, "file": f"family-guides/{fam.slug}.pdf", "pages": n,
                                         "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "items": len(fam.items)})
            photographed = sum(1 for i in fam.items if i.sku in photos)
            report.append(f"| {fam.name} | {len(fam.items)} | {len(fam.bodies)} | {len(fam.fitments())} | {photographed} | {n} | "
                          f"{'draft' if fam.name in FAMILY_SHAPES else '—'} |")
            print(f"{fam.name:<16} {len(fam.items):>4} items  {n:>2} pages  {len(data) // 1024:>5} KB")
        if not args.no_catalogue and not args.family:
            components = [r for r in csv.DictReader(open(REGISTER / "components.csv"))
                          if r["status"] == "current" and r["sellable"] == "True" and r["websiteSku"]]
            packaging = [r for r in meta["packaging"] if r.get("websiteSku")]
            skus = sorted({i.sku for f in order for i in f.items}
                          | {c["websiteSku"] for c in components if c["websiteSku"] not in PART_EXCLUDE}
                          | {r["websiteSku"] for r in packaging})
            sheets = {n: neck_sheets.read_sheet(n, WORK / "neck") for n in neck_sheets.SHEETS}
            rows = opener_rows(families, photos, sheets)
            fit_report: list[str] = []

            def body(starts, sku_pages, house):
                parts = [
                    cover(order, photos, mark), contents(order, starts, house),
                    range_glance(order, components, starts), how_to_use(starts, house), uses_page(photos),
                    opener(2, "part-fit", "Fit systems", "Six shared neck finishes carry most of the range. Each of the next "
                           "pages is one neck: every part made for it, and every bottle that has it.", rows["fit"]),
                    fit_systems(families, photos, starts, sheets, fit_report),
                    opener(3, "part-families", "The families", f"{len(order)} families, each with its compatibility guide: sizes "
                           "and measurements, what fits each size, the finishes, use and care, and every item number.", rows["families"]),
                    "".join(family_section(f, families, photos, mark, marker=True, pages=starts) for f in order),
                    opener(4, "part-parts", "Parts and packaging", "Caps, rollers, sprayers, pumps, droppers and vintage-style bulb "
                           "sprayers sold on their own, by neck finish; then gift bags, boxes and supplies.", rows["parts"]),
                    parts_section(components), packaging_section(packaging),
                ]
                if house:
                    parts += [opener(5, "part-ops", "Working with the range", "A reference for the Best Bottles team: item numbers, "
                                     "confirming a fit, answering customers, naming products, every bottle measured, and where "
                                     "product information lives.", rows["ops"]),
                              operations_part(order, starts)]
                parts += [index_section(skus, sku_pages), back_page(mark)]
                return "".join(parts)

            title = "The Catalogue"
            editions = {"house": ("best-bottles-catalogue.pdf", True), "web": ("best-bottles-catalogue-web.pdf", False)}
            for edition in (["house", "web"] if args.edition == "both" else [args.edition]):
                filename, house = editions[edition]
                path = renderer.pdf(document(body(None, None, house), order, title, face_css), OUT / filename)
                doc = pymupdf.open(path)
                starts, sku_pages, wanted = {}, {}, set(skus)
                index_page = None
                for pno in range(doc.page_count):
                    text = doc[pno].get_text()
                    for m in re.findall(r"§(?:FAM|SEC):([a-z0-9-]+)§", text):
                        starts.setdefault(m, pno + 1)
                    if "§SEC:index§" in text:
                        index_page = pno
                    if index_page is None:
                        for w in doc[pno].get_text("words"):
                            if w[4] in wanted:
                                sku_pages.setdefault(w[4], pno + 1)
                for sku in sorted(set(skus) - set(sku_pages), key=len, reverse=True):
                    for pno in range(index_page if index_page is not None else doc.page_count):
                        if sku in re.sub(r"\s+", "", doc[pno].get_text()):
                            sku_pages[sku] = pno + 1
                            break
                path = renderer.pdf(document(body(starts, sku_pages, house), order, title, face_css), OUT / filename)
                check = pymupdf.open(path)
                moved = [k for k, v in starts.items() if not any(f"§{t}:{k}§" in check[v - 1].get_text() for t in ("FAM", "SEC"))
                         ] if check.page_count >= max(starts.values()) else list(starts)
                if moved:
                    report.append(f"\n{edition} edition: page references moved in the second pass for {', '.join(moved)}; rebuild to settle.")
                missing = sorted(set(skus) - set(sku_pages))
                if missing and edition == "house":
                    report.append(f"\nItem numbers the index could not place ({len(missing)}): {', '.join(missing[:40])}")
                data = path.read_bytes()
                pages = check.page_count
                entry = {"file": filename, "pages": pages, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                # The web edition is the one published for download; the house edition includes the team reference.
                manifest["catalogue" if edition == "web" else "houseEdition"] = entry
                print(f"catalogue ({edition}): {pages} pages, {len(data) // 1024} KB")
            if fit_report:
                report.append("\nFit system pages:\n" + "\n".join(dict.fromkeys(fit_report)))
    finally:
        renderer.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    report.append("\nHeights held back (printed as a dash): " + "; ".join(f"`{k}`: {v}" for k, v in HEIGHT_HOLD.items()))
    report.append("\nShape lines marked *draft* are hand-written physical descriptions awaiting Best Bottles' review; the others open with the family name.")
    (OUT / "build-report.md").write_text("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
