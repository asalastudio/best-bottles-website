#!/usr/bin/env python3
"""
Render plates for every publishable SKU from the chosen PSD sources.

    python3 scripts/paperdoll/build_plates.py --family elegant-60ml-clear-18-415
    python3 scripts/paperdoll/build_plates.py --neck 18-415 [--limit 5]
    python3 scripts/paperdoll/build_plates.py --plan            # list the render groups, render nothing

Inputs: data/paper-doll/{selection,xref,tokens}.json. Output: dist/paper-doll/<familyId>/…
and dist/paper-doll/manifest.json (rows in the contract publish.mjs --dist reads).

Two render modes:
  registered — bottles. Within one photographic session a family's PSDs are
      one master (same pixel scale, byte-identical bottle body, only the crop
      moves), so registration there is a pure translation recovered by
      normalised cross-correlation against a bottle-foot template from the
      narrowest plain plate. A family is often photographed more than once,
      though — Circle frosted 100 ml carries bodies 494 px and 1,062 px wide,
      Cylinder 100 ml 497 px and 686 px — so shots are first clustered into
      sessions (each cluster is the set that registers against its own
      reference within the residual gate), and every cluster is then scaled by
      its own body width so the bottle is the same size on every plate and its
      base lands on the same line. Gates, unchanged from the shipping builder:
      post-alignment residual ≤ 12/255 WITHIN a session, closure axis on the
      canvas centre line within 2 px on every capped plate.
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
import re
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
WIDTH_TOLERANCE = 0.03       # body widths within 3 % are the same photographic session
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


def body_metrics(gray):
    """Body width and base: the widest run in the lower 60 % of the ink, and the ink's bottom.

    The body is the one thing every plate in a family shares; the closure is
    not (a tassel is three times the width of a roll-on cap), so scale is
    carried across photographic sessions by the body and nothing else.
    """
    ink = gray < 245
    ys, xs = np.where(ink)
    if len(ys) == 0:
        return None
    y0, y1 = int(ys.min()), int(ys.max())
    lower = ink[y0 + int(0.40 * (y1 - y0)):y1 + 1]
    cols = np.where(lower.any(axis=0))[0]
    if len(cols) == 0:
        return None
    return {"bodyWidth": int(cols.max() - cols.min()), "base": y1, "top": y0}


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
    if rec["chosenLibrary"] != "master":
        raise RuntimeError("selection is not master-only; rebuild inventory and selection before rendering")
    root = Path(SOURCES["libraries"]["master"]["root"]).resolve(strict=True)
    candidate = Path(os.path.abspath(root / rec["chosenPath"]))
    if os.path.commonpath((root, candidate)) != str(root):
        raise RuntimeError(f"source path escapes the PSD master: {rec['chosenPath']}")
    source_path = candidate.resolve(strict=True)
    if os.path.commonpath((root, source_path)) != str(root):
        raise RuntimeError(f"source path resolves outside the PSD master: {rec['chosenPath']}")
    return {"library": "master", "relPath": rec["chosenPath"], "path": source_path, "sha256": rec["chosen"], "stateEvidence": rec["stateEvidence"]}


def validate_front_source(src: dict, website_sku: str):
    """Refuse the two source-selection defects that previously reached production."""
    rel_path = src["relPath"]
    if any("uncapped" in part.lower() for part in Path(rel_path).parts):
        raise RuntimeError(f"uncapped PSD cannot be the front source for {website_sku}")
    source_sku = re.sub(r"^\s*\d+[.-]?\s*", "", Path(rel_path).stem).rstrip(".").strip()
    sku_key = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())  # noqa: E731
    if sku_key(source_sku) != sku_key(website_sku):
        raise RuntimeError(f"front source basename {source_sku!r} does not match website SKU {website_sku!r}")


def plan_groups(selection, xref, args):
    """publishable xref rows -> render groups keyed by (familyId, body token | 'standalone')."""
    groups = defaultdict(lambda: {"skus": []})
    for rec in xref["products"]:
        if not rec["publishable"]:
            continue
        if args.sku and rec["websiteSku"] not in args.sku:
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
        if on is None:
            if off is not None:
                raise RuntimeError(f"only an uncapped source exists for {rec['websiteSku']}; refusing to use it as the front")
            continue
        validate_front_source(on, rec["websiteSku"])
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

    def register_against(ref, candidates):
        """NCC every candidate against a base-edge + side-wall template cut from `ref`."""
        rx0, ry0, rx1, ry1 = ink_bbox(ref["gray"])
        rh = ry1 - ry0
        H, W = ref["gray"].shape
        ty0 = max(0, ry1 - int(rh * 0.22))
        ty1 = min(H, ry1 + max(8, int(rh * 0.02)))
        tx0 = max(0, rx0 - 12)
        tx1 = min(W, rx1 + 12)
        patch = ref["gray"][ty0:ty1, tx0:tx1]
        ph, pw = patch.shape
        out = {}
        for sh in candidates:
            # a template cut from a larger session cannot be searched inside a smaller
            # canvas; that shot belongs to another session and gets its own round
            if sh["gray"].shape[0] < ph or sh["gray"].shape[1] < pw:
                out[id(sh)] = (0, 0, 255.0, 255.0)
                continue
            # The template reaches a little BELOW the base (ty1 = base + 2 % of the
            # body). A shot exported on a tighter canvas — the 100 ml reducers end
            # 17 px under the base where the reference has 141 — put the window off
            # the bottom, and the shape test below scored it 255 as if it were a
            # different bottle. Nothing is under a base but background, so the
            # canvas is extended with white to where the template can land.
            g = sh["gray"]
            pad_b = max(0, (ry1 - ty0) + (ty1 - ry1) + 8 - (g.shape[0] - (ink_bbox(g)[3] - (ry1 - ty0))))
            if pad_b > 0 and not os.environ.get("PLATES_NO_PAD"):     # NO_PAD: the pre-fix behaviour, for A/B proof only
                g = np.pad(g, ((0, pad_b), (0, 0)), constant_values=255)
            iy, ix, _ = ncc_offset(patch, g)
            dx, dy = ix - tx0, iy - ty0
            win = g[ty0 + dy:ty0 + dy + ph, tx0 + dx:tx0 + dx + pw]
            if win.shape != patch.shape:
                out[id(sh)] = (dx, dy, 255.0, 255.0)
                continue
            diff = np.abs(win.astype(np.int16) - patch.astype(np.int16))
            # A bulb or tassel lies across one side of the base band. The clean half of
            # the template still measures the alignment honestly, so the half residual
            # is what a hanging closure is judged on — the same threshold, not a looser one.
            half = pw // 2
            out[id(sh)] = (dx, dy, float(diff.mean()), float(min(diff[:, :half].mean(), diff[:, half:].mean())))
        return {"ref": ref, "template": [tx0, ty0, tx1, ty1], "refBase": ry1, "fits": out}

    # --- sessions. Group by the ONE thing every plate in a session shares: the
    # measured width of the bottle body. Residual alone cannot do it — a frosted
    # wall is nearly featureless, so a base template matches a differently scaled
    # photograph of the same bottle at a low residual, and Circle frosted 100 ml
    # came out with two scales inside one "session". Width first, then NCC for
    # the translation, then the residual gate inside the session.
    assembled = [e["on"] for e in per_sku.values()]
    for sh in shots:
        m = body_metrics(sh["gray"])
        sh["bodyWidth"] = m["bodyWidth"] if m else None
    # a bulb or tassel lies beside the bottle and widens the lower band, so those
    # shots never define a session; they join the one whose template fits them best
    definers = [sh for sh in shots if sh in assembled and sh["closure"] not in HANGING_CLOSURES and sh["bodyWidth"]]
    if not definers:
        definers = [sh for sh in shots if sh["bodyWidth"]]
    groups: list[list] = []
    for sh in sorted(definers, key=lambda s: s["bodyWidth"]):
        if groups and sh["bodyWidth"] <= groups[-1][-1]["bodyWidth"] * (1 + WIDTH_TOLERANCE):
            groups[-1].append(sh)
        else:
            groups.append([sh])
    clusters = []
    for members in groups:
        ref = min(members, key=width_of)
        reg = register_against(ref, members)
        kept = [sh for sh in members if reg["fits"][id(sh)][2] <= RESIDUAL_MAX]
        if ref not in kept:
            kept.append(ref)
        for sh in kept:
            sh["dx"], sh["dy"], sh["residual"], sh["halfResidual"] = reg["fits"][id(sh)]
            sh["cluster"] = len(clusters)
        widths = [sh["bodyWidth"] for sh in kept if sh["bodyWidth"]]
        clusters.append({"index": len(clusters), "ref": ref, "refBase": reg["refBase"], "template": reg["template"], "members": kept,
                         "bodyWidth": float(np.median(widths)) if widths else None,
                         "worstResidual": max((sh["residual"] for sh in kept), default=0.0)})
    # everything else — hanging closures, and any definer its own group rejected —
    # joins the session whose template fits it best
    placed = {id(sh) for c in clusters for sh in c["members"]}
    for sh in shots:
        if id(sh) in placed:
            continue
        best = None
        for c in clusters:
            fit = register_against(c["ref"], [sh])["fits"][id(sh)]
            if best is None or fit[2] < best[1][2]:
                best = (c, fit)
        hanging = sh["closure"] in HANGING_CLOSURES
        score = (lambda fit: fit[3]) if hanging else (lambda fit: fit[2])
        if best:
            best = min(((c, register_against(c["ref"], [sh])["fits"][id(sh)]) for c in clusters), key=lambda cf: score(cf[1]))
        if best and score(best[1]) <= RESIDUAL_MAX:
            c, (dx, dy, residual, half) = best
            sh["dx"], sh["dy"], sh["residual"], sh["halfResidual"], sh["cluster"] = dx, dy, residual, half, c["index"]
            sh["judgedOnHalf"] = hanging
            c["members"].append(sh)
            c["worstResidual"] = max(c["worstResidual"], score(best[1]))
        else:
            sh["cluster"] = None
            sh["residual"] = best[1][2] if best else 255.0
            sh["dx"] = sh["dy"] = 0
    # A re-shoot nothing else matches. The 100 ml antique sprays are a 0.39x export
    # of the same bottle: hanging closures, so they may not DEFINE a session, and no
    # session at their scale existed for them to JOIN — every one was set aside. Let
    # the unplaced shots try to agree among themselves: the narrowest is the least
    # contaminated by a bulb or tassel, so it is the reference; anything that
    # registers against it within the same residual gate (the half template for a
    # hanging closure) forms a session with it. Three members at least — a
    # re-shoot is never one photograph, and a lone stray must stay set aside.
    RESCUE_MIN = 3
    while True:
        unplaced = [sh for sh in shots if sh.get("cluster") is None and sh["bodyWidth"]]
        if len(unplaced) < RESCUE_MIN:
            break
        ref = min(unplaced, key=width_of)
        reg = register_against(ref, unplaced)
        members = []
        for sh in unplaced:
            fit = reg["fits"][id(sh)]
            hanging = sh["closure"] in HANGING_CLOSURES
            if (fit[3] if hanging else fit[2]) <= RESIDUAL_MAX:
                members.append((sh, fit, hanging))
        if len(members) < RESCUE_MIN:
            break
        idx = len(clusters)
        for sh, (dx, dy, residual, half), hanging in members:
            sh["dx"], sh["dy"], sh["residual"], sh["halfResidual"], sh["cluster"] = dx, dy, residual, half, idx
            sh["judgedOnHalf"] = hanging
        # The session's width is its narrowest member's BODY width: a bulb or tassel
        # only ever adds to the lower band, so the minimum is the bare bottle. The
        # first cut used the reference's ink width (bottle plus bulb, 405 px where
        # the body is 196) and would have drawn every antique spray at half size.
        bare = [sh["bodyWidth"] for sh, _, _ in members if sh["bodyWidth"]] or [width_of(ref)]
        clusters.append({"index": idx, "ref": ref, "refBase": reg["refBase"], "template": reg["template"],
                         "members": [m[0] for m in members], "bodyWidth": float(min(bare)), "rescued": True,
                         "worstResidual": max((m[1][3] if m[2] else m[1][2]) for m in members)})
        log(f"   ++ session {idx} rescued: {len(members)} shots at body width {min(bare):.0f}px, ref {ref['sku']}")

    worst = max((c["worstResidual"] for c in clusters), default=255.0)
    primary = max(clusters, key=lambda c: len(c["members"])) if clusters else None
    if primary and primary["bodyWidth"]:
        for c in clusters:                     # every session is scaled by its own body width
            c["k"] = (primary["bodyWidth"] / c["bodyWidth"]) if c["bodyWidth"] else 1.0
    ref = primary["ref"] if primary else shots[0]
    tx0, ty0, tx1, ty1 = primary["template"] if primary else (0, 0, 0, 0)
    registration = {"familyId": fid, "body": body, "reference": ref["src"]["relPath"], "template": [tx0, ty0, tx1, ty1], "worstResidual": round(worst, 2),
                    "sessions": [{"index": c["index"], "reference": c["ref"]["src"]["relPath"], "shots": len(c["members"]),
                                  "bodyWidth": c["bodyWidth"], "scaleFactor": round(c.get("k", 1.0), 4), "worstResidual": round(c["worstResidual"], 2),
                                  "rescued": bool(c.get("rescued"))} for c in clusters],
                    "residuals": {f"{sh['sku']}.front-{sh['state']}": round(sh["residual"], 2) for sh in shots},
                    "judgedOnHalfTemplate": [f"{sh['sku']}.front-{sh['state']}" for sh in shots if sh.get("judgedOnHalf")], "excluded": {}, "plates": {}}
    # what no session could register (a different bottle, a re-shoot nothing else matches) is set aside
    outliers = [sh for sh in shots if sh.get("cluster") is None]
    if outliers:
        for sh in outliers:
            registration["excluded"][f"{sh['sku']}.front-{sh['state']}"] = "registration_unmatched"
            log(f"   -- {sh['sku']} [{sh['state']}]: matches no session, set aside")
        excluded_skus = {sh["sku"] for sh in outliers if sh["state"] == "on"}
        shots = [sh for sh in shots if sh not in outliers]
        for entry in list(per_sku.values()):
            if "off" in entry and entry["off"] in outliers:
                del entry["off"]
        per_sku = {sku: e for sku, e in per_sku.items() if sku not in excluded_skus}
    if not shots or primary is None:
        log("   !! refused: nothing registered")
        registration["refused"] = "registration_unmatched"
        return [], registration

    # one output scale for the family, measured in the primary session's pixels
    max_w, uy0, uy1 = 0, 10**9, -10**9
    for sh in shots:
        c = clusters[sh["cluster"]]
        k = c.get("k", 1.0)
        x0, y0, x1, y1 = ink_bbox(sh["gray"])
        max_w = max(max_w, (x1 - x0) * k)
        base_rel_top = (c["refBase"] + sh["dy"] - y0) * k        # bottle base above the ink top
        base_rel_bot = (c["refBase"] + sh["dy"] - y1) * k        # …and below the ink bottom
        uy0 = min(uy0, -base_rel_top)
        uy1 = max(uy1, -base_rel_bot)
    uh = uy1 - uy0
    scale = min((OUT_W - 2 * PAD) / max_w, (OUT_H - 2 * PAD) / uh)
    base_out = PAD - uy0 * scale + ((OUT_H - 2 * PAD) - uh * scale) / 2   # where every bottle's base lands
    registration.update({"scale": scale, "band": [round(uy0, 1), round(uy1, 1)], "baseOut": round(base_out, 1)})

    def render(sh, on_axis):
        c = clusters[sh["cluster"]]
        s_c = scale * c.get("k", 1.0)
        if on_axis:
            ox = OUT_W / 2 - cap_axis(sh["gray"]) * s_c
        else:
            x0, _, x1, _ = ink_bbox(sh["gray"])
            ox = (OUT_W - (x1 - x0) * s_c) / 2 - x0 * s_c
        oy = base_out - (c["refBase"] + sh["dy"]) * s_c
        inv = 1.0 / s_c
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
        registration["plates"][name_on] = {"session": on["cluster"], "dx": on["dx"], "dy": on["dy"], "ox": round(ox, 3), "oy": round(oy, 3), "residual": round(on["residual"], 2), "axisOffset": None if axis_off is None else round(axis_off, 2)}
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
            registration["plates"][name_off] = {"session": off["cluster"], "dx": off["dx"], "dy": off["dy"], "ox": round(ox2, 3), "oy": round(oy2, 3), "residual": round(off["residual"], 2)}
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
    ap.add_argument("--sku", action="append", help="website SKU to build (repeatable)")
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
