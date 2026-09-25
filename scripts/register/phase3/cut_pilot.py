#!/usr/bin/env python3
"""
Component register, Phase 3: cut and measure the 17-415 Cylinder 9 mL pilot from the master PSDs.

  python3 scripts/register/phase3/cut_pilot.py

Reads BB-PSD-Files-Master (read-only) and data/register/*.csv. Writes
  output/register-phase3/pilot/{plates,components}/*.png   native-resolution cut-outs (gitignored)
  data/register/phase3/pilot-measurements.json              every anchor, scale and self-check (committed)

Coordinate contract (docs/COMPONENT_REGISTER_PHASE_2_SCHEMA.md §4): every image keeps its native
pixels and its own pxPerMm. A body plate carries axisX / seatY (the rim) / shoulderY / baselineY.
A component layer carries one anchor: the point on that layer that lands on the body's (axisX, seatY).

How component anchors are measured, not guessed: each library component PSD is registered against the
same closure as it sits, screwed down, on the matching CAPPED clear 9 mL bottle PSD. The registration
gives the library layer's scale relative to the bottle photo (so its px/mm) and where the bottle's rim
falls on the library layer (so its anchor). The overlap score of that registration is the self-check.
"""
from __future__ import annotations

import csv
import hashlib
import itertools
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[3]
REGISTER = ROOT / "data" / "register"
OUT = ROOT / "output" / "register-phase3" / "pilot"
MEASURE = REGISTER / "phase3" / "pilot-measurements.json"
INVENTORY = json.loads((ROOT / "data" / "paper-doll" / "component-library-inventory.json").read_text())
PSD_ROOT = Path(INVENTORY["root"])
BOTTLES = PSD_ROOT / "3.  17-415 Bottles"

BODY_ID = "cylinder-9ml-17-415"
import math
# Scale basis. The catalogue says 70 x 20 mm, but these photos were shot from ~6 deg above: the kit-fit
# study (memory project_cyl9_clear_master_kitfit_2026_09_23, CYL_SPECS["009_kitfit"]) matched the 17-415
# 9 mL silhouettes to a 72.2 x 19.3 mm cylinder at 6 deg, IoU .954.
# Every glass is the same mould, so every plate stands at the SAME height (Jordan 2026-09-25: "the clear
# needs to be brought up to the same height as all the other bottles"): px/mm = seat-to-foot pixels /
# the apparent height at 6 deg (H cos + D sin = 73.8 mm). The barrel width at alpha 0.5 against 19.3 mm
# is the independent +-2% check.
FIT_H_MM, FIT_D_MM, TILT_DEG = 72.2, 19.3, 6.0
APPARENT_H_MM = FIT_H_MM * math.cos(math.radians(TILT_DEG)) + FIT_D_MM * math.sin(math.radians(TILT_DEG))
CATALOGUE_MM = {"heightBare": 70.0, "diameter": 20.0}
# Plates that fail the size gate but were accepted by name. The gate result stays recorded; the ruling
# makes the plate approvable.
ACCEPTED = {
    "Amber": "Jordan 2026-09-25: accepted; the Amber and Cobalt files share one photo 2.6% slimmer than the fit",
    "Cobalt Blue": "Jordan 2026-09-25: accepted; the Amber and Cobalt files share one photo 2.6% slimmer than the fit",
}
GLASS = {  # glass -> (uncapped folder, capped folder)
    "Clear": ("9. Clear  (Uncapped)", "10. Clear  (Capped)"),
    "Amber": ("3. Amber 9ml (Uncapped)", "4. Amber 9ml (Capped)"),
    "Cobalt Blue": ("1. Cobalt Blue 9ml  (Uncapped)", "2. Cobalt Blue 9ml  (Capped)"),
    "Frosted": ("5. Frosted 9ml (Uncapped)", "6. Frosted 9ml (Capped)"),
    "Swirl": ("7. Swirl 9ml (Uncapped)", "8. Swirl 9ml (Capped)"),
}
ALPHA = 128           # silhouette threshold
# Jordan 2026-09-25 ("those look fine. Let's use those."): the body plates are the five Sunburst renders on
# one locked geometry (scripts/register/phase3/sunburst_*.py/.mjs), each fitted to the Clear master and
# alpha-locked to its outline. The photo plate each came from is kept on the record as `photoPlate`.
USE_SUNBURST_PLATES = True


def sha(img: Image.Image) -> str:
    return hashlib.sha256(img.tobytes()).hexdigest()


def alpha(img: Image.Image) -> np.ndarray:
    return np.asarray(img.getchannel("A"))


def pixel_layers(psd: PSDImage) -> list:
    """Visible pixel layers that are not the full-canvas white ground, flattened out of groups."""
    out = []
    def walk(layers):
        for layer in layers:
            if not layer.visible:
                continue
            if layer.is_group():
                walk(layer)
                continue
            l, t, r, b = layer.bbox
            if l <= 0 and t <= 0 and r >= psd.width and b >= psd.height:
                continue  # Background / Layer 0
            out.append(layer)
    walk(psd)
    return out


_ORDER: dict[int, dict[int, int]] = {}


def canvas_of(psd: PSDImage, layers: list) -> Image.Image:
    """The chosen layers, each from its own pixels, composited bottom-up on a transparent canvas."""
    order = {id(l): i for i, l in enumerate(psd.descendants())}  # not cached: object ids are reused after garbage collection
    canvas = Image.new("RGBA", psd.size, (0, 0, 0, 0))
    for layer in sorted(layers, key=lambda l: order[id(l)]):
        pix = layer.composite()
        if pix is None:
            continue
        pix = pix.convert("RGBA")
        l, t = layer.bbox[0], layer.bbox[1]
        sheet = Image.new("RGBA", psd.size, (0, 0, 0, 0))
        sheet.paste(pix, (l, t))  # PIL clips anything outside the canvas
        canvas = Image.alpha_composite(canvas, sheet)
    return canvas


def box(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def measure_body(img: Image.Image) -> dict:
    """Rim (seat), foot, barrel axis and width, shoulder (highest row at >= 92% of the barrel width)."""
    m = alpha(img) > ALPHA
    left, top, right, bottom = box(m)
    rows = range(top + int(0.4 * (bottom - top)), top + int(0.85 * (bottom - top)))
    widths, centres = [], []
    for y in rows:
        xs = np.where(m[y])[0]
        if xs.size == 0:
            continue  # a clear body can have see-through rows; they carry no width
        widths.append(xs.max() - xs.min() + 1)
        centres.append((xs.max() + xs.min() + 1) / 2)
    barrel = float(np.median(widths)) if widths else float(right - left)
    axis = float(np.median(centres)) if centres else (left + right) / 2
    shoulder = next(y for y in range(top, bottom) if m[y].any() and (np.where(m[y])[0].max() - np.where(m[y])[0].min() + 1) >= 0.92 * barrel)
    px_per_mm = (bottom - top) / APPARENT_H_MM
    width = barrel / px_per_mm
    return {"rim": top, "foot": bottom, "axisX": axis, "barrelPx": barrel, "shoulderY": shoulder, "pxPerMm": px_per_mm,
            "diameterMm": width, "widthErrorPct": 100 * (width - FIT_D_MM) / FIT_D_MM}


def body_layer(psd: PSDImage):
    tall = [l for l in pixel_layers(psd) if (l.bbox[3] - l.bbox[1]) > 0.5 * psd.height]
    if len(tall) != 1:
        raise SystemExit(f"expected one body layer, found {[(l.name, l.bbox) for l in tall]}")
    return tall[0]


def crop_save(img: Image.Image, path: Path, pad: int = 6) -> tuple[Image.Image, int, int]:
    l, t, r, b = box(alpha(img) > 0)
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(img.width, r + pad), min(img.height, b + pad)
    cut = img.crop((l, t, r, b))
    path.parent.mkdir(parents=True, exist_ok=True)
    cut.save(path, optimize=True)
    return cut, l, t


def iou_after_fit(lib: np.ndarray, ref: np.ndarray) -> tuple[float, float, tuple[float, float]]:
    """Scale lib's silhouette to ref's bbox width, align bbox bottoms and centres, return (IoU, scale, offset)."""
    ll, lt, lr, lb = box(lib)
    rl, rt, rr, rb = box(ref)
    s = (rr - rl) / (lr - ll)
    h = max(1, int(round((lb - lt) * s)))
    w = rr - rl
    scaled = np.asarray(Image.fromarray((lib[lt:lb, ll:lr] * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)) > 127
    canvas = np.zeros_like(ref)
    y0 = rb - h  # bottoms aligned: the skirt is the part that must seat exactly
    ys, ye = max(0, y0), min(ref.shape[0], y0 + h)
    canvas[ys:ye, rl:rl + w] = scaled[ys - y0:ye - y0, :]
    inter = np.logical_and(canvas, ref).sum()
    union = np.logical_or(canvas, ref).sum()
    # library point (x, y) -> reference point: rl + (x - ll) * s, y0 + (y - lt) * s
    return float(inter / union), float(s), (float(rl - ll * s), float(y0 - lt * s))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    comps = {r["componentId"]: r for r in csv.DictReader((REGISTER / "components.csv").open())}
    asm = [r for r in csv.DictReader((REGISTER / "assemblies.csv").open()) if r["bodyId"] == BODY_ID]
    result = {"bodyId": BODY_ID, "psdRoot": str(PSD_ROOT), "catalogueMm": CATALOGUE_MM,
              "scaleBasis": {"method": "seat-to-foot = apparent height of the fitted bottle at the camera tilt (every glass the same height); barrel width is the check",
                             "fitHeightMm": FIT_H_MM, "fitDiameterMm": FIT_D_MM,
                             "cameraTiltDeg": TILT_DEG, "expectedApparentHeightMm": round(APPARENT_H_MM, 2), "gatePct": 2.0,
                             "source": "kit-fit study 2026-09-23 (CYL_SPECS['009_kitfit'])"},
              "plates": [], "components": []}

    # ---------- body plates: one per glass, from the UNCAPPED PSD ----------
    for glass, (uncapped, _) in GLASS.items():
        folder = BOTTLES / uncapped
        psd_path = sorted(folder.glob("*.psd"), key=lambda p: int(p.name.split(".")[0]))[0]
        psd = PSDImage.open(psd_path)
        layer = body_layer(psd)
        full = canvas_of(psd, [layer])
        cut, ox, oy = crop_save(full, OUT / "plates" / f"{BODY_ID}--{glass.lower().replace(' ', '-')}.png")
        m = measure_body(cut)
        result["plates"].append({
            "plateKey": f"{BODY_ID}|{glass}", "glass": glass, "file": f"plates/{BODY_ID}--{glass.lower().replace(' ', '-')}.png",
            "width": cut.width, "height": cut.height, "sha256": sha(cut), "pxPerMm": round(m["pxPerMm"], 4),
            "anchors": {"axisX": round(m["axisX"], 1), "seatY": m["rim"], "shoulderY": m["shoulderY"], "baselineY": m["foot"]},
            "checks": {"barrelPx": m["barrelPx"], "diameterMm": round(m["diameterMm"], 2), "widthErrorPct": round(m["widthErrorPct"], 2),
                       "passes": abs(m["widthErrorPct"]) <= 2.0, "acceptedBy": ACCEPTED.get(glass),
                       "approvable": abs(m["widthErrorPct"]) <= 2.0 or glass in ACCEPTED},
            "source": {"library": "BB-PSD-Files-Master", "path": str(psd_path.relative_to(PSD_ROOT)), "layer": layer.name},
        })
        print(f"plate {glass:12} {cut.width}x{cut.height}  {m['pxPerMm']:.3f} px/mm  rim {m['rim']} shoulder {m['shoulderY']} foot {m['foot']}  width {m['diameterMm']:.2f} mm vs {FIT_D_MM} ({m['widthErrorPct']:+.1f}%)")

    # ---------- approved Sunburst renders replace the photo plates (same anchors for every glass) ----------
    sun = OUT / "sunburst" / "final"
    if USE_SUNBURST_PLATES and sun.exists():
        # Every render's outline is locked to the master, so the master mask is the one geometry to measure:
        # per-image measurement would only add half-pixel antialiasing noise between glasses.
        master_mask = Image.open(OUT / "sunburst" / "inputs" / "master-mask.png").convert("L")
        master_rgba = Image.new("RGBA", master_mask.size, (255, 255, 255, 0))
        master_rgba.putalpha(master_mask)
        m = measure_body(master_rgba)
        for p in result["plates"]:
            final = sun / f"{p['glass'].lower().replace(' ', '-')}.png"
            img = Image.open(final).convert("RGBA")
            photo = {k: p[k] for k in ("file", "width", "height", "sha256", "pxPerMm", "anchors", "checks", "source")}
            p.update({
                "file": str(final.relative_to(OUT)), "width": img.width, "height": img.height, "sha256": sha(img),
                "pxPerMm": round(m["pxPerMm"], 4),
                "anchors": {"axisX": round(m["axisX"], 1), "seatY": m["rim"], "shoulderY": m["shoulderY"], "baselineY": m["foot"]},
                "checks": {"barrelPx": m["barrelPx"], "diameterMm": round(m["diameterMm"], 2), "widthErrorPct": round(m["widthErrorPct"], 2),
                           "passes": abs(m["widthErrorPct"]) <= 2.0, "acceptedBy": None, "approvable": abs(m["widthErrorPct"]) <= 2.0},
                "source": {"library": "gpt-image-2.5-sunburst (approved by Jordan 2026-09-25)", "path": result["plates"][0]["source"]["path"] if False else photo["source"]["path"],
                           "layer": f"geometry: Clear plate x2.2; material: {p['glass']} photo" + ("; baked on bone #F5F3EF" if p["glass"] in ("Clear", "Swirl") else "")},
                "derivedFrom": photo["sha256"],
                "photoPlate": photo,
            })
            print(f"plate {p['glass']:12} -> Sunburst {img.width}x{img.height}  {m['pxPerMm']:.3f} px/mm  rim {m['rim']} shoulder {m['shoulderY']} foot {m['foot']}  width {m['diameterMm']:.2f} mm ({m['widthErrorPct']:+.1f}%)")

    # ---------- components: library PSD registered against the capped clear bottle ----------
    capped_dir = BOTTLES / GLASS["Clear"][1]
    capped_files = {p.name.split(". ", 1)[1].removesuffix(".psd"): p for p in capped_dir.glob("*.psd")}
    wanted = {}
    for a in asm:
        for part in filter(None, a["buildParts"].split("; ")):
            role, cid = part.split(":")
            if not cid.startswith("LIB-") and a["glass"] == "Clear" and a["websiteSku"] in capped_files:
                wanted.setdefault(cid, a["websiteSku"])
    for a in asm:  # components only sold on coloured glass still need a clear capped reference
        for part in filter(None, a["buildParts"].split("; ")):
            role, cid = part.split(":")
            if not cid.startswith("LIB-") and cid not in wanted:
                clear_twin = a["websiteSku"].replace("Amb9", "9").replace("Blu9", "9").replace("Frst9", "9").replace("Swrl9", "9")
                if clear_twin in capped_files:
                    wanted[cid] = clear_twin
    pilot_components = sorted({p.split(":")[1] for a in asm for p in a["buildParts"].split("; ") if p and not p.split(":")[1].startswith("LIB-")})
    missing = [c for c in pilot_components if c not in wanted]
    if missing:
        print(f"no capped clear reference for: {missing}")

    for cid in pilot_components:
        c = comps[cid]
        lib_psd = PSDImage.open(PSD_ROOT / c["psdLibrary"] / c["psdPath"])
        lib_layers = pixel_layers(lib_psd)
        lib_full = canvas_of(lib_psd, lib_layers)
        lib_mask = alpha(lib_full) > ALPHA
        ref_sku = wanted.get(cid)
        entry = {"componentId": cid, "websiteSku": c["websiteSku"], "type": c["type"], "psd": f"{c['psdLibrary']}/{c['psdPath']}",
                 "reference": None, "layers": [], "checks": {}}
        if not ref_sku:
            entry["checks"]["status"] = "no capped reference"
            result["components"].append(entry)
            continue
        ref_psd = PSDImage.open(capped_files[ref_sku])
        body = body_layer(ref_psd)
        body_img = canvas_of(ref_psd, [body])
        bm = measure_body(body_img)
        others = [l for l in pixel_layers(ref_psd) if l is not body]
        best = None
        for k in range(1, len(others) + 1):
            for subset in itertools.combinations(others, k):
                ref_mask = alpha(canvas_of(ref_psd, list(subset))) > ALPHA
                if ref_mask.sum() < 50:
                    continue  # a layer with no solid pixels (e.g. a faint highlight) cannot anchor anything
                score, s, off = iou_after_fit(lib_mask, ref_mask)
                if best is None or score > best[0]:
                    best = (score, s, off, subset)
        score, s, (tx, ty), subset = best
        # rim point (bottle photo) -> library canvas; library px/mm = bottle px/mm / s
        anchor_lib = ((bm["axisX"] - tx) / s, (bm["rim"] - ty) / s)
        lib_px_per_mm = bm["pxPerMm"] / s
        entry["reference"] = {"psd": str(capped_files[ref_sku].relative_to(PSD_ROOT)), "matchedLayers": [l.name for l in subset],
                              "bottlePxPerMm": round(bm["pxPerMm"], 4), "rimY": bm["rim"], "axisX": round(bm["axisX"], 1)}
        entry["checks"] = {"registrationIoU": round(score, 4), "libraryScale": round(1 / s, 4)}
        # one image per library layer, each with its own crop origin and the shared anchor translated into it
        primary = {"roll-on-cap": "cap", "fine-mist-sprayer": "sprayer", "lotion-pump": "pump"}.get(c["type"], "fitment")
        ordered = sorted(lib_layers, key=lambda l: l.bbox[1])  # top to bottom: pump/cap first, collar last
        lowest = max(ordered, key=lambda l: l.bbox[3])
        for i, layer in enumerate(ordered):
            slot = "collar" if len(ordered) > 1 and layer is lowest else primary
            img = canvas_of(lib_psd, [layer])
            name = f"components/{cid}--{i}-{slot}.png"
            cut, ox, oy = crop_save(img, OUT / name)
            entry["layers"].append({"slot": slot, "layerName": layer.name, "file": name, "width": cut.width, "height": cut.height, "sha256": sha(cut),
                                    "pxPerMm": round(lib_px_per_mm, 4), "anchor": {"x": round(anchor_lib[0] - ox, 1), "y": round(anchor_lib[1] - oy, 1)},
                                    "z": "front", "explodeIndex": len(ordered) - i})
        # sprayers and pumps: the overcap exists only on the bottle photo; cut it there at the bottle's scale
        if c["type"] in ("fine-mist-sprayer", "lotion-pump"):
            rest = [l for l in others if l not in subset]
            over = [l for l in rest if l.bbox[1] < min(x.bbox[1] for x in subset)]
            if over:
                layer = over[0]
                img = canvas_of(ref_psd, [layer])
                name = f"components/{cid}--overcap.png"
                cut, ox, oy = crop_save(img, OUT / name)
                entry["layers"].append({"slot": "overcap", "layerName": f"{layer.name} (capped bottle PSD)", "file": name, "width": cut.width,
                                        "height": cut.height, "sha256": sha(cut), "pxPerMm": round(bm["pxPerMm"], 4),
                                        "anchor": {"x": round(bm["axisX"] - ox, 1), "y": round(bm["rim"] - oy, 1)}, "z": "front", "explodeIndex": len(ordered) + 1})
        print(f"{cid:24} {c['type']:18} ref {ref_sku:22} IoU {score:.3f} scale {1 / s:.3f} layers {[l['slot'] for l in entry['layers']]}")
        result["components"].append(entry)

    # ---------- roller inserts: cut from the capped clear bottle PSDs (the kits' own source), anchored at the rim ----------
    for cid, ref_sku, clip in (("LIB-17-415-MtlRollon", "GBCyl9MtlRollMattSl", True), ("LIB-17-415-PlsticRollon", "GBCyl9RollMattSl", False)):
        ref_psd = PSDImage.open(capped_files[ref_sku])
        body = body_layer(ref_psd)
        bm = measure_body(canvas_of(ref_psd, [body]))
        cap_cid = next(p.split(":")[1] for a in asm if a["websiteSku"] == ref_sku for p in a["buildParts"].split("; ") if p.startswith("cap:"))
        cap_psd = PSDImage.open(PSD_ROOT / comps[cap_cid]["psdLibrary"] / comps[cap_cid]["psdPath"])
        cap_mask = alpha(canvas_of(cap_psd, pixel_layers(cap_psd))) > ALPHA
        others = [l for l in pixel_layers(ref_psd) if l is not body]
        cap_layer = max(others, key=lambda l: iou_after_fit(cap_mask, alpha(canvas_of(ref_psd, [l])) > ALPHA)[0])
        inserts = [l for l in others if l is not cap_layer]
        img = canvas_of(ref_psd, inserts)
        a = np.asarray(img).copy()
        below = a[bm["rim"] + 1:, :, :]
        near_white = ((below[..., :3].min(axis=2) > 245) & (below[..., 3] > 200)).sum() / max(1, (below[..., 3] > 200).sum())
        if clip:
            a[bm["rim"] + 3:, :, 3] = 0  # every 17-415 metal roller layer carries a white fill below the rim (master PSD)
        img = Image.fromarray(a)
        name = f"components/{cid}.png"
        cut, ox, oy = crop_save(img, OUT / name)
        result["components"].append({"componentId": cid, "websiteSku": None, "type": "roller-insert", "psd": None,
            "reference": {"psd": str(capped_files[ref_sku].relative_to(PSD_ROOT)), "matchedLayers": [l.name for l in inserts],
                          "bottlePxPerMm": round(bm["pxPerMm"], 4), "rimY": bm["rim"], "axisX": round(bm["axisX"], 1)},
            "checks": {"nearWhiteBelowRim": round(float(near_white), 3), "clippedAtRim": clip},
            "layers": [{"slot": "roller", "layerName": ", ".join(l.name for l in inserts), "file": name, "width": cut.width, "height": cut.height,
                        "sha256": sha(cut), "pxPerMm": round(bm["pxPerMm"], 4), "anchor": {"x": round(bm["axisX"] - ox, 1), "y": round(bm["rim"] - oy, 1)},
                        "z": "behind-body", "explodeIndex": 0}]})  # the master PSDs stack both inserts under the glass
        print(f"{cid:24} roller-insert      ref {ref_sku:22} near-white below rim {near_white:.0%} clipped {clip}")

    MEASURE.parent.mkdir(parents=True, exist_ok=True)
    MEASURE.write_text(json.dumps(result, indent=1) + "\n")
    print(f"wrote {MEASURE.relative_to(ROOT)} and {len(list(OUT.rglob('*.png')))} images under {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
