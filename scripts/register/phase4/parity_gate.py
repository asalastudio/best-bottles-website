#!/usr/bin/env python3
"""
Phase 4, step 3: the per-SKU parity gate (Phase 2 §6).

  python3 scripts/register/phase4/parity_gate.py

For every pilot SKU that has a legacy kit, compares the register render with
the legacy composite (both from render.ts, both in the kit's own frame) and
writes data/register/phase4/parity-pilot.json (committed) plus review sheets
in output/register-phase4/ (gitignored).

What is measured, per SKU, at 1000 × 1100:
  seat / foot   the first and last rows of the body's alpha, new vs legacy (px)
  body          overlap (IoU) of the row-filled body silhouettes, plus the
                95th-percentile and largest outline distance (px)
  closure       overlap of the closure parts (cap, sprayer, pump, collar,
                overcap) as drawn, new vs legacy
  behind        overlap of the roller insert above the rim (the metal insert is
                clipped at the rim in the register, so only the visible part counts)
  silhouette    overlap of the whole assembly's row-filled silhouette

Gate (proposed thresholds, to be confirmed with Jordan): seat and foot within
2 px, body IoU ≥ 0.97, closure IoU ≥ 0.90, silhouette IoU ≥ 0.95. A SKU passes
when every check passes. Thresholds are arguments so a ruling changes one
number, not the measurement.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RENDERS = os.path.join(ROOT, "output", "register-phase4", "renders")
OUT_JSON = os.path.join(ROOT, "data", "register", "phase4", "parity-pilot.json")
SHEETS = os.path.join(ROOT, "output", "register-phase4")
BONE = (245, 243, 239)
ALPHA = 16


def alpha(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA").getchannel("A"))


def span(a: np.ndarray, thr: int = ALPHA) -> np.ndarray:
    """Silhouette with every row filled edge to edge (the bodies QA metric): clear glass is see-through."""
    m = a > thr
    return np.maximum.accumulate(m, axis=1) & np.maximum.accumulate(m[:, ::-1], axis=1)[:, ::-1]


def edge(x: np.ndarray) -> np.ndarray:
    return x ^ ndi.binary_erosion(x)


def compare(g: np.ndarray, m: np.ndarray) -> tuple[float, float, float]:
    """IoU, largest and 95th-percentile outline distance in px (from build_bodies.py)."""
    union = (g | m).sum()
    iou = float((g & m).sum() / max(1, union))
    if not g.any() or not m.any():
        return iou, float("nan"), float("nan")
    dm, dg = ndi.distance_transform_edt(~edge(m)), ndi.distance_transform_edt(~edge(g))
    dev = np.concatenate([dm[edge(g)], dg[edge(m)]])
    return iou, float(dev.max()), float(np.percentile(dev, 95))


def rows(a: np.ndarray, thr: int = ALPHA) -> tuple[int | None, int | None]:
    ys = np.nonzero((a > thr).any(axis=1))[0]
    return (int(ys[0]), int(ys[-1])) if len(ys) else (None, None)


def measure(item: dict, thresholds: dict) -> dict:
    d = os.path.join(RENDERS, item["websiteSku"])
    new_body, legacy_body = alpha(os.path.join(d, "new-body.png")), alpha(os.path.join(d, "legacy-body.png"))
    new_closure, legacy_closure = alpha(os.path.join(d, "new-closure.png")), alpha(os.path.join(d, "legacy-closure.png"))
    new_behind, legacy_behind = alpha(os.path.join(d, "new-behind.png")), alpha(os.path.join(d, "legacy-behind.png"))
    new_all, legacy_all = alpha(os.path.join(d, "new.png")), alpha(os.path.join(d, "legacy.png"))

    n_top, n_foot = rows(new_body)
    l_top, l_foot = rows(legacy_body)
    seat_delta = abs(n_top - l_top) if n_top is not None and l_top is not None else None
    foot_delta = abs(n_foot - l_foot) if n_foot is not None and l_foot is not None else None
    body_iou, body_max, body_p95 = compare(span(new_body), span(legacy_body))
    closure_iou, closure_max, closure_p95 = compare(new_closure > ALPHA, legacy_closure > ALPHA)
    rim = int(round(item["frame"]["seatY"]))
    above = np.zeros_like(new_behind, dtype=bool)
    above[:rim, :] = True
    nb, lb = (new_behind > ALPHA) & above, (legacy_behind > ALPHA) & above
    behind_iou = float((nb & lb).sum() / max(1, (nb | lb).sum())) if (nb | lb).any() else None
    sil_iou, sil_max, sil_p95 = compare(span(new_all), span(legacy_all))

    checks = {
        "seat": seat_delta is not None and seat_delta <= thresholds["seatPx"],
        "foot": foot_delta is not None and foot_delta <= thresholds["footPx"],
        "body": body_iou >= thresholds["bodyIou"],
        "closure": closure_iou >= thresholds["closureIou"],
        "silhouette": sil_iou >= thresholds["silhouetteIou"],
    }
    return {
        "websiteSku": item["websiteSku"], "graceSku": item["graceSku"], "glass": item["glass"], "fitmentType": item["fitmentType"],
        "capColor": item["capColor"], "buildParts": item["buildParts"], "frameSource": item["frameSource"],
        "seat": {"new": n_top, "legacy": l_top, "deltaPx": seat_delta},
        "foot": {"new": n_foot, "legacy": l_foot, "deltaPx": foot_delta},
        "body": {"iou": round(body_iou, 4), "edgeP95Px": round(body_p95, 2), "edgeMaxPx": round(body_max, 2)},
        "closure": {"iou": round(closure_iou, 4), "edgeP95Px": round(closure_p95, 2), "edgeMaxPx": round(closure_max, 2)},
        "behindAboveRim": {"iou": round(behind_iou, 4) if behind_iou is not None else None},
        "silhouette": {"iou": round(sil_iou, 4), "edgeP95Px": round(sil_p95, 2), "edgeMaxPx": round(sil_max, 2)},
        "checks": checks,
        "passes": all(checks.values()),
    }


def font(size: int):
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def on_bone(path: str, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGBA").resize(size, Image.LANCZOS)
    cell = Image.new("RGBA", size, BONE + (255,))
    cell.alpha_composite(img)
    return cell


def overlay(new_path: str, legacy_path: str, size: tuple[int, int] | None = None) -> Image.Image:
    """Legacy silhouette in blue, register render in gold; overlap reads dark. Misalignment shows as fringes."""
    new_img, legacy_img = Image.open(new_path).convert("RGBA"), Image.open(legacy_path).convert("RGBA")
    size = size or new_img.size
    n = np.asarray(new_img.resize(size, Image.LANCZOS).getchannel("A")) > ALPHA
    l = np.asarray(legacy_img.resize(size, Image.LANCZOS).getchannel("A")) > ALPHA
    rgb = np.full((size[1], size[0], 3), BONE, dtype=np.uint8)
    rgb[l & ~n] = (70, 120, 190)
    rgb[n & ~l] = (200, 150, 60)
    rgb[n & l] = (60, 60, 65)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def sheets(results: list[dict], thresholds: dict) -> list[str]:
    cell = (200, 220)
    per_row, per_sheet = 4, 20
    f, fs = font(13), font(11)
    written = []
    ordered = sorted(results, key=lambda r: (r["passes"], r["closure"]["iou"]))
    for start in range(0, len(ordered), per_sheet):
        chunk = ordered[start:start + per_sheet]
        rows_n = (len(chunk) + per_row - 1) // per_row
        w, h = per_row * (cell[0] * 3 + 30) + 20, rows_n * (cell[1] + 56) + 50
        sheet = Image.new("RGBA", (w, h), BONE + (255,))
        d = ImageDraw.Draw(sheet)
        d.text((16, 12), f"Parity gate, 17-415 Cylinder 9 mL. Each SKU: legacy kit | register render | overlay (blue = legacy only, gold = register only). "
               f"Thresholds: seat/foot ≤ {thresholds['seatPx']} px, body ≥ {thresholds['bodyIou']}, closure ≥ {thresholds['closureIou']}, silhouette ≥ {thresholds['silhouetteIou']}.", fill=(28, 28, 30), font=f)
        for i, r in enumerate(chunk):
            x, y = 16 + (i % per_row) * (cell[0] * 3 + 30), 40 + (i // per_row) * (cell[1] + 56)
            dr = os.path.join(RENDERS, r["websiteSku"])
            sheet.alpha_composite(on_bone(os.path.join(dr, "legacy.png"), cell), (x, y))
            sheet.alpha_composite(on_bone(os.path.join(dr, "new.png"), cell), (x + cell[0] + 5, y))
            sheet.alpha_composite(overlay(os.path.join(dr, "new.png"), os.path.join(dr, "legacy.png"), cell), (x + 2 * (cell[0] + 5), y))
            colour = (60, 130, 80) if r["passes"] else (190, 50, 40)
            d.text((x, y + cell[1] + 4), f"{r['websiteSku']}  {r['glass']} · {r['fitmentType']} · {r['capColor']}", fill=(28, 28, 30), font=f)
            d.text((x, y + cell[1] + 22), f"seat Δ{r['seat']['deltaPx']} foot Δ{r['foot']['deltaPx']} · body {r['body']['iou']:.3f} (p95 {r['body']['edgeP95Px']:.1f} px) · "
                   f"closure {r['closure']['iou']:.3f} (p95 {r['closure']['edgeP95Px']:.1f} px) · sil {r['silhouette']['iou']:.3f} · {'PASS' if r['passes'] else 'FAIL ' + ','.join(k for k, v in r['checks'].items() if not v)}", fill=colour, font=fs)
        path = os.path.join(SHEETS, f"review-parity-{start // per_sheet + 1}.png")
        sheet.convert("RGB").save(path, optimize=True)
        written.append(path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seat-px", type=float, default=2)
    parser.add_argument("--foot-px", type=float, default=2)
    parser.add_argument("--body-iou", type=float, default=0.97)
    parser.add_argument("--closure-iou", type=float, default=0.90)
    parser.add_argument("--silhouette-iou", type=float, default=0.95)
    args = parser.parse_args()
    thresholds = {"seatPx": args.seat_px, "footPx": args.foot_px, "bodyIou": args.body_iou, "closureIou": args.closure_iou, "silhouetteIou": args.silhouette_iou}

    manifest = json.load(open(os.path.join(RENDERS, "manifest.json"), encoding="utf8"))
    results, no_kit = [], []
    for item in manifest["items"]:
        if item["legacy"] is None:
            no_kit.append(item["websiteSku"])
            continue
        results.append(measure(item, thresholds))
        d = os.path.join(RENDERS, item["websiteSku"])
        overlay(os.path.join(d, "new.png"), os.path.join(d, "legacy.png")).convert("RGB").save(os.path.join(d, "overlay.png"), optimize=True)

    passed = [r for r in results if r["passes"]]
    by_check = {k: sum(1 for r in results if not r["checks"][k]) for k in ("seat", "foot", "body", "closure", "silhouette")}
    summary = {
        "bodyId": manifest["bodyId"], "measuredOn": date.today().isoformat(), "renderedAt": manifest["renderedAt"], "frameMode": manifest.get("frameMode", "recorded"), "canvas": manifest["canvas"],
        "datum": manifest["datum"], "thresholds": thresholds,
        "counts": {"pilotSkus": len(manifest["items"]), "withLegacyKit": len(results), "withoutLegacyKit": len(no_kit), "pass": len(passed), "fail": len(results) - len(passed)},
        "failuresByCheck": by_check,
        "distribution": {
            key: {"min": round(float(min(v)), 4), "median": round(float(np.median(v)), 4), "max": round(float(max(v)), 4)}
            for key, v in (
                ("bodyIou", [r["body"]["iou"] for r in results]), ("closureIou", [r["closure"]["iou"] for r in results]),
                ("silhouetteIou", [r["silhouette"]["iou"] for r in results]), ("seatDeltaPx", [r["seat"]["deltaPx"] for r in results if r["seat"]["deltaPx"] is not None]),
                ("footDeltaPx", [r["foot"]["deltaPx"] for r in results if r["foot"]["deltaPx"] is not None]),
                ("closureEdgeP95Px", [r["closure"]["edgeP95Px"] for r in results if not np.isnan(r["closure"]["edgeP95Px"])]),
            ) if v
        },
        "withoutLegacyKit": no_kit,
        "results": sorted(results, key=lambda r: r["websiteSku"]),
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf8") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")
    for path in sheets(results, thresholds):
        print(path)
    print(json.dumps({k: summary[k] for k in ("counts", "failuresByCheck", "distribution")}, indent=1))


if __name__ == "__main__":
    main()
