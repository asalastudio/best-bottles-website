"""Render catalog heroes for SKUs the 30 Oct 2026 image audit found with no usable image.

Every hero is a flattened master PSD (no generation, no retouching) on the bone
plate, 1560 x 1716, #F5F3EF, framed by the rule its group already uses:

- tassel   Circle 50 ml frosted vintage-bulb bottles. Source: 21. Tassels/Updated
           Tassels, the folder batch 3 used for the approved black-tassel sibling
           (docs/hero-families/batch3-2026-09-25/approval.json). Batch 3's sizing:
           1.13908 canvas px per PSD px at 2080 wide (x0.75 here), glass foot (the
           1001 x 1180 frosted bottle layer's bottom less 9 px) on the 91% baseline,
           artwork centred on x=780. GBCrclFrst50AnSpTslGl has no frosted file in that
           folder, so its gold sprayer layer comes from the clear 50 ml gold file and
           sits on the frosted bottle of the ivory/gold file, seated by aligning the
           two identical collars (right edge and collar foot). The dip tube, a separate
           sharp layer behind the frosted bottle, is diffused as frosted glass would
           scatter it (see frosted_tube).
- elegant  Elegant 100 ml frosted: glass shoulder-to-foot span 57% of the height, foot
           on 91% (docs/hero-families/elegant-2026-09-23/README.md), centred.
- component caps: product scaled to fit 1240 x 1280, lowest pixel on y=1561, centred
           on x=780. Reproduces the approved CP13-415WhtSht hero to a mean of 0.6/255.

Usage: python3 scripts/hero-families/psd-gap-heroes-2026-10-30.py <out-dir>
Reads PSDs from $BB_PSD_MASTER_ROOT (default: the shared BB-PSD-Files-Master link).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from psd_tools import PSDImage

ROOT = os.environ.get("BB_PSD_MASTER_ROOT", "/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master")
W, H, BONE, BASE_Y, CX = 1560, 1716, (245, 243, 239), 0.91 * 1716, 780
TASSEL_SCALE = 1.13908 * 0.75
UPDATED = "21. Tassels/Updated Tassels"

def layers(psd):
    return [l for l in psd if l.name != "Background" and l.visible]

def flatten(psd, swap=None):
    """Composite visible layers bottom to top at their true offsets. swap: {layer name: (image, left, top)}."""
    canvas = Image.new("RGBA", psd.size, (0, 0, 0, 0))
    for l in layers(psd):
        if swap and l.name in swap:
            im, left, top = swap[l.name]
        else:
            im, left, top = l.composite().convert("RGBA"), l.left, l.top
        canvas.alpha_composite(im, dest=(left, top))
    return canvas

def place(rgba, scale, anchor_y_src, anchor_y_dst, center_x_src):
    # Resize premultiplied and composite with true alpha. An earlier version pasted
    # through the alpha mask onto a transparent layer, which darkened every
    # semi-transparent pixel: frosted glass went grey (~221) and the opaque dip tube
    # behind it read as a hard white streak.
    full = rgba.convert("RGBa").resize((round(rgba.width * scale), round(rgba.height * scale)), Image.LANCZOS).convert("RGBA")
    ox, oy = round(CX - center_x_src * scale), round(anchor_y_dst - anchor_y_src * scale)
    sx, sy, dx, dy = max(0, -ox), max(0, -oy), max(0, ox), max(0, oy)
    w, h = min(full.width - sx, W - dx), min(full.height - sy, H - dy)
    out = Image.new("RGBA", (W, H), BONE + (255,))
    out.alpha_composite(full.crop((sx, sy, sx + w, sy + h)), dest=(dx, dy))
    return out.convert("RGB"), {"scale": round(scale, 6), "offset": [ox, oy]}

TUBE_DIFFUSION_PX = 14

def frosted_tube(layer):
    """The PSDs draw the dip tube as a separate sharp layer behind the frosted bottle.
    Frosted glass scatters what is behind it, so a crisp line cannot show through.
    Diffuse it (Gaussian, in PSD pixels) so it reads as the approved frosted Circle
    bulb siblings do: no visible line, at most a soft band."""
    assert layer.name == "Layer 4 copy" and layer.width < 150, "expected the narrow dip-tube layer"
    pad = 4 * TUBE_DIFFUSION_PX
    im = layer.composite().convert("RGBA")
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    soft = canvas.convert("RGBa").filter(ImageFilter.GaussianBlur(TUBE_DIFFUSION_PX)).convert("RGBA")
    return soft, layer.left - pad, layer.top - pad

def alpha_bbox(rgba, cut=8):
    return rgba.getchannel("A").point(lambda v: 255 if v > cut else 0).getbbox()

def bottle_layer(psd):
    hits = [l for l in layers(psd) if (l.width, l.height) == (1001, 1180)]
    assert len(hits) == 1, "expected one frosted 50 ml Circle bottle layer"
    return hits[0]

def collar(layer):
    a = np.asarray(layer.composite().convert("RGBA"))[..., 3] > 40
    x0 = int(a.shape[1] * 0.78)
    ys, xs = np.where(a[:, x0:])
    return layer.left + x0 + xs.max(), layer.top + ys.max()

def tassel(colour):
    if colour == "Gl":
        base = PSDImage.open(f"{ROOT}/{UPDATED}/43. GBCrclFrst50AnSpTslIvyGl.psd")
        gold = PSDImage.open(f"{ROOT}/{UPDATED}/50. GBCrcl50AnSpTslGl.psd")
        ivory = next(l for l in layers(base) if l.name == "Layer 9")
        sprayer = next(l for l in layers(gold) if l.name == "Layer 10")
        (ir, ib), (gr, gb) = collar(ivory), collar(sprayer)
        tube = next(l for l in layers(base) if l.name == "Layer 4 copy")
        rgba = flatten(base, swap={"Layer 9": (sprayer.composite().convert("RGBA"), sprayer.left + ir - gr, sprayer.top + ib - gb),
                                   "Layer 4 copy": frosted_tube(tube)})
        sources = [f"{UPDATED}/43. GBCrclFrst50AnSpTslIvyGl.psd (frosted bottle, dip tube)", f"{UPDATED}/50. GBCrcl50AnSpTslGl.psd (gold sprayer, bulb and tassel)"]
        psd = base
    else:
        name = next(f for f in os.listdir(f"{ROOT}/{UPDATED}") if f.endswith(f". GBCrclFrst50AnSpTsl{colour}.psd"))
        psd = PSDImage.open(f"{ROOT}/{UPDATED}/{name}")
        tube = next(l for l in layers(psd) if l.name == "Layer 4 copy")
        rgba = flatten(psd, swap={"Layer 4 copy": frosted_tube(tube)})
        sources = [f"{UPDATED}/{name}"]
    foot = bottle_layer(psd).bbox[3] - 9
    x0, _, x1, _ = alpha_bbox(rgba)
    img, meta = place(rgba, TASSEL_SCALE, foot, BASE_Y, (x0 + x1) / 2)
    return img, {**meta, "rule": "tassel", "sources": sources, "glassFootSrcY": foot, "dipTubeDiffusionPx": TUBE_DIFFUSION_PX}

def elegant(rel):
    psd = PSDImage.open(f"{ROOT}/{rel}")
    rgba = flatten(psd)
    a = np.asarray(rgba)[..., 3] > 40
    widths = a.sum(axis=1)
    rows = np.where(widths > 0)[0]
    shoulder = int(rows[np.argmax(widths[rows] > 0.5 * widths.max())])
    foot = int(rows.max())
    scale = 0.57 * H / (foot - shoulder)
    xs = np.where(a[shoulder:foot + 1].any(axis=0))[0]
    img, meta = place(rgba, scale, foot, BASE_Y, (xs.min() + xs.max()) / 2)
    return img, {**meta, "rule": "elegant-100ml", "sources": [rel], "glassShoulderSrcY": shoulder, "glassFootSrcY": foot}

def component(rel, key_white=False):
    psd = PSDImage.open(f"{ROOT}/{rel}")
    rgba = flatten(psd)
    if key_white:
        # The layer carries the studio's white card. Clear only near-white pixels
        # connected to the card's edge, so the cap's own highlights stay.
        from scipy import ndimage
        arr = np.asarray(rgba).copy()
        white = (arr[..., :3].min(axis=2) > 236) & (arr[..., 3] > 0)
        lab, _ = ndimage.label(white)
        x0, y0, x1, y1 = alpha_bbox(rgba)
        rim = np.concatenate([lab[y0, x0:x1], lab[y1 - 1, x0:x1], lab[y0:y1, x0], lab[y0:y1, x1 - 1]])
        card = np.isin(lab, [v for v in np.unique(rim) if v != 0])
        arr[card, 3] = 0
        rgba = Image.fromarray(arr)
    x0, y0, x1, y1 = alpha_bbox(rgba)
    scale = min(1240 / (x1 - x0), 1280 / (y1 - y0))
    img, meta = place(rgba, scale, y1 - 1, 1561, (x0 + x1) / 2)
    return img, {**meta, "rule": "component", "sources": [rel], "keyedWhiteCard": key_white}

JOBS = {
    **{f"GBCrclFrst50AnSpTsl{c}": (tassel, (c,)) for c in ["Gl", "IvyGl", "IvySl", "Lvn", "MtSl", "Pnk", "Red", "Wht"]},
    "GBElgFrst100RdcrMtSl": (elegant, ("2.  18-415 Bottles /20. Elegant Frosted 100ml/1. Elegant Frst 100ml PSD/9. GBElgFrst100RdcrMtSl.psd",)),
    "8-425CpShortBlack": (component, ("6.   8-425 Bottles - CB/8245 Caps/1. CP8-425ShortBlack.psd", True)),
    "CP8-425TallBlack": (component, ("6.   8-425 Bottles - CB/8245 Caps/5. 8-425CpTallBlack.psd", True)),
    "CP18-415ShnBlkTall": (component, ("20. Caps/6. 18-415 Caps/2. CP18-415ShnBlkTall.psd", True)),
    "CPKeyChnGld": (component, ("20. Caps/21. Hearts 8-245 Caps/2. CP8-425GlChainShortShnGlCap.psd",)),
    "CPTslRed": (component, ("20. Caps/21. Hearts 8-245 Caps/4. CP8-425RedTslShortShnGlCap.psd",)),
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    manifest = []
    for sku, (fn, args) in JOBS.items():
        img, meta = fn(*args)
        path = f"{out}/{sku}.png"
        img.save(path, optimize=True)
        data = open(path, "rb").read()
        sha = hashlib.sha256(data).hexdigest()
        final = f"{out}/{sku}.{sha[:12]}.png"
        os.replace(path, final)
        manifest.append({"websiteSku": sku, "file": os.path.basename(final), "sha256": sha, "bytes": len(data), **meta})
        print(sku, meta["rule"], meta["scale"], meta["offset"], sha[:12])
    json.dump(manifest, open(f"{out}/render-manifest.json", "w"), indent=1)
