"""Cap, sprayer, pump and dropper photos for catalog swatches, cut from Jordan's PSD master library.

PR #430 listed 519 catalog cap options with no photo (every reducer cap, every Boston Round dropper, every
vial cap and dropper, some caps, sprays, lotion pumps, bulb sprayers and roll-ons). The master library
holds one layered PSD per component, mostly under "20. Caps" (by neck and type, named by component SKU),
with gaps filled from sibling folders (the 18-415 cap set, the vial and heart assemblies).

For each source below, the PSD's visible part layers are composited (backgrounds and any layer the rule
drops are left out), trimmed to the part, scaled down to at most MAX_SIDE px, and written as a lossless
WebP: public/images/cap-swatches/<key>.<sha12>.webp. Each file is decoded again and compared with the
RGBA it was made from, pixel for pixel; a mismatch stops the run.

Rules, per closure type:
  parts       every visible part layer (caps, roll-on caps, sprayer and pump heads: none of the sprayer
              and pump PSDs used here carry their overcap on a visible layer)
  drop-tube   all but the dip tube (the tall, narrow layer): vintage bulb sprayers
  largest     the largest part layer only: droppers, whose pipette and glass stub sit on layers of their own
  layers      the named layers only: a part inside an assembly (a vial's cap, a heart's tassel cap)

The key is the catalog's component websiteSku where the catalog has one (see KEY below), so the swatch map
can join on it. Writes src/lib/products/cap-swatch-photos.generated.json: { key: { url, width, height,
source } }. Run scripts/catalog/map-cap-swatch-photos.mts afterwards to map catalog options onto them.

Read-only against the PSD drive; writes repo files only.
Usage: python3 scripts/catalog/build-cap-swatch-photos.py [--sheet contact.png]
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

LIB = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master"
CAPS = "20. Caps"
C18 = "2.  18-415 Bottles /32. 18415 Caps /18415"
VIALS = "12. Vials/0. All Vials/Capped"
OUT = "public/images/cap-swatches"
MANIFEST = "src/lib/products/cap-swatch-photos.generated.json"
MAX_SIDE = 240
ALPHA_TRIM = 8

# key: (path under LIB, rule, layer names for "layers")
SOURCES = {
    # 13-415 plain caps
    "CP13-415BlkSht": (f"{CAPS}/17. 13-415 Caps /1. CP13-415BlkSht.psd", "parts"),
    "CP13-415WhtSht": (f"{CAPS}/17. 13-415 Caps /2. CP13-415WhtSht.psd", "parts"),
    "CP13-415Sl": (f"{CAPS}/17. 13-415 Caps /3. CP13-415Sl.psd", "parts"),
    "CP13-415Gl": (f"{CAPS}/17. 13-415 Caps /4. CP13-415Gl.psd", "parts"),
    # 13-415 sprayers
    **{f"CP13-415Spry{f}": (f"{CAPS}/18. 13-415 Sprayers/{n} Spry13-415{f}.psd", "parts")
       for n, f in [("1.", "BlkMt"), ("2.", "CuMt"), ("3.", "BlkSh"), ("4.", "BluMt"), ("5.", "GlSh"),
                    ("6.", "GlMt"), ("7.", "SlMt"), ("8", "SlSh")]},
    # 13-415 roll-on caps
    **{f"CPRoll13-415{f}": (f"{CAPS}/19. 13-415 Roll on/{n}. CPRoll13-415{f}.psd", "parts")
       for n, f in [(1, "BlackDot"), (2, "SlDot"), (3, "SlMt"), (4, "PinkDot"), (5, "GlMt"), (6, "SlSh"),
                    (7, "Cu"), (8, "GlSh"), (9, "BlkSh")]},
    # 13-425 vial caps and dropper, cut from the vial assemblies
    "CP13-425Blk": (f"{VIALS}/GBVAmb1DrmBlackCapSht.psd", "layers", ["Layer 3"]),
    "CP13-425Wht": (f"{VIALS}/GBVAmb1DrmWhtCapSht.psd", "layers", ["Layer 5"]),
    "Drp13-425Blk": (f"{VIALS}/GBV1DrmBlkDropper.psd", "layers", ["Layer 2"]),
    # 14.3 mm applicator cap
    "CP14mmAppShnGlRedDot": (f"{CAPS}/28. 14.3 Cap/2. CP14mmAppShnGlRedDot.psd", "parts"),
    "CP14mmAppShnSlBlueDot": (f"{CAPS}/28. 14.3 Cap/1. CP14mmAppShnSlBlueDot.psd", "parts"),
    # 15-415 caps
    "CP15-415ShnSl": (f"{CAPS}/15. 15-415 Caps/6. CP15-415ShnSl.psd", "parts"),
    "CP15-415ShnGl": (f"{CAPS}/15. 15-415 Caps/7. CP15-415ShnGl.psd", "parts"),
    # 17-415 sprayers
    **{f"Spry17-415{f}": (f"{CAPS}/13. 17-415 Spray/{n}. Spry17-415{f}.psd", "parts")
       for n, f in [(11, "Gl"), (12, "MattSl"), (13, "Blk"), (14, "ShnSl"), (15, "Red"), (16, "Tur")]},
    # 18-400 cap and droppers (Boston Round 15 ml)
    "18-400CpShortBlk": (f"{CAPS}/26. 18-400 Cap/1. CP18-400ShortBlk.psd", "parts"),
    **{f"Drp18-40015ml{f}": (f"{CAPS}/4. 18-400 Droppers/{n}. DRP18-40015ml{f}.psd", "largest")
       for n, f in [(1, "WhiteBulb"), (2, "BlckBulb"), (3, "ShnSlTrimBlkBulb"), (4, "ShnGlTrimWhiteBulb"),
                    (5, "ShnGlTrimBlkBulb"), (6, "ShnSlTrimWhiteBulb")]},
    # 18-415 caps (the reducer's cap): the clean single-cap set, not "20. Caps/6. 18-415 Caps", whose files
    # carry stale off-canvas layers
    **{f"CP18-415{key}": (f"{C18}/{n}. CP18-415Rdcr{src}.psd", "parts")
       for n, key, src in [(1, "ShnGl", "ShnGl"), (2, "ShnBlkTall", "ShnBlkTall"), (3, "ShnBlk", "ShnBlk"),
                           (4, "BlkLthr", "BlkLthr"), (5, "BrwnLthr", "BrwnLthr"), (6, "LBrwnLthr", "LBrwnLthr"),
                           (7, "ShnSl", "ShnSl"), (8, "MtSlTall", "MtSlTall"), (9, "MtSl", "MtSl"), (10, "Wh", "Wh"),
                           (46, "LPnkLthr", "LPnkLthr"), (47, "LIvyLthr", "LIvyLthr")]},
    # 18-415 lotion pumps: the clear-overcap pump is drawn without its overcap; SqClr is the white
    # rectangular pump sold with a clear overcap
    "Ltn18-415MtSlCl": (f"{CAPS}/8. 18-415 Lotion/20. Ltn18-415MtSlCl.psd", "parts"),
    "Ltn18-415SqClr": (f"{CAPS}/8. 18-415 Lotion/22. Ltn18-415SqClr.psd", "parts"),
    # 18-415 vintage bulb sprayers, without the dip tube
    **{f"AnSp18-415{f}": (f"{CAPS}/9. 18-415 Ansp /{n}. Ansp18-415{f}.psd", "drop-tube")
       for n, f in [(23, "Lvn"), (24, "Pnk"), (25, "MtSl"), (26, "IvySl"), (27, "Gl"), (28, "IvyGl"), (29, "Blk"),
                    (30, "Wht"), (31, "Red")]},
    # 20-400 caps, droppers and roll-on caps (Boston Round 1 oz / 2 oz)
    "20-400cp1ozShortBlk": (f"{CAPS}/2. 20-400  Cap/28. CP20-4001ozShortBlk.psd", "parts"),
    "20-400Cp2ozShortBlk": (f"{CAPS}/2. 20-400  Cap/27. CP20-4002ozShortBlk.psd", "parts"),
    **{f"Drp20-400{f}": (f"{CAPS}/3. 20-400 Droppers/{n} DRP20-400{f}.psd", "largest")
       for n, f in [("7. ", "1ozWhiteBulb"), ("8.", "1ozBlckBulb"), ("9.", "1ozShnSlTrimBlkBulb"),
                    ("10.", "1ozlShnGlTrimWhiteBulb"), ("11.", "1ozShnGlTrimBlkBulb"), ("12.", "1ozlShnSlTrimWhiteBulb"),
                    ("13.", "2ozWhiteBulb"), ("14.", "2ozBlckBulb"), ("15.", "2ozShnSlTrimBlkBulb"),
                    ("16.", "2ozlShnGlTrimWhiteBulb"), ("17.", "2ozShnGlTrimBlkBulb"), ("18.", "2ozlShnSlTrimWhiteBulb")]},
    **{f"CPRoll20-400Tall{f}": (f"{CAPS}/1. 20-400 Roll on caps /Roll on caps/{n}. CPRoll20-400Tall{f}.psd", "parts")
       for n, f in [(20, "MattSl"), (21, "MattGl"), (22, "ShnGl"), (23, "ShnBlk"), (25, "MattBlk"), (26, "ShnSl")]},
    # 8-425 caps (vials, 5 ml Elegant)
    "8-425CpShortBlack": (f"{CAPS}/20.  8-245 Caps/1. CP8-425ShortBlack .psd", "parts"),
    "8-425CpShortWhite": (f"{CAPS}/20.  8-245 Caps/2. CP8-425ShortWhite.psd", "parts"),
    "CP8-425TallShnSl": (f"{CAPS}/20.  8-245 Caps/3. CP8-425TallShnSl.psd", "parts"),
    "CP8-425TallShnGl": (f"{CAPS}/20.  8-245 Caps/4. CP8-425TallShnGl.psd", "parts"),
    "CP8-425TallBlack": (f"{CAPS}/20.  8-245 Caps/5. CP8-425TallBlack.psd", "parts"),
    # the 2 ml clear vial's own white cap (no tall white 8-425 cap PSD)
    "CP8-425TallWhite": (f"{VIALS}/1. GBVClr2mlWhtCap..psd", "layers", ["Layer 7"]),
    # 8 mm heart caps (gold key chain, red tassel)
    "CP8-425GlChainShortShnGlCap": (f"{CAPS}/21. Hearts 8-245 Caps/2. CP8-425GlChainShortShnGlCap.psd", "layers", ["Gold Chain"]),
    "CP8-425RedTslShortShnGlCap": (f"{CAPS}/21. Hearts 8-245 Caps/4. CP8-425RedTslShortShnGlCap.psd", "layers", ["Red tassel cap"]),
    # 1 ml vial applicator plugs
    "ROD1mlBlk": ("12. Vials/6. Other/GB1mlVBlk.psd", "layers", ["Layer 5"]),
    "ROD1mlWhite": ("12. Vials/6. Other/CP1MLClearApp.psd", "layers", ["Layer 4"]),
    # 12 mm sample sprayers (3.3 ml / 4 ml), the head without its clear overcap
    "Spry12mmBlk": ("17. Additional Bottles/GBSpry3mlClBlk.psd", "layers", ["Layer 2"]),
    "Spry12mmWht": ("17. Additional Bottles/GBSpry4mlClWh.psd", "layers", ["Layer 5"]),
}


def is_background(layer, size):
    """The studio white: the Background layer, or a layer covering the canvas whose corners are opaque
    white. A part layer can fill the canvas too, but its corners are transparent."""
    if layer.name == "Background":
        return True
    x0, y0, x1, y1 = layer.bbox
    if (x1 - x0) * (y1 - y0) < 0.9 * size[0] * size[1]:
        return False
    pixels = layer.topil()
    if pixels is None:
        return False
    pixels = pixels.convert("RGBA")
    w, h = pixels.size
    corners = [pixels.getpixel((x, y)) for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    return all(a > 200 and min(r, g, b) > 235 for r, g, b, a in corners)


def part_layers(psd, rule, names):
    layers = [l for l in psd.descendants() if l.kind in ("pixel", "smartobject", "shape") and l.is_visible()
              and l.bbox[2] > l.bbox[0] and not is_background(l, psd.size)]
    if rule == "layers":
        picked = [l for l in psd.descendants() if l.name in names and l.kind == "pixel"]
        if len(picked) != len(names):
            raise SystemExit(f"layers {names} not all found in {psd}")
        return picked
    if rule == "drop-tube":
        tall = [l for l in layers if (l.bbox[3] - l.bbox[1]) > 4 * (l.bbox[2] - l.bbox[0])]
        tube = max(tall, key=lambda l: l.bbox[3] - l.bbox[1], default=None)
        return [l for l in layers if l is not tube]
    if rule == "largest":
        return [max(layers, key=lambda l: (l.bbox[2] - l.bbox[0]) * (l.bbox[3] - l.bbox[1]))]
    return layers


def render(path, rule, names=()):
    psd = PSDImage.open(path)
    layers = part_layers(psd, rule, names)
    if not layers:
        raise SystemExit(f"no part layers in {path}")
    x0 = min(l.bbox[0] for l in layers); y0 = min(l.bbox[1] for l in layers)
    x1 = max(l.bbox[2] for l in layers); y1 = max(l.bbox[3] for l in layers)
    canvas = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    # bottom to top, as Photoshop stacks them; layers may reach past the PSD canvas, so nothing is clipped
    for layer in layers:
        pixels = layer.composite()
        if pixels is None:
            continue
        tile = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        tile.paste(pixels.convert("RGBA"), (layer.bbox[0] - x0, layer.bbox[1] - y0))
        canvas = Image.alpha_composite(canvas, tile)
    alpha = canvas.getchannel("A").point(lambda a: 255 if a > ALPHA_TRIM else 0)
    canvas = canvas.crop(alpha.getbbox())
    scale = min(1, MAX_SIDE / max(canvas.size))
    if scale < 1:
        canvas = canvas.resize((max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale))), Image.LANCZOS)
    # fully transparent pixels carry no colour; zero them so the lossless encode is exact and deterministic
    arr = np.array(canvas); arr[arr[..., 3] == 0] = 0
    return Image.fromarray(arr, "RGBA")


def encode(image):
    buf = io.BytesIO()
    image.save(buf, "WEBP", lossless=True, quality=100, method=6, exact=True)
    data = buf.getvalue()
    back = np.array(Image.open(io.BytesIO(data)).convert("RGBA"))
    if back.shape != np.array(image).shape or not np.array_equal(back, np.array(image)):
        raise SystemExit("lossless WebP did not round-trip pixel for pixel")
    return data


def main():
    sheet_path = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    manifest, images = {}, []
    for key, (rel, rule, *rest) in sorted(SOURCES.items()):
        image = render(f"{LIB}/{rel}", rule, rest[0] if rest else ())
        data = encode(image)
        name = f"{key}.{hashlib.sha256(data).hexdigest()[:12]}.webp"
        for old in os.listdir(OUT):
            if old.startswith(f"{key}.") and old != name:
                os.remove(f"{OUT}/{old}")
        with open(f"{OUT}/{name}", "wb") as f:
            f.write(data)
        manifest[key] = {"url": f"/images/cap-swatches/{name}", "width": image.width, "height": image.height,
                         "source": rel}
        images.append((key, image))
    with open(MANIFEST, "w") as f:
        f.write(json.dumps(manifest, indent=1) + "\n")
    total = sum(os.path.getsize(f"{OUT}/{n}") for n in os.listdir(OUT))
    print(f"{len(manifest)} cap photos, {total // 1024} KB -> {OUT}, {MANIFEST}")
    if sheet_path:
        cell = 130
        cols = 10
        sheet = Image.new("RGB", (cols * cell, -(-len(images) // cols) * (cell + 14)), (255, 255, 255))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(sheet)
        for i, (key, image) in enumerate(images):
            thumb = image.copy(); thumb.thumbnail((cell - 10, cell - 10))
            x, y = (i % cols) * cell, (i // cols) * (cell + 14)
            sheet.paste(thumb, (x + (cell - thumb.width) // 2, y + cell - 4 - thumb.height), thumb)
            draw.text((x + 2, y + cell), key[:22], fill=(150, 0, 0))
        sheet.save(sheet_path)


if __name__ == "__main__":
    main()
