"""Empire, Grace and Diamond's own sprayer and lotion pump heads and overcaps, from the master library PSDs: Diva's
treatment (scripts/diva-vial/diva-psd-heads.py, approved 3 Nov 2026). The register draws the generic 18-415 sprayer and
pump, whose long collar is made for long-necked bottles and stands too tall on these short necks. Every spray and lotion
SKU has a "parked" PSD in the master library (2. 18-415 Bottles / 21. Empire 50ml, 22. Empire Bottle 100ml,
28. Diamond 60ml, 29. Grace 55 ml): the bottle, the head on its neck and the overcap standing beside it. Each kit takes
that head and overcap, placed by the PSD's own bottle (neck top on the stage seat, foot on the baseline, centred).
SKUs without a parked PSD keep the register's parts. Run after build-kits.mts, before tubes.py and seat-and-tubes.py.
Usage: python3 scripts/empire-grace-diamond/psd-heads.py
"""
import glob, importlib.util, os

spec = importlib.util.spec_from_file_location("diva_heads", "scripts/diva-vial/diva-psd-heads.py")
D = importlib.util.module_from_spec(spec); spec.loader.exec_module(D)
D.KITS = "public/local-kits/egd-masters-2026-11-04/kits.json"
D.OUT = "public/local-kits/egd-masters-2026-11-04/heads"
FOLDERS = ["21. Empire 50ml", "22. Empire Bottle 100ml", "28. Diamond 60ml", "29. Grace 55 ml"]
_glob = glob.glob


def family_glob(pattern, recursive=False):
    # diva-psd-heads.main() globs its own Diva folders; point that one call at these families' folders.
    if "Diva*" in pattern:
        return [f for folder in FOLDERS for f in _glob(f"{D.ROOT}/{folder}/**/*.psd", recursive=True)]
    return _glob(pattern, recursive=recursive)


D.glob.glob = family_glob


def parked(sku, psds):
    """As diva-psd-heads.parked, for these PSDs: besides the bottle, the head and the parked overcap they carry the dip
    tube (a tall narrow layer running past the canvas foot, sometimes twice) and some heads in two layers (actuator and
    collar). The tube layers are left out (the kits keep the Round tube, EXPLODED only, as Diva); head layers are merged."""
    from PIL import Image
    for f in psds.get(sku, []):
        p = D.PSDImage.open(f)
        layers, seen = [], set()
        for l in p.descendants():   # a layer duplicated exactly (same box) counts once
            if l.kind == "pixel" and l.visible and l.bbox[2] - l.bbox[0] < p.width * 0.95 and tuple(l.bbox) not in seen:
                seen.add(tuple(l.bbox)); layers.append(l)
        if len(layers) < 3:
            continue
        bottle = max(layers, key=lambda l: (min(l.bbox[2], p.width) - max(l.bbox[0], 0)) * (min(l.bbox[3], p.height) - max(l.bbox[1], 0)))
        cx = (bottle.bbox[0] + bottle.bbox[2]) / 2; bw = bottle.bbox[2] - bottle.bbox[0]
        # A tube: narrow, starting inside the bottle, reaching its lower part (a lotion tube stops short of the foot),
        # across the bottle's axis.
        bh = bottle.bbox[3] - bottle.bbox[1]
        tubes = [l for l in layers if l is not bottle and l.bbox[2] - l.bbox[0] < 0.5 * bw and l.bbox[1] > bottle.bbox[1]
                 and l.bbox[3] > bottle.bbox[1] + 0.6 * bh and l.bbox[0] < cx < l.bbox[2]]
        rest = [l for l in layers if l not in tubes]
        cover = next((l for l in rest if l is not bottle and l.bbox[0] > cx and l.bbox[3] > bottle.bbox[3] - 100), None)
        heads = [l for l in rest if l not in (bottle, cover) and l.bbox[1] < bottle.bbox[1]]
        if cover is None or not heads or len(heads) + 2 != len(rest):
            continue
        b_img, bb = D.piece(bottle, p.size); c_img, cb = D.piece(cover, p.size)
        canvas = Image.new("RGBA", p.size, (0, 0, 0, 0))
        for l in heads:
            canvas.alpha_composite(l.composite().convert("RGBA"), (max(0, l.bbox[0]), max(0, l.bbox[1])))
        hb = canvas.getchannel("A").getbbox(); h_img = canvas.crop(hb)
        MATCHED.append(sku)
        return bb, h_img, hb, c_img, cb, os.path.basename(f)
    return None


MATCHED = []
D.parked = parked

def white_pumps():
    """The two Empire white-pump clear-overcap lotions: their PSDs show the bottle capped (56. / 51.) and uncapped
    (57. / 52.), with no overcap parked beside it. The head is the uncapped file's pump; the cover stays the clear
    overcap of the kit's twin (LBEmp{50,100}LtnClOvrCap, the same clear 18-415 cover), seated over the new head."""
    import hashlib, json
    from PIL import Image
    files = {"LBEmp50WhtClOvrCp": "21. Empire 50ml/1. Empire 50ml PSD/57. LBEmp50WhtClOvrCp.psd",
             "LBEmp100WhtClOvrCp": "22. Empire Bottle 100ml/1. Empire 100ml PSD/52. LBEmp100WhtClOvrCp.psd"}
    kits = json.load(open(D.KITS)); rows = kits["rows"]
    for sku, rel in files.items():
        kit = rows.get(sku)
        if not kit:
            continue
        p = D.PSDImage.open(f"{D.ROOT}/{rel}")
        layers = [l for l in p.descendants() if l.kind == "pixel" and l.visible and l.bbox[2] - l.bbox[0] < p.width * 0.95]
        bottle = max(layers, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]))
        heads = [l for l in layers if l.bbox[1] < bottle.bbox[1]]
        assert len(heads) == 1, (sku, [l.bbox for l in layers])
        _, bb = D.piece(bottle, p.size); h_img, hb = D.piece(heads[0], p.size)
        top, foot, axis = bb[1], bb[3], (bb[0] + bb[2]) / 2
        d = kit["register"]["datum"]; s = (d["baselineY"] - d["seatY"]) / (foot - top)
        hbox = {"x": round(d["axisX"] + (hb[0] - axis) * s, 3), "y": round(d["seatY"] + (hb[1] - top) * s, 3),
                "width": round(h_img.width * s, 3), "height": round(h_img.height * s, 3)}
        head = next(q for q in kit["parts"] if q["slot"] in ("sprayer", "pump"))
        cover = next(q for q in kit["parts"] if q["slot"] == "overcap")
        cw, ch = cover["box"]["width"], cover["box"]["height"]
        cbox = {"x": round(hbox["x"] + hbox["width"] / 2 - cw / 2, 3), "y": round(hbox["y"] + hbox["height"] - ch, 3), "width": cw, "height": ch}
        for part, box in ((head, hbox), (cover, cbox)):
            part.update({"box": box, "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)}})
        head.update({"image": D.save(h_img, f"{sku}-head"), "image2x": None, "mask": None, "derivation": "psd-layer", "source": f"{rel.rsplit('/', 1)[-1]} (head)"})
        MATCHED.append(sku)
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(D.KITS, "w").write(json.dumps(kits, indent=1) + "\n")


def clear_covers():
    """A clear lotion overcap covers only the actuator: it rests on the step at the top of the pump's collar, not on the
    collar's foot (Diva's rule, right for the opaque overcaps). Each clear-cover kit puts its cover's top where the
    SKU's capped PSD has it (the covered stack's top, relative to the bottle's top, at the PSD's own scale)."""
    import hashlib, json
    psds = {}
    for f in family_glob("Diva*"):
        psds.setdefault(os.path.basename(f).split(". ", 1)[-1].strip().removesuffix(".psd").rstrip("."), []).append(f)
    kits = json.load(open(D.KITS)); rows = kits["rows"]; moved = []
    for sku, kit in rows.items():
        if "ClOvr" not in sku:
            continue
        cover = next((q for q in kit["parts"] if q["slot"] == "overcap"), None)
        if cover is None:
            continue
        for f in psds.get(sku, []):
            p = D.PSDImage.open(f)
            layers = [l for l in p.descendants() if l.kind == "pixel" and l.visible and l.bbox[2] - l.bbox[0] < p.width * 0.95]
            bottle = max(layers, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]))
            above = [l for l in layers if l.bbox[1] < bottle.bbox[1]]
            parked = [l for l in layers if l.bbox[0] > (bottle.bbox[0] + bottle.bbox[2]) / 2 and l.bbox[1] > bottle.bbox[1]]
            if len(above) != 1 or parked:
                continue                                   # not the capped photograph
            d = kit["register"]["datum"]; sc = (d["baselineY"] - d["seatY"]) / (bottle.bbox[3] - bottle.bbox[1])
            y = round(d["seatY"] + (above[0].bbox[1] - bottle.bbox[1]) * sc, 3)
            cover["box"] = {**cover["box"], "y": y}
            cover["bounds"] = {**cover["bounds"], "top": y, "bottom": round(y + cover["box"]["height"], 3)}
            cover["source"] = cover.get("source", "") + f"; top from {os.path.basename(f)} (capped)"
            moved.append(sku); break
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(D.KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print("clear covers placed from the capped photograph:", len(moved), sorted(moved))


if __name__ == "__main__":
    D.main()
    white_pumps()
    clear_covers()
    import json
    rows = json.load(open(D.KITS))["rows"]
    heads = [s for s, k in rows.items() if any(p["slot"] in ("sprayer", "pump") for p in k["parts"]) and any(p["slot"] == "overcap" for p in k["parts"])]
    print("own PSD head:", len(MATCHED), "of", len(heads), "; register head kept:", sorted(set(heads) - set(MATCHED)))
