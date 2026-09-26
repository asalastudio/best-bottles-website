#!/usr/bin/env python3
"""
Fix a neck's already-cut component layers in place, without re-cutting them.

  python3 scripts/register/components/clean_layers.py --neck 18-415 --specks --recentre
  python3 scripts/register/components/clean_layers.py --pilot --recentre        # the 17-415 Phase 3 pilot
  python3 scripts/register/components/clean_layers.py --pilot --clear-shoulder "cylinder-9ml-17-415|Clear"

--specks   cut_components.drop_specks on every front layer (not dip tubes or pipettes); the canvas keeps its size, so
           every anchor holds; a changed layer gets its new sha256 and checks.specksClearedPx.
--recentre cut_components.recentre: each source image's anchor x onto its part's own centre line (bulb sprayers
           excepted); checks.recentredMm records the shift.
--clear-shoulder PLATE  sprayers and pumps: raise the whole closure so its lowest front layer (the collar) ends where the
           plate's shoulder begins (Jordan 2026-09-26 on the 9 mL cylinder: "raised up a little bit"; the collar had swallowed
           the shoulder). checks.raisedMm records the lift.
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bodies"))
from neck_axis import shoulder_start_mm  # noqa: E402
import numpy as np  # noqa: E402

CLOSURES_WITH_COLLARS = {"fine-mist-sprayer", "lotion-pump"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    where = ap.add_mutually_exclusive_group(required=True)
    where.add_argument("--neck")
    where.add_argument("--pilot", action="store_true")
    ap.add_argument("--specks", action="store_true")
    ap.add_argument("--recentre", action="store_true")
    ap.add_argument("--clear-shoulder", metavar="PLATE", default="")
    args = ap.parse_args()
    if not (args.specks or args.recentre or args.clear_shoulder):
        ap.error("name at least one fix: --specks, --recentre and/or --clear-shoulder PLATE")
    if args.pilot:
        path, images = REGISTER / "phase3" / "pilot-measurements.json", ROOT / "output" / "register-phase3" / "pilot"
    else:
        path, images = REGISTER / "components" / f"{args.neck}-measurements.json", ROOT / "output" / "register-components" / args.neck
    m = json.loads(path.read_text())
    changed = 0
    shoulder_mm = None
    if args.clear_shoulder:
        plates = m.get("plates") or json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text())
        plate = next(p for p in plates if p["plateKey"] == args.clear_shoulder)
        plate_images = images if m.get("plates") else ROOT / "output" / "register-bodies"
        a = np.asarray(Image.open(plate_images / plate["file"]).convert("RGBA").getchannel("A"))
        shoulder_mm = shoulder_start_mm(a, plate["anchors"]["seatY"], plate["pxPerMm"])
        print(f"{args.clear_shoulder}: the shoulder begins {shoulder_mm:.2f} mm under the rim")
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
        if shoulder_mm is not None and c["type"] in CLOSURES_WITH_COLLARS:
            front = [l for l in c["layers"] if l["z"] == "front"]
            def last_solid_row(layer: dict) -> int:
                rows = np.where((np.asarray(Image.open(images / layer["file"]).convert("RGBA").getchannel("A")) > 128).any(axis=1))[0]
                return int(rows.max()) + 1
            reach = max((last_solid_row(l) - l["anchor"]["y"]) / l["pxPerMm"] for l in front)  # mm under the rim, padding excluded
            lift = reach - shoulder_mm
            if lift > 0.05:
                for layer in c["layers"]:
                    layer["anchor"]["y"] = round(layer["anchor"]["y"] + lift * layer["pxPerMm"], 1)
                c["checks"]["raisedMm"] = round(lift, 3)
                changed += 1
                print(f"{c['componentId']:26} raised {lift:.2f} mm (the collar reached {reach:.2f} mm under the rim)")
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
