"""Hold the fitment's colour to the PSD's, and take the same correction across the product.

What Jordan sees as "discolouring" is the render darkening and warming the opaque parts - the matte
gold sprayer goes deeper and more orange - and dragging the glass with it. Clear glass itself cannot
be measured against the flat cut-out (the render rightly shows bone through it), but the FITMENT can:
the sprayer head, collar, pump, roller housing or cap-on above the glass shoulder is opaque in both,
and the geometry is locked, so the same pixels show the same part. Anchor there.

    gain_c = mean_base_c / mean_render_c   over the base's product pixels above the shoulder row
    render'  = gain * render   on the product only (soft mask); paper and shadow untouched

Gains are clipped to [0.85, 1.25]. Level drift on the fitment beyond 6 levels, or a hue shift
(R-B) beyond 6, triggers the correction. No geometry is touched.
"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
from hero_paths import WORK as S
BONE = np.array((245.0, 243.0, 239.0)); BASE = 1562
TOL = 6.0; MIN_PX = 1500


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def fitment_anchor(b, shoulder_y):
    """Base product pixels above the glass shoulder, eroded off the edges."""
    d = np.abs(b - BONE).max(axis=2) > 25
    d[int(shoulder_y) - 6:, :] = False
    return ndimage.binary_erosion(d, np.ones((7, 7), bool))


def measure(base, rend, shoulder_y):
    b, r = load(base), load(rend)
    a = fitment_anchor(b, shoulder_y)
    if a.sum() < MIN_PX:
        return None
    bm, rm = b[a].mean(axis=0), r[a].mean(axis=0)
    return dict(px=int(a.sum()), base=[round(float(v), 1) for v in bm], render=[round(float(v), 1) for v in rm],
                level=round(float(rm.mean() - bm.mean()), 1),
                hueRB=round(float((rm[0] - rm[2]) - (bm[0] - bm[2])), 1))


def needs_fix(m):
    return m is not None and (abs(m["level"]) > TOL or abs(m["hueRB"]) > TOL)


def correct(base, rend, out, shoulder_y):
    b, r = load(base), load(rend)
    a = fitment_anchor(b, shoulder_y)
    bm, rm = b[a].mean(axis=0), r[a].mean(axis=0)
    gain = np.clip(bm / np.maximum(rm, 1.0), 0.85, 1.25)
    prod = np.abs(r - BONE).max(axis=2) > 25; prod[BASE + 10:, :] = False
    prod = ndimage.binary_closing(prod, np.ones((9, 9), bool))
    w = ndimage.gaussian_filter(prod.astype(np.float64), 3)[..., None]
    fixed = np.clip(r * gain, 0, 255)
    outp = fixed * w + r * (1 - w)
    Image.fromarray(np.round(outp).astype(np.uint8)).save(out)
    return [round(float(g), 3) for g in gain], measure(base, out, shoulder_y)


if __name__ == "__main__":
    src = sys.argv[1]; skus = sys.argv[2:]
    lr = json.load(open(f"{S}/lock-restore.json"))
    for sku in skus:
        sy = BASE - lr[sku]["shoulderPxShip"]
        m = measure(f"{S}/cyl-geom/{sku}.png", f"{S}/{src}/{sku}.png", sy)
        print(f"{sku:22} {m}  -> {'FIX' if needs_fix(m) else 'ok'}")


def fitment_fix(base, rend, out, shoulder_y):
    """Bring the OPAQUE parts back to the PSD's colour and leave the glass to the model.

    Gains from the fitment anchor are applied only to the render's product pixels above the glass
    shoulder (head, collar, pump) and to any separate standing component (the cap beside). The glass
    body, which rightly shows bone through it, is untouched. Soft edges, no geometry change.
    """
    b, r = load(base), load(rend)
    a = fitment_anchor(b, shoulder_y)
    if a.sum() < MIN_PX:
        Image.fromarray(np.round(r).astype(np.uint8)).save(out); return None, None
    bm, rm = b[a].mean(axis=0), r[a].mean(axis=0)
    gain = np.clip(bm / np.maximum(rm, 1.0), 0.8, 1.3)
    prod = np.abs(r - BONE).max(axis=2) > 25; prod[BASE + 10:, :] = False
    prod = ndimage.binary_closing(prod, np.ones((9, 9), bool))
    lab, n = ndimage.label(prod)
    sizes = ndimage.sum(prod, lab, range(1, n + 1))
    # the bottle is the component holding the shoulder row's centre column; other standing parts are the cap beside
    centre_lab = lab[int(shoulder_y) + 20, :][prod[int(shoulder_y) + 20, :]]
    bottle = int(np.bincount(centre_lab).argmax()) if centre_lab.size else 0
    region = np.zeros_like(prod)
    region[:int(shoulder_y), :] = prod[:int(shoulder_y), :]                       # above the shoulder: the fitment
    for i in range(1, n + 1):
        if i != bottle and sizes[i - 1] > 3000:
            region |= (lab == i)                                                  # a cap standing beside
    w = ndimage.gaussian_filter(region.astype(np.float64), 2.5)[..., None]
    fixed = np.clip(r * gain, 0, 255)
    Image.fromarray(np.round(fixed * w + r * (1 - w)).astype(np.uint8)).save(out)
    return [round(float(g), 3) for g in gain], measure(base, out, shoulder_y)
