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
    ("Vintage bulb sprayer", "Bulb sprayer"),
    ("Bulb sprayer with tassel", "Bulb + tassel"),
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
    "Vintage bulb sprayer": ["eau de parfum and cologne kept on a dressing table"],
    "Bulb sprayer with tassel": ["eau de parfum and cologne kept on a dressing table"],
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
    "Vintage bulb sprayer": ("Bulb sprayer", "Not a travel bottle."),
    "Bulb sprayer with tassel": ("Bulb sprayer", "Not a travel bottle."),
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
        return "Bulb sprayer with tassel" if ("Tassel" in app or "Tsl" in sku) else "Vintage bulb sprayer"
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

    bulb = fitment in ("Vintage bulb sprayer", "Bulb sprayer with tassel")
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
                        body_row.get("shape") or "", klass, num(body_row.get("heightWithoutCapMm")),
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
        crop = crop.resize((max(1, round(w * px_per_card)), max(1, round(h * px_per_card))), Image.LANCZOS)
        path = WORK / "images" / f"{set_name}-{sku}.jpg"
        crop.save(path, quality=88)
        out[sku] = {"uri": path.as_uri(), "w": w, "h": h}
    return out


def strip(prepared: dict, items: list[tuple[str, str]], width: float, height: float, gap: float = 0.18) -> str:
    items = [(s, c) for s, c in items if s in prepared]
    if not items:
        return ""
    total = sum(prepared[s]["w"] for s, _ in items)
    tallest = max(prepared[s]["h"] for s, _ in items)
    scale = min((width - gap * (len(items) - 1)) / total, height / tallest)
    figs = "".join(
        f"<figure style='width:{prepared[s]['w'] * scale:.3f}in'><img src='{prepared[s]['uri']}' alt=''>"
        + (f"<figcaption>{esc(c)}</figcaption>" if c else "") + "</figure>"
        for s, c in items
    )
    return f"<div class=strip style='gap:{gap}in'>{figs}</div>"


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
        "Vintage bulb sprayer": "vintage bulb sprayers", "Bulb sprayer with tassel": "bulb sprayers with tassels",
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
    if "vintage bulb sprayers" in fits and "bulb sprayers with tassels" in fits:
        fits = ["vintage bulb sprayers, with or without tassel" if f == "vintage bulb sprayers" else f for f in fits if f != "bulb sprayers with tassels"]
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
.back{page:cover;height:11in;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3in;text-align:center}
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


def neck_sharing(fam: Family, all_families: dict[str, Family]) -> str:
    lines = []
    for neck in sorted({b.neck for b in fam.bodies.values() if b.neck in SHARED_NECKS and b.klass.startswith("glass")}):
        others = sorted({f.name for f in all_families.values() if f.name != fam.name
                         and any(b.neck == neck and b.klass.startswith("glass") for b in f.bodies.values())},
                        key=lambda n: FAMILY_ORDER.index(n) if n in FAMILY_ORDER else 99)
        if others:
            lines.append(f"<b class=mono>{esc(neck)}</b> is shared with {esc(join(others))}.")
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


def family_section(fam: Family, all_families: dict[str, Family], photos: dict[str, Path], mark: str, marker: bool = False) -> str:
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
  {neck_sharing(fam, all_families)}
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
NECK_ROWS = [  # what fits what (SYNTHESIS.md §1), shared parts first
    ("13-415", "Cylinder 5 ml · Tall Cylinder 9 ml · Sleek 5 and 8 ml · Tulip 5 and 6 ml · Pillar 9 ml · Bell 10 ml · Rectangle and Tall Rectangle 10 ml · Royal 13 ml · Circle, Elegant, Flair and Square 15 ml",
     "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · short ribbed cap · short lined cap · tall lined cap"),
    ("15-415", "Circle and Elegant 30 ml", "Fine-mist sprayer · lined cap"),
    ("17-415", "Cylinder 9 ml", "Roll-on cap over a steel or plastic roller ball · fine-mist sprayer · treatment pump"),
    ("18-400", "Boston Round 15 ml · 9 ml vial", "Boston Round: dropper (66 mm stem) or short screw cap. Vial: short screw cap or cap with glass rod"),
    ("18-415", "Circle 50 and 100 · Cylinder 25, 50 and 100 · Diamond 60 · Diva 30, 46 and 100 · Elegant 60 and 100 · Empire 50 and 100 · Grace 55 · Round 78 and 128 · Sleek and Slim 30, 50 and 100 ml",
     "Fine-mist sprayer · lotion pump · vintage bulb sprayer, with or without tassel · orifice reducer with cap · faux-leather cap · lined cap · dropper on some sizes"),
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


def front_matter(order: list[Family], pages: dict[str, int] | None, photos_all: dict[str, Path], mark: str) -> str:
    cover_skus = ["GBCylAmb9MtlRollBlkDot", "GBElg60AnSpTslIvyGl", "GBBstnAmb1ozWhtDropperShnGlTrim", "GB15ApthBlue", "GBAtom10Gl"]
    cover_prep = prepare("cover", {s: photos_all[s] for s in cover_skus if s in photos_all}, px_per_card=1200, pad=0.02)
    cover_row = strip(cover_prep, [(s, "") for s in cover_skus], width=7.3, height=3.0, gap=0.04)
    total = sum(len(f.items) for f in order)
    cover = f"""
<section class=cover>
  {lockup(mark, 'big')}
  <h1>The Catalogue</h1>
  <p class=sub>{len(order)} families · {total:,} items · every fitment and every item number</p>
  <div class=row>{cover_row}</div>
  <p class=foot>{SITE_LABEL} · {PHONE} · {dt.date.today():%B %Y}</p>
</section>"""
    toc_rows = "".join(
        f"<li><span>{esc(f.name)}</span><i></i><b>{pages.get(f.slug, '00') if pages else '00'}</b></li>" for f in order)
    toc_rows += "".join(
        f"<li><span>{esc(label)}</span><i></i><b>{pages.get(key, '00') if pages else '00'}</b></li>"
        for key, label in (("parts", "Parts sold separately"), ("packaging", "Packaging and accessories"), ("index", "Index by item number")))
    contents = f"""
<section class=front>
  <p class=kicker>Contents</p><h1>In this catalogue</h1>
  <p class=lede>Every bottle is sold empty, with the fitment and cap shown. Each family has a compatibility guide: its sizes and
  measurements, what fits each size, the finishes, use and care, and a line sheet with every item number. The same guide can
  be downloaded from each family page at {SITE_LABEL}.</p>
  <ul class=toc><li><span>Choose by use</span><i></i><b>3</b></li><li><span>What fits what, by neck finish</span><i></i><b>4</b></li>{toc_rows}</ul>
</section>"""
    use_prep = prepare("uses", {u[0]: photos_all[u[0]] for u in USES if u[0] in photos_all}, px_per_card=900)
    scale = min(min(1.6 / use_prep[s]["w"] for s, *_ in USES if s in use_prep), 1.25 / max(use_prep[s]["h"] for s, *_ in USES if s in use_prep))
    def use_img(sku: str) -> str:
        if sku not in use_prep:
            return ""
        return f"<img style='width:{use_prep[sku]['w'] * scale:.3f}in' src='{use_prep[sku]['uri']}' alt=''>"

    cells = "".join(
        f"<div class=cell><div class=ph>{use_img(s)}</div><h3>{esc(n)}</h3><p>{esc(a)}</p><p class=f>{esc(b)}</p></div>"
        for s, n, a, b in USES)
    uses = f"""
<section class=front>
  <p class=kicker>Choose by use</p><h1>What each bottle is for</h1>
  <div class=uses>{cells}</div>
</section>"""
    shared = "".join(f"<tr><td class=n>{esc(n)}</td><td class=b>{esc(b)}</td><td>{esc(f)}</td></tr>" for n, b, f in NECK_ROWS)
    sets = "".join(f"<tr><td class=n>{esc(n)}</td><td class=b>{esc(b)}</td><td>{esc(f)}</td></tr>" for n, b, f in NECK_SETS)
    necks = f"""
<section class=front>
  <p class=kicker>Neck finishes</p><h1>What fits what</h1>
  <p class=lede>Caps, rollers, sprayers, pumps and droppers screw onto the neck, so every bottle with the same neck finish shares
  the same parts. In <span class=mono>18-415</span>, 18 is the neck's diameter in millimetres and 415 is the thread style.</p>
  <table class=necks><thead><tr><th>Neck</th><th>Bottles</th><th>Parts that fit</th></tr></thead><tbody>{shared}</tbody></table>
  <h2 class=k>Sold as complete sets, and bottles in their own class</h2>
  <table class=necks><tbody>{sets}</tbody></table>
  <p class=note>A shared neck is where fit starts, not a guarantee: stem length, dip-tube length and how an insert seats are checked
  bottle by bottle. Each family guide shows the combinations Best Bottles sells.</p>
</section>"""
    return cover + contents + uses + necks


# --------------------------------------------------------------------------- parts, packaging, index

PART_NECK_ORDER = ["13-415", "15-415", "17-415", "18-400", "18-415", "20-400", "13-425", "8-425", "22-400", "24-400"]
PART_ORDER = ["Roll-on cap", "Tall roll-on cap", "Fine-mist sprayer", "Treatment pump", "Lotion pump", "Vintage bulb sprayer",
              "Bulb sprayer with tassel", "Dropper", "Short ribbed cap", "Short lined cap", "Tall lined cap", "Lined cap",
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
        return ("Bulb sprayer with tassel" if kind.startswith("tassel") else "Vintage bulb sprayer"), colour
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
<section class=back>
  {lockup(mark, 'big')}
  <img class=qr src='{qr(SITE + "?utm_source=print&utm_medium=catalogue&utm_campaign=catalogue")}' alt=''>
  <p>{SITE_LABEL} · {PHONE}</p><p class=note>{IMPRINT}</p>
</section>"""


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


def main() -> None:
    import pymupdf

    ap = argparse.ArgumentParser()
    ap.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    ap.add_argument("--family", action="append", help="build only these families (repeatable)")
    ap.add_argument("--no-catalogue", action="store_true")
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
        for fam in order:
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

            def body(starts, sku_pages):
                return (front_matter(order, starts, photos, mark)
                        + "".join(family_section(f, families, photos, mark, marker=True) for f in order)
                        + parts_section(components) + packaging_section(packaging) + index_section(skus, sku_pages) + back_page(mark))

            title = "The Catalogue"
            path = renderer.pdf(document(body(None, None), order, title, face_css), OUT / "best-bottles-catalogue.pdf")
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
            path = renderer.pdf(document(body(starts, sku_pages), order, title, face_css), OUT / "best-bottles-catalogue.pdf")
            missing = sorted(set(skus) - set(sku_pages))
            if missing:
                report.append(f"\nItem numbers the index could not place ({len(missing)}): {', '.join(missing[:40])}")
            data = path.read_bytes()
            pages = pymupdf.open(path).page_count
            manifest["catalogue"] = {"file": "best-bottles-catalogue.pdf", "pages": pages, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            print(f"catalogue: {pages} pages, {len(data) // 1024} KB")
    finally:
        renderer.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    report.append("\nShape lines marked *draft* are hand-written physical descriptions awaiting Best Bottles' review; the others open with the family name.")
    (OUT / "build-report.md").write_text("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
