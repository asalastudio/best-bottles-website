#!/usr/bin/env python3
"""Correct seatY in extracted kit manifests to the neck datum: the top of the glass.

build_master_kits.py took seatY from the bottom of the first non-body part in the
Photoshop stack. That is the closure seat only when the part is a cap. A dip tube
hangs to the foot and a tassel sprayer's bulb hangs beside the bottle, so the
"seat" landed low on the glass or exactly on the baseline. Every Cylinder kit the
builder was designed around records seatY == body.bounds.top, including one whose
stack begins with a dip tube; that is the convention this restores.

Anchors only. No part image, hash, bound or placement is touched, so the plate
registration and the approval (sku -> plateSha256) are exactly as they were.

    python3 scripts/paperdoll/correct_kit_seat_anchor.py BATCH [BATCH ...] [--apply]
"""
import argparse, json, shutil
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("batches", nargs="+", type=Path)
ap.add_argument("--apply", action="store_true")
args = ap.parse_args()

total = changed = 0
for batch in args.batches:
    path = batch / "kits/manifest.json"
    manifest = json.loads(path.read_text())
    n = 0
    for row in manifest["rows"]:
        body = next((p for p in row.get("parts", []) if p["slot"] == "body"), None)
        if not body or "anchors" not in row:
            continue
        total += 1
        seat = body["bounds"]["top"]
        if row["anchors"]["seatY"] != seat:
            row["anchors"]["seatYBefore"] = row["anchors"]["seatY"]
            row["anchors"]["seatY"] = seat
            n += 1
    changed += n
    if args.apply and n:
        backup = path.with_suffix(".json.before-seat-fix")
        if not backup.exists():
            shutil.copy(path, backup)
        path.write_text(json.dumps(manifest, indent=1))
    print(f"{batch.name:32s} {n:4d} seat(s) corrected")
print(f"\n{'corrected' if args.apply else 'would correct'} {changed} of {total} kits")
