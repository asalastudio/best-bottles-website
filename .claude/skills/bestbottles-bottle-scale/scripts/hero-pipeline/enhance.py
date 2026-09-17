"""Sunburst enhancement pass over the deterministic Cylinder bases.

Two-line prompt, geometry locked, 2080x2288 at high then down to the registry canvas. Every result
is gated against its own source: the silhouette must still match, or the image is rejected rather
than shipped. That is the whole defence against the model deciding something.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

from hero_paths import WORK as S
from hero_paths import REPO
SUNBURST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sunburst.py")
from prompt_for import build as build_prompt
BASES, OUT, BIG = f"{S}/cyl-geom", f"{S}/cyl-final", f"{S}/cyl-final/_raw"
BONE = np.array((245, 243, 239))
W, H = 1560, 1716


def mask(path_or_img):
    """The product, not its shadow.

    A soft contact shadow sits only ~20-30 levels off bone, and Sunburst renders it deeper than the
    drawn one - which is fine, and not a geometry change. Threshold well above the shadow and open
    away the fringe, so the mask is the bottle and the cap.
    """
    img = Image.open(path_or_img) if isinstance(path_or_img, str) else path_or_img
    a = np.asarray(img.convert("RGB")).astype(float)
    m = np.abs(a - BONE).max(axis=2) > 70
    return ndimage.binary_opening(m, np.ones((5, 5), bool))


def box(m):
    ys, xs = np.where(m.any(axis=1))[0], np.where(m.any(axis=0))[0]
    return xs.min(), ys.min(), xs.max(), ys.max()


def gate(src, dst):
    """Did the geometry survive a RE-RENDER?

    Area and pixel overlap cannot judge this: rendered clear glass gains body that the cut-out never
    had, and the shadow is new by design. What must not move is the envelope of the product - the top
    of the fitment, the foot, the left and right extremes, and the centre. A dropped atomizer bulb
    moves the left edge; a missing cap moves the right; a resized bottle moves the top.
    """
    m0, m1 = mask(src), mask(dst)
    x0, y0, x1, y1 = box(m0)
    X0, Y0, X1, Y1 = box(m1)
    top = abs(Y0 - y0) / H
    foot = abs(Y1 - y1) / H
    left = abs(X0 - x0) / W
    right = abs(X1 - x1) / W
    dcx = abs((X0 + X1) / 2 - (x0 + x1) / 2) / W
    return dict(top=round(float(top), 4), foot=round(float(foot), 4), left=round(float(left), 4),
                right=round(float(right), 4), centre=round(float(dcx), 4),
                pass_=bool(top <= 0.015 and foot <= 0.008 and left <= 0.02 and right <= 0.02
                           and dcx <= 0.008))


def has_loose_cap(path):
    """Two separate standing objects means a cap beside the bottle; one means it is fitted."""
    m = mask(path)
    lab, n = ndimage.label(ndimage.binary_closing(m, np.ones((9, 9), bool)))
    big = sum(1 for i in range(1, n + 1) if (lab == i).sum() > 3000)
    return big >= 2


def run(sku):
    base = f"{BASES}/{sku}.png"
    raw, final = f"{BIG}/{sku}.png", f"{OUT}/{sku}.png"
    pf = f"{OUT}/_prompts/{sku}.txt"
    os.makedirs(os.path.dirname(pf), exist_ok=True)
    open(pf, "w").write(build_prompt(sku, has_loose_cap(base)))
    r = subprocess.run([sys.executable, SUNBURST, raw, "2080x2288", "high", pf, base],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(raw):
        return dict(sku=sku, error=(r.stdout + r.stderr).strip()[:300])
    Image.open(raw).convert("RGB").resize((W, H), Image.LANCZOS).save(final)
    log = json.load(open(raw + ".json"))
    res = dict(sku=sku, cost=log.get("cost_usd"), latency=log.get("latency_s"), **gate(base, final))
    if not res["pass_"]:
        os.rename(final, final + ".REJECTED")
    return res


if __name__ == "__main__":
    os.makedirs(BIG, exist_ok=True)
    skus = sys.argv[1:] or [b["sku"] for b in json.load(open(f"{S}/cyl-geom.json"))]
    out = []
    for i, sku in enumerate(skus, 1):
        res = run(sku)
        out.append(res)
        tag = "ERROR" if res.get("error") else ("pass" if res["pass_"] else "REJECT")
        print(f'[{i}/{len(skus)}] {sku:30} {tag:7} '
              + (res["error"] if res.get("error") else
                 f'top {res["top"]:.4f} foot {res["foot"]:.4f} left {res["left"]:.4f} '
                 f'right {res["right"]:.4f} cx {res["centre"]:.4f} ${res["cost"]:.3f}'))
        json.dump(out, open(f"{S}/cyl-final.json", "w"), indent=1)
    ok = [r for r in out if r.get("pass_")]
    spend = sum(r.get("cost") or 0 for r in out)
    print(f"\npassed {len(ok)}/{len(out)}   spend ${spend:.2f}   "
          f"(${spend / max(len(out), 1):.3f} per image)")
