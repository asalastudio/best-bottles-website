"""Fit a released catalogue hero onto its register glass plate: one scale and offset, found by matching the glass outline.

    fit(plate_rgb, plate_anchors, hero_rgb, frosted=False) -> {scale, tx, ty, score}
    hero (x', y') = scale * plate (x, y) + (tx, ty)

The plate's glass body (shoulder to foot) is the template: its edge map (clear, amber) or silhouette (frosted) is
searched over the hero at every plausible size (the glass stands 40-80% of the hero's height), keeping only a match
whose neck carries a fitment in the left two thirds of the frame (a cap standing beside the bottle is a plain cylinder
that otherwise matches a straight-walled body just as well), then refined at full size.
"""
import numpy as np
from scipy import ndimage

BONE = np.array([245, 243, 239], float)


def gray(rgb):
    return rgb[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])


def edges(rgb):
    g = ndimage.gaussian_filter(gray(rgb), 1.2)
    return np.hypot(ndimage.sobel(g, 0), ndimage.sobel(g, 1))


def mask_non_bone(rgb, t=10):
    return np.abs(rgb[..., :3].astype(float) - BONE).max(-1) > t


def glass_rows_extent(mask, rows):
    """Left/right extent of the mask on each row (nan when empty)."""
    L, R = [], []
    for y in rows:
        xs = np.where(mask[y])[0]
        L.append(xs.min() if xs.size else np.nan); R.append(xs.max() if xs.size else np.nan)
    return np.array(L, float), np.array(R, float)


def _ncc(region, tpl):
    """Normalised cross-correlation of tpl over region, valid positions only (FFT)."""
    H0, W0 = tpl.shape
    t = (tpl - tpl.mean()) / (tpl.std() + 1e-6)
    shp = region.shape
    FR = np.fft.rfft2(region, s=shp)
    corr = np.fft.irfft2(FR * np.fft.rfft2(t[::-1, ::-1], s=shp), s=shp)[H0 - 1:, W0 - 1:]
    ones = np.fft.rfft2(np.ones_like(t), s=shp)
    S1 = np.fft.irfft2(FR * ones, s=shp)[H0 - 1:, W0 - 1:]
    S2 = np.fft.irfft2(np.fft.rfft2(region ** 2, s=shp) * ones, s=shp)[H0 - 1:, W0 - 1:]
    n = t.size
    return corr / (n * np.sqrt(np.maximum(S2 / n - (S1 / n) ** 2, 1e-6)))


def silhouette(rgb):
    """The glass's outline for glass whose edges are soft (frosted): the gradient of its smoothed silhouette."""
    m = ndimage.gaussian_filter(mask_non_bone(rgb, 6).astype(float), 2.0)
    return np.hypot(ndimage.sobel(m, 0), ndimage.sobel(m, 1))


def _peaks(ncc, k=6, radius=6):
    """The k best positions, each at least `radius` from the ones before."""
    a = ncc.copy(); out = []
    for _ in range(k):
        iy, ix = np.unravel_index(np.argmax(a), a.shape)
        if not np.isfinite(a[iy, ix]): break
        out.append((float(a[iy, ix]), int(iy), int(ix)))
        a[max(0, iy - radius):iy + radius + 1, max(0, ix - radius):ix + radius + 1] = -np.inf
    return out


def _neck_ok(nonbone, s, x, y, anchors, top, body_w):
    """At the neck's height a fitment stands over the body's axis, and the shoulder area beside it is open on at least one
    side (a bulb may hang on the other). A cap standing beside the bottle fails: bone over its centre, or full width."""
    a = anchors
    seat_y = int(y + (a["seatY"] - top) * s + 0.25 * (a["shoulderY"] - a["seatY"]) * s)   # a quarter down the neck
    cx = int(x + (a["axisX"]) * s)
    if not (0 <= seat_y < nonbone.shape[0]): return False
    half = max(2, int(0.02 * body_w * s))
    centre = nonbone[max(0, seat_y - half):seat_y + half + 1, max(0, cx - half):cx + half + 1].mean() > 0.5
    side = int(0.46 * body_w * s)
    free = [nonbone[max(0, seat_y - half):seat_y + half + 1, max(0, px - half):max(1, px + half + 1)].mean() < 0.3
            for px in (cx - side, cx + side) if 0 <= px < nonbone.shape[1]]
    return bool(centre and any(free))


def fit(plate, anchors, hero, k=4, frosted=False):
    """Coarse over the plausible sizes (the glass stands 40-80% of the hero's height, the bottle in the left two thirds,
    the cap beside it on the right), every position at 1/k; the best peak whose neck carries a fitment. Fine: +-3%."""
    top, base = int(anchors.get("bodyShoulderY") or anchors["shoulderY"]), int(anchors["baselineY"])
    seat_to_foot = anchors["baselineY"] - anchors["seatY"]
    feat = silhouette if frosted else edges
    pe, he = feat(plate)[top:base + 6], feat(hero)
    nonbone = ndimage.binary_opening(mask_non_bone(hero, 8), iterations=1)
    pm = ndimage.binary_opening(mask_non_bone(plate), iterations=2)
    rows = np.arange(top + int(0.15 * (base - top)), base - int(0.05 * (base - top)))
    L, R = glass_rows_extent(pm, rows); body_w = float(np.nanmedian(R - L))
    pe_k, he_k = ndimage.zoom(pe, 1 / k, order=1), ndimage.zoom(he, 1 / k, order=1)
    H, W = hero.shape[:2]
    best = (-1.0, None)
    for s in np.linspace(0.40 * H / seat_to_foot, 0.80 * H / seat_to_foot, 60):
        tpl = ndimage.zoom(pe_k, s, order=1)
        if tpl.shape[0] >= he_k.shape[0] or tpl.shape[1] >= he_k.shape[1]:
            continue
        ncc = _ncc(he_k, tpl)
        for score, iy, ix in _peaks(ncc, k=10):
            if score <= best[0]: break
            x, y = ix * k, iy * k                        # template top-left = plate (0, top) in the hero
            cx = x + anchors["axisX"] * s
            if not (0.18 * W <= cx <= 0.68 * W): continue
            if _neck_ok(nonbone, s, x, y, anchors, top, body_w):
                best = (score, (float(s), x, y)); break
    if best[1] is None:
        raise ValueError("no plausible bottle matched")
    coarse, (s0, x0, y0) = best
    return {**refine(plate, anchors, hero, s0, x0, y0 - s0 * top, frosted, win=3 * k + 4), "coarse": round(coarse, 4)}


def refine(plate, anchors, hero, s0, tx0, ty0, frosted=False, win=16):
    """The fine stage: +-3% of scale and `win` px around a placement hero = s0 * plate + (tx0, ty0)."""
    top, base = int(anchors.get("bodyShoulderY") or anchors["shoulderY"]), int(anchors["baselineY"])
    feat = silhouette if frosted else edges
    pe, he = feat(plate)[top:base + 6], feat(hero)
    x0, y0 = int(round(tx0)), int(round(ty0 + s0 * top))
    best = (-1.0, None)
    for s in s0 * np.linspace(0.97, 1.03, 31):
        tpl = ndimage.zoom(pe, s, order=1)
        H0, W0 = tpl.shape
        ya, xa = max(0, y0 - win), max(0, x0 - win)
        region = he[ya:min(he.shape[0], y0 + H0 + win), xa:min(he.shape[1], x0 + W0 + win)]
        if region.shape[0] <= H0 or region.shape[1] <= W0:
            continue
        ncc = _ncc(region, tpl)
        iy, ix = np.unravel_index(np.argmax(ncc), ncc.shape)
        if ncc[iy, ix] > best[0]:
            best = (float(ncc[iy, ix]), (float(s), float(xa + ix), float(ya + iy - s * top)))
    score, (s, tx, ty) = best
    return {"scale": s, "tx": tx, "ty": ty, "score": round(score, 4), "feature": "silhouette" if frosted else "edges"}


def warp(hero, fitres, shape):
    """The hero resampled onto the plate's pixel grid."""
    s, tx, ty = fitres["scale"], fitres["tx"], fitres["ty"]
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(float)
    coords = [s * yy + ty, s * xx + tx]
    out = np.stack([ndimage.map_coordinates(hero[..., c].astype(float), coords, order=1, mode="constant", cval=BONE[c] if c < 3 else 255) for c in range(3)], -1)
    return out.clip(0, 255).astype(np.uint8)
