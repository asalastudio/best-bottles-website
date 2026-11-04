"""Review kits for the ten Vial SKUs that had none: 1 ml plug vials, 4 ml droppers and the 9 ml vials.

None of them is in the register, so they are built from the master library's PSDs (BB-PSD-Files-Master/12. Vials),
one glass per size, on the stage datum at the size's bare height and catalog-scale sizing:
- 1 ml (GB1mlAmbVBlk, GB1mlAmbVialWht, GB1mlVBlk, GB1mlVWht): the clean amber vial layer is the one outline; the
  clear vial exists only merged with its cap or inside a white cut-out frame, so Sunburst redraws the outline as
  clear glass (the clear photograph as material). The black or white plug cap with its applicator rod is one layer,
  placed on the glass as the assembled (cap-on) PSDs place it: the cap head on the rim, the plug and rod inside.
- 4 ml droppers (GBV1DrmBlkDropper, GBVAmb1DrmBlkDrpr, GBVBlu1DrmBlkDropper, GBVGr1DrmBlkDropper): each colour's own
  glass (the dropper PSDs for clear and green, the cap PSDs for amber and blue); the dropper head and glass pipette
  of the clear dropper PSD, placed by its bottle. The pipette shows through coloured glass darkened and multiplied.
- 9 ml (GB09BlackCapSht, GB09BlackCapApp): the clean glass of the short-cap PSD for both; the black cap, and for the
  applicator its glass rod hanging from the cap (one cap layer, so it parks with the cap).
- 2 ml amber 8-425 (GBVAmb2BlackCap, GBVAmb2WhtCap): the approved kits, untouched in production; Jordan (3 Nov 2026)
  asked for the vial "a tad bit thinner", then "more slim ... and the mouth the neck should be narrower as well": the
  review copy reshapes the photographs in place, the body BODY_2ML as wide and the neck, finish and mouth NECK_2ML
  (blended through the shoulder), the cap NECK_2ML to fit the finish; heights and boxes unchanged.
Writes public/local-kits/vial-masters-2026-11-03/kits.json.
Usage: python3 scripts/diva-vial/vial-kits.py <work-dir>
"""
import hashlib, importlib, io, json, os, sys, urllib.request
import numpy as np
from PIL import Image
from psd_tools import PSDImage

sys.path.insert(0, "scripts/elegant-masters")
pipeline = importlib.import_module("regenerate-frosted")
V = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/12. Vials"
DIR = "public/local-kits/vial-masters-2026-11-03"
OUT = f"{DIR}/parts"
SCALE = json.load(open("src/lib/register/catalog-scale.generated.json"))
W, H, AXIS, BASE, BARE_PX = 1000, 1100, 500, 1061, 800
SEAT = BASE - BARE_PX
THROUGH_GLASS = 2.6
BODY_2ML = 0.90         # the 2 ml amber's body width against the approved photograph
NECK_2ML = 0.85         # its neck, finish and mouth (and the cap that fits them)
CLEAR_PROMPT = """1. Keep geometry locked to the first image: the same small tubular vial, its rim, walls, rounded base and thickness, at the same position and size in the frame. Do not redraw the shape.
2. Clear, colourless glass as in the second image (a photograph of the same vial): fully transparent, the background seen through it unchanged, crisp dark refraction lines along the walls, a thick clear base. Not amber, no tint, no liquid, no cap, no rod, no label.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no props, no text."""


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def prune(folder, rows):
    """Remove only the files in `folder` that no row references any more (after the rows are built, so a failed run
    leaves the committed manifest's files in place)."""
    keep = {p["image"]["url"].rsplit("/", 1)[1] for kit in rows.values() for p in kit["parts"]
            if isinstance(p.get("image"), dict) and p["image"].get("url", "").startswith("/" + folder.removeprefix("public/") + "/")}
    for old in os.listdir(folder):
        if old not in keep:
            os.remove(f"{folder}/{old}")


def layer(rel, name):
    """(image cropped to its alpha, absolute top-left) of one layer."""
    p = PSDImage.open(f"{V}/{rel}"); l = {x.name: x for x in p.descendants()}[name]
    im = l.composite().convert("RGBA"); bb = im.getchannel("A").getbbox()
    return im.crop(bb), (l.bbox[0] + bb[0], l.bbox[1] + bb[1])


def frame(img, xy):
    """(top, foot, axis) of a bottle layer in its PSD's px."""
    return xy[1], xy[1] + img.height, xy[0] + img.width / 2


def part(slot, image, xy, fr, z, explode, comp, extra=None):
    top, foot, axis = fr; s = BARE_PX / (foot - top)
    box = {"x": round(AXIS + (xy[0] - axis) * s, 3), "y": round(SEAT + (xy[1] - top) * s, 3),
           "width": round(image["width"] * s, 3), "height": round(image["height"] * s, 3)}
    p = {"slot": slot, "variantKey": None, "zOrder": z, "explodeIndex": explode,
         "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)},
         "assembled": {"x": 0, "y": 0}, "exploded": {"dx": 0, "dy": 0}, "image": image, "image2x": None, "mask": None,
         "derivation": "psd-layer", "box": box, "componentId": comp}
    p.update(extra or {})
    return p


def kit(sku, body_id, glass, parts, landmark, scale_key):
    sc = SCALE[scale_key]; px_mm = round(BARE_PX / sc["heightBareMm"], 3)
    body = next(p for p in parts if p["slot"] == "body")
    body["bounds"] = {**body["bounds"], "top": SEAT, "bottom": BASE}
    return {"sku": sku, "familyId": f"register:{body_id}|{glass}", "plateSha256": "", "canvas": {"width": W, "height": H},
            "anchors": {"axisX": AXIS, "neckAxisX": AXIS, "seatY": SEAT, "baselineY": BASE, "pxPerMm": px_mm},
            "completeness": "full", "parts": sorted(parts, key=lambda p: p["zOrder"]), "three": None, "conflicts": [],
            "register": {"bodyId": body_id, "plateKey": f"{body_id}|{glass}", "glass": glass,
                         "datum": {"axisX": AXIS, "seatY": SEAT, "baselineY": BASE}, "pxPerMm": px_mm,
                         "componentIds": sorted({p["componentId"] for p in parts if p["componentId"]})},
            "glassSizing": {"heightPct": sc["targetPct"], "baselinePct": sc["baselinePct"], "landmarkY": landmark, "source": sc["source"]},
            "reviewMaster": "vial-2026-11-03"}


def clear_master(outline, work):
    """The amber 1 ml outline redrawn as clear glass, cut with its alpha."""
    W_, H_ = max(outline.width, round(outline.height / 1.5)), 0; H_ = round(W_ * 1.5)
    pipeline.on_bone(outline, (W_, H_)).convert("RGB").save(f"{work}/vial1.geometry.png")
    photo, _ = layer("4. 1ml Clear PSD Uncapped/1. GB1mlVBlk.psd", "clear 1ml with black app")
    pipeline.on_bone(photo, (round(photo.height / 1.5), photo.height) if photo.height > photo.width * 1.5 else (photo.width, round(photo.width * 1.5))).convert("RGB").save(f"{work}/vial1.material.png")
    pipeline.PROMPT = CLEAR_PROMPT
    raw = f"{work}/vial1.raw.png"
    if not os.path.exists(raw):
        pipeline.edit([f"{work}/vial1.geometry.png", f"{work}/vial1.material.png"], raw)
    out = Image.open(raw).convert("RGB"); a = np.asarray(out).astype(int)
    bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
    got = np.abs(a - bg).max(axis=2) > 6; target = np.asarray(outline)[..., 3] > 40
    (gy, gx), (ty, tx) = np.where(got), np.where(target)
    s = (ty.max() - ty.min()) / (gy.max() - gy.min())
    scaled = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    dx = round((tx.min() + tx.max()) / 2 - (gx.min() + gx.max()) / 2 * s); dy = round(ty.min() - gy.min() * s)
    aligned = Image.new("RGB", outline.size, tuple(int(v) for v in bg)); aligned.paste(scaled, (dx, dy))
    master = aligned.convert("RGBA"); master.putalpha(outline.getchannel("A"))
    return master


def amber_frame(img, xy):
    """(first amber row, amber centre x) of an amber vial layer, in its PSD's px."""
    a = np.asarray(img).astype(int); m = (a[..., 3] > 200) & (a[..., 0] - a[..., 2] > 60)
    ys, xs = np.where(m)
    return xy[1] + ys.min(), xy[0] + (xs.min() + xs.max() + 1) / 2


def assembled(rel, cap_name, vial_name):
    """The cap's top-left against the amber glass (first amber row, centre) in an assembled 1 ml PSD."""
    cap, cap_xy = layer(rel, cap_name); vial, vial_xy = layer(rel, vial_name)
    top, cx = amber_frame(vial, vial_xy)
    return cap_xy[0] - cx, cap_xy[1] - top


ASSEMBLED = {}


def squeezed(img, f, axis=None):
    """The image narrowed by f about its alpha's centre (or `axis`), row by row; size unchanged."""
    a = np.asarray(img).astype(np.float32); m = a[..., 3] > 60; xs = np.where(m.any(0))[0]
    axis = (xs.min() + xs.max() + 1) / 2 if axis is None else axis
    return Image.fromarray(warp(a, np.full(a.shape[0], f), axis).astype(np.uint8))


def warp(a, f, axis):
    """Each row y resampled about `axis` by its own factor f[y] (premultiplied, so edges stay clean)."""
    x = np.arange(a.shape[1], dtype=np.float32) + 0.5
    pm = a.copy(); pm[..., :3] *= a[..., 3:4] / 255
    out = np.zeros_like(a)
    for y in range(a.shape[0]):
        if a[y, :, 3].any():
            src = axis + (x - axis) / f[y] - 0.5
            for c in range(4):
                out[y, :, c] = np.interp(src, np.arange(a.shape[1]), pm[y, :, c], left=0, right=0)
    rgb = np.where(out[..., 3:4] > 0, out[..., :3] * 255 / np.maximum(out[..., 3:4], 1e-3), 0)
    return np.dstack([rgb.clip(0, 255), out[..., 3].clip(0, 255)])


def slimmed(img):
    """The vial's body BODY_2ML as wide, its neck and finish NECK_2ML, blended through the shoulder by row width."""
    a = np.asarray(img).astype(np.float32); m = a[..., 3] > 60; w = m.sum(1); ys = np.where(w > 0)[0]
    body_w = float(np.median(w[ys[len(ys) // 2]:ys[-1]])); xs = np.where(m.any(0))[0]; axis = (xs.min() + xs.max() + 1) / 2
    shoulder = int(ys[np.argmax(w[ys] >= 0.95 * body_w)])
    neck_w = float(np.median(w[ys[0]:shoulder][w[ys[0]:shoulder] > 0]))
    t = np.clip((w - neck_w) / max(1.0, body_w - neck_w), 0, 1)
    f = np.where(np.arange(len(w)) >= shoulder, BODY_2ML, NECK_2ML + (BODY_2ML - NECK_2ML) * t)
    return Image.fromarray(warp(a, f, axis).astype(np.uint8))


def through_glass(img):
    a = np.asarray(img).astype(np.float32); dark = 255 - (255 - a[..., :3]) * THROUGH_GLASS
    return Image.fromarray(np.dstack([dark.clip(0, 255), a[..., 3]]).astype(np.uint8))


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True)
    ASSEMBLED.update({"Blk": assembled("2. 1ml Amber PSD Uncapped/1. GB1mlAmbVBlk.psd", "Layer 3", "Layer 4"),
                      "Wht": assembled("2. 1ml Amber PSD Uncapped/2. GB1mlAmbVialWht.psd", "Layer 1", "Layer 3")})
    rows = {}

    # 1 ml plug vials.
    amber, amber_xy = layer("1. 1ml Amber PSD Capped/1. GB1mlAmbVBlk.psd", "Layer 5")
    fr1 = frame(amber, amber_xy)
    clear = clear_master(amber, work)
    bodies1 = {"Amber": save(amber, "vial-1ml-amber"), "Clear": save(clear, "vial-1ml-clear")}
    caps1 = {"Blk": layer("1. 1ml Amber PSD Capped/1. GB1mlAmbVBlk.psd", "Layer 3"),
             "Wht": layer("1. 1ml Amber PSD Capped/2. GB1mlAmbVialWht.psd", "Layer 1")}
    # The plug's place on the glass, from the assembled (cap-on) PSDs: the cap head rests on the rim and the plug goes
    # inside. Measured against the amber glass (its first amber row and its centre), the same in the parked file.
    amber_top, amber_cx = amber_frame(amber, amber_xy)
    for sku, glass, cap_key in (("GB1mlAmbVBlk", "Amber", "Blk"), ("GB1mlAmbVialWht", "Amber", "Wht"),
                                ("GB1mlVBlk", "Clear", "Blk"), ("GB1mlVWht", "Clear", "Wht")):
        cap, _ = caps1[cap_key]; dx, dy = ASSEMBLED[cap_key]
        cap_xy = (amber_cx + dx, amber_top + dy)
        parts = [part("body", bodies1[glass], amber_xy, fr1, 0, 0, None),
                 part("cap", save(cap, f"plug-cap-{cap_key}"), cap_xy, fr1, 1, 1, f"PSD-VIAL1-PLUG-{cap_key.upper()}",
                      {"blendMode": "multiply"} if cap_key == "Wht" else None)]   # the white plug shows through the glass
        rows[sku] = kit(sku, "vial-1ml-Plug", glass, parts, SEAT, "vial-1ml-Plug")

    # 4 ml droppers.
    head, head_xy = layer("0. All Vials/Capped/GBV1DrmBlkDropper.psd", "Layer 2")
    pip, pip_xy = layer("0. All Vials/Capped/GBV1DrmBlkDropper.psd", "Layer 5")
    cb, cb_xy = layer("0. All Vials/Capped/GBV1DrmBlkDropper.psd", "Layer 4")
    fr_clear = frame(cb, cb_xy)
    head_img, pip_img, pip_dark = save(head, "dropper-head-13-425"), save(pip, "pipette-13-425"), save(through_glass(pip), "pipette-13-425-through-glass")
    glass4 = {"Clear": ("0. All Vials/Capped/GBV1DrmBlkDropper.psd", "Layer 4"), "Green": ("0. All Vials/Capped/GBVGr1DrmBlkDropper.psd", "Layer 3"),
              "Amber": ("0. All Vials/Capped/GBVAmb1DrmWhtCapSht.psd", "Layer 7"), "Blue": ("0. All Vials/Capped/GBVBlu1DrmWhtCapSht..psd", "Layer 6")}
    for sku, glass in (("GBV1DrmBlkDropper", "Clear"), ("GBVAmb1DrmBlkDrpr", "Amber"), ("GBVBlu1DrmBlkDropper", "Blue"), ("GBVGr1DrmBlkDropper", "Green")):
        b, b_xy = layer(*glass4[glass])
        parts = [part("body", save(b, f"vial-4ml-{glass.lower()}"), b_xy, frame(b, b_xy), 0, 0, None),
                 part("pipette", pip_img if glass == "Clear" else pip_dark, pip_xy, fr_clear, 1, 1, "PSD-VIAL4-DROPPER",
                      None if glass == "Clear" else {"blendMode": "multiply"}),
                 part("fitment", head_img, head_xy, fr_clear, 2, 1, "PSD-VIAL4-DROPPER")]
        rows[sku] = kit(sku, "vial-4ml-13-425", glass, parts, SEAT, "vial-4ml-13-425")

    # 9 ml: one glass (the short-cap PSD's), the cap, and for the applicator its rod hanging from the cap.
    b9, b9_xy = layer("0. All Vials/Capped/2. GB09BlackSht.psd", "Layer 7"); fr9 = frame(b9, b9_xy)
    cap9, cap9_xy = layer("0. All Vials/Capped/2. GB09BlackSht.psd", "Layer 3")
    app_b, app_b_xy = layer("0. All Vials/Capped/GB09BlackCapApp..psd", "Layer 7")
    app_cap, app_cap_xy = layer("0. All Vials/Capped/GB09BlackCapApp..psd", "Layer 3")
    rod, rod_xy = layer("0. All Vials/Capped/GB09BlackCapApp..psd", "Layer 6")
    # The applicator PSD frames the same glass at the same width; map it by the glass's foot and axis.
    k9 = b9.width / app_b.width
    to9 = lambda xy: ((xy[0] - (app_b_xy[0] + app_b.width / 2)) * k9 + fr9[2], (xy[1] - (app_b_xy[1] + app_b.height)) * k9 + fr9[1])
    rc, ry = to9(rod_xy), to9(app_cap_xy)
    # The cap with its rod as one layer, in the 9 ml glass's PSD px.
    left = min(ry[0], rc[0]); top = min(ry[1], rc[1])
    rod_s = rod.resize((round(rod.width * k9), round(rod.height * k9))); capa = app_cap.resize((round(app_cap.width * k9), round(app_cap.height * k9)))
    combo = Image.new("RGBA", (round(max(ry[0] + capa.width, rc[0] + rod_s.width) - left), round(max(ry[1] + capa.height, rc[1] + rod_s.height) - top)), (0, 0, 0, 0))
    combo.alpha_composite(rod_s, (round(rc[0] - left), round(rc[1] - top))); combo.alpha_composite(capa, (round(ry[0] - left), round(ry[1] - top)))
    widths = (np.asarray(b9)[..., 3] > 40).sum(1)
    land9 = round(SEAT + int(np.argmax(widths >= 0.92 * widths.max())) * BARE_PX / b9.height, 2)
    body9 = save(b9, "vial-9ml-clear")
    rows["GB09BlackCapSht"] = kit("GB09BlackCapSht", "vial-9ml-18-400", "Clear",
                                  [part("body", body9, b9_xy, fr9, 0, 0, None), part("cap", save(cap9, "cap-9ml-black"), cap9_xy, fr9, 1, 1, "PSD-VIAL9-CAP-BLK")],
                                  land9, "vial-9ml-18-400")
    rows["GB09BlackCapApp"] = kit("GB09BlackCapApp", "vial-9ml-18-400", "Clear",
                                  [part("body", body9, b9_xy, fr9, 0, 0, None), part("cap", save(combo, "cap-9ml-black-rod"), (left, top), fr9, 1, 1, "PSD-VIAL9-CAP-ROD")],
                                  land9, "vial-9ml-18-400")

    # 2 ml amber: the approved kits reshaped in place (boxes unchanged): the body slimmer, the neck and mouth narrower.
    approved = json.load(open("src/lib/paper-doll/approved-kits.generated.json"))["rows"]
    for sku in ("GBVAmb2BlackCap", "GBVAmb2WhtCap"):
        k = json.loads(json.dumps(approved[sku]))
        for p in k["parts"]:
            src = Image.open(io.BytesIO(urllib.request.urlopen(p["image"]["url"]).read())).convert("RGBA")
            out = slimmed(src) if p["slot"] == "body" else squeezed(src, NECK_2ML)      # the cap fits the narrower finish
            p["image"] = save(out, f"{sku}-{p['slot']}-slim"); p["image2x"] = None
        k["reviewMaster"] = "vial-2026-11-03"
        k["slimmedFrom"] = {"approved": approved[sku]["parts"][0]["image"]["sha256"], "body": BODY_2ML, "neck": NECK_2ML}
        rows[sku] = k

    prune(OUT, rows)
    version = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    json.dump({"version": version, "rows": rows, "defaultPdpSkus": sorted(rows)}, open(f"{DIR}/kits.json", "w"), indent=1)
    open(f"{DIR}/kits.json", "a").write("\n")
    print(len(rows), "Vial kits; version", version)


if __name__ == "__main__":
    main()
