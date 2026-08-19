#!/usr/bin/env python3
"""BEST BOTTLES — FINISH QA SHEET (one per finish master).

Columns per the 2026-08-10 directive: engineering drawing | orthographic
Blender finish | drawing/geometry overlay | 45-degree thread close-up |
section cut | dimension report (SOURCE/BLENDER/DEVIATION/TOL/PASS-FAIL).
Below: the 6-angle spin strip — the true-helix test (thread start/runout
must travel; identical rings at every angle = automatic FAIL).

    python3 finish-qa-sheet.py --finish 17-415 --qa <renders dir> \
        --drawing <crop.png> --report <FINISH_QA_JSON file> --out <png>

The overlay column re-draws the sheet's PRINTED dimensions as rulers on
the ortho render at exact scale (1000/finish_h px per mm): verticals at
±T/2 and ±E/2, horizontals at rim/band/bead datums — green PASS / red
FAIL per the dimension report.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CELL = 480
GAP = 10
PAD = 16


def font(sz):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", sz)
    except Exception:
        return ImageFont.load_default()


def fit(im, w, h, bg="#242424"):
    tile = Image.new("RGB", (w, h), bg)
    scale = min(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)),
                   Image.LANCZOS)
    tile.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return tile


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--finish", required=True)
    p.add_argument("--qa", required=True, type=Path)
    p.add_argument("--drawing", type=Path, default=None)
    p.add_argument("--report", required=True, type=Path)
    p.add_argument("--params", required=True,
                   help="JSON: finish_h, major_d, neck_d, top_land, "
                        "thread_band, bead_z (opt), bead_h (opt)")
    p.add_argument("--out", required=True, type=Path)
    a = p.parse_args()
    f = json.loads(a.params)
    rep = json.loads(a.report.read_text())
    status = {r["dim"]: r["status"] for r in rep["rows"]}
    overall = all(r["status"] == "PASS" for r in rep["rows"])

    ortho = Image.open(a.qa / "ortho-front.png").convert("RGB")
    # exact projection: vertical 1600 px spans finish_h*1.6 mm, centred on
    # finish_h/2; px/mm identical horizontally
    ppmm = ortho.height / (f["finish_h"] * 1.6)
    cx, cy = ortho.width / 2.0, ortho.height / 2.0     # cy = finish_h/2 plane

    def X(mm):
        return cx + mm * ppmm

    def Y(z_mm):
        return cy - (z_mm - f["finish_h"] / 2.0) * ppmm

    ov = ortho.copy()
    d = ImageDraw.Draw(ov)
    col = lambda key: "#38C172" if status.get(key, "PASS") == "PASS" else "#E3342F"

    for sgn in (-1, 1):                                # T and E verticals
        d.line([(X(sgn * f["major_d"] / 2), Y(f["finish_h"] - f["top_land"])),
                (X(sgn * f["major_d"] / 2), Y(f["finish_h"] - f["top_land"] - f["thread_band"]))],
               fill=col("thread crest OD (T)"), width=3)
        d.line([(X(sgn * f["neck_d"] / 2), Y(0)),
                (X(sgn * f["neck_d"] / 2), Y(f["finish_h"]))],
               fill=col("neck land OD (E)"), width=2)
    top_key = ("thread crest path top" if "thread crest path top" in status
               else "thread band top")
    bottom_key = ("thread crest path bottom" if "thread crest path bottom" in status
                  else "thread band bottom")
    for zmm, key in [(f["finish_h"], "finish height"),
                     (f["finish_h"] - f["top_land"], top_key),
                     (f["finish_h"] - f["top_land"] - f["thread_band"], bottom_key),
                     (0.0, "finish height")]:
        d.line([(X(-f["major_d"] / 2 - 1.5), Y(zmm)), (X(f["major_d"] / 2 + 1.5), Y(zmm))],
               fill=col(key), width=2)
    if "bead_z" in f:
        d.line([(X(-f["major_d"] / 2 - 1), Y(f["bead_z"])), (X(f["major_d"] / 2 + 1), Y(f["bead_z"]))],
               fill=col("transfer bead OD"), width=2)

    # dimension report card
    card = Image.new("RGB", (CELL, CELL), "#101010")
    dc = ImageDraw.Draw(card)
    dc.text((14, 10), "DIMENSION REPORT", font=font(24), fill="#EFE9DE")
    dc.text((14, 42), "source  blender  dev  tol", font=font(17), fill="#777")
    y = 70
    for r in rep["rows"]:
        c = "#38C172" if r["status"] == "PASS" else "#E3342F"
        dc.text((14, y), f"{r['dim'][:20]:<21}", font=font(17), fill="#CCC")
        dc.text((14, y + 20),
                f"  {r['source']:>6.2f}  {r['blender']:>6.2f}  "
                f"{r['deviation']:>+6.3f}  {r['tolerance']:.2f}  {r['status']}",
                font=font(17), fill=c)
        y += 46
    dc.text((14, CELL - 40), "OVERALL: " + ("PASS" if overall else "FAIL"),
            font=font(26), fill="#38C172" if overall else "#E3342F")

    cols = []
    if a.drawing and a.drawing.exists():
        cols.append(("ENGINEERING DRAWING", fit(Image.open(a.drawing).convert("RGB"), CELL, CELL, "#FFFFFF")))
    else:
        cols.append(("ENGINEERING DRAWING", fit(Image.new("RGB", (10, 10), "#242424"), CELL, CELL)))
    cols.append(("ORTHO FRONT", fit(ortho, CELL, CELL)))
    cols.append(("OVERLAY (spec rulers)", fit(ov, CELL, CELL)))
    cols.append(("45° THREAD", fit(Image.open(a.qa / "persp-45.png").convert("RGB"), CELL, CELL)))
    cols.append(("SECTION", fit(Image.open(a.qa / "section.png").convert("RGB"), CELL, CELL)))
    cols.append(("REPORT", card))

    spin_files = sorted(a.qa.glob("spin-*.png"))
    sw = CELL * len(cols) + GAP * (len(cols) - 1)
    spin_cell = (sw - GAP * (len(spin_files) - 1)) // len(spin_files)
    HEAD, LBL, SPIN_LBL = 96, 34, 44
    sh = spin_cell * 1600 // 1400
    H = HEAD + LBL + CELL + SPIN_LBL + sh + PAD
    sheet = Image.new("RGB", (sw + PAD * 2, H + PAD), "#1B1B1B")
    d = ImageDraw.Draw(sheet)
    d.text((PAD, 12), f"FINISH QA — {a.finish}   ({rep['finish']})",
           font=font(34), fill="#EFE9DE")
    d.text((PAD, 56), "GCMI 415 · 8 TPI · true swept helix · matte geometry stage",
           font=font(19), fill="#9C9C94")
    x = PAD
    for label, tile in cols:
        d.text((x + 4, HEAD + 4), label, font=font(18), fill="#9C9C94")
        sheet.paste(tile, (x, HEAD + LBL))
        x += CELL + GAP
    y0 = HEAD + LBL + CELL + 10
    d.text((PAD + 4, y0), "TRUE-HELIX SPIN TEST — 0/45/90/135/180/270: crests must "
           "cross the fixed reference line (identical rings at every angle = FAIL)",
           font=font(18), fill="#9C9C94")
    x = PAD
    # fixed dashed reference line at one crest height across every frame —
    # a helix's crest visibly departs from it as the finish rotates
    ref_frac = 0.5 - ((f["finish_h"] - f["top_land"] - 1.2) - f["finish_h"] / 2.0) / (f["finish_h"] * 1.6)
    for sp in spin_files:
        tile = fit(Image.open(sp).convert("RGB"), spin_cell, sh)
        td = ImageDraw.Draw(tile)
        yr = int(ref_frac * sh)
        for xx in range(0, spin_cell, 16):
            td.line([(xx, yr), (xx + 8, yr)], fill="#E3A008", width=2)
        sheet.paste(tile, (x, y0 + SPIN_LBL - 12))
        x += spin_cell + GAP
    a.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.out)
    print(f"QA_SHEET {a.out}  overall {'PASS' if overall else 'FAIL'}")


main()
