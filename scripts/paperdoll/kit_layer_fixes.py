#!/usr/bin/env python3
"""Builder kit layer fixes, 2026-09-25 (Jordan's Build Your Bottle review).

Four defects in the published productKits layers, found by auditing every row on dev:

  overcapPatch     copper overcap layers carry the retoucher's white fill patch above the cap
                   (invisible on the original white ground, a white halo on the bone stage).
  missingMechanism the 25 ml Cylinder sprayer/pump kits (all finishes but Copper) were cut from
                   overcap-on photographs: body + tube + overcap, no mechanism. The overcap is
                   drawn as if it were the closure and nothing can sidecar. The 50 ml kits carry
                   a clean exposed layer of the SAME 18-415 part for every finish; it is registered
                   onto the 25 ml canvas by the collar width and seated on the 25 ml seat.
  misSlotted       Empire 50 / Grace 55 / Slim 100 copper kits have the dip tube in the overcap
                   slot and the overcap in the sprayer/pump slot, and no mechanism at all.
  filledRoller     every 9 ml 17-415 metal roller layer is ~90% white fill below the seat (the
                   insert was painted white in the master). Jordan's ruling: regenerate the housing
                   with Sunburst and cut it flat at the seat like the other fitments.

Nothing here writes to Convex or Blob: `build` writes layers + a manifest under output/kit-fixes/,
`publish-kit-fixes.mjs` uploads and upserts (dev by default).

  python3 scripts/paperdoll/kit_layer_fixes.py audit        # what is wrong, per kit
  python3 scripts/paperdoll/kit_layer_fixes.py roller-ref   # Sunburst input for the 17-415 roller
  python3 scripts/paperdoll/kit_layer_fixes.py roller-fit --render <png>   # fit + alpha-lock -> master
  python3 scripts/paperdoll/kit_layer_fixes.py build [--no-roller]         # fixed layers + manifest + sheets
"""
from __future__ import annotations
import argparse, hashlib, io, json, re, sys, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "kit-fixes"
# --target prod switches the dump and manifest: production rows were promoted at other times and can
# differ from dev, so every fix is computed from the deployment's own layers (dump it with
# `npx convex data productKits --limit 6000 --format jsonLines --prod`).
TARGET = "prod" if "--target" in sys.argv and sys.argv[sys.argv.index("--target") + 1] == "prod" else "dev"
KITS = OUT / f"kits-{TARGET}.jsonl"
SRC, FIXED, ROLLER = OUT / "layers-src", OUT / "layers-fixed", OUT / "roller"
CANVAS = (1000, 1100)
WHITE = 247                              # the retoucher's fill is 248..255; copper highlights sit under it
BONE = (245, 243, 239, 255)
# Every finish of the 18-415 fine mist sprayer / lotion pump is one physical part; the 50 ml Cylinder
# kits hold the exposed layer. Copper is the only 25 ml finish that came with its own.
MECHANISM_DONORS = {
    "LBCyl25LtnShnSl": "LBCyl50LtnShnSl", "LBCyl25LtnShnGl": "LBCyl50LtnShnGl", "LBCyl25LtnShnBlk": "LBCyl50LtnShnBlk",
    "LBCyl25LtnMtSl": "LBCyl50LtnMtSl", "LBCyl25LtnMtGl": "LBCyl50LtnMtGl",
    "GBcyl25SpryShnSl": "GBCyl50SpryShnSl", "GBcyl25SpryShnGl": "GBCyl50SpryShnGl", "GBcyl25SpryShnBlk": "GBCyl50SpryShnBlk",
    "GBcyl25SpryMtGl": "GBCyl50SpryMtGl",
}
# Copper pair on both canvases: the same collar measured on each gives the 50 -> 25 scale.
MECHANISM_SCALE_PAIR = {"sprayer": ("GBcyl25SpryCu", "GBCyl50SpryCu"), "pump": ("LBCyl25LtnCu", "LBCyl50LtnCu")}
# Slots rotated in the master cut: overcap slot = dip tube, mechanism slot = overcap. The exposed copper
# mechanism is borrowed from the 50 ml Cylinder copper kit, scaled by the overcap width (same part).
MISSLOTTED = {"GBEmp50SpryCu": "GBCyl50SpryCu", "GBGrce55SpryCu": "GBCyl50SpryCu",
              "GBSlm100SpryCu": "GBCyl50SpryCu", "LBSlm100LtnCu": "LBCyl50LtnCu"}
ROLLER_REFERENCE = "GBCyl9MtlRollMattSl"          # clear 9 ml 17-415: the layer on Jordan's screen
ROLLER_FAMILIES = ("cylinder-9ml-clear-17-415", "cylinder-9ml-amber-17-415", "cylinder-9ml-cobalt-blue-17-415",
                   "cylinder-9ml-frosted-17-415", "cylinder-9ml-swirl-17-415")
SUNBURST_SIZE = 1024


def load_kits() -> dict[str, dict]:
    rows = [json.loads(l) for l in KITS.open() if l.strip().startswith("{")]
    return {r["sku"]: r for r in rows}


def part_of(kit, slot):
    return next((p for p in kit["parts"] if p["slot"] == slot), None)


def fetch(part) -> np.ndarray:
    if part["image"].get("file"):                    # a layer this build already rewrote
        return np.asarray(Image.open(OUT / part["image"]["file"]).convert("RGBA")).copy()
    SRC.mkdir(parents=True, exist_ok=True)
    fn = SRC / f"{part['image']['sha256']}.webp"
    for attempt in range(4):
        if fn.exists():
            break
        try:
            fn.write_bytes(urllib.request.urlopen(part["image"]["url"], timeout=60).read())
        except Exception as e:                   # Blob resets the odd connection under a 1,400-file sweep
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    return np.asarray(Image.open(fn).convert("RGBA")).copy()


def bbox(a) -> tuple[int, int, int, int] | None:
    return Image.fromarray(a).getchannel("A").getbbox()


def row_width(a, y0, y1) -> int:
    best = 0
    for y in range(max(0, y0), min(a.shape[0], y1)):
        xs = np.where(a[y, :, 3] > 128)[0]
        if len(xs):
            best = max(best, int(xs.max() - xs.min() + 1))
    return best


def white_patch_mask(a) -> np.ndarray:
    """Opaque near-white pixels reachable from the canvas edge through transparent or near-white."""
    whiteish = (a[..., 3] == 0) | (a[..., :3].min(axis=2) >= WHITE)
    lab, _ = ndi.label(whiteish)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(edge)) & (a[..., 3] > 0)


def strip_patch(a) -> np.ndarray:
    a = a.copy()
    a[white_patch_mask(a), 3] = 0
    solid, n = ndi.label(a[..., 3] > 32)
    if n > 1:
        keep = 1 + int(np.argmax(ndi.sum(np.ones(solid.shape), solid, range(1, n + 1))))
        a[(solid != keep) & (solid > 0), 3] = 0
    return a


def roller_fill(a, seat) -> float:
    below = a[..., 3] > 200
    below[:seat] = False
    if not below.sum():
        return 0.0
    return float(((a[..., :3].min(axis=2) >= 245) & below).sum() / below.sum())


def looks_like_tube(a) -> bool:
    b = bbox(a)
    return bool(b) and (b[3] - b[1]) / max(1, b[2] - b[0]) > 4


def register(donor: np.ndarray, d_axis: float, d_seat: float, axis: float, seat: float, r: float) -> np.ndarray:
    """Scale the donor layer by r about its (axis, seat) and land that point on (axis, seat) of this
    canvas. Premultiplied resampling: straight-alpha resampling fringes every edge."""
    im = Image.fromarray(donor).convert("RGBa")
    data = (1 / r, 0, d_axis - axis / r, 0, 1 / r, d_seat - seat / r)
    return np.asarray(im.transform(CANVAS, Image.AFFINE, data, resample=Image.BICUBIC).convert("RGBA")).copy()


def sha_and_bytes(a) -> tuple[bytes, str]:
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, format="WEBP", lossless=True, quality=100, method=6)
    data = buf.getvalue()
    return data, hashlib.sha256(data).hexdigest()


def new_part(template: dict, a: np.ndarray, slot: str, z: int, tag: str) -> dict:
    FIXED.mkdir(parents=True, exist_ok=True)
    data, sha = sha_and_bytes(a)
    fn = FIXED / f"{sha}.{slot}.webp"
    fn.write_bytes(data)
    b = bbox(a)
    return {**template, "slot": slot, "zOrder": z,
            "bounds": {"left": b[0], "top": b[1], "right": b[2], "bottom": b[3]},
            "image": {"file": str(fn.relative_to(OUT)), "sha256": sha, "bytes": len(data), "width": CANVAS[0], "height": CANVAS[1], "url": None, "key": None},
            "image2x": None, "mask": None, "fix": tag}


def classify(a) -> str:
    """What a layer holds, from its silhouette: a dip tube, a closed cylinder (overcap / plain cap),
    a mechanism (actuator narrower than its collar) or other."""
    b = bbox(a)
    if not b:
        return "empty"
    w, h = b[2] - b[0], b[3] - b[1]
    if h / max(1, w) > 4:
        return "tube"
    op = a[b[1]:b[3], b[0]:b[2], 3] > 32
    fill = op.mean()
    top = row_width(a, b[1], b[1] + max(1, h // 4)); base = row_width(a, b[3] - max(1, h // 4), b[3])
    if fill > 0.85 and top >= 0.9 * base:
        return "cylinder"
    if top < 0.8 * base:
        return "mechanism"
    return "other"


def sibling_mask(kits, kit, part):
    """The same overcap on the same canvas in a darker finish: its silhouette (dilated 3 px) is the true
    outline; anything outside it in this layer is the retoucher's white patch. None when no sibling
    registers within 4% width / 8 px bottom."""
    a = fetch(part); b = bbox(a); best = None
    for other in kits.values():
        if other is kit or other["familyId"] != kit["familyId"]:
            continue
        op = part_of(other, part["slot"])
        if not op:
            continue
        oa = fetch(op); ob = bbox(oa)
        if not ob or abs((ob[2] - ob[0]) - (b[2] - b[0])) > 0.04 * (b[2] - b[0]) or abs(ob[3] - b[3]) > 8:
            continue
        white = int(((oa[..., 3] > 200) & (oa[..., :3].min(axis=2) >= WHITE)).sum())
        if best is None or white < best[0]:
            best = (white, other["sku"], oa)
    if best is None or best[0] > 400:
        return None, None
    return ndi.binary_dilation(best[2][..., 3] > 32, iterations=3), best[1]


def strip_with_sibling(a, mask):
    """Keep only what lies inside the sibling's outline. No flood strip after it: a shiny silver cap reads
    as near-white and a flood eats it to a sliver (prod Empire 50 Shiny Silver, caught on the sheet)."""
    out = a.copy()
    out[~mask, 3] = 0
    return out


# ---------------------------------------------------------------- audit
def audit(kits) -> dict:
    report = {"overcapPatch": [], "missingMechanism": [], "misSlotted": [], "filledRoller": [], "slotMismatch": []}
    for sku, k in sorted(kits.items()):
        slots = {p["slot"] for p in k["parts"]}
        classes = {p["slot"]: classify(fetch(p)) for p in k["parts"] if p["slot"] != "body"}
        for slot, cls in classes.items():
            expected = {"diptube": "tube", "overcap": "cylinder", "sprayer": "mechanism", "pump": "mechanism"}.get(slot)
            if expected and cls != expected and cls != "other":
                report["slotMismatch"].append({"sku": sku, "familyId": k["familyId"], "slot": slot, "holds": cls})
        oc = part_of(k, "overcap")
        if oc and classes["overcap"] == "tube":
            report["misSlotted"].append({"sku": sku, "familyId": k["familyId"], "overcapSlotIs": "dip tube",
                                         "mechanismSlotIs": next((c for s_, c in classes.items() if s_ in ("sprayer", "pump")), None),
                                         "known": sku in MISSLOTTED})
        elif oc:
            a = fetch(oc)
            patch = white_patch_mask(a)
            mask, sibling = sibling_mask(kits, k, oc)
            outside = int((patch & ~mask).sum()) if mask is not None else None
            if (outside if outside is not None else int(patch.sum())) >= 300:
                report["overcapPatch"].append({"sku": sku, "familyId": k["familyId"], "patchPx": int(patch.sum()),
                                               "outsideSiblingPx": outside, "sibling": sibling})
            if not slots & {"sprayer", "pump"}:
                report["missingMechanism"].append({"sku": sku, "familyId": k["familyId"], "parts": sorted(slots),
                                                   "donor": MECHANISM_DONORS.get(sku)})
        rp = part_of(k, "roller")
        if rp and k["familyId"] in ROLLER_FAMILIES:
            f = roller_fill(fetch(rp), k["anchors"]["seatY"])
            if f > 0.5:
                report["filledRoller"].append({"sku": sku, "familyId": k["familyId"], "whiteBelowSeat": round(f, 2)})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"audit-{TARGET}.json").write_text(json.dumps(report, indent=1) + "\n")
    for key, rows in report.items():
        print(f"{key}: {len(rows)}")
        for r in rows:
            print("  ", json.dumps(r))
    return report


# ---------------------------------------------------------------- roller
def roller_cut_row(a, seat) -> int:
    """The housing flange sits on the rim: cut at the bottom of the widest band around the seat. Rows that
    are mostly the painted-white insert fill (as wide as the flange, just below it) do not count, but the
    flange's own bright rim does: widths come from the raw alpha, fill rows are recognised by composition."""
    widths = {}
    for y in range(seat - 20, seat + 40):
        row = a[y]
        opaque = row[:, 3] > 128
        if not opaque.any():
            widths[y] = 0
            continue
        fill = float((row[opaque][:, :3].min(axis=1) >= WHITE).mean())
        widths[y] = 0 if fill > 0.8 else int(np.where(opaque)[0].max() - np.where(opaque)[0].min() + 1)
    top = max(widths.values())
    band = [y for y, w in widths.items() if w >= 0.97 * top]
    return max(band) + 1


def roller_ref(kits):
    """Reference crop of the photographed 17-415 metal roller housing above the seat, flat-cut, and
    the Sunburst input: that crop upscaled onto a transparent square canvas."""
    ROLLER.mkdir(parents=True, exist_ok=True)
    k = kits[ROLLER_REFERENCE]
    seat = k["anchors"]["seatY"]
    raw = fetch(part_of(k, "roller"))
    # The crop keeps every real pixel, including the flange's bright rim: a flood strip ate that rim the
    # first time and the housing came back 8% too narrow (Jordan). roller_cut_row ignores the insert fill.
    cut = roller_cut_row(raw, seat)
    a = raw.copy()
    a[cut:, :, 3] = 0
    b = bbox(a)
    crop = a[b[1]:b[3], b[0]:b[2]]
    meta = {"reference": ROLLER_REFERENCE, "seatY": seat, "cutY": cut, "cutBelowSeat": cut - seat,
            "cropBox": list(b), "axisX": k["anchors"]["axisX"]}
    Image.fromarray(crop).save(ROLLER / "reference.png")
    # Sunburst input: fill ~78% of the canvas width, centred; remember the placement to fit back.
    scale = 0.78 * SUNBURST_SIZE / crop.shape[1]
    up = Image.fromarray(crop).convert("RGBa").resize((round(crop.shape[1] * scale), round(crop.shape[0] * scale)), Image.LANCZOS).convert("RGBA")
    canvas = Image.new("RGBA", (SUNBURST_SIZE, SUNBURST_SIZE), (0, 0, 0, 0))
    x0, y0 = (SUNBURST_SIZE - up.width) // 2, (SUNBURST_SIZE - up.height) // 2
    canvas.alpha_composite(up, (x0, y0))
    canvas.save(ROLLER / "sunburst-input.png")
    meta.update({"inputScale": scale, "inputBox": [x0, y0, x0 + up.width, y0 + up.height]})
    (ROLLER / "reference.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(json.dumps(meta))


def roller_fit(render_path: Path):
    """Fit a Sunburst render back onto the reference silhouette (width + top), then lock its alpha to the
    reference outline so the geometry is the photographed housing and the bottom is the flat cut."""
    meta = json.loads((ROLLER / "reference.json").read_text())
    ref = Image.open(ROLLER / "sunburst-input.png").convert("RGBA")
    rb = ref.getchannel("A").getbbox()
    ren = Image.open(render_path).convert("RGBA")
    ra = np.asarray(ren)
    # use a firm alpha for the render's outline: Sunburst leaves soft halos on transparent canvases
    firm = Image.fromarray(((ra[..., 3] > 96) * 255).astype(np.uint8))
    nb = firm.getbbox()
    sx = (rb[2] - rb[0]) / (nb[2] - nb[0])
    sy = (rb[3] - rb[1]) / (nb[3] - nb[1])
    # Fit each axis on its own: the render's silhouette can be a few percent off the photograph's aspect,
    # and a uniform fit then leaves one edge of the outline uncovered (a dark fringe on the first master).
    fitted = ren.convert("RGBa").resize((round(ren.width * sx), round(ren.height * sy)), Image.LANCZOS).convert("RGBA")
    fb = Image.fromarray(((np.asarray(fitted)[..., 3] > 96) * 255).astype(np.uint8)).getbbox()
    out = Image.new("RGBA", ref.size, (0, 0, 0, 0))
    out.alpha_composite(fitted, (rb[0] - fb[0], rb[1] - fb[1]))
    o = np.asarray(out).copy()
    # Under the outline, any pixel the render left thin or empty takes the colour of its nearest solid
    # render pixel, so the lock never exposes the render's transparent black.
    solid = o[..., 3] > 32
    if (~solid).any():
        _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
        o[..., :3] = o[iy, ix, :3]
    # alpha lock: the reference outline is the geometry; keep the render's colour under it
    o[..., 3] = np.asarray(ref)[..., 3]
    master = Image.fromarray(o).crop(rb)
    master.save(ROLLER / "master.png")
    report = {"render": str(render_path), "scaleX": round(sx, 4), "scaleY": round(sy, 4),
              "drift": {"widthPct": round((sx - 1) * 100, 2), "heightPct": round((sy - 1) * 100, 2)}, "masterSize": master.size}
    (ROLLER / "master.json").write_text(json.dumps({**meta, **report}, indent=1) + "\n")
    print(json.dumps(report))
    # review: reference | render | master on bone
    tiles = [Image.open(ROLLER / "sunburst-input.png").convert("RGBA").crop(rb), ren.crop(nb).resize(master.size, Image.LANCZOS), master]
    sheet = Image.new("RGBA", (sum(t.width for t in tiles) + 40, max(t.height for t in tiles) + 20), BONE)
    x = 10
    for t in tiles:
        sheet.alpha_composite(t, (x, 10)); x += t.width + 10
    sheet.convert("RGB").save(ROLLER / "review-roller.png")


# ---------------------------------------------------------------- build
def scale_pair(kits, slot) -> float:
    a25, a50 = (kits[s] for s in MECHANISM_SCALE_PAIR[slot])
    w25 = row_width(fetch(part_of(a25, slot)), a25["anchors"]["seatY"] - 30, a25["anchors"]["seatY"] + 6)
    w50 = row_width(fetch(part_of(a50, slot)), a50["anchors"]["seatY"] - 30, a50["anchors"]["seatY"] + 6)
    return w25 / w50


def donor_for(kits, kit, sku, slot):
    """The Cylinder kit that carries the exposed layer of the same part: 18-415 from the 50 ml, 13-415 from
    the 5 ml (finish token = the SKU tail after Spry/Ltn)."""
    import re
    m = re.search(r"(?:Spry|Ltn)([A-Za-z]+)$", sku)
    if not m:
        return None
    fin, neck = m.group(1), kit["familyId"].rsplit("-", 2)[-2] + "-" + kit["familyId"].rsplit("-", 2)[-1]
    if fin.endswith("ClOvrCap"):
        return None
    for name in ({"18-415": [f"GBCyl50Spry{fin}", f"LBCyl50Ltn{fin}"], "13-415": [f"GBCyl5Spry{fin}", f"GBTallCyl9Spry{fin}"]}.get(neck) or []):
        d = kits.get(name)
        if d and part_of(d, slot) and classify(fetch(part_of(d, slot))) == "mechanism" and part_of(d, "overcap"):
            return name
    return None


def collar_stop(body: np.ndarray, mech: np.ndarray, seat: int):
    """Where a sprayer or pump collar must end: the collar wraps the neck, so the first row below the seat
    where the glass is wider than the collar is glass the collar cannot be in front of (the shoulder, or a
    neck ring). None when the glass never outgrows the collar (a vial as narrow as its neck)."""
    collar = row_width(mech, seat - 6, seat + 40)
    if collar <= 0:
        return None
    for y in range(seat + 4, CANVAS[1]):
        if row_width(body, y, y + 1) > collar * 1.08:
            return y
    return None


def build(kits, with_roller: bool):
    manifest = {"builtAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "kits": {}}
    fixes = json.loads((OUT / f"audit-{TARGET}.json").read_text())
    sheets = {"overcaps": [], "mechanisms": [], "rollers": []}

    def record(sku, parts, tags):
        entry = manifest["kits"].setdefault(sku, {"fixes": [], "parts": None})
        entry["fixes"] = sorted(set(entry["fixes"]) | set(tags))
        entry["parts"] = parts

    # 1. copper overcap patches
    for row in fixes["overcapPatch"]:
        k = kits[row["sku"]]; parts = manifest["kits"].get(row["sku"], {}).get("parts") or [dict(p) for p in k["parts"]]
        oc = next(p for p in parts if p["slot"] == "overcap")
        before = fetch(oc)
        mask, sibling = sibling_mask(kits, k, oc)
        if mask is not None:
            after = strip_with_sibling(before, mask)
        elif any(t in row["sku"] for t in ("Cu", "Blk", "Blu", "Rd", "Tur")):
            after = strip_patch(before)                      # copper, black, blue, red, turquoise never read near-white: the flood is safe
        else:
            print(f"overcapPatch {row['sku']}: no sibling outline and not copper, skipped"); continue
        part = new_part(oc, after, "overcap", oc["zOrder"], "overcapPatch"); part["sibling"] = sibling
        parts[parts.index(oc)] = part
        record(row["sku"], parts, ["overcapPatch"])
        sheets["overcaps"].append((row["sku"], before, after))

    # 2. mechanisms: every sprayer/pump kit whose slots hold the wrong things. Parts are re-slotted by
    #    what they are (tube -> diptube, closed cylinder -> overcap) and the exposed mechanism of the same
    #    neck + finish is borrowed from the Cylinder donor kit, scaled by the overcap width and seated here.
    scales = {}
    wanted = {r["sku"] for r in fixes["missingMechanism"] if r.get("donor") or MECHANISM_DONORS.get(r["sku"])}
    wanted |= {r["sku"] for r in fixes["misSlotted"]}
    wanted |= {r["sku"] for r in fixes["slotMismatch"] if r["slot"] in ("sprayer", "pump", "overcap", "diptube")}
    for sku in sorted(wanted):
        k = kits[sku]
        slot = "pump" if "Ltn" in sku else "sprayer" if "Spry" in sku else None
        if not slot:
            print(f"mechanism {sku}: not a sprayer/pump SKU, skipped"); continue
        if "ClOvrC" in sku:                                    # pump with its clear overcap is one photographed part
            print(f"mechanism {sku}: clear-overcap product, left as is"); continue
        parts = manifest["kits"].get(sku, {}).get("parts") or [dict(p) for p in k["parts"]]
        classes = {p["slot"]: classify(fetch(p)) for p in parts if p["slot"] != "body"}
        # re-slot by silhouette; a second part wanting a slot that is already correctly filled is dropped
        keep, dropped = [], []
        for p in sorted(parts, key=lambda p: p["slot"] != {"tube": "diptube", "cylinder": "overcap", "mechanism": slot}.get(classes.get(p["slot"]), p["slot"])):
            if p["slot"] == "body":
                keep.append(p); continue
            want = {"tube": "diptube", "cylinder": "overcap", "mechanism": slot}.get(classes[p["slot"]])
            if want is None:                                   # "other": the copper overcap reads as other
                want = "overcap" if p["slot"] in ("sprayer", "pump") else p["slot"]
            if any(q["slot"] == want for q in keep):
                dropped.append((p["slot"], want)); continue
            if want != p["slot"]:
                p = {**p, "slot": want, "fix": "reslot"}
            keep.append(p)
        parts = keep
        reslotted = any(p.get("fix") == "reslot" for p in parts)
        if any(p["slot"] == slot for p in parts):
            if not dropped and not reslotted:
                continue                                       # already had its mechanism, nothing to change
        else:
            donor = donor_for(kits, k, sku, slot)
            if not donor:
                print(f"mechanism {sku}: no donor for this neck/finish, left as re-slotted only"); continue
            d = kits[donor]
            oc = next((p for p in parts if p["slot"] == "overcap"), None)
            if oc is None:
                print(f"mechanism {sku}: no overcap to scale by, skipped"); continue
            r = row_width(fetch(oc), 0, CANVAS[1]) / row_width(fetch(part_of(d, "overcap")), 0, CANVAS[1])
            axis = k["anchors"].get("neckAxisX") or k["anchors"]["axisX"]
            a = register(fetch(part_of(d, slot)), d["anchors"].get("neckAxisX") or d["anchors"]["axisX"], d["anchors"]["seatY"], axis, k["anchors"]["seatY"], r)
            mech = new_part({**part_of(d, slot), "assembled": {"x": 0, "y": 0}, "derivation": "psd-layer"}, a, slot, 0, "missingMechanism")
            mech["donor"], mech["scale"] = donor, round(r, 4)
            parts.append(mech)
            scales[sku] = round(r, 4)
        order = {"body": 0, "diptube": 1, slot: 2, "overcap": 3}
        for p in parts:
            p["zOrder"] = order.get(p["slot"], p["zOrder"])
        record(sku, parts, ["missingMechanism"] + (["reslot"] if any(p.get("fix") == "reslot" for p in parts) else []))
        if dropped:
            manifest["kits"][sku]["dropped"] = dropped
        sheets["mechanisms"].append((sku, parts))

    # 3. collars past the shoulder (Jordan, 2026-09-25: "a lot of them seem to have fallen down"): a sprayer
    #    or pump collar covers the neck and stops at the shoulder. Layers whose collar runs on past the point
    #    where the glass widens are clipped there, so the part sits on the neck instead of sinking into the body.
    for sku, k in sorted(kits.items()):
        parts = manifest["kits"].get(sku, {}).get("parts") or [dict(p) for p in k["parts"]]
        mech = next((p for p in parts if p["slot"] in ("sprayer", "pump")), None)
        body = next((p for p in parts if p["slot"] == "body"), None)
        if not mech or not body or not re.search(r"Spry|Ltn", sku) or "AnSp" in sku:   # fine mist + lotion only, never a bulb sprayer
            continue
        a = fetch(mech)
        sh = collar_stop(fetch(body), a, k["anchors"]["seatY"])
        if sh is None or mech["bounds"]["bottom"] <= sh + 4:
            continue
        a[sh - 2:, :, 3] = 0
        clipped = new_part(mech, a, mech["slot"], mech["zOrder"], "collarPastShoulder")
        clipped["clippedAt"], clipped["was"] = sh - 2, int(mech["bounds"]["bottom"])
        parts[parts.index(mech)] = clipped
        record(sku, parts, ["collarPastShoulder"])
        if not any(s_ == sku for s_, _ in sheets["mechanisms"]):
            sheets["mechanisms"].append((sku, parts))

    # 4. regenerated 17-415 metal roller, flat at the seat
    if with_roller:
        meta = json.loads((ROLLER / "master.json").read_text())
        master = Image.open(ROLLER / "master.png").convert("RGBA")
        ref_k = kits[ROLLER_REFERENCE]
        ref_h = ref_k["anchors"]["baselineY"] - ref_k["anchors"]["seatY"]
        ref_w = meta["cropBox"][2] - meta["cropBox"][0]
        for row in fixes["filledRoller"]:
            k = kits[row["sku"]]
            parts = manifest["kits"].get(row["sku"], {}).get("parts") or [dict(p) for p in k["parts"]]
            rp = next(p for p in parts if p["slot"] == "roller")
            s = (k["anchors"]["baselineY"] - k["anchors"]["seatY"]) / ref_h      # same bottle, per-canvas scale
            w = round(ref_w * s); h = round(master.height * w / master.width)
            small = master.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
            canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            x = round(k["anchors"]["axisX"] - w / 2)
            y = round(k["anchors"]["seatY"] + meta["cutBelowSeat"] * s) - h
            canvas.alpha_composite(small, (x, y))
            a = np.asarray(canvas).copy()
            body = next(p for p in parts if p["slot"] == "body"); cap = next((p for p in parts if p["slot"] == "cap"), None)
            body["zOrder"] = 0
            if cap: cap["zOrder"] = 2
            parts[parts.index(rp)] = new_part(rp, a, "roller", 1, "filledRoller")
            record(row["sku"], parts, ["filledRoller"])
            sheets["rollers"].append((row["sku"], fetch(rp), a, parts))

    (OUT / f"manifest-{TARGET}.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"manifest: {len(manifest['kits'])} kits; mechanism scales {json.dumps(scales)}")
    review_sheets(kits, sheets)


# ---------------------------------------------------------------- review sheets
def tile(a, label, scale=0.5, pad=16):
    im = Image.fromarray(a); b = im.getchannel("A").getbbox() or (0, 0, 10, 10)
    crop = im.crop((max(0, b[0] - pad), max(0, b[1] - pad), b[2] + pad, b[3] + pad))
    bg = Image.new("RGBA", crop.size, BONE); bg.alpha_composite(crop)
    bg = bg.resize((max(1, int(bg.width * scale)), max(1, int(bg.height * scale))), Image.LANCZOS)
    ImageDraw.Draw(bg).text((3, 3), label, fill=(150, 0, 0, 255))
    return bg


def sheet(tiles, fn, cols):
    if not tiles:
        return
    w = max(t.width for t in tiles) + 8; h = max(t.height for t in tiles) + 8; r = (len(tiles) + cols - 1) // cols
    sh = Image.new("RGB", (cols * w + 8, r * h + 8), (190, 190, 190))
    for i, t in enumerate(tiles):
        sh.paste(t, (8 + (i % cols) * w, 8 + (i // cols) * h))
    sh.save(fn); print(fn, sh.size)


def composite(kits, sku, parts, sidecar=True) -> np.ndarray:
    """What the builder draws at the complete stage: parts in z order; the overcap stands beside the
    bottle when a mechanism is present (preview-layout.ts)."""
    k = kits[sku]
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    body = next(p for p in parts if p["slot"] == "body")
    has_mech = any(p["slot"] in ("sprayer", "pump", "roller") for p in parts)
    for p in sorted(parts, key=lambda p: p["zOrder"]):
        a = np.asarray(Image.open(OUT / p["image"]["file"]).convert("RGBA")) if p["image"].get("file") else fetch(p)
        im = Image.fromarray(a)
        if sidecar and has_mech and p["slot"] == "overcap":
            gap = max(18, (body["bounds"]["right"] - body["bounds"]["left"]) * .08)
            dx = round(body["bounds"]["right"] + gap - p["bounds"]["left"]); dy = round(k["anchors"]["baselineY"] - p["bounds"]["bottom"])
            moved = Image.new("RGBA", CANVAS, (0, 0, 0, 0)); moved.paste(im, (dx, dy)); im = moved
        canvas.alpha_composite(im)
    return np.asarray(canvas)


def review_sheets(kits, sheets):
    tiles = []
    for sku, before, after in sheets["overcaps"]:
        tiles += [tile(before, f"{sku} before", 0.35), tile(after, "after", 0.35)]
    sheet(tiles, OUT / "review-overcaps.png", 8)
    tiles = []
    for sku, parts in sheets["mechanisms"]:
        tiles += [tile(composite(kits, sku, kits[sku]["parts"]), f"{sku} before", 0.3), tile(composite(kits, sku, parts), "after", 0.3)]
    sheet(tiles, OUT / "review-mechanisms.png", 6)
    tiles = []
    for sku, before, after, parts in sheets["rollers"]:
        tiles += [tile(before, f"{sku} before", 0.6), tile(after, "after", 0.6), tile(composite(kits, sku, parts, sidecar=False), "on the bottle", 0.3)]
    sheet(tiles, OUT / "review-rollers.png", 9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["audit", "roller-ref", "roller-fit", "build"])
    ap.add_argument("--render"); ap.add_argument("--no-roller", action="store_true"); ap.add_argument("--target", default="dev", choices=["dev", "prod"])
    args = ap.parse_args()
    kits = load_kits()
    if args.cmd == "audit": audit(kits)
    elif args.cmd == "roller-ref": roller_ref(kits)
    elif args.cmd == "roller-fit": roller_fit(Path(args.render))
    elif args.cmd == "build": build(kits, not args.no_roller)


if __name__ == "__main__":
    main()
