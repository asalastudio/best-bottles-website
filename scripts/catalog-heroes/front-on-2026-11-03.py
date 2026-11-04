"""Straight-on catalog heroes, redrawn at higher fidelity with Sunburst (gpt-image-2.5-sunburst).

Jordan (3 Nov 2026): the 3 ml clear tola and the 3 ml clear spray bottle "should be regular, straight on image shots.
Same like we have on the grid on the website, but we just need to improve the fidelity." Each keeps its current hero's
composition (bottle upright, cap standing beside it, same framing, same bone ground) and takes its detail from the
original product photograph in the master library (its PSD composite): the octagonal 3 ml glass with its white
applicator stem and the gold jewel cap; the slim clear spray bottle with its sprayer and clear overcap.

Writes docs/hero-families/reshoot-2026-11-03/front-on/<sku>.<sha>.png (review renders; reshoot-release-2026-11-03.py publishes them) and front-on.json (sku -> url).
Usage: python3 scripts/catalog-heroes/front-on-2026-11-03.py <work-dir> [sku ...]
"""
import concurrent.futures, hashlib, importlib.util, io, json, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

OUT = "docs/hero-families/reshoot-2026-11-03/front-on"
M = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master"
W, H = 1560, 1716
BONE = (245, 243, 239)
SOURCES = {
    "GB3TPlGl": ("bone-review/GB3TPlGl.3f8144514e31.png", "16. 14.3mm/14.3mm/Uncapped/GB3TPlGl..psd",
                 "the small octagonal 3 ml clear glass tola bottle with its white plastic applicator stem in the neck, and its tall shiny gold cap with the red jewel on top"),
    "LB3mlClear": ("bone-review/LB3mlClear.b842982a7ee5.png", "18. Perfume Glass Bottles with Metal Decoration/LB3mlClear.psd",
                   "the slim 3 ml clear plastic spray bottle with its clear fine-mist sprayer, and its clear snap-on overcap"),
}
PROMPT = """Studio product photograph, straight-on front view at eye level, exactly the composition of the first image: the bottle standing upright, its cap standing upright beside it, at the same positions, sizes and framing, with the same soft contact shadow on the same plain flat warm cream background #F5F3EF.
1. The product is {what}. Take every detail from the second image, a photograph of the real product: its true shape, proportions, glass clarity, edges, threads, applicator, cap finish and colours. Nothing added, nothing missing, no text or label.
2. Higher fidelity than the first image: crisp clean edges, clear glass with true refraction and highlights, sharp metal and plastic detail, photographic studio packshot quality.
3. Plain seamless background #F5F3EF edge to edge, no props, no floor texture."""


def on_bone(img, size):
    c = Image.new("RGB", size, BONE); im = img.convert("RGBA"); s = min(size[0] * 0.9 / im.width, size[1] * 0.9 / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im); return c


def placed(raw):
    """The output on the hero canvas, its ground shifted to exact bone."""
    a = np.asarray(raw.convert("RGB")).astype(int)
    bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:30, :30], a[:30, -30:], a[-30:, :30], a[-30:, -30:])]), 0)
    im = Image.fromarray(np.clip(a + (np.array(BONE) - bg), 0, 255).astype(np.uint8))
    s = min(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = Image.new("RGB", (W, H), BONE); out.paste(im, ((W - im.width) // 2, (H - im.height) // 2)); return out


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    skus = sys.argv[2:] or list(SOURCES)

    def run(sku):
        hero, psd, what = SOURCES[sku]; raw = f"{work}/{sku}.raw.png"
        if not os.path.exists(raw):
            Image.open(f"public/images/catalog/{hero}").convert("RGB").save(f"{work}/{sku}.composition.png")
            on_bone(PSDImage.open(f"{M}/{psd}").composite(), (1024, 1126)).save(f"{work}/{sku}.photo.png")
            E.edit([f"{work}/{sku}.composition.png", f"{work}/{sku}.photo.png"], PROMPT.format(what=what), raw)
        return sku, raw
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        raws = dict(pool.map(run, skus))
    index_path = f"{OUT}/front-on.json"
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    for sku, raw in raws.items():
        img = placed(Image.open(raw)); buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
        for old in os.listdir(OUT):
            if old.startswith(sku + ".") and old.endswith(".png"):
                os.remove(f"{OUT}/{old}")
        path = f"{OUT}/{sku}.{hashlib.sha256(data).hexdigest()[:12]}.png"; open(path, "wb").write(data)
        index[sku] = {"path": path, "width": W, "height": H, "source": SOURCES[sku][0]}
        print(sku, index[sku]["path"])
    json.dump(dict(sorted(index.items())), open(index_path, "w"), indent=1)


if __name__ == "__main__":
    main()
