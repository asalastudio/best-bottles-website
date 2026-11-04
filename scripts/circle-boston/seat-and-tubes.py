"""Seat every Circle closure on its shoulder and draw the PSD dip tube of each size and fitment.

Run after build-circle-kits.mts (sized register kits) and psd-tubes.py (the regenerated tubes). The
same treatment the Elegant 60/100 ml masters were approved with (scripts/elegant-masters/
universal-dip-tube-60-100.py, whose helpers this imports):

0. Reducers. The Circle reducer kits came from the register as glass and cap only. The 18-415 reducer
   is one component across bottles: draw the Elegant 60 ml kits' reviewed insert (seated) and plug
   (EXPLODED), scaled by px/mm about the neck datum, so their pages offer cap off and exploded.
0b. Roll-ons: the 15 ml roll-on kits take the standard 13-415 metal and plastic rollers.
1. Shoulder seat: each closure's collar bottom rests on the first row of its own glass's shoulder
   that is as wide as the collar; overcaps move with their heads, pipettes with their fitments.
   Tassel kits stand the glass right of centre (glassSizing.axisPct) so the hose stays on stage.
   A clear lotion overcap draws the empty cover, multiplied, so the pump is not printed twice.
   50 ml droppers: frosted glass hides the pipette; EXPLODED lifts the complete 18-415 dropper.
2. Dip tubes: one PSD tube per size and fitment type (spray, lotion, atomizer for bulb and tassel),
   placed by the PSD's bottle-to-tube geometry, multiplied into the glass, travelling with the head;
   frosted kits draw it in EXPLODED only.

3. Cap close-ups: the bulb sprayer kits share the Elegant 18-415 bulb close-ups (catalog dots, rail, chip).

Usage: python3 scripts/circle-boston/seat-and-tubes.py
"""
import hashlib, importlib.util, json, os, re
import numpy as np

spec = importlib.util.spec_from_file_location("elegant_seat", "scripts/elegant-masters/universal-dip-tube-60-100.py")
U = importlib.util.module_from_spec(spec); spec.loader.exec_module(U)

KITS = "public/local-kits/circle-masters-2026-11-03/kits.json"
TUBES = "public/local-kits/circle-masters-2026-11-03/tubes/tubes.json"
REDUCER_FROM = ("public/local-kits/elegant60-100-masters-2026-11-03/kits.json", "GBElg60RdcrPnkLthr")
CLOSE_UPS = "src/lib/products/local-cap-close-ups.json"
APPROVED = "src/lib/paper-doll/approved-kits.generated.json"
ROLLERS = {"LIB-13-415-MtlRollon": "GBSleek5MtlRollGlMatt", "LIB-13-415-PlsticRollon": "GBSleek5RollGlMatt"}
PARK_MARGIN = 6                # % of the stage kept clear right of a parked cap
BULB_MARGIN = 8                # % of the stage kept clear above and beside a plain bulb (it crowded the card's corner)
# Family settings: scripts/round-sleek/seat-and-tubes.py imports this module and replaces them.
FROST_DIR = "public/local-kits/circle-masters-2026-11-03/droppers"
BULB = re.compile(r"GBCrcl(?:Frst)?(?:50|100)(AnSpTsl|AnSp)(\w+)$")
EMPTY_COVER = "/local-kits/shared-2026-11-03/ltn-18-415-clear-overcap-empty.png"   # empty-lotion-cover.py
TUBE_ANCHOR = "psd"              # "psd": the PSD's bottle-to-tube geometry; "register": the register tube's place
tube_key = lambda kit: kit["register"]["bodyId"].split("-")[1].removesuffix("ml")
DROPPER = re.compile(r"GBCrcl(?:Frst)?50Drp(Cu|Gl|Sl)$")


FROST_BLUR = 14                 # px of the 739 px pipette photograph (~4 stage px): the scatter of the frosted wall
FROST_STRENGTH = 0.5            # share of the pipette's darkness that still reads through the frost
_frosted = {}


def frosted_pipette(img, finish):
    """The glass pipette as seen through frosted glass: blurred, its tone lifted toward white (it multiplies)."""
    if finish in _frosted:
        return _frosted[finish]
    from PIL import Image, ImageFilter
    import io
    src = Image.open("public" + img["url"]).convert("RGBA")
    pad = FROST_BLUR * 3
    wide = Image.new("RGBA", (src.width + 2 * pad, src.height + 2 * pad), (255, 255, 255, 0)); wide.alpha_composite(src, (pad, pad))
    a = np.asarray(wide).astype(np.float32)
    rgb = a[..., :3] * (a[..., 3:] / 255) + 255 * (1 - a[..., 3:] / 255)              # on white: alpha folded in
    flat = Image.fromarray(np.dstack([rgb, a[..., 3]]).astype(np.uint8)).filter(ImageFilter.GaussianBlur(FROST_BLUR))
    b = np.asarray(flat).astype(np.float32)
    tone = 255 - (255 - b[..., :3]) * FROST_STRENGTH
    out = Image.fromarray(np.dstack([tone, b[..., 3]]).clip(0, 255).astype(np.uint8)).crop((pad, pad, pad + src.width, pad + src.height))
    buf = io.BytesIO(); out.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    folder = FROST_DIR; os.makedirs(folder, exist_ok=True)
    for old in os.listdir(folder):
        if old.startswith(f"Drp18-415{finish}-pipette-frost-"):
            os.remove(f"{folder}/{old}")
    path = f"{folder}/Drp18-415{finish}-pipette-frost-{sha[:12]}.png"; open(path, "wb").write(data)
    _frosted[finish] = {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": out.width, "height": out.height}
    return _frosted[finish]


def boxed(part, box):
    part["box"] = box
    part["bounds"] = {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}


def reorder(kit):
    for z, p in enumerate(kit["parts"]):
        p["zOrder"] = z


def main():
    kits = json.load(open(KITS)); rows = kits["rows"]

    # 0. Reducers.
    template = json.load(open(REDUCER_FROM[0]))["rows"][REDUCER_FROM[1]]
    t_ppm = template["anchors"]["pxPerMm"]; t_d = template["register"]["datum"]
    t_reducers = [p for p in template["parts"] if p["slot"] == "reducer"]
    for sku, kit in rows.items():
        if "Rdcr" not in sku or any(p["slot"] == "reducer" for p in kit["parts"]):
            continue
        k = kit["anchors"]["pxPerMm"] / t_ppm; d = kit["register"]["datum"]
        added = []
        for src in t_reducers:
            r = json.loads(json.dumps(src)); b = src["box"]
            boxed(r, {"x": round(d["axisX"] + (b["x"] - t_d["axisX"]) * k, 3), "y": round(d["seatY"] + (b["y"] - t_d["seatY"]) * k, 3),
                      "width": round(b["width"] * k, 3), "height": round(b["height"] * k, 3)})
            r["source"] = f"{template['sku']} reducer, scaled {k:.4f} (18-415, {t_ppm} -> {kit['anchors']['pxPerMm']} px/mm)"
            added.append(r)
        body = [p for p in kit["parts"] if p["slot"] == "body"]
        rest = [p for p in kit["parts"] if p["slot"] != "body"]
        for p in rest:
            p["explodeIndex"] = max(p.get("explodeIndex", 1), 2)
        kit["parts"] = body + added + rest
        reorder(kit)
        kit["register"] = {**kit["register"], "componentIds": sorted(set(kit["register"].get("componentIds", [])) | {added[0]["componentId"]})}

    # 0b. Roll-on inserts (Jordan, 3 Nov 2026): the 15 ml roll-on kits drew the register's small roller
    #     thumbnail; they take the standard 13-415 metal and plastic rollers every other 13-415 bottle uses
    #     (the approved Sleek 5 ml recipe's layers), scaled by px/mm about the neck datum.
    approved = json.load(open(APPROVED))["rows"]
    standard = {c: next(p for p in approved[sku]["parts"] if p["slot"] == "roller") for c, sku in ROLLERS.items()}
    for sku, kit in rows.items():
        old = next((p for p in kit["parts"] if p["slot"] == "roller"), None)
        if old is None or old["componentId"] not in standard:
            continue
        src = standard[old["componentId"]]; t = approved[ROLLERS[old["componentId"]]]
        k = kit["anchors"]["pxPerMm"] / t["anchors"]["pxPerMm"]; d = kit["register"]["datum"]; t_d = t["register"]["datum"]
        r = json.loads(json.dumps(src)); b = src["box"]
        boxed(r, {"x": round(d["axisX"] + (b["x"] - t_d["axisX"]) * k, 3), "y": round(d["seatY"] + (b["y"] - t_d["seatY"]) * k, 3),
                  "width": round(b["width"] * k, 3), "height": round(b["height"] * k, 3)})
        r.update({"zOrder": old["zOrder"], "explodeIndex": old["explodeIndex"],
                  "source": f"{ROLLERS[old['componentId']]} standard 13-415 roller, scaled {k:.4f}"})
        kit["parts"] = [r if p is old else p for p in kit["parts"]]

    # 1. Shoulder seat.
    for sku, kit in rows.items():
        sh, neck, glass_width = U.shoulder(kit)
        axis = kit["register"]["datum"]["axisX"]
        kit["glassShoulderY"] = int(sh)
        moved = {}
        for part in sorted((p for p in kit["parts"] if p["slot"] in U.CLOSURES), key=lambda p: p["slot"] == "overcap"):
            head = next((p for p in kit["parts"] if p["slot"] in ("sprayer", "pump")), None)
            if part["slot"] == "overcap" and head is not None and head["slot"] in moved:
                U.shift(part, moved[head["slot"]])
                part["seatWith"] = head["slot"]
                part.pop("seatBottomY", None); part.pop("collarWidth", None)
                continue
            bottom, cx, width = U.collar(part, axis, neck)
            if bottom is None:
                continue
            rest = sh
            while glass_width(rest) < width * 0.97:
                rest += 1
            dy = rest + U.SEAT_GAP - bottom
            U.shift(part, dy)
            moved[part["slot"]] = dy
            part["seatBottomY"] = int(rest + U.SEAT_GAP)
            part["seatDy"] = round(float(dy), 3)
            part["collarWidth"] = int(width)
            if part["slot"] == "fitment":
                for pip in (p for p in kit["parts"] if p["slot"] == "pipette"):
                    U.shift(pip, dy)

    # 1a. Bulb sprayer framing (tassel or not): the hose and bulb reach left of and above the glass.
    for sku, kit in rows.items():
        if "AnSp" not in sku:
            continue
        sp = next(p for p in kit["parts"] if p["slot"] == "sprayer")
        body = next(p for p in kit["parts"] if p["slot"] == "body")["bounds"]
        m, x, y = U.alpha(sp)
        left = x + int(np.argmax(m.any(0)))
        g = kit["glassSizing"]
        pct = g["heightPct"] / 100 * kit["canvas"]["height"] / (body["bottom"] - g["landmarkY"]) / kit["canvas"]["width"] * 100
        axis = kit["anchors"]["axisX"]
        # The register's tassel hose spans ~120% of the stage beside the 50 ml glass and ~107% beside the
        # 100 ml (the Circle PSDs lay it wider still): no axis shows it all at the family size, so these kits
        # draw the glass just small enough for glass, hose, bulb and tassel to stand inside the margins.
        span = (body["right"] - left) * pct
        if span > 100 - 2 * U.STAGE_MARGIN:
            k = (100 - 2 * U.STAGE_MARGIN) / span
            g["heightPct"] = round(g["heightPct"] * k, 3); pct *= k
            g["source"] = f"{g['source']}; tassel kit drawn at {k:.3f} so the whole assembly fits the stage"
        # The plain bulb rises above the neck: on the 50 ml glass it left the top of the stage (and the
        # catalog card). Draw the glass small enough that the bulb's top stays inside the margin too.
        top = y + int(np.argmax(m.any(1)))
        per_row = g["heightPct"] / (body["bottom"] - g["landmarkY"])                               # % of the stage height per px
        rise = (body["bottom"] - top) * per_row
        clear = U.STAGE_MARGIN if "AnSpTsl" in sku else BULB_MARGIN
        if g["baselinePct"] - rise < clear:
            k = (g["baselinePct"] - clear) / rise
            g["heightPct"] = round(g["heightPct"] * k, 3); pct *= k
            g["source"] = f"{g['source']}; bulb kit drawn at {k:.3f} so the bulb stays on the stage"
        # The register's tassel also hangs ~25 mm below the foot: stand the foot higher so it clears the edge.
        bottom = y + int(np.where(m.any(1))[0].max())
        hang = (bottom - body["bottom"]) * g["heightPct"] / (body["bottom"] - g["landmarkY"])     # % of the stage height
        if g["baselinePct"] + hang > 100 - 1.5:
            g["baselinePct"] = round(100 - 1.5 - hang, 2)
        g["axisPct"] = round(min(100 - U.STAGE_MARGIN - (body["right"] - axis) * pct, max(50, clear + (axis - left) * pct)), 2)

    # 1a'. Parked caps. SIDECAR parks the cap or overcap beside the glass (kit-frame.ts, 24 px gap); beside the wide
    #      round glass it ran to the stage's edge (the 50 ml overcaps and leather reducer caps). Where glass, gap
    #      and cap leave less than PARK_MARGIN% on the right at the family axis, SIDECAR alone stands the glass left
    #      so the three sit centred; CAP ON keeps the glass centred.
    for sku, kit in rows.items():
        parked = [p for p in kit["parts"] if p["slot"] in ("cap", "overcap") and (not p.get("views") or "sidecar" in p["views"])]
        if not parked:
            continue
        g = kit["glassSizing"]; gb = next(p for p in kit["parts"] if p["slot"] == "body")["bounds"]
        pct = g["heightPct"] / 100 * kit["canvas"]["height"] / (gb["bottom"] - g["landmarkY"]) / kit["canvas"]["width"] * 100
        cap_w = max(((p.get("detached") or p)["bounds"]["right"] - (p.get("detached") or p)["bounds"]["left"]) for p in parked)
        axis_pct = g.get("axisPct", 50); ax = kit["anchors"]["axisX"]
        right = axis_pct + (gb["right"] - ax + 24 + cap_w) * pct
        if right > 100 - PARK_MARGIN:
            left_extent = (ax - gb["left"]) * pct; right_extent = (gb["right"] - ax + 24 + cap_w) * pct
            g["sidecarAxisPct"] = round(max(U.STAGE_MARGIN + left_extent, (100 + left_extent - right_extent) / 2), 2)

    # 1b. Clear lotion overcaps: the empty cover, seated where the photographed cover stands, multiplied.
    for sku, kit in rows.items():
        for part in kit["parts"]:
            look = part.get("detached") or {}
            if part["slot"] != "overcap" or not look.get("image", {}).get("url", "").endswith("-clear-overcap.webp"):
                continue
            m, x, y = U.alpha(part)
            top = y + int(np.argmax(m.any(1)))
            b = {**look["box"], "y": round(float(top), 3)}
            if EMPTY_COVER and look["image"]["url"].endswith("/ltn-18-415-clear-overcap.webp"):
                # The register's empty cover still shows where the pump stood in it (Jordan, 3 Nov 2026: "same ghost
                # issue on the side car"): draw the Sunburst-emptied cover, same frame (empty-lotion-cover.py).
                look = {**look, "image": {**look["image"], "url": EMPTY_COVER}}
            part.update({"image": {**part["image"], **look["image"], "key": "", "sha256": "", "bytes": 0}, "image2x": None, "mask": None,
                         "derivation": "empty-cover-seated", "blendMode": "multiply"})
            boxed(part, b)
            part["detached"] = {**look, "box": dict(b), "bounds": dict(part["bounds"])}

    # 1c. 50 ml droppers: one shared scale (the median seated collar), the complete dropper in EXPLODED.
    droppers = {"Sl": U.complete_dropper("Sl")}
    # One collar size per glass body (bodies differ in px/mm): the median of its dropper kits' seated collars.
    by_body = {}
    for s, k in rows.items():
        if DROPPER.match(s):
            by_body.setdefault(k["register"]["bodyId"], []).append(next(p for p in k["parts"] if p["slot"] == "fitment")["collarWidth"])
    collar_of = {b: sorted(v)[len(v) // 2] for b, v in by_body.items()}
    for sku, kit in rows.items():
        m = DROPPER.match(sku)
        if not m:
            continue
        if m.group(1) not in droppers:
            droppers[m.group(1)] = U.complete_dropper(m.group(1))
        d = droppers[m.group(1)]
        fit = next(p for p in kit["parts"] if p["slot"] == "fitment")
        pipette = next(p for p in kit["parts"] if p["slot"] == "pipette")
        body = next(p for p in kit["parts"] if p["slot"] == "body")
        if kit["register"]["glass"] == "Frosted":
            pipette["zOrder"] = body["zOrder"] - 0.5
        for p in (fit, pipette):
            p["views"] = ["sidecar", "capon"]
        axis = kit["register"]["datum"]["axisX"]
        s_ = collar_of[kit["register"]["bodyId"]] / droppers["Sl"]["collarWidth"]
        box = {"x": round(axis - d["collarCentre"] * s_, 3), "y": round(fit["seatBottomY"] - d["collarBottom"] * s_, 3),
               "width": round(d["image"]["width"] * s_, 3), "height": round(d["image"]["height"] * s_, 3)}
        for half, top_ in (("head", 0), ("pipette", d["collarBottom"])):
            img = d[half]
            whole = {**fit, "image": dict(img), "image2x": None, "mask": None, "views": ["exploded"], "derivation": "psd-layer",
                     "source": d["source"], "zOrder": fit["zOrder"] + (0.1 if half == "head" else 0.05)}
            boxed(whole, {**box, "y": round(box["y"] + top_ * s_, 3), "height": round(img["height"] * s_, 3)})
            for k_ in ("seatBottomY", "collarWidth", "blendMode"):
                whole.pop(k_, None)
            if half == "pipette":
                whole["blendMode"] = "multiply"
                if kit["register"]["glass"] == "Frosted":
                    # Jordan (3 Nov 2026): show the pipette through the frost. Frosted glass scatters what stands
                    # inside it: the same glass pipette, blurred and lifted toward white (frosted_pipette), multiplied
                    # over the body, reads as a soft shape behind the frost rather than a silhouette or a sharp tube.
                    seated = {**whole, "slot": "pipette", "views": ["sidecar", "capon"], "zOrder": body["zOrder"] + 0.5,
                              "image": frosted_pipette(img, m.group(1)), "derivation": "frost-diffused"}
                    kit["parts"] = [p for p in kit["parts"] if p is not pipette] + [seated]
                if kit["register"]["glass"] == "Clear":
                    # Jordan (3 Nov 2026): the clear dropper showed no glass dropper; the register pipette lay under the
                    # master glass, whose interior covers it. Seat the same Sunburst glass pipette inside the clear
                    # glass, over the body and multiplied, so it reads through the glass (as Elegant's does).
                    seated = {**whole, "slot": "pipette", "views": ["sidecar", "capon"], "zOrder": body["zOrder"] + 0.5}
                    kit["parts"] = [p for p in kit["parts"] if p is not pipette] + [seated]
            kit["parts"].append(whole)
        # The round glass is too wide for the lifted dropper to stand beside it at the centre axis (the stage
        # then leaves it running off the top): in EXPLODED only, stand the glass left so glass, gap and
        # dropper sit centred together (fixed-stage-placement: 2% margins, a 4% gap).
        g = kit["glassSizing"]; gb = body["bounds"]; ax = kit["anchors"]["axisX"]
        pct = g["heightPct"] / 100 * kit["canvas"]["height"] / (gb["bottom"] - g["landmarkY"]) / kit["canvas"]["width"] * 100
        lifted = [p for p in kit["parts"] if p.get("views") == ["exploded"]]
        dropper_w = max(p["bounds"]["right"] for p in lifted) - min(p["bounds"]["left"] for p in lifted)
        lo, hi = 2 + (ax - gb["left"]) * pct, 100 - 2 - 4 - (gb["right"] - ax + dropper_w) * pct
        g["explodedAxisPct"] = round((lo + hi) / 2, 2)

    # 2. The PSD tube of each size and fitment type.
    tubes = json.load(open(TUBES))
    shared = {}
    for sku, kit in rows.items():
        fit = next((p for p in kit["parts"] if p["slot"] in ("sprayer", "pump")), None)
        old = [p for p in kit["parts"] if p["slot"] == "diptube"]
        if fit is None or not old:
            continue
        seated_tube = next(p for p in old if p.get("views") != ["exploded"])
        url = seated_tube["image"]["url"]
        kind = "lotion" if fit["slot"] == "pump" else "spray" if "-spray." in url else "atomizer"
        size = tube_key(kit)
        t = tubes[f"{size}-{kind}"]
        d = kit["register"]["datum"]; H = d["baselineY"] - d["seatY"]
        sha = hashlib.sha256(open("public" + t["file"], "rb").read()).hexdigest()
        tube = {**seated_tube, "image": {"url": t["file"], "key": "", "sha256": sha, "bytes": os.path.getsize("public" + t["file"]),
                                         "width": t["pixels"][0], "height": t["pixels"][1]},
                "image2x": None, "mask": None, "derivation": f"psd-tube:{kind}", "blendMode": "multiply",
                "explodeIndex": fit.get("explodeIndex", 1), "componentId": fit.get("componentId")}
        if TUBE_ANCHOR == "register":
            # The register tube's place: its top at the pump (moved with the seated head), its foot near the floor.
            b = seated_tube["bounds"]; h = b["bottom"] - b["top"]; w = h * t["pixels"][0] / t["pixels"][1]
            boxed(tube, {"x": round((b["left"] + b["right"]) / 2 - w / 2, 3), "y": round(b["top"] + fit.get("seatDy", 0), 3),
                         "width": round(w, 3), "height": round(h, 3)})
        else:
            boxed(tube, {"x": round(d["axisX"] + t["left"] * H, 3), "y": round(d["seatY"] + t["top"] * H, 3),
                         "width": round(t["width"] * H, 3), "height": round(t["height"] * H, 3)})
        tube.pop("views", None)
        if kit["register"]["glass"] == "Frosted":
            tube["views"] = ["exploded"]
        rest = [p for p in kit["parts"] if p["slot"] != "diptube"]
        kit["parts"] = [p for p in rest if p["slot"] == "body"] + [tube] + [p for p in rest if p["slot"] != "body"]
        reorder(kit)
        shared.setdefault(f"{size}-{kind}", []).append(sku)
    # 3. Cap close-ups: the vintage bulb sprayers are the same 18-415 components as Elegant's, so their swatches
    #    are the Elegant close-ups (cap-close-ups.py, from 20. Caps/9. and 10. 18-415 Ansp [Tsl]).
    caps = "public/local-kits/elegant60-100-masters-2026-11-03/caps"
    looks = {}
    for name in os.listdir(caps):
        m = re.match(r"(AnSpTsl|AnSp)-(\w+)-[0-9a-f]{12}\.png$", name)
        if m:
            looks[(m.group(1), m.group(2))] = "/" + f"{caps}/{name}".removeprefix("public/")
    mapped = json.load(open(CLOSE_UPS))
    for sku, kit in rows.items():
        m = BULB.match(sku)
        if m and (m.group(1), m.group(2)) in looks:
            kit["capCloseUp"] = {"url": looks[(m.group(1), m.group(2))], "width": 512, "height": 512}
            mapped[sku] = kit["capCloseUp"]["url"]
    open(CLOSE_UPS, "w").write(json.dumps(dict(sorted(mapped.items())), indent=1) + "\n")
    print(sum("capCloseUp" in k for k in rows.values()), "bulb kits carry a cap close-up")

    kits["universalDipTube"] ={key: {"url": tubes[key]["file"], "psd": tubes[key]["psd"], "skus": sorted(skus)} for key, skus in shared.items()}
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    for key, skus in sorted(shared.items()):
        print(key, "tube shared by", len(skus), "kits")
    print("version", kits["version"])


if __name__ == "__main__":
    main()
