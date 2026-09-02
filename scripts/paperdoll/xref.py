#!/usr/bin/env python3
"""
Cross-reference the deduplicated PSD stems against the Convex catalogue.

    python3 scripts/paperdoll/xref.py   -> data/paper-doll/xref.json, xref-report.md, alias-candidates.json

Join order per website SKU: exact spelling -> alias-map -> near-miss:case ->
near-miss:punct -> no-psd. Only exact and alias matches can ever publish;
near-misses go to alias-candidates.json for Jordan to promote by copying the
pair into alias-map.json (the ONLY rewrite allowed at match time). Grace SKUs
are read from the product document, never derived.

familyId = <family>-<capacityMl>ml-<color|mixed>-<neck> from the product
GROUP's fields (falling back to the product's), never from a folder name.

publishable = matchKind in {exact, alias}
            and not convexDuplicate
            and the stem has no SAME_STEM_DIFFERENT_PHOTOGRAPH conflict
            and familyId derivable
            (tokens.json review is checked at publish time, not here)
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


def slug(value) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value).lower())).strip("-")


def punct_key(value: str) -> str:
    return re.sub(r"[\s._\-]", "", value).casefold()


COMPONENT_FAMILIES = {"Cap/Closure", "Sprayer", "Lotion Pump", "Dropper", "Roll-On Cap", "Reducer", "Overcap", "Roller Ball"}


def family_id(product: dict, group: dict | None) -> tuple[str | None, str | None]:
    g = group or {}
    family = g.get("family") or product.get("family")
    # components are keyed by neck, not by colour or capacity: one standalone scale per neck family
    if product.get("category") == "Component" or family in COMPONENT_FAMILIES:
        neck = g.get("neckThreadSize") or product.get("neckThreadSize")
        if not family or not neck:
            return None, "missing:" + ",".join(n for n, v in (("family", family), ("neck", neck)) if not v)
        return f"{slug(family)}-{slug(neck)}", None
    capacity = g.get("capacityMl") if g.get("capacityMl") is not None else product.get("capacityMl")
    color = g.get("color") or product.get("color") or "mixed"
    neck = g.get("neckThreadSize") or product.get("neckThreadSize")
    missing = [name for name, value in (("family", family), ("capacityMl", capacity), ("neck", neck)) if value in (None, "")]
    if missing:
        return None, "missing:" + ",".join(missing)
    cap = f"{capacity:g}" if isinstance(capacity, (int, float)) else str(capacity)
    return f"{slug(family)}-{cap}ml-{slug(color)}-{slug(neck)}", None


def main():
    started = time.time()
    sel = json.loads((DATA / "selection.json").read_text())
    snap = json.loads((DATA / "convex-snapshot.json").read_text())
    alias_raw = json.loads((DATA / "alias-map.json").read_text()) if (DATA / "alias-map.json").exists() else {}

    stems = sel["stems"]
    conflict_stems = {c["stem"] for c in sel.get("conflicts", [])}
    exact_spelling = {}                      # spelling -> stemKey
    for key, entry in stems.items():
        for spelling in entry["stems"]:
            exact_spelling[spelling] = key
    punct_index = defaultdict(set)           # punct(spelling) -> {stemKey}
    for spelling, key in exact_spelling.items():
        punct_index[punct_key(spelling)].add(key)

    products = snap["products"]
    groups = {g["_id"]: g for g in snap["groups"]}
    sku_counts = Counter((p.get("websiteSku") or "").strip() for p in products)
    sku_set = {s for s in sku_counts if s}

    # alias map direction: the side whose entries are catalogue SKUs is the key side
    keys_in_catalogue = sum(1 for k in alias_raw if k in sku_set)
    values_in_catalogue = sum(1 for v in alias_raw.values() if v in sku_set)
    alias_sku_to_stem = dict(alias_raw) if keys_in_catalogue >= values_in_catalogue else {v: k for k, v in alias_raw.items()}
    alias_direction = "sku->stem" if keys_in_catalogue >= values_in_catalogue else "stem->sku (inverted for use)"

    records = []
    claimed = defaultdict(list)             # stemKey -> [sku]
    for p in products:
        sku = (p.get("websiteSku") or "").strip()
        group = groups.get(p.get("productGroupId"))
        fid, fid_reason = family_id(p, group)
        rec = {
            "websiteSku": sku or None,
            "graceSku": p.get("graceSku"),
            "productId": p.get("productId"),
            "category": p.get("category"),
            "family": (group or {}).get("family") or p.get("family"),
            "applicator": p.get("applicator"),
            "capColor": p.get("capColor"),
            "groupSlug": (group or {}).get("slug"),
            "familyId": fid,
            "familyIdReason": fid_reason,
            "convexDuplicate": sku_counts[sku] > 1 if sku else False,
            "renderMode": None,
            "warnings": [],
            "matchKind": None,
            "stemKey": None,
            "stemSpelling": None,
            "states": [],
            "blockReasons": [],
        }
        if not sku:
            rec["matchKind"] = "no-website-sku"
        elif sku in exact_spelling:
            rec["matchKind"], rec["stemKey"], rec["stemSpelling"] = "exact", exact_spelling[sku], sku
        elif alias_sku_to_stem.get(sku) in exact_spelling:
            stem = alias_sku_to_stem[sku]
            rec["matchKind"], rec["stemKey"], rec["stemSpelling"] = "alias", exact_spelling[stem], stem
        elif sku.casefold() in stems:
            rec["matchKind"], rec["stemKey"] = "near-miss:case", sku.casefold()
            spellings = stems[sku.casefold()]["stems"]
            rec["stemSpelling"] = next((sp for sp in spellings if sp.casefold() == sku.casefold()), spellings[0])
        elif punct_key(sku) in punct_index:
            key = sorted(punct_index[punct_key(sku)])[0]
            rec["matchKind"], rec["stemKey"], rec["stemSpelling"] = "near-miss:punct", key, stems[key]["stems"][0]
        else:
            rec["matchKind"] = "no-psd"
        if rec["stemKey"]:
            rec["states"] = sorted(stems[rec["stemKey"]]["states"].keys())
            rec["renderMode"] = "standalone" if stems[rec["stemKey"]].get("role") == "component" else "registered"
            claimed[rec["stemKey"]].append(sku)
        # the SKU's own glass token against the catalogue's colour: a frosted SKU filed under a clear
        # group gets the clear familyId until the catalogue is fixed — visible, never silently corrected
        color = ((group or {}).get("color") or p.get("color") or "").lower()
        if sku:
            frosted_token = re.search(r"Frst|Frost", sku) is not None
            if frosted_token and color and "frost" not in color:
                rec["warnings"] = ["sku_says_frosted_catalogue_says_" + slug(color)]
            elif not frosted_token and "frost" in color and sku.startswith(("GB", "LB")):
                rec["warnings"] = ["catalogue_says_frosted_sku_does_not"]
        # the hard rule
        if rec["matchKind"] not in ("exact", "alias"):
            rec["blockReasons"].append(f"match:{rec['matchKind']}")
        if rec["convexDuplicate"]:
            rec["blockReasons"].append("convex_duplicate_websiteSku")
        if rec["stemKey"] and rec["stemKey"] in conflict_stems:
            rec["blockReasons"].append("SAME_STEM_DIFFERENT_PHOTOGRAPH")
        if not fid:
            rec["blockReasons"].append(f"familyId:{fid_reason}")
        rec["publishable"] = not rec["blockReasons"]
        records.append(rec)

    psd_only = []
    sku_fold = {s.casefold(): s for s in sku_set}
    for key, entry in stems.items():
        if key in claimed:
            continue
        paths = {s: r["chosenPath"] for s, r in entry["states"].items()}
        top = next((p for p in paths.values() if p), "") .split("/")[0]
        ring_base = re.sub(r"rng$", "", key)
        hint = None
        if ring_base != key and ring_base in sku_fold:
            hint = f"ring variant of {sku_fold[ring_base]}"
        elif key.replace("frst", "") in sku_fold:
            hint = f"frosted twin of {sku_fold[key.replace('frst', '')]}"
        psd_only.append({"stemKey": key, "stems": entry["stems"], "role": entry.get("role", "product"), "states": sorted(entry["states"].keys()),
                         "chosenPaths": paths, "topFolder": top, "hint": hint})

    # alias candidates: every near-miss, plus PSD-only stems whose punct key is shared by a SKU
    candidates = []
    for rec in records:
        if rec["matchKind"] in ("near-miss:case", "near-miss:punct"):
            candidates.append({"websiteSku": rec["websiteSku"], "stem": rec["stemSpelling"], "kind": rec["matchKind"]})
    candidates.sort(key=lambda c: c["websiteSku"])

    kinds = Counter(r["matchKind"] for r in records)
    dupes = sum(1 for r in records if r["convexDuplicate"])
    publishable = sum(1 for r in records if r["publishable"])
    both_states = sum(1 for r in records if "on" in r["states"] and "off" in r["states"])
    no_psd_by_category = Counter(r["category"] for r in records if r["matchKind"] == "no-psd")
    no_psd_by_family = Counter(r["family"] for r in records if r["matchKind"] == "no-psd")
    families = Counter(r["familyId"] for r in records if r["publishable"])
    fid_missing = Counter(r["familyIdReason"] for r in records if r["familyIdReason"])
    blockers = Counter(b for r in records for b in r["blockReasons"])
    warnings = Counter(w for r in records for w in r["warnings"])
    render_modes = Counter(r["renderMode"] for r in records if r["publishable"])
    psd_only_top = Counter(e["topFolder"] for e in psd_only)
    psd_only_hints = Counter((e["hint"] or "").split(" of ")[0] or "no hint" for e in psd_only)
    # invariants from the plan
    assert not any(r["publishable"] and r["matchKind"] not in ("exact", "alias") for r in records)
    assert not any(r["publishable"] and r["convexDuplicate"] for r in records)

    out = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "builderVersion": "xref 1.0.0",
        "inputs": {"selection": sel["generatedAt"], "snapshot": snap["generatedAt"], "deployment": snap["deployment"], "aliasDirection": alias_direction, "aliases": len(alias_raw)},
        "summary": {"products": len(records), "matchKinds": dict(kinds), "convexDuplicates": dupes, "publishable": publishable,
                    "matchedWithBothStates": both_states, "psdOnlyStems": len(psd_only), "familyIds": len(families), "blockers": dict(blockers)},
        "products": records,
        "psdOnly": psd_only,
    }
    (DATA / "xref.json").write_text(json.dumps(out, indent=1))
    (DATA / "alias-candidates.json").write_text(json.dumps({"_comment": "near-misses between a Convex website SKU and a PSD stem; promote by copying {websiteSku: stem} into alias-map.json", "candidates": candidates}, indent=1))

    lines = [f"# Cross-reference report — {out['generatedAt']}", "",
             f"products: {len(records)}  alias map: {len(alias_raw)} entries ({alias_direction})",
             f"match kinds: {dict(kinds)}", f"convex duplicate website SKUs (products affected): {dupes}",
             f"publishable: {publishable}  (matched with cap-on AND cap-off: {both_states})",
             f"family ids among publishable: {len(families)}  familyId not derivable: {dict(fid_missing)}",
             f"block reasons: {dict(blockers)}",
             f"warnings (catalogue colour vs SKU token): {dict(warnings)}",
             f"render modes among publishable: {dict(render_modes)}",
             f"psd-only stems (no SKU claims them): {len(psd_only)}", "",
             "no-psd by category: " + json.dumps(no_psd_by_category.most_common(12)),
             "no-psd by family: " + json.dumps(no_psd_by_family.most_common(15)), "",
             "largest publishable families:"]
    for fid, n in families.most_common(15):
        lines.append(f"  {n:4}  {fid}")
    lines.append("")
    lines.append("psd-only stems by top folder: " + json.dumps(psd_only_top.most_common(12)))
    lines.append("psd-only hints: " + json.dumps(psd_only_hints.most_common(6)))
    lines.append("")
    lines.append("alias candidates (first 20):")
    for c in candidates[:20]:
        lines.append(f"  {c['websiteSku']}  ->  {c['stem']}  ({c['kind']})")
    (DATA / "xref-report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nwrote xref.json ({len(records)} products), alias-candidates.json ({len(candidates)}) in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
