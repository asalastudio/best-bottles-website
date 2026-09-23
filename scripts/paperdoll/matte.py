"""Strip a baked white studio ground from a photographed PSD layer.

Some master body layers are the photograph itself: the glass on a white
ground, the ground only partly cut away. This drops the near-white region
connected to the layer border (or to an already-transparent cut), with one
pixel of soft edge so the anti-aliased rim keeps its partial alpha. Only for
opaque coloured glass — clear or frosted glass reads as white and would be
eaten — and only where a reviewed entry asks for it.
"""
import numpy as np
from PIL import Image


def white_ground_fraction(im, tol=20):
    """Share of the layer's alpha-bbox border that is opaque near-white."""
    im = im.convert("RGBA"); arr = np.asarray(im)
    a = arr[..., 3] > 8
    if not a.any(): return 0.0
    ys, xs = np.nonzero(a)
    sub = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    border = np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]])
    return float(((border[:, 3] > 8) & (border[:, :3].min(1) >= 255 - tol)).mean())


def strip_white_ground(im, tol=28):
    from scipy import ndimage
    im = im.convert("RGBA"); arr = np.asarray(im).copy()
    rgb = arr[..., :3].astype(int); a = arr[..., 3] > 8
    white = a & (rgb.min(axis=2) >= 255 - tol)
    labels, n = ndimage.label(white)
    border = np.zeros_like(white); border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    border |= ~a
    edge_labels = np.unique(labels[border & white]); edge_labels = edge_labels[edge_labels > 0]
    ground = np.isin(labels, edge_labels)
    inner = ndimage.binary_erosion(~ground, iterations=1)
    alpha = arr[..., 3].astype(float)
    alpha[ground] = 0
    rim = ~ground & ~inner & a
    whiteness = np.clip((rgb.min(axis=2)[rim] - (255 - tol * 2)) / float(tol * 2), 0, 1)
    alpha[rim] = alpha[rim] * (1 - whiteness)
    arr[..., 3] = alpha.round().astype(np.uint8)
    return Image.fromarray(arr, "RGBA"), int(ground.sum())
