"""Cut the pump mechanism and dip tube out of a hero warped onto its plate.

The tube's centre line is traced as one smooth path (dynamic programming over the hero-vs-plate difference) from
just under the collar to where the tube ends; each row keeps the connected band around the path (the wide shaft
under the collar, then the tube). Inside the band the layer is the hero's own pixels, fully opaque.

A master library photograph that keeps the tube on its own layer needs no tracing: cut_layer() takes that layer.
"""
import numpy as np
from scipy import ndimage

BONE = np.array([245, 243, 239], float)


def glass_extent(plate, y, t=10):
    xs = np.where(np.abs(plate[y, :, :3].astype(float) - BONE).max(-1) > t)[0]
    return (xs.min(), xs.max()) if xs.size else (None, None)


def trace(D, ax, y0, y1, xlo, xhi, lam=3.0, cap=35.0):
    Dc = np.minimum(D[y0:y1, xlo:xhi], cap)
    n, w = Dc.shape
    cols = np.arange(w)
    cost = -Dc[0] + 0.8 * np.abs(cols - (ax - xlo))
    back = np.zeros((n, w), np.int8)
    for i in range(1, n):
        left = np.r_[np.inf, cost[:-1]] + lam
        right = np.r_[cost[1:], np.inf] + lam
        stack = np.stack([left, cost, right])
        k = stack.argmin(0)
        cost = stack[k, cols] - Dc[i]
        back[i] = k.astype(np.int8) - 1
    path = np.zeros(n, int); path[-1] = int(np.argmin(cost))
    for i in range(n - 1, 0, -1):
        path[i - 1] = path[i] + back[i, path[i]]
    return path + xlo


def cut(plate, warped, anchors, px_per_mm, floor_y):
    D = ndimage.gaussian_filter(np.abs(warped.astype(float) - plate.astype(float)).max(-1), 0.8)
    ax, seat, shoulder, base = anchors["axisX"], int(anchors["seatY"]), int(anchors["shoulderY"]), int(anchors["baselineY"])
    l, r = glass_extent(plate, int((seat + shoulder) / 2))
    neck_half = (r - l) / 2 if l is not None else 6 * px_per_mm
    # the collar: rows under the seat where the hero differs across (nearly) the whole neck
    # The collar: from the seat down, the hero differs from the bare neck across most of it (a polished collar's
    # highlights come close to the glass, so half the width is enough). It ends at the first 1.5 mm of clear neck.
    x0, x1 = int(ax - neck_half * 0.8), int(ax + neck_half * 0.8)
    cover = [(D[y, x0:x1] > 30).mean() for y in range(seat, min(base, shoulder + int(30 * px_per_mm)))]
    if max(cover[:int(3 * px_per_mm)] or [0]) < 0.4:
        return None, "no collar found under the seat"
    gap = int(1.5 * px_per_mm); last = 0; quiet = 0
    for i, c in enumerate(cover):
        if c > 0.4: last = i
        quiet = quiet + 1 if c < 0.25 else 0
        if quiet > gap: break
    collar_bottom = seat + last
    ys = collar_bottom + int(0.4 * px_per_mm)
    ye = min(int(floor_y + 1.5 * px_per_mm), base)
    lb, rb = glass_extent(plate, int((shoulder + base) / 2))
    half_body = (rb - lb) / 2 if lb is not None else 20 * px_per_mm
    path = trace(D, ax, ys, ye, int(ax - 0.4 * half_body), int(ax + 0.4 * half_body))
    # the tube's end: the last row where the difference along the path stays above the glass's own noise
    along = ndimage.uniform_filter1d(D[np.arange(ys, ye), path], int(max(3, px_per_mm)))
    # the glass's own noise: the hero-vs-plate difference in the liquid space, away from the traced tube
    band = D[ys:ye, int(ax - 0.4 * half_body):int(ax + 0.4 * half_body)].copy()
    for i, c in enumerate(path): band[i, max(0, c - int(ax - 0.4 * half_body) - int(3 * px_per_mm)):c - int(ax - 0.4 * half_body) + int(3 * px_per_mm)] = np.nan
    noise = float(np.nanmedian(band)) if np.isfinite(band).any() else 3.0
    live = np.where(along > max(6.0, 3.0 * noise))[0]
    if live.size == 0:
        return None, "no tube along the path"
    end = ys + int(live.max())
    # The corridor around the traced path: the neck's width while the shaft is wide, then a narrow strip for the tube.
    tube_half = 1.6 * px_per_mm
    C = np.zeros(D.shape, bool)
    shaft_end = ys
    for i, y in enumerate(range(ys, end + 1)):
        c = path[i]
        w = int(neck_half * 0.95)
        seg = D[y, max(0, c - w):c + w + 1] > max(4.0, 2.5 * noise)
        wide = seg.sum() > 2.2 * tube_half
        if wide and y < shoulder + 25 * px_per_mm and y - shaft_end < 2 * px_per_mm: shaft_end = y
        half = w if y <= shaft_end else int(tube_half)
        C[y, max(0, c - half):c + half + 1] = True
    M = (D > max(4.0, 2.5 * noise)) & C
    M = ndimage.binary_closing(M, np.ones((3, 3)), iterations=1)
    lab, n = ndimage.label(M)
    on_path = set(np.unique(lab[np.arange(ys, end + 1), path[:end + 1 - ys]])) - {0}
    M = np.isin(lab, list(on_path))
    M = ndimage.binary_fill_holes(M)
    # Every row keeps the one run through the path, filled across (the shaft is solid, a see-through tube too).
    for i, y in enumerate(range(ys, end + 1)):
        c = path[i]; row = M[y]
        if not row[max(0, c - 2):c + 3].any():
            M[y] = False; continue
        a = c
        while a > 0 and (row[a - 1] or row[a - 2]): a -= 1
        b = c
        while b < row.size - 2 and (row[b + 1] or row[b + 2]): b += 1
        M[y] = False; M[y, a:b + 1] = C[y, a:b + 1]
    alpha = ndimage.gaussian_filter(M.astype(float), 0.8)
    rgb = warped[..., :3].copy()
    # Up into the collar: the shaft's first clean rows, carried straight up to the neck's seat, so any collar
    # (the SKU's own, taller or shorter than the hero's) sits on it without a gap.
    first = ys + int(1.0 * px_per_mm)
    run = M[first]
    if run.any():
        xs = np.where(run)[0]; a, b = xs.min(), xs.max() + 1
        prof_rgb, prof_a = rgb[first, a:b].copy(), ndimage.gaussian_filter1d(run[a:b].astype(float), 0.8)
        for y in range(seat, first):
            rgb[y, a:b] = prof_rgb; alpha[y] = 0; alpha[y, a:b] = prof_a
    yy, xx = np.where(alpha > 0.02)
    layer = np.dstack([rgb, (alpha.clip(0, 1) * 255).astype(np.uint8)])
    y0, y1_, x0_, x1_ = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
    info = {"collarBottomY": int(collar_bottom), "shaftEndY": int(shaft_end), "tubeEndY": int(end), "bbox": [int(x0_), int(y0), int(x1_ - x0_), int(y1_ - y0)],
            "endMmAboveFoot": round((base - end) / px_per_mm, 1), "floorMmAboveFoot": round((base - floor_y) / px_per_mm, 1),
            "noise": round(noise, 1)}
    return layer[y0:y1_, x0_:x1_], info


def cut_layer(layer, anchors, px_per_mm, floor_y):
    """The tube from a master photograph that keeps it on its own layer (the retoucher's cut-out), warped onto the plate.
    Tracing it against the glass broke it into dashes where the Empire's thick walls refract (Jordan 2026-10-01: "make
    sure dip tube is properly visible"); the layer is whole. Only what cut() adds is added: rows past the glass's inner
    floor go, and the shaft's first clean rows are carried up to the neck's seat, so any collar sits on it."""
    layer = layer.astype(float).copy()
    seat, base = int(anchors["seatY"]), int(anchors["baselineY"])
    layer[min(int(floor_y + 1.5 * px_per_mm), base):, :, 3] = 0
    alpha = layer[..., 3]
    rows = np.where((alpha > 5).any(axis=1))[0]
    if rows.size == 0:
        return None, "the tube layer does not reach the plate"
    top, end = int(rows.min()), int(rows.max())
    widths = (alpha > 128).sum(axis=1).astype(float)
    solid = widths[top:end + 1] > 0
    if solid.sum() < 10:
        return None, "the tube layer is too faint"
    tube_w = float(np.median(widths[top:end + 1][solid][int(0.5 * solid.sum()):]))
    shaft_end = top
    for y in range(top, min(end, top + int(25 * px_per_mm)) + 1):
        if widths[y] > 1.6 * tube_w:
            shaft_end = y
    first = top + int(1.0 * px_per_mm)
    run = alpha[first] > 128
    if run.any():
        xs = np.where(run)[0]
        a, b = xs.min(), xs.max() + 1
        profile = layer[first, a:b].copy()
        for y in range(seat, first):
            layer[y] = 0
            layer[y, a:b] = profile
    yy, xx = np.where(layer[..., 3] > 5)
    y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
    info = {"collarBottomY": top, "shaftEndY": int(shaft_end), "tubeEndY": end, "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
            "endMmAboveFoot": round((base - end) / px_per_mm, 1), "floorMmAboveFoot": round((base - floor_y) / px_per_mm, 1),
            "noise": None}
    return layer[y0:y1, x0:x1].clip(0, 255).astype(np.uint8), info
