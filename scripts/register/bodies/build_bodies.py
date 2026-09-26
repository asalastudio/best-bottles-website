#!/usr/bin/env python3
"""
Catalogue glass bodies with Sunburst, the pilot method at catalogue scale (Jordan 2026-09-25: generate every
glass body from the proper measurements; these become the source-of-truth bodies).

  python3 scripts/register/bodies/build_bodies.py inputs [--pass lit]                  # geometry + material images per body x glass
  node   scripts/register/bodies/render_bodies.mjs  [--pass lit] [--only a,b|Glass]    # Sunburst (resumable)
  python3 scripts/register/bodies/build_bodies.py qa [--pass lit] [--only bodyA,bodyB] # fit, lock, bone-bake, measure, sheets

One master geometry per body: its Clear cut, else its first cut glass, enlarged so the body's longest side is
2000 px on its own canvas (multiples of 16, at least 655,360 px). Every glass of that body takes the master's
geometry. The master mask is the row-filled silhouette of that cut: the PSD cuts of clear bodies carry
see-through interiors, and a glass body's silhouette has no holes. The 1 ml vial's mask also stops at the
ink, its cut carries white paper outside the glass.

First pass (jobs.json, renders/, final/): the master is enhanced from its own photo (locked two-line prompt);
every other glass adds its own photo fitted to the master as the material image, or, with no usable photo,
the pilot's reference glass. Jordan's review (2026-09-25): the plates read as the Photoshop cuts, not as
Sunburst glass; "use the actual glass reference image that we have on file for the clear, frosted, cobalt,
and amber bottles".

Second pass, --pass lit (jobs-lit.json, renders-lit/, final-lit/): every plate renders from the master
geometry plus the pilot's reference glass render of its colour (clear, frosted, amber, cobalt blue, swirl),
lighting and finish from the reference, geometry locked to the first image. Glasses with no reference on
file (green, blue) keep their own photo as the material image; white masters take the clear reference for
lighting and keep their own colour. Named necks are edited before rendering (NECK_EDITS): the orifice
reducer photographed in the Grace, Empire and Diamond necks and the plug in the Tola necks are trimmed above
the glass rim, the master mask ends at the rim, and one prompt line asks for an empty mouth. The Tola plug
is cut out as its own component layers (plug_layers). The pilot body (cylinder-9ml-17-415) belongs to the
Phase 3 lane: it renders for the gallery like every other body, but push-bodies.ts skips it: dev keeps its Phase 3 plates.

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
from neck_axis import MAX_SHIFT_MM, SEATED_NECK, neck_axis  # noqa: E402


def seat_axis(entry: dict, alpha: np.ndarray, pm: dict, px_per_mm: float) -> float:
    """A threaded neck seats its closure on the neck's own axis (neck_axis.py, Jordan 2026-09-26); anything else, the barrel's."""
    axis = neck_axis(alpha, pm["rim"], px_per_mm)
    if SEATED_NECK.search(entry["bodyId"]) and abs(axis - pm["axisX"]) / px_per_mm <= MAX_SHIFT_MM:
        return round(axis, 1)
    return round(pm["axisX"], 1)
import review_sheet as rs  # noqa: E402
from scipy import ndimage as ndi  # noqa: E402

ROOT = cp.ROOT
BASE = ROOT / "output" / "register-bodies"
COMPONENTS = ROOT / "output" / "register-components"
CUTS = json.loads((ROOT / "data" / "register" / "bodies" / "cuts.json").read_text())
INV = {f"{r['bodyId']}|{r['glass']}": r for r in csv.DictReader((ROOT / "data" / "register" / "bodies" / "inventory.csv").open())}
MEASURE = ROOT / "data" / "register" / "bodies" / "bodies-measurements.json"
PILOT_RENDERS = cp.OUT / "sunburst" / "renders"   # un-baked pilot glass, the reference renders on file
REFERENCE = {"Clear": "clear", "Amber": "amber", "Cobalt Blue": "cobalt-blue", "Frosted": "frosted", "Swirl": "swirl"}
# Reference renders on file, per glass. Amber: the Boston round 30 mL amber, rendered from its own photo in the first
# pass ("Boston round amber is good reference", Jordan 2026-09-25); the others are the pilot cylinder renders.
REFERENCE_FILES = {"Amber": BASE / "renders" / "boston-round-30ml-20-400" / "amber.png"}
reference_file = lambda glass: REFERENCE_FILES.get(glass) or (PILOT_RENDERS / f"{REFERENCE[glass]}.png")
BONE = np.array([0xF5, 0xF3, 0xEF], dtype=np.float32)
BONE_BAKED = {"Clear", "Swirl"}
LONG_SIDE, MARGIN, MIN_PX, TILT = 2000, 96, 655_360, math.radians(6.0)
PILOT_BODY = "cylinder-9ml-17-415"
slug = lambda s: s.lower().replace(" ", "-").replace("/", "-")


def opt(name: str, default: str | None = None) -> str | None:
    flag = f"--{name}"
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv and sys.argv.index(flag) + 1 < len(sys.argv) else default


PASS = opt("pass", "first") or "first"
SUFFIX = "" if PASS == "first" else f"-{PASS}"
RENDERS, FINAL, JOBS = BASE / f"renders{SUFFIX}", BASE / f"final{SUFFIX}", BASE / f"jobs{SUFFIX}.json"
ONLY = {s for s in (opt("only", "") or "").split(",") if s}

# Second-pass prompts: three numbered lines as in the pilot. A fourth line only for the named neck edits.
LIT_CLEAR = "1. Keep geometry locked to the first image\n2. Lighting and finish quality from the second image; the glass stays colourless and clear\n3. Enhance the quality"
LIT_COLOUR = "1. Keep geometry locked to the first image\n2. Glass colour, material and lighting from the second image\n3. Enhance the quality"
LIT_OWN_COLOUR = "1. Keep geometry locked to the first image\n2. Lighting and finish quality from the second image; keep the glass colour of the first image\n3. Enhance the quality"
MATERIAL = "1. Keep geometry locked to the first image\n2. Glass colour and material from the second image\n3. Enhance the quality"
# Textured glass needs the word: with the colour prompt alone the model keeps the glass plain and clear (Round 78 frosted
# test; the pilot Swirl came out plain, 2026-09-25). {word}: how the prompt names the material.
TEXTURED = {"Frosted": "frosted satin glass, satin-etched and translucent white", "Swirl": "swirl glass, clear glass with its spiral fluted ribs"}
LIT_TEXTURED = "1. Keep geometry locked to the first image\n2. {word}: the material, colour and lighting of the second image\n3. Enhance the quality"
LIT_TEXTURED_OWN = "1. Keep geometry locked to the first image\n2. Glass material and colour from the second image: {word}; lighting and finish quality from the third image\n3. Enhance the quality"
EMPTY_MOUTH = {
    "orifice reducer": "4. The mouth of the bottle is open and empty: no orifice reducer, plastic insert or collar in the neck; the rim is plain glass",
    "plug": "4. The mouth of the bottle is open and empty: no plug or plastic insert in the neck",
    "roller ball": "4. The mouth of the bottle is open and empty: no roller ball or plastic insert in the neck",
    "pump": "4. The bottle is empty: no pump, spring, tube or insert inside the glass",
}
# Cut-space rows on the master cut (Jordan 2026-09-25: remove the reducer / the plug and re-render; the plug
# becomes its own component). glassRim: first row of the glass rim; everything above is the insert's top.
NECK_EDITS = {
    "grace-55ml-18-415": {"glassRim": 24, "insert": "orifice reducer"},
    "empire-50ml-18-415": {"glassRim": 22, "insert": "orifice reducer"},
    "empire-100ml-18-415": {"glassRim": 24, "insert": "orifice reducer"},
    "diamond-60ml-18-415": {"glassRim": 24, "insert": "orifice reducer"},   # 24: the flat rim band rendered as a plastic lip (Jordan 2026-09-25)
    # Jordan 2026-09-25, from the gallery: "some of these have a reducer at the top": the disc above the glass rim on the
    # Slim 30/100, Diva 30/46 and Circle 30/50 photos (row profiles: a narrow bright top, then the rim width).
    "slim-30ml-18-415": {"glassRim": 24, "insert": "orifice reducer"},
    "slim-100ml-18-415": {"glassRim": 20, "insert": "orifice reducer"},
    "diva-30ml-18-415": {"glassRim": 27, "insert": "orifice reducer"},
    "diva-46ml-18-415": {"glassRim": 25, "insert": "orifice reducer"},
    "circle-50ml-18-415": {"glassRim": 30, "insert": "orifice reducer"},
    "circle-30ml-15-415": {"glassRim": 24, "insert": "orifice reducer"},
    "tola-decorative-3ml-14.3mm": {"glassRim": 104, "insert": "plug", "plug": {"top": 14, "stemBottom": 146, "stemHalf": 54}},
    "tola-decorative-6ml-14.3mm": {"glassRim": 104, "insert": "plug", "plug": {"top": 14, "stemBottom": 146, "stemHalf": 54}},
    # Jordan 2026-09-25, from the gallery: the roller ball photographed in the Boston round 60 neck, the atomizer pump
    # photographed inside the 12 mm cylinders (glassRim 0: nothing to trim, the prompt line empties the glass).
    "boston-round-60ml-20-400": {"glassRim": 170, "insert": "roller ball"},
    "cylinder-3.3ml-12mm": {"glassRim": 0, "insert": "pump"},
    "cylinder-4ml-12mm": {"glassRim": 0, "insert": "pump"},
}
PLUG_COMPONENT = {"componentId": "LIB-14.3mm-Plug", "neck": "14.3mm", "type": "plug-applicator", "fromBody": "tola-decorative-3ml-14.3mm"}
# Masks that stop at the ink: the 1 mL vial cut carries white paper outside the glass; the Round 128 cut carries a white
# highlight blob on the right of the disc (invisible on white to the model, so the render is a clean circle, but the
# alpha mask widened the fit by it: the plate came out wider than tall; Jordan 2026-09-25 "Round has to be redone").
MASK_FROM_INK = {"vial-1ml-Plug", "round-128ml-18-415"}
# The master glass when it is not the Clear cut: no uncapped Clear photo of the Round 78 exists in the library (every
# Clear layer stops at the shoulder under the cap), so its geometry is its own Frosted photo; Clear renders from it
# with the clear reference ("the glass stays colourless and clear").
MASTER_GLASS = {"round-78ml-18-415": "Frosted"}
# Plates whose own photo carries the colour, not the reference of their catalogue glass name (Jordan 2026-09-25: the Genie
# "Cobalt Blue" is aqua blue). The clear reference lights them.
OWN_COLOUR = {"genie-decorative-32ml-Ground|Cobalt Blue": "the photo is aqua blue; the catalogue says cobalt"}
LIT_OWN_MATERIAL = "1. Keep geometry locked to the first image\n2. Glass colour and material from the second image; lighting and finish quality from the third image\n3. Enhance the quality"
# Plates the catalogue does not list but the product is sold in (Jordan 2026-09-25: the Pear decorative is cobalt and clear;
# its only photo is the cobalt one, which already renders the Clear plate). Copied from another glass of the same body.
EXTRA_PLATES = [{"bodyId": "pear-decorative-355ml-Ground", "glass": "Cobalt Blue", "fromGlass": "Clear", "why": "sold in cobalt and clear; the photo is cobalt"}]
# Bodies whose photo carries a dark seam down the axis (a reflection of the studio, not the glass): erased before rendering.
ERASE_AXIS_SEAM = {"royal-13ml-13-415"}


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
    for x in EXTRA_PLATES:
        base = next((c for c in by_body[x["bodyId"]] if c["glass"] == x["fromGlass"]), None)
        if base and not any(c["glass"] == x["glass"] for c in by_body[x["bodyId"]]):
            by_body[x["bodyId"]].append(base | {"glass": x["glass"], "plateKey": f"{x['bodyId']}|{x['glass']}", "extra": x["why"]})
    out = {}
    for body_id, entries in sorted(by_body.items()):
        cut = [e for e in entries if e["file"]]
        wanted = MASTER_GLASS.get(body_id, "Clear")
        master = next((e for e in cut if e["glass"] == wanted), None) or sorted(cut, key=lambda e: e["glass"])[0]
        w, h = master["width"], master["height"]
        k = LONG_SIDE / max(w, h)
        W, H = ceil16(w * k + 2 * MARGIN), ceil16(h * k + 2 * MARGIN)
        while W * H < MIN_PX:
            W += 16
        while H > 3 * W:   # Sunburst refuses aspect ratios beyond 3:1; widening the canvas changes no geometry
            W += 16
        while W > 3 * H:
            H += 16
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


def canvas_y(body: dict, cut_y: float) -> int:
    """A master-cut row on the body canvas (place() with the master onto itself: scale k, foot on footY)."""
    return round(body["footY"] - (body["master"]["measured"]["foot"] - cut_y) * body["k"])


def fit_reference(ref: Image.Image, body: dict) -> Image.Image:
    """The pilot reference glass, centred on the body canvas, only as a colour/material/lighting cue."""
    W, H = body["canvas"]
    bb = ref.getchannel("A").getbbox()
    r = ref.crop(bb)
    s = min((W - 2 * MARGIN) / r.width, (H - 2 * MARGIN) / r.height)
    r = r.resize((max(1, int(r.width * s)), max(1, int(r.height * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(r, ((W - r.width) // 2, H - MARGIN - r.height))
    return canvas


def span_rows(m: np.ndarray) -> np.ndarray:
    return np.maximum.accumulate(m, axis=1) & np.maximum.accumulate(m[:, ::-1], axis=1)[:, ::-1]


def without_specks(m: np.ndarray, keep: float = 0.01) -> np.ndarray:
    lab, n = ndi.label(m)
    if n <= 1:
        return m
    sizes = ndi.sum(m, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= keep * sizes.sum()])


def silhouette(rgba: np.ndarray, from_ink: bool = False) -> np.ndarray:
    """Master mask: every row of the cut filled edge to edge (specks opened away, pieces under 1% dropped).
    from_ink: the row span stops at the ink (pixels darker than the paper), for cuts carrying white paper."""
    a = ndi.binary_opening(rgba[..., 3] > 127, iterations=1)
    s = without_specks(span_rows(a))
    if from_ink:
        ink = a & (rgba[..., :3].min(axis=2) < 236)
        s &= without_specks(span_rows(ink))
    return s


def trimmed(cut: Image.Image, edit: dict | None) -> Image.Image:
    """The master cut without the insert photographed above the glass rim."""
    if not edit:
        return cut
    a = np.asarray(cut).copy()
    a[:edit["glassRim"], :, 3] = 0
    return Image.fromarray(a, "RGBA")


def erase_axis_seam(img: Image.Image) -> Image.Image:
    """Erase a thin dark vertical seam near the body axis (a studio reflection in the photo): where a row's darkest
    pixel within 6% of the width around the centre is clearly darker than both its neighbourhoods, the pixels
    within 5 px of it are replaced by the blend of those neighbourhoods."""
    a = np.asarray(img).astype(np.float32).copy()
    alpha = a[..., 3] > 127
    lum = a[..., :3].mean(axis=2)
    for y in np.where(alpha.any(axis=1))[0]:
        xs = np.where(alpha[y])[0]
        if xs.size < 60:
            continue
        cx, w = (xs.min() + xs.max()) / 2, xs.max() - xs.min()
        lo, hi = int(cx - 0.06 * w), int(cx + 0.06 * w)
        x = lo + int(np.argmin(lum[y, lo:hi]))
        if x - 14 < xs.min() or x + 14 > xs.max():
            continue
        left, right = a[y, x - 14:x - 7, :3].mean(axis=0), a[y, x + 8:x + 15, :3].mean(axis=0)
        if lum[y, x] < min(left.mean(), right.mean()) - 18:
            t = np.linspace(0.0, 1.0, 11)[:, None]
            a[y, x - 5:x + 6, :3] = left[None, :] * (1 - t) + right[None, :] * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def cylinder(width: int, height: int, colour: np.ndarray) -> np.ndarray:
    """A plain plastic stem: the head's colour, shaded as a cylinder, a rounded end."""
    x = np.linspace(-1.0, 1.0, width)
    shade = 0.80 + 0.20 * np.sqrt(np.clip(1.0 - x * x, 0.0, 1.0))
    rgb = np.repeat((colour[None, None, :] * shade[None, :, None]).clip(0, 255), height, axis=0)
    alpha = np.full((height, width), 255, dtype=np.uint8)
    ry = max(2, min(width // 2, height // 4))
    yy, xx = np.mgrid[0:height, 0:width]
    cy = height - 1 - ry
    inside = ((xx - (width - 1) / 2) / max(1.0, (width - 1) / 2)) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    alpha[(yy > cy) & ~inside] = 0
    return np.dstack([rgb.astype(np.uint8), alpha])


def plug_layers(body_id: str, body: dict, full: Image.Image, mask: np.ndarray, edit: dict) -> None:
    """The Tola plug as its own component layers (Jordan 2026-09-25: the plug needs to be separate). Seated
    layer: the head photographed above the glass rim, drawn in CAP ON and SIDECAR. Exploded layer: the head
    with a synthesised stem, for EXPLODED. Cut in canvas space, so the layer's px/mm is the plate's own; qa
    fills the px/mm in once the plate is measured."""
    p = edit["plug"]
    head_top, rim, stem_bottom = canvas_y(body, p["top"]), canvas_y(body, edit["glassRim"]), canvas_y(body, p["stemBottom"])
    half, ax = round(p["stemHalf"] * body["k"]), round(body["axisX"])
    rgba = np.asarray(full).copy()
    head_alpha = mask.copy(); head_alpha[rim:] = False; head_alpha[:head_top] = False
    head = rgba.copy(); head[..., 3] = np.where(head_alpha, 255, 0).astype(np.uint8)
    lower = head[rim - max(4, (rim - head_top) // 4):rim][head_alpha[rim - max(4, (rim - head_top) // 4):rim]]
    colour = np.median(lower[:, :3], axis=0).astype(np.float32) if len(lower) else np.array([224, 222, 218], np.float32)
    exploded = head.copy()
    stem = cylinder(2 * half, stem_bottom - rim, colour)
    exploded[rim:stem_bottom, ax - half:ax + half] = stem
    out = COMPONENTS / PLUG_COMPONENT["neck"] / PLUG_COMPONENT["componentId"]
    out.mkdir(parents=True, exist_ok=True)
    layers = []
    for name, arr, usage, index in (("cap-seated", head, "seated", 0), ("cap-exploded", exploded, "exploded", 0)):
        im = Image.fromarray(arr, "RGBA")
        bb = im.getchannel("A").getbbox()
        crop = im.crop(bb)
        crop.save(out / f"{name}.png", optimize=True)
        layers.append({"slot": "cap", "layerName": f"Tola plug, {usage} (from {body_id} master photo)", "file": f"{PLUG_COMPONENT['componentId']}/{name}.png",
                       "width": crop.width, "height": crop.height, "sha256": cp.sha(crop), "pxPerMm": None,
                       "anchor": {"x": ax - bb[0], "y": rim - bb[1]}, "z": "front", "explodeIndex": index, "usage": usage})
    (out / "plug.json").write_text(json.dumps({"fromBody": body_id, "cutRows": {"headTop": p["top"], "glassRim": edit["glassRim"], "stemBottom": p["stemBottom"]},
                                              "canvasRows": {"headTop": head_top, "glassRim": rim, "stemBottom": stem_bottom}, "layers": layers}, indent=1))
    print(f"  {body_id}: plug layers cut ({head.shape[1]} px canvas, head rows {head_top}-{rim}, stem to {stem_bottom}) -> {out}")


def inputs():
    bodies = plan()
    jobs = []
    for body_id, body in bodies.items():
        d = BASE / "inputs" / body_id
        d.mkdir(parents=True, exist_ok=True)
        master = body["master"]
        edit = NECK_EDITS.get(body_id)
        cut = Image.open(BASE / "cuts" / master["file"]).convert("RGBA")
        if body_id in ERASE_AXIS_SEAM:
            cut = erase_axis_seam(cut)
        full = place(cut, master, master, body)
        full_mask = silhouette(np.asarray(full), body_id in MASK_FROM_INK)
        geo = place(trimmed(cut, edit), master, master, body) if edit else full
        mask = silhouette(np.asarray(geo), body_id in MASK_FROM_INK) if edit else full_mask
        on_white(geo).save(d / "geometry.png")
        Image.fromarray((mask * 255).astype(np.uint8)).save(d / "master-mask.png")
        if edit and edit.get("plug") and body_id == PLUG_COMPONENT["fromBody"]:
            plug_layers(body_id, body, full, full_mask, edit)
        for e in body["glasses"]:
            glass = e["glass"]
            background = "opaque" if glass in BONE_BAKED else "transparent"
            job = {"bodyId": body_id, "glass": glass, "size": body["canvas"], "background": background, "pass": PASS}
            if PASS == "first":
                if e is master:
                    jobs.append(job | {"role": "master", "images": [str(d / "geometry.png")]})
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
                jobs.append(job | {"role": how, "images": [str(d / "geometry.png"), str(d / f"{slug(glass)}-material.png")]})
                continue
            ref = REFERENCE.get(glass)   # the pilot body renders too (Jordan: regenerate all of them); dev keeps its Phase 3 plates, push-bodies skips it
            if f"{body_id}|{glass}" in OWN_COLOUR and e["file"]:
                on_white(place(Image.open(BASE / "cuts" / e["file"]).convert("RGBA"), e, master, body)).save(d / f"{slug(glass)}-material.png")
                on_white(fit_reference(Image.open(reference_file("Clear")).convert("RGBA"), body)).save(d / "clear-reference.png")
                job |= {"role": f"own photo colour ({OWN_COLOUR[f'{body_id}|{glass}']}), lit by the clear reference", "prompt": LIT_OWN_MATERIAL,
                        "images": [str(d / "geometry.png"), str(d / f"{slug(glass)}-material.png"), str(d / "clear-reference.png")]}
            elif ref:
                on_white(fit_reference(Image.open(reference_file(glass)).convert("RGBA"), body)).save(d / f"{ref}-reference.png")
                images, prompt = [str(d / "geometry.png"), str(d / f"{ref}-reference.png")], (LIT_CLEAR if glass == "Clear" else LIT_COLOUR)
                if glass in TEXTURED:
                    word = TEXTURED[glass]
                    if e["file"] and e is not master:   # the body's own photo of that glass carries the material; the reference lights it
                        on_white(place(Image.open(BASE / "cuts" / e["file"]).convert("RGBA"), e, master, body)).save(d / f"{slug(glass)}-material.png")
                        images, prompt = [str(d / "geometry.png"), str(d / f"{slug(glass)}-material.png"), str(d / f"{ref}-reference.png")], LIT_TEXTURED_OWN.format(word=word)
                    else:
                        prompt = LIT_TEXTURED.format(word=word[0].upper() + word[1:])
                job |= {"role": f"reference glass ({ref}), lit" + (f" + own {glass.lower()} photo" if len(images) == 3 else ""), "prompt": prompt, "images": images}
            elif e is master:
                on_white(fit_reference(Image.open(PILOT_RENDERS / "clear.png").convert("RGBA"), body)).save(d / "clear-reference.png")
                job |= {"role": "own colour, lit by the clear reference", "prompt": LIT_OWN_COLOUR, "images": [str(d / "geometry.png"), str(d / "clear-reference.png")]}
            elif e["file"]:
                on_white(place(Image.open(BASE / "cuts" / e["file"]).convert("RGBA"), e, master, body)).save(d / f"{slug(glass)}-material.png")
                job |= {"role": "own photo (no reference glass on file)", "prompt": MATERIAL, "images": [str(d / "geometry.png"), str(d / f"{slug(glass)}-material.png")]}
            else:
                print(f"  no reference glass and no photo for {glass}; skipping {body_id}")
                continue
            if edit:
                job["extra"] = EMPTY_MOUTH[edit["insert"]]
            jobs.append(job)
        (d / "body.json").write_text(json.dumps({k: v for k, v in body.items() if k not in ("master", "glasses")} | {"masterGlass": master["glass"], "neckEdit": edit}, indent=1))
    JOBS.write_text(json.dumps(jobs, indent=1))
    print(f"{len(jobs)} render jobs across {len(bodies)} bodies -> {JOBS}")


def edge(x):
    return x ^ ndi.binary_erosion(x)


def compare(g, m):
    iou = (g & m).sum() / max(1, (g | m).sum())
    dm, dg = ndi.distance_transform_edt(~edge(m)), ndi.distance_transform_edt(~edge(g))
    dev = np.concatenate([dm[edge(g)], dg[edge(m)]])
    return float(iou), float(dev.max()), float(np.percentile(dev, 95))


def span(alpha: np.ndarray, thr: int = 16) -> np.ndarray:
    """Silhouette with every row filled edge to edge. Sunburst often renders clear glass see-through (alpha ~0
    inside), so a plain alpha threshold keeps only the walls; row spans compare outlines fairly."""
    return span_rows(alpha > thr)


def mask_rgba(mask: np.ndarray) -> Image.Image:
    im = Image.new("RGBA", (mask.shape[1], mask.shape[0]), (255, 255, 255, 0))
    im.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
    return im


def plug_measurements(px_per_mm: float) -> None:
    """The Tola plug layers at the 3 ml plate's px/mm -> data/register/components/14.3mm-measurements.json."""
    out = COMPONENTS / PLUG_COMPONENT["neck"] / PLUG_COMPONENT["componentId"]
    meta = json.loads((out / "plug.json").read_text())
    layers = [l | {"pxPerMm": round(px_per_mm, 4)} for l in meta["layers"]]
    path = ROOT / "data" / "register" / "components" / f"{PLUG_COMPONENT['neck']}-measurements.json"
    path.write_text(json.dumps({"neck": PLUG_COMPONENT["neck"], "method": "cut from the Tola master photo in canvas space; head photographed, stem synthesised (build_bodies.py plug_layers)",
                                "components": [{"componentId": PLUG_COMPONENT["componentId"], "type": PLUG_COMPONENT["type"], "layers": layers,
                                                "checks": {"status": "cut", "approvable": True, "fromBody": meta["fromBody"], "cutRows": meta["cutRows"]}}]}, indent=1) + "\n")
    print(f"  plug component measured at {px_per_mm:.4f} px/mm -> {path}")


def clean_alpha(fitted: Image.Image) -> np.ndarray:
    """The plate's outline is the render's own: Sunburst draws clean edges, the photo cut's edges do not survive a
    2-4x enlargement (Jordan 2026-09-25: "we need clean edges"). Stray specks (pieces under 0.5% of the area)
    are dropped. Opaque renders arrive with their ink-span alpha already set; resampling made its edge soft."""
    alpha = np.asarray(fitted.getchannel("A")).astype(np.float32)
    keep = without_specks(alpha > 127, 0.005)
    keep = ndi.binary_dilation(keep, iterations=2)   # keep the soft edge around every kept piece
    return np.where(keep, alpha, 0).clip(0, 255).astype(np.uint8)


def qa():
    bodies = plan()
    results, rows = [], []
    for body_id, body in bodies.items():
        if ONLY and body_id not in ONLY:
            continue
        d = BASE / "inputs" / body_id
        master_mask = np.asarray(Image.open(d / "master-mask.png")) > 127
        master_span = span(np.asarray(Image.open(d / "master-mask.png")), 127)
        mm = cp.measure_body(mask_rgba(master_mask))
        inv = INV[f"{body_id}|{body['master']['glass']}"]
        H_mm = float(inv["heightBareMm"])
        D_mm = float(inv["diameterMm"]) if inv["diameterMm"] else None
        apparent = H_mm * math.cos(TILT) + D_mm * math.sin(TILT) if D_mm else H_mm
        ref_w = D_mm or (float(inv["widthMm"]) if inv["widthMm"] else None)
        stoppered = body["master"]["bodyId"].endswith("-Ground") or inv["neck"] == "Ground"
        plug_px_per_mm = None
        row = {"bodyId": body_id, "cells": []}
        for e in body["glasses"]:
            glass = e["glass"]
            rpath, carried = RENDERS / body_id / f"{slug(glass)}.png", False
            if not rpath.exists() and PASS != "first" and body_id == PILOT_BODY:
                rpath, carried = BASE / "renders" / body_id / f"{slug(glass)}.png", True
            entry = {"plateKey": f"{body_id}|{glass}", "bodyId": body_id, "glass": glass}
            if not rpath.exists():
                entry["status"] = "not rendered"
                results.append(entry); row["cells"].append((glass, None, entry)); continue
            raw = Image.open(rpath).convert("RGBA")
            opaque = bool(np.asarray(raw.getchannel("A")).min() == 255)
            if opaque:
                # Opaque render (clear glass on white): the outline is the row span of pixels darker than the paper,
                # and it becomes the render's alpha for measuring, fitting and the plate itself.
                rgb = np.asarray(raw.convert("RGB")).astype(np.int16)
                ink = rgb.min(axis=2) < 236
                sil = without_specks(span((ink * 255).astype(np.uint8), 127), 0.005)
                raw.putalpha(Image.fromarray((sil * 255).astype(np.uint8)))
            raw_iou, _, _ = compare(span(np.asarray(raw.getchannel("A"))), master_span)
            r = cp.measure_body(raw)
            # Fit to the master: rim on rim, foot on foot, barrel width and axis; the outline itself stays the render's.
            sx, sy = mm["barrelPx"] / r["barrelPx"], (mm["foot"] - mm["rim"]) / (r["foot"] - r["rim"])
            big = raw.resize((max(1, round(raw.width * sx)), max(1, round(raw.height * sy))), Image.LANCZOS)
            fitted = Image.new("RGBA", raw.size, (0, 0, 0, 0))
            fitted.paste(big, (round(mm["axisX"] - r["axisX"] * sx), round(mm["rim"] - r["rim"] * sy)))
            iou, dmax, p95 = compare(span(np.asarray(fitted.getchannel("A"))), master_span)
            plate = fitted.copy()
            plate.putalpha(Image.fromarray(clean_alpha(fitted)))
            baked = None
            if glass in BONE_BAKED:
                # Clear glass, as in the pilot: flatten the render onto white inside the outline, then level the
                # paper white and multiply onto bone -> interior exactly #F5F3EF, the render's reflections kept.
                f = np.asarray(plate).astype(np.float32)
                al = f[..., 3:4] / 255.0
                f[..., :3] = f[..., :3] * al + 255.0 * (1.0 - al)
                solid = (f[..., 3] > 250) & (f[..., :3].min(axis=2) >= 235)
                white = np.array([np.bincount(f[..., c][solid].astype(np.int64), minlength=256).argmax() if solid.any() else 255 for c in range(3)], dtype=np.float32)
                levelled = np.minimum(f[..., :3] * (255.0 / white), 255.0)
                # Clear glass has no colour: any cast the render picked up (the Eternal Flame came out green, Jordan
                # 2026-09-25) is dropped by keeping luminance only, then the bone tint.
                lum = levelled[..., 0] * 0.299 + levelled[..., 1] * 0.587 + levelled[..., 2] * 0.114
                f[..., :3] = np.round(lum[..., None] * (BONE / 255.0))
                plate = Image.fromarray(f.clip(0, 255).astype(np.uint8), "RGBA")
                baked = {"bone": "#F5F3EF", "paperWhite": white.astype(int).tolist(), "neutral": True}
            # Anchors and scale from the plate itself: what the components land on is the plate's own outline.
            pm = cp.measure_body(plate)
            plate_alpha = np.asarray(plate.getchannel("A"))
            plate_span = span(plate_alpha)
            widest_px = int(plate_span.sum(axis=1).max())
            holes = float(np.mean(plate_alpha[plate_span] < 64)) if plate_span.any() else 0.0
            by_height = (pm["foot"] - pm["rim"]) / apparent
            by_width = widest_px / ref_w if ref_w else None
            basis = "width" if stoppered and by_width else "height"
            px_per_mm = by_width if basis == "width" else by_height
            gap = round(100 * (by_height / by_width - 1), 1) if by_width else None
            width_mm = widest_px / px_per_mm
            if e is body["master"]:
                plug_px_per_mm = px_per_mm
            out = FINAL / body_id / f"{slug(glass)}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            plate.save(out, optimize=True)
            meta = json.loads((rpath.with_suffix(".png.json")).read_text()) if rpath.with_suffix(".png.json").exists() else {}
            role = meta.get("role") or ("master" if e is body["master"] else ("own photo" if e["file"] else "reference glass"))
            status = "ok" if iou >= 0.97 and holes <= 0.02 else "review"
            entry.update({
                "status": status, "file": str(out.relative_to(BASE)), "width": plate.width, "height": plate.height,
                "sha256": cp.sha(plate), "pxPerMm": round(px_per_mm, 4),
                "anchors": {"axisX": seat_axis(entry, plate_alpha, pm, px_per_mm), "seatY": pm["rim"], "shoulderY": pm["shoulderY"], "baselineY": pm["foot"],
                            "barrelAxisX": round(pm["axisX"], 1)},
                "checks": {"rawIoU": round(raw_iou, 4), "fittedIoU": round(iou, 4), "edgeP95Px": round(p95, 1), "edgeMaxPx": round(dmax, 1),
                           "interiorHolePct": round(100 * holes, 2), "edges": "render outline",
                           "widthMm": round(width_mm, 2), "referenceWidthMm": ref_w,
                           "widthErrorPct": round(100 * (width_mm - ref_w) / ref_w, 1) if ref_w else None},
                "measurements": {"heightBareMm": H_mm, "diameterMm": D_mm, "widthMm": float(inv["widthMm"]) if inv["widthMm"] else None,
                                 "apparentHeightMm": round(apparent, 2), "dimsConfidence": inv["dimsConfidence"]},
                "scale": {"basis": basis, "byHeight": round(by_height, 4), "byWidth": round(by_width, 4) if by_width else None,
                          "gapPct": gap, "flag": bool(gap is not None and abs(gap) > 5)},
                "source": {"masterGlass": body["master"]["glass"], "role": role, "cut": e["source"], "psd": e.get("psd"), "derivedFrom": e.get("sha256"),
                           "neckEdit": NECK_EDITS.get(body_id, {}).get("insert")},
                "bakedOnBone": baked,
                "render": {k: meta.get(k) for k in ("model", "quality", "costUsd", "prompt", "extra")} | {"pass": "first" if carried or PASS == "first" else PASS},
            })
            results.append(entry)
            row["cells"].append((glass, plate, entry))
        if body_id == PLUG_COMPONENT["fromBody"] and plug_px_per_mm and (COMPONENTS / PLUG_COMPONENT["neck"] / PLUG_COMPONENT["componentId"] / "plug.json").exists():
            plug_measurements(plug_px_per_mm)
        rows.append(row)
    ok = [r for r in results if r.get("status") == "ok"]
    print(f"{len(results)} plates: ok {len(ok)}, review {sum(1 for r in results if r.get('status') == 'review')}, not rendered {sum(1 for r in results if r.get('status') == 'not rendered')}")
    if ONLY:
        for r in results:
            c = r.get("checks", {})
            print(f"  {r['plateKey']}: {r.get('status')} IoU {c.get('fittedIoU')} raw {c.get('rawIoU')} holes {c.get('interiorHolePct')}% px/mm {r.get('pxPerMm')} width {c.get('widthMm')} mm ({c.get('widthErrorPct')}%) seat {r.get('anchors', {}).get('seatY')} foot {r.get('anchors', {}).get('baselineY')}")
        sheets(rows, f"review-sample{SUFFIX}")
        print("(--only: measurements not written)")
        return
    MEASURE.write_text(json.dumps(results, indent=1) + "\n")
    sheets(rows, f"review-bodies{SUFFIX}")


def sheets(rows, name: str = "review-bodies"):
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
            items = [("photo", Image.open(BASE / "cuts" / master["file"]).convert("RGBA"), None)] + list(r["cells"])
            for j, (label, im, res) in enumerate(items):
                x = 240 + j * cell
                if im is None:
                    d.rectangle([x + 8, y + 8, x + cell - 8, y + cell - 8], outline=(190, 50, 40)); d.text((x + 10, y + cell + 4), f"{label} · not rendered", fill=(190, 50, 40)); continue
                bb = im.getchannel("A").getbbox()
                t = im.crop(bb); t.thumbnail((cell - 12, cell - 12), Image.LANCZOS)
                tile = Image.new("RGBA", (cell - 6, cell - 6), (245, 243, 239, 255))
                tile.alpha_composite(rs.on_bone(t) if label == "photo" else t, ((tile.width - t.width) // 2, tile.height - t.height))
                sheet.paste(tile.convert("RGB"), (x, y))
                if res:
                    flag = res.get("status") != "ok" or (res.get("scale") or {}).get("flag")
                    tag = f"{label} · IoU {res['checks']['fittedIoU']:.2f}" + (" · scale" if (res.get("scale") or {}).get("flag") else "") + (" · review" if res.get("status") == "review" else "")
                    d.text((x + 4, y + cell + 2), tag, fill=(190, 50, 40) if flag else (120, 100, 60))
                else:
                    d.text((x + 4, y + cell + 2), "master photo", fill=(90, 90, 90))
        out = BASE / f"{name}-{n // per_sheet + 1}.png"
        sheet.save(out, optimize=True); print(out)


if __name__ == "__main__":
    {"inputs": inputs, "qa": qa}[sys.argv[1]]()
