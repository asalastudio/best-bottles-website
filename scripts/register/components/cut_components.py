#!/usr/bin/env python3
"""
Component register: cut and measure one neck's component layers from the master PSDs.

  python3 scripts/register/components/cut_components.py --neck 18-415 [--only CMP-A,CMP-B] [--limit N]

The Phase 3 method (scripts/register/phase3/cut_pilot.py) generalised to any neck. For every current
component of the neck that a resolved assembly uses:

  1. A reference bottle photo is chosen: a master PSD of a SKU sold with that component, Clear glass first.
     Every 18-415 SKU master carries the bare body as its own layer; sprayer and pump SKUs come as two files,
     one with the pump exposed and the overcap parked beside the bottle, one with the overcap on.
  2. The reference photo's scale is tied to the body's register plate: the plate was fitted to this same
     photo geometry, so px/mm(photo) = px/mm(plate) x seat-to-foot(photo) / seat-to-foot(plate). Every
     component therefore lands on the plate at the plate's own scale, whatever the recorded millimetres say.
  3. The library component PSD (20. Caps) is registered against the closure as it sits on the photo
     (silhouette fit, IoU as the self-check), giving the library layer's px/mm and its rim anchor.
  4. Parts the library does not hold as pixels (the overcap that hides a pump, the dropper) are cut from the
     reference photo at the photo's scale, anchored at the rim.

Writes native-resolution cut-outs to output/register-components/<neck>/ (gitignored), every number to
data/register/components/<neck>-measurements.json (committed), and a review sheet beside the cut-outs.
Reads the master library read-only.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import itertools
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[3]
REGISTER = ROOT / "data" / "register"
INVENTORY = json.loads((ROOT / "data" / "paper-doll" / "component-library-inventory.json").read_text())
PSD_ROOT = Path(INVENTORY["root"])
BOTTLE_FOLDERS = {"18-415": PSD_ROOT / "2.  18-415 Bottles "}
ALPHA = 128
MIN_IOU_APPROVABLE = 0.90
SLOT_BY_TYPE = {"roll-on-cap": "cap", "cap": "cap", "faux-leather-cap": "cap", "fine-mist-sprayer": "sprayer", "lotion-pump": "pump",
                "vintage-bulb-sprayer": "sprayer", "tassel-bulb-sprayer": "sprayer", "dropper": "fitment", "reducer": "reducer"}
ONE_IMAGE_TYPES = {"cap", "faux-leather-cap", "roll-on-cap"}      # a cap is one part however many layers drew it
# Cut from the bottle photo, not the library: the dropper library files hold no pixel layers, and the
# vintage bulb sprayer files show the bulb on a long hose and dip tube that the product photos do not
# (registering them scored IoU .25-.42). The part below the collar (dip tube, pipette) goes behind the glass.
PHOTO_CUT_TYPES = {"dropper", "vintage-bulb-sprayer", "tassel-bulb-sprayer"}
BELOW_SLOT = {"dropper": "pipette", "vintage-bulb-sprayer": "diptube", "tassel-bulb-sprayer": "diptube"}
OVERCAP_TYPES = {"fine-mist-sprayer", "lotion-pump"}


def sha(img: Image.Image) -> str:
    return hashlib.sha256(img.tobytes()).hexdigest()


def alpha(img: Image.Image) -> np.ndarray:
    return np.asarray(img.getchannel("A"))


def pixel_layers(psd: PSDImage) -> list:
    """Visible pixel layers that are not a full-canvas ground, flattened out of groups."""
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
                continue
            if r - l <= 0 or b - t <= 0:
                continue
            out.append(layer)
    walk(psd)
    return out


def canvas_of(psd: PSDImage, layers: list) -> Image.Image:
    order = {id(l): i for i, l in enumerate(psd.descendants())}
    canvas = Image.new("RGBA", psd.size, (0, 0, 0, 0))
    for layer in sorted(layers, key=lambda l: order[id(l)]):
        pix = layer.composite()
        if pix is None:
            continue
        sheet = Image.new("RGBA", psd.size, (0, 0, 0, 0))
        sheet.paste(pix.convert("RGBA"), (layer.bbox[0], layer.bbox[1]))
        canvas = Image.alpha_composite(canvas, sheet)
    return canvas


def box(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def opaque_area(psd: PSDImage, layer) -> int:
    pix = layer.composite()
    if pix is None:
        return 0
    a = np.asarray(pix.convert("RGBA").getchannel("A"))
    return int((a > ALPHA).sum())


def measure_body(img: Image.Image) -> dict:
    """Rim = first solid row, foot = last, axis = median barrel centre, barrel = median width of the middle band."""
    m = alpha(img) > ALPHA
    left, top, right, bottom = box(m)
    rows = range(top + int(0.4 * (bottom - top)), top + int(0.85 * (bottom - top)))
    widths, centres = [], []
    for y in rows:
        xs = np.where(m[y])[0]
        if xs.size == 0:
            continue
        widths.append(xs.max() - xs.min() + 1)
        centres.append((xs.max() + xs.min() + 1) / 2)
    return {"rim": top, "foot": bottom, "axisX": float(np.median(centres)) if centres else (left + right) / 2,
            "barrelPx": float(np.median(widths)) if widths else float(right - left)}


def crop_save(img: Image.Image, path: Path, pad: int = 6) -> tuple[Image.Image, int, int]:
    l, t, r, b = box(alpha(img) > 0)
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(img.width, r + pad), min(img.height, b + pad)
    cut = img.crop((l, t, r, b))
    path.parent.mkdir(parents=True, exist_ok=True)
    cut.save(path, optimize=True)
    return cut, l, t


def split_below_collar(img: Image.Image, rim: int, axis: float) -> tuple[Image.Image, Image.Image | None, int | None, int]:
    """A photographed top split at its collar: everything down to the collar's bottom edge stays in front of
    the glass; the narrow part on the axis below it (dip tube, pipette) goes behind. The collar width is the
    run of solid pixels through the axis just under the rim; the split is the first row below where that run
    is under half the collar width. Pixels beside the bottle (a bulb on its hose) never move behind."""
    a = np.asarray(img)
    m = a[..., 3] > ALPHA
    ax = int(round(axis))
    h = m.shape[0]

    def run_at(y: int) -> tuple[int, int] | None:
        if y < 0 or y >= h or not m[y, ax]:
            return None
        l = ax
        while l > 0 and m[y, l - 1]:
            l -= 1
        r = ax
        while r < m.shape[1] - 1 and m[y, r + 1]:
            r += 1
        return l, r

    collar = [run_at(y) for y in range(max(0, rim - 6), min(h, rim + 40))]
    collar = [c for c in collar if c]
    if not collar:
        return img, None, None, 0
    collar_w = max(r - l + 1 for l, r in collar)
    split = None
    for y in range(rim + 10, h):
        run = run_at(y)
        if run is None or (run[1] - run[0] + 1) < 0.5 * collar_w:
            split = y
            break
    if split is None or split >= h - 4:
        return img, None, None, collar_w
    half = int(0.6 * collar_w)
    any_alpha = a[..., 3] > 0
    below = np.zeros_like(m)
    below[split:, max(0, ax - half):ax + half + 1] = any_alpha[split:, max(0, ax - half):ax + half + 1]
    if below.sum() < 50:
        return img, None, None, collar_w
    above_a = a.copy(); above_a[below, 3] = 0
    below_a = a.copy(); below_a[~below, 3] = 0
    return Image.fromarray(above_a), Image.fromarray(below_a), split, collar_w


def iou_after_fit(lib: np.ndarray, ref: np.ndarray) -> tuple[float, float, tuple[float, float]]:
    """Scale lib's silhouette to ref's bbox width, align bbox bottoms and centres; (IoU, scale, lib->ref offset)."""
    ll, lt, lr, lb = box(lib)
    rl, rt, rr, rb = box(ref)
    s = (rr - rl) / (lr - ll)
    h = max(1, int(round((lb - lt) * s)))
    w = rr - rl
    scaled = np.asarray(Image.fromarray((lib[lt:lb, ll:lr] * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)) > 127
    canvas = np.zeros_like(ref)
    y0 = rb - h
    ys, ye = max(0, y0), min(ref.shape[0], y0 + h)
    if ye > ys:
        canvas[ys:ye, rl:rl + w] = scaled[ys - y0:ye - y0, :]
    inter = np.logical_and(canvas, ref).sum()
    union = np.logical_or(canvas, ref).sum()
    return float(inter / max(1, union)), float(s), (float(rl - ll * s), float(y0 - lt * s))


def sku_of(path: Path) -> str:
    return re.sub(r"^\d+\.\s*", "", path.stem).strip()


def index_masters(neck: str) -> dict[str, list[Path]]:
    """Every per-SKU master under the neck's bottle tree, by website SKU (side views and cap sheets excluded)."""
    files: dict[str, list[Path]] = {}
    for p in sorted(BOTTLE_FOLDERS[neck].rglob("*.psd")):
        if any(word in str(p).lower() for word in ("sideview", "18415 caps", "thumbnail")):
            continue
        files.setdefault(sku_of(p), []).append(p)
    return files


class Reference:
    """One master PSD opened once: its body and the other layers, classified."""

    def __init__(self, path: Path):
        self.path = path
        self.psd = PSDImage.open(path)
        layers = pixel_layers(self.psd)
        if not layers:
            raise ValueError("no pixel layers")
        areas = {id(l): opaque_area(self.psd, l) for l in layers}
        self.body = max(layers, key=lambda l: areas[id(l)])
        self.body_img = canvas_of(self.psd, [self.body])
        self.bm = measure_body(self.body_img)
        w = self.psd.width
        bl, bt, br, bb = self.body.bbox
        others = [l for l in layers if l is not self.body]
        # a layer standing clear of the body's horizontal span is the overcap parked beside the bottle
        self.beside = [l for l in others if l.bbox[0] >= br - 0.05 * w or l.bbox[2] <= bl + 0.05 * w]
        self.closure = [l for l in others if l not in self.beside and areas[id(l)] > 50]

    @property
    def exposed(self) -> bool:
        return bool(self.beside)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--neck", required=True)
    ap.add_argument("--only", default="")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    neck = args.neck
    out_dir = ROOT / "output" / "register-components" / neck
    out_dir.mkdir(parents=True, exist_ok=True)
    measure_path = REGISTER / "components" / f"{neck}-measurements.json"

    comps = {r["componentId"]: r for r in csv.DictReader((REGISTER / "components.csv").open()) if r["neck"] == neck and r["status"] == "current"}
    asm = [r for r in csv.DictReader((REGISTER / "assemblies.csv").open()) if r["neck"] == neck and r["buildStatus"] == "resolved"]
    plates = {}
    for p in json.loads((REGISTER / "bodies" / "bodies-measurements.json").read_text()):
        plates[(p["bodyId"], p["glass"])] = p
    masters = index_masters(neck)
    print(f"{len(comps)} current components, {len(asm)} resolved assemblies, {len(masters)} master SKUs on disk, {len(plates)} plates")

    users: dict[str, list[dict]] = {}
    for a in asm:
        for part in filter(None, a["buildParts"].split("; ")):
            users.setdefault(part.split(":")[1], []).append(a)
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    todo = [cid for cid in sorted(comps) if cid in users and (not only or cid in only)]
    if args.limit:
        todo = todo[: args.limit]

    result = {"neck": neck, "psdRoot": str(PSD_ROOT), "method": "library PSD registered on the closure of a sold SKU's master photo; photo scale tied to the body's register plate by seat-to-foot", "components": []}
    review: list[tuple[str, Image.Image, Image.Image | None, str]] = []
    ref_cache: dict[Path, Reference] = {}

    def open_ref(path: Path) -> Reference | None:
        if path not in ref_cache:
            try:
                ref_cache[path] = Reference(path)
            except Exception as error:  # noqa: BLE001 - a bad master is reported, not fatal
                print(f"   skip {path.name}: {error}")
                return None
        return ref_cache[path]

    for cid in todo:
        c = comps[cid]
        ctype = c["type"]
        primary = SLOT_BY_TYPE.get(ctype, "fitment")
        entry = {"componentId": cid, "websiteSku": c["websiteSku"], "type": ctype, "psd": f"{c['psdLibrary']}/{c['psdPath']}" if c["psdPath"] else None,
                 "reference": None, "layers": [], "checks": {}}
        # candidate references: Clear glass first, bodies with a plate only, masters on disk only
        cands = sorted({(a["bodyId"], a["glass"], a["websiteSku"]) for a in users[cid]}, key=lambda t: (t[1] != "Clear", t[0]))
        chosen = None
        for body_id, glass, sku in cands:
            plate = plates.get((body_id, glass))
            if not plate or sku not in masters:
                continue
            refs = [r for r in (open_ref(p) for p in masters[sku]) if r]
            if not refs:
                continue
            exposed = next((r for r in refs if r.exposed), None)
            on = next((r for r in refs if not r.exposed), None)
            if ctype in OVERCAP_TYPES and not exposed:
                continue
            chosen = (body_id, glass, sku, plate, exposed or refs[0], on)
            break
        if not chosen:
            entry["checks"]["status"] = "no usable master photo for a SKU sold with this part"
            result["components"].append(entry)
            print(f"{cid:26} {ctype:20} NO REFERENCE ({len(cands)} candidate SKUs)")
            continue
        body_id, glass, sku, plate, ref, on = chosen
        plate_span = plate["anchors"]["baselineY"] - plate["anchors"]["seatY"]
        ref_px_per_mm = plate["pxPerMm"] * (ref.bm["foot"] - ref.bm["rim"]) / plate_span
        entry["reference"] = {"psd": str(ref.path.relative_to(PSD_ROOT)), "sku": sku, "bodyId": body_id, "glass": glass, "plateKey": plate["plateKey"],
                              "bottlePxPerMm": round(ref_px_per_mm, 4), "rimY": ref.bm["rim"], "axisX": round(ref.bm["axisX"], 1),
                              "seatToFootPx": ref.bm["foot"] - ref.bm["rim"], "plateSeatToFootPx": plate_span, "bodyLayer": ref.body.name}

        if ctype in PHOTO_CUT_TYPES or not c["psdPath"]:
            # the part as it sits on the photo, at the photo's scale
            if not ref.closure:
                entry["checks"]["status"] = "reference photo has no closure layer"
                result["components"].append(entry)
                print(f"{cid:26} {ctype:20} ref {sku:24} no closure layer to cut")
                continue
            img = canvas_of(ref.psd, ref.closure)
            above, below, split_row, collar_w = split_below_collar(img, ref.bm["rim"], ref.bm["axisX"])
            layer_names = ", ".join(l.name for l in ref.closure)
            name = f"{cid}--{primary}.png"
            cut, ox, oy = crop_save(above, out_dir / name)
            entry["layers"].append({"slot": primary, "layerName": layer_names + " (bottle photo)", "file": name, "width": cut.width, "height": cut.height,
                                    "sha256": sha(cut), "pxPerMm": round(ref_px_per_mm, 4), "anchor": {"x": round(ref.bm["axisX"] - ox, 1), "y": round(ref.bm["rim"] - oy, 1)},
                                    "z": "front", "explodeIndex": 1})
            if below is not None:
                bslot = BELOW_SLOT.get(ctype, "diptube")
                bname = f"{cid}--{bslot}.png"
                bcut, bx, by = crop_save(below, out_dir / bname)
                entry["layers"].append({"slot": bslot, "layerName": layer_names + f" (bottle photo, below the collar from row {split_row})", "file": bname, "width": bcut.width, "height": bcut.height,
                                        "sha256": sha(bcut), "pxPerMm": round(ref_px_per_mm, 4), "anchor": {"x": round(ref.bm["axisX"] - bx, 1), "y": round(ref.bm["rim"] - by, 1)},
                                        "z": "behind-body", "explodeIndex": 0})
            entry["checks"] = {"status": "cut from the bottle photo", "approvable": True, "collarWidthPx": collar_w, "splitRow": split_row}
            review.append((f"{cid} · photo cut · {sku}", cut, None, ctype))
            result["components"].append(entry)
            print(f"{cid:26} {ctype:20} ref {sku:24} cut from photo {cut.width}x{cut.height}")
            continue

        lib_psd = PSDImage.open(PSD_ROOT / c["psdLibrary"] / c["psdPath"])
        lib_layers = pixel_layers(lib_psd)
        if not lib_layers:
            entry["checks"]["status"] = "library PSD has no pixel layers"
            result["components"].append(entry)
            print(f"{cid:26} {ctype:20} library PSD has no pixel layers")
            continue
        lib_full = canvas_of(lib_psd, lib_layers)
        lib_mask = alpha(lib_full) > ALPHA
        best = None
        closure = ref.closure[:5]
        for k in range(1, len(closure) + 1):
            for subset in itertools.combinations(closure, k):
                ref_mask = alpha(canvas_of(ref.psd, list(subset))) > ALPHA
                if ref_mask.sum() < 50:
                    continue
                score, s, off = iou_after_fit(lib_mask, ref_mask)
                if best is None or score > best[0]:
                    best = (score, s, off, subset)
        if best is None:
            entry["checks"]["status"] = "no closure layer to register against"
            result["components"].append(entry)
            continue
        score, s, (tx, ty), subset = best
        anchor_lib = ((ref.bm["axisX"] - tx) / s, (ref.bm["rim"] - ty) / s)
        lib_px_per_mm = ref_px_per_mm / s
        entry["reference"]["matchedLayers"] = [l.name for l in subset]
        entry["checks"] = {"registrationIoU": round(score, 4), "libraryScale": round(1 / s, 4), "approvable": score >= MIN_IOU_APPROVABLE}

        if ctype in ONE_IMAGE_TYPES:
            groups = [(primary, lib_layers)]
        else:
            ordered = sorted(lib_layers, key=lambda l: l.bbox[1])
            narrow = [l for l in ordered if (l.bbox[3] - l.bbox[1]) > 3 * (l.bbox[2] - l.bbox[0]) and (l.bbox[2] - l.bbox[0]) < 0.25 * lib_psd.width]
            wide = [l for l in ordered if l not in narrow]
            lowest = max(wide, key=lambda l: l.bbox[3]) if len(wide) > 1 else None
            groups = []
            for l in wide:
                slot = "collar" if lowest is not None and l is lowest and ctype in OVERCAP_TYPES else primary
                groups.append((slot, [l]))
            for l in narrow:  # a dip tube: behind the glass, travels with its mechanism
                groups.append(("diptube", [l]))
        n = len(groups)
        for i, (slot, layers) in enumerate(groups):
            img = canvas_of(lib_psd, layers)
            name = f"{cid}--{i}-{slot}.png"
            cut, ox, oy = crop_save(img, out_dir / name)
            entry["layers"].append({"slot": slot, "layerName": ", ".join(l.name for l in layers), "file": name, "width": cut.width, "height": cut.height, "sha256": sha(cut),
                                    "pxPerMm": round(lib_px_per_mm, 4), "anchor": {"x": round(anchor_lib[0] - ox, 1), "y": round(anchor_lib[1] - oy, 1)},
                                    "z": "behind-body" if slot == "diptube" else "front", "explodeIndex": 0 if slot == "diptube" else n - i})
        if ctype in OVERCAP_TYPES and on is not None and on.closure:
            # The overcap is the closure that sits on the neck: wide, its bottom near the rim. The tallest layer of the
            # overcap-on file is the dip tube (it drew as a white stripe over the glass in CAP ON, 2026-09-25).
            body_h = on.bm["foot"] - on.bm["rim"]
            caps = [l for l in on.closure if (l.bbox[3] - l.bbox[1]) <= 3 * (l.bbox[2] - l.bbox[0]) and l.bbox[3] <= on.bm["rim"] + 0.25 * body_h]
            over = max(caps or [l for l in on.closure if (l.bbox[3] - l.bbox[1]) <= 3 * (l.bbox[2] - l.bbox[0])] or on.closure, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]))
            on_px_per_mm = plate["pxPerMm"] * (on.bm["foot"] - on.bm["rim"]) / plate_span
            img = canvas_of(on.psd, [over])
            name = f"{cid}--overcap.png"
            cut, ox, oy = crop_save(img, out_dir / name)
            entry["layers"].append({"slot": "overcap", "layerName": f"{over.name} ({on.path.name})", "file": name, "width": cut.width, "height": cut.height, "sha256": sha(cut),
                                    "pxPerMm": round(on_px_per_mm, 4), "anchor": {"x": round(on.bm["axisX"] - ox, 1), "y": round(on.bm["rim"] - oy, 1)},
                                    "z": "front", "explodeIndex": n + 1})
            entry["reference"]["overcapPsd"] = str(on.path.relative_to(PSD_ROOT))
        # review: the registered library outline drawn over the photo closure
        ref_img = canvas_of(ref.psd, list(subset))
        rl, rt, rr, rb = box(alpha(ref_img) > 0)
        pad = 40
        crop = ref_img.crop((max(0, rl - pad), max(0, rt - pad), min(ref_img.width, rr + pad), min(ref_img.height, rb + pad)))
        scaled = lib_full.resize((max(1, int(lib_full.width * s)), max(1, int(lib_full.height * s))), Image.BILINEAR)
        overlay = Image.new("RGBA", ref_img.size, (0, 0, 0, 0))
        overlay.paste(scaled, (int(round(tx)), int(round(ty))))
        ov_crop = overlay.crop(crop.getbbox() and (max(0, rl - pad), max(0, rt - pad), min(ref_img.width, rr + pad), min(ref_img.height, rb + pad)))
        review.append((f"{cid} · IoU {score:.3f} · {sku}", crop, ov_crop, ctype))
        print(f"{cid:26} {ctype:20} ref {sku:24} IoU {score:.3f} lib {lib_px_per_mm:.2f} px/mm layers {[l['slot'] for l in entry['layers']]}")
        result["components"].append(entry)

    measure_path.parent.mkdir(parents=True, exist_ok=True)
    if only and measure_path.exists():  # a partial run replaces only the components it processed
        previous = json.loads(measure_path.read_text())
        done = {c["componentId"] for c in result["components"]}
        result["components"] = sorted([c for c in previous.get("components", []) if c["componentId"] not in done] + result["components"], key=lambda c: c["componentId"])
    measure_path.write_text(json.dumps(result, indent=1) + "\n")

    # review sheet: photo closure | registered library outline over it | (or the photo cut alone)
    cell, cols = 320, 4
    rows = (len(review) + cols - 1) // cols
    sheet = Image.new("RGB", (cell * 2 * cols, (cell + 30) * max(1, rows)), (245, 243, 239))
    draw = ImageDraw.Draw(sheet)
    for i, (label, photo, overlay, ctype) in enumerate(review):
        x0, y0 = (i % cols) * cell * 2, (i // cols) * (cell + 30)
        a = photo.copy(); a.thumbnail((cell - 10, cell - 10))
        sheet.paste(a, (x0 + 5, y0 + 5), a)
        if overlay is not None:
            b = overlay.copy(); b.thumbnail((cell - 10, cell - 10))
            tinted = Image.new("RGBA", b.size, (158, 129, 74, 0)); tinted.putalpha(Image.eval(b.getchannel("A"), lambda v: v // 2))
            base = a.copy(); base.alpha_composite(tinted)
            sheet.paste(base, (x0 + cell + 5, y0 + 5), base)
        draw.text((x0 + 5, y0 + cell + 8), label[:70], fill=(28, 28, 30))
    sheet.save(out_dir / "review-components.png")
    ok = [c for c in result["components"] if c["checks"].get("approvable")]
    print(f"wrote {measure_path.relative_to(ROOT)}: {len(result['components'])} components, {len(ok)} approvable; review {out_dir.relative_to(ROOT) / 'review-components.png'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
