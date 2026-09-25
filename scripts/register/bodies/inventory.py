#!/usr/bin/env python3
"""
Catalogue glass-body inventory: every current glass body x glass colour the catalogue sells, the master PSDs
that hold its bare body (matched by file name = website SKU), and the measurements it will be sized by.

  python3 scripts/register/bodies/inventory.py

Writes data/register/bodies/inventory.csv and prints the totals. Read-only.
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
REGISTER = ROOT / "data" / "register"
PSD_ROOT = Path(json.loads((ROOT / "data" / "paper-doll" / "component-library-inventory.json").read_text())["root"])
SKIP = ("20. Caps", "21. Tassels")
GLASS_CLASSES = lambda cls: cls.startswith("glass-")  # glass bottles and glass jars; plastic, aluminium, atomizers, cream jars are not glass bodies


def psd_index() -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = defaultdict(list)
    for p in PSD_ROOT.rglob("*.psd"):
        rel = p.relative_to(PSD_ROOT)
        if rel.parts[0] in SKIP:
            continue
        stem = re.sub(r"^\s*\d+\.\s*", "", p.stem).strip()
        index[stem.lower()].append(p)
    return index


def main():
    bodies = {b["bodyId"]: b for b in csv.DictReader((REGISTER / "bodies.csv").open())}
    alias = {k.lower(): v.lower() for k, v in json.loads((ROOT / "data" / "paper-doll" / "alias-map.json").read_text()).items() if not k.startswith("_")}
    index = psd_index()
    rows = []
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for a in csv.DictReader((REGISTER / "assemblies.csv").open()):
        b = bodies[a["bodyId"]]
        if b["status"] != "current" or not GLASS_CLASSES(a["compatibilityClass"]) or a["status"] == "retired":
            continue
        groups[(a["bodyId"], a["glass"])].append(a)
    for (body_id, glass), members in sorted(groups.items()):
        b = bodies[body_id]
        psds = []
        for a in members:
            sku = a["websiteSku"].lower()
            psds += index.get(sku, []) + index.get(alias.get(sku, ""), [])
        psds = sorted(set(psds))
        uncapped = [p for p in psds if "uncapped" in str(p).lower()]
        height = b["dimsHeightBareMm"] or b["heightWithoutCapMm"]
        rows.append({
            "bodyId": body_id, "glass": glass, "family": b["family"], "shape": b["shape"], "capacityMl": b["capacityMl"], "neck": b["neck"],
            "category": b["category"], "assemblies": len(members),
            "heightBareMm": height, "diameterMm": b["dimsDiameterMm"] or b["diameterMm"], "widthMm": b["widthMm"],
            "dimsConfidence": b["dimsConfidence"] or ("convex-only" if b["heightWithoutCapMm"] else "none"),
            "psdCount": len(psds), "uncappedCount": len(uncapped),
            "source": str((uncapped or psds or [Path("")])[0].relative_to(PSD_ROOT)) if psds else "",
        })
    # glasses that have no PSD of their own borrow geometry from another glass of the same body
    have = defaultdict(set)
    for r in rows:
        if r["psdCount"]:
            have[r["bodyId"]].add(r["glass"])
    for r in rows:
        r["plan"] = ("own photo" if r["psdCount"] else
                     f"geometry from {sorted(have[r['bodyId']])[0]} + material reference" if have[r["bodyId"]] else "no source photo")
    out = REGISTER / "bodies" / "inventory.csv"
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    by_plan = defaultdict(int)
    for r in rows:
        by_plan[r["plan"].split(" + ")[0].split(" from ")[0]] += 1
    nb = len({r["bodyId"] for r in rows})
    print(f"{len(rows)} body x glass plates across {nb} glass bodies -> {out.relative_to(ROOT)}")
    print("plan:", dict(by_plan))
    print("glasses:", dict(sorted(defaultdict(int, {g: sum(1 for r in rows if r['glass'] == g) for g in {r['glass'] for r in rows}}).items())))
    print("dims confidence:", dict(defaultdict(int, {c: sum(1 for r in rows if r['dimsConfidence'] == c) for c in {r['dimsConfidence'] for r in rows}})))
    missing = [f"{r['bodyId']}|{r['glass']}" for r in rows if r["plan"] == "no source photo"]
    print(f"no source photo at all ({len(missing)}):", missing[:20])
    nodims = [r["bodyId"] for r in rows if not r["heightBareMm"]]
    print(f"no height ({len(set(nodims))} bodies):", sorted(set(nodims))[:20])


if __name__ == "__main__":
    main()
