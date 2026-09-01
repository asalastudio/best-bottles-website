#!/usr/bin/env python3
"""
body_coverage.py — how many bottle bodies are left to build, measured against
the LIVE CATALOGUE rather than against the lane's own ledger.

    python3 scripts/body_coverage.py            # summary + ranked gap
    python3 scripts/body_coverage.py --all      # every missing body
    python3 scripts/body_coverage.py --csv out.csv

WHY THIS EXISTS
---------------
BODY-COUNT-LOCK.md pins "58 distinct bodies, 47 built" and the skill repeats
it. That number is not wrong so much as OUT OF DATE, and it is out of date in
the one direction that matters: it was derived from bodies.csv, which was
grouped from a dimensions sweep covering 1,345 SKUs. The catalogue has since
been filled in — Convex now holds usable height AND girth for 2,290 of 2,299
containers, 99.6%. Grouping the whole catalogue gives roughly twice as many
distinct bodies as the ledger knows about, so "11 blocked" understates the
remaining work by a wide margin.

A ledger that is a subset of the catalogue reports completion it has not
earned. This reads demand from the catalogue and supply from the GLBs actually
on disk, so neither side can drift into being self-reported.

TOLERANCE CLUSTERING, AND WHY EXACT KEYS LIE
--------------------------------------------
Grouping on (round(h), round(girth), neck) yields 153 bodies — but many pairs
are the same bottle recorded a millimetre apart, because the catalogue prints
tolerances ("104 ±2 mm") and different SKUs of one mould were measured on
different days. 87x72 and 88x72 at 18-415 is one piece of glass, not two.

So bodies are clustered greedily within TOL_MM on both axes, largest first
(the biggest SKU group is the best anchor for where the true dimension sits).
Necks never merge: a 17-415 and an 18-415 body of identical outline take
different closures and are genuinely different parts.

TOL_MM is deliberately small. Raising it to "tidy up" the count merges real
bodies and silently drops work off the board — the same failure as the ledger,
arrived at from the other side.

KNOWN LIMIT: BOXY BODIES DO NOT RECONCILE YET
---------------------------------------------
Run with --unmatched. Every built GLB that fails to match a catalogue body is
BOXY — all 31 round ones match cleanly, and 11 of the 18 boxy ones do not. The
heights agree almost exactly (usually +0 mm); the disagreement is entirely in
the GIRTH axis, and it is not a constant offset:

    TallRect 101x17x17  ->  Convex 101x23   (17x17 square, diagonal 24.0)
    Flair     56x41x20  ->  Convex  56x44   (diagonal 45.6)
    Royal     56x40x21  ->  Convex  56x44   (diagonal 45.2)
    Cr-boxy  105x89x29  ->  Convex 105x78   (SMALLER than the width)

Several look like Convex is publishing a DIAGONAL where the ledger recorded a
face width, but Cr-boxy goes the other way, so one rule does not explain them
all. Until someone settles which axis `widthMm` names for a rectangular
bottle, this tool is authoritative for ROUND bodies (the lathe lane) and
indicative only for boxy ones — a boxy body may be reported missing when a
usable GLB exists under a different girth.

Round is where the volume is and where the work is unblocked, so that is not a
reason to wait. It IS a reason not to quote the boxy numbers as final.
"""
import argparse, csv, glob, json, os, pathlib, re, sys

TOL_MM = 2.0
ROOT = pathlib.Path(__file__).resolve().parents[1]
DEMAND = ROOT / "data" / "body-demand-merged.json"
GLB_DIR = ROOT.parents[1] / "public" / "models" / "bodies"

# Sculpted families cannot be lathed or extruded from a silhouette: surface
# relief is invisible in an outline (group_bodies.py, SCULPTED_FAMILIES). They
# are counted separately so the buildable number is honest.
SCULPTED_HINTS = {"89x49": "Diva", "88x41": "Dmnd", "81x43": "Diva", "113x64": "Diva"}


def norm_neck(n: str) -> str:
    n = (n or "").strip()
    return "-" if n in ("", "na", "none", "None") else n


def parse_glb(name: str):
    """Cyl-round-17-415-70x20 / Cr-boxy-18-415-87x72x23 / Atom-round-na-76x18"""
    m = re.search(r"-(\d+-\d+|na)-(\d+)x(\d+)(?:x(\d+))?$", name)
    if not m:
        return None
    return (float(m.group(2)), float(m.group(3)), norm_neck(m.group(1)))


def cluster(demand: dict):
    """Greedy, largest-first: the biggest SKU group anchors the true dimension."""
    items = []
    for key, n in demand.items():
        hw, neck = key.split("|")
        h, g = hw.split("x")
        items.append([float(h), float(g), norm_neck(neck), n, [key]])
    items.sort(key=lambda r: -r[3])
    out = []
    for it in items:
        for c in out:
            if (c[2] == it[2] and abs(c[0] - it[0]) <= TOL_MM
                    and abs(c[1] - it[1]) <= TOL_MM):
                c[3] += it[3]
                c[4] += it[4]
                break
        else:
            out.append(it)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="list every missing body")
    ap.add_argument("--csv", help="write the full gap to a CSV")
    ap.add_argument("--unmatched", action="store_true",
                    help="list built GLBs that match no catalogue body (see KNOWN LIMIT)")
    a = ap.parse_args()

    if not DEMAND.exists():
        sys.exit(f"missing {DEMAND}\n"
                 "Refresh it from Convex (products: heightWithoutCap/heightWithCap,\n"
                 "diameter/widthMm, neckThreadSize) — see this file's header.")
    bodies = cluster(json.loads(DEMAND.read_text()))
    built_specs = [s for s in (parse_glb(os.path.basename(p)[:-4])
                               for p in glob.glob(str(GLB_DIR / "*.glb"))) if s]

    # A GLB filename records "na" wherever the lane never captured a neck
    # (Atom-round-na-76x18), while Convex knows that body takes a 13-415. That
    # is a MISSING LABEL on the supply side, not a different bottle — so "-"
    # on either side is a wildcard. Without this, 7 built bodies read as
    # missing and the board invents work that is already done.
    def same(x, y, n1, n2, b):
        return (abs(x - b[0]) <= TOL_MM and abs(y - b[1]) <= TOL_MM
                and (n1 == n2 or "-" in (n1, n2)))
    for b in bodies:
        b.append(any(same(h, g, n, b[2], b) for h, g, n in built_specs))

    built = [b for b in bodies if b[5]]
    miss = sorted([b for b in bodies if not b[5]], key=lambda b: -b[3])
    sculpt = [b for b in miss if f"{round(b[0])}x{round(b[1])}" in SCULPTED_HINTS]
    tot = sum(b[3] for b in bodies)

    print(f"distinct bodies the catalogue needs : {len(bodies):4d}   ({tot} SKUs)")
    print(f"  BUILT                            : {len(built):4d}   "
          f"({sum(b[3] for b in built)} SKUs, {sum(b[3] for b in built)/tot*100:.0f}%)")
    print(f"  REMAINING                        : {len(miss):4d}   ({sum(b[3] for b in miss)} SKUs)")
    print(f"     lathe/extrude-able            : {len(miss)-len(sculpt):4d}")
    print(f"     sculpted, needs outside model : {len(sculpt):4d}   "
          f"({sum(b[3] for b in sculpt)} SKUs)")
    print(f"  GLBs on disk                     : {len(built_specs):4d}\n")

    show = miss if a.all else miss[:20]
    print(f"{'SKUs':>5}  {'body':<16} {'neck':<10} note")
    for b in show:
        tag = SCULPTED_HINTS.get(f"{round(b[0])}x{round(b[1])}", "")
        print(f"{b[3]:5d}  {round(b[0])}x{round(b[1]):<11} {b[2]:<10} "
              f"{'SCULPTED (' + tag + ')' if tag else ''}")
    if not a.all and len(miss) > 20:
        print(f"       ... {len(miss)-20} more, together {sum(b[3] for b in miss[20:])} SKUs"
              f"   (--all to list)")

    if a.unmatched:
        print("\nbuilt GLBs matching NO catalogue body (all boxy — see KNOWN LIMIT):")
        for h, g, n in sorted(built_specs):
            if not any(abs(h - b[0]) <= TOL_MM and abs(g - b[1]) <= TOL_MM
                       and (n == b[2] or "-" in (n, b[2])) for b in bodies):
                near = sorted(bodies, key=lambda b: abs(b[0] - h) + abs(b[1] - g))[0]
                print(f"  GLB {h:.0f}x{g:.0f} neck {n:<8s} -> nearest catalogue "
                      f"{near[0]:.0f}x{near[1]:.0f} neck {near[2]} ({near[3]} SKUs)")

    if a.csv:
        with open(a.csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["height_mm", "girth_mm", "neck", "sku_count", "built", "merged_keys"])
            for b in bodies:
                w.writerow([round(b[0]), round(b[1]), b[2], b[3], int(b[5]), ";".join(b[4])])
        print(f"\nwrote {a.csv}")


if __name__ == "__main__":
    main()
