"""Sharper glass for the small catalog cards (Jordan, 24 Nov 2026: "we need to redo these bottle bodies use the hub
image gen if need").

The glass on the 1 ml plug vials, the 2 ml 8-425 and 13-425 vials, the 3 ml green and blue 13-425 vials, the 3 ml
tola and the 3 ml spray bottle comes from the master library PSDs, which hold these sizes only as small photographs
(the vials about 190 px wide, the 1 ml about 95 px), so the cards drew them soft and flat. Each body is re-shot once
with the Asala Brand Hub's generate_media (GPT Image 2.6 Sunburst, edit, brand kit off), geometry-locked to the glass
the card draws today: that glass, upscaled onto the bone background, is the only input. The result is cut with that
glass's own alpha (filled, upscaled and re-sharpened), so the outline, the box and the seating stay exactly as
approved; caps, plugs, applicators and sprayer heads are untouched layers. Every output is AI-generated and labelled
so in small-glass-bodies.generated.json (`source: "generated"`, with its Hub asset id).

  prep  <work>   write <key>.geometry.png (the Hub inputs) and <key>.target.png
  build <work>   read <key>.raw.png (the Hub outputs), write the cut masters to public/images/approved-masters,
                 the 2 ml amber 13-425 heroes (whose cards draw a flat hero, no kit) with the new glass swapped in,
                 and src/lib/paper-doll/small-glass-bodies.generated.json
Usage: python3 scripts/diva-vial/small-glass-bodies.py prep|build <work-dir>
"""
import hashlib, io, json, os, sys, urllib.request
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy.ndimage import binary_fill_holes, binary_dilation, binary_erosion, gaussian_filter

BONE = (245, 243, 239)
M = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master"
MASTERS = "public/images/approved-masters"
HEROES = "public/images/catalog/vial2-amber-13-425-glass-2026-11-24"
OUT = "src/lib/paper-doll/small-glass-bodies.generated.json"
APPROVED = json.load(open("src/lib/paper-doll/approved-kits.generated.json"))["rows"]
PSD_1O5 = "5.  13-415 Bottles/22. GB 1o5 Amber/2.  Amber 1o5  Uncapped/2. GBVialAmb1o5WhtCapSht.psd"

# key -> (where today's glass comes from, the approved kit SKU it is read from or None for the PSD, Hub output asset)
BODIES = {
    "vial1-amber": ("approved kit GB1mlAmbVBlk (PSD 12. Vials/1. 1ml Amber PSD Capped)", "GB1mlAmbVBlk", "6f40c063-b5a0-4dda-af17-8ec2a82d8df7"),
    "vial1-clear": ("approved kit GB1mlVBlk (the amber outline redrawn clear, 3 Nov)", "GB1mlVBlk", "44265412-f123-4d01-beec-aaf8e74774a4"),
    "vial2-amber-8425": ("approved kit GBVAmb2WhtCap (slimmed 3 Nov)", "GBVAmb2WhtCap", "ddc18333-e27a-4e17-8c9b-166314fecec0"),
    "vial2-clear-8425": ("approved kit GBVialClr2mlWhtCap (slimmed 4 Nov)", "GBVialClr2mlWhtCap", "0dd41da3-f155-4a51-97a7-e74b93ff4fff"),
    "vial2-amber-13425": (f"PSD {PSD_1O5} (Layer 6 + Layer 7)", None, "1dd1d613-ac95-4be0-bc0b-a7f38c74fc32"),
    "vial3-green": ("approved kit GBVGreen2o4BlackCapSht", "GBVGreen2o4BlackCapSht", "e3d85e37-24d6-44b5-be73-2c6ed89642d9"),
    "vial3-blue": ("approved kit GBVBlu1o9BlackCapSht", "GBVBlu1o9BlackCapSht", "e3fde895-d18b-4c87-814c-0b63d8a6b8cb"),
    "tola3": ("approved kit GB3TPlGl (PSD 16. 14.3mm/Uncapped, glass with applicator stem)", "GB3TPlGl", "8516cbd2-7a61-4f6d-90d6-9ba67dd8aa9f"),
    "lotion3": ("approved kit LB3mlClear (PSD 18. .../LB3mlClear.psd, bottle with sprayer)", "LB3mlClear", "e3e6f188-61a5-467e-aaf8-60fb5d0dd1e3"),
}
# The 2 ml amber 13-425 cards draw a flat hero (no kit): the glass in each hero is replaced, the cap and shadow kept.
HERO_SWAPS = {
    "GBVialAmb1o5WhtCapSht": "/images/catalog/vials-approved-2026-09-25/GBVialAmb1o5WhtCapSht.d0c06b55854f.webp",
    "GBVAmb1o5BlackCapSht": "/images/catalog/vial2-black-cap-2026-11-04/GBVAmb1o5BlackCapSht.4fe4654a25ca.webp",
}


def body_part(sku):
    return next(p for p in APPROVED[sku]["parts"] if p["slot"] == "body")


def source(key):
    """Today's glass as one RGBA image (the whole body layer, padding included)."""
    sku = BODIES[key][1]
    if sku:
        return Image.open(io.BytesIO(urllib.request.urlopen(body_part(sku)["image"]["url"]).read())).convert("RGBA")
    p = PSDImage.open(f"{M}/{PSD_1O5}"); d = {x.name: x for x in p.descendants()}
    can = Image.new("RGBA", p.size, (0, 0, 0, 0))
    for n in ("Layer 6", "Layer 7"):
        can.alpha_composite(d[n].composite().convert("RGBA"), (d[n].bbox[0], d[n].bbox[1]))
    return can.crop(can.getbbox())


def placement(img):
    """Where prep put the glass on the 1024x1536 Hub input: (crop origin, scale, offset)."""
    g = img.getbbox(); w, h = g[2] - g[0], g[3] - g[1]
    s = min(1300 / h, 760 / w); bw, bh = round(w * s), round(h * s)
    return g, s, ((1024 - bw) // 2, (1536 - bh) // 2 + 40)


def prep(work):
    os.makedirs(work, exist_ok=True)
    for key in BODIES:
        img = source(key); g, s, (ox, oy) = placement(img); t = img.crop(g)
        t.save(f"{work}/{key}.target.png")
        can = Image.new("RGBA", (1024, 1536), BONE + (255,))
        can.alpha_composite(t.resize((round(t.width * s), round(t.height * s)), Image.LANCZOS), (ox, oy))
        can.convert("RGB").save(f"{work}/{key}.geometry.png")
        print(key, t.size, round(s, 3))


def save(img, name, folder=MASTERS, fmt="PNG"):
    buf = io.BytesIO(); img.save(buf, fmt, **({"optimize": True} if fmt == "PNG" else {"lossless": True, "method": 6}))
    data = buf.getvalue(); sha = hashlib.sha256(data).hexdigest(); ext = "png" if fmt == "PNG" else "webp"
    os.makedirs(folder, exist_ok=True); path = f"{folder}/{name}.{sha[:12]}.{ext}"; open(path, "wb").write(data)
    return {"url": "/" + path.removeprefix("public/"), "sha256": sha, "bytes": len(data), "width": img.width, "height": img.height}


def cut(key, work):
    """(cut glass, its strict bbox in the source image's px, px per source px)."""
    img = source(key); g, s, (ox, oy) = placement(img)
    a = np.asarray(img)[..., 3]; ys, xs = np.where(a > 8)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    raw = Image.open(f"{work}/{key}.raw.png").convert("RGB")
    # The Hub kept the glass where it was given (checked: every outline within 2-3 px), so the map is exact.
    box = (ox + (x0 - g[0]) * s, oy + (y0 - g[1]) * s, ox + (x1 - g[0]) * s, oy + (y1 - g[1]) * s)
    size = (round((x1 - x0) * s), round((y1 - y0) * s))
    glass = raw.resize(size, Image.LANCZOS, box=box).convert("RGBA")
    # The outline is the approved glass's alpha (inside made opaque: the clear 2 ml drew its glass half transparent),
    # upscaled and smoothed. Its core is opaque; in a band along its rim the alpha follows the re-shot photograph's own
    # contrast against the bone it was shot on, so the edge is the photograph's edge (no PSD pixel steps, no bone fringe)
    # and never reaches past the outline grown by 2 px.
    src = a[y0:y1, x0:x1].astype(np.float32); filled = binary_fill_holes(src > 8)
    src = np.where(binary_erosion(filled, iterations=2), 255.0, src)
    up = np.asarray(Image.fromarray(src.astype(np.uint8)).resize(size, Image.BICUBIC)).astype(np.float32)
    shape = gaussian_filter(up, sigma=max(0.6, s / 2.5)) > 128
    band = max(3, round(1.5 * s))
    core, reach = binary_erosion(shape, iterations=band), binary_dilation(shape, iterations=2)
    rgb = np.asarray(glass)[..., :3].astype(np.float32)
    soft = np.clip((np.abs(rgb - np.array(BONE)).max(2) - 6) / 18, 0, 1) * 255
    alpha = gaussian_filter(np.where(core, 255.0, np.where(reach, soft, 0.0)), 0.5)
    glass.putalpha(Image.fromarray(np.where(core, 255, alpha).clip(0, 255).astype(np.uint8)))
    return glass, (int(x0), int(y0), int(x1), int(y1)), img.size, s


def hero_swap(hero_url, glass):
    """The hero with its amber glass replaced by `glass`, foot and axis kept, the cap and shadow untouched."""
    hero = Image.open("public" + hero_url).convert("RGB"); h = np.asarray(hero).astype(int)
    amber = (h[..., 0] - h[..., 2] > 45) & (h[..., 0] > 60)
    xs = np.where(amber.sum(0) > 20)[0]; left_obj = xs[: np.argmax(np.diff(xs) > 30) + 1] if (np.diff(xs) > 30).any() else xs
    ys = np.where(amber[:, left_obj.min():left_obj.max() + 1].sum(1) > 3)[0]
    x0, x1, y0, y1 = left_obj.min(), left_obj.max() + 1, ys.min(), ys.max() + 1
    old = np.zeros(amber.shape, bool)
    for y in range(y0, y1):                 # the old glass, row by row between its outer amber edges
        r = np.where(amber[y, x0:x1])[0]
        if r.size: old[y, x0 + r.min(): x0 + r.max() + 1] = True
    old = binary_dilation(old, iterations=4)
    k = (y1 - y0) / glass.height
    g = defringe(glass.resize((round(glass.width * k), y1 - y0), Image.LANCZOS))
    gx = round((x0 + x1) / 2 - g.width / 2)
    cover = np.zeros(amber.shape, bool)
    cover[y0:y1, gx:gx + g.width] = np.asarray(g)[..., 3] > 250
    # Old glass the new one does not cover is filled from its surroundings (the bone and the contact shadow carry on).
    out = inpaint(h.astype(np.float32), old & ~cover)
    res = Image.fromarray(out.clip(0, 255).astype(np.uint8)).convert("RGBA")
    res.alpha_composite(g, (gx, y0))
    return res.convert("RGB"), {"oldGlass": [int(x0), int(y0), int(x1), int(y1)], "widthRatio": round(g.width / (x1 - x0), 4)}


def defringe(img, band=6):
    """Bone baked into the outline's rim (the PSD outline is a hair wider than the re-shot glass) made transparent,
    so it does not show over a hero's contact shadow."""
    a = np.asarray(img).astype(np.int32); inside = a[..., 3] > 0
    rim = inside & ~binary_erosion(inside, iterations=band)
    bone = np.abs(a[..., :3] - np.array(BONE)).max(2) < 14
    a[rim & bone, 3] = 0
    return Image.fromarray(a.astype(np.uint8))


def inpaint(img, hole):
    """Fill `hole` by repeatedly averaging the known 8-neighbours (thin rims only)."""
    img = img.copy(); known = ~hole
    while not known.all():
        acc = np.zeros_like(img); n = np.zeros(known.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == dx == 0: continue
                k = np.roll(np.roll(known, dy, 0), dx, 1); v = np.roll(np.roll(img, dy, 0), dx, 1)
                acc += v * k[..., None]; n += k
        grow = ~known & (n > 0)
        img[grow] = acc[grow] / n[grow][:, None]; known = known | grow
    return img


def point_heroes(heroes):
    """The released hero rows for the swapped SKUs point at the new images; the cap-swap framing recorded for the old
    image (same frame, same cap) is carried to the new one."""
    framing_file = "src/lib/products/catalog-cap-swap-framing.json"; framing = json.load(open(framing_file))
    for name in ("catalog-hero-vials-release.json", "catalog-hero-vial2-black-cap-2026-11-04.json"):
        path = f"src/lib/products/{name}"; rows = json.load(open(path)); changed = False
        for row in rows:
            hero = heroes.get(row.get("websiteSku"))
            if not hero or row["url"] == hero["url"]: continue
            assert row["url"] in (hero["from"],) or row["url"].startswith(HEROES.removeprefix("public")), row["url"]
            old = row["url"]; row["url"] = hero["url"]; changed = True
            if old in framing: framing[hero["url"]] = framing[old]
        if changed: open(path, "w").write(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    open(framing_file, "w").write(json.dumps(framing, indent=2, ensure_ascii=False) + "\n")


def build(work):
    bodies, kits, heroes = {}, {}, {}
    for key, (src, sku, asset) in BODIES.items():
        glass, (x0, y0, x1, y1), (W, H), s = cut(key, work)
        if key == "lotion3":
            # LB3mlClear's layers are whole-canvas images (the legacy PDP's mobile viewer draws them so): keep that form.
            canvas = Image.new("RGBA", (round(W * s), round(H * s)), (0, 0, 0, 0))
            canvas.alpha_composite(glass, (round(x0 * s), round(y0 * s))); glass = canvas
        image = save(glass, f"glass-{key}") if key != "vial2-amber-13425" else None
        bodies[key] = {"source": "generated", "generator": "Asala Brand Hub generate_media, gpt-image-2.6-sunburst edit",
                       "hubAssetId": asset, "geometryFrom": src, "image": image, "pxPerSourcePx": round(s, 4)}
        if key == "vial2-amber-13425":
            for hero_sku, url in HERO_SWAPS.items():
                img, info = hero_swap(url, glass)
                heroes[hero_sku] = {"from": url, **save(img, hero_sku, HEROES, "WEBP"), **info}
            continue
        ref = body_part(sku)["image"]["url"]
        for row_sku, kit in APPROVED.items():
            part = next((p for p in kit["parts"] if p["slot"] == "body"), None)
            if not part or part["image"]["url"] != ref: continue
            b = part.get("box")
            box = None if b is None else {"x": round(b["x"] + x0 * b["width"] / W, 3), "y": round(b["y"] + y0 * b["height"] / H, 3),
                                         "width": round((x1 - x0) * b["width"] / W, 3), "height": round((y1 - y0) * b["height"] / H, 3)}
            kits[row_sku] = {"body": key, "box": box}
        print(key, image and image["url"], glass.size)
    point_heroes(heroes)
    version = hashlib.sha256(json.dumps([bodies, kits, heroes], sort_keys=True).encode()).hexdigest()[:12]
    json.dump({"version": version, "bodies": bodies, "kits": dict(sorted(kits.items())), "heroes": heroes}, open(OUT, "w"), indent=1)
    open(OUT, "a").write("\n")
    print(len(kits), "kit bodies,", len(heroes), "heroes; version", version)


if __name__ == "__main__":
    {"prep": prep, "build": build}[sys.argv[1]](sys.argv[2])
