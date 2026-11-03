"""Close-up swatch images for the 18-415 vintage bulb sprayers, with and without tassel.

Jordan (3 Nov 2026): the swatches (catalog grid dots, the product page's cap rail and its finish chip)
showed the whole zoomed-out sprayer with its dip tube. The master library's component photographs
(20. Caps / 9. 18-415 Ansp and 10. 18-415 Ansp Tsl, one PSD per colour) hold each sprayer with its
tube on a layer of its own. Each close-up is every layer but the background and that tube (the tall,
narrow layer), cropped tight and padded square, so a round dot and a rail tile both frame it; a
tassel sprayer is framed on its atomizer cap and the start of its hose, where its colour and metal read.

Writes public/local-kits/elegant60-100-masters-2026-11-03/caps/*.png, the websiteSku map
src/lib/products/local-cap-close-ups.json (catalog dots, localhost only), and each Elegant 60/100 ml
bulb kit's `capCloseUp` (the product page's rail and chip). Run after universal-dip-tube-60-100.py.
Usage: python3 scripts/elegant-masters/cap-close-ups.py
"""
import hashlib, io, json, os, re
from PIL import Image
from psd_tools import PSDImage

ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/20. Caps"
FOLDERS = {"AnSp": "9. 18-415 Ansp ", "AnSpTsl": "10. 18-415 Ansp Tsl"}
KITS = "public/local-kits/elegant60-100-masters-2026-11-03/kits.json"
OUT = "public/local-kits/elegant60-100-masters-2026-11-03/caps"
MAP = "src/lib/products/local-cap-close-ups.json"
SIZE = 512
TASSEL_CROP = 0.42           # the top-right square, as a share of the assembly's width, framing cap and hose
ALIAS = {"MtS": "MtSl"}      # 42. AnspTsl18-415MtS.psd is the matte silver of the SKUs' MtSl


def close_up(path, tassel):
    p = PSDImage.open(path)
    pixels = [l for l in p.descendants() if l.kind == "pixel" and l.visible and l.bbox[2] - l.bbox[0] < p.width * 0.95]
    tube = max((l for l in pixels if (l.bbox[2] - l.bbox[0]) < (l.bbox[3] - l.bbox[1]) / 6), key=lambda l: l.bbox[3] - l.bbox[1], default=None)
    img = Image.new("RGBA", p.size, (0, 0, 0, 0))
    for l in pixels:
        if l is tube:
            continue
        layer = Image.new("RGBA", p.size, (0, 0, 0, 0)); layer.paste(l.composite(), (l.bbox[0], l.bbox[1]))
        img = Image.alpha_composite(img, layer)
    img = img.crop(img.getchannel("A").getbbox())
    if tassel:
        # The hose loops the bulb and tassel far from the cap, so the whole assembly reads tiny. Frame the
        # atomizer cap and the start of its coloured hose (top right): both the metal (IvyGl vs IvySl differ
        # only there) and the colour.
        side = round(img.width * TASSEL_CROP)
        img = img.crop((img.width - side, 0, img.width, side))
        img = img.crop(img.getchannel("A").getbbox())
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    square = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    square.alpha_composite(img, ((SIZE - img.width) // 2, (SIZE - img.height) // 2))
    buf = io.BytesIO(); square.save(buf, "PNG", optimize=True); data = buf.getvalue()
    return square, data


def main():
    os.makedirs(OUT, exist_ok=True)
    images = {}
    for kind, folder in FOLDERS.items():
        for name in sorted(os.listdir(f"{ROOT}/{folder}")):
            m = re.match(rf"\d+\. {'AnspTsl' if kind == 'AnSpTsl' else 'Ansp'}18-415(\w+)\.psd$", name)
            if not m:
                continue
            colour = ALIAS.get(m.group(1), m.group(1))
            square, data = close_up(f"{ROOT}/{folder}/{name}", kind == "AnSpTsl")
            path = f"{OUT}/{kind}-{colour}-{hashlib.sha256(data).hexdigest()[:12]}.png"
            for old in os.listdir(OUT):
                if old.startswith(f"{kind}-{colour}-"):
                    os.remove(f"{OUT}/{old}")
            open(path, "wb").write(data)
            images[(kind, colour)] = {"url": "/" + path.removeprefix("public/"), "width": square.width, "height": square.height,
                                      "source": f"20. Caps/{folder.strip()}/{name}"}
    kits = json.load(open(KITS)); mapped = {}
    for sku, kit in kits["rows"].items():
        m = re.match(r"GBElg(?:Frst)?(?:60|100)(AnSpTsl|AnSp)(\w+)$", sku)
        if not m or (m.group(1), m.group(2)) not in images:
            continue
        look = images[(m.group(1), m.group(2))]
        kit["capCloseUp"] = {k: look[k] for k in ("url", "width", "height")}
        mapped[sku] = look["url"]
    kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
    open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
    open(MAP, "w").write(json.dumps(dict(sorted(mapped.items())), indent=1) + "\n")
    print(len(images), "close-ups;", len(mapped), "SKUs; version", kits["version"])


if __name__ == "__main__":
    main()
