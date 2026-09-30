#!/usr/bin/env python3
"""Pick one dip tube layer per (plate, fitment family) from the hero cuts and publish it for the stages.

    own      the slot's own hero cut: fit >= 0.35 on clear and amber glass, >= 0.45 on frosted
    bulb     a tassel bulb sprayer has the plain bulb sprayer's head and tube: that glass's bulb cut
    tassel   the other way round, when the bulb hero did not cut
    clear    frosted glass (every family its clear bottle has): the same bottle's clear cut, moved onto the frosted
             plate (seat and axis to seat and axis) and frosted with the Tall 9 mL recipe Jordan approved 30 Sep (20% toward the frost, 60% opacity,
             0.12 mm blur; scripts/register/blender/thin_frosted_tube.py)

    python3 scripts/register/tubes/finalize_tubes.py

Reads output/register-tubes/ (cut_heroes.py). Writes public/images/register/tubes/<plate>-<family>[-exploded].<sha12>.png
and src/lib/register/hero-tubes.json (each layer's size and top-left on its plate, plate px). A frosted glass also gets
an EXPLODED layer: lifted out of the glass, its tube is the clear bottle's clear tube.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
CUTS = ROOT / "output" / "register-tubes"
PUBLIC = ROOT / "public" / "images" / "register" / "tubes"
MANIFEST = ROOT / "src" / "lib" / "register" / "hero-tubes.json"
PLATES = {p["plateKey"]: p for p in json.loads((ROOT / "data/register/bodies/bodies-measurements.json").read_text())}
FROST, MIX, OPACITY, BLUR_MM = (236, 234, 230), 0.20, 0.60, 0.12
TWIN = {"tassel": "bulb", "bulb": "tassel"}


def good(cuts, slot, frosted=False):
    c = cuts.get(slot)
    return bool(c and "error" not in c and c["fit"]["score"] >= (0.45 if frosted else 0.35))


def move(im, bbox, src, dst):
    """A cut on one plate of a bottle, on another plate of the same bottle: seat and axis to seat and axis."""
    s = dst["pxPerMm"] / src["pxPerMm"]; sa, da = src["anchors"], dst["anchors"]
    x0 = da["axisX"] + (bbox[0] - sa["axisX"]) * s; y0 = da["seatY"] + (bbox[1] - sa["seatY"]) * s
    size = (max(1, round(bbox[2] * s)), max(1, round(bbox[3] * s)))
    return np.asarray(Image.fromarray(im.clip(0, 255).astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)).astype(float), \
        [int(round(x0)), int(round(y0)), size[0], size[1]]


def frost(im, px_per_mm):
    rgb = im[..., :3] * (1 - MIX) + np.array(FROST) * MIX; a = im[..., 3:4] * OPACITY
    pre = np.concatenate([rgb * a / 255, a], -1).clip(0, 255).astype(np.uint8)
    b = np.asarray(Image.fromarray(pre, "RGBA").filter(ImageFilter.GaussianBlur(BLUR_MM * px_per_mm))).astype(float)
    out_a = b[..., 3:4]
    return np.concatenate([np.where(out_a > 0, b[..., :3] * 255 / np.maximum(out_a, 1), 0), out_a], -1)


# A glass whose seated tube cannot be seen still shows it lifted out in EXPLODED: the amber Tulip 5 mL hides its tube
# (its hero shows none), so EXPLODED borrows the clear Tulip 6 mL's, the same 13-415 fine mist pump, cut to its own floor.
BORROW = {"tulip-5ml-13-415|Amber|spray": "tulip-6ml-13-415|Clear|spray"}
FLOOR_MM = json.loads((ROOT / "data/register/tubes/hero-sources.json").read_text())["floorMmAboveFoot"]["values"]
# A tube cut from inside ribbed or faceted glass carries the glass's pattern with it; lifted out in EXPLODED it drew
# broken. Those glasses lift a clean tube of the same mechanism (same neck, same family) from a plain glass, cut to
# their own floor. Seated, they keep their own hero's cut.
TEXTURED = ("diva-", "diamond-", "flair-")
CLEAN_DONOR = {
    ("18-415", "spray"): "cylinder-100ml-18-415|Clear|spray",
    ("18-415", "lotion"): "cylinder-100ml-18-415|Clear|lotion",
    ("18-415", "bulb"): "cylinder-100ml-18-415|Clear|tassel",
    ("18-415", "tassel"): "cylinder-100ml-18-415|Clear|tassel",
    ("13-415", "spray"): "tall-rectangle-10ml-13-415|Clear|spray",
}


def placed(cuts, src, pk):
    """A cut as an RGBA array and its box on plate pk (moved from its own plate when that is another glass)."""
    im = np.asarray(Image.open(CUTS / f"{src.replace('|', '_')}.tube.png").convert("RGBA")).astype(float)
    bbox = cuts[src]["bbox"]
    src_pk = "|".join(src.split("|")[:2])
    return move(im, bbox, PLATES[src_pk], PLATES[pk]) if src_pk != pk else (im, bbox)


def cut_to_floor(im, bbox, pk):
    """A borrowed tube ends on this glass's own inner floor: rows below it go, the last 0.3 mm fades."""
    p = PLATES[pk]
    floor_y = p["anchors"]["baselineY"] - FLOOR_MM[p["bodyId"]] * p["pxPerMm"]
    rows = np.arange(im.shape[0]) + bbox[1]
    fade = 0.3 * p["pxPerMm"]
    keep = np.clip((floor_y - rows) / fade, 0, 1)
    im = im.copy(); im[..., 3] *= keep[:, None]
    last = int(np.nonzero(keep)[0].max()) + 1 if keep.any() else 1
    return im[:last], [bbox[0], bbox[1], bbox[2], last]


def tidy(im, px_per_mm):
    """Only the mechanism: every row keeps the one piece through the centre, and never wider than the rows above it
    (the shaft only narrows into the tube; widths smoothed over 0.8 mm so one faint row sets nothing, never below the
    tube's own width, plus 0.3 mm for a flange). Where the hero's glass shoulder or floor crossed the cut, the cut ran
    wider; those wings were the hero's glass painted over the plate's."""
    from scipy import ndimage
    a = im[..., 3] / 255.0
    h, w = a.shape
    pieces, widths = [None] * h, np.zeros(h)
    centres = np.full(h, np.nan)
    c_prev = None
    for y in range(h):
        on = a[y] > 0.3
        if not on.any():
            continue
        xs = np.nonzero(on)[0]
        c = c_prev if c_prev is not None else float((a[y] * np.arange(w)).sum() / max(a[y].sum(), 1e-6))
        near = int(xs[np.argmin(np.abs(xs - c))])
        lo = near
        while lo > 0 and on[lo - 1]: lo -= 1
        hi = near
        while hi < w - 1 and on[hi + 1]: hi += 1
        pieces[y], widths[y] = (lo, hi), hi - lo + 1
        piece = a[y, lo:hi + 1]
        c_prev = centres[y] = float((piece * np.arange(lo, hi + 1)).sum() / max(piece.sum(), 1e-6))
    valid = widths > 0
    if valid.sum() < 10:
        return im
    tube_w = float(np.median(widths[valid][valid.sum() // 2:]))
    k = max(3, int(0.8 * px_per_mm) | 1)
    smooth = ndimage.median_filter(np.where(valid, widths, tube_w), size=k, mode="nearest")
    allowed = np.minimum.accumulate(np.maximum(smooth, tube_w)) + 0.3 * px_per_mm
    out = im.copy()
    for y in range(h):
        if pieces[y] is None:
            out[y, :, 3] = 0
            continue
        lo, hi = pieces[y]
        if hi - lo + 1 > allowed[y]:
            half = allowed[y] / 2
            lo, hi = max(lo, int(np.floor(centres[y] - half))), min(hi, int(np.ceil(centres[y] + half)))
        keep = np.zeros(w, bool); keep[max(0, lo - 1):min(w, hi + 2)] = True
        out[y, ~keep, 3] = 0
    return out


def clean_tube(im, px_per_mm):
    """The tube as EXPLODED shows it, alone on the stage (Jordan 2026-09-30: "cleaned up… not painted over… the dip tube
    looks like it's rubbed off"). Seated, the glass hid where the hero's shoulder or floor crossed the cut; lifted out,
    those rows show. So: the shaft is trimmed to its own outline and smoothed along its length (the shoulder's streaks go,
    its steps stay); the tube keeps every healthy row of the hero's own pixels, and only a faint, flared or off-track row
    is redrawn from the tube's own cross-section on the traced curve; the end is a clean cut."""
    from scipy import ndimage
    a = im[..., 3] / 255.0
    h, w = a.shape
    xs = np.arange(w)
    mass = a.sum(1)
    centre = np.where(mass > 0.5, (a * xs).sum(1) / np.maximum(mass, 1e-6), np.nan)
    width = (a > 0.5).sum(1).astype(float)
    solid = np.isfinite(centre) & (width > 0)
    if solid.sum() < 10:
        return im
    tube_w = float(np.median(width[solid][int(0.4 * solid.sum()):]))
    shaft_end, run = 0, 0
    for y in range(h):
        if solid[y] and width[y] > 1.6 * tube_w:
            shaft_end, run = y, 0
        else:
            run += 1
            if run > 1.0 * px_per_mm and shaft_end:
                break
    out = im.copy()
    # The shaft: each row trimmed to the shaft's own outline (a width smoothed over 1 mm, so a streak one or two rows
    # tall that ran wider is cut back), then every column smoothed along the shaft's length over 0.6 mm.
    if shaft_end > 2:
        k = max(3, int(1.0 * px_per_mm) | 1)
        w_s = ndimage.median_filter(width[:shaft_end + 1], size=k, mode="nearest")
        c_s = ndimage.median_filter(np.nan_to_num(centre[:shaft_end + 1], nan=np.nanmedian(centre)), size=k, mode="nearest")
        shaft = out[:shaft_end + 1].copy()
        m = max(3, int(0.6 * px_per_mm) | 1)
        shaft = ndimage.median_filter(shaft, size=(m, 1, 1), mode="nearest")
        for y in range(shaft_end + 1):
            lo, hi = int(np.floor(c_s[y] - w_s[y] / 2 - 1)), int(np.ceil(c_s[y] + w_s[y] / 2 + 1))
            shaft[y, :max(0, lo), 3] = 0
            shaft[y, min(w, hi + 1):, 3] = 0
        out[:shaft_end + 1] = shaft
    # The tube: healthy rows kept; the rest redrawn.
    rows = np.arange(shaft_end + 1, h)
    good_width = solid[rows] & (width[rows] >= 0.6 * tube_w) & (width[rows] <= 1.5 * tube_w)
    if good_width.sum() < 10:
        return out
    med_mass = float(np.median(mass[rows][good_width]))
    healthy = good_width & (mass[rows] >= 0.55 * med_mass)
    # the traced curve through the healthy rows, smoothed; a row far off it is off-track
    known = rows[healthy]
    curve = np.interp(rows, known, centre[known])
    k = max(3, int(2.0 * px_per_mm) | 1)
    curve = np.convolve(np.pad(curve, (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid")
    healthy &= ~(np.abs(np.nan_to_num(centre[rows], nan=1e9) - curve) > 0.6 * tube_w)
    half = int(np.ceil(tube_w)) + 3
    samples = [im[y, int(round(centre[y])) - half:int(round(centre[y])) + half + 1] for y in rows[healthy]
               if int(round(centre[y])) - half >= 0 and int(round(centre[y])) + half + 1 <= w]
    profile = np.median(np.stack(samples), 0) if samples else None
    # A row must also look like the tube: where the hero's glass floor crossed it, the row carries the floor's lines.
    if profile is not None:
        lum = lambda seg: (seg[:, :3] @ np.array([0.299, 0.587, 0.114])) * seg[:, 3] / 255.0
        ref = lum(profile); ref = (ref - ref.mean()) / (ref.std() + 1e-6)
        # ...and as bright as the tube: the floor's lines darken it (a row's mean over its own piece)
        row_lum = np.array([float((im[y, :, :3] @ np.array([0.299, 0.587, 0.114]) * a[y]).sum() / max(a[y].sum(), 1e-6)) for y in rows])
        typical = float(np.median(row_lum[healthy])) if healthy.any() else 0.0
        healthy &= np.abs(row_lum - typical) <= 0.08 * typical
        for i, y in enumerate(rows):
            if not healthy[i]:
                continue
            c = int(round(centre[y]))
            if c - half < 0 or c + half + 1 > w:
                continue
            v = lum(im[y, c - half:c + half + 1]); v = (v - v.mean()) / (v.std() + 1e-6)
            if float((v * ref).mean()) < 0.5:
                healthy[i] = False
    # the end: the last healthy row, or, in the tube's bottom fifth, the row before the first 0.3 mm of floor rows
    # (below the floor the hero shows the tube through the base glass: a detached bit that is not the tube's end)
    end = int(rows[healthy][-1]) if healthy.any() else h - 1
    if healthy.any():
        first, last = int(np.nonzero(healthy)[0][0]), int(np.nonzero(healthy)[0][-1])
        start = first + int(0.8 * (last - first))
        run, need = 0, max(2, int(0.3 * px_per_mm))
        for i in range(start, last + 1):
            run = 0 if healthy[i] else run + 1
            if run >= need:
                end = int(rows[i - run])
                break
    end = max(shaft_end + 1, end - int(0.4 * px_per_mm))      # the last 0.4 mm meets the glass floor in the hero
    for i, y in enumerate(rows):
        if y > end:
            out[y] = 0
            continue
        if healthy[i] or profile is None:
            # a healthy row keeps its own pixels, moved onto the smooth curve (no kinks where repaired rows meet it)
            shift = curve[i] - centre[y]
            if abs(shift) > 0.05:
                src = np.arange(w) - shift
                for ch in range(4):
                    out[y, :, ch] = np.interp(src, np.arange(w), im[y, :, ch], left=0, right=0)
            continue
        out[y] = 0
        c = curve[i]; c0 = int(np.floor(c)); frac = c - c0
        for shift, weight in ((0, 1 - frac), (1, frac)):
            x0 = c0 + shift - half
            lo, hi = max(0, x0), min(w, x0 + 2 * half + 1)
            if hi > lo:
                seg = profile[lo - x0:hi - x0]
                out[y, lo:hi, :3] += seg[:, :3] * (seg[:, 3:4] / 255.0) * weight
                out[y, lo:hi, 3] += seg[:, 3] * weight
        a2 = out[y, :, 3:4]
        out[y, :, :3] = np.where(a2 > 0, out[y, :, :3] * 255.0 / np.maximum(a2, 1e-6), 0)
    # the cut end: the last 0.25 mm darkens a touch and fades out
    tail = max(2, int(0.25 * px_per_mm))
    for j in range(tail):
        y = end - j
        if y > shaft_end:
            t = (j + 1) / tail
            out[y, :, :3] *= 0.9 + 0.1 * t
            out[y, :, 3] *= 0.55 + 0.45 * t
    return out[:end + 1]


def publish(im, bbox, slug):
    png = Image.fromarray(im.clip(0, 255).astype(np.uint8), "RGBA")
    tmp = PUBLIC / f"{slug}.png"
    png.save(tmp, optimize=True)
    final = PUBLIC / f"{slug}.{hashlib.sha256(tmp.read_bytes()).hexdigest()[:12]}.png"
    tmp.rename(final)
    return {"url": "/" + str(final.relative_to(ROOT / "public")), "width": png.width, "height": png.height, "x": bbox[0], "y": bbox[1]}


def main():
    cuts = json.loads((CUTS / "cuts.json").read_text())
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob("*.png"):
        old.unlink()
    tubes, missing = {}, []
    # Every frosted glass takes each family its clear bottle has, even where the frosted SKUs had no hero or their old
    # shared tube showed through the frosted glass (the bulb sprayers): one look per bottle.
    slots = set(cuts) | set(BORROW)
    for slot in cuts:
        pk, fam = "|".join(slot.split("|")[:2]), slot.split("|")[2]
        frosted = pk.replace("|Clear", "|Frosted")
        if pk.endswith("|Clear") and frosted in PLATES:
            slots.add(f"{frosted}|{fam}")
    for slot in sorted(slots):
        pk, fam = "|".join(slot.split("|")[:2]), slot.split("|")[2]
        slug = pk.replace("|", "-").lower() + "-" + fam
        frosted = PLATES[pk]["glass"] == "Frosted"
        twin = TWIN.get(fam)
        clear = pk.replace("|Frosted", "|Clear")
        clear_src = next((f"{clear}|{f}" for f in [fam] + ([twin] if twin else []) if good(cuts, f"{clear}|{f}")), None) if frosted else None
        choice = None
        if slot in cuts and good(cuts, slot, frosted):
            choice = ("own", slot)
        elif twin and good(cuts, f"{pk}|{twin}", frosted):
            choice = (twin, f"{pk}|{twin}")
        elif clear_src:
            choice = ("clear", clear_src)
        entry = {"seated": None, "exploded": None}
        if choice:
            how, src = choice
            im, bbox = placed(cuts, src, pk)
            im = tidy(im, PLATES[pk]["pxPerMm"])
            entry["seated"] = publish(frost(im, PLATES[pk]["pxPerMm"]) if how == "clear" else im, bbox, slug)
            entry.update({"from": how, "hero": cuts[src]["hero"], "fit": cuts[src]["fit"]["score"]})
        # EXPLODED lifts the tube out of the glass: out of frosted glass it is the clear bottle's clear tube, out of
        # ribbed or faceted glass a clean tube of the same mechanism.
        donor = CLEAN_DONOR.get(("-".join(PLATES[pk]["bodyId"].split("-")[-2:]), fam)) if pk.startswith(TEXTURED) else None
        lifted = None
        if donor and good(cuts, donor):
            lifted = cut_to_floor(*placed(cuts, donor, pk), pk)
        elif frosted and clear_src:
            lifted = placed(cuts, clear_src, pk)
        elif slot in BORROW and good(cuts, BORROW[slot]):
            lifted = cut_to_floor(*placed(cuts, BORROW[slot], pk), pk)
            entry.setdefault("from", "borrowed for EXPLODED: " + BORROW[slot])
        elif choice:
            lifted = placed(cuts, choice[1], pk)
        if lifted:
            im_l, bbox_l = lifted
            clean = clean_tube(tidy(im_l, PLATES[pk]["pxPerMm"]), PLATES[pk]["pxPerMm"])
            entry["exploded"] = publish(clean, [bbox_l[0], bbox_l[1], clean.shape[1], clean.shape[0]], slug + "-exploded")
        if not entry["seated"] and not entry["exploded"]:
            missing.append(slot)
            continue
        tubes[slot] = entry
    MANIFEST.write_text(json.dumps({
        "_doc": "Dip tube + pump shaft layers cut from the released catalogue heroes (scripts/register/tubes/). Key: plateKey|family "
                "(bulb, tassel, spray, lotion). seated: the tube in the glass (SIDECAR, CAP ON), the hero's own pixels; exploded: the "
                "tube lifted out with its actuator (EXPLODED), the same cut cleaned to stand alone (the clear bottle's for frosted "
                "glass, a plain glass's for ribbed or faceted glass). x, y: the layer's top-left on its plate, plate px; it draws at the plate's own scale. "
                "from: own = this slot's hero; bulb/tassel = the twin bulb sprayer's; clear = the clear bottle's, frosted.",
        "tubes": tubes}, indent=1) + "\n")
    print(f"{len(tubes)} slots -> {MANIFEST.relative_to(ROOT)}; {sum(1 for t in tubes.values() if t['exploded'])} with an EXPLODED layer "
          f"of their own; {len(missing)} without: {', '.join(missing)}")


if __name__ == "__main__":
    sys.exit(main())
