#!/usr/bin/env python3
"""Real dip tubes and pipettes for the capped Diva, Empire, Diamond and Grace 18-415 kits (24 Nov 2026 parts audit).

Every tube here is a photographed layer from the master PSD library, never a generated image:
  fine mist   Grace 55 ml   "11. GBGrce55SpryMtGl.psd"  Layer 16 (connector and tube)
  lotion      Grace 55 ml   "12. LBGrce55LtnMtGl.psd"   Layer 14 (pump chamber and tube)
  bulb/tassel Grace 55 ml   "39. GBGrce55AnSpBlk.psd"   Layer 4 copy (plain tube)
  pipette     Elegant 60 ml "51. GBElg60DrpSl.psd"      Layer 25 (glass pipette)

Each source keeps its PSD resolution. It is straightened (each row re-centred on the axis), lengthened by
repeating its own straight shaft rows (a pipette by dropping shaft rows), and given a 2 mm bend at the foot.
Fitting is by measurement on the resolved kits:
  - top: the stem exit, the lowest opaque pixel of the sprayer, pump or dropper collar on the neck axis;
  - bottom: the glass's inner floor (FLOORS, canvas y on the shared 1000 x 1100 stage), less a clearance;
  - scale: the kit's px/mm over the source PSD's px/mm (its bottle layer width over the bottle's diameter).
Glass treatment:
  - clear: the tube as photographed;
  - frosted: the same tube at 30 % (the Cylinder frosted recipe), no blur (Jordan rejected blurred silhouettes);
  - fluted clear (Diva, Diamond): the tube is cut into slivers where the plate's flute ridges and facet edges
    cross it, measured from the plate's own luminance gradient on the tube's path.
EXPLODED draws the same tube unfaded and unbroken, lifted out with its sprayer or pump.

  npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/parts-placement/dump-kits.ts /tmp/kits.json
  python3 scripts/paperdoll/seated-dip-tubes.py /tmp/kits.json <work-dir>
  node scripts/paperdoll/publish-seated-dip-tubes.mjs <work-dir> [--apply]
Reads PSDs and Blob images (read-only); writes only into <work-dir>.
"""
import hashlib, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image
from psd_tools import PSDImage

PSD_ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/2.  18-415 Bottles "
GRACE = PSD_ROOT + "/29. Grace 55 ml/1. Grace 55ml PSD/"
SOURCES = {
    # body: the PSD's bottle layer and that bottle's diameter in mm (register bounds / px per mm), for the PSD's scale.
    "spray": dict(psd=GRACE + "11. GBGrce55SpryMtGl.psd", tube="Layer 16", body="Layer 17", holder="Layer 13", bodyMm=52.0),
    "lotion": dict(psd=GRACE + "12. LBGrce55LtnMtGl.psd", tube="Layer 14", body="Layer 16", holder="Layer 13", bodyMm=52.0),
    "bulb": dict(psd=GRACE + "39. GBGrce55AnSpBlk.psd", tube="Layer 4 copy", body="Layer 39", holder=None, bodyMm=52.0),
    # 13-415 fine-mist sprayers (register kits): the small 13-415 tube, connector and shaft, from the capped Elegant 15 ml PSD.
    "spray13": dict(psd=PSD_ROOT.replace("2.  18-415 Bottles ", "5.  13-415 Bottles") + "/8. Elegant 15ml Clear/2. Elegant 15ml (Capped) PSD/6. GBElg15SpryGlSh.psd",
                    tube="Layer 21", body="Layer 20", holder="Layer 22", bodyMm=36.0),
    "pipette": dict(psd=PSD_ROOT + "/17. Elegant 60ml/1. Elegant 60ml PSD/51. GBElg60DrpSl.psd", tube="Layer 25", body="Layer 23", holder="Layer 21", bodyMm=59.75),
}
# Inner floor of each glass on the shared stage (canvas y; the foot stands at 1061). Read off the plates:
# Diva's liquid stops where the flutes meet the solid pedestal rings, Empire's at its thick square base,
# Diamond's at the lower facet apex, Grace's at its inner bowl.
FLOORS = {
    "diva-30ml-18-415": 902, "diva-46ml-18-415": 905, "diva-100ml-18-415": 902,
    "empire-50ml-18-415": 884, "empire-100ml-18-415": 877,
    "diamond-60ml-18-415": 985, "grace-55ml-18-415": 975,
    # Sleek: the inner-floor landmarks already used for its lotion tubes (approved-component-kits.ts sleekLandmarks,
    # 1830 and 1810 on the 2192 px plates).
    "sleek-50ml-18-415": 953, "sleek-100ml-18-415": 945,
}
# Sleek's lotion pumps keep their measured Cylinder lotion tube; only its sprayers' stretched tube is replaced.
# --register: the bodies that have no approved kit and draw Convex register kits (src/lib/register/dip-tubes.ts), measured on
# their register plates (canvas y). Circle/Round: where the bowl meets the thick foot; Slim and the rectangles: the inner U.
REGISTER_FLOORS = {
    "circle-50ml-18-415": 993, "circle-100ml-18-415": 977, "round-78ml-18-415": 1005, "round-128ml-18-415": 997,
    "slim-30ml-18-415": 946, "slim-50ml-18-415": 976, "slim-100ml-18-415": 960,
    "elegant-15ml-13-415": 1018, "circle-15ml-13-415": 962, "flair-15ml-13-415": 1007, "footed-rectangle-10ml-13-415": 1014,
    "tall-rectangle-10ml-13-415": 998, "royal-13ml-13-415": 980, "square-15ml-13-415": 1017, "bell-10ml-13-415": 1003,
}
KINDS = {"sleek-50ml-18-415": {"spray", "bulb"}, "sleek-100ml-18-415": {"spray", "bulb"}}
FLUTED = {"diva-30ml-18-415", "diva-46ml-18-415", "diva-100ml-18-415", "diamond-60ml-18-415"}
TIP_CLEARANCE_MM = 1.0      # a dip tube stands on the floor; leave the cut end 1 mm clear of the inner glass
PIPETTE_CLEARANCE_MM = 8.0  # a dropper's glass tip hangs clear of the floor
FOOT_BEND_MM = 2.0          # the cut end drifts 2 mm off the axis, straight where it leaves the fitting
OPACITY = {"Clear": 0.9, "Frosted": 0.3}

CACHE = os.environ.get("CACHE", "/tmp/seated-dip-tubes-cache")


def load(url, repo="."):
    if url.startswith("/"):
        return Image.open(os.path.join(repo, "public", url.lstrip("/"))).convert("RGBA")
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=60) as response:
            open(path, "wb").write(response.read())
    return Image.open(path).convert("RGBA")


def psd_layer(psd, name):
    return next(layer for layer in psd.descendants() if layer.name == name and not layer.is_group())


def extract(kind):
    """The source tube, straightened on its axis, its continuous top segment only, plus the PSD's px/mm."""
    src = SOURCES[kind]
    psd = PSDImage.open(src["psd"])
    tube = psd_layer(psd, src["tube"])
    body = psd_layer(psd, src["body"])
    px_per_mm = (body.bbox[2] - body.bbox[0]) / src["bodyMm"]
    rgba = np.asarray(tube.topil().convert("RGBA")).copy()
    alpha = rgba[..., 3].astype(float)
    rows = alpha.sum(1) / 255
    top = int(np.argmax(rows > 2))
    end = top
    while end < len(rows) and rows[end] > 2:
        end += 1
    rgba, alpha = rgba[top:end], alpha[top:end]
    # Re-centre each row on its alpha centroid (smoothed), so the tube stands straight on one axis.
    xs = np.arange(rgba.shape[1])
    centroid = (alpha * xs).sum(1) / np.maximum(alpha.sum(1), 1)
    k = 61
    padded = np.pad(centroid, (k // 2, k // 2), mode="edge")
    smooth = np.array([np.median(padded[i:i + k]) for i in range(len(centroid))])
    width = rgba.shape[1] + 40
    axis = width / 2
    out = np.zeros((rgba.shape[0], width, 4), np.uint8)
    for y in range(rgba.shape[0]):
        shift = int(round(axis - smooth[y]))
        s0, d0 = max(0, -shift), max(0, shift)
        n = min(rgba.shape[1] - s0, width - d0)
        out[y, d0:d0 + n] = rgba[y, s0:s0 + n]
    holder_gap = 0.0
    if src["holder"]:
        holder = psd_layer(psd, src["holder"])
        holder_gap = (tube.bbox[1] + top - holder.bbox[3]) / px_per_mm
    return dict(img=out, axis=axis, pxPerMm=px_per_mm, holderGapMm=holder_gap)


def fit_length(source, kind, length_px):
    """Exactly `length_px` rows: head and tip kept, the straight shaft repeated (or, for a pipette, shortened)."""
    img = source["img"]
    h = img.shape[0]
    head = int(h * (0.30 if kind in ("spray", "lotion") else 0.12))
    tip = int(h * (0.12 if kind == "pipette" else 0.04))
    if length_px <= head + tip:
        return img[:length_px]
    shaft = img[head:h - tip]
    need = length_px - head - tip
    if need <= len(shaft):
        # Too long: drop shaft rows (a pipette keeps its rounded tip; a tube keeps its plain cut end).
        return np.concatenate([img[:head], shaft[:need], img[h - tip:]])
    # Repeat a straight stretch of the shaft's own rows (its middle third) until the tube is long enough.
    lo, hi = len(shaft) // 3, 2 * len(shaft) // 3
    block = shaft[lo:hi]
    reps = [shaft[:hi]]
    total = hi
    while total < need - (len(shaft) - hi):
        take = block[: need - (len(shaft) - hi) - total]
        reps.append(take)
        total += len(take)
    reps.append(shaft[hi:])
    return np.concatenate([img[:head], *reps, img[h - tip:]])[: length_px]


def bend(img, px_per_mm, kind):
    if kind == "pipette":
        return img
    h = img.shape[0]
    out = np.zeros_like(img)
    start = int(h * 0.62)
    amount = FOOT_BEND_MM * px_per_mm
    for y in range(h):
        t = max(0.0, (y - start) / max(1, h - start))
        shift = int(round(amount * t * t * (3 - 2 * t)))
        out[y, shift:] = img[y, : img.shape[1] - shift] if shift else img[y]
    return out


def stem_exit(part, axis_x):
    """Canvas y where the closure's stem leaves it on the neck axis: the end of the first opaque run down the axis."""
    img = np.asarray(load(part["image"]["url"]))[..., 3]
    box = part["box"]
    sx = img.shape[1] / box["width"]
    sy = img.shape[0] / box["height"]
    cx = (axis_x - box["x"]) * sx
    band = img[:, max(0, int(cx - 1.5 * sx)): int(cx + 1.5 * sx) + 1].max(1)
    y = int(np.argmax(band > 128))
    clear = 0
    while y < len(band):
        clear = clear + 1 if band[y] < 60 else 0
        if clear >= max(3, int(2 * sy)):
            y -= clear - 1
            break
        y += 1
    return box["y"] + y / sy


def kind_of(sku, kit):
    slots = {p["slot"] for p in kit["parts"] if not p.get("views") or "capon" in p["views"]}
    if "pump" in slots:
        return "lotion"
    if "sprayer" in slots:
        return "bulb" if "AnSp" in sku else "spray"
    if "fitment" in slots and "Drp" in sku:
        return "pipette"
    return None


def holder_of(kit, kind):
    slot = {"lotion": "pump", "spray": "sprayer", "spray13": "sprayer", "bulb": "sprayer", "pipette": "fitment"}[kind]
    return next(p for p in kit["parts"] if p["slot"] == slot and (not p.get("views") or "capon" in p["views"]))


def sliver_mask(plate_rgba, plate_box, out_box, shape):
    """1 where the tube shows through flat glass, 0 on a flute ridge or facet edge crossing its path."""
    h, w = shape
    plate = np.asarray(plate_rgba.convert("L"), float)
    px = plate.shape[1] / plate_box["width"]
    py = plate.shape[0] / plate_box["height"]
    ys = ((out_box["y"] + (np.arange(h) + 0.5) * out_box["height"] / h) - plate_box["y"]) * py
    xs = ((out_box["x"] + (np.arange(w) + 0.5) * out_box["width"] / w) - plate_box["x"]) * px
    yi = np.clip(ys.astype(int), 1, plate.shape[0] - 2)
    xi = np.clip(xs.astype(int), 1, plate.shape[1] - 2)
    # Luminance gradient: flute ridges and facet edges are lines of strong contrast.
    gx = np.hypot(*np.gradient(plate))
    from scipy.ndimage import gaussian_filter  # noqa: E402
    edge = gaussian_filter(gx, sigma=0.6 * px)
    sample = edge[np.ix_(yi, xi)]
    # Per pixel, relative to this glass: where a flute ridge or facet edge lies over the tube it hides that strip,
    # so the tube reads as vertical slivers between the ridges. Absolute thresholds would hide the whole tube in
    # Diva's dense flutes; the strongest 30 % of edges cut it, the flat faces show it.
    lo, hi = np.percentile(sample, 60), np.percentile(sample, 85)
    return 1 - np.clip((sample - lo) / max(1e-6, hi - lo), 0, 1)


def main():
    kits_path, work = sys.argv[1], sys.argv[2]
    register = "--register" in sys.argv[3:]
    floors = REGISTER_FLOORS if register else FLOORS
    prefix = "register-" if register else ""
    os.makedirs(work, exist_ok=True)
    kits = json.load(open(kits_path))["rows"]
    sources = {kind: extract(kind) for kind in SOURCES}
    groups = {}
    for sku, kit in sorted(kits.items()):
        m = re.match(r"register:([a-z0-9-]+)\|(Clear|Frosted)$", kit["familyId"])
        if not m or m.group(1) not in floors or kit.get("sku") != sku:
            continue
        body_id, glass = m.groups()
        kind = kind_of(sku, kit)
        if kind == "spray" and body_id.endswith("-13-415"):
            kind = "spray13"
        if register and kind == "pipette":
            continue   # register droppers keep their own pipettes (not part of the 24 Nov register-tube audit)
        if not kind or kind not in KINDS.get(body_id, {kind}) or (kind == "pipette" and glass != "Clear"):
            continue   # frosted droppers keep the pipette hidden in the glass (Jordan, Elegant 60 frosted)
        holder = holder_of(kit, kind)
        groups.setdefault((body_id, glass, kind), []).append((sku, kit, stem_exit(holder, kit["anchors"]["axisX"])))

    plan = {"images": {}, "groups": {}, "skus": {}}
    for (body_id, glass, kind), members in sorted(groups.items()):
        kit = members[0][1]
        mm = kit["anchors"]["pxPerMm"]
        axis_x = kit["anchors"]["axisX"]
        src = sources[kind]
        ratio = src["pxPerMm"] / mm          # source px per canvas px: the tube is never resampled
        exits = sorted(e for _, _, e in members)
        floor = floors[body_id] - (PIPETTE_CLEARANCE_MM if kind == "pipette" else TIP_CLEARANCE_MM) * mm
        # One image per glass and fitment, long enough for the highest seated stem of its finishes.
        # Tuck the tube 2 px into the closure (drawn over it), never leaving glass between them with the cap off;
        # the pipette keeps its deeper seat from the dropper PSD.
        top = exits[0] + min(0.0, src["holderGapMm"]) * mm - 2
        length = int(round((floor - top) * ratio))
        img = bend(fit_length(src, kind, length), src["pxPerMm"], kind)
        # Crop to the tube, symmetric about its axis, so the box centre stays on the neck axis.
        cols = np.where(img[..., 3].max(0) > 8)[0]
        half = int(np.ceil(max(src["axis"] - cols[0], cols[-1] + 1 - src["axis"]))) + 2
        lo = int(round(src["axis"])) - half
        img = img[:, max(0, lo): lo + 2 * half]
        axis = src["axis"] - max(0, lo)
        cols = np.where(img[..., 3].max(0) > 8)[0]
        name = f"{prefix}{body_id}-{glass.lower()}-{kind}"
        plain = Image.fromarray(img, "RGBA")
        box = {"x": axis_x - axis / ratio, "y": top, "width": img.shape[1] / ratio, "height": img.shape[0] / ratio}
        opaque = {"left": int(cols[0]), "right": int(cols[-1] + 1)}
        # One image per glass: clear and frosted groups of a body fit different stems and floors (sharing one name
        # let the second overwrite the first, stretching the other glass's tube).
        plain_name = f"{prefix}{body_id}-{glass.lower()}-{kind}"
        plan["images"][plain_name] = plain
        seated_name = plain_name
        if body_id in FLUTED and glass == "Clear":
            body = next(p for p in kit["parts"] if p["slot"] == "body")
            mask = sliver_mask(load(body["image"]["url"]), body["box"], box, img.shape[:2])
            broken = img.copy()
            broken[..., 3] = (broken[..., 3] * mask).astype(np.uint8)
            seated_name = f"{name}-slivers"
            plan["images"][seated_name] = Image.fromarray(broken, "RGBA")
        plan["groups"][name] = {"bodyId": body_id, "glass": glass, "kind": kind, "seated": seated_name, "exploded": plain_name,
                                "box": {k: round(v, 2) for k, v in box.items()}, "floorY": round(floor, 2), "opaque": opaque,
                                "opacity": OPACITY[glass], "sourcePxPerMm": round(src["pxPerMm"], 4), "stemExits": [round(exits[0], 1), round(exits[-1], 1)]}
        if register:
            # heroTube() looks a tube up by plate and fitment family, and places it on the frame from this datum.
            plan["groups"][name].update({
                "plateKey": kit["register"]["plateKey"],
                "families": {"bulb": ["bulb", "tassel"], "spray13": ["spray"]}.get(kind, [kind]),
                "datum": {"axisX": axis_x, "seatY": kit["anchors"]["seatY"], "pxPerMm": mm},
                # For the checks: the glass's rectangle and inner floor on the same datum.
                "glassBounds": {k: round(v, 2) for k, v in next(p for p in kit["parts"] if p["slot"] == "body")["bounds"].items()},
                "innerFloorY": floors[body_id],
            })
        for sku, _, exit_y in members:
            plan["skus"][sku] = {"group": name, "dy": round(exit_y - exits[0], 2)}
    for name, image in plan["images"].items():
        image.save(os.path.join(work, name + ".png"), optimize=True)
    out = {"groups": plan["groups"], "skus": plan["skus"], "images": {name: f"{name}.png" for name in plan["images"]}}
    json.dump(out, open(os.path.join(work, "plan.json"), "w"), indent=1, sort_keys=True)
    for name, group in plan["groups"].items():
        print(f"{name:42} skus={sum(s['group'] == name for s in plan['skus'].values()):3} stem {group['stemExits']} box {group['box']}")


if __name__ == "__main__":
    main()
