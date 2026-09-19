"""Hero measurement: bottle = tallest connected component of the non-bone mask after a closing, holes filled (clear glass interiors read as bone);
per row the body is the widest contiguous run inside that component (a tassel hangs beside as a separate run; a loose cap is another component).
Threshold adapts downward for frosted glass. Returns baseline, body width (median run width 15–35 % up from the base), body centre x, glass_top."""
import numpy as np
from PIL import Image
from scipy import ndimage
BONE = np.array((245, 243, 239))
def runs(row):
    idx = np.where(row)[0]
    if not len(idx): return []
    cuts = np.where(np.diff(idx) > 1)[0]; starts = np.r_[idx[0], idx[cuts + 1]]; ends = np.r_[idx[cuts], idx[-1]]; return list(zip(starts, ends))
def measure(path_or_img):
    img = Image.open(path_or_img) if isinstance(path_or_img, str) else path_or_img
    d = np.abs(np.array(img.convert("RGB")).astype(float) - BONE).sum(axis=2); H, W = d.shape
    for thr in (40, 28, 18, 12):
        m = d > thr; lab, n = ndimage.label(ndimage.binary_closing(m, iterations=5))
        if n == 0: continue
        t = max(range(1, n + 1), key=lambda i: np.ptp(np.where(lab == i)[0])); comp = ndimage.binary_fill_holes(lab == t)
        ys = np.where(comp.any(axis=1))[0]
        if len(ys) and (ys.max() - ys.min()) >= 0.35 * H: break
    base, top = int(ys.max()), int(ys.min()); Hb = base - top; widest = np.zeros(H, int); cx = np.full(H, np.nan)
    for y in range(top, base + 1):
        rr = runs(comp[y])
        if rr: s, e = max(rr, key=lambda t: t[1] - t[0]); widest[y] = e - s + 1; cx[y] = (s + e) / 2
    zone = widest[base - int(0.35 * Hb): base - int(0.15 * Hb)]; bw = float(np.median(zone[zone > 0]))
    glass_top = next((y for y in range(top, base) if widest[y] >= 0.6 * bw), top)
    return dict(base=base, top=top, body_w=bw, cx=float(np.nanmedian(cx[base - int(0.35 * Hb): base - int(0.15 * Hb)])), glass_top=int(glass_top), thr=thr)
