#!/usr/bin/env python3
"""Build the component register: one source of truth for bottle bodies, components
and sellable assemblies, keyed by neck finish and graceSku.

Read-only against Convex. Inputs:
  1. A Convex product export (products:getProductExportPage) — raw, or the trimmed
     snapshot this script writes to data/register/source/.
  2. data/paper-doll/component-library-inventory.json — the master COMPONENT library
     (BB-PSD-Files-Master/20. Caps, 21. Tassels), foldered by neck finish.
  3. data/paper-doll/alias-map.json — website-SKU → PSD-stem spellings already approved.
  4. data/paper-doll/body-dims.csv — measured body dimensions per body key.
  5. data/register/source/neck-thread-2026-09-23/* — the per-neck review evidence behind
     the 23 Sep neck matrices (remedy registers, cap identity reviews, coverage tables).

Outputs (data/register/): bodies.csv, components.csv, assemblies.csv, rules.json,
quarantine.csv, report.md, and the trimmed export snapshot in source/.

Usage:
  python3 scripts/register/build_register.py --export <raw-or-trimmed-export.json>
  python3 scripts/register/build_register.py            # rebuild from the committed snapshot
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import difflib
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "data" / "register"
SOURCE = REGISTER / "source"
PAPER_DOLL = ROOT / "data" / "paper-doll"
def latest_snapshot() -> Path:
    """The newest dated Convex export in source/ (convex-products-<YYYY-MM-DD>.json.gz)."""
    found = sorted(SOURCE.glob("convex-products-*.json.gz"))
    return found[-1] if found else SOURCE / "convex-products-2026-09-24.json.gz"


SNAPSHOT = latest_snapshot()

BOTTLE_CATEGORIES = {"Glass Bottle", "Lotion Bottle", "Aluminum Bottle", "Plastic Bottle", "Roll-On Bottle", "Glass Jar", "Cream Jar", "Metal Atomizer"}
OUT_OF_SCOPE_CATEGORIES = {"Packaging", "Accessory"}
THREAD_RE = re.compile(r"^\d{1,2}-\d{3}$")
NON_THREAD_NECKS = {"16mm", "12mm", "17mm", "14.3mm"}

# Acceptance numbers printed on the 23 Sep 2026 neck matrices (dev Convex export of that day).
MATRIX_ACCEPTANCE = {
    "13-415": {"bodyFormats": 15, "glassRecords": 538, "retired": 31, "source": "13-415-neck-thread-matrix-17x11.pdf"},
    "17-415": {"assemblies": 145, "optionsPerGlass": 29, "glassFinishes": 5, "source": "17-415-neck-thread-matrix-17x11.pdf"},
    "18-415": {"bodyFormats": 22, "currentBottleRows": 1265, "componentRecords": 64, "outerVariants": 46, "source": "18-415-neck-thread-mini-catalog-2-page-17x11.pdf"},
    "20-400": {"bottles": 107, "components": 20, "source": "20-400-neck-thread-mini-catalog-2-page-17x11.pdf"},
    "16mm": {"assemblies": 8, "source": "remaining-neck-groups-mini-catalog-17x11.pdf"},
    "13-425": {"bottleRows": 16, "source": "small-format-neck-matrix-13-425-8-425-12mm-17x11.pdf"},
    "8-425": {"bottleRows": 4, "standaloneCaps": 5, "source": "small-format-neck-matrix-13-425-8-425-12mm-17x11.pdf"},
    "12mm": {"assemblies": 4, "source": "small-format-neck-matrix-13-425-8-425-12mm-17x11.pdf"},
}

# Rulings (Jordan, 2026-09-24). Complete products that were pasted into the shared 13-415
# component list, and body classes that never share components with glass bottles even when
# the neck finish matches: "these are actual bottles that are 13-415, but they're plastic
# bottles … not compatible with the other 13-415 components, so they should be in their own class."
COMPONENT_LIST_EXCLUSIONS = {
    "CMP-SPR-CLR-30ML": "PB1ozSpryNat — 1 oz plastic bottle with clear spray top; a product, not a component",
    "CMP-SPR-SLV-": "PB1ozSprySl — 1 oz plastic bottle with silver spray top; a product, not a component",
}
RULED_BODY_CLASSES = {
    "Plastic Bottle": ("plastic-bottle", "jordan-2026-09-24"),
    "Metal Atomizer": ("metal-atomizer", "jordan-2026-09-25"),
    "Aluminum Bottle": ("aluminum-bottle", "jordan-2026-09-25"),
    "Glass Jar": ("glass-jar", "jordan-2026-09-25"),
    "Cream Jar": ("cream-jar", "jordan-2026-09-25"),
}
RULINGS = [
    {"date": "2026-09-25", "by": "Jordan", "rule": "Atomizers, aluminium bottles and jars are each their own compatibility class, like plastic bottles: a matching neck finish does not make glass-bottle components compatible with them.",
     "applies": "bodies.compatibilityClass = metal-atomizer | aluminum-bottle | glass-jar | cream-jar; their listed glass components are not resolved"},
    {"date": "2026-09-24", "by": "Jordan", "rule": "Plastic bottles are their own compatibility class. A 13-415 neck on a plastic bottle does not make the 13-415 glass-bottle components compatible with it, nor it with them.",
     "applies": "bodies.compatibilityClass = plastic-bottle; their listed glass components are not resolved"},
    {"date": "2026-09-24", "by": "Jordan", "rule": "CMP-SPR-CLR-30ML (PB1ozSpryNat) and CMP-SPR-SLV- (PB1ozSprySl) are plastic bottles, not components; remove them from every component list.",
     "applies": "assemblies: excluded from listed components before resolution (494 13-415 lists carried them)"},
]


# Parts that are not products (Jordan 2026-09-25): keyed LIB-<neck>-<name>, graceSku empty, never sold alone.
# psdStem names the master COMPONENT library layer; None = no master yet, cut from the productKits roller
# layers in Phase 3 (the cobalt 9 mL metal roller layer carries a white fill and is not a valid source).
LIBRARY_PARTS = [
    {"componentId": "LIB-13-415-MtlRollon", "type": "roller-insert", "neck": "13-415", "rollerMaterial": "metal", "psdStem": "13-415MtlRollon", "itemName": "Metal roller-ball insert, 13-415"},
    {"componentId": "LIB-13-415-PlsticRollon", "type": "roller-insert", "neck": "13-415", "rollerMaterial": "plastic", "psdStem": "13-415PlsticRollon", "itemName": "Plastic roller-ball insert, 13-415"},
    {"componentId": "LIB-17-415-MtlRollon", "type": "roller-insert", "neck": "17-415", "rollerMaterial": "metal", "psdStem": None, "itemName": "Metal roller-ball insert, 17-415"},
    {"componentId": "LIB-17-415-PlsticRollon", "type": "roller-insert", "neck": "17-415", "rollerMaterial": "plastic", "psdStem": None, "itemName": "Plastic roller-ball insert, 17-415"},
    {"componentId": "LIB-18-415-Reducer", "type": "reducer", "neck": "18-415", "rollerMaterial": "", "psdStem": "415Reducer", "itemName": "Orifice reducer, 18-415"},
    # The Tola plug (Jordan 2026-09-25: the plug needs to be separate from the glass). No library PSD: its layers are
    # cut from the Tola master photo by scripts/register/bodies/build_bodies.py (plug_layers).
    {"componentId": "LIB-14.3mm-Plug", "type": "plug-applicator", "neck": "14.3mm", "rollerMaterial": "", "psdStem": None, "itemName": "Plug, 14.3 mm (Tola)",
     "evidence": "library part, not a product (Jordan 2026-09-25); cut from the Tola master photo, GB3TPlGl.psd", "source": "Tola master photo (build_bodies.py plug_layers)"},
]

# Own-part builds: which component(s) a sellable assembly is physically made of. Rules are validated neck by
# neck; the pilot neck is 17-415 (2026-09-25). Other necks record why they are not built yet.
BUILD_RULE_NECKS = {"13-415", "17-415", "18-415", "14.3mm"}
FITMENT_BUILD = {  # fitmentType -> (component type, kit slot, roller material)
    "Metal Roller Ball": ("roll-on-cap", "cap", "metal"),
    "Plastic Roller Ball": ("roll-on-cap", "cap", "plastic"),
    "Fine Mist Sprayer": ("fine-mist-sprayer", "sprayer", None),
    "Lotion Pump": ("lotion-pump", "pump", None),
}
GLASS_COLOURS = {"clear", "amber", "cobalt blue", "frosted", "swirl", "blue", "green"}

# 18-415 (2026-09-25): every sold SKU spells its own top in its website SKU — `GBDiva46AnSpTslMtSl` is the
# Diva 46 with the tassel bulb sprayer `AnSpTsl18-415MtS`. The code after the type token is matched
# against the component's own website SKU, which is more reliable than the Convex capColor field (it
# leaks the glass colour on the vintage sprayers and the leather caps lose their "Light"). A Reducer SKU
# is the cap it is sold with: the orifice reducer sits inside the neck under the cap, the page keeps that
# closure assembled, so the reducer insert is not part of the drawn build. Lotion pumps sold "with clear
# overcap" (ClOvrCap) are the matte-silver pump under a clear overcap, `Ltn18-415MtSlCl`.
SKU_TAIL_18415 = [  # (type token in the assembly SKU, component types it names, kit slot)
    ("AnSpTsl", ("tassel-bulb-sprayer",), "sprayer"),
    ("AnSp", ("vintage-bulb-sprayer",), "sprayer"),
    ("Spry", ("fine-mist-sprayer",), "sprayer"),
    ("Ltn", ("lotion-pump",), "pump"),
    ("Drp", ("dropper",), "fitment"),
    ("Rdcr", ("cap", "faux-leather-cap"), "cap"),
]
COMPONENT_STEM_18415 = ("CP18-415AnSpTsl", "CP18-415AnSp", "AnSpTsl18-415", "AnSp18-415", "Spry18-415", "Ltn18-415", "Drp18-415", "CP18-415")
CODE_ALIASES_18415 = {"clovrcap": "mtslcl", "wht": "wh", "mts": "mtsl", "ivylthr": "livylthr", "pnklthr": "lpnklthr"}  # the ivory and pink leather caps are filed as CP18-415LIvyLthr / LPnkLthr


def code_key(code: str) -> str:
    lowered = code.lower()
    return CODE_ALIASES_18415.get(lowered, lowered)


def own_build_18415(assembly: dict, by_neck_type: dict) -> tuple[str, str, str]:
    """18-415 own parts from the website SKU's type token and finish code (see SKU_TAIL_18415)."""
    sku = assembly["websiteSku"] or ""
    for token, ctypes, slot in SKU_TAIL_18415:
        at = sku.find(token)
        if at < 0:
            continue
        code = sku[at + len(token):]
        pool = [c for t in ctypes for c in by_neck_type.get(("18-415", t), [])]
        matches = []
        for c in pool:
            stem = c["websiteSku"] or ""
            for prefix in COMPONENT_STEM_18415:
                if stem.startswith(prefix):
                    stem = stem[len(prefix):]
                    break
            if code_key(stem) == code_key(code):
                matches.append(c)
        if len(matches) == 1:
            note = " (the orifice reducer sits under the cap; the closure stays assembled)" if token == "Rdcr" else ""
            return f"{slot}:{matches[0]['componentId']}", "resolved", f"own {matches[0]['type']} matched by SKU code '{code}'{note}"
        if len(matches) > 1:
            return "", "unresolved", f"SKU code '{code}' matches {len(matches)} components: " + ", ".join(c["componentId"] for c in matches)
        return "", "unresolved", f"no current 18-415 {'/'.join(ctypes)} carries the SKU code '{code}'"
    return "", "unresolved", f"website SKU '{sku}' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr)"


# 13-415 (2026-09-26): the same method as 18-415. The website SKU spells the top after the body code:
# `GBCrcl15MtlRollBlkSh` is the Circle 15 with a metal roller under the shiny black roll-on cap `CPRoll13-415BlkSh`,
# `GBCrcl15SpryGlSh` carries the sprayer `CP13-415SpryGlSh`, and a SKU with no type token names its plain cap
# (`GBCrcl15BlkSht` -> `CP13-415BlkSht`, the short ribbed black cap; `Gl` / `Sl` are the tall shiny caps). The
# assembly SKUs spell matte "Matt" where the components spell "Mt"; the roll-on caps file matte copper as "Cu" and the
# black dotted cap as "BlackDot". The roller insert is the library part for the SKU's roller material.
SKU_TAIL_13415 = [  # (type token in the assembly SKU, component stem prefix, kit slot, roller insert)
    ("MtlRoll", "CPRoll13-415", "cap", "LIB-13-415-MtlRollon"),
    ("Roll", "CPRoll13-415", "cap", "LIB-13-415-PlsticRollon"),
    ("Spry", "CP13-415Spry", "sprayer", None),
]
CODE_ALIASES_13415 = {"cu": "cumt", "blackdot": "blkdot", "pinkdo": "pinkdot"}  # "PinkDo": GBTallRect10MtlRollPinkDo, a truncated website SKU


def code_key_13415(code: str) -> str:
    lowered = code.lower().replace("matt", "mt")
    return CODE_ALIASES_13415.get(lowered, lowered)


def own_build_13415(assembly: dict, by_neck_type: dict, library_ids: set) -> tuple[str, str, str]:
    """13-415 own parts from the website SKU's type token and finish code (see SKU_TAIL_13415)."""
    sku = assembly["websiteSku"] or ""
    current = [c for (neck, _), cs in by_neck_type.items() if neck == "13-415" for c in cs if c["websiteSku"]]

    def stem_matches(prefix: str, code: str, exclude: tuple = ()) -> list:
        out = []
        for c in current:
            stem = c["websiteSku"]
            if not stem.startswith(prefix) or any(stem.startswith(x) for x in exclude):
                continue
            if code_key_13415(stem[len(prefix):]) == code_key_13415(code):
                out.append(c)
        return out

    for token, prefix, slot, insert in SKU_TAIL_13415:
        at = sku.find(token)
        if at < 0:
            continue
        code = sku[at + len(token):]
        matches = stem_matches(prefix, code)
        if len(matches) != 1:
            why = f"{len(matches)} components match" if matches else "no current 13-415 component carries"
            return "", "unresolved", f"{why} the SKU code '{code}' after '{token}' ({prefix}...)"
        parts = []
        if insert:
            if insert not in library_ids:
                return "", "partial", f"{matches[0]['componentId']} found; {insert} is not registered"
            parts.append(f"roller:{insert}")
        parts.append(f"{slot}:{matches[0]['componentId']}")
        return "; ".join(parts), "resolved", f"own {matches[0]['type']} matched by SKU code '{code}'"
    tail = re.match(r"^GB[A-Za-z]+?\d+(?:o\d+)?(?P<code>[A-Za-z]*)$", sku)
    code = tail.group("code") if tail else ""
    if not code:
        return "", "unresolved", f"website SKU '{sku}' names no 13-415 top (MtlRoll, Roll, Spry or a cap code)"
    matches = stem_matches("CP13-415", code, exclude=("CP13-415Spry",))
    if len(matches) == 1:
        return f"cap:{matches[0]['componentId']}", "resolved", f"own cap matched by SKU code '{code}'"
    if matches:
        return "", "unresolved", f"SKU code '{code}' matches {len(matches)} caps: " + ", ".join(c["componentId"] for c in matches)
    return "", "unresolved", f"no current 13-415 cap carries the SKU code '{code}' (no component record and no master photo)"


def colour_key(text: str) -> tuple[str, bool]:
    """(base colour, dotted). 'Black with Dots' and 'Black Dotted' -> ('black', True); 'Matte Copper' -> ('matte copper', False)."""
    lowered = (text or "").lower()
    dotted = bool(re.search(r"\bdot(s|ted)?\b", lowered))
    base = re.sub(r"\bwith\s+dots\b", " ", lowered)  # canonical: "Black with Dots" (src/lib/catalogFilters.ts)
    base = re.sub(r"\s+", " ", re.sub(r"\b(dotted|dots|dot|cap)\b", " ", base)).strip()
    return base, dotted


def own_build(assembly: dict, body_class: str, by_neck_type: dict, library_ids: set) -> tuple[str, str, str]:
    """(buildParts, buildStatus, buildReason) for one assembly. Never guesses: a part must match uniquely."""
    neck, fitment, cap_colour = assembly["neck"], assembly["fitmentType"], assembly["capColor"]
    if assembly["status"] not in ("verified", "candidate"):
        return "", "unresolved", f"not composable: assembly status is {assembly['status']}"
    if not body_class.startswith("glass-"):
        return "", "unresolved", f"own class {body_class}: no components ruled compatible"
    if neck not in BUILD_RULE_NECKS:
        return "", "unresolved", f"own-part rules not written for {neck or 'no neck'} yet (pilot neck is 17-415)"
    if neck == "18-415":
        return own_build_18415(assembly, by_neck_type)
    if neck == "13-415":
        return own_build_13415(assembly, by_neck_type, library_ids)
    if neck == "14.3mm":
        # The Tola decorative bottles are sold with one closure, the plug photographed in their neck (Jordan 2026-09-25).
        if "LIB-14.3mm-Plug" not in library_ids:
            return "", "partial", "no plug registered for 14.3mm"
        return "cap:LIB-14.3mm-Plug", "resolved", "the 14.3 mm plug: the one closure sold on the Tola neck, cut from the bottle photo"
    rule = FITMENT_BUILD.get(fitment)
    if not rule:
        return "", "unresolved", f"no own-part rule for fitment '{fitment or 'none'}'"
    ctype, slot, material = rule
    base, dotted = colour_key(cap_colour)
    dotted = dotted or "dot" in (assembly["capStyle"] or "").lower()
    pool = [c for c in by_neck_type.get((neck, ctype), []) if c["dotted"] == dotted]
    exact = [c for c in pool if colour_key(c["capColor"])[0] == base]
    family = [c for c in pool if base and colour_key(c["capColor"])[0].split(" ")[-1:] == base.split(" ")[-1:]]
    match, how = (exact, "type + colour") if exact else (family, "colour family")
    if len(match) != 1:
        if base in GLASS_COLOURS:
            why = f"capColor '{cap_colour}' repeats a glass colour; the Convex row needs its real cap colour"
        elif match:
            why = f"{len(match)} {ctype} components match '{cap_colour}': " + ", ".join(c["componentId"] for c in match)
        else:
            why = f"no current {neck} {ctype} matches capColor '{cap_colour}'" + (f" with capStyle '{assembly['capStyle']}'" if assembly["capStyle"] else "")
        return "", "unresolved", why
    parts = []
    if material:
        insert = f"LIB-{neck}-{'MtlRollon' if material == 'metal' else 'PlsticRollon'}"
        if insert not in library_ids:
            return "", "partial", f"cap {match[0]['componentId']} found; no {material} roller insert registered for {neck}"
        parts.append(f"roller:{insert}")
    parts.append(f"{slot}:{match[0]['componentId']}")
    note = "" if how == "type + colour" else f" ('{cap_colour}' ~ '{match[0]['capColor']}')"
    return "; ".join(parts), "resolved", f"own {ctype} matched by {how}{note}"


def compatibility_class(row: dict) -> tuple[str, str]:
    """(class, source). Glass bottles share components by neck finish; ruled classes stand alone;
    other non-glass categories stand alone by assumption until ruled."""
    category = row.get("category") or ""
    neck = norm_neck(row.get("neckThreadSize"))
    if category in ("Glass Bottle", "Lotion Bottle"):
        return f"glass-{neck or 'no-neck'}", "glass shares components by neck finish"
    if category in RULED_BODY_CLASSES:
        return RULED_BODY_CLASSES[category]
    return slug(category) or "unclassified", "assumed-by-category (not yet ruled)"


# Rules the matrices state that the data alone does not: keep them explicit and sourced.
NECK_RULES = {
    "13-415": {"notes": ["Roller insert (plastic or metal ball) is a separate part beneath the roll-on cap; inserts have no standalone component rows.",
                          "Short ribbed caps (black, white), short lined metal caps (6) and tall 24 mm liner caps (gold, silver) are separate options; tall liner caps are not roll-on caps.",
                          "The 1 oz plastic spray bottles (PB1ozSpryNat, PB1ozSprySl) carry a 13-415 neck but are their own class: no 13-415 glass component fits them (Jordan, 2026-09-24)."]},
    "17-415": {"notes": ["Assembly paths: ROLLER = one insert + one of 10 outer caps; SPRAY = one of 6 fine-mist finishes; PUMP = one of 3 treatment finishes.",
                          "10 caps × 2 roller materials + 6 sprayers + 3 pumps = 29 options per glass finish."]},
    "18-415": {"notes": ["Reducer is an insert beneath reducer-plus-cap assemblies, not a cap finish.",
                          "GBSpry1ozGl and GBSpry1ozSl (30 mL Cylinder) are fixed top-and-base spray products: they do not inherit the 25/50/100 mL Cylinder component choices."],
               "exceptions": ["GBSpry1ozGl", "GBSpry1ozSl"]},
    "20-400": {"notes": ["A roll-on needs the outer cap AND a plastic or metal roller plug; plugs have no standalone component rows.",
                          "Dropper glass stem: 76 mm on 30 mL, 90 mm on 60 mL; one finish photo is reused across both lengths but the component SKU and stem differ."],
               "dropperStemMm": {"30": 76, "60": 90}},
    "16mm": {"notes": ["Jumbo roller: 28 mL and 50 mL Cylinder, plastic or metal ball, black or white cap; 8 exact sold assemblies; component lists are empty in Convex."]},
    "13-425": {"notes": ["Small vials 2/3/4 mL; cap-coded component IDs link to unrelated items (conflict); blue 5/8-dram is bucketed as 3 mL by Convex though the source says 2 mL.",
                          "14-425 has no current bottle or component records — never merge it into 13-425."]},
    "8-425": {"notes": ["2 mL vials; five standalone caps; a separate vial thread from 13-425. The PSD library folders spell it 8-245 (digit transposition)."]},
    "12mm": {"notes": ["3/4 mL Cylinder sprays, black or white; assembled rows only, no standalone 12 mm components."]},
}


def slug(value) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")


def norm_neck(value) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def mm(value):
    if value is None or value == "":
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", str(value))
    return float(match.group()) if match else None


def cap_label(capacity) -> str:
    try:
        number = float(capacity)
    except (TypeError, ValueError):
        return ""
    return str(int(number)) if number.is_integer() else str(number)


def is_retired(row: dict) -> bool:
    return "__RETIRED__" in (row.get("websiteSku") or "") or "__RETIRED__" in (row.get("graceSku") or "")


def mode(values):
    values = [v for v in values if v is not None]
    return Counter(values).most_common(1)[0][0] if values else None


def thread_like(neck: str) -> bool:
    return bool(THREAD_RE.match(neck)) or neck in NON_THREAD_NECKS


def load_export(path: Path) -> dict:
    data = json.loads(gzip.decompress(path.read_bytes()).decode() if path.suffix == ".gz" else path.read_text())
    for row in data["rows"]:
        components = row.get("components")
        if isinstance(components, list):  # trim nested component dicts to graceSku lists
            row["components"] = [c.get("grace_sku") if isinstance(c, dict) else c for c in components]
    return data


def write_snapshot(data: dict, path: Path) -> None:
    keep = ["websiteSku", "graceSku", "itemName", "family", "bottleCollection", "category", "shape", "capacityMl", "capacityOz",
            "neckThreadSize", "applicator", "assemblyType", "fitmentStatus", "color", "capColor", "capStyle", "trimColor", "components",
            "productGroupId", "productGroupSlug", "imageUrlCapOff", "productUrl", "stockStatus", "verified", "dataGrade",
            "heightWithoutCap", "heightWithCap", "widthMm", "depthMm", "diameter", "caseQuantity", "webPrice1pc", "shopifyVariantId"]
    rows = [{k: r.get(k) for k in keep if k in r and r.get(k) not in (None, "", [])} for r in data["rows"]]
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({
        "collectedAt": data.get("collectedAt"), "source": data.get("source"), "deployment": data.get("deployment", "dev:helpful-elephant-638"),
        "action": "products:getProductExportPage", "note": "components trimmed to grace_sku lists; empty fields omitted", "fields": keep, "rows": rows,
    }, separators=(",", ":"), sort_keys=True) + "\n"
    path.write_bytes(gzip.compress(payload.encode(), mtime=0))


# A graceSku (CMP-CAP-BLK-18415-LTR, GB-CYL-CLR-9ML-MRL-BLK). A bare word like "Sprayer" is a type label, not a SKU.
GRACE_SKU_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]*)+$")


def stem_tokens(stem: str) -> tuple:
    """Spelling tokens for alias candidates: camel-case, digit and separator boundaries, lower-cased, 'cp' prefix dropped."""
    tokens = [t.lower() for t in re.findall(r"[A-Z][a-z]+|[a-z]+|[A-Z]+(?![a-z])|\d+", stem)]
    if tokens and tokens[0] == "cp":
        tokens = tokens[1:]
    return tuple(sorted(tokens))


def component_type(row: dict) -> tuple[str, str]:
    """(type, evidence). Convex family is the primary signal; the website SKU splits sprayer kinds."""
    family = row.get("family") or ""
    sku = (row.get("websiteSku") or "").lower()
    name = (row.get("itemName") or "").lower()
    if family == "Sprayer":
        # "Tsl" is matched case-sensitively: lower-casing turns "MattSl" into "mattsl", which reads as a tassel.
        if "Tsl" in (row.get("websiteSku") or "") or "tassel" in name:
            return "tassel-bulb-sprayer", "family=Sprayer; SKU/name says tassel"
        if "ansp" in sku or "bulb" in name:
            return "vintage-bulb-sprayer", "family=Sprayer; SKU/name says bulb"
        if sku.startswith("spry") or "mist" in name or "spray" in name:
            return "fine-mist-sprayer", "family=Sprayer"
        return "sprayer-review", "family=Sprayer but the SKU pattern is unrecognised"
    if family == "Roll-On Cap":
        if sku.startswith("ltn") or "lotion" in name or (row.get("capStyle") or "") == "Pump":
            return "lotion-pump", "family=Roll-On Cap but SKU/capStyle says lotion pump"
        return "roll-on-cap", "family=Roll-On Cap"
    if family == "Cap/Closure":
        # The 13-415 sprayers are filed as Cap/Closure (CP13-415SpryBlkMt, applicator Fine Mist Sprayer): the SKU names the sprayer.
        if "Spry" in (row.get("websiteSku") or "") and (row.get("applicator") or "") == "Fine Mist Sprayer":
            return "fine-mist-sprayer", "family=Cap/Closure but the SKU (Spry) and applicator name a fine-mist sprayer"
        if "lthr" in sku or "leather" in name:
            return "faux-leather-cap", "family=Cap/Closure; leather"
        if "rdcr" in sku or "reducer" in name:
            return "reducer", "family=Cap/Closure; reducer"
        return "cap", "family=Cap/Closure"
    if family == "Dropper":
        return "dropper", "family=Dropper"
    if family == "Lotion Pump":
        return "lotion-pump", "family=Lotion Pump"
    if family == "Plug/Applicator":
        return "plug-applicator", "family=Plug/Applicator"
    if family == "Cap/Component":
        return "cap-review", "family=Cap/Component (alias-looking record)"
    return "review", f"family={family or 'none'} is not a component family"


def finish_label(row: dict) -> str:
    return (row.get("capColor") or row.get("color") or row.get("trimColor") or "").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--export", type=Path, default=SNAPSHOT, help="raw or trimmed Convex export JSON")
    args = parser.parse_args()

    data = load_export(args.export)
    snapshot = args.export
    if args.export.parent.resolve() != SOURCE.resolve():
        stamp = str(data.get("collectedAt") or dt.date.today().isoformat())[:10]
        snapshot = SOURCE / f"convex-products-{stamp}.json.gz"
        write_snapshot(data, snapshot)
    rows = data["rows"]
    today = dt.date.today().isoformat()
    export_note = f"convex:products (dev) {snapshot.name.removeprefix('convex-products-').removesuffix('.json.gz')}"

    library_rows = json.loads((PAPER_DOLL / "component-library-inventory.json").read_text())["rows"]
    by_stem = {r["stem"]: r for r in library_rows}
    by_stem_lower: dict[str, dict] = {}
    for r in library_rows:
        by_stem_lower.setdefault(r["stem"].lower(), r)
    alias_map = {k: v for k, v in json.loads((PAPER_DOLL / "alias-map.json").read_text()).items() if not k.startswith("_")}
    body_dims = {r["body_key"]: r for r in csv.DictReader((PAPER_DOLL / "body-dims.csv").open())}

    review_items = []
    for folder in sorted(SOURCE.glob("neck-thread-2026-09-23/*")):
        neck = folder.name.replace("neck-thread-", "").replace("-2026-09-23", "").replace("-reference", "")
        for name in ("component-remedy-register.csv", "cap-identity-review.csv", "review-issues.csv"):
            path = folder / name
            if path.exists():
                for item in csv.DictReader(path.open()):
                    review_items.append({"neck": neck, "file": f"{folder.name}/{name}", **item})

    # ---------- components ----------
    components, component_by_grace = [], {}
    for r in sorted((r for r in rows if r.get("category") == "Component"),
                    key=lambda x: (norm_neck(x.get("neckThreadSize")), x.get("family") or "", x.get("websiteSku") or "")):
        sku = r.get("websiteSku") or ""
        neck = norm_neck(r.get("neckThreadSize"))
        ctype, why = component_type(r)
        stem = alias_map.get(sku, sku)
        psd = by_stem.get(stem) or by_stem_lower.get(stem.lower())
        psd_match = "" if not psd else "exact" if psd["stem"] == sku else "alias-map" if stem != sku else "case-insensitive"
        status = "retired" if is_retired(r) else "quarantine" if ctype.endswith("review") or not thread_like(neck) else "current"
        record = {
            "componentId": r.get("graceSku"), "sellable": True,
            "graceSku": r.get("graceSku"), "websiteSku": sku, "type": ctype, "neck": neck, "finish": finish_label(r),
            "capColor": r.get("capColor") or "", "capStyle": r.get("capStyle") or "", "color": r.get("color") or "", "trimColor": r.get("trimColor") or "",
            "applicator": r.get("applicator") or "", "convexFamily": r.get("family") or "", "itemName": r.get("itemName") or "",
            "status": status, "typeEvidence": why,
            "dotted": "dot" in sku.lower() or colour_key(r.get("capColor") or "")[1], "rollerMaterial": "",
            "psdStem": psd["stem"] if psd else "", "psdLibrary": psd["library"] if psd else "", "psdPath": psd["file"] if psd else "", "psdFolder": psd["folder"] if psd else "",
            "psdMatch": psd_match, "psdCanvas": psd["canvas"] if psd else "", "psdHiddenLayers": psd["hiddenLayers"] if psd else "",
            "stockStatus": r.get("stockStatus") or "", "imageUrl": r.get("imageUrl") or "", "productUrl": r.get("productUrl") or "",
            "source": export_note, "confidence": "high" if psd and status == "current" else "medium" if status == "current" else "low",
        }
        components.append(record)
        if record["graceSku"]:
            component_by_grace[record["graceSku"]] = record
    for part in LIBRARY_PARTS:
        psd = by_stem.get(part["psdStem"]) if part["psdStem"] else None
        components.append({
            "componentId": part["componentId"], "sellable": False, "graceSku": "", "websiteSku": "", "type": part["type"], "neck": part["neck"],
            "finish": "", "capColor": "", "capStyle": "", "color": "", "trimColor": "", "applicator": "", "convexFamily": "", "itemName": part["itemName"],
            "status": "current",
            "typeEvidence": part.get("evidence") or ("library part, not a product (Jordan 2026-09-25)" + ("" if psd else "; no master PSD yet, cut from productKits roller layers in Phase 3")),
            "dotted": False, "rollerMaterial": part["rollerMaterial"],
            "psdStem": psd["stem"] if psd else "", "psdLibrary": psd["library"] if psd else "", "psdPath": psd["file"] if psd else "", "psdFolder": psd["folder"] if psd else "",
            "psdMatch": "exact" if psd else "", "psdCanvas": psd["canvas"] if psd else "", "psdHiddenLayers": psd["hiddenLayers"] if psd else "",
            "stockStatus": "", "imageUrl": "", "productUrl": "",
            "source": part.get("source") or ("BB-PSD-Files-Master/20. Caps" if psd else "productKits roller layers (Phase 3)"), "confidence": "high" if psd else "medium",
        })
    library_ids = {part["componentId"] for part in LIBRARY_PARTS}
    by_neck_type: dict[tuple, list] = defaultdict(list)
    for c in components:
        if c["status"] == "current":
            by_neck_type[(c["neck"], c["type"])].append(c)

    # ---------- bodies ----------
    bottle_rows = [r for r in rows if r.get("category") in BOTTLE_CATEGORIES]
    groups: dict[str, list] = defaultdict(list)
    builder_ids: dict[str, str] = {}
    body_of_row: dict[str, str] = {}
    for r in bottle_rows:
        cap = cap_label(r.get("capacityMl"))
        neck = norm_neck(r.get("neckThreadSize"))
        family = r.get("family") or ""
        pgs = r.get("productGroupSlug") or ""
        marker = f"-{cap}ml-"
        profile = pgs.split(marker)[0] if cap and marker in pgs else slug(family)
        shape = r.get("shape") or ""
        distinct_shape = slug(shape) if shape and slug(shape) not in ("standard", slug(family), slug(r.get("color"))) else ""
        body_id = f"{distinct_shape + '-' if distinct_shape else ''}{profile}-{cap}ml-{neck or 'no-neck'}"
        groups[body_id].append(r)
        builder_ids[body_id] = f"{profile}-{cap}ml|{neck}|{r.get('category')}" + (f"|{distinct_shape}" if distinct_shape else "")
        body_of_row[r.get("graceSku")] = body_id
    bodies = []
    for body_id, members in sorted(groups.items(), key=lambda kv: (norm_neck(kv[1][0].get("neckThreadSize")), kv[1][0].get("family") or "", float(kv[1][0].get("capacityMl") or 0))):
        current = [m for m in members if not is_retired(m)]
        first = members[0]
        neck = norm_neck(first.get("neckThreadSize"))
        cap = cap_label(first.get("capacityMl"))
        dims = body_dims.get(f"{slug(first.get('family'))}-{cap}ml-{neck}", {})
        representative = sorted(current or members, key=lambda m: (m.get("stockStatus") != "In Stock", m.get("graceSku") or ""))[0]
        cap_off = [m.get("imageUrlCapOff") for m in current if m.get("imageUrlCapOff")]
        body_class, class_source = compatibility_class(first)
        bodies.append({
            "bodyId": body_id, "builderBodyId": builder_ids[body_id], "family": first.get("family") or "", "shape": first.get("shape") or "",
            "capacityMl": cap, "neck": neck, "category": first.get("category") or "",
            "compatibilityClass": body_class, "classSource": class_source,
            "glassVariants": "; ".join(sorted({m.get("color") or "" for m in current} - {""})),
            "currentRecords": len(current), "retiredRecords": len(members) - len(current),
            "fitmentTypes": "; ".join(sorted({m.get("applicator") or "" for m in current} - {""})),
            "heightWithoutCapMm": mode(mm(m.get("heightWithoutCap")) for m in current) or "",
            "widthMm": mode(mm(m.get("widthMm")) for m in current) or "", "diameterMm": mode(mm(m.get("diameter")) for m in current) or "",
            "dimsHeightBareMm": dims.get("height_bare_mm", ""), "dimsDiameterMm": dims.get("diameter_mm", "") or dims.get("width_mm", ""),
            "dimsConfidence": dims.get("dims_confidence", ""), "dimsSource": dims.get("dims_source", ""),
            "representativeGraceSku": representative.get("graceSku") or "", "representativeWebsiteSku": representative.get("websiteSku") or "",
            "capOffPlateRecords": len(cap_off), "capOffPlateExample": cap_off[0] if cap_off else "",
            "status": "current" if current else "retired", "neckStatus": "thread" if THREAD_RE.match(neck) else "non-thread" if neck else "missing",
            "notes": "matrix exception: fixed top-and-base spray pair, not an interchangeable body" if members and all((m.get("websiteSku") or "") in {s for rule in NECK_RULES.values() for s in rule.get("exceptions", [])} for m in members) else "",
            "source": export_note, "confidence": "high" if THREAD_RE.match(neck) and current else "low",
        })
    body_by_id = {b["bodyId"]: b for b in bodies}

    # ---------- assemblies ----------
    exceptions = {sku for rule in NECK_RULES.values() for sku in rule.get("exceptions", [])}
    row_by_grace = {r.get("graceSku"): r for r in rows if r.get("graceSku")}
    assemblies = []
    for r in sorted(bottle_rows, key=lambda x: (norm_neck(x.get("neckThreadSize")), x.get("family") or "", float(x.get("capacityMl") or 0), x.get("graceSku") or "")):
        neck = norm_neck(r.get("neckThreadSize"))
        body_class, _ = compatibility_class(r)
        raw_listed = [c for c in (r.get("components") or []) if c]
        excluded = [c for c in raw_listed if c in COMPONENT_LIST_EXCLUSIONS]
        listed = [c for c in raw_listed if c not in COMPONENT_LIST_EXCLUSIONS]
        isolated = body_class in {cls for cls, _ in RULED_BODY_CLASSES.values()}
        resolved, foreign, misfiled, labels, unknown = [], [], [], [], []
        for c in ([] if isolated else listed):
            comp = component_by_grace.get(c)
            if comp:
                (foreign if comp["neck"] and neck and comp["neck"] != neck else resolved).append(f"{c}@{comp['neck']}" if comp["neck"] and neck and comp["neck"] != neck else c)
            elif c in row_by_grace:
                misfiled.append(f"{c} ({row_by_grace[c].get('category')})")
            elif not GRACE_SKU_RE.match(c):
                labels.append(c)
            else:
                unknown.append(c)
        if is_retired(r):
            status, reason = "retired", "websiteSku carries __RETIRED__"
        elif r.get("websiteSku") in exceptions:
            status, reason = "exception", "fixed top-and-base product (matrix rule); not an interchangeable assembly"
        elif not neck:
            status, reason = "quarantine", "no neck finish on the record"
        elif not thread_like(neck):
            status, reason = "quarantine", f"non-thread neck '{neck}' — classify before composing"
        elif foreign:
            status, reason = "quarantine", f"component on another neck: {', '.join(foreign)}"
        elif isolated:
            status, reason = "candidate", f"own class ({body_class}): " + (f"the {len(listed)} listed {neck} glass components are not compatible (ruling 2026-09-24)" if listed else "no components ruled compatible yet")
        elif listed and not (unknown or misfiled or labels):
            status, reason = "verified", "every listed component resolves to a component record on the same neck" + (f"; {len(excluded)} pasted product(s) excluded by rule" if excluded else "")
        elif listed:
            problems = []
            if labels:
                problems.append(f"component list holds type labels, not SKUs: {', '.join(labels)}")
            if misfiled:
                problems.append(f"listed component is not a Component row: {', '.join(misfiled)}")
            if unknown:
                problems.append(f"no record for: {', '.join(unknown)}")
            status, reason = "candidate", "; ".join(problems)
        else:
            status, reason = "candidate", "no component list on the record; thread match only"
        assemblies.append({
            "graceSku": r.get("graceSku"), "websiteSku": r.get("websiteSku") or "", "bodyId": body_of_row[r.get("graceSku")], "neck": neck,
            "category": r.get("category") or "", "compatibilityClass": body_class, "glass": r.get("color") or "", "fitmentType": r.get("applicator") or "", "capColor": r.get("capColor") or "", "capStyle": r.get("capStyle") or "",
            "assemblyType": r.get("assemblyType") or "", "listedComponentCount": len(listed), "excludedByRule": "; ".join(excluded), "resolvedComponents": "; ".join(resolved),
            "unresolvedComponents": "; ".join(unknown + misfiled + labels + foreign), "status": status, "statusReason": reason,
            "stockStatus": r.get("stockStatus") or "", "verified": "" if r.get("verified") is None else r.get("verified"),
            "capOffPlate": r.get("imageUrlCapOff") or "", "productUrl": r.get("productUrl") or "",
            "source": export_note, "confidence": {"verified": "high", "candidate": "medium"}.get(status, "low"),
        })
        record = assemblies[-1]
        sha = re.search(r"/([0-9a-f]{64})\.front-off", record["capOffPlate"])
        record["capOffPlateSha256"] = sha.group(1) if sha else ""
        record["buildParts"], record["buildStatus"], record["buildReason"] = own_build(record, body_class, by_neck_type, library_ids)

    # ---------- alias candidates: current components with no PSD vs library stems no component claims ----------
    claimed = {c["psdStem"] for c in components if c["psdStem"]}
    library_only_rows = [r for r in library_rows if r["library"] == "20. Caps" and r["stem"] not in claimed]
    library_only: dict[str, dict] = {}
    for r in library_only_rows:  # the same stem can sit in two folders (CP20-4002ozShortBlk, CP8-425ShortBlack)
        entry = library_only.setdefault(r["stem"], {"stem": r["stem"], "folders": []})
        entry["folders"].append(r["folder"])
    alias_candidates = []
    for c in components:
        if c["status"] != "current" or c["psdStem"] or not c["websiteSku"]:
            continue
        target = stem_tokens(c["websiteSku"])
        scored = []
        for entry in library_only.values():
            tokens = stem_tokens(entry["stem"])
            if tokens == target:
                scored.append((1.0, "tokens-equal", entry))
            else:
                ratio = difflib.SequenceMatcher(None, " ".join(target), " ".join(tokens)).ratio()
                if ratio >= 0.8:
                    scored.append((ratio, "similar", entry))
        for ratio, kind, entry in sorted(scored, key=lambda x: -x[0])[:2]:
            alias_candidates.append({"websiteSku": c["websiteSku"], "graceSku": c["graceSku"], "type": c["type"], "neck": c["neck"],
                                     "candidateStem": entry["stem"], "candidateFolders": " | ".join(entry["folders"]), "match": kind,
                                     "similarity": round(ratio, 3), "status": "needs-jordan-confirmation"})

    # ---------- quarantine ----------
    quarantine = []
    for c in components:
        if c["status"] == "quarantine":
            quarantine.append({"kind": "component", "key": c["graceSku"], "websiteSku": c["websiteSku"], "neck": c["neck"], "reason": c["typeEvidence"], "evidence": export_note, "action": "classify type / confirm neck before listing"})
    for a in assemblies:
        if a["status"] == "quarantine":
            quarantine.append({"kind": "assembly", "key": a["graceSku"], "websiteSku": a["websiteSku"], "neck": a["neck"], "reason": a["statusReason"], "evidence": export_note, "action": "resolve before composing"})
    for item in review_items:
        quarantine.append({"kind": "review-2026-09-23", "key": item.get("scope") or item.get("websiteSku") or item.get("sku") or "", "websiteSku": item.get("websiteSku") or "",
                           "neck": item["neck"], "reason": item.get("issue") or item.get("finding") or item.get("note") or json.dumps({k: v for k, v in item.items() if k not in ("neck", "file")})[:200],
                           "evidence": item["file"], "action": item.get("action") or item.get("proposedAction") or ""})
    for r in rows:
        if r.get("category") in OUT_OF_SCOPE_CATEGORIES or r.get("category") in BOTTLE_CATEGORIES or r.get("category") == "Component":
            continue
        quarantine.append({"kind": "row", "key": r.get("graceSku"), "websiteSku": r.get("websiteSku") or "", "neck": norm_neck(r.get("neckThreadSize")), "reason": f"category '{r.get('category')}' not classified as body or component", "evidence": export_note, "action": "classify"})

    # ---------- rules ----------
    all_necks = sorted({b["neck"] for b in bodies} | {c["neck"] for c in components})
    rules = {"generatedAt": today, "snapshot": snapshot.name, "keys": {"body": "bodyId = [shape-]profile-<capacity>ml-<neck>", "component": "graceSku", "assembly": "graceSku"},
             "rulings": RULINGS, "componentListExclusions": COMPONENT_LIST_EXCLUSIONS,
             "ruledBodyClasses": {category: {"class": cls, "source": source} for category, (cls, source) in RULED_BODY_CLASSES.items()}, "necks": {}}
    for neck in all_necks:
        nb = [b for b in bodies if b["neck"] == neck and b["status"] == "current"]
        nc = [c for c in components if c["neck"] == neck and c["status"] == "current"]
        na = [a for a in assemblies if a["neck"] == neck]
        rules["necks"][neck or "(none)"] = {
            "kind": "thread" if THREAD_RE.match(neck) else "non-thread",
            "bodies": len(nb), "components": len(nc),
            "componentTypes": dict(sorted(Counter(c["type"] for c in nc).items())),
            "fitmentTypesObserved": dict(sorted(Counter(a["fitmentType"] for a in na if a["status"] in ("verified", "candidate")).items())),
            "assemblies": dict(sorted(Counter(a["status"] for a in na).items())),
            **NECK_RULES.get(neck, {}),
            "matrixAcceptance": MATRIX_ACCEPTANCE.get(neck),
        }

    # ---------- write ----------
    REGISTER.mkdir(parents=True, exist_ok=True)
    def write_csv(name: str, records: list) -> None:
        if records:
            with (REGISTER / name).open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(records[0].keys()))
                writer.writeheader()
                writer.writerows(records)
    write_csv("bodies.csv", bodies)
    write_csv("components.csv", components)
    write_csv("assemblies.csv", assemblies)
    write_csv("quarantine.csv", quarantine)
    write_csv("alias-candidates.csv", alias_candidates)
    (REGISTER / "rules.json").write_text(json.dumps(rules, indent=2) + "\n")

    # ---------- report ----------
    status_counts = Counter(a["status"] for a in assemblies)
    excluded_count = sum(1 for a in assemblies if a["excludedByRule"])
    isolated_bodies = [b for b in bodies if b["classSource"].startswith("jordan-")]
    ruled_by_class = Counter(b["compatibilityClass"] for b in isolated_bodies)
    assumed = [b for b in bodies if b["classSource"].startswith("assumed")]
    rulings_lines = ["## Rulings applied", ""] + [f"- **{r['date']} · {r['by']}** — {r['rule']} _(applies: {r['applies']})_" for r in RULINGS] + [
        f"- Effect this build: pasted products removed from **{excluded_count}** component lists; **{len(isolated_bodies)}** bodies in ruled own classes ("
        + ", ".join(f"{cls} {n}" for cls, n in sorted(ruled_by_class.items())) + ")"
        + (f"; {len(assumed)} bodies still in classes assumed from their category, not yet ruled: " + ", ".join(sorted({b['category'] for b in assumed})) if assumed else "; no body class is assumed — every non-glass category is ruled") + ".", ""]
    lines = [f"# Component register — Phase 1 reconciliation ({today})", "",
             f"Source: Convex dev export ({len(rows)} rows, collected {str(data.get('collectedAt', ''))[:19]}Z), "
             f"PSD library inventory ({len(library_rows)} PSDs), body-dims ({len(body_dims)} keys), 23 Sep review files ({len(review_items)} items). Read-only.", "",
             "## Totals", "",
             f"- Bodies: **{sum(1 for b in bodies if b['status'] == 'current')} current** ({sum(1 for b in bodies if b['status'] != 'current')} retired-only) across {len([n for n in all_necks if n])} neck groups",
             f"- Components: **{sum(1 for c in components if c['status'] == 'current')} current**, {sum(1 for c in components if c['status'] == 'retired')} retired, {sum(1 for c in components if c['status'] == 'quarantine')} quarantined; "
             f"**{sum(1 for c in components if c['psdStem'] and c['status'] == 'current')} current components have a library PSD** ({sum(1 for c in components if c['psdMatch'] == 'alias-map')} via alias-map, {sum(1 for c in components if c['psdMatch'] == 'case-insensitive')} case-insensitive)",
             "- Assemblies: " + ", ".join(f"**{n} {s}**" for s, n in sorted(status_counts.items(), key=lambda kv: -kv[1])),
             f"- Quarantine rows: {len(quarantine)} (see quarantine.csv)", "",
             *rulings_lines,
             "## Per neck", "",
             "| neck | bodies | glass variants | components | verified | candidate | quarantine | exception | retired |", "|---|---|---|---|---|---|---|---|---|"]
    for neck in all_necks:
        nb = [b for b in bodies if b["neck"] == neck and b["status"] == "current"]
        nc = [c for c in components if c["neck"] == neck and c["status"] == "current"]
        na = Counter(a["status"] for a in assemblies if a["neck"] == neck)
        glass = sorted({g for b in nb for g in b["glassVariants"].split("; ") if g})
        lines.append(f"| {neck or '(none)'} | {len(nb)} | {len(glass)} | {len(nc)} | {na.get('verified', 0)} | {na.get('candidate', 0)} | {na.get('quarantine', 0)} | {na.get('exception', 0)} | {na.get('retired', 0)} |")
    lines += ["", "## Reconciliation against the 23 Sep matrices", ""]
    check = lambda text, ok: f"- {'✅' if ok else '⚠️'} {text}"
    lines.append("The matrices counted **Glass Bottle** records only; the register also carries atomizers, plastic and aluminium bottles and jars, so both counts are shown.")
    lines.append("")
    for neck, acc in MATRIX_ACCEPTANCE.items():
        nb = [b for b in bodies if b["neck"] == neck and b["status"] == "current"]
        nb_glass = [b for b in nb if b["category"] == "Glass Bottle"]
        na = [a for a in assemblies if a["neck"] == neck]
        na_glass = [a for a in na if a["category"] == "Glass Bottle"]
        live = [a for a in na if a["status"] != "retired"]
        live_glass = [a for a in na_glass if a["status"] != "retired"]
        nc_all = [c for c in components if c["neck"] == neck]
        nc_live = [c for c in nc_all if c["status"] != "retired"]
        extra_bodies = ", ".join(f"{b['bodyId']} ({b['category']})" for b in nb if b["category"] != "Glass Bottle")
        if "bodyFormats" in acc:
            lines.append(check(f"{neck}: glass body formats {len(nb_glass)} vs matrix {acc['bodyFormats']}" + (f" — plus {len(nb) - len(nb_glass)} non-glass: {extra_bodies}" if extra_bodies else ""), len(nb_glass) == acc["bodyFormats"]))
        if "glassRecords" in acc:
            lines.append(check(f"{neck}: glass records {len(na_glass)} incl. {sum(1 for a in na_glass if a['status'] == 'retired')} retired vs matrix {acc['glassRecords']} ({acc['retired']} retired); {len(na) - len(na_glass)} non-glass rows besides", len(na_glass) == acc["glassRecords"]))
        if "currentBottleRows" in acc:
            lines.append(check(f"{neck}: current bottle rows {len(live)} vs matrix {acc['currentBottleRows']}", len(live) == acc["currentBottleRows"]))
        if "componentRecords" in acc:
            lines.append(check(f"{neck}: component records {len(nc_all)} vs matrix {acc['componentRecords']}", len(nc_all) == acc["componentRecords"]))
        if "assemblies" in acc:
            by_body = Counter(a["bodyId"] for a in live_glass)
            lines.append(check(f"{neck}: assemblies {len(live_glass)} vs matrix {acc['assemblies']} — by body: " + ", ".join(f"{k} {v}" for k, v in by_body.most_common()), len(live_glass) == acc["assemblies"]))
        if "bottles" in acc:
            lines.append(check(f"{neck}: bottles {len(live)} vs matrix {acc['bottles']}; components {len(nc_live)} vs {acc['components']}", len(live) == acc["bottles"] and len(nc_live) == acc["components"]))
        if "bottleRows" in acc:
            lines.append(check(f"{neck}: bottle rows {len(live)} vs matrix {acc['bottleRows']}", len(live) == acc["bottleRows"]))
        if "bodyFormats" in acc and neck == "18-415":
            lines.append(f"  - the 23rd 18-415 body is `cylinder-30ml-18-415`: the two fixed-spray exception SKUs, which the matrix keeps in its dashed card")
    types = sorted({c["type"] for c in components})
    lines += ["", "## Component types by neck (current)", "", "| neck | " + " | ".join(types) + " |", "|---|" + "---|" * len(types)]
    for neck in all_necks:
        counts = Counter(c["type"] for c in components if c["neck"] == neck and c["status"] == "current")
        if counts:
            lines.append(f"| {neck or '(none)'} | " + " | ".join(str(counts.get(t, "")) for t in types) + " |")
    missing_psd = [c for c in components if c["status"] == "current" and not c["psdStem"]]
    lines += ["", f"## Library gaps — {len(missing_psd)} current components with no PSD in 20. Caps / 21. Tassels", ""]
    by_neck = defaultdict(list)
    for c in missing_psd:
        by_neck[c["neck"]].append(c)
    for neck, group in sorted(by_neck.items()):
        lines.append(f"- **{neck or '(none)'}** ({len(group)}): " + ", ".join(f"{c['websiteSku'] or c['componentId']} [{c['type']}]" for c in group))
    lines += ["", f"## Library PSDs that no component record claims — {len(library_only)} stems in 20. Caps", ""]
    by_folder = defaultdict(list)
    for r in library_only_rows:
        by_folder[r["folder"]].append(r["stem"])
    for folder, stems in sorted(by_folder.items()):
        lines.append(f"- **{folder}**: " + ", ".join(stems))
    lines += ["", f"## Alias candidates — {len(alias_candidates)} spelling pairs for Jordan to confirm (alias-candidates.csv)", "",
              "| Convex websiteSku | library stem | folder(s) | match |", "|---|---|---|---|"]
    for a in alias_candidates:
        lines.append(f"| {a['websiteSku']} | {a['candidateStem']} | {a['candidateFolders']} | {a['match']} {a['similarity']} |")
    built = [a for a in assemblies if a["neck"] in BUILD_RULE_NECKS and a["status"] in ("verified", "candidate")]
    lines += ["", f"## Own-part builds — rules written for {', '.join(sorted(BUILD_RULE_NECKS))}", "",
              "Each sellable assembly names the parts it is physically made of (`buildParts`), matched uniquely on neck, component type, "
              "cap colour and dotted/plain. Roller balls add the neck's roller insert. A row that does not match exactly one part stays "
              "`unresolved` with the reason; nothing is guessed (Jordan 2026-09-25: wording errors wait for Convex corrections).", "",
              "| body | resolved | partial | unresolved |", "|---|---|---|---|"]
    for body_id in sorted({a["bodyId"] for a in built}):
        tally = Counter(a["buildStatus"] for a in built if a["bodyId"] == body_id)
        lines.append(f"| {body_id} | {tally['resolved']} | {tally['partial']} | {tally['unresolved']} |")
    unresolved_reasons = Counter(a["buildReason"] for a in built if a["buildStatus"] != "resolved")
    if unresolved_reasons:
        lines += ["", "Unresolved, by reason (Convex corrections):", ""]
        for why, n in unresolved_reasons.most_common():
            skus = ", ".join(a["websiteSku"] for a in built if a["buildReason"] == why)
            lines.append(f"- **{n}** — {why}: {skus}")
    label_rows = [a for a in assemblies if "type labels" in a["statusReason"]]
    misfiled_rows = [a for a in assemblies if "not a Component row" in a["statusReason"]]
    unknown_rows = [a for a in assemblies if "no record for" in a["statusReason"]]
    misfiled_refs = Counter(m for a in misfiled_rows for m in re.findall(r"([A-Z0-9-]+) \(([^)]+)\)", a["unresolvedComponents"]))
    lines += ["", "## Catalogue data defects the register surfaced (Convex, not code)", "",
              f"- **{len(label_rows)} assemblies list component TYPE LABELS instead of SKUs** (e.g. `Roll-On Cap`, `Sprayer`): " + ", ".join(f"{n} {v}" for n, v in Counter(a['neck'] for a in label_rows).most_common()) + f". Samples: {', '.join(a['websiteSku'] for a in label_rows[:5])}",
              f"- **{len(misfiled_rows)} assemblies list a component that is not a Component row**: " + ", ".join(f"`{k[0]}` is category {k[1]} (×{v})" for k, v in misfiled_refs.most_common(6)),
              f"- **{len(unknown_rows)} assemblies list a SKU with no record at all**: " + ", ".join(f"`{k}` ×{v}" for k, v in Counter(c for a in unknown_rows for c in a['unresolvedComponents'].split('; ') if c and ' ' not in c and '(' not in c).most_common(10))]
    no_list = [a for a in assemblies if a["status"] == "candidate" and not a["listedComponentCount"]]
    lines += ["", f"## Assemblies with no component list — {len(no_list)}", "", "| neck | count | families |", "|---|---|---|"]
    by_neck = defaultdict(list)
    for a in no_list:
        by_neck[a["neck"]].append(a)
    for neck, group in sorted(by_neck.items()):
        lines.append(f"| {neck or '(none)'} | {len(group)} | {', '.join(sorted({body_by_id[a['bodyId']]['family'] for a in group}))} |")
    lines += ["", f"## Quarantine — {len(quarantine)} rows", "", "| kind | count |", "|---|---|"]
    for kind, n in sorted(Counter(q["kind"] for q in quarantine).items()):
        lines.append(f"| {kind} | {n} |")
    lines += ["", "## Keys", "",
              "- `bodyId` = `[shape-]profile-<capacity>ml-<neck>` (profile from productGroupSlug, else family); `builderBodyId` mirrors `builderBodyIdentity()` in src/lib/bottle-builder/model.ts.",
              "- Components and assemblies are keyed by **graceSku**; `websiteSku` is carried as the legacy alias. Parts that are not products are keyed `LIB-<neck>-<name>` (`componentId`, `sellable` false).",
              "- Component `status`: current | retired | quarantine. Assembly `status`: verified | candidate | exception | quarantine | retired.",
              "- Nothing in Convex, Shopify or the website was changed. Rebuild: `python3 scripts/register/build_register.py`."]
    (REGISTER / "report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:11]))
    print(f"... wrote {len(bodies)} bodies, {len(components)} components, {len(assemblies)} assemblies, {len(quarantine)} quarantine rows → {REGISTER}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
