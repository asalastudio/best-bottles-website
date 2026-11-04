"""Diva's own dip tubes for the EXPLODED view, drawn with Sunburst (gpt-image-2.5-sunburst).

Jordan (3 Nov 2026): the Diva dip tubes "need to be further corrected ... the whole entire DipTube experience on Diva
need[s] to be improved". No Diva PSD has a tube (325 files), so seat-and-tubes.py lifted in the Round 78 ml tubes,
fitted to the register tube's place: curved for the Round glass, so in EXPLODED they swung sideways, joined the head
off its axis, ran past Diva's foot and read pale. Here each fitment's tube is:
- drawn with Sunburst from the Round tube straightened (its own fitting kept at the top), as a crisp clear
  polyethylene tube in the approved tube material; the atomizer tube is the same run without a fitting;
- hung from the centre of Diva's own collar (the PSD head's foot), its fitting tucked under the collar;
- cut to Diva's depth: its foot on the bowl's floor (the glass's waist above the pedestal), its run TUBE_MM[kind] wide (2 mm for the sprayers, 3 mm for the lotion pump).
It stays EXPLODED only (not seen through the glass). Run after seat-and-tubes.py.
Usage: python3 scripts/diva-vial/diva-exploded-tubes.py <work-dir>
"""
import concurrent.futures, hashlib, importlib.util, io, json, os, sys, urllib.request
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

KITS = "public/local-kits/diva-masters-2026-11-03/kits.json"
OUT = "public/local-kits/diva-masters-2026-11-03/exploded-tubes"
ROUND = "public/local-kits/round-sleek-masters-2026-11-03/tubes/tubes.json"
TUBE_MM = {"spray": 2.0, "atomizer": 2.0, "lotion": 3.0}   # the run's outer width (Jordan 4 Nov: 3 mm spray tubes "too thick")
FLOOR_MM = 1.5           # the foot stands this far above the waist (the bowl's glass floor)
BEND_MM = 2.5            # a real tube keeps a slight curve from its coil: the foot swings this far off the axis
TUCK = 0.4               # how much of the fitting sits up inside the collar
PROMPT = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same straight vertical dip tube, its thickness, length and cut end, and {top}, at the same position and size in the frame. Keep it perfectly straight and vertical. Do not bend, move or resize it.
2. Material of the tube from the second image: a clear, slightly translucent polyethylene dip tube, cool light grey walls with a bright soft core and crisp thin darker edges on both sides, so it reads clearly as a real translucent tube. Natural, not flat bright white, no glow.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no glass bottle, no liquid, no props, no text."""
TOP = {
    "spray": "the fine-mist pump's small clear plastic body at the top of the tube, the same outline",
    "lotion": "the lotion pump's narrow clear plastic cylinder at the top, the same outline",
}


def straightened(img):
    """Every row shifted so its centre sits on one vertical line (the photographed texture kept)."""
    a = np.asarray(img); rows = [np.where(r[:, 3] > 30)[0] for r in a]
    half = max((r.max() - r.min() + 1) for r in rows if len(r)) // 2 + 2
    out = np.zeros((a.shape[0], 2 * half, 4), np.uint8)
    for y, r in enumerate(rows):
        if len(r):
            c = (r.min() + r.max() + 1) // 2; lo = max(0, c - half); hi = min(a.shape[1], c + half)
            out[y, half - (c - lo):half + (hi - c)] = a[y, lo:hi]
    im = Image.fromarray(out); return im.crop(im.getchannel("A").getbbox())


def anatomy(tube):
    """(fitting end row, run width in px) of a straight tube image: the fitting is where it is >1.4x the run."""
    w = (np.asarray(tube)[..., 3] > 60).sum(1); run = float(np.median(w[len(w) // 3: 2 * len(w) // 3]))
    wide = np.where(w[: len(w) // 3] > 1.4 * run)[0]
    return (int(wide.max()) + 1 if len(wide) else 0), run


def fitted(tube, kind_top, length, scale):
    """The tube at `scale`, its straight run resampled so the whole is `length` px; the fitting and cut end kept."""
    t = tube.resize((max(1, round(tube.width * scale)), max(1, round(tube.height * scale))), Image.LANCZOS)
    head = round(kind_top * scale); end = max(4, round(0.03 * t.height))
    run = t.crop((0, head, t.width, t.height - end)); need = max(8, round(length) - head - end)
    out = Image.new("RGBA", (t.width, head + need + end), (0, 0, 0, 0))
    out.paste(t.crop((0, 0, t.width, head)), (0, 0))
    out.paste(run.resize((t.width, need), Image.LANCZOS), (0, head))
    out.paste(t.crop((0, t.height - end, t.width, t.height)), (0, head + need))
    return out


def bent(tube, head, amp):
    """The run below `head` bowed sideways: straight where it leaves the fitting, its foot `amp` px off the axis
    (a smooth t^1.8 curve, sub-pixel per row). Padded equally both sides so the fitting stays centred in the image."""
    a = np.asarray(tube).astype(np.float32); h, w = a.shape[:2]; pad = int(np.ceil(amp)) + 2
    out = np.zeros((h, w + 2 * pad, 4), np.float32); out[:, pad:pad + w] = a
    for y in range(head, h):
        t = (y - head) / max(1, h - 1 - head); dx = amp * t ** 1.8; i = int(np.floor(dx)); f = dx - i
        row = np.zeros((w + 2 * pad, 4), np.float32); row[pad:pad + w] = a[y]
        out[y] = (1 - f) * np.roll(row, i, 0) + f * np.roll(row, i + 1, 0)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))


def prune(folder, rows):
    """Remove only the files in `folder` that no row references any more (after the rows are built, so a failed run
    leaves the committed manifest's files in place)."""
    keep = {p["image"]["url"].rsplit("/", 1)[1] for kit in rows.values() for p in kit["parts"]
            if isinstance(p.get("image"), dict) and p["image"].get("url", "").startswith("/" + folder.removeprefix("public/") + "/")}
    for old in os.listdir(folder):
        if old not in keep:
            os.remove(f"{folder}/{old}")


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); path = f"{OUT}/{name}.{sha[:12]}.png"
    open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "key": "", "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def load(url):
    return Image.open(io.BytesIO(urllib.request.urlopen(url).read()) if url.startswith("http") else "public" + url).convert("RGBA")


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    # 1. One Sunburst tube per fitment, from the Round tube straightened.
    rnd = json.load(open(ROUND)); geo = {}
    for kind in ("spray", "lotion"):
        g = straightened(Image.open("public" + rnd[f"round78-{kind}"]["file"]).convert("RGBA"))
        g.save(f"{work}/{kind}.layer.png"); E.framed(g, ground=E.GREY).save(f"{work}/{kind}.geometry.png"); geo[kind] = g
    cyl = Image.open(E.MATERIAL).convert("RGBA")
    E.framed(cyl.crop((0, cyl.height // 4, cyl.width, cyl.height))).save(f"{work}/material.png")

    def run(kind):
        raw = f"{work}/{kind}.raw.png"
        if not os.path.exists(raw):
            E.edit([f"{work}/{kind}.geometry.png", f"{work}/material.png"], PROMPT.format(top=TOP[kind]), raw)
        return kind, raw
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        raws = dict(pool.map(run, geo))
    tubes = {}
    for kind, layer in geo.items():
        fr = E.framed(layer); raw = Image.open(raws[kind]).resize(fr.size, Image.LANCZOS)
        ox, oy = (fr.width - layer.width) // 2, (fr.height - layer.height) // 2
        pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(layer, (ox, oy))
        cut, rep = E.register(raw, pad); tubes[kind] = cut.crop((ox, oy, ox + layer.width, oy + layer.height))
        print(kind, rep)
    top, _ = anatomy(tubes["spray"])
    tubes["atomizer"] = tubes["spray"].crop((0, top, tubes["spray"].width, tubes["spray"].height))   # no fitting
    for kind, t in tubes.items():
        t.save(f"{work}/{kind}.tube.png")

    # 2. Each Diva kit's exploded tube: hung from its collar, cut to its bowl's floor.
    kits = json.load(open(KITS)); floors = {}; made = {}; n = 0
    for sku, kit in kits["rows"].items():
        tube = next((p for p in kit["parts"] if p["slot"] == "diptube"), None)
        head = next((p for p in kit["parts"] if p["slot"] in ("sprayer", "pump")), None)
        if tube is None or head is None:
            continue
        kind = tube["derivation"].split(":")[-1]
        body = next(p for p in kit["parts"] if p["slot"] == "body"); bx = body["box"]
        if body["image"]["url"] not in floors:
            a = np.asarray(load(body["image"]["url"]))[..., 3] > 60; w = a.sum(1); ys = np.where(w > 0)[0]
            lo, hi = int(ys.min() + 0.6 * (ys.max() - ys.min())), int(ys.min() + 0.95 * (ys.max() - ys.min()))
            floors[body["image"]["url"]] = (lo + int(np.argmin(w[lo:hi]))) / len(w)
        ppm = kit["anchors"]["pxPerMm"]
        floor = bx["y"] + floors[body["image"]["url"]] * bx["height"] - FLOOR_MM * ppm
        # The collar: the head's widest band in its lower part; its foot and centre.
        h = np.asarray(load(head["image"]["url"]))[..., 3] > 60; hw = h.sum(1)
        low = np.arange(len(hw) // 2, len(hw)); band = low[hw[low] >= 0.85 * hw[low].max()] if kind != "atomizer" else low[hw[low] > 0]
        foot = int(band.max()) + 1; xs = np.where(h[band].any(0))[0]
        sx, sy = head["box"]["width"] / h.shape[1], head["box"]["height"] / h.shape[0]
        collar_foot = head["box"]["y"] + foot * sy; axis = head["box"]["x"] + (xs.min() + xs.max() + 1) / 2 * sx
        t = tubes[kind]; fit_top, run_w = anatomy(t)
        scale = TUBE_MM[kind] * ppm / run_w
        y0 = collar_foot - TUCK * fit_top * scale
        key = (kind, round(scale, 4), round(floor - y0))
        if key not in made:
            made[key] = save(bent(fitted(t, fit_top, floor - y0, scale), round(fit_top * scale), BEND_MM * ppm), f"diva-{kind}-{key[2]}")
        img = made[key]
        box = {"x": round(axis - img["width"] / 2, 3), "y": round(y0, 3), "width": img["width"], "height": img["height"]}
        tube.update({"image": img, "image2x": None, "mask": None, "box": box, "derivation": f"sunburst-diva-tube:{kind}",
                     "bounds": {"left": box["x"], "top": box["y"], "right": round(box["x"] + box["width"], 3), "bottom": round(box["y"] + box["height"], 3)},
                     "views": ["exploded"], "zOrder": head["zOrder"] - 0.05})
        tube.pop("blendMode", None)
        n += 1
    prune(OUT, kits["rows"])
    kits["universalDipTube"] = {}
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    print(n, "Diva exploded tubes,", len(made), "files; version", kits["version"])


if __name__ == "__main__":
    main()
