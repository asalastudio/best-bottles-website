"""Product copy v2: the title, option label, description, bullets, Care note and item-type line for every product.

    python3 scripts/pdp-descriptions/product_copy.py                       # the latest data/register/source export
    python3 scripts/pdp-descriptions/product_copy.py --export data/descriptions/pdp/catalog-facts.json
    python3 scripts/pdp-descriptions/product_copy.py --sku GBCylAmb9MtlRollBlkDot

Writes data/descriptions/pdp/product-copy.json (the full draft, every product, for the sample review),
product-copy.site.json (the products that pass every check; the product page reads it through
src/lib/products/item-description/product-copy.ts) and product-copy-report.md. Nothing is written to Convex or Shopify.

The rules are the ones in docs/specs/pdp-item-descriptions: the locked format and its 28 and 29 Sep amendments
(TEMPLATE.md), the mode cards, size bands and claims list (RUBRIC.md), and the titles and vocabulary
(COPY-STRATEGY.md §2 and §3). Bottles are read through scripts/print/family_guides.py, so the website copy and
the printed catalogue use the same part and finish words.
"""
from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import gzip
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "print"))
import family_guides as fg  # noqa: E402

OUT_JSON = fg.ROOT / "data/descriptions/pdp/product-copy.json"
OUT_REPORT = fg.ROOT / "data/descriptions/pdp/product-copy-report.md"
OUT_SITE = fg.ROOT / "data/descriptions/pdp/product-copy.site.json"  # read by src/lib/products/item-description/product-copy.ts
SITE_FIELDS = ("title", "option", "variantTitle", "sentences", "bullets", "care", "itemType", "metaDescription", "altText")
CURRENT = fg.ROOT / "data/descriptions/pdp/item-descriptions.json"
# Screw caps with a liner (Best Bottles: 13-415 on 2026-09-26; 15-415, 18-415 and the Boston Round necks on 2026-09-29)
LINED_NECKS = {"13-415", "15-415", "18-415", "18-400", "20-400"}
LINER_LINE = "The liner seals the neck when capped"

TITLE_MAX, OPTION_MAX, VARIANT_MAX, META_MAX, ALT_MAX, BULLET_MAX = 60, 30, 90, 155, 125, 110
THREAD = re.compile(r"^\d+-\d+$")

# --------------------------------------------------------------------------- modes

# Title noun, type phrase for sentence 1, item-type line (COPY-STRATEGY.md §2.4; TEMPLATE.md type phrases).
MODES = {
    "ROLL": ("Roll-On Bottle", "roll-on bottle"),
    "MIST": ("Fine-Mist Spray Bottle", "fine-mist spray bottle"),
    "PUMP_SPRAY": ("Perfume Spray Bottle", "perfume spray bottle"),
    "ALU_SPRAY": ("Aluminum Spray Bottle", "aluminum spray bottle"),
    "PUMP_LOTION": ("Lotion Pump Bottle", "lotion-pump bottle"),
    "TREATMENT": ("Treatment Pump Bottle", "treatment-pump bottle"),
    "ALU_LOTION": ("Aluminum Lotion Pump Bottle", "aluminum lotion-pump bottle"),
    "BULB": ("Vintage-Style Bulb Sprayer", "vintage-style bulb-spray bottle"),
    "BULB_TASSEL": ("Vintage-Style Bulb Sprayer with Tassel", "vintage-style bulb-spray bottle"),
    "SPLASH": ("Pour Bottle with Reducer", "pour bottle with an orifice reducer"),
    "DROP": ("Dropper Bottle", "dropper bottle"),
    "POUR": ("Pour Bottle", "pour bottle"),
    "STOPPER": ("Bottle with Glass Stopper", "stoppered bottle"),
    "DAB": ("Sample Vial with Glass Rod", "sample vial with a glass dab-on rod"),
    "VIAL": ("Vial", "sample vial"),
    "JAR": ("Cream Jar", "cream jar"),
    "ATOMIZER": ("Travel Atomizer", "refillable travel atomizer"),
    "STOCK": ("Stock Bottle", "stock bottle"),
}
ALT_NOUNS = {  # the type without its "with …", which the alt text's own "with {included}" supplies
    "BULB": "bulb spray bottle", "BULB_TASSEL": "bulb spray bottle", "SPLASH": "pour bottle", "STOPPER": "bottle",
    "DAB": "sample vial", "VIAL": "vial", "ALU_SPRAY": "spray bottle", "ALU_LOTION": "lotion pump bottle",
    "PUMP_LOTION": "lotion pump bottle", "TREATMENT": "treatment pump bottle", "ATOMIZER": "travel atomizer",
}
OIL_MODES = {"ROLL", "POUR", "DROP", "SPLASH", "STOPPER", "DAB"}  # amber line says "the oil"
NO_FAMILY_WORD = {"Vial", "Cream Jar", "Atomizer", "Aluminum Bottle", "Plastic Bottle", "Lotion Bottle"}

# Care notes: one line, outside the description (TEMPLATE.md amendment 2026-09-28; RUBRIC.md §4.2 and §4.6).
CARE = {
    "ROLL": "Carry it capped and upright; the ball alone is not a seal.",
    "MIST": "Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.",
    "PUMP_SPRAY": "Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.",
    "ALU_SPRAY": "Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.",
    "PUMP_LOTION": "For liquids that pour; thick creams and body butters belong in a jar.",
    "TREATMENT": "For liquids that pour; thick creams and body butters belong in a jar.",
    "ALU_LOTION": "For liquids that pour; thick creams and body butters belong in a jar.",
    "BULB": "To carry it, take off the bulb and fit the travel cap.",
    "BULB_TASSEL": "To carry it, take off the bulb and fit the travel cap.",
    "SPLASH": "Very thick oils drip slowly through the reducer.",
    "DROP": "Store it upright; undiluted essential oil can soften the bulb over time.",
    "STOPPER": "The stopper seats by friction and is not leak-proof, so it is not a travel bottle.",
    "ATOMIZER": "Carry it capped and upright.",
}

# Words for the Fits bullet: full names first, short names when the bullet would pass 110 characters.
FIT_WORDS = {
    "Steel roller ball": ("steel roller ball", "steel roller"),
    "Plastic roller ball": ("plastic roller ball", "plastic roller"),
    "Fine-mist sprayer": ("fine-mist sprayer", "sprayer"),
    "Lotion pump": ("lotion pump", "lotion pump"),
    "Treatment pump": ("treatment pump", "treatment pump"),
    "Vintage-style bulb sprayer": ("bulb sprayer", "bulb sprayer"),
    "Vintage-style bulb sprayer with tassel": ("bulb sprayer", "bulb sprayer"),
    "Dropper": ("dropper", "dropper"),
    "Orifice reducer with cap": ("reducer", "reducer"),
    "Screw cap": ("caps", "caps"),
}

# --------------------------------------------------------------------------- lint lists

BEVERAGE = ["alcohol", "alcoholic", "whisky", "whiskey", "bourbon", "scotch", "beer", "wine", "champagne", "vodka", "gin",
            "rum", "tequila", "liquor", "spirits", "cocktail", "cocktails", "brewery", "distillery", "bar", "shot"]
PROMO = ["wholesale", "premium", "luxury", "luxurious", "high quality", "high-quality", "best", "perfect", "bestseller",
         "new", "sale", "amazing", "stunning"]
QUANTITY = ["piece", "pieces", "pcs", "qty", "w/", "approx"]  # "each" is checked as "price each" / "N each" below
CLAIMS = ["airtight", "air-tight", "spill-proof", "spillproof", "uv-proof", "blocks uv", "uv protection", "preserves",
          "extends shelf life", "sterile", "ready to fill", "universal", "fits most", "fits all", "unbreakable",
          "shatterproof", "shatter-proof", "cosmetic-grade", "medical-grade", "food-grade", "therapeutic",
          "child-resistant", "tsa", "fda", "bpa", "eco-friendly", "recyclable"]
STYLE = ["flint", "regular", "metal cap", "liner cap", "itr"]
EXCLUDED = {  # RUBRIC.md §4.2 Excluded, checked in the paragraph only (the Care note names what not to use)
    "ROLL": ["eau de parfum", "cologne", "body mist", "lotion", "cream", "beard oil"],
    "MIST": ["perfume oil", "attar", "essential oil", "beard oil", "lotion", "cream"],
    "PUMP_SPRAY": ["perfume oil", "attar", "essential oil", "beard oil", "lotion", "cream"],
    "ALU_SPRAY": ["perfume oil", "attar", "essential oil", "beard oil", "lotion", "cream"],
    "BULB": ["room spray", "air freshener", "linen spray", "oil", "beard oil", "travel bottle"],
    "BULB_TASSEL": ["room spray", "air freshener", "linen spray", "oil", "beard oil", "travel bottle"],
    "DROP": ["eau de parfum", "cologne", "room spray", "lotion", "cream"],
    "PUMP_LOTION": ["eau de parfum", "cologne", "room spray", "cream", "body butter"],
    "TREATMENT": ["eau de parfum", "cologne", "room spray", "cream", "body butter"],
    "ALU_LOTION": ["eau de parfum", "cologne", "room spray", "cream", "body butter"],
    "POUR": ["spray", "mist", "cream"],
    "SPLASH": ["eau de parfum", "body mist", "cream"],
    "STOPPER": ["travel"],
    "ATOMIZER": ["oil"],
}


def has_word(text: str, word: str) -> bool:
    return re.search(rf"(?<![\w-]){re.escape(word)}(?![\w-])", text, re.I) is not None


# --------------------------------------------------------------------------- records


@dataclass
class Copy:
    websiteSku: str
    graceSku: str
    mode: str
    family: str
    title: str
    option: str
    variantTitle: str
    sentences: list[str]
    bullets: list[list[str]]
    care: str
    itemType: str
    metaDescription: str
    altText: str
    tech: dict
    notes: list[str] = field(default_factory=list)
    lint: list[str] = field(default_factory=list)

    @property
    def paragraph(self) -> str:
        return " ".join(self.sentences)


def title_case(text: str) -> str:
    small = {"and", "with", "or", "of", "a", "the"}
    words = []
    for i, word in enumerate(text.split(" ")):
        parts = [p if (p.lower() in small and i) else p[:1].upper() + p[1:] for p in word.split("-")]
        words.append("-".join(parts))
    return " ".join(words)


def lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text else text


def upper_first(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def join(words: list[str]) -> str:
    words = [w for w in words if w]
    if len(words) <= 2:
        return " and ".join(words)
    return ", ".join(words[:-1]) + " and " + words[-1]


def article(phrase: str) -> str:
    return "An" if phrase[:1].lower() in "aeiou" else "A"


# --------------------------------------------------------------------------- the rules


def mode_of(item: fg.Item, body: fg.Body, row: dict) -> str:
    fit, fam = item.fitment, item.family
    aluminum = fam == "Aluminum Bottle" or body.klass == "aluminum-bottle"
    if fit == "Atomizer" or body.klass == "metal-atomizer":
        return "ATOMIZER"
    if fit == "Lid":
        return "JAR"
    if fit == "Cap with glass rod":
        return "DAB"
    if fit == "Glass stopper":
        return "STOPPER"
    if fit in ("Steel roller ball", "Plastic roller ball"):
        return "ROLL"
    if fit == "Fine-mist sprayer":
        if aluminum:
            return "ALU_SPRAY"
        return "PUMP_SPRAY" if row.get("applicator") == "Perfume Spray Pump" else "MIST"
    if fit == "Lotion pump":
        return "ALU_LOTION" if aluminum else "PUMP_LOTION"
    if fit == "Treatment pump":
        return "TREATMENT"
    if fit == "Vintage-style bulb sprayer":
        return "BULB"
    if fit == "Vintage-style bulb sprayer with tassel":
        return "BULB_TASSEL"
    if fit == "Orifice reducer with cap":
        return "SPLASH"
    if fam == "Vial":
        return "VIAL"
    if fit == "Dropper":
        return "DROP"
    if item.ml > 100:  # RUBRIC.md STOCK: any cap-only bottle over 100 ml
        return "STOCK"
    return "POUR"


def dram(item: fg.Item) -> str | None:
    if item.family != "Vial":
        return None
    return {3: "5/8 Dram", 4: "1 Dram"}.get(round(item.ml)) if abs(item.ml - round(item.ml)) < .01 else None


def capacity_text(item: fg.Item, body: fg.Body, with_oz: bool = True) -> str:
    ml = 3 if item.ml == 3.3 else item.ml  # the owner's label for the 12 mm Cylinder (SYNTHESIS.md §2)
    text = f"{ml:g} ml"
    drams = dram(item)
    if drams:
        return f"{drams} ({text})"
    if not with_oz:
        return text
    if item.family == "Boston Round" and ml in fg.BOSTON_OZ:
        return f"{text} ({fg.BOSTON_OZ[ml]} oz)"
    if round(ml) in fg.OZ and abs(ml - round(ml)) < .01:
        return f"{text} ({fg.OZ[round(ml)]} oz)"
    return text


def colour_word(item: fg.Item, body: fg.Body, row: dict, mode: str) -> str:
    if item.family == "Aluminum Bottle" or mode == "ATOMIZER":
        return ""  # aluminum takes the material word; an atomizer's colour is its option
    if body.klass == "plastic-bottle" or row.get("category") == "Plastic Bottle":
        return "Natural Plastic" if "Nat" in item.sku and mode == "STOCK" else f"{item.glass} Plastic"
    return item.glass


def family_word(item: fg.Item, body: fg.Body, mode: str) -> str:
    fam = item.family
    if fam in NO_FAMILY_WORD or mode in ("VIAL", "DAB", "JAR", "ATOMIZER") or body.klass == "plastic-bottle":
        if mode == "ATOMIZER" and ("Slim" in item.sku or body.neck == "10mm"):
            return "Slim"
        return ""
    if fam == "Cylinder" and item.ml == 9 and body.neck == "13-415":
        return "Tall Cylinder"
    if fam == "Decorative" and body.shape:
        return body.shape
    if fam == "Apothecary" and mode == "STOPPER":
        return "Apothecary"
    if body.shape and body.shape.lower() not in (fam.lower(), "standard", "cylinder"):
        return f"{body.shape} {fam}"
    return fam


def title_of(item: fg.Item, body: fg.Body, row: dict, mode: str, notes: list[str]) -> str:
    noun = MODES[mode][0]
    colour, fam = colour_word(item, body, row, mode), family_word(item, body, mode)
    if mode == "VIAL" and item.fitment == "Dropper":
        noun = "Vial with Dropper"
    if mode == "STOCK" and item.family == "Aluminum Bottle":
        noun = "Aluminum Stock Bottle"

    def build(cap: str, noun: str) -> str:
        return " ".join(w for w in (cap, colour, fam, noun) if w)
    title = build(capacity_text(item, body), noun)
    if len(title) > TITLE_MAX:
        title = build(capacity_text(item, body, with_oz=False), noun)
        notes.append("title: ounce bracket dropped to fit 60 characters")
    if len(title) > TITLE_MAX and mode == "BULB_TASSEL":
        title = build(capacity_text(item, body, with_oz=False), "Vintage-Style Tassel Bulb Sprayer")
        notes.append("title: shortened by hand (tassel moved before 'Bulb Sprayer')")
    return title


def finish_words(item: fg.Item) -> str:
    """The finish without the part noun: 'Black dotted cap' -> 'black dotted'."""
    text = re.sub(r"\s+(cap|lid)$", "", item.finish.strip(), flags=re.I)
    return text


def option_of(item: fg.Item, mode: str) -> str:
    fin = finish_words(item)
    plain = re.sub(r"\s+lined$", "", fin)  # "lined" stays in the Included bullet, not in the picker
    if mode == "ROLL":
        ball = "Steel Ball" if item.fitment == "Steel roller ball" else "Plastic Ball"
        return f"{ball}, {title_case(plain)} Cap"
    if mode in ("MIST", "PUMP_SPRAY", "ALU_SPRAY"):
        return f"{title_case(fin)} Sprayer"
    if mode in ("PUMP_LOTION", "TREATMENT", "ALU_LOTION"):
        if fin.lower() == "clear overcap":
            return "Pump with Clear Overcap"
        return f"{title_case(fin)} Pump"
    if mode in ("BULB", "BULB_TASSEL"):
        # The title already says "with Tassel" (tassel bulbs are their own product group), so the option names the bulb
        if fin.lower().startswith("ivory, "):
            return f"Ivory Bulb, {title_case(fin.split(', ', 1)[1])}"
        return f"{title_case(fin)} Bulb"
    if mode == "DROP" or (mode == "VIAL" and item.fitment == "Dropper"):
        return title_case(fin)
    if item.fitment == "Flip-top cap":
        return f"{title_case(plain)} Flip-Top Cap"
    if mode in ("POUR", "SPLASH", "STOCK") or (mode == "VIAL" and item.fitment == "Screw cap"):
        return f"{title_case(plain)} Cap"
    if mode == "VIAL":
        return f"{title_case(plain)} Plug"
    if mode == "DAB":
        return f"{title_case(plain)} Cap"
    if mode == "STOPPER":
        plain = "Cobalt Blue" if plain.lower() == "blue" else plain
        return "Glass Stopper" if plain.lower() in ("clear", "standard") else f"{title_case(plain)} Glass Stopper"
    if mode == "JAR":
        return f"{title_case(plain)} Lid"
    if mode == "ATOMIZER":
        return title_case(plain)
    return title_case(plain)


def band(item: fg.Item, mode: str) -> str:
    if mode in ("VIAL", "DAB") or item.ml <= 5:
        return "sample"
    if item.ml <= 9:
        return "small"
    if item.ml <= 15:
        return "purse"
    if item.ml <= 60:
        return "everyday"
    if item.ml <= 128:
        return "full"
    return "stock"


def size_phrase(item: fg.Item, body: fg.Body, mode: str) -> str:
    b = band(item, mode)
    if mode == "JAR":
        return {"small": ", sized for samples and travel", "purse": ", sized for samples and travel",
                "full": ", at full retail size"}.get(b, "")
    if b == "small":
        return ", sized for samples, promotions and travel"
    if b == "purse":
        return ", sized for decants, promotions and travel"
    if b == "everyday" and item.family == "Boston Round" and item.ml in (30, 60):
        return f", in the common {fg.BOSTON_OZ[item.ml]} oz size"
    if b == "full":
        return ", at full retail size"
    if b == "stock":
        return ", for stock or refills"
    return ""


USES = {  # RUBRIC.md §4.2 Primary, then Also (liquid words from §4.1)
    "ROLL": ["perfume oil", "attar", "carrier-oil blends"],
    "MIST": ["eau de parfum", "cologne", "body mist"],
    "PUMP_SPRAY": ["eau de parfum", "eau de toilette", "cologne"],
    "ALU_SPRAY": ["perfume", "body mist", "room spray", "air freshener"],
    "PUMP_LOTION": ["body lotion", "liquid soap", "serums"],
    "TREATMENT": ["serums", "facial oil", "body oil"],
    "ALU_LOTION": ["body lotion", "hand lotion", "liquid soap"],
    "SPLASH": ["splash cologne", "aftershave", "perfume oil", "beard oil"],
    "DROP": ["essential oils", "beard oil", "facial serums"],
    "JAR": ["cream", "balm", "body butter", "solid perfume"],
    "STOCK": ["lotion", "liquid soap", "body wash"],
}


def sentence_one(item: fg.Item, body: fg.Body, mode: str) -> str:
    phrase = MODES[mode][1]
    if mode == "STOPPER" and item.family == "Apothecary":
        phrase = "stoppered apothecary bottle"
    b = band(item, mode)
    if mode in ("BULB", "BULB_TASSEL"):
        return f"A {phrase} for eau de parfum and cologne kept on a dressing table, and for display or gifts."
    if mode == "ATOMIZER":
        return f"A {phrase} for decants of eau de parfum or cologne carried in a bag or pocket, and for gifts and promotions."
    if mode == "STOPPER":
        extra = ", and for display, gifts and favors" if item.ml <= 5 else ", and for display"
        return f"A {phrase} for perfume oil and attar kept on a dressing table or shelf{extra}."
    if mode == "DAB":
        return f"A {phrase} for samples, testers and promotional giveaways of perfume oil and attar."
    if mode == "VIAL":
        drams = dram(item)
        lead = f"A {drams.lower()} vial for samples, testers" if drams else "A sample vial for testers"
        liquids = "essential oil, perfume oil and serums" if item.fitment == "Dropper" else "eau de parfum, perfume oil and essential oil"
        return f"{lead} and promotional giveaways of {liquids}."
    if mode == "ALU_SPRAY" and b == "stock":
        return f"An {phrase} for {join(USES[mode])}, in a size for stock or refills."
    if mode in ("ALU_SPRAY", "ALU_LOTION"):
        return f"An {phrase} for {join(USES[mode])}."
    if mode == "POUR":
        if b == "sample":
            return f"A {phrase} for samples and promotional giveaways of perfume oil, attar and beard oil."
        if b in ("small", "purse"):
            return f"A {phrase} for perfume oil, attar and beard oil{size_phrase(item, body, mode)}."
        return f"A {phrase} for beard oil, hair oil and essential oils{size_phrase(item, body, mode)}."
    if mode == "STOCK":
        if item.family == "Aluminum Bottle":
            return f"An aluminum {phrase} for lotion, liquid soap and body wash, sized for bulk storage and refills."
        return f"A {phrase} for lotion, liquid soap and body wash, sized for bulk storage and refills."
    uses = USES.get(mode, [])
    if b == "sample" and mode in ("ROLL", "MIST", "DROP", "SPLASH"):
        liquids = {"ROLL": "perfume oil, attar and roll-on blends", "MIST": "eau de parfum, cologne and body mist",
                   "DROP": "essential oils, beard oil and serums", "SPLASH": "perfume oil and splash cologne"}[mode]
        return f"{article(phrase)} {phrase} for samples and promotional giveaways of {liquids}."
    return f"{article(phrase)} {phrase} for {join(uses)}{size_phrase(item, body, mode)}."


def sentences_after(item: fg.Item, body: fg.Body, mode: str, flags: set[str]) -> list[str]:
    thread = bool(THREAD.match(body.neck or ""))
    if mode == "ROLL":
        return ["The steel ball lays the oil on in a thin, even line." if item.fitment == "Steel roller ball"
                else "The plastic ball lays the oil on in a thin line."]
    if mode in ("MIST", "PUMP_SPRAY", "ALU_SPRAY"):
        if thread and item.status != "exception":
            return ["The sprayer turns a thin liquid into a fine, even mist, and unscrews so the bottle can be refilled."]
        return ["The sprayer turns a thin liquid into a fine, even mist."]
    if mode in ("PUMP_LOTION", "TREATMENT", "ALU_LOTION"):
        return ["Press the pump to dispense; there is no need to tip the bottle."]
    if mode in ("BULB", "BULB_TASSEL"):
        return ["Squeeze the bulb to spray."]
    if mode == "SPLASH":
        return ["The reducer turns a pour into a controlled splash or drip."]
    if mode == "DROP":
        return ["The glass pipette lets the oil out a drop at a time."]
    if mode == "POUR":
        return ["It has no fitment, so the oil pours straight from the neck into the hand."]
    if mode == "VIAL":
        if item.fitment == "Dropper":
            return ["The glass pipette lets the oil out a drop at a time."]
        return ["Fill it with a pipette or a small funnel."]
    if mode == "DAB":
        return ["Dab straight from the glass rod; the cap closes the neck between uses."]
    if mode == "STOPPER":
        return ["The glass stopper sits in a ground-glass neck."]
    if mode == "JAR":
        return ["The wide mouth takes a spatula or a fingertip."]
    if mode == "ATOMIZER":
        out = ["A metal shell covers the glass vial, which refills from the top."]
        if "engravable" in flags:
            out.append("The shell can be laser-engraved.")
        return out
    if mode == "STOCK":
        return ["The flip-top cap opens for pouring without unscrewing it."] if item.fitment == "Flip-top cap" \
            else ["Fill it from a larger container with a funnel."]
    return []


def travel_cap(finish: str) -> str:
    """Travel caps come in gold, silver and black (Best Bottles, 2026-09-29). The copy assumes the cap matches a
    gold, silver or black bulb or collar; for other bulb colours it says only "a travel cap"."""
    for colour in ("gold", "silver", "black"):
        if colour in finish:
            return f"a {colour} travel cap"
    return "a travel cap"


def included_of(item: fg.Item, mode: str, flags: set[str]) -> str:
    fin = finish_words(item)
    low = lower_first(fin)
    overcap = " and plastic overcap" if "overcap" in flags else ""
    if mode == "ROLL":
        ball = "Steel" if item.fitment == "Steel roller ball" else "Plastic"
        return f"{ball} roller ball and {lower_first(item.finish)}, packed unattached"
    if mode in ("MIST", "PUMP_SPRAY", "ALU_SPRAY"):
        return f"{upper_first(low)} fine-mist sprayer{overcap}, packed unattached"
    if mode in ("PUMP_LOTION", "TREATMENT", "ALU_LOTION"):
        pump = "treatment pump" if mode == "TREATMENT" else "lotion pump"
        if low == "clear overcap":
            return f"{upper_first(pump)} and clear overcap, packed unattached"
        return f"{upper_first(low)} {pump}{overcap}, packed unattached"
    if mode in ("BULB", "BULB_TASSEL"):
        tassel = "tassel" if mode == "BULB_TASSEL" else ""
        cap = travel_cap(low)
        m = re.match(r"ivory, (\w+) collar", low)
        if m:
            extras = f" with {m.group(1)} collar" + (" and tassel" if tassel else "")
            return f"Ivory bulb sprayer{extras}, packed unattached, and {cap}"
        return f"{upper_first(low)} bulb sprayer{' with tassel' if tassel else ''}, packed unattached, and {cap}"
    if mode == "DROP" or (mode == "VIAL" and item.fitment == "Dropper"):
        m = re.match(r"(\w+) bulb, (.+) collar", low)
        if m:
            return f"Glass pipette dropper, {m.group(1)} bulb and {m.group(2)} collar, packed unattached"
        return f"Glass pipette dropper, bulb and {re.sub(r' collar$', '', low)} collar, packed unattached"
    if mode == "SPLASH":
        return f"Orifice reducer and {lower_first(item.finish)}, packed unattached"
    if item.fitment == "Flip-top cap":
        return f"{upper_first(re.sub(r' cap$', '', low))} flip-top cap"
    if mode in ("POUR", "STOCK") or (mode == "VIAL" and item.fitment == "Screw cap"):
        text = lower_first(item.finish)
        if text.startswith("short ribbed"):
            return upper_first(text) + " with a white liner"
        # "Lined cap" is the name on 13-415, 15-415 and 18-415 (SYNTHESIS.md D1); only 13-415 carries the liner line
        if not text.endswith(("lined cap", "screw cap", "flip-top cap")) and text.endswith(" cap") and item.neck != "13-415":
            text = text[:-len(" cap")] + " screw cap"
        return upper_first(text)
    if mode == "VIAL":
        return f"{upper_first(re.sub(r' cap$', '', low))} plug applicator"
    if mode == "DAB":
        return f"{upper_first(low)} screw cap with a glass rod"
    if mode == "STOPPER":
        low = "cobalt blue" if low == "blue" else low
        return "Glass stopper" if low in ("clear", "standard") else f"{upper_first(low)} glass stopper"
    if mode == "JAR":
        return f"{upper_first(re.sub(r' lid$', '', low))} screw lid"
    if mode == "ATOMIZER":
        return "Sprayer and cap"
    return upper_first(low)


def fits_of(item: fg.Item, body: fg.Body, mode: str) -> str:
    neck = body.neck or ""
    if mode in ("ATOMIZER", "STOPPER") or not THREAD.match(neck):
        return ""
    if item.status == "exception":
        return f"{neck} neck; the top and base are fixed, so it does not take other {neck} parts"
    own_bulb = item.fitment.startswith("Vintage-style")
    others, seen = [], set()
    for other in body.items:
        if other.glass != item.glass or other.fitment == item.fitment or other.fitment not in FIT_WORDS:
            continue
        if own_bulb and other.fitment.startswith("Vintage-style"):
            continue
        key = FIT_WORDS[other.fitment][0]
        if key not in seen:
            seen.add(key)
            others.append(other.fitment)
    others.sort(key=lambda f: fg.FIT_INDEX.get(f, 99))
    if not others:
        return f"{neck} neck"
    for short in (False, True):
        words = [FIT_WORDS[f][1 if short else 0] for f in others]
        words = list(dict.fromkeys(words))
        steel, plastic = ("steel roller", "plastic roller") if short else ("steel roller ball", "plastic roller ball")
        if steel in words and plastic in words:
            i = words.index(steel)
            words = [w for w in words if w not in (steel, plastic)]
            words.insert(i, "steel and plastic rollers" if short else "steel and plastic roller balls")
        text = f"{neck} neck; takes the {join(words)} sold for this bottle"
        if len("Fits: " + text) <= BULLET_MAX:
            return text
    return f"{neck} neck; other parts sold for this bottle are listed below"


def glass_of(item: fg.Item, body: fg.Body, row: dict, mode: str) -> tuple[str, str]:
    if item.family == "Aluminum Bottle" or body.klass == "aluminum-bottle":
        return "Material", "Aluminum; light, and it does not break"
    if mode == "ATOMIZER":
        return "Material", f"{upper_first(lower_first(finish_words(item)))} metal shell over a glass vial"
    if body.klass == "plastic-bottle" or row.get("category") == "Plastic Bottle":
        return "Material", "Plastic"
    g = item.glass
    if g == "Amber":
        return "Glass", f"Amber; reduces the light that reaches {'the oil' if mode in OIL_MODES else 'the contents'}"
    if g == "Clear":
        return "Glass", "Clear; shows the product inside" if mode == "JAR" else "Clear; shows the fill level"
    if g == "Frosted":
        return "Glass", "Frosted; a surface finish, not a light filter"
    if g == "Swirl":
        return "Glass", "Swirl; a spiral moulded into the glass"
    return "Glass", g[:1] + g[1:].lower()


def good_to_know(item: fg.Item, body: fg.Body, mode: str, flags: set[str]) -> str:
    if item.fitment == "Screw cap" and body.klass != "plastic-bottle" and (
            item.neck in LINED_NECKS or (mode == "STOCK" and item.family == "Aluminum Bottle")):
        return LINER_LINE
    if mode == "SPLASH" and item.neck in LINED_NECKS:
        return LINER_LINE
    if mode == "STOPPER" and "handmade" in flags:
        return "Made by hand; each stopper is ground to its own bottle"
    if "weighted" in flags:
        return "The base is weighted, so the bottle stands steady"
    return ""


def item_type_of(mode: str, title_noun: str, body: fg.Body) -> str:
    noun = upper_first(title_noun.lower())
    if mode == "ATOMIZER":  # the atomizer's inner thread is not a neck buyers fit parts to
        return noun
    return f"{noun} · {body.neck} neck" if THREAD.match(body.neck or "") else noun


def tech_of(item: fg.Item, body: fg.Body, row: dict, bottle: bool) -> dict:
    return {
        "capacity": capacity_text(item, body),
        "neck": fg.neck_label(body.neck),
        "heightMm": body.height,
        "diameterMm": body.width,
        "material": "Aluminum" if item.family == "Aluminum Bottle" else "Plastic" if body.klass == "plastic-bottle"
        else f"{item.glass} glass",
        "soldAs": (f"1, 12 or 144 sets, or a case of {item.case:,} sets" if item.case else "1, 12 or 144 sets") if bottle
        else (f"A case of {item.case:,}" if item.case else ""),
    }


def legacy_flags(text: str) -> set[str]:
    flags = set()
    if re.search(r"laser[- ]engraved", text, re.I):
        flags.add("engravable")
    if re.search(r"hand made|hand-made|made by hand", text, re.I):
        flags.add("handmade")
    if re.search(r"base is weighted|weighted base", text, re.I):
        flags.add("weighted")
    if re.search(r"overcap|over cap", text, re.I):
        flags.add("overcap")
    return flags


# --------------------------------------------------------------------------- lint


def errors(c: Copy) -> list[str]:
    return [f for f in c.lint if not f.startswith("target:")]


def lint(c: Copy) -> list[str]:
    """Checks from TEMPLATE.md §6 and RUBRIC.md §5. Findings starting "target:" are over a length target, not wrong."""
    out = []
    if len(c.title) > TITLE_MAX:
        out.append(f"title {len(c.title)} characters")
    if len(c.option) > OPTION_MAX:
        out.append(f"target: option {len(c.option)} characters")  # a target, not a platform limit
    if len(c.variantTitle) > VARIANT_MAX:
        out.append(f"target: variant title {len(c.variantTitle)} characters")
    if len(c.metaDescription) > META_MAX:
        out.append(f"meta description {len(c.metaDescription)} characters")
    if len(c.altText) > ALT_MAX:
        out.append(f"alt text {len(c.altText)} characters")
    words = len(c.paragraph.split())
    if not (12 if c.mode in ("PART", "PACKAGING") else 20) <= words <= 55:
        out.append(f"paragraph {words} words")
    if not (1 if c.mode == "PACKAGING" else 2) <= len(c.sentences) <= 3:
        out.append(f"{len(c.sentences)} sentences")
    if " for " not in c.sentences[0] and c.mode != "PACKAGING":
        out.append("sentence 1 has no 'for'")
    if not (1 if c.mode == "PACKAGING" else 2) <= len(c.bullets) <= 4:
        out.append(f"{len(c.bullets)} bullets")
    for label, text in c.bullets:
        if len(f"{label}: {text}") > BULLET_MAX:
            out.append(f"{label} bullet {len(label) + 2 + len(text)} characters")
        if text.endswith((".", ";", ",")):
            out.append(f"{label} bullet ends with punctuation")
    everything = " ".join([c.title, c.option, c.paragraph, c.care, c.itemType] + [t for _, t in c.bullets])
    for word in BEVERAGE + PROMO + QUANTITY + CLAIMS + STYLE:
        if has_word(everything, word):
            out.append(f"banned word '{word}'")
    if re.search(r"leak[- ]?proof", everything, re.I) and not re.search(r"not leak-proof", everything):
        out.append("leak-proof claim")
    if re.search(r"does not break", everything) and c.family != "Aluminum Bottle":
        out.append("'does not break' outside aluminum")
    if re.search(r"(?<!Faux-)(?<!faux-)\bleather\b", everything, re.I):
        out.append("'leather' without 'faux-'")
    if c.mode not in ("PART", "PACKAGING") and re.search(r"(?<!cobalt )\bblue\b", c.title + " " + next((t for l, t in c.bullets if l == "Glass"), ""), re.I):
        out.append("'blue' without 'cobalt'")
    if re.search(r"\b(?:price|\d+|\$[\d.]+) each\b", everything, re.I):
        out.append("banned word 'each'")
    if re.search(r"\d\s?mm\b|\d\s?(?:in|inch|inches)\b", c.paragraph + " " + " ".join(t for _, t in c.bullets)):
        out.append("measurement in the copy")
    if re.search(r"\$|\bcase of\b|\bper case\b", c.paragraph + " " + " ".join(t for _, t in c.bullets)):
        out.append("price or case count in the copy")
    if re.search(r"—|!", everything):
        out.append("em dash or exclamation point")
    if re.search(r"\d(ml|oz)\b", everything):
        out.append("no space between number and unit")
    if re.search(r"\b[A-Z]{3,}\b", everything.replace("TSA", "")):
        out.append("all-caps word")
    for word in EXCLUDED.get(c.mode, []):
        if has_word(c.paragraph, word):
            out.append(f"excluded use '{word}' for {c.mode}")
    return out


# --------------------------------------------------------------------------- parts and packaging
# Draft rules, first written for the sample review (P01-P12 in scripts/print/copy_review_kit.py); nothing in the
# copy standard covers parts yet. Parts are counted by the item, not in sets (COPY-STRATEGY.md §10, decision 9).

# part name (family_guides.part_label) -> (count noun, bottle fitments it is sold with, bottle word, uses, sentence 2, care)
PART_RULES = {
    "Roll-on cap": ("caps", {"Steel roller ball", "Plastic roller ball"}, "roll-on bottles", None,
                    "It screws on over the roller ball.", ""),
    "Tall roll-on cap": ("caps", {"Steel roller ball", "Plastic roller ball"}, "roll-on bottles", None,
                         "It screws on over the roller ball.", ""),
    "Fine-mist sprayer": ("sprayers", {"Fine-mist sprayer"}, "spray bottles", "eau de parfum, cologne and body mist",
                          "It turns a thin liquid into a fine, even mist.", CARE["MIST"]),
    "Treatment pump": ("pumps", {"Treatment pump"}, "bottles", "serums, facial oil and body oil",
                       "Press the pump to dispense; there is no need to tip the bottle.", CARE["PUMP_LOTION"]),
    "Lotion pump": ("pumps", {"Lotion pump"}, "bottles", "body lotion, liquid soap and serums",
                    "Press the pump to dispense; there is no need to tip the bottle.", CARE["PUMP_LOTION"]),
    "Vintage-style bulb sprayer": ("bulb sprayers", {"Vintage-style bulb sprayer", "Vintage-style bulb sprayer with tassel"},
                                   "bottles", "eau de parfum and cologne kept on a dressing table", "Squeeze the bulb to spray.",
                                   "To carry the bottle, take off the bulb and fit a cap."),
    "Vintage-style bulb sprayer with tassel": ("bulb sprayers", {"Vintage-style bulb sprayer", "Vintage-style bulb sprayer with tassel"},
                                              "bottles", "eau de parfum and cologne kept on a dressing table", "Squeeze the bulb to spray.",
                                              "To carry the bottle, take off the bulb and fit a cap."),
    "Dropper": ("droppers", {"Dropper"}, "dropper bottles", "essential oils, beard oil and facial serums",
                "The glass stem is sized for that bottle.", CARE["DROP"]),
    "Short ribbed cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Short lined cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Tall lined cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Lined cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Faux-leather cap": ("caps", {"Orifice reducer with cap"}, "pour bottles with a reducer", None,
                         "It screws on over the orifice reducer.", ""),
    "Short screw cap": ("caps", {"Screw cap", "Dropper"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Tall screw cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Screw cap": ("caps", {"Screw cap"}, "bottles", None, "It screws onto the neck to close the bottle.", ""),
    "Cap with glass rod": ("caps", {"Cap with glass rod"}, "sample vials", "dabbing perfume oil and attar",
                           "The glass rod reaches into the vial and dabs the oil on.", ""),
}
DROPPER_STEM_ML = {("18-400", "66"): 15, ("20-400", "76"): 30, ("20-400", "90"): 60}  # the stem matches one Boston round


def bottles_for(neck: str, fitments: set[str], families: dict[str, fg.Family], ml: float | None = None) -> list[tuple[str, float]]:
    pairs = set()
    for fam in families.values():
        for body in fam.bodies.values():
            if body.neck != neck or (ml is not None and body.ml != ml):
                continue
            if any(i.fitment in fitments for i in body.items):
                name = "Tall Cylinder" if fam.name == "Cylinder" and body.ml == 9 and neck == "13-415" else fam.name
                pairs.add((name, body.ml))
    return sorted(pairs, key=lambda p: (p[1], p[0]))


def bottle_phrase(pairs: list[tuple[str, float]], word: str) -> str:
    if not pairs:
        return ""
    groups: dict[str, list[float]] = {}
    for name, ml in pairs:
        groups.setdefault(name, []).append(ml)
    if len(groups) <= 2 and len(pairs) <= 4:
        def one(name: str, mls: list[float]) -> str:
            noun = "vial" if name == "Vial" else name
            plural = "s" if len(mls) > 1 else ""
            return f"{join([f'{m:g}' for m in mls])} ml {noun}{plural}"
        return "the " + join([one(n, m) for n, m in groups.items()])
    names = list(dict.fromkeys(name for name, _ in pairs))
    lo, hi = min(ml for _, ml in pairs), max(ml for _, ml in pairs)
    span = f"{lo:g} ml" if lo == hi else f"{lo:g} to {hi:g} ml"
    if len(names) <= 3:
        return f"the {join(names)} {word}, {span}"
    return f"the {word} from {span}, in {len(names)} shapes"


def build_part(comp: dict, row: dict, families: dict[str, fg.Family]) -> Copy | None:
    part, finish = fg.part_label(comp)
    base = re.sub(r", \d+ mm stem$", "", part)
    rule = PART_RULES.get(base)
    if not rule or not comp.get("neck"):
        return None
    count, fitments, word, uses, second, care = rule
    neck, sku = comp["neck"], comp["websiteSku"]
    if base.endswith("lined cap") and neck == "18-415":
        fitments, word = {"Orifice reducer with cap"}, "pour bottles with a reducer"
        second = "It screws on over the orifice reducer."
    notes: list[str] = []
    ml = None
    stem = re.search(r"(\d+) mm stem", part)
    if base == "Dropper" and stem:
        ml = DROPPER_STEM_ML.get((neck, stem.group(1)))
    pairs = bottles_for(neck, fitments, families, ml)
    target = bottle_phrase(pairs, word)
    if base == "Dropper" and not ml:
        second = "The glass pipette lets the oil out a drop at a time."
        notes.append("stem length: which bottles each 18-415 dropper is cut for is not recorded")
    if base == "Dropper" and ml:
        oz = fg.BOSTON_OZ.get(ml)
        title = f"Dropper for {ml:g} ml{f' ({oz} oz)' if oz else ''} Bottles, {neck} Neck"
    else:
        title = f"{title_case(base)} for {neck} Necks"
    option = title_case(re.sub(r", white liner$", "", finish)) if finish else ""
    phrase = lower_first(base)
    vials = bool(pairs) and all(name == "Vial" for name, _ in pairs)
    if base in ("Roll-on cap", "Tall roll-on cap", "Faux-leather cap") or (base.endswith("lined cap") and neck == "18-415"):
        first = f"{article(phrase)} {phrase} for {target or f'the {neck} {word}'}, to replace a cap or change the look of a bottle."
    elif base == "Cap with glass rod":
        first = f"A screw cap with a glass rod for {target or 'the 9 ml sample vial'}, for dabbing perfume oil and attar."
    elif base.endswith("cap"):
        first = (f"{article(phrase)} {phrase} for {target or f'the {neck} {word}'}, "
                 f"to close {'a vial' if vials else 'a pour bottle'} or replace a lost cap.")
    else:
        first = f"{article(phrase)} {phrase} for {target or f'the {neck} {word}'}, for {uses}."
    if not pairs:
        notes.append("no bottle in the catalogue is sold with this part at this neck")
    fin = lower_first(finish) if finish else ""
    if base in ("Roll-on cap", "Tall roll-on cap"):
        included = f"{upper_first(fin)} {phrase}; the roller ball comes with the bottle"
    elif base == "Short ribbed cap":
        included = f"Short {fin.split(',')[0]} ribbed cap with a white liner"
    elif base == "Dropper":
        m = re.match(r"(\w+) bulb, (.+) collar", fin)
        included = f"Glass pipette, {m.group(1)} bulb and {m.group(2)} collar" if m else "Glass pipette, bulb and collar"
    elif base in ("Fine-mist sprayer", "Treatment pump", "Lotion pump"):
        overcap = " and clear overcap" if "overcap" in fin else ""
        included = f"{upper_first(re.sub(r', clear overcap$', '', fin))} {phrase} with its dip tube{overcap}"
    else:
        included = f"{upper_first(fin)} {phrase}".strip()
    bullets = [["Included", included]]
    if pairs:
        fits = f"{neck} neck; {target}"
        if len(f"Fits: {fits}") > BULLET_MAX:
            fits = f"{neck} neck; {bottle_phrase(pairs[:0] or pairs, word)}"
        bullets.append(["Fits", upper_first(fits) if not fits[0].isdigit() else fits])
    if base.endswith("cap") and neck in LINED_NECKS and base not in ("Roll-on cap", "Tall roll-on cap", "Cap with glass rod"):
        bullets.append(["Good to know", LINER_LINE])
    noun = title_case(base)
    tech = {"neck": neck, "finish": finish, "soldAs": f"1, 12 or 144 {count}"
            + (f"; a case holds {int(row['caseQuantity']):,}" if row.get("caseQuantity") else "")}
    if stem:
        tech["stemMm"] = int(stem.group(1))
    c = Copy(websiteSku=sku, graceSku=comp.get("graceSku", ""), mode="PART", family=base, title=title, option=option,
             variantTitle=f"{title} - {option}" if option else title, sentences=[first, second], bullets=bullets, care=care,
             itemType=f"{upper_first(phrase)} · {neck} neck", metaDescription=first,
             altText=f"{phrase} for {neck} necks, {fin}".rstrip(", ").lower(), tech=tech, notes=notes)
    c.lint = lint(c)
    return c


PACKAGING_KINDS = [  # (SKU pattern, title noun, count noun, sentence 1, sentence 2, material)
    (r"^OBag", "Organza Gift Bag", "bags", "A sheer organza gift bag with a gusseted base, for small bottles, samples and favors.",
     "Choose the size by the bottle it will hold.", "Organza; sheer"),
    (r"^VBag", "Velveteen Gift Bag", "bags", "A soft velveteen gift pouch for a small bottle, samples and favors.",
     "Choose the size by the bottle it will hold.", "Velveteen"),
    (r"^BoxB|^BoxC", "Window Gift Box", "boxes", "A folding gift box with a window, for a single bottle.",
     "The window shows the bottle inside.", ""),
    (r"^BoxE|^BoxWhite", "Gift Box", "boxes", "A gift box for presenting a single bottle or a small set of bottles and parts.", "", ""),
    (r"^Box-", "Corrugated Shipping Box", "boxes", "A corrugated shipping box for packing and mailing orders of bottles and parts.", "",
     "Corrugated board"),
    (r"^Recloseable", "Resealable Plastic Bags", "packets", "Resealable clear plastic bags for packing bottles, parts and samples.",
     "They come in packets of 100 bags.", "Plastic"),
    (r"^Funnel|^Plastic$", "Funnel", "funnels", "A small funnel for filling bottles and vials from a larger container.", "", ""),
]


def build_packaging(row: dict) -> Copy | None:
    sku = row.get("websiteSku") or ""
    kind = next((k for k in PACKAGING_KINDS if re.search(k[0], sku)), None)
    if not kind:
        return None
    _, noun, count, first, second, material = kind
    name = fg.clean_packaging(row.get("itemName") or "")
    colour = (row.get("color") or "").strip()
    colour = "" if colour.lower() in ("none", "clear", "matte") else colour
    m = re.search(r"(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)", sku)
    notes = []
    option = ""
    if noun.endswith("Gift Bag") or noun.startswith("Resealable"):
        option = f"{m.group(1)} x {m.group(2)} in" if m else ""
        if not m:
            notes.append("size not in the item number")
    if noun == "Window Gift Box":
        design = re.match(r"(.+?) (?:design )?folding carton", name, re.I)
        option = title_case(re.sub(r"\s*design$", "", design.group(1), flags=re.I)) if design else ""
        notes.append("which bottles fit each box size (B, C) is not recorded")
    if noun == "Funnel":
        option = "Plastic" if "plastic" in name.lower() else f"{colour} Metal".strip()
        notes.append("which necks the funnel fits is not recorded")
    if noun in ("Gift Box", "Corrugated Shipping Box"):
        m3 = re.search(r"(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)", name)
        option = f"{m3.group(1)} x {m3.group(2)} x {m3.group(3)} in" if m3 else ""
    finish = re.match(r"(cream matte|white)", name, re.I)
    title = (f"{colour} {noun}".strip() if noun.endswith("Gift Bag")
             else f"{title_case(finish.group(1))} {noun}" if noun == "Gift Box" and finish else noun)
    sentences = [first] + ([second] if second else [])
    if noun.endswith("Gift Bag"):
        included = f"{colour} {noun.lower()}".strip()
    elif noun == "Window Gift Box":
        included = f"Folding gift box with a window, {option.lower()} design" if option else "Folding gift box with a window"
    elif noun == "Funnel":
        included = f"{option.lower()} funnel" if option else "Funnel"
    else:
        included = title.lower()
    if noun.startswith("Resealable"):
        included = "A packet of 100 resealable bags"
    bullets = [["Included", upper_first(included)]]
    if material:
        bullets.append(["Material", material])
    size = re.search(r"(\d[\d.]*\s*(?:\"|inches|in)?\s*[xX]\s*\d[\d.]*[^,.]*)", name)
    tech = {"size": size.group(1).strip() if size else "", "soldAs": f"1, 12 or 144 {count}"
            + (f"; a case holds {int(row['caseQuantity']):,}" if row.get("caseQuantity") else "")}
    c = Copy(websiteSku=sku, graceSku=row.get("graceSku") or "", mode="PACKAGING", family=noun, title=title, option=option,
             variantTitle=f"{title} - {option}" if option else title, sentences=sentences, bullets=bullets, care="",
             itemType=noun[:1] + noun[1:].lower(), metaDescription=" ".join(sentences), altText=name.lower()[:ALT_MAX],
             tech=tech, notes=notes)
    c.lint = lint(c)
    return c


# --------------------------------------------------------------------------- build


def build(item: fg.Item, fam: fg.Family, row: dict, flags: set[str]) -> Copy:
    body = fam.bodies[item.body]
    mode = mode_of(item, body, row)
    notes: list[str] = []
    title = title_of(item, body, row, mode, notes)
    option = option_of(item, mode)
    s = [sentence_one(item, body, mode)] + sentences_after(item, body, mode, flags)
    care = CARE.get(mode, "")
    if mode == "VIAL" and item.fitment == "Dropper":
        care = CARE["DROP"]
    bullets = [["Included", included_of(item, mode, flags)]]
    fits = fits_of(item, body, mode)
    if fits:
        bullets.append(["Fits", fits])
    bullets.append(list(glass_of(item, body, row, mode)))
    extra = good_to_know(item, body, mode, flags)
    if extra:
        bullets.append(["Good to know", extra])
    noun = MODES[mode][0]
    if mode == "VIAL" and item.fitment == "Dropper":
        noun = "Vial with Dropper"
    elif mode == "STOPPER" and family_word(item, body, mode) == "Apothecary":
        noun = "Apothecary Bottle with Glass Stopper"
    elif mode == "STOCK" and item.family == "Aluminum Bottle":
        noun = "Aluminum Stock Bottle"
    item_type = item_type_of(mode, noun, body)
    included = re.sub(r",? fitted.*$|, packed unattached.*$", "", bullets[0][1])
    neck = body.neck or ""
    an = re.match(r"(8|11|18)-", neck)  # "an 18-415 neck", "an 8-425 neck"
    neck_tail = f" on {'an' if an else 'a'} {neck} neck" if THREAD.match(neck) else ""
    meta = f"{s[0]} {included}{neck_tail}."
    if len(meta) > META_MAX:
        meta = s[0]
    # Alt text: "{capacity} {glass} glass {family} {type} with {included}", in lower case (COPY-STRATEGY.md §3.1)
    colour = colour_word(item, body, row, mode).lower()
    material = "" if not colour else colour if "plastic" in colour else f"{colour} glass"
    if mode == "ATOMIZER":
        material = f"{lower_first(finish_words(item))} metal"
    fam_word = family_word(item, body, mode).lower()
    alt_noun = ALT_NOUNS.get(mode, MODES[mode][1])
    if fam_word and fam_word in alt_noun:
        fam_word = ""
    alt = re.sub(r"\s+", " ", f"{capacity_text(item, body, with_oz=False)} {material} {fam_word} {alt_noun} with "
                                f"{lower_first(included)}").strip().lower()
    if len(alt) > ALT_MAX:
        alt = alt[:ALT_MAX].rsplit(" ", 1)[0]
    if item.status != "verified":
        notes.append(f"register status: {item.status}")
    copy = Copy(
        websiteSku=item.sku, graceSku=item.grace, mode=mode, family=item.family, title=title, option=option,
        variantTitle=f"{title} - {option}", sentences=s, bullets=bullets, care=care, itemType=item_type,
        metaDescription=meta, altText=alt, tech=tech_of(item, body, row, True), notes=notes,
    )
    copy.lint = lint(copy)
    return copy


def load_rows(export: Path) -> tuple[dict[str, dict], dict]:
    with gzip.open(export) if export.suffix == ".gz" else open(export) as fh:
        data = json.load(fh)
    rows = data["rows"] if isinstance(data, dict) and "rows" in data else data.get("products", data) if isinstance(data, dict) else data
    meta = {k: data.get(k) for k in ("collectedAt", "exportedAt", "deployment", "source")} if isinstance(data, dict) else {}
    return {r["websiteSku"]: r for r in rows if r.get("websiteSku")}, meta


def generate(export: Path) -> tuple[list[Copy], dict]:
    families, meta = fg.load(export)
    rows, emeta = load_rows(export)
    current = json.load(open(CURRENT))["byWebsiteSku"] if CURRENT.exists() else {}
    copies = []
    for fam in families.values():
        for item in fam.items:
            flags = legacy_flags(current.get(item.sku, {}).get("description", ""))
            copies.append(build(item, fam, rows.get(item.sku, {}), flags))
    copies.sort(key=lambda c: (fg.FAMILY_ORDER.index(c.family) if c.family in fg.FAMILY_ORDER else 99, c.title, c.option))
    parts = []
    for comp in csv.DictReader(open(fg.REGISTER / "components.csv")):
        if comp["sellable"] != "True" or comp["status"] != "current" or comp["websiteSku"] in fg.PART_EXCLUDE:
            continue
        part = build_part(comp, rows.get(comp["websiteSku"], {}), families)
        if part:
            parts.append(part)
    packaging = [c for c in (build_packaging(r) for r in meta.get("packaging", [])) if c]
    copies += sorted(parts, key=lambda c: (c.family, c.title, c.option)) + sorted(packaging, key=lambda c: (c.family, c.title, c.option))
    meta = {**{k: v for k, v in emeta.items() if v}, "skipped": meta.get("skipped")}
    return copies, meta


def report(copies: list[Copy], meta: dict, export: Path) -> str:
    modes = collections.Counter(c.mode for c in copies)
    failing = [c for c in copies if errors(c)]
    over = [c for c in copies if c.lint and not errors(c)]
    kinds = collections.Counter(re.sub(r"\d+", "N", f) for c in copies for f in c.lint)
    titles = collections.Counter()
    for c in copies:
        titles[c.title] += 1
    longest = sorted(copies, key=lambda c: -len(c.title))[:10]
    shortened = [c for c in copies if any(n.startswith("title:") for n in c.notes)]
    lines = [
        "# Product copy v2: generator report",
        "",
        f"Generated {dt.datetime.now():%Y-%m-%d %H:%M} from `{shown_path(export)}`"
        + (f" ({meta.get('deployment') or meta.get('source') or ''}, {meta.get('collectedAt') or meta.get('exportedAt') or ''})" if meta else "") + ".",
        "",
        f"- **Products:** {len(copies):,} ({sum(c.mode not in ('PART', 'PACKAGING') for c in copies):,} bottles and jars, "
        f"{sum(c.mode == 'PART' for c in copies):,} parts, {sum(c.mode == 'PACKAGING' for c in copies):,} packaging items), "
        f"in {len(titles):,} titles (product groups share a title).",
        f"- **Passing every check:** {len(copies) - len(failing) - len(over):,}. **With an error:** {len(failing):,}. "
        f"**Over a length target only:** {len(over):,}.",
        f"- **Skipped by the loader:** {meta.get('skipped')}.",
        "",
        "## By dispense mode",
        "",
        "| Mode | Products | Title noun |",
        "|---|---:|---|",
    ] + [f"| {m} | {n:,} | {MODES[m][0] if m in MODES else 'draft rules, by part or packaging kind'} |" for m, n in modes.most_common()] + [
        "",
        "## Findings",
        "",
        "| Finding | Products |",
        "|---|---:|",
    ] + [f"| {k} | {n:,} |" for k, n in kinds.most_common()] + [
        "",
        "## Titles shortened to fit 60 characters",
        "",
    ] + ([f"- `{c.websiteSku}`: {c.title} ({len(c.title)})" for c in shortened] or ["None."]) + [
        "",
        "## Longest titles",
        "",
    ] + [f"- {c.title} ({len(c.title)})" for c in longest] + [
        "",
        "## Products with findings",
        "",
    ] + ([f"- `{c.websiteSku}` ({c.mode}): {'; '.join(c.lint)}" for c in failing + over][:300] or ["None."]) + [""]
    return "\n".join(lines)


def latest_export() -> Path:
    exports = sorted((fg.REGISTER / "source").glob("convex-products-*.json.gz"))  # dated names sort by date
    if not exports:
        raise SystemExit("no convex-products-*.json.gz in data/register/source; pass --export")
    return exports[-1]


def shown_path(p: Path) -> str:
    """The export as recorded in the outputs: relative to the repository when it is inside it."""
    p = p.resolve()
    return str(p.relative_to(fg.ROOT)) if p.is_relative_to(fg.ROOT) else str(p)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", type=Path, help="default: the latest convex-products-*.json.gz in data/register/source")
    ap.add_argument("--sku", action="append")
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args()
    args.export = args.export or latest_export()
    copies, meta = generate(args.export)
    if args.sku:
        for c in copies:
            if c.websiteSku in args.sku:
                print(json.dumps(asdict(c), indent=1, ensure_ascii=False))
        return
    if args.no_write:
        print(report(copies, meta, args.export))
        return
    out = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": {"export": shown_path(args.export), **{k: v for k, v in meta.items() if k != "skipped"}},
        "rules": "docs/specs/pdp-item-descriptions (TEMPLATE.md amended 2026-09-28 and 2026-09-29; RUBRIC.md; COPY-STRATEGY.md)",
        "status": "full draft for the sample review; product-copy.site.json carries the products the site shows",
        "count": len(copies),
        "bySku": {c.websiteSku: asdict(c) for c in copies},
    }
    OUT_JSON.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    # The site file: only what the product page shows, for products that pass every check (errors fall back to today's copy)
    site = {
        "generatedAt": out["generatedAt"], "source": out["source"],
        "bySku": {c.websiteSku: {k: getattr(c, k) for k in SITE_FIELDS} for c in copies if not errors(c)},
        "graceToWebsite": {c.graceSku: c.websiteSku for c in copies if c.graceSku and not errors(c)},
    }
    OUT_SITE.write_text(json.dumps(site, ensure_ascii=False, separators=(",", ":")) + "\n")
    OUT_REPORT.write_text(report(copies, meta, args.export))
    failing = sum(1 for c in copies if errors(c))
    print(f"{OUT_JSON.relative_to(fg.ROOT)}: {len(copies)} products, {failing} with errors, "
          f"{sum(1 for c in copies if c.lint) - failing} over a length target")
    print(f"{OUT_REPORT.relative_to(fg.ROOT)}")


if __name__ == "__main__":
    main()
