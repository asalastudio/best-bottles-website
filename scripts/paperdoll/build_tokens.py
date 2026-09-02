#!/usr/bin/env python3
"""
Build tokens.json — the vocabulary every website SKU is spelled from — and
prove it against the catalogue.

    python3 scripts/paperdoll/build_tokens.py   -> data/paper-doll/tokens.json, tokens-report.md

A SKU parses as  <prefix><body><closure?><finish*><modifier*>:
    GBCyl9RollBlkDot   = GB | Cyl9      | Roll | Blk | Dot
    LBDivaFrst46LtnMtGl= LB | DivaFrst46| Ltn  | Mt Gl
    GBDmnd2ozAnSpTslMtSl= GB| Dmnd2oz   | AnSpTsl | Mt Sl
The seed vocabularies below are the spellings the libraries and the
storefront already use (WEBSITE_SKU_FINISHES in ProductDetailClient, the
configurator registry, the alias map). This script does not invent tokens:
every SKU either parses entirely from the vocabulary or is listed as
`unparsed` for review, with the leftover characters.

Jordan reviews the result and sets `reviewedAt`; publishing from the
pipeline manifest is refused until that is set (see publish.mjs --dist).
Dialects (Mt/Matt, Shn/Sh, five spellings of ClOvrCap) are LABEL concerns:
they map to one canonical finish here and are never rewritten at match time.
"""
from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DATA = REPO / "data" / "paper-doll"

PREFIXES = {
    "GB": "glass bottle", "LB": "lotion bottle (glass, pump-sold)", "GBV": "glass vial", "PB": "plastic bottle",
    "CJ": "cream jar", "Alu": "aluminium bottle", "CP": "cap (component)", "Cp": "cap (component)",
    "AnSp": "antique sprayer (component)", "Drp": "dropper (component)", "Spry": "sprayer (component)",
    "Ltn": "lotion pump (component)", "OBag": "organza bag", "Box": "gift box", "SP": "sample / accessory",
    "8-425": "8-425 component", "8-245": "8-425 component (transposed code)", "13-415": "13-415 component",
    "15-415": "15-415 component", "17-415": "17-415 component", "18-415": "18-415 component", "18-400": "18-400 component",
    "20-400": "20-400 component", "VialWand": "vial with wand", "Cyl": "cylinder (bare)", "Circle": "circle (bare)", "Round": "round (bare)",
}

# closure tokens, longest first, with the kit slot they open
CLOSURES = [
    ("AnSpTsl", {"label": "antique sprayer with tassel", "slots": ["sprayer", "bulb", "tassel"], "applicator": "Antique Sprayer"}),
    ("AnSp", {"label": "antique sprayer", "slots": ["sprayer", "bulb"], "applicator": "Antique Sprayer"}),
    ("MtlRollon", {"label": "metal roller (Boston Round spelling)", "slots": ["roller", "cap"], "applicator": "Metal Roll-On"}),
    ("PlRollon", {"label": "plastic roller (Boston Round spelling)", "slots": ["roller", "cap"], "applicator": "Plastic Roll-On"}),
    ("Rollon", {"label": "roller (Boston Round spelling)", "slots": ["roller", "cap"], "applicator": "Roll-On"}),
    ("MtlRoll", {"label": "metal roller", "slots": ["roller", "cap"], "applicator": "Metal Roll-On"}),
    ("PlRoll", {"label": "plastic roller", "slots": ["roller", "cap"], "applicator": "Plastic Roll-On"}),
    ("RollMtl", {"label": "metal roller (suffix spelling)", "slots": ["roller", "cap"], "applicator": "Metal Roll-On"}),
    ("Roll", {"label": "roller", "slots": ["roller", "cap"], "applicator": "Roll-On"}),
    ("FnMst", {"label": "fine mist sprayer", "slots": ["sprayer", "overcap"], "applicator": "Fine Mist Sprayer"}),
    ("Spry", {"label": "sprayer", "slots": ["sprayer", "overcap"], "applicator": "Sprayer"}),
    ("Ltn", {"label": "lotion pump", "slots": ["pump", "overcap"], "applicator": "Lotion Pump"}),
    ("Rdcr", {"label": "reducer", "slots": ["reducer", "cap"], "applicator": "Reducer"}),
    ("Drpr", {"label": "glass dropper", "slots": ["cap", "diptube", "bulb"], "applicator": "Dropper"}),
    ("Drp", {"label": "glass dropper", "slots": ["cap", "diptube", "bulb"], "applicator": "Dropper"}),
    ("Lt", {"label": "lotion pump (component spelling)", "slots": ["pump", "overcap"], "applicator": "Lotion Pump"}),
    ("Sp", {"label": "sprayer (component spelling)", "slots": ["sprayer", "overcap"], "applicator": "Sprayer"}),
    ("Atom", {"label": "atomizer", "slots": ["sprayer"], "applicator": "Atomizer"}),
    ("Stpr", {"label": "stopper", "slots": ["cap"], "applicator": "Stopper"}),
    ("Pmp", {"label": "pump", "slots": ["pump", "overcap"], "applicator": "Pump"}),
    ("Cp", {"label": "cap", "slots": ["cap"], "applicator": "Cap"}),
    ("Cap", {"label": "cap", "slots": ["cap"], "applicator": "Cap"}),
    ("Plain", {"label": "plain (no closure)", "slots": [], "applicator": None}),
]

# finish tokens: canonical label + swatch; longest first so ShnBlk wins over Blk
FINISHES = [
    ("LBrwnLthr", "Light Brown Leather"), ("BrwnLthr", "Brown Leather"), ("BlkLthr", "Black Leather"), ("IvyLthr", "Ivory Leather"), ("PnkLthr", "Pink Leather"),
    ("ClOvrCap", "Clear Overcap"), ("ClrOvrCap", "Clear Overcap"), ("ClOvrCp", "Clear Overcap"), ("CLOvrCap", "Clear Overcap"), ("ClearOvrCap", "Clear Overcap"),
    ("MattBlk", "Matte Black"), ("MattGl", "Matte Gold"), ("MattSl", "Matte Silver"), ("MattCu", "Matte Copper"), ("MattWht", "Matte White"),
    ("ShnBlk", "Shiny Black"), ("ShnGl", "Shiny Gold"), ("ShnSl", "Shiny Silver"), ("ShnCu", "Shiny Copper"), ("ShnWht", "Shiny White"),
    ("ShBlk", "Shiny Black"), ("ShGl", "Shiny Gold"), ("ShSl", "Shiny Silver"),
    ("MtBlk", "Matte Black"), ("MtGl", "Matte Gold"), ("MtSl", "Matte Silver"), ("MtCu", "Matte Copper"), ("MtWht", "Matte White"),
    ("IvyGl", "Ivory + Gold"), ("IvySl", "Ivory + Silver"), ("Ivy", "Ivory"),
    ("Lvndr", "Lavender"), ("Lvn", "Lavender"), ("Pnk", "Pink"), ("Red", "Red"), ("Wht", "White"), ("White", "White"), ("Blk", "Black"), ("Black", "Black"),
    ("Blck", "Black"), ("Cu", "Copper"), ("Gl", "Gold"), ("Gold", "Gold"), ("Sl", "Silver"), ("Silver", "Silver"), ("Blu", "Blue"), ("Grn", "Green"),
    ("Trq", "Turquoise"), ("Prpl", "Purple"), ("Org", "Orange"), ("Ylw", "Yellow"), ("Brwn", "Brown"), ("Nat", "Natural"), ("Clr", "Clear"), ("Clear", "Clear"),
    ("Pink", "Pink"), ("Blue", "Blue"), ("Green", "Green"), ("Gr", "Green"), ("Lv", "Lavender"), ("Tur", "Turquoise"), ("Wh", "White"), ("Cl", "Clear"),
    ("MtS", "Matte Silver"), ("Matt", "Matte"), ("Mt", "Matte"), ("Shn", "Shiny"), ("Sh", "Shiny"), ("Frst", "Frosted"),
]

MODIFIERS = {
    "Rng": "decorative ring", "Dot": "dot cap", "Tall": "tall cap", "Short": "short cap", "Sht": "short cap", "Bulb": "bulb", "Trim": "trim",
    "Tsl": "tassel", "App": "applicator", "Long": "long", "Thick": "thick", "Thin": "thin", "Sm": "small", "Lg": "large", "Mini": "mini",
    "Set": "set", "Kit": "kit", "Pk": "pack", "Pr": "pair", "Sq": "square", "Rnd": "round", "Stars": "stars decoration", "Slim": "slim",
    "L": "long", "Plain": "plain",
}

DIALECTS = {"MtS": "MtSl", "Rollon": "Roll", "MtlRollon": "MtlRoll", "Drpr": "Drp", "Lt": "Ltn", "Sp": "Spry", "Wh": "Wht", "Cl": "Clr", "Gr": "Grn", "Lv": "Lvn", "Pink": "Pnk", "Blue": "Blu", "Green": "Grn", "Mt": "Matt", "Sh": "Shn", "ClrOvrCap": "ClOvrCap", "ClOvrCp": "ClOvrCap", "CLOvrCap": "ClOvrCap", "ClearOvrCap": "ClOvrCap",
            "Lvndr": "Lvn", "Blck": "Blk", "White": "Wht", "Black": "Blk", "Gold": "Gl", "Silver": "Sl", "Clear": "Clr", "RollMtl": "MtlRoll", "Cap": "Cp"}

PREFIX_RE = re.compile("^(" + "|".join(sorted(map(re.escape, PREFIXES), key=len, reverse=True)) + ")")
CLOSURE_RE = re.compile("(" + "|".join(re.escape(t) for t, _ in CLOSURES) + ")")
FINISH_TOKENS = [t for t, _ in FINISHES]
TAIL_TOKENS = sorted(FINISH_TOKENS + list(MODIFIERS), key=len, reverse=True)
TAIL_RE = re.compile("^(" + "|".join(re.escape(t) for t in TAIL_TOKENS) + ")")
FINISH_LABEL = dict(FINISHES)


def parse_sku(sku: str) -> dict:
    """Split one SKU into its tokens; anything that will not parse is returned in `leftover`."""
    out = {"sku": sku, "prefix": None, "body": None, "bodyType": None, "closure": None, "finishes": [], "modifiers": [], "leftover": ""}
    m = PREFIX_RE.match(sku)
    rest = sku
    if m:
        out["prefix"] = m.group(1)
        rest = sku[m.end():]
    # a finish token that ends the SKU may contain a closure word (ClOvrCp, ClOvrCap): keep it out of the search
    search_end = len(rest)
    for token in FINISH_TOKENS:
        if CLOSURE_RE.search(token) and rest.endswith(token) and len(token) < search_end:
            search_end = len(rest) - len(token)
            break
    cm = CLOSURE_RE.search(rest[:search_end])
    if cm and cm.start() == 0:
        # a closure word at the very start names a bottle TYPE (Atom5Slim, Spry3ml, MtlRoll28): keep it in
        # the body and look for a real closure after it
        out["bodyType"] = cm.group(1)
        later = CLOSURE_RE.search(rest[:search_end], cm.end())
        cm = later if later and later.start() > cm.end() else None
    if cm:
        out["body"] = rest[: cm.start()]
        out["closure"] = cm.group(1)
        tail = rest[cm.end():]
    else:
        # no closure: the body runs up to the first finish token that ENDS the string cleanly
        body, tail = rest, ""
        for i in range(1, len(rest)):
            probe = rest[i:]
            parsed = parse_tail(probe)
            if parsed[2] == "" and (parsed[0] or parsed[1]):
                body, tail = rest[:i], probe
                break
        out["body"] = body
    finishes, modifiers, leftover = parse_tail(tail)
    out["finishes"], out["modifiers"], out["leftover"] = finishes, modifiers, leftover
    return out


def parse_tail(tail: str) -> tuple[list[str], list[str], str]:
    finishes, modifiers = [], []
    while tail:
        m = TAIL_RE.match(tail)
        if not m:
            return finishes, modifiers, tail
        token = m.group(1)
        (finishes if token in FINISH_LABEL else modifiers).append(token)
        tail = tail[len(token):]
    return finishes, modifiers, ""


FINISH_QUALIFIERS = ("Matte", "Shiny")

# Reviewed merges: one finish the catalogue spells two ways. "Matte Copper"
# (CuMatt x51, MattCu x10, CuMt x2) and "Copper" (Cu x77) are the same copper
# closure — there is no matte-copper bottle, the qualifier was describing the
# cap, and the only copper components ever photographed are the plain Cu ones
# (CpRoll17-415Cu, CPRoll13-415Cu, Drp/Ltn/Spry18-415Cu). No product group
# carries both spellings, so nothing collides. Jordan, 2026-09-02: "there is
# no Matt copper bottle, only a copper component, so it should be Cu."
FINISH_MERGES = {"Matte Copper": "Copper"}


def canonical_finish(finishes: list[str]) -> str | None:
    """One label per finish, whichever way the SKU spells it.

    'Mt','Gl' and 'MtGl' and 'GlMt' and 'MattGl' all read "Matte Gold": the
    qualifier leads regardless of where the SKU puts it, so BlkSh and ShnBlk
    are one finish and not two. ['Ivy','Gl'] is the two-part ivory collar.
    """
    if not finishes:
        return None
    labels = [FINISH_LABEL[f] for f in finishes]
    # a bare "Clear" beside another colour describes the GLASS, not the closure
    # (GBSpry3mlClBlk is a clear bottle with a black sprayer); "Clear Overcap" is its own part
    if len(labels) > 1:
        labels = [l for l in labels if l != "Clear"] or labels
    qualifier = next((l for l in labels if l in FINISH_QUALIFIERS), None)
    rest = [l for l in labels if l != qualifier]
    if qualifier and len(rest) == 1:
        return FINISH_MERGES.get(f"{qualifier} {rest[0]}", f"{qualifier} {rest[0]}")
    if len(labels) == 2 and labels[0] == "Ivory":
        return f"Ivory + {labels[1]}"
    if qualifier and not rest:
        return qualifier
    return FINISH_MERGES.get(" ".join(labels), " ".join(labels))


def main():
    started = time.time()
    xref = json.loads((DATA / "xref.json").read_text())
    records = xref["products"]
    existing = json.loads((DATA / "tokens.json").read_text()) if (DATA / "tokens.json").exists() else {}

    prefixes = Counter()
    closures = defaultdict(lambda: {"count": 0, "applicators": Counter()})
    finishes = defaultdict(lambda: {"count": 0, "capColors": Counter()})
    modifiers = Counter()
    bodies = defaultdict(lambda: {"count": 0, "familyIds": Counter(), "families": Counter(), "prefixes": Counter()})
    unparsed = []
    parsed_count = 0
    for r in records:
        sku = r["websiteSku"]
        if not sku:
            continue
        p = parse_sku(sku)
        if p["leftover"] or not p["prefix"]:
            unparsed.append({"sku": sku, "prefix": p["prefix"], "body": p["body"], "closure": p["closure"], "leftover": p["leftover"], "applicator": r["applicator"], "capColor": r["capColor"]})
            continue
        parsed_count += 1
        prefixes[p["prefix"]] += 1
        if p["closure"]:
            closures[p["closure"]]["count"] += 1
            closures[p["closure"]]["applicators"][r["applicator"] or "?"] += 1
        label = canonical_finish(p["finishes"])
        if label:
            finishes[label]["count"] += 1
            finishes[label]["capColors"][r["capColor"] or "?"] += 1
            finishes[label].setdefault("spellings", Counter())["".join(p["finishes"])] += 1
        for mod in p["modifiers"]:
            modifiers[mod] += 1
        if p["body"]:
            b = bodies[p["body"]]
            b["count"] += 1
            b["familyIds"][r["familyId"] or "?"] += 1
            b["families"][r["family"] or "?"] += 1
            b["prefixes"][p["prefix"]] += 1

    body_out = {}
    for body, b in sorted(bodies.items()):
        fids = b["familyIds"].most_common()
        body_out[body] = {
            "count": b["count"],
            "familyId": fids[0][0] if fids and fids[0][0] != "?" else None,
            "familyIds": dict(fids),
            "families": dict(b["families"].most_common()),
            "prefixes": dict(b["prefixes"]),
            # a neck code as body ("18-415", "Cp") is a component whose closure token decides the family; not ambiguous
            "ambiguous": len([f for f, _ in fids if f != "?"]) > 1 and not re.match(r"^(\d{1,2}-\d{3}|Cp|CP|CAP\d*|TRDP)", body),
        }
    tokens = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "builderVersion": "tokens 1.0.0",
        "reviewedAt": existing.get("reviewedAt"),
        "reviewedBy": existing.get("reviewedBy"),
        "coverage": {"skus": parsed_count + len(unparsed), "parsed": parsed_count, "unparsed": len(unparsed)},
        "prefixes": {k: {"count": prefixes[k], "meaning": PREFIXES[k]} for k in PREFIXES if prefixes[k]},
        "closures": {t: {"count": closures[t]["count"], **meta, "applicatorsSeen": dict(closures[t]["applicators"].most_common())} for t, meta in CLOSURES if closures[t]["count"]},
        "finishes": {label: {"count": f["count"], "spellings": dict(f["spellings"].most_common()), "capColorsSeen": dict(f["capColors"].most_common(6))} for label, f in sorted(finishes.items())},
        "modifiers": {m: {"count": modifiers[m], "meaning": MODIFIERS[m]} for m in MODIFIERS if modifiers[m]},
        "dialects": DIALECTS,
        "bodies": body_out,
        "unparsed": unparsed,
    }
    (DATA / "tokens.json").write_text(json.dumps(tokens, indent=1))

    ambiguous = [b for b, v in body_out.items() if v["ambiguous"]]
    lines = [f"# Tokens report — {tokens['generatedAt']}", "",
             f"SKUs parsed {parsed_count} / {parsed_count + len(unparsed)}  (unparsed {len(unparsed)})",
             f"prefixes {len(tokens['prefixes'])}  closures {len(tokens['closures'])}  finishes {len(tokens['finishes'])}  modifiers {len(tokens['modifiers'])}  bodies {len(body_out)}  (ambiguous familyId: {len(ambiguous)})",
             f"reviewedAt: {tokens['reviewedAt']}", "", "closures:"]
    for t, meta in tokens["closures"].items():
        lines.append(f"  {t:8} {meta['count']:5}  {meta['label']:32} applicators: {json.dumps(meta['applicatorsSeen'])[:120]}")
    lines += ["", "finishes:"]
    for label, f in tokens["finishes"].items():
        lines.append(f"  {label:22} {f['count']:5}  spellings {json.dumps(f['spellings'])[:70]}  capColor {json.dumps(f['capColorsSeen'])[:90]}")
    lines += ["", "ambiguous bodies (one body token, several familyIds):"]
    for b in ambiguous[:25]:
        lines.append(f"  {b:16} {json.dumps(body_out[b]['familyIds'])}")
    lines += ["", "unparsed (first 40):"]
    for u in unparsed[:40]:
        lines.append(f"  {u['sku']:34} prefix={u['prefix']} body={u['body']} closure={u['closure']} leftover={u['leftover']!r}  applicator={u['applicator']} capColor={u['capColor']}")
    (DATA / "tokens-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:12]))
    print(f"  … ambiguous bodies {len(ambiguous)}, unparsed {len(unparsed)}; full report in tokens-report.md ({time.time() - started:.0f}s)")


if __name__ == "__main__":
    main()
