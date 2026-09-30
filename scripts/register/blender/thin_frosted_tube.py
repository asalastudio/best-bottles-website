#!/usr/bin/env python3
"""The Tall 9 mL frosted dip tube, made from the clear bottle's own see-through tube.

Jordan 2026-09-30: the frosted render (see-through/frosted-mist.png, 459 px, the width of the glass)
drew a wide grey band. "We just need to have the same as the clear bottle, but just frosted, nice and
thin and normal." This takes see-through/clear-mist.png (143 x 2319 at 25 px/mm) and frosts it: the
colour moves 20% toward the frosted glass, the opacity drops to 60%, and a 3 px blur (0.12 mm) softens
it. Same size and anchor as the clear layer, so it lands exactly where the clear tube does.

    python3 scripts/register/blender/thin_frosted_tube.py <clear-mist.png> <out.png>
"""
import hashlib
import sys

import numpy as np
from PIL import Image, ImageFilter

FROST = (236, 234, 230)
MIX, OPACITY, BLUR_PX = 0.20, 0.60, 3


def frost(clear: Image.Image) -> Image.Image:
    a = np.asarray(clear.convert("RGBA")).astype(float)
    rgb = a[..., :3] * (1 - MIX) + np.array(FROST) * MIX
    alpha = a[..., 3:4] * OPACITY
    # Blur premultiplied, so the tube's edge fades out instead of picking up a dark halo.
    pre = np.concatenate([rgb * alpha / 255, alpha], -1).clip(0, 255).astype(np.uint8)
    blurred = np.asarray(Image.fromarray(pre, "RGBA").filter(ImageFilter.GaussianBlur(BLUR_PX))).astype(float)
    out_alpha = blurred[..., 3:4]
    out_rgb = np.where(out_alpha > 0, blurred[..., :3] * 255 / np.maximum(out_alpha, 1), 0)
    return Image.fromarray(np.concatenate([out_rgb, out_alpha], -1).clip(0, 255).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    frost(Image.open(src)).save(dst, optimize=True)
    data = open(dst, "rb").read()
    print(dst, Image.open(dst).size, hashlib.sha256(data).hexdigest())
