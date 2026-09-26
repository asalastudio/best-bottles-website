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
Reload afterwards: push-components.ts --neck <neck>, or push-phase3.ts --only <ids> for the pilot.
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    where = ap.add_mutually_exclusive_group(required=True)
    where.add_argument("--neck")
    where.add_argument("--pilot", action="store_true")
    ap.add_argument("--specks", action="store_true")
    ap.add_argument("--recentre", action="store_true")
    ap.add_argument("--bottoms", action="store_true")
    args = ap.parse_args()
    if not (args.specks or args.recentre or args.bottoms):
        ap.error("name at least one fix: --specks, --recentre and/or --bottoms")
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
    path.write_text(json.dumps(m, indent=1) + "\n")
    print(f"{changed} change(s) written to {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
