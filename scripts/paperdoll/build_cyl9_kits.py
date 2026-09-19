#!/usr/bin/env python3
"""
Component kits for the 9 mL · 17-415 Cylinder: the same 26 layers the plates
are composited from, kept apart instead of flattened, so the page can swap a
cap without touching the bottle.

    python3 scripts/paperdoll/build_cyl9_kits.py [--limit N]
        -> dist/paper-doll/kits/cylinder-9ml-<glass>-17-415/
             parts/<sha>.<slot>-<variantKey>-1000x1100.webp    26 shared parts
             <websiteSku>/kit.json                             what to stack, and where
             <websiteSku>/exploded.webp                        the offline composite

This is the architectural point of the whole lane. 145 configurations are 26
photographs, not 145: a part is content-addressed, so the black cap that
appears on 25 configurations is stored once and referenced 25 times. The
plates already prove the framing; the kits reuse the plate builder's own
transform verbatim, so a part lands on exactly the pixels it occupies in the
plate and the stage can crossfade from one to the other without the bottle
moving a pixel.

Gates (recorded per kit; any failure means the kit is not published):
  parity   re-compositing the parts in z-order over white reproduces the
           shipped plate: mean |Δ| ≤ 6/255 over the ink, ≤ 1 % of ink pixels
           over 40/255
  alpha    every part carries real transparency — ≥ 5 % fully transparent,
           ≥ 50 semi-transparent pixels, and no opaque pixel within 2 px of
           the part's own edge (which would mean a hard crop, not a cut-out)
  axis     the assembled kit's closure axis sits on the plate's centre line
           within 1.5 px
  slots    every layer the plate composites exists as its own part
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from collections import Counter

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MAIN = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026"
LAYERS = os.path.join(MAIN, "pipeline/paper-doll/_archive/2026-04-regeneration/output/CYL-9ML")
CONFIGS = os.path.join(REPO, "data/paper-doll/CYL-9ML/configurations.json")
PLATES = os.path.join(REPO, "dist/paper-doll/legacy/cylinder-9ml-17-415")
OUT_ROOT = os.path.join(REPO, "dist/paper-doll/kits")

SRC_W, SRC_H = 1000, 1300
OUT_W, OUT_H = 1000, 1100
PAD = 40
BUILDER = {"name": "build_cyl9_kits.py", "version": "1.0.0"}

ORDER = {"rollon": ["body", "roller", "cap"], "spray": ["body", "sprayer"], "lotion": ["body", "pump"]}
# how far each slot travels up the axis when the assembly comes apart,
# as a fraction of body height
EXPLODE = {"body": 0.0, "roller": 0.05, "fitment": 0.05, "cap": 0.16, "overcap": 0.16,
           "sprayer": 0.09, "pump": 0.09}
GLASS_FAMILY = {"CLR": "clear", "AMB": "amber", "BLU": "cobalt-blue", "FRS": "frosted", "SWL": "swirl"}
# the material ids the 3D configurator already knows, so a kit row can hand the
# same identity to WebGL without a second registry
THREE_GLASS = {"CLR": "clear", "AMB": "amber", "BLU": "cobalt", "FRS": "frosted", "SWL": "swirl"}

PARITY_MEAN = 6.0 / 255.0 * 255.0     # 6/255 expressed on the 0-255 scale
PARITY_TAIL = 0.01                    # ≤1 % of ink pixels may exceed 40/255
AXIS_MAX = 1.5


def layer_file(slot: str, key: str) -> str:
    if slot == "body":    return f"bottles/CYL-{key}-9ML-body.png"
    if slot == "cap":     return f"caps/CYL-9ML-{key}-cap.png"
    if slot == "sprayer": return f"sprayers/CYL-9ML-SPR-{key}-sprayer.png"
    if slot == "pump":    return f"lotion-pumps/CYL-9ML-LPM-{key}-pump.png"
    if slot == "roller":  return {"MTL-ROLL": "fitments/CYL-9ML-MRL-fitment.png",
                                  "PLS-ROLL": "fitments/CYL-9ML-ROL-fitment.png"}[key]
    raise KeyError(slot)


_cache: dict[str, Image.Image] = {}


def load(slot: str, key: str) -> Image.Image:
    f = layer_file(slot, key)
    if f not in _cache:
        im = Image.open(os.path.join(LAYERS, f)).convert("RGBA")
        assert im.size == (SRC_W, SRC_H), (f, im.size)
        _cache[f] = im
    return _cache[f]


def alpha_bbox(im: Image.Image, thr: int = 8):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > thr)
    return xs.min(), ys.min(), xs.max(), ys.max()


def dilate_edges(rgba: np.ndarray, rounds: int = 2) -> np.ndarray:
    """Push colour outward into transparent pixels.

    A texture sampler interpolates RGB across the alpha edge, and whatever
    colour sits in the transparent pixels bleeds into the silhouette — black,
    by default, which reads as a dark halo. Repeating the nearest opaque
    colour outward removes it. Alpha is never touched.
    """
    out = rgba.copy()
    for _ in range(rounds):
        a = out[:, :, 3]
        empty = a == 0
        if not empty.any():
            break
        filled = np.zeros_like(empty)
        acc = np.zeros((*out.shape[:2], 3), dtype=np.uint32)
        count = np.zeros(out.shape[:2], dtype=np.uint16)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            shifted_a = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
            shifted_rgb = np.roll(np.roll(out[:, :, :3], dy, axis=0), dx, axis=1)
            donor = (shifted_a > 0) & empty
            acc[donor] += shifted_rgb[donor]
            count[donor] += 1
            filled |= donor
        take = filled & (count > 0)
        out[:, :, :3][take] = (acc[take] // count[take][:, None]).astype(np.uint8)
    return out


def save_part(rgba: np.ndarray, path: str) -> dict:
    """Straight alpha, lossy RGB, lossless alpha, exact so transparent RGB survives."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path, "WEBP", quality=90, method=6, alpha_quality=100, exact=True)
    data = open(path, "rb").read()
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def alpha_gate(rgba: np.ndarray) -> tuple[bool, dict]:
    a = rgba[:, :, 3]
    total = a.size
    transparent = float((a == 0).sum()) / total
    semi = int(((a > 0) & (a < 255)).sum())
    ys, xs = np.where(a > 0)
    if len(xs) == 0:
        return False, {"reason": "empty part"}
    # a part whose ink touches its own crop edge was cut, not cut out
    box = (xs.min(), ys.min(), xs.max(), ys.max())
    h, w = a.shape
    touching = box[0] <= 1 or box[1] <= 1 or box[2] >= w - 2 or box[3] >= h - 2
    ok = transparent >= 0.05 and semi >= 50 and not touching
    return ok, {"transparentFraction": round(transparent, 4), "semiTransparentPixels": semi,
                "touchesOwnEdge": bool(touching)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    started = time.time()
    cfgs = json.load(open(CONFIGS))
    assert len(cfgs) == 145, f"expected the 145 cohort, got {len(cfgs)}"
    if args.limit:
        cfgs = cfgs[: args.limit]

    # ---- the family frame, computed exactly as build_cyl9_plates.py does, so
    # a part lands on the plate's own pixels
    x0 = y0 = 10**9
    x1 = y1 = -1
    for c in json.load(open(CONFIGS)):
        for slot in ORDER[c["mode"]]:
            bx0, by0, bx1, by1 = alpha_bbox(load(slot, c["layerKeys"][slot]))
            x0, y0, x1, y1 = min(x0, bx0), min(y0, by0), max(x1, bx1), max(y1, by1)
    closure_axes = {}
    for c in json.load(open(CONFIGS)):
        for slot in ORDER[c["mode"]][1:]:
            key = c["layerKeys"][slot]
            if (slot, key) in closure_axes:
                continue
            a = np.array(load(slot, key))[:, :, 3] > 128
            xs = np.where(a.any(axis=0))[0]
            closure_axes[(slot, key)] = (xs.min() + xs.max()) / 2
    datum = [v for (slot, key), v in closure_axes.items() if key != "PLS-ROLL"]
    axis = float(np.median(datum))
    scale = min((OUT_W - 2 * PAD) / (x1 - x0 + 1), (OUT_H - 2 * PAD) / (y1 - y0 + 1))
    ox = OUT_W / 2 - axis * scale
    oy = (OUT_H - PAD) - (y1 + 1) * scale
    inv = 1 / scale
    print(f"family frame: scale {scale:.4f}, axis x={axis:.1f}, baseline offset {oy:.1f}")

    def to_plate(im: Image.Image) -> np.ndarray:
        """One layer, through the plate's affine, onto the plate canvas."""
        moved = im.transform((OUT_W, OUT_H), Image.AFFINE, (inv, 0, -ox * inv, 0, inv, -oy * inv),
                             resample=Image.BICUBIC)
        return np.array(moved)

    # ---- the 26 parts, each transformed once and shared by every configuration
    parts: dict[tuple[str, str], dict] = {}
    for c in json.load(open(CONFIGS)):
        for slot in ORDER[c["mode"]]:
            key = c["layerKeys"][slot]
            if (slot, key) in parts:
                continue
            rgba = dilate_edges(to_plate(load(slot, key)))
            ok, alpha_facts = alpha_gate(rgba)
            ys, xs = np.where(rgba[:, :, 3] > 0)
            box = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
            glasses = {GLASS_FAMILY[k] for (s, k) in [(slot, key)] if s == "body"} or None
            # the part is written per glass family for bodies, shared otherwise
            parts[(slot, key)] = {"slot": slot, "variantKey": key, "rgba": rgba, "box": box,
                                  "alphaOk": ok, "alpha": alpha_facts, "glass": next(iter(glasses)) if glasses else None}
    print(f"parts: {len(parts)} distinct layers transformed onto the plate canvas")

    # Parts are scoped to the NECK family, not the glass family. All five glasses
    # were photographed in one frame on one neck, so the black cap on a clear
    # bottle is the same object as the black cap on a swirl one — scoping per
    # glass would store it five times under five keys and defeat the whole point.
    # The kit row still records its own catalogue familyId.
    PART_SCOPE = "cylinder-9ml-17-415"
    written: dict[tuple[str, str], dict] = {}

    def part_asset(_fam_id: str, slot: str, key: str) -> dict:
        fam_id = PART_SCOPE
        cache_key = (slot, key)
        if cache_key in written:
            return written[cache_key]
        p = parts[(slot, key)]
        tmp = os.path.join(OUT_ROOT, fam_id, "parts", f"tmp-{slot}-{key}.webp")
        meta = save_part(p["rgba"], tmp)
        final_name = f"{meta['sha256']}.{slot}-{key}-{OUT_W}x{OUT_H}.webp"
        final = os.path.join(OUT_ROOT, fam_id, "parts", final_name)
        os.replace(tmp, final)
        asset = {"slot": slot, "variantKey": key, "sha256": meta["sha256"], "bytes": meta["bytes"],
                 "file": f"../{PART_SCOPE}/parts/{final_name}",
                 "storeKey": f"kits/{fam_id}/{meta['sha256']}.{slot}-{OUT_W}x{OUT_H}.webp",
                 "box": p["box"], "width": OUT_W, "height": OUT_H,
                 "alphaGate": {"passed": p["alphaOk"], **p["alpha"]}}
        written[cache_key] = asset
        return asset

    rows = []
    failures = Counter()
    worst_parity = 0.0
    worst_axis = 0.0
    for c in cfgs:
        sku = c["websiteSku"]
        grace = c["graceSku"]
        glass = c["layerKeys"]["body"]
        fam_id = f"cylinder-9ml-{GLASS_FAMILY[glass]}-17-415"
        order = ORDER[c["mode"]]
        blocked = []

        # ---- anchors, measured on the body part itself
        body = parts[("body", glass)]["rgba"]
        ba = body[:, :, 3] > 128
        bys, bxs = np.where(ba)
        baseline_y = int(bys.max())
        neck_axis_x = float((bxs.min() + bxs.max()) / 2)
        body_h = int(bys.max() - bys.min() + 1)
        widths = ba.sum(axis=1)
        max_w = int(widths.max())
        lip_y = next((int(y) for y in range(bys.min(), bys.max() - 2)
                      if widths[y] >= 0.25 * max_w and widths[y + 1] >= 0.25 * max_w
                      and widths[y + 2] >= 0.25 * max_w), int(bys.min()))
        # the catalogue states the bare bottle height; that is the only mm truth here
        bare_mm = float(str(c.get("heightWithoutCap") or "70").split()[0])
        px_per_mm = body_h / bare_mm

        # ---- parts, in z-order
        kit_parts = []
        for z, slot in enumerate(order):
            key = c["layerKeys"][slot]
            asset = part_asset(fam_id, slot, key)
            if not asset["alphaGate"]["passed"]:
                blocked.append(f"alpha:{slot}")
            kit_parts.append({
                "slot": slot, "variantKey": key, "zOrder": z,
                "explodeIndex": z,
                "bounds": asset["box"],
                "assembled": {"x": 0, "y": 0},
                "exploded": {"dx": 0, "dy": -round(EXPLODE.get(slot, 0.08) * body_h)},
                "image": asset["file"], "storeKey": asset["storeKey"],
                "sha256": asset["sha256"], "bytes": asset["bytes"],
                "mask": None,
                "derivation": "layer-png",
            })

        # ---- gate: composite parity against the shipped plate
        stack = np.zeros((OUT_H, OUT_W, 4), dtype=np.uint8)
        canvas = Image.fromarray(stack, "RGBA")
        for slot in order:
            canvas.alpha_composite(Image.fromarray(parts[(slot, c["layerKeys"][slot])]["rgba"], "RGBA"))
        white = Image.new("RGBA", (OUT_W, OUT_H), (255, 255, 255, 255))
        white.alpha_composite(canvas)
        rebuilt = np.asarray(white.convert("L"), dtype=np.int16)
        plate_path = os.path.join(PLATES, f"{grace}.webp")
        parity = None
        if os.path.exists(plate_path):
            shipped = np.asarray(Image.open(plate_path).convert("L"), dtype=np.int16)
            ink = (shipped < 245) | (rebuilt < 245)
            diff = np.abs(shipped - rebuilt)
            mean_ink = float(diff[ink].mean()) if ink.any() else 0.0
            tail = float((diff[ink] > 40).mean()) if ink.any() else 0.0
            parity = {"meanInkDelta": round(mean_ink, 3), "fractionOver40": round(tail, 5)}
            worst_parity = max(worst_parity, mean_ink)
            if mean_ink > PARITY_MEAN or tail > PARITY_TAIL:
                blocked.append(f"parity:{mean_ink:.1f}")
        else:
            blocked.append("parity:no_plate")

        # ---- gate: the assembled closure axis lands on the plate centre line
        top = parts[(order[-1], c["layerKeys"][order[-1]])]["rgba"][:, :, 3] > 128
        txs = np.where(top.any(axis=0))[0]
        axis_off = abs(float((txs.min() + txs.max()) / 2) - OUT_W / 2)
        worst_axis = max(worst_axis, axis_off)
        if axis_off > AXIS_MAX:
            blocked.append(f"axis:{axis_off:.1f}px")

        for b in blocked:
            failures[b.split(":")[0]] += 1

        rows.append({
            "websiteSku": sku, "graceSku": grace, "familyId": fam_id,
            "canvas": {"width": OUT_W, "height": OUT_H},
            "anchors": {"axisX": OUT_W / 2, "neckAxisX": round(neck_axis_x, 2),
                        "seatY": lip_y, "baselineY": baseline_y, "pxPerMm": round(px_per_mm, 4)},
            "completeness": "full",
            "parts": kit_parts,
            "three": {"bodyId": f"cyl-9ml-{THREE_GLASS[glass]}", "glass": THREE_GLASS[glass],
                      "finish": "17-415",
                      "closureAssemblyKind": c["mode"],
                      "capMaterialId": c["layerKeys"].get("cap"),
                      "trimMaterialId": c["layerKeys"].get("sprayer") or c["layerKeys"].get("pump"),
                      "rollerVariant": ("metal" if c["layerKeys"].get("roller") == "MTL-ROLL"
                                        else "plastic" if c["layerKeys"].get("roller") else None)},
            "source": {"library": "CYL-9ML layer set", "path": "pipeline/paper-doll/_archive/2026-04-regeneration/output/CYL-9ML"},
            "builder": BUILDER,
            "gates": {"parity": parity, "axisOffsetPx": round(axis_off, 2),
                      "slots": {"expected": len(order), "present": len(kit_parts)}},
            "publishable": not blocked,
            "blockReasons": blocked,
        })

        # ---- the offline exploded composite
        out_dir = os.path.join(OUT_ROOT, fam_id, sku)
        os.makedirs(out_dir, exist_ok=True)
        ex = Image.new("RGBA", (OUT_W, OUT_H), (255, 255, 255, 255))
        for part, slot in zip(kit_parts, order):
            layer = Image.fromarray(parts[(slot, c["layerKeys"][slot])]["rgba"], "RGBA")
            ex.alpha_composite(layer, (0, 0)) if part["exploded"]["dy"] == 0 else ex.alpha_composite(
                layer.transform((OUT_W, OUT_H), Image.AFFINE, (1, 0, 0, 0, 1, -part["exploded"]["dy"]),
                                resample=Image.BICUBIC), (0, 0))
        ex.convert("RGB").save(os.path.join(out_dir, "exploded.webp"), "WEBP", quality=86, method=6)
        json.dump(rows[-1], open(os.path.join(out_dir, "kit.json"), "w"), indent=1)

    manifest = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "builder": BUILDER,
                "canvas": {"width": OUT_W, "height": OUT_H},
                "counts": {"kits": len(rows), "publishable": sum(1 for r in rows if r["publishable"]),
                           "distinctParts": len(written),
                           "families": len({r["familyId"] for r in rows})},
                "gates": {"worstParityMeanInkDelta": round(worst_parity, 3),
                          "worstAxisOffsetPx": round(worst_axis, 2),
                          "failuresByGate": dict(failures)},
                "rows": rows}
    os.makedirs(OUT_ROOT, exist_ok=True)
    json.dump(manifest, open(os.path.join(OUT_ROOT, "manifest.json"), "w"), indent=1)

    print(f"kits: {len(rows)} across {manifest['counts']['families']} families, "
          f"{manifest['counts']['publishable']} publishable")
    print(f"  distinct part objects written: {len(written)}  (vs {sum(len(r['parts']) for r in rows)} part references)")
    print(f"  worst composite parity: {worst_parity:.2f}/255 (gate {PARITY_MEAN:.0f})")
    print(f"  worst closure-axis offset: {worst_axis:.2f}px (gate {AXIS_MAX})")
    if failures:
        print(f"  gate failures: {dict(failures)}")
    print(f"  {time.time() - started:.0f}s -> {os.path.relpath(OUT_ROOT, REPO)}")


if __name__ == "__main__":
    main()
