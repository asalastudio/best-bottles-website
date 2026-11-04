"""Overhead flat-lay heroes for the two 4 ml frosted heart bottles, drawn with Sunburst (gpt-image-2.5-sunburst).

Jordan (3 Nov 2026): the 4 ml frosted heart bottles with keychain and with tassel "should be flat laid ... laid down showing them laying down from overhead. On the same
cream background." Each is redrawn from its current catalog hero (the product's identity: shape, glass, cap, chain,
tassel) as a top-down flat lay on the studio bone #F5F3EF, then set on the hero canvas (1560 x 1716).

Writes docs/hero-families/reshoot-2026-11-03/flat-lay/<sku>.<sha>.png (review renders; reshoot-release-2026-11-03.py publishes them) and flat-lay.json (sku -> url).
Usage: python3 scripts/catalog-heroes/flat-lay-2026-11-03.py <work-dir> [sku ...]
"""
import concurrent.futures, hashlib, importlib.util, io, json, os, sys
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

OUT = "docs/hero-families/reshoot-2026-11-03/flat-lay"
W, H = 1560, 1716
BONE = (245, 243, 239)
SOURCES = {
    "GBHeartFrst4KeyGld": ("bone-review/GBHeartFrst4KeyGld.a32ac93d6cc2.png",
                           "the 4 ml frosted glass heart bottle with its dotted heart outline and gold crown cap, and its gold chain, split ring and lobster clasp"),
    "GBHeartFrst4TslRed": ("bone-review/GBHeartFrst4TslRed.72085c2aa183.png",
                           "the 4 ml frosted glass heart bottle with its dotted heart outline and gold crown cap, and its red cord with the full red tassel"),
}
PROMPT = """Studio product photograph, overhead flat lay: the camera looks straight down from above onto the product lying flat on its side on the surface.
1. The product is exactly the one in the image: {what}. Keep every part's true shape, proportions, glass, colours and finish; nothing added, nothing missing, no text or label.
2. Everything lies flat on the surface seen from directly overhead, arranged neatly and centred, the bottle laid diagonally, its parts placed naturally close beside it, filling about two thirds of the frame.
3. Surface: the same plain flat warm cream background #F5F3EF, edge to edge, seamless. A soft, short, natural contact shadow under each piece from soft top light; no props, no floor texture, no reflections of a room.
4. Crisp clean edges, photographic studio packshot quality, true to life."""


def placed(raw):
    """The output on the hero canvas: its subject centred, the ground repainted exact bone at the edges."""
    im = raw.convert("RGB"); a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([c.reshape(-1, 3) for c in (a[:30, :30], a[:30, -30:], a[-30:, :30], a[-30:, -30:])]), 0)
    # Shift the ground to exact bone so the card edge matches every other card.
    a = np.clip(a + (np.array(BONE) - bg), 0, 255).astype(np.uint8)
    im = Image.fromarray(a); s = min(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = Image.new("RGB", (W, H), BONE); out.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    return out


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    skus = sys.argv[2:] or list(SOURCES)

    def run(sku):
        rel, what = SOURCES[sku]; raw = f"{work}/{sku}.raw.png"
        if not os.path.exists(raw):
            E.edit([f"public/images/catalog/{rel}"], PROMPT.format(what=what), raw)
        return sku, raw
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        raws = dict(pool.map(run, skus))
    index_path = f"{OUT}/flat-lay.json"
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    for sku, raw in raws.items():
        img = placed(Image.open(raw))
        buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
        for old in os.listdir(OUT):
            if old.startswith(sku + ".") and old.endswith(".png"):
                os.remove(f"{OUT}/{old}")
        path = f"{OUT}/{sku}.{hashlib.sha256(data).hexdigest()[:12]}.png"; open(path, "wb").write(data)
        index[sku] = {"path": path, "width": W, "height": H, "source": SOURCES[sku][0]}
        print(sku, index[sku]["path"])
    json.dump(dict(sorted(index.items())), open(index_path, "w"), indent=1)


if __name__ == "__main__":
    main()
