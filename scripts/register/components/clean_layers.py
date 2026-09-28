#!/usr/bin/env python3
"""
Fix a neck's already-cut component layers in place, without re-cutting them.

  python3 scripts/register/components/clean_layers.py --neck 18-415 --specks --recentre
  python3 scripts/register/components/clean_layers.py --pilot --recentre        # the 17-415 Phase 3 pilot
  python3 scripts/register/components/clean_layers.py --neck 13-415 --bottoms

--specks   cut_components.drop_specks on every front layer (not dip tubes or pipettes); the canvas keeps its size, so
           every anchor holds; a changed layer gets its new sha256 and checks.specksClearedPx.
--recentre cut_components.recentre: each source image's anchor x onto its part's own centre line (bulb sprayers
           excepted); checks.recentredMm records the shift.
--bottoms  record each layer's lowest solid row (solidBottomY): the stage lifts a closure that would reach past a
           bottle's shoulder (compose.ts shoulderLiftMm; Jordan 2026-09-26, "the cap is dropping a little low").
--reseat ID --like A,B[,C]
           a closure registered too high or too low on the rim: move ID's anchor so its solid skirt reaches as far below
           the rim as the named siblings' do on average (2026-09-28: the shiny silver short cap rode 1.2 mm high and
           showed a band of neck). checks.reseat records the move; --approved-by records who reviewed the result and
           makes the component approvable, which the registration check alone had not.
Reload afterwards: push-components.ts --neck <neck> [--only <ids>], or push-phase3.ts --only <ids> for the pilot.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_components import REGISTER, ROOT, drop_specks, recentre, sha  # noqa: E402
from cut_components import OFF_AXIS_TYPES, solid_bottom  # noqa: E402


def reach_mm(layer: dict) -> float:
    """How far the layer's solid skirt runs below the rim."""
    return (layer["solidBottomY"] - layer["anchor"]["y"]) / layer["pxPerMm"]


def reseat(m: dict, target: str, like: list[str], approved_by: str) -> int:
    by_id = {c["componentId"]: c for c in m["components"]}
    if target not in by_id or any(s not in by_id for s in like):
        raise SystemExit(f"--reseat/--like name components the measurements do not hold: {[s for s in [target, *like] if s not in by_id]}")
    c = by_id[target]
    moved = 0
    for layer in c["layers"]:
        if layer["z"] != "front" or layer.get("solidBottomY") is None:
            continue
        siblings = [s for sib in like for s in by_id[sib]["layers"] if s["slot"] == layer["slot"] and s.get("solidBottomY") is not None]
        if not siblings:
            raise SystemExit(f"no sibling of {target} has a measured '{layer['slot']}' layer")
        target_reach = sum(reach_mm(s) for s in siblings) / len(siblings)
        before = layer["anchor"]["y"]
        layer["anchor"]["y"] = round(layer["solidBottomY"] - target_reach * layer["pxPerMm"], 1)
        c["checks"].setdefault("reseat", {})[layer["slot"]] = {
            "like": like, "reachMm": round(target_reach, 2), "reachMmBefore": round((layer["solidBottomY"] - before) / layer["pxPerMm"], 2),
            "anchorYBefore": before, "anchorYAfter": layer["anchor"]["y"], "movedMm": round((before - layer["anchor"]["y"]) / layer["pxPerMm"], 2),
        }
        moved += 1
        print(f"{target:26} {layer['slot']:8} re-seated: anchor y {before} -> {layer['anchor']['y']} (reach {target_reach:.2f} mm, like {', '.join(like)})")
    if moved and approved_by:
        c["checks"]["approvedBy"] = approved_by
        c["checks"]["approvable"] = True
    return moved


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    where = ap.add_mutually_exclusive_group(required=True)
    where.add_argument("--neck")
    where.add_argument("--pilot", action="store_true")
    ap.add_argument("--specks", action="store_true")
    ap.add_argument("--recentre", action="store_true")
    ap.add_argument("--bottoms", action="store_true")
    ap.add_argument("--reseat", default="", help="component id whose anchor moves to its siblings' reach")
    ap.add_argument("--like", default="", help="the siblings for --reseat, comma-separated component ids")
    ap.add_argument("--approved-by", default="", help="with --reseat: who reviewed the re-seated layer, and when")
    args = ap.parse_args()
    if not (args.specks or args.recentre or args.bottoms or args.reseat):
        ap.error("name at least one fix: --specks, --recentre, --bottoms and/or --reseat")
    if args.reseat and not args.like:
        ap.error("--reseat needs --like")
    if args.pilot:
        path, images = REGISTER / "phase3" / "pilot-measurements.json", ROOT / "output" / "register-phase3" / "pilot"
    else:
        path, images = REGISTER / "components" / f"{args.neck}-measurements.json", ROOT / "output" / "register-components" / args.neck
    m = json.loads(path.read_text())
    changed = 0
    for c in m["components"]:
        if args.specks:
            for layer in c["layers"]:
                if layer["z"] != "front":
                    continue
                file = images / layer["file"]
                clean, cleared = drop_specks(Image.open(file).convert("RGBA"), layer["slot"])
                if cleared:
                    clean.save(file, optimize=True)
                    layer["sha256"] = sha(clean)
                    c["checks"].setdefault("specksClearedPx", {})[layer["slot"]] = cleared
                    changed += 1
                    print(f"{c['componentId']:26} {layer['slot']:8} cleared {cleared} px")
        if args.bottoms:
            for layer in c["layers"]:
                if c["type"] in OFF_AXIS_TYPES:  # a bulb and hose hang beside the bottle: not a reach down the neck
                    changed += layer.pop("solidBottomY", None) is not None
                    continue
                bottom = solid_bottom(Image.open(images / layer["file"]).convert("RGBA"))
                if layer.get("solidBottomY") != bottom:
                    layer["solidBottomY"] = bottom
                    changed += 1
        if args.recentre:
            moved = recentre(c, images)
            if moved:
                c["checks"]["recentredMm"] = moved
                changed += 1
                print(f"{c['componentId']:26} recentred {moved}")
    if args.reseat:
        changed += reseat(m, args.reseat, [s.strip() for s in args.like.split(",") if s.strip()], args.approved_by)
    path.write_text(json.dumps(m, indent=1) + "\n")
    print(f"{changed} change(s) written to {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
