#!/usr/bin/env python3
"""
Seat every body plate on its neck: anchors.axisX = the neck's own axis, not the barrel's.

  python3 scripts/register/bodies/neck_axis.py            # dry run: the shift per plate, in mm
  python3 scripts/register/bodies/neck_axis.py --write    # write data/register/bodies/bodies-measurements.json and the pilot plates

A closure threads onto the neck, so the neck is where it must centre (docs/COMPONENT_REGISTER_COMPONENTS.md, the paper-doll
anchor rule). The plates' axis was the median centre of the barrel's middle band; on a plate whose glass leans a little (the
Tall Cylinder 9 drifts 0.7 mm from foot to neck) a closure centred there sat off the neck (Jordan 2026-09-26). The neck rows
run from 0.5 mm under the rim to the shoulder's start (the first row wider than the neck by 8%), at most 20 mm; the axis is
the median of their midpoints, which the helical thread's alternating crests do not move.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
BODIES = ROOT / "data" / "register" / "bodies" / "bodies-measurements.json"
PILOT = ROOT / "data" / "register" / "phase3" / "pilot-measurements.json"
BODY_IMAGES = ROOT / "output" / "register-bodies"
PILOT_IMAGES = ROOT / "output" / "register-phase3" / "pilot"
# Only a threaded neck (13-415, 18-415, 20-400 ...) or the Tola's 14.3 mm plug neck takes a closure on its axis; jars, ground
# stoppers and the decorative hearts keep the barrel axis (their "neck" rows are a mouth or a stopper seat), and so does any
# plate whose neck axis lands more than 1 mm off the barrel's (a sign the rows are not a neck).
SEATED_NECK = re.compile(r"-(\d+-\d+|14\.3mm)$")
MAX_SHIFT_MM = 1.0


def neck_rows(alpha: np.ndarray, seat_y: int, px_per_mm: float) -> tuple[int, int]:
    """(first, last) row of the neck: from 0.5 mm under the rim to the shoulder's start, at most 20 mm down."""
    m = alpha > 128
    first = int(round(seat_y + 0.5 * px_per_mm))
    stop = min(m.shape[0], int(round(seat_y + 20 * px_per_mm)))
    widths = []
    for y in range(first, stop):
        xs = np.where(m[y])[0]
        widths.append(xs.max() - xs.min() + 1 if xs.size else 0)
    head = [w for w in widths[: max(3, int(2 * px_per_mm))] if w]
    neck_w = float(np.median(head)) if head else 0.0
    last = stop - 1
    for i, w in enumerate(widths):
        if neck_w and w > 1.08 * neck_w and i > px_per_mm:  # past the first millimetre: the lip can flare
            last = first + i - 1
            break
    return first, last


def neck_axis(alpha: np.ndarray, seat_y: int, px_per_mm: float) -> float:
    m = alpha > 128
    first, last = neck_rows(alpha, seat_y, px_per_mm)
    mids = [(np.where(m[y])[0].min() + np.where(m[y])[0].max()) / 2 for y in range(first, last + 1) if m[y].any()]
    return float(np.median(mids))


def shoulder_start_mm(alpha: np.ndarray, seat_y: int, px_per_mm: float) -> float:
    """How far under the rim the shoulder begins (the neck's last row), in mm."""
    return (neck_rows(alpha, seat_y, px_per_mm)[1] + 1 - seat_y) / px_per_mm


def update(plates: list[dict], images: Path, write: bool, skipped: list) -> list[tuple[str, float]]:
    moved = []
    for p in plates:
        if not p.get("file") or not (images / p["file"]).exists():
            continue
        a = np.asarray(Image.open(images / p["file"]).convert("RGBA").getchannel("A"))
        axis = round(neck_axis(a, p["anchors"]["seatY"], p["pxPerMm"]), 1)
        shift = (axis - p["anchors"]["axisX"]) / p["pxPerMm"]
        if not SEATED_NECK.search(p.get("bodyId") or p["plateKey"].split("|")[0]) or abs(shift) > MAX_SHIFT_MM:
            skipped.append((p["plateKey"], round(shift, 2)))
            continue
        if write and abs(axis - p["anchors"]["axisX"]) >= 0.5:
            p["anchors"].setdefault("barrelAxisX", p["anchors"]["axisX"])
            p["anchors"]["axisX"] = axis
        moved.append((p["plateKey"], round(shift, 2)))
    return moved


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    bodies = json.loads(BODIES.read_text())
    pilot = json.loads(PILOT.read_text())
    skipped: list = []
    rows = update(bodies, BODY_IMAGES, args.write, skipped) + update(pilot["plates"], PILOT_IMAGES, args.write, skipped)
    for key, mm in sorted(rows, key=lambda r: -abs(r[1])):
        if abs(mm) >= 0.1:
            print(f"{key:40} neck axis {mm:+.2f} mm from the barrel axis")
    print(f"{len(rows)} plates seated on the neck; {sum(abs(mm) >= 0.1 for _, mm in rows)} move 0.1 mm or more; largest {max(abs(mm) for _, mm in rows):.2f} mm")
    print(f"{len(skipped)} keep the barrel axis: " + ", ".join(f"{k} ({mm:+.2f})" for k, mm in skipped))
    if args.write:
        BODIES.write_text(json.dumps(bodies, indent=1) + "\n")
        PILOT.write_text(json.dumps(pilot, indent=1) + "\n")
        print("written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
