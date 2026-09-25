#!/usr/bin/env python3
"""
Catalogue glass bodies with Sunburst, the pilot method at catalogue scale (Jordan 2026-09-25: generate every
glass body from the proper measurements; these become the source-of-truth bodies).

  python3 scripts/register/bodies/build_bodies.py inputs    # geometry + material images per body x glass
  node   scripts/register/bodies/render_bodies.mjs          # Sunburst, transparent background (resumable)
  python3 scripts/register/bodies/build_bodies.py qa        # fit, lock, bone-bake, measure, sheets

One master geometry per body: its Clear cut, else its first cut glass, enlarged so the body's longest side is
2000 px on its own canvas (multiples of 16, at least 655,360 px). Every glass of that body takes the master's
geometry: the master is enhanced from its own photo (locked two-line prompt); every other glass adds its own
photo fitted to the master as the material image, or, with no usable photo, the pilot's reference glass.
After rendering: fit back to the master (rim, foot, barrel width, axis), lock alpha to the master outline,
bake Clear and Swirl on the hero bone #F5F3EF, scale from the recorded height (plus the 6 deg camera tilt
term for round bodies, as in the pilot). Pixels go to output/register-bodies/ (gitignored); numbers go to
data/register/bodies/bodies-measurements.json.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "phase3"))
import cut_pilot as cp  # noqa: E402
import review_sheet as rs  # noqa: E402
from scipy import ndimage as ndi  # noqa: E402

ROOT = cp.ROOT
BASE = ROOT / "output" / "register-bodies"
CUTS = json.loads((ROOT / "data" / "register" / "bodies" / "cuts.json").read_text())
INV = {f"{r['bodyId']}|{r['glass']}": r for r in csv.DictReader((ROOT / "data" / "register" / "bodies" / "inventory.csv").open())}
MEASURE = ROOT / "data" / "register" / "bodies" / "bodies-measurements.json"
PILOT_RENDERS = cp.OUT / "sunburst" / "renders"   # un-baked pilot glass, the material references
REFERENCE = {"Clear": "clear", "Amber": "amber", "Cobalt Blue": "cobalt-blue", "Frosted": "frosted", "Swirl": "swirl"}
BONE = np.array([0xF5, 0xF3, 0xEF], dtype=np.float32)
BONE_BAKED = {"Clear", "Swirl"}
LONG_SIDE, MARGIN, MIN_PX, TILT = 2000, 96, 655_360, math.radians(6.0)
slug = lambda s: s.lower().replace(" ", "-").replace("/", "-")


def ceil16(v: float) -> int:
    return int(math.ceil(v / 16.0) * 16)


def on_white(img: Image.Image) -> Image.Image:
    g = Image.new("RGBA", img.size, (255, 255, 255, 255))
    return Image.alpha_composite(g, img).convert("RGB")


def plan() -> dict[str, dict]:
    """bodyId -> {master glass, canvas, placement, glasses: [(glass, kind, cut)]}."""
    by_body = defaultdict(list)
    for c in CUTS:
        if c["file"] or c["source"].startswith("sibling"):
            by_body[c["bodyId"]].append(c)
    out = {}
    for body_id, entries in sorted(by_body.items()):
        cut = [e for e in entries if e["file"]]
        master = next((e for e in cut if e["glass"] == "Clear"), None) or sorted(cut, key=lambda e: e["glass"])[0]
        w, h = master["width"], master["height"]
        k = LONG_SIDE / max(w, h)
        W, H = ceil16(w * k + 2 * MARGIN), ceil16(h * k + 2 * MARGIN)
        while W * H < MIN_PX:
            W += 16
        out[body_id] = {"master": master, "k": k, "canvas": [W, H], "axisX": W / 2, "footY": H - MARGIN, "glasses": entries}
    return out


def place(img: Image.Image, src: dict, master: dict, body: dict) -> Image.Image:
    """img (a cut) scaled so its rim/foot/barrel/axis land on the master's, enlarged by k, on the body canvas."""
    a, ma = src["measured"], master["measured"]
    sy = body["k"] * (ma["foot"] - ma["rim"]) / (a["foot"] - a["rim"])
    sx = body["k"] * ma["barrelPx"] / a["barrelPx"]
    big = img.resize((max(1, round(img.width * sx)), max(1, round(img.height * sy))), Image.LANCZOS)
    W, H = body["canvas"]
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(big, (round(body["axisX"] - a["axisX"] * sx), round(body["footY"] - a["foot"] * sy)))
    return canvas


def fit_reference(ref: Image.Image, body: dict) -> Image.Image:
    """The pilot reference glass, centred on the body canvas, only as a colour/material cue."""
    W, H = body["canvas"]
    bb = ref.getchannel("A").getbbox()
    r = ref.crop(bb)
    s = min((W - 2 * MARGIN) / r.width, (H - 2 * MARGIN) / r.height)
    r = r.resize((max(1, int(r.width * s)), max(1, int(r.height * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(r, ((W - r.width) // 2, H - MARGIN - r.height))
    return canvas


def inputs():
    bodies = plan()
    jobs = []
    for body_id, body in bodies.items():
        d = BASE / "inputs" / body_id
        d.mkdir(parents=True, exist_ok=True)
        master = body["master"]
        geo = place(Image.open(BASE / "cuts" / master["file"]).convert("RGBA"), master, master, body)
        on_white(geo).save(d / "geometry.png")
        Image.fromarray(((np.asarray(geo.getchannel("A")) > 127) * 255).astype(np.uint8)).save(d / "master-mask.png")
        for e in body["glasses"]:
            glass = e["glass"]
            if e is master:
                jobs.append({"bodyId": body_id, "glass": glass, "role": "master", "images": [str(d / "geometry.png")], "size": body["canvas"]})
                continue
            if e["file"]:
                mat = place(Image.open(BASE / "cuts" / e["file"]).convert("RGBA"), e, master, body)
                how = "own photo"
            else:
                ref = REFERENCE.get(glass)
                if not ref:
                    print(f"  no reference glass for {glass}; skipping {body_id}")
                    continue
                mat = fit_reference(Image.open(PILOT_RENDERS / f"{ref}.png").convert("RGBA"), body)
                how = f"reference glass ({ref})"
            on_white(mat).save(d / f"{slug(glass)}-material.png")
            jobs.append({"bodyId": body_id, "glass": glass, "role": how, "images": [str(d / "geometry.png"), str(d / f"{slug(glass)}-material.png")], "size": body["canvas"]})
        (d / "body.json").write_text(json.dumps({k: v for k, v in body.items() if k not in ("master", "glasses")} | {"masterGlass": master["glass"]}, indent=1))
    (BASE / "jobs.json").write_text(json.dumps(jobs, indent=1))
    print(f"{len(jobs)} render jobs across {len(bodies)} bodies -> {BASE / 'jobs.json'}")


def edge(x):
    return x ^ ndi.binary_erosion(x)


def compare(g, m):
    iou = (g & m).sum() / max(1, (g | m).sum())
    dm, dg = ndi.distance_transform_edt(~edge(m)), ndi.distance_transform_edt(~edge(g))
    dev = np.concatenate([dm[edge(g)], dg[edge(m)]])
    return float(iou), float(dev.max()), float(np.percentile(dev, 95))


def mask_rgba(mask: np.ndarray) -> Image.Image:
    im = Image.new("RGBA", (mask.shape[1], mask.shape[0]), (255, 255, 255, 0))
    im.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
    return im


def qa():
    bodies = plan()
    results, rows = [], []
    for body_id, body in bodies.items():
        d = BASE / "inputs" / body_id
        master_mask = np.asarray(Image.open(d / "master-mask.png")) > 127
        mm = cp.measure_body(mask_rgba(master_mask))
        soft = Image.fromarray((ndi.gaussian_filter(master_mask.astype(float), 0.8).clip(0, 1) * 255).astype(np.uint8))
        inv = INV[f"{body_id}|{body['master']['glass']}"]
        H_mm = float(inv["heightBareMm"])
        D_mm = float(inv["diameterMm"]) if inv["diameterMm"] else None
        apparent = H_mm * math.cos(TILT) + D_mm * math.sin(TILT) if D_mm else H_mm
        ref_w = D_mm or (float(inv["widthMm"]) if inv["widthMm"] else None)
        # Two independent scales from the recorded measurements. Height is the pilot's basis; a ground-glass
        # body's top is its stopper, not the rim, so those scale by width. A gap over 5% is flagged, not hidden.
        by_height = (mm["foot"] - mm["rim"]) / apparent
        by_width = mm["barrelPx"] / ref_w if ref_w else None
        stoppered = body["master"]["bodyId"].endswith("-Ground") or inv["neck"] == "Ground"
        basis = "width" if stoppered and by_width else "height"
        px_per_mm = by_width if basis == "width" else by_height
        gap = round(100 * (by_height / by_width - 1), 1) if by_width else None
        width_mm = mm["barrelPx"] / px_per_mm
        row = {"bodyId": body_id, "cells": []}
        for e in body["glasses"]:
            glass = e["glass"]
            rpath = BASE / "renders" / body_id / f"{slug(glass)}.png"
            entry = {"plateKey": f"{body_id}|{glass}", "bodyId": body_id, "glass": glass}
            if not rpath.exists():
                entry["status"] = "not rendered"
                results.append(entry); row["cells"].append((glass, None, e)); continue
            raw = Image.open(rpath).convert("RGBA")
            g0 = np.asarray(raw.getchannel("A")) > 127
            raw_iou, _, _ = compare(g0, master_mask)
            r = cp.measure_body(raw)
            sx, sy = mm["barrelPx"] / r["barrelPx"], (mm["foot"] - mm["rim"]) / (r["foot"] - r["rim"])
            big = raw.resize((max(1, round(raw.width * sx)), max(1, round(raw.height * sy))), Image.LANCZOS)
            fitted = Image.new("RGBA", raw.size, (0, 0, 0, 0))
            fitted.paste(big, (round(mm["axisX"] - r["axisX"] * sx), round(mm["rim"] - r["rim"] * sy)))
            iou, dmax, p95 = compare(np.asarray(fitted.getchannel("A")) > 127, master_mask)
            locked = fitted.copy()
            locked.putalpha(Image.fromarray(np.minimum(np.asarray(fitted.getchannel("A")), np.asarray(soft))))
            baked = None
            if glass in BONE_BAKED:
                rgba = np.asarray(locked).astype(np.float32)
                solid = (rgba[..., 3] > 250) & (rgba[..., :3].min(axis=2) >= 235)
                white = np.array([np.bincount(rgba[..., c][solid].astype(np.int64), minlength=256).argmax() if solid.any() else 255 for c in range(3)], dtype=np.float32)
                rgba[..., :3] = np.round(np.minimum(rgba[..., :3] * (255.0 / white), 255.0) * (BONE / 255.0))
                locked = Image.fromarray(rgba.clip(0, 255).astype(np.uint8), "RGBA")
                baked = {"bone": "#F5F3EF", "paperWhite": white.astype(int).tolist()}
            out = BASE / "final" / body_id / f"{slug(glass)}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            locked.save(out, optimize=True)
            meta = json.loads((rpath.with_suffix(".png.json")).read_text()) if rpath.with_suffix(".png.json").exists() else {}
            entry.update({
                "status": "ok" if iou >= 0.97 else "review", "file": str(out.relative_to(BASE)), "width": locked.width, "height": locked.height,
                "sha256": cp.sha(locked), "pxPerMm": round(px_per_mm, 4),
                "anchors": {"axisX": round(mm["axisX"], 1), "seatY": mm["rim"], "shoulderY": mm["shoulderY"], "baselineY": mm["foot"]},
                "checks": {"rawIoU": round(raw_iou, 4), "fittedIoU": round(iou, 4), "edgeP95Px": round(p95, 1), "edgeMaxPx": round(dmax, 1),
                           "widthMm": round(width_mm, 2), "referenceWidthMm": ref_w,
                           "widthErrorPct": round(100 * (width_mm - ref_w) / ref_w, 1) if ref_w else None},
                "measurements": {"heightBareMm": H_mm, "diameterMm": D_mm, "widthMm": float(inv["widthMm"]) if inv["widthMm"] else None,
                                 "apparentHeightMm": round(apparent, 2), "dimsConfidence": inv["dimsConfidence"]},
                "scale": {"basis": basis, "byHeight": round(by_height, 4), "byWidth": round(by_width, 4) if by_width else None,
                          "gapPct": gap, "flag": bool(gap is not None and abs(gap) > 5)},
                "source": {"masterGlass": body["master"]["glass"], "role": "master" if e is body["master"] else ("own photo" if e["file"] else "reference glass"),
                           "cut": e["source"], "psd": e.get("psd"), "derivedFrom": e.get("sha256")},
                "bakedOnBone": baked, "render": {k: meta.get(k) for k in ("model", "quality", "costUsd", "prompt")},
            })
            results.append(entry)
            row["cells"].append((glass, locked, e))
        rows.append(row)
    MEASURE.write_text(json.dumps(results, indent=1) + "\n")
    ok = [r for r in results if r.get("status") == "ok"]
    print(f"{len(results)} plates: ok {len(ok)}, review {sum(1 for r in results if r.get('status') == 'review')}, not rendered {sum(1 for r in results if r.get('status') == 'not rendered')}")
    sheets(rows)


def sheets(rows):
    cell = 170
    per_sheet = 18
    for n in range(0, len(rows), per_sheet):
        chunk = rows[n:n + per_sheet]
        cols = max(len(r["cells"]) for r in chunk) + 1
        sheet = Image.new("RGB", (cols * cell + 250, len(chunk) * (cell + 30) + 20), (245, 243, 239))
        d = ImageDraw.Draw(sheet)
        for i, r in enumerate(chunk):
            y = 10 + i * (cell + 30)
            d.text((10, y + cell // 2), r["bodyId"][:34], fill=(28, 28, 30))
            master = next(c for c in CUTS if c["bodyId"] == r["bodyId"] and c["file"] and (c["glass"] == "Clear" or True))
            items = [("photo", Image.open(BASE / "cuts" / master["file"]).convert("RGBA"))] + [(g, im) for g, im, _ in r["cells"]]
            for j, (label, im) in enumerate(items):
                x = 240 + j * cell
                if im is None:
                    d.rectangle([x + 8, y + 8, x + cell - 8, y + cell - 8], outline=(190, 50, 40)); d.text((x + 10, y + cell + 4), f"{label} · not rendered", fill=(190, 50, 40)); continue
                bb = im.getchannel("A").getbbox()
                t = im.crop(bb); t.thumbnail((cell - 12, cell - 12), Image.LANCZOS)
                tile = Image.new("RGBA", (cell - 6, cell - 6), (245, 243, 239, 255))
                tile.alpha_composite(rs.on_bone(t) if label == "photo" else t, ((tile.width - t.width) // 2, tile.height - t.height))
                sheet.paste(tile.convert("RGB"), (x, y)); d.text((x + 4, y + cell + 2), label, fill=(120, 100, 60))
        out = BASE / f"review-bodies-{n // per_sheet + 1}.png"
        sheet.save(out, optimize=True); print(out)


if __name__ == "__main__":
    {"inputs": inputs, "qa": qa}[sys.argv[1]]()
