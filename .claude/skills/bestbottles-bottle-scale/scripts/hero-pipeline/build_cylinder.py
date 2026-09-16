"""Deterministic Cylinder hero bases, sized from millimetres.

Same layer rules as scripts/sunburst-heroes/missing/build_bases_v2.py - the PSD layers are
unnamed, so the body is found as the largest visible, non-full-bleed, non-white-patch layer;
anything centred over it is FITTED (roller, sprayer, pump), anything whose bottom sits near the
body's bottom is LOOSE (the cap standing beside it), everything else is dropped. Composite in PSD
z-order, which matches Photoshop's own flatten.

What differs: the scale does not come from a sibling image. The glass body is scaled so its own
height equals the share of the frame the fitted curve gives for this bottle's measured height in
millimetres. That makes the size a property of the product, not of whichever neighbour was
rendered first.

No AI in this step. Output is 1560x1716 on bone with a soft contact shadow; the Sunburst
enhancement pass runs afterwards with geometry locked.
"""
import json, os, re, sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from psd_tools import PSDImage
from scipy import ndimage

from hero_paths import WORK as S
from hero_paths import PSD_LIBRARY as LIB
sys.path.insert(0, S)
# Working scale only; the shipped size is set afterwards by restore_lock.py (lock + amendment).
def fit(mm):
    return 1.785 * float(mm) ** 0.768

BONE = (245, 243, 239)
W, H = 1560, 1716
BASELINE = 1562            # registry convention: the bottle's foot sits here
GROUP_CX = 780             # registry convention: bottle + loose cap centred here
OUT = f"{S}/cyl-bases"
DRAW_SHADOW = True
TOP_MARGIN = 40


def psd_index():
    idx = {}
    for p in glob.glob(f"{LIB}/**/*.psd", recursive=True):
        stem = re.sub(r"^\s*\d+\.\s*", "", os.path.splitext(os.path.basename(p))[0]).strip()
        idx.setdefault(stem.lower(), p)
    return idx


def layers_of(psd):
    """Visible pixel layers with a real bbox, in PSD z-order (bottom first)."""
    out = []
    def walk(node):
        for lyr in node:
            if lyr.is_group():
                walk(lyr); continue
            bb = lyr.bbox
            if not bb or bb[2] - bb[0] < 4 or bb[3] - bb[1] < 4:
                continue
            if bb[0] >= psd.width or bb[1] >= psd.height or bb[2] <= 0 or bb[3] <= 0:
                continue                                    # parked entirely off the canvas
            if not lyr.visible or lyr.kind != "pixel" or lyr.name == "Background":
                continue
            out.append(lyr)
    walk(psd)
    return out


def classify(psd):
    """body / fitted / loose, by geometry - the layers carry no usable names."""
    cw, ch = psd.size
    cands = []
    for lyr in layers_of(psd):
        x0, y0, x1, y1 = lyr.bbox
        if (x1 - x0) >= cw * 0.98 and (y1 - y0) >= ch * 0.98:
            continue                                        # full-bleed backdrop
        pil = lyr.topil()
        if pil is None:
            continue
        arr = np.asarray(pil.convert("RGBA"))
        on = arr[..., 3] > 128
        if on.sum() < 400:
            continue
        white = float((arr[..., :3].min(axis=2)[on] > 235).mean())
        cands.append((lyr, int(on.sum()), lyr.bbox, white))
    if not cands:
        return None, [], []
    real = [c for c in cands if c[3] < 0.85] or cands       # near-white layers are cleanup patches
    # The glass stands on the ground; an atomizer bulb, a pump cover or a tassel hangs above it and
    # can easily be the bigger layer. So take the lowest-reaching layer, and among those that share
    # the floor take the largest - which is the bottle, not the cap standing beside it.
    floor = max(c[2][3] for c in real)
    grounded = [c for c in real if floor - c[2][3] <= 0.02 * ch]
    body = max(grounded, key=lambda t: t[1])[0]
    bx0, by0, bx1, by1 = body.bbox
    bh = by1 - by0
    fitted, loose, rest = [], [], []
    for lyr, _, bb, white in cands:
        if lyr is body or white >= 0.85:
            continue                                        # drop the cleanup patches outright
        x0, y0, x1, y1 = bb
        cx = (x0 + x1) / 2
        if bx0 <= cx <= bx1:
            fitted.append(lyr)                              # sits over the neck
        elif abs(y1 - by1) <= 0.05 * bh:
            loose.append(lyr)                               # stands on the same baseline
        else:
            rest.append(lyr)
    # An atomizer's hose and bulb, or a tassel, hang off to one side: their centre is not over the
    # bottle and they do not stand on the floor, so neither rule claims them. They are attached,
    # though - the bulb touches the hose, the hose touches the head on the neck. Chain outward from
    # the fitted parts through touching bounding boxes until nothing new joins.
    def touches(a, b, m=6):
        return not (a[2] + m < b[0] or b[2] + m < a[0] or a[3] + m < b[1] or b[3] + m < a[1])
    grew = True
    while grew and rest:
        grew = False
        for lyr in list(rest):
            if any(touches(lyr.bbox, f.bbox) for f in fitted + [body]):
                fitted.append(lyr); rest.remove(lyr); grew = True
    return body, fitted, loose


def prefer_uncapped(path):
    """Registry convention is the cap standing beside the bottle, so use the uncapped shot of the
    same file name when the library has one (ported from build_bases_v2)."""
    low = path.lower()
    if "ncapped" in low or "napped" in low:
        return path
    base, d = os.path.basename(path), os.path.dirname(path)
    for _ in range(4):
        d = os.path.dirname(d)
        if not d.startswith(LIB):
            break
        for c in glob.glob(os.path.join(d, "*", base)) + glob.glob(os.path.join(d, "*", "*", base)):
            r = c.lower()
            if ("ncapped" in r or "napped" in r) and "(capped)" not in r:
                return c
    return path


def flatten(psd, keep, body_x=None, exempt=()):
    """Composite the chosen layers onto a transparent canvas in PSD z-order.

    A retouching layer often carries a near-white wing that spills sideways past the bottle. Those
    pixels are cleanup, not product, so near-white pixels outside the body's x-range are dropped
    (the same rule build_bases_v2 applies).
    """
    cw, ch = psd.size
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    for lyr in layers_of(psd):
        if lyr not in keep:
            continue
        img = lyr.topil()
        if img is None:
            continue
        img = img.convert("RGBA")
        x0, y0 = lyr.bbox[0], lyr.bbox[1]
        if body_x is not None and lyr not in exempt:
            # Retouching patches are flat paper-white. Product is not: even a steel roller's
            # highlight carries a tint. So drop pixels that are white on ALL channels and sit in a
            # flat white neighbourhood, keeping specular highlights that have colour in them.
            arr = np.array(img).astype(np.int16)
            flat_white = (arr[..., :3].min(axis=2) > 238) & (np.ptp(arr[..., :3], axis=2) < 6)
            big = ndimage.binary_opening(flat_white, np.ones((5, 5), bool))
            lab, n = ndimage.label(big)
            drop = np.zeros_like(big)
            for i in range(1, n + 1):
                blob = lab == i
                if blob.sum() > 900:                        # a patch, not a highlight
                    drop |= ndimage.binary_dilation(blob, np.ones((3, 3), bool))
            arr[..., 3] = np.where(drop, 0, arr[..., 3])
            img = Image.fromarray(arr.astype(np.uint8), "RGBA")
        canvas.alpha_composite(img, (x0, y0))
    return canvas


def build(sku, psd_path, glass_mm, out_path):
    psd_path = prefer_uncapped(psd_path)
    psd = PSDImage.open(psd_path)
    body, fitted, loose = classify(psd)
    if body is None:
        return None
    keep = set([body] + fitted + loose)
    bx0, by0, bx1, by1 = body.bbox
    # trim the retouching wings against the BODY's own width; the loose cap is product, so it is
    # exempt from the trim rather than widening the window the wings are measured against
    # the glass body is never trimmed - frosted glass is itself flat and near-white
    flat = flatten(psd, keep, body_x=(bx0, bx1), exempt=set(loose) | {body})
    target_h = fit(glass_mm) / 100.0 * H                    # the curve decides the glass height
    scale = target_h / (by1 - by0)

    a = np.array(flat)[..., 3]
    ys, xs = np.where(a > 8)
    if not len(ys):
        return None
    # Hard cap (the rule size_group.py carried): nothing may rise past the top of the canvas. A tall
    # bottle wearing an atomizer or a pump can put its head above the frame at its true glass size;
    # then fit the whole assembly instead, and say so rather than clip it.
    capped = None
    rise = (by1 - int(ys.min())) * scale                    # foot to the top of the assembly
    if BASELINE - rise < TOP_MARGIN:
        s_cap = (BASELINE - TOP_MARGIN) / (by1 - int(ys.min()))
        capped = round(s_cap / scale, 4)
        scale = s_cap
    crop = flat.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
                       Image.LANCZOS)
    # the bottle's own foot, not the group's, lands on the baseline
    foot_offset = (by1 - int(ys.min())) * scale

    sheet = Image.new("RGBA", (W, H), BONE + (255,))
    x = int(GROUP_CX - crop.width / 2)
    y = int(BASELINE - foot_offset)
    # Glass landmarks, from the body layer's own alpha - the one measurement on this project that
    # does not depend on reading clear glass off a flattened picture. Widths per row; the barrel is
    # the median width 15-35 % up from the foot; the shoulder is the highest row still at 92 % of it
    # (a 17-415 neck is ~85 % of a 20 mm barrel, so 92 % separates shoulder from thread).
    ba = np.asarray(body.topil().convert("RGBA"))[..., 3] > 128
    widths = ba.sum(axis=1)
    rows = np.where(widths >= 3)[0]
    foot_r, top_r = int(rows.max()), int(rows.min())
    gh = foot_r - top_r
    band = widths[foot_r - int(0.35 * gh): foot_r - int(0.15 * gh)]
    barrel = float(np.median(band[band > 0])) if (band > 0).any() else float(widths.max())
    sh_rows = np.where(widths >= 0.92 * barrel)[0]
    shoulder_r = int(sh_rows.min()) if len(sh_rows) else top_r
    to_out = lambda r: y + (r + by0 - int(ys.min())) * scale
    landmarks = dict(shoulderY=round(to_out(shoulder_r), 1), rimY=round(to_out(top_r), 1),
                     footY=round(to_out(foot_r), 1), barrelPx=round(barrel * scale, 1))
    # A drawn shadow is a blurred ellipse, and the enhancement pass will faithfully preserve it as
    # one. When the model is going to render the scene, give it the bottle with no shadow at all
    # and let it put the light in.
    if DRAW_SHADOW:
        shadow(sheet, crop, x, y)
    sheet.alpha_composite(crop, (x, y))
    sheet.convert("RGB").save(out_path)
    return dict(sku=sku, glassMm=glass_mm, targetPct=round(fit(glass_mm), 1), scale=round(scale, 4),
                cappedTo=capped, **landmarks,
                psd=os.path.relpath(psd_path, LIB), out=os.path.basename(out_path))


def shadow(sheet, obj, x, y):
    """A soft contact shadow under the footprint - drawn, never prompted, so geometry stays locked."""
    a = np.array(obj)[..., 3]
    cols = np.where((a > 40).any(axis=0))[0]
    if not len(cols):
        return
    w = int(cols.max() - cols.min() + 1)
    base_y = y + obj.height
    lay = Image.new("L", sheet.size, 0)
    d = ImageDraw.Draw(lay)
    d.ellipse([x + cols.min() - w * 0.06, base_y - w * 0.055,
               x + cols.max() + w * 0.06, base_y + w * 0.075], fill=64)
    lay = lay.filter(ImageFilter.GaussianBlur(w * 0.045))
    sheet.paste(Image.new("RGBA", sheet.size, (120, 116, 108, 255)), (0, 0), lay)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    idx = psd_index()
    ALIAS = {"gbmtlroll28blk": "gbcyl28mtlrollblk", "gbspry1ozgl": "gbspry1ozsl"}
    state = {r["sku"]: r for r in json.load(open(f"{S}/cylinder-barrel.json"))}
    args = sys.argv[1:]
    if "--no-shadow" in args:
        args.remove("--no-shadow")
        globals()["DRAW_SHADOW"] = False
        globals()["OUT"] = f"{S}/cyl-geom"
        os.makedirs(OUT, exist_ok=True)
    only = args or list(state)
    done, skipped = [], []
    for sku in only:
        r = state.get(sku)
        if not r:
            skipped.append((sku, "not a registered Cylinder hero")); continue
        key = sku.lower()
        path = idx.get(key) or idx.get(ALIAS.get(key, ""))
        if not path:
            skipped.append((sku, "no source PSD")); continue
        # glass height = the standing bottle's measured height; the curve turns it into a frame share
        res = build(sku, path, r["heightMm"], f"{OUT}/{sku}.png")
        (done if res else skipped).append(res or (sku, "no usable layers"))
    json.dump(done, open(f"{S}/cyl-bases.json" if DRAW_SHADOW else f"{S}/cyl-geom.json", "w"), indent=1)
    print(f"built {len(done)}   skipped {len(skipped)}")
    for s in skipped:
        print("   skip", s)
