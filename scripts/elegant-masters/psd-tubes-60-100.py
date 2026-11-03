"""Regenerate the 60/100 ml Elegant dip tubes from the original Photoshop sources.

Jordan (3 Nov 2026): the dip tubes in the Elegant 60 ml and 100 ml PSDs are the right ones, as the
example for the spray pump and the lotion pump; regenerate them so they are the correct size.

Each size has three tube layers in its capped PSDs: the fine-mist sprayer's (pump body and tube),
the lotion pump's (clear pump cylinder and a thicker tube) and the bulb atomizer's (a plain tube).
The PSD fixes the shape and, through the bottle layer in the same file, the size and position: the
tube's box is recorded as fractions of the bottle's neck-top-to-foot height from the neck top and
the bottle's axis. Sunburst (gpt-image-2.5-sunburst) then redraws each layer's material after the
approved 9 ml Cylinder tube (clear, slightly translucent polyethylene, soft grey walls, no flat white),
with the PSD layer as the locked geometry. The output is registered uniformly onto the layer's
outline (height-led scale and centring, never stretched) and cut with the PSD layer's own alpha.

Writes public/local-kits/elegant60-100-masters-2026-11-03/tubes/<size>-<kind>.<sha>.png and tubes.json.
Usage: python3 scripts/elegant-masters/psd-tubes-60-100.py <work-dir> [--prepare]
"""
import base64, concurrent.futures, hashlib, io, json, os, sys, time, urllib.error, urllib.request, uuid
import numpy as np
from PIL import Image, ImageFilter
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles"
OUT = "public/local-kits/elegant60-100-masters-2026-11-03/tubes"
MATERIAL = "public/local-kits/cylinder9-masters-2026-11-01/tube-fitted.f5a5592f59a0.png"
BONE = (245, 243, 239)
# (size, kind): (PSD, bottle layer, tube layer)
SOURCES = {
    ("60", "spray"): ("17. Elegant 60ml/1. Elegant 60ml PSD/17. GBElg60SpryShnGl.psd", "Layer 16", "Layer 17"),
    ("60", "lotion"): ("17. Elegant 60ml/1. Elegant 60ml PSD/12. LBElg60LtnMtGl.psd", "Layer 14", "Layer 12"),
    ("60", "atomizer"): ("17. Elegant 60ml/1. Elegant 60ml PSD/39. GBElg60AnSpBlk.psd", "Layer 14", "Layer 15"),
    ("100", "spray"): ("18. Elegant 100ml/1. Elegant 100ml PSD/55. GBElg100SpryCu.psd", "Layer 27", "Layer 19 copy"),
    ("100", "lotion"): ("18. Elegant 100ml/1. Elegant 100ml PSD/58. LBElg100LtnCu.psd", "Layer 29", "Layer 24"),
    ("100", "atomizer"): ("18. Elegant 100ml/1. Elegant 100ml PSD/39. GBElg100AnSpBlk.psd", "Layer 12", "Layer 13"),
}
TOP = {
    "spray": "the fine-mist pump's body at the top: a slightly translucent milky-white polypropylene housing with soft grey edges, the same outline",
    "lotion": "the lotion pump's clear plastic cylinder at the top, kept clear and glassy with its ribs and inner detail, the same outline",
    "atomizer": "no pump body: the tube runs straight to its cut top end",
}
PROMPT = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same dip tube path, curve, thickness, length and end, and {top}, at the same position and size in the frame. Do not redraw the shape, straighten it or move it.
2. Material of the tube from the second image: a clear, slightly translucent polyethylene dip tube, cool light grey walls with a bright soft core and thin darker edges, so it reads as translucent. Natural, not flat bright white, no glow.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no glass bottle, no liquid, no props, no text."""


def key():
    for name in ("SUNBURST_OPENAI_API_KEY", "OPENAI_API_KEY"):
        k = os.environ.get(name)
        if not k:
            for line in open(".env.local"):
                if line.startswith(f"{name}="):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'")
        if k:
            return k


def edit(images, prompt, out):
    b = uuid.uuid4().hex; body = b""
    for k, v in {"model": "gpt-image-2.5-sunburst", "prompt": prompt, "size": "1024x1536", "quality": "high", "n": "1"}.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for path in images:
        body += (f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n').encode() + open(path, "rb").read() + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body, headers={"Authorization": f"Bearer {key()}", "Content-Type": f"multipart/form-data; boundary={b}"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            detail = e.read()[:400].decode(errors="replace")
            if e.code != 429 or "insufficient_quota" in detail or attempt == 3:
                raise SystemExit(f"Sunburst request failed for {out}: HTTP {e.code} {detail}")
            time.sleep(30 * (attempt + 1))
    open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"]))


ATOMIZER_TONE = 0.5      # how much of the spray tube's grey the plain atomizer tube keeps
GREY = (150, 150, 150)   # the geometry reference's ground: a white tube on bone is nearly invisible


def framed(img, fill=0.88, ground=BONE):
    """The layer centred in a 2:3 frame, its height `fill` of the frame."""
    W = max(round(img.height / fill / 1.5), round(img.width / fill)); H = round(W * 1.5)   # wide layers too
    canvas = Image.new("RGBA", (W, H), ground + (255,))
    canvas.alpha_composite(img, ((W - img.width) // 2, (H - img.height) // 2))
    return canvas.convert("RGB")


def register(raw, layer):
    """Scale and centre the output's outline onto the layer's (height-led), cut with the layer's alpha."""
    a = np.asarray(raw.convert("RGB")).astype(int)
    bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:20, :20], a[:20, -20:], a[-20:, :20], a[-20:, -20:])]), 0)
    got = np.abs(a - bg).max(axis=2) > 6
    target = np.asarray(layer)[..., 3] > 40
    (gy, gx), (ty, tx) = np.where(got), np.where(target)
    s = (ty.max() - ty.min()) / (gy.max() - gy.min())
    scaled = raw.convert("RGB").resize((round(raw.width * s), round(raw.height * s)), Image.LANCZOS)
    dx = round((tx.min() + tx.max()) / 2 - (gx.min() + gx.max()) / 2 * s); dy = round(ty.min() - gy.min() * s)
    aligned = Image.new("RGB", layer.size, tuple(int(v) for v in bg)); aligned.paste(scaled, (dx, dy))
    g = np.zeros(target.shape, bool)
    sm = np.asarray(Image.fromarray(got).resize(scaled.size, Image.NEAREST))
    y0, x0 = max(dy, 0), max(dx, 0); y1, x1 = min(dy + sm.shape[0], g.shape[0]), min(dx + sm.shape[1], g.shape[1])
    g[y0:y1, x0:x1] = sm[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    iou = (g & target).sum() / max(1, (g | target).sum())
    # Thin tubes drift a few px from the layer, so the PSD alpha would leave slivers of ground inside
    # it: keep the output's own outline, filled across each row (the core is near the ground colour).
    fill = np.zeros_like(g)
    for y in np.where(g.any(1))[0]:
        xs = np.where(g[y])[0]; fill[y, xs.min():xs.max() + 1] = True
    out = aligned.convert("RGBA"); out.putalpha(Image.fromarray((fill * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
    return out, {"registeredOutlineIoU": round(float(iou), 4), "scale": round(float(s), 4), "shift": [dx, dy]}


def swept(layer, source):
    """A plain tube along the layer's own centre line and width, in the material of `source`'s straight run."""
    a = np.asarray(source); m = a[..., 3] > 128
    rows = [y for y in range(int(len(m) * 0.4), int(len(m) * 0.8)) if m[y].any()]
    profile = np.mean([np.stack([np.interp(np.linspace(xs.min(), xs.max(), 64), np.arange(a.shape[1]), a[y, :, c]) for c in range(3)], 1)
                       for y in rows for xs in [np.where(m[y])[0]]], 0)                     # 64 samples across the tube, RGB
    # Spread across the atomizer's wider tube, the spray tube's walls read as a grey band, heavier than the
    # PSD's faint tube (Jordan, 3 Nov 2026): keep the walls' shape, lift the tone toward white (it multiplies).
    profile = 255 - (255 - profile) * ATOMIZER_TONE
    t = np.asarray(layer)[..., 3] > 40
    ys = np.where(t.any(1))[0]
    left = np.array([np.where(t[y])[0].min() for y in ys], float); right = np.array([np.where(t[y])[0].max() + 1 for y in ys], float)
    k = np.ones(15) / 15                     # the PSD outline steps a pixel row to row: smooth it, or the sweep bands
    pad = lambda v: np.convolve(np.pad(v, 7, mode="edge"), k, mode="valid")
    left, right = pad(left), pad(right)
    out = np.zeros((*t.shape, 4), np.float32)
    x = np.arange(t.shape[1], dtype=float) + 0.5
    for y, l, r in zip(ys, left, right):
        u = (x - l) / (r - l)
        inside = (u > -0.05) & (u < 1.05)
        out[y, inside, :3] = np.stack([np.interp(np.clip(u[inside], 0, 1) * 63, np.arange(64), profile[:, c]) for c in range(3)], 1)
        out[y, :, 3] = np.clip(np.minimum(x - l + 0.5, r - x + 0.5), 0, 1) * 255   # sub-pixel edge coverage
    return Image.fromarray(out.astype(np.uint8))


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    cyl = Image.open(MATERIAL).convert("RGBA")
    w = (np.asarray(cyl)[..., 3] > 30).sum(1); run = np.median(w[len(w) // 2:][w[len(w) // 2:] > 0])
    collar_end = int(np.where(w[: len(w) // 3] > run * 1.8)[0].max()) + 6   # the tube only, not the Cylinder collar piece
    material = framed(cyl.crop((0, collar_end, cyl.width, cyl.height)))
    material.save(f"{work}/material.png")
    layers, geometry = {}, {}
    for (size, kind), (psd, bottle_name, tube_name) in SOURCES.items():
        p = PSDImage.open(f"{ROOT}/{psd}"); named = {l.name: l for l in p.descendants()}
        bottle, tube = named[bottle_name], named[tube_name]
        bi, ti = bottle.composite(), tube.composite()
        bb, tb = bi.getchannel("A").getbbox(), ti.getchannel("A").getbbox()
        ti = ti.crop(tb)
        top, foot = bottle.bbox[1] + bb[1], bottle.bbox[1] + bb[3]
        axis = bottle.bbox[0] + (bb[0] + bb[2]) / 2
        h = foot - top
        x0, y0 = tube.bbox[0] + tb[0], tube.bbox[1] + tb[1]
        geometry[f"{size}-{kind}"] = {"psd": psd, "layer": tube_name,
                                      "left": (x0 - axis) / h, "top": (y0 - top) / h, "width": ti.width / h, "height": ti.height / h}
        layers[(size, kind)] = ti
        ti.save(f"{work}/{size}-{kind}.layer.png")
        framed(ti, ground=GREY).save(f"{work}/{size}-{kind}.geometry.png")
    if "--prepare" in sys.argv:
        print(json.dumps(geometry, indent=1)); return

    def run(item):
        (size, kind), layer = item
        raw = f"{work}/{size}-{kind}.raw.png"
        if not os.path.exists(raw):
            edit([f"{work}/{size}-{kind}.geometry.png", f"{work}/material.png"], PROMPT.format(top=TOP[kind]), raw)
        return (size, kind), raw
    with concurrent.futures.ThreadPoolExecutor(3) as pool:
        raws = dict(pool.map(run, layers.items()))
    report, cuts = {}, {}
    for (size, kind), layer in sorted(layers.items(), key=lambda item: item[0][1] == "atomizer"):
        # The framed geometry image: undo the frame before registering, so the output maps onto the layer.
        fr = framed(layer); raw = Image.open(raws[(size, kind)]).resize(fr.size, Image.LANCZOS)
        ox, oy = (fr.width - layer.width) // 2, (fr.height - layer.height) // 2
        pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(layer, (ox, oy))
        cut, rep = register(raw, pad)
        cut = cut.crop((ox, oy, ox + layer.width, oy + layer.height))
        if kind == "atomizer":
            # Sunburst straightened the plain tube (centre line off by up to 49 px): draw it on the PSD's own
            # path and width instead, in the material of the same size's regenerated spray tube.
            cut, rep = swept(layer, cuts[(size, "spray")]), {"swept": f"{size}-spray material along the PSD centre line"}
        cuts[(size, kind)] = cut
        buf = io.BytesIO(); cut.save(buf, "PNG", optimize=True)
        path = f"{OUT}/{size}-{kind}.{hashlib.sha256(buf.getvalue()).hexdigest()[:12]}.png"   # content-named: no stale cache
        for old in os.listdir(OUT):
            if old.startswith(f"{size}-{kind}.") and old.endswith(".png"):
                os.remove(f"{OUT}/{old}")
        open(path, "wb").write(buf.getvalue())
        report[f"{size}-{kind}"] = {**geometry[f"{size}-{kind}"], **rep, "file": "/" + path.removeprefix("public/"), "pixels": [cut.width, cut.height]}
        print(size, kind, rep)
    json.dump(report, open(f"{OUT}/tubes.json", "w"), indent=1)


if __name__ == "__main__":
    main()
