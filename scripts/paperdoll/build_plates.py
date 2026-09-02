#!/usr/bin/env python3
"""
Render plates for every publishable SKU from the chosen PSD sources.

    python3 scripts/paperdoll/build_plates.py --family elegant-60ml-clear-18-415
    python3 scripts/paperdoll/build_plates.py --neck 18-415 [--limit 5]
    python3 scripts/paperdoll/build_plates.py --plan            # list the render groups, render nothing

Inputs: data/paper-doll/{selection,xref,tokens}.json. Output: dist/paper-doll/<familyId>/…
and dist/paper-doll/manifest.json (rows in the contract publish.mjs --dist reads).

Two render modes:
  registered — bottles. A family's PSDs are one photographic master (same
      pixel scale, byte-identical bottle body, only the crop moves), so
      registration is a pure translation recovered by normalised
      cross-correlation against a bottle-foot template taken from the
      narrowest plain plate. Gates, unchanged from the shipping builder:
      post-alignment residual ≤ 12/255 or the whole group is refused;
      closure axis on the canvas centre line within 2 px on every capped plate.
      Registration groups by (familyId, body token): a frosted body filed
      under a clear group is still its own photograph.
  standalone — components. One scale per family, ink box centred, the part
      must not touch its source edge.

Every group writes _registration.json (the exact affine each plate used, so
kits can land on the plate's pixels) and contact-sheet.webp for review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage
from scipy import ndimage
from scipy.signal import fftconvolve

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_tokens import parse_sku  # noqa: E402

REPO = HERE.parents[1]
DATA = REPO / "data" / "paper-doll"
DIST = REPO / "dist" / "paper-doll"
SOURCES = json.loads((DATA / "sources.json").read_text())

OUT_W, OUT_H, PAD = 1000, 1100, 40
RESIDUAL_MAX = 12.0          # /255, family residual gate
AXIS_MAX = 2.0               # px, closure axis vs canvas centre
STANDALONE_HEIGHT = 0.62     # a component's tallest part fills this much of the canvas height
BUILDER = {"name": "build_plates.py", "version": "1.0.0"}
HANGING_CLOSURES = {"AnSp", "AnSpTsl"}   # a bulb or tassel hangs off the bottle: framed as a composition


# ---------------------------------------------------------------- image helpers (the shipping builder's, verbatim)
def ncc_offset(patch, target):
    t = target.astype(np.float64)
    p = patch.astype(np.float64)
    p = p - p.mean()
    num = fftconvolve(t, p[::-1, ::-1], mode="valid")
    ones = np.ones_like(p)
    s1 = fftconvolve(t, ones, mode="valid")
    s2 = fftconvolve(t * t, ones, mode="valid")
    var = s2 - (s1 * s1) / p.size
    var[var < 1e-6] = 1e-6
    score = num / np.sqrt(var)
    iy, ix = np.unravel_index(np.argmax(score), score.shape)
    return int(iy), int(ix), float(score[iy, ix])


def ink_bbox(gray, thr=245):
    ys, xs = np.where(gray < thr)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def cap_axis(gray):
    """Horizontal centre of the closure (top 20 % of the ink): the bottle's axis."""
    ink = gray < 245
    ys, _ = np.where(ink)
    y0, y1 = ys.min(), ys.max()
    band = ink[y0:y0 + max(8, int((y1 - y0) * 0.20))]
    cols = np.where(band.any(axis=0))[0]
    return (cols.min() + cols.max()) / 2.0


def flatten(path: Path):
    rgb = PSDImage.open(str(path)).composite()
    if rgb is None:
        raise RuntimeError("no composite")
    rgb = rgb.convert("RGBA")
    white = Image.new("RGBA", rgb.size, (255, 255, 255, 255))
    white.alpha_composite(rgb)
    rgb = white.convert("RGB")
    return rgb, np.array(rgb.convert("L"))


def save_webp(image: Image.Image, path: Path, quality: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(path), "WEBP", quality=quality, method=6)
    data = path.read_bytes()
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "width": image.width, "height": image.height}


def thumb_of(canvas: Image.Image) -> Image.Image:
    """Rail thumbnail: crop to the plate's own ink (the rail tells closures apart, it does not compare scale)."""
    box = ink_bbox(np.array(canvas.convert("L")))
    if box is None:
        return canvas.resize((240, 240), Image.LANCZOS)
    tx0, ty0, tx1, ty1 = box
    side = max(tx1 - tx0, ty1 - ty0) + 24
    cx, cy = (tx0 + tx1) // 2, (ty0 + ty1) // 2
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(canvas, (-(cx - side // 2), -(cy - side // 2)))
    return square.resize((240, 240), Image.LANCZOS)


# ---------------------------------------------------------------- plan
def source_of(entry: dict, state: str):
    rec = entry["states"].get(state)
    if not rec or not rec.get("chosen"):
        return None
    root = SOURCES["libraries"][rec["chosenLibrary"]]["root"]
    return {"library": rec["chosenLibrary"], "relPath": rec["chosenPath"], "path": Path(root) / rec["chosenPath"], "sha256": rec["chosen"], "stateEvidence": rec["stateEvidence"]}


def plan_groups(selection, xref, args):
    """publishable xref rows -> render groups keyed by (familyId, body token | 'standalone')."""
    groups = defaultdict(lambda: {"skus": []})
    for rec in xref["products"]:
        if not rec["publishable"]:
            continue
        fid = rec["familyId"]
        if args.family and fid not in args.family:
            continue
        if args.neck and not fid.endswith(args.neck):
            continue
        entry = selection["stems"][rec["stemKey"]]
        mode = rec.get("renderMode") or "registered"
        if mode == "standalone":
            key = (fid, "standalone")
        else:
            parsed = parse_sku(rec["websiteSku"])
            key = (fid, parsed["body"] or rec["websiteSku"])
        on = source_of(entry, "on") or source_of(entry, "part") or source_of(entry, "unknown")
        off = source_of(entry, "off")
        if on is None and off is not None:      # only the uncapped shot exists: it is the plate
            on, off = off, None
        if on is None:
            continue
        closure = parse_sku(rec["websiteSku"])["closure"]
        groups[key]["skus"].append({"sku": rec["websiteSku"], "graceSku": rec["graceSku"], "familyId": fid, "family": rec["family"],
                                    "closure": closure, "warnings": rec["warnings"], "on": on, "off": off, "mode": mode})
    ordered = sorted(groups.items(), key=lambda kv: (-len(kv[1]["skus"]), kv[0]))
    if args.limit:
        ordered = ordered[: args.limit]
    return ordered


def family_name(fid: str) -> str:
    parts = fid.split("-")
    return " ".join(p.capitalize() if not p[0].isdigit() else p for p in parts)


# ---------------------------------------------------------------- registered mode
def build_registered(fid, body, skus, out_dir: Path, log):
    shots = []      # every flattened shot in the group
    per_sku = {}
    for item in skus:
        entry = {}
        for state in ("on", "off"):
            src = item[state]
            if not src:
                continue
            try:
                rgb, gray = flatten(src["path"])
            except Exception as error:  # noqa: BLE001
                log(f"   !! {item['sku']} [{state}]: cannot flatten {src['relPath']} ({type(error).__name__})")
                continue
            if ink_bbox(gray) is None:
                log(f"   !! {item['sku']} [{state}]: blank composite")
                continue
            shot = {"sku": item["sku"], "state": state, "rgb": rgb, "gray": gray, "src": src, "closure": item["closure"]}
            shots.append(shot)
            entry[state] = shot
        if "on" in entry:
            per_sku[item["sku"]] = entry
    if not shots:
        return [], {"refused": "no_shots"}

    def width_of(sh):
        x0, _, x1, _ = ink_bbox(sh["gray"])
        return x1 - x0

    assembled = [e["on"] for e in per_sku.values()]
    plain = [sh for sh in assembled if sh["closure"] not in HANGING_CLOSURES] or assembled
    ref = min(plain, key=width_of)
    rx0, ry0, rx1, ry1 = ink_bbox(ref["gray"])
    rh = ry1 - ry0
    H, W = ref["gray"].shape
    ty0 = max(0, ry1 - int(rh * 0.22))
    ty1 = min(H, ry1 + max(8, int(rh * 0.02)))
    tx0 = max(0, rx0 - 12)
    tx1 = min(W, rx1 + 12)
    patch = ref["gray"][ty0:ty1, tx0:tx1]
    ph, pw = patch.shape
    worst = 0.0
    for sh in shots:
        iy, ix, score = ncc_offset(patch, sh["gray"])
        sh["dx"], sh["dy"], sh["score"] = ix - tx0, iy - ty0, score
        win = sh["gray"][ty0 + sh["dy"]:ty0 + sh["dy"] + ph, tx0 + sh["dx"]:tx0 + sh["dx"] + pw]
        sh["residual"] = 255.0 if win.shape != patch.shape else float(np.abs(win.astype(np.int16) - patch.astype(np.int16)).mean())
        worst = max(worst, sh["residual"])
    registration = {"familyId": fid, "body": body, "reference": ref["src"]["relPath"], "template": [tx0, ty0, tx1, ty1], "worstResidual": round(worst, 2),
                    "residuals": {f"{sh['sku']}.front-{sh['state']}": round(sh["residual"], 2) for sh in shots}, "excluded": {}, "plates": {}}
    # one stray shot (a different crop, a re-shoot, a ring variant) must not refuse the family: shots that
    # fail the residual gate are set aside and blocked individually, as long as they are the minority
    outliers = [sh for sh in shots if sh["residual"] > RESIDUAL_MAX]
    if outliers and len(outliers) <= max(1, len(shots) // 4):
        for sh in outliers:
            registration["excluded"][f"{sh['sku']}.front-{sh['state']}"] = f"registration_residual:{sh['residual']:.1f}"
            log(f"   -- {sh['sku']} [{sh['state']}]: residual {sh['residual']:.2f}/255, set aside")
        excluded_skus = {sh["sku"] for sh in outliers if sh["state"] == "on"}
        shots = [sh for sh in shots if sh not in outliers]
        for sh in list(per_sku.values()):
            if "off" in sh and sh["off"] in outliers:
                del sh["off"]
        per_sku = {sku: e for sku, e in per_sku.items() if sku not in excluded_skus}
        worst = max(sh["residual"] for sh in shots) if shots else 0.0
        registration["worstResidual"] = round(worst, 2)
    if worst > RESIDUAL_MAX or not shots:
        log(f"   !! refused: residual {worst:.2f}/255 > {RESIDUAL_MAX} on {len(outliers)} of {len(shots) + len(outliers)} shots — not one photographic master")
        registration["refused"] = f"registration_residual:{worst:.1f}"
        return [], registration

    uy0, uy1, max_w = 10**9, -10**9, 0
    for sh in shots:
        x0, y0, x1, y1 = ink_bbox(sh["gray"])
        uy0 = min(uy0, y0 - sh["dy"])
        uy1 = max(uy1, y1 - sh["dy"])
        max_w = max(max_w, x1 - x0)
    uh = uy1 - uy0
    scale = min((OUT_W - 2 * PAD) / max_w, (OUT_H - 2 * PAD) / uh)
    registration.update({"scale": scale, "band": [uy0, uy1]})

    def render(sh, on_axis):
        if on_axis:
            ox = OUT_W / 2 - cap_axis(sh["gray"]) * scale
        else:
            x0, _, x1, _ = ink_bbox(sh["gray"])
            ox = (OUT_W - (x1 - x0) * scale) / 2 - x0 * scale
        oy = PAD - (uy0 + sh["dy"]) * scale + ((OUT_H - 2 * PAD) - uh * scale) / 2
        inv = 1.0 / scale
        canvas = sh["rgb"].transform((OUT_W, OUT_H), Image.AFFINE, (inv, 0, -ox * inv, 0, inv, -oy * inv), resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        return canvas, ox, oy

    rows = []
    for name, reason in registration["excluded"].items():
        sku, state = name.rsplit(".front-", 1)
        if state == "on":
            item = next(i for i in skus if i["sku"] == sku)
            rows.append({"websiteSku": sku, "graceSku": item["graceSku"], "familyId": fid, "familyName": family_name(fid), "neck": "-".join(fid.split("-")[-2:]),
                         "body": body, "closure": item["closure"], "mode": "registered", "warnings": item["warnings"], "plate": None, "thumb": None,
                         "plateCapOff": None, "thumbCapOff": None, "publishable": False, "blockReasons": [reason]})
    for sku in sorted(per_sku):
        entry = per_sku[sku]
        item = next(i for i in skus if i["sku"] == sku)
        on = entry["on"]
        off = entry.get("off")
        plain_cap = on["closure"] not in HANGING_CLOSURES
        canvas_on, ox, oy = render(on, on_axis=plain_cap)
        axis_off = abs(cap_axis(np.array(canvas_on.convert("L"))) - OUT_W / 2) if plain_cap else None
        block = []
        if axis_off is not None and axis_off > AXIS_MAX:
            block.append(f"closure_axis:{axis_off:.1f}px")
        name_on = f"{sku}.front-on"
        plate = save_webp(canvas_on, out_dir / f"{name_on}.webp", 88)
        thumb = save_webp(thumb_of(canvas_on), out_dir / f"{name_on}-thumb.webp", 82)
        registration["plates"][name_on] = {"dx": on["dx"], "dy": on["dy"], "ox": round(ox, 3), "oy": round(oy, 3), "residual": round(on["residual"], 2), "axisOffset": None if axis_off is None else round(axis_off, 2)}
        row = {
            "websiteSku": sku, "graceSku": item["graceSku"], "familyId": fid, "familyName": family_name(fid), "neck": "-".join(fid.split("-")[-2:]),
            "body": body, "closure": on["closure"], "mode": "registered", "warnings": item["warnings"],
            "plate": asset_row(plate, fid, sku, name_on, "front-on", on["src"]),
            "thumb": asset_row(thumb, fid, sku, f"{name_on}-thumb", "front-on-240x240", on["src"], thumb=True),
            "plateCapOff": None, "thumbCapOff": None,
            "publishable": not block, "blockReasons": block,
        }
        if off is not None:
            canvas_off, ox2, oy2 = render(off, on_axis=False)
            name_off = f"{sku}.front-off"
            plate2 = save_webp(canvas_off, out_dir / f"{name_off}.webp", 88)
            thumb2 = save_webp(thumb_of(canvas_off), out_dir / f"{name_off}-thumb.webp", 82)
            registration["plates"][name_off] = {"dx": off["dx"], "dy": off["dy"], "ox": round(ox2, 3), "oy": round(oy2, 3), "residual": round(off["residual"], 2)}
            row["plateCapOff"] = asset_row(plate2, fid, sku, name_off, "front-off", off["src"])
            row["thumbCapOff"] = asset_row(thumb2, fid, sku, f"{name_off}-thumb", "front-off-240x240", off["src"], thumb=True)
        rows.append(row)
    return rows, registration


def asset_row(saved: dict, fid: str, sku: str, name: str, role: str, src: dict, thumb: bool = False) -> dict:
    size = "240x240" if thumb else f"{OUT_W}x{OUT_H}"
    role_key = role if thumb else f"{role}-{size}"
    return {
        "key": f"{fid}/{name}.webp",
        "storeKey": f"plates/{fid}/{sku}/{saved['sha256']}.{role_key}.webp",
        "sha256": saved["sha256"], "bytes": saved["bytes"], "width": saved["width"], "height": saved["height"],
        "sourceLibrary": src["library"], "sourceRelPath": src["relPath"], "sourceSha256": src["sha256"], "sourceStateEvidence": src["stateEvidence"],
    }


# ---------------------------------------------------------------- standalone mode
def build_standalone(fid, skus, out_dir: Path, log):
    parts = []
    for item in skus:
        src = item["on"]
        try:
            rgb, gray = flatten(src["path"])
        except Exception as error:  # noqa: BLE001
            log(f"   !! {item['sku']}: cannot flatten {src['relPath']} ({type(error).__name__})")
            continue
        box = ink_bbox(gray)
        if box is None:
            log(f"   !! {item['sku']}: blank composite")
            continue
        parts.append({"item": item, "rgb": rgb, "gray": gray, "box": box, "src": src})
    if not parts:
        return [], {"refused": "no_parts"}
    max_h = max(p["box"][3] - p["box"][1] for p in parts)
    max_w = max(p["box"][2] - p["box"][0] for p in parts)
    scale = min((OUT_H - 2 * PAD) * STANDALONE_HEIGHT / max_h, (OUT_W - 2 * PAD) / max_w)
    registration = {"familyId": fid, "mode": "standalone", "scale": scale, "plates": {}}
    rows = []
    for p in sorted(parts, key=lambda p: p["item"]["sku"]):
        item, box = p["item"], p["box"]
        h, w = p["gray"].shape
        block = []
        if box[0] <= 1 or box[1] <= 1 or box[2] >= w - 2 or box[3] >= h - 2:
            block.append("part_touches_source_edge")
        cx = (box[0] + box[2]) / 2
        cy = (box[1] + box[3]) / 2
        ox = OUT_W / 2 - cx * scale
        oy = OUT_H / 2 - cy * scale
        inv = 1.0 / scale
        canvas = p["rgb"].transform((OUT_W, OUT_H), Image.AFFINE, (inv, 0, -ox * inv, 0, inv, -oy * inv), resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        sku = item["sku"]
        name = f"{sku}.front-on"
        plate = save_webp(canvas, out_dir / f"{name}.webp", 88)
        thumb = save_webp(thumb_of(canvas), out_dir / f"{name}-thumb.webp", 82)
        registration["plates"][name] = {"ox": round(ox, 3), "oy": round(oy, 3), "box": list(box)}
        rows.append({
            "websiteSku": sku, "graceSku": item["graceSku"], "familyId": fid, "familyName": family_name(fid), "neck": "-".join(fid.split("-")[-2:]),
            "body": None, "closure": item["closure"], "mode": "standalone", "warnings": item["warnings"],
            "plate": asset_row(plate, fid, sku, name, "front-on", p["src"]),
            "thumb": asset_row(thumb, fid, sku, f"{name}-thumb", "front-on-240x240", p["src"], thumb=True),
            "plateCapOff": None, "thumbCapOff": None,
            "publishable": not block, "blockReasons": block,
        })
    return rows, registration


# ---------------------------------------------------------------- contact sheet + manifest
def contact_sheet(fid: str, rows: list, out_dir: Path):
    if not rows:
        return
    cols = 8
    cell = 240
    label_h = 18
    n = len(rows)
    sheet = Image.new("RGB", (cols * cell, ((n + cols - 1) // cols) * (cell + label_h)), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        x = (i % cols) * cell
        y = (i // cols) * (cell + label_h)
        try:
            img = Image.open(out_dir / Path(row["thumb"]["key"]).name)
            sheet.paste(img, (x, y))
        except OSError:
            pass
        text = row["websiteSku"] + ("" if row["publishable"] else " !!") + (" *" if row["warnings"] else "")
        draw.text((x + 4, y + cell + 2), text[:34], fill=(30, 30, 30))
    sheet.save(str(out_dir / "contact-sheet.webp"), "WEBP", quality=80, method=4)


def merge_manifest(new_rows: list, built_families: set, groups_report: list):
    path = DIST / "manifest.json"
    existing = json.loads(path.read_text()) if path.exists() else {"rows": [], "groups": []}
    rows = [r for r in existing.get("rows", []) if r["familyId"] not in built_families] + new_rows
    groups = [g for g in existing.get("groups", []) if g["familyId"] not in built_families] + groups_report
    out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "builder": BUILDER, "canvas": {"width": OUT_W, "height": OUT_H},
           "counts": {"rows": len(rows), "publishable": sum(1 for r in rows if r["publishable"]), "families": len({r["familyId"] for r in rows})},
           "groups": groups, "rows": rows}
    DIST.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", action="append", help="familyId to build (repeatable)")
    ap.add_argument("--neck", help="only families whose id ends with this neck, e.g. 18-415")
    ap.add_argument("--limit", type=int, help="build at most N render groups (largest first)")
    ap.add_argument("--plan", action="store_true", help="list render groups and stop")
    args = ap.parse_args()
    started = time.time()
    selection = json.loads((DATA / "selection.json").read_text())
    xref = json.loads((DATA / "xref.json").read_text())
    groups = plan_groups(selection, xref, args)
    print(f"{len(groups)} render group(s), {sum(len(g['skus']) for _, g in groups)} SKUs")
    if args.plan:
        for (fid, body), g in groups:
            offs = sum(1 for s in g["skus"] if s["off"])
            print(f"  {fid:40} {body:16} {len(g['skus']):4} SKUs, {offs} with cap-off")
        return

    all_rows, reports, built = [], [], set()
    for (fid, body), g in groups:
        out_dir = DIST / fid
        out_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        print(f"\n=== {fid} / {body} — {len(g['skus'])} SKUs ===")
        log = lambda msg: print(msg)  # noqa: E731
        if body == "standalone":
            rows, registration = build_standalone(fid, g["skus"], out_dir, log)
        else:
            rows, registration = build_registered(fid, body, g["skus"], out_dir, log)
        (out_dir / f"_registration{'' if body == 'standalone' else '-' + body}.json").write_text(json.dumps(registration, indent=1))
        refused = registration.get("refused")
        if refused:
            for item in g["skus"]:
                all_rows.append({"websiteSku": item["sku"], "graceSku": item["graceSku"], "familyId": fid, "familyName": family_name(fid), "neck": "-".join(fid.split("-")[-2:]),
                                 "body": body, "closure": item["closure"], "mode": item["mode"], "warnings": item["warnings"], "plate": None, "thumb": None,
                                 "plateCapOff": None, "thumbCapOff": None, "publishable": False, "blockReasons": [refused]})
        all_rows.extend(rows)
        built.add(fid)
        ok = sum(1 for r in rows if r["publishable"])
        offs = sum(1 for r in rows if r["plateCapOff"])
        reports.append({"familyId": fid, "body": body, "skus": len(g["skus"]), "rendered": len(rows), "publishable": ok, "capOff": offs,
                        "worstResidual": registration.get("worstResidual"), "refused": refused, "seconds": round(time.time() - t0)})
        print(f"  rendered {len(rows)} ({ok} publishable, {offs} with cap-off), residual {registration.get('worstResidual')}, {time.time() - t0:.0f}s")
    for fid in built:
        contact_sheet(fid, [r for r in all_rows if r["familyId"] == fid and r["plate"]], DIST / fid)
    manifest = merge_manifest(all_rows, built, reports)
    print(f"\nmanifest: {manifest['counts']} in {time.time() - started:.0f}s -> {DIST / 'manifest.json'}")


if __name__ == "__main__":
    main()
