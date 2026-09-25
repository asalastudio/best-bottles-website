#!/usr/bin/env python3
"""
Fit, measure and lock the Sunburst body-plate samples, then build the review sheet.

  python3 scripts/register/phase3/sunburst_qa.py

Enhancement never sets size (scripts/sunburst-heroes/README.md): each render is fitted back onto the master
geometry (rim -> seat, foot -> foot, barrel width, axis), measured against the master silhouette, and its
alpha locked to the master so all five share one outline. Writes .../sunburst/final/<glass>.png,
sunburst/qa.json and sunburst/review-sunburst.png.
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

import cut_pilot as cp
import review_sheet as rs

BASE = cp.OUT / "sunburst"
PLACE = json.loads((BASE / "inputs" / "placement.json").read_text())
MASTER = np.asarray(Image.open(BASE / "inputs" / "master-mask.png")) > 127
GLASSES = ["Clear", "Amber", "Cobalt Blue", "Frosted", "Swirl"]
slug = lambda g: g.lower().replace(" ", "-")


def edge(x):
    return x ^ ndi.binary_erosion(x)


def compare(g, m):
    iou = (g & m).sum() / (g | m).sum()
    dm, dg = ndi.distance_transform_edt(~edge(m)), ndi.distance_transform_edt(~edge(g))
    dev = np.concatenate([dm[edge(g)], dg[edge(m)]])
    return float(iou), float(dev.max()), float(np.percentile(dev, 95))


def fit(img: Image.Image) -> Image.Image:
    """Scale the render so rim, foot, barrel width and axis land on the master's."""
    r = cp.measure_body(img)
    ref = cp.measure_body(Image.fromarray((MASTER * 255).astype(np.uint8)).convert("L").point(lambda v: v).convert("RGBA") if False else master_rgba())
    sx = ref["barrelPx"] / r["barrelPx"]
    sy = (ref["foot"] - ref["rim"]) / (r["foot"] - r["rim"])
    big = img.resize((round(img.width * sx), round(img.height * sy)), Image.LANCZOS)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(big, (round(ref["axisX"] - r["axisX"] * sx), round(ref["rim"] - r["rim"] * sy)))
    return out


_master_rgba = None
def master_rgba() -> Image.Image:
    global _master_rgba
    if _master_rgba is None:
        a = Image.fromarray((MASTER * 255).astype(np.uint8))
        _master_rgba = Image.new("RGBA", a.size, (255, 255, 255, 0))
        _master_rgba.putalpha(a)
    return _master_rgba


def main():
    (BASE / "final").mkdir(parents=True, exist_ok=True)
    geometry_alpha = Image.open(BASE / "inputs" / "geometry.png")  # clear on white: use the mask for the soft lock edge
    soft = Image.fromarray(ndi.gaussian_filter(MASTER.astype(float), 0.8).clip(0, 1).__mul__(255).astype(np.uint8))
    qa = {"placement": PLACE, "glasses": {}}
    finals = {}
    for glass in GLASSES:
        raw = Image.open(BASE / "renders" / f"{slug(glass)}.png").convert("RGBA")
        raw_iou, raw_max, raw_p95 = compare(np.asarray(raw.getchannel("A")) > 127, MASTER)
        fitted = fit(raw)
        g = np.asarray(fitted.getchannel("A")) > 127
        iou, dmax, p95 = compare(g, MASTER)
        m = cp.measure_body(fitted)
        locked = fitted.copy()
        locked.putalpha(Image.fromarray(np.minimum(np.asarray(fitted.getchannel("A")), np.asarray(soft))))
        locked.save(BASE / "final" / f"{slug(glass)}.png", optimize=True)
        finals[glass] = locked
        meta = json.loads((BASE / "renders" / f"{slug(glass)}.png.json").read_text())
        qa["glasses"][glass] = {"raw": {"iou": round(raw_iou, 4), "edgeMaxPx": round(raw_max, 1), "edgeP95Px": round(raw_p95, 1)},
                                "fitted": {"iou": round(iou, 4), "edgeMaxPx": round(dmax, 1), "edgeP95Px": round(p95, 1),
                                           "shoulderY": m["shoulderY"], "masterShoulderY": PLACE["shoulderY"]},
                                "costUsd": meta["costUsd"], "prompt": meta["prompt"]}
        print(f"{glass:12} raw IoU {raw_iou:.4f} (max {raw_max:.0f}px)  fitted IoU {iou:.4f} (max {dmax:.0f}px, p95 {p95:.1f}px)  shoulder {m['shoulderY']} vs {PLACE['shoulderY']}")
    (BASE / "qa.json").write_text(json.dumps(qa, indent=1) + "\n")

    # ---------- review sheet ----------
    S = 1 / 3  # display: 768x2304 -> 256x768
    cw, ch = 256, 768
    sheet = Image.new("RGBA", (40 + 5 * (2 * cw + 30), 60 + ch + 70 + ch + 90), rs.BONE)
    d = ImageDraw.Draw(sheet)
    d.text((20, 14), "Sunburst samples, 17-415 Cylinder 9 mL. Top: original photo fitted to the master | Sunburst, fitted and locked. Bottom: parts seated by anchors.", fill=rs.INK, font=rs.FB)
    parts = {"Clear": "CMP-SPR-BLK-17-415-01", "Amber": "CMP-ROC-SGLD-17415", "Cobalt Blue": "CMP-LPM-MSLV-17-415",
             "Frosted": "CMP-ROC-PNK-17415-DOT", "Swirl": "LIB-17-415-MtlRollon"}
    comps = {e["componentId"]: e for e in rs.DATA["components"]}
    for i, glass in enumerate(GLASSES):
        x = 20 + i * (2 * cw + 30)
        src_path = BASE / "inputs" / ("geometry.png" if glass == "Clear" else f"{slug(glass)}-material.png")
        src = Image.open(src_path).convert("RGBA").resize((cw, ch), Image.LANCZOS)
        fin = finals[glass].resize((cw, ch), Image.LANCZOS)
        sheet.alpha_composite(rs.on_bone(src), (x, 50))
        sheet.alpha_composite(rs.on_bone(fin), (x + cw, 50))
        q = qa["glasses"][glass]["fitted"]
        d.text((x, 50 + ch + 8), glass, fill=rs.INK, font=rs.FB)
        d.text((x, 50 + ch + 32), f"fitted IoU {q['iou']:.3f} · edge p95 {q['edgeP95Px']:.1f}px · max {q['edgeMaxPx']:.0f}px", fill=rs.INK, font=rs.FS)
        plate = {"file": f"sunburst/final/{slug(glass)}.png", "pxPerMm": PLACE["pxPerMm"],
                 "anchors": {"axisX": PLACE["axisX"], "seatY": PLACE["seatY"], "shoulderY": PLACE["shoulderY"], "baselineY": PLACE["footY"]}}
        cell = rs.render(plate, comps[parts[glass]]["layers"], size=(2 * cw, ch), rim_at=210)
        sheet.alpha_composite(cell, (x, 50 + ch + 70))
        d.text((x, 50 + 2 * ch + 76), parts[glass], fill=rs.INK, font=rs.FS)
    sheet.convert("RGB").save(BASE / "review-sunburst.png", optimize=True)
    print(BASE / "review-sunburst.png")


if __name__ == "__main__":
    main()
