#!/usr/bin/env python3
"""Propose which closure item code each product uses, for necks whose register has no own-part rules yet.

    python3 scripts/help/map_kit_parts.py     # writes data/help/kit-part-map.json (status "proposed")

The register lists every 15-415, 18-400 and 8-425 product with its family's whole accessory
list, so the product's own closure is not recorded. Each product's code names it, though:
GBElg30SpryMattSl is the matte silver sprayer, Spry15-415MattSl. This script reads the colour,
finish and kind from the product code and from each candidate component's code and name, and
pairs them only when exactly one candidate agrees on every attribute. Anything ambiguous is
left unmatched. The output is a proposal for review; build_fit_media.py uses a match only for
its art, never to decide what fits.
"""
from __future__ import annotations

import csv
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NECKS = ["15-415", "18-400", "8-425"]
OUT = ROOT / "data" / "help" / "kit-part-map.json"

COLOURS = [("black", r"Bla?c?k|Blck|Blk"), ("white", r"Wht|White"), ("gold", r"Gl(?!ass)|Gold"), ("silver", r"Sl|Silver"), ("copper", r"Cu|Copper")]
FINISHES = [("matte", r"Matt?|Mt(?!l)"), ("shiny", r"Shn|Sh(?![a-z])|Shiny")]


def attrs(text: str, kind_hint: str | None = None) -> dict:
    """Kind, colour(s), finish and trim read from a product or component code (and name)."""
    t = text
    kind = ("rod" if re.search(r"App|glass rod", t, re.I) else
            "dropper" if re.search(r"Drop|Drpr|Drp", t, re.I) else
            "sprayer" if re.search(r"Spry|Spray", t, re.I) else
            "cap")
    out = {"kind": kind_hint or kind}
    if out["kind"] == "dropper":
        # Dropper bulb colour, then an optional metal trim on the collar.
        trim = re.search(r"(Gl|Sl)Trim|ShnGlTrim|ShnSlTrim|shiny (gold|silver) collar", t, re.I)
        out["trim"] = ("gold" if trim and re.search("Gl|gold", trim.group(0), re.I) else "silver") if trim else "none"
        out["bulb"] = "white" if re.search(r"Wht|White", t, re.I) else "black"
        return out
    for name, pattern in COLOURS:
        if re.search(pattern, t):
            out["colour"] = name
            break
    for name, pattern in FINISHES:
        if re.search(pattern, t):
            out["finish"] = name
            break
    return out


def main() -> int:
    components = {c["componentId"]: c for c in csv.DictReader((ROOT / "data/register/components.csv").open())}
    assemblies = [a for a in csv.DictReader((ROOT / "data/register/assemblies.csv").open()) if a["neck"] in NECKS and a["status"] == "verified"]
    fit = json.loads((ROOT / "src/lib/help/fit-index.generated.json").read_text())
    rules = json.loads((ROOT / "data/register/rules.json").read_text())
    export = json.loads(gzip.open(ROOT / "data/register/source" / rules["snapshot"]).read())
    export = export if isinstance(export, list) else export.get("products") or export.get("rows")
    item_names = {r.get("websiteSku"): r.get("itemName") or "" for r in export}
    entries, unmatched = [], []
    for a in assemblies:
        body = next((b for b in fit["bodies"] if b["id"] == a["bodyId"]), None)
        if not body:
            continue
        # The code after the bottle part: GBElg30SpryMattSl -> SpryMattSl, GBBstnAmb15mlBlkDropperGlTrim -> BlkDropperGlTrim.
        tail = re.sub(r"^GB(?:VAmb|Vial(?:Clr)?|Bstn(?:Amb|Blu)?|Elg(?:Frst)?|Crcl|09)?\d*(?:ml)?", "", a["websiteSku"])
        want = attrs(tail)
        # The product's own catalog name says short or tall where its code does not ("...vial with short black cap").
        style = re.search(r"\b(short|tall)\b", item_names.get(a["websiteSku"], ""), re.I)
        if want["kind"] == "cap" and style:
            want["style"] = style.group(1).lower()
        candidates = []
        for cid in body["listed"] + body["sameThread"] + body["conflicting"]:
            c = components.get(cid)
            if not c or c["status"] != "current":
                continue
            code = c["websiteSku"]
            have = attrs(f"{code} {c['itemName']}")
            if c["type"] == "fine-mist-sprayer":
                have["kind"] = "sprayer"
            if have["kind"] == "cap":
                have["style"] = "tall" if c.get("capStyle") == "Tall" else "short"
            # Every attribute the product code states must agree; one it leaves out ("SpryBlk" has no finish)
            # may take any value, as long as only one candidate remains.
            if all(have.get(k) == v for k, v in want.items()):
                candidates.append(cid)
        candidates = sorted(set(candidates))
        if len(candidates) == 1:
            entries.append({"product": a["websiteSku"], "bodyId": a["bodyId"], "componentId": candidates[0],
                            "itemCode": components[candidates[0]]["websiteSku"], "itemName": components[candidates[0]]["itemName"],
                            "basis": f"product code '{tail}' agrees with the item code on {', '.join(f'{k} {v}' for k, v in want.items())}"})
        else:
            unmatched.append({"product": a["websiteSku"], "tail": tail, "read": want, "candidates": candidates})
    OUT.write_text(json.dumps({"_about": "Proposed product-to-closure matches for necks whose register has no own-part rules (scripts/help/map_kit_parts.py). Used only to pick each closure's master art from a product kit; fit comes from the fit index. Status stays 'proposed' until Jordan reviews the sheet.",
                               "status": "proposed", "matches": entries, "unmatched": unmatched}, indent=1) + "\n")
    print(f"{len(entries)} matched, {len(unmatched)} unmatched -> {OUT.relative_to(ROOT)}")
    for u in unmatched:
        print("  UNMATCHED", u["product"], u["read"], u["candidates"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
