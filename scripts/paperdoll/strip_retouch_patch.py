#!/usr/bin/env python3
"""Remove a retoucher's white cover patch from a kit part, touching nothing else.

Some master PSDs carry a hand-cut pure-white polygon behind a component — it hid
the bottle's threads under the cap. On a plate it is invisible (white on white,
and under the cap besides). In Build Your Bottle the cap comes off and the stage
is bone, so the patch shows as a white blotch behind the roller.

The patch is pure white (>= `floor`, default 250) and it touches the part's
transparent exterior; the component does neither. So: drop every white region
connected to transparency, leave enclosed whites (a specular highlight inside
the ball) alone, and soften the one-pixel rim in proportion to its whiteness so
the anti-aliased edge does not keep a white hairline. No surviving pixel's colour
changes and nothing is re-synthesised, so the part stays registered to its plate.
"""
import numpy as np
from PIL import Image
from scipy import ndimage


def strip_retouch_patch(im: Image.Image, floor: int = 250, light: int = 235):
    arr = np.asarray(im.convert("RGBA")).copy()
    alpha = arr[..., 3].astype(float)
    solid = arr[..., 3] > 8
    lightness = arr[..., :3].min(axis=2).astype(int)
    # The patch's own edge is anti-aliased and lossy-compressed, so pure white never
    # quite touches transparency. Connectivity is therefore judged on "light"
    # pixels; what is removed must still contain pure white, so a light-grey
    # highlight on the component that happens to reach its edge is not a patch.
    pale = solid & (lightness >= light)
    labels, n = ndimage.label(pale, structure=np.ones((3, 3), bool))
    beside_nothing = ndimage.binary_dilation(~solid, structure=np.ones((3, 3), bool), iterations=2) & pale
    touching = set(np.unique(labels[beside_nothing])) - {0}
    ground = np.zeros_like(pale)
    for label in touching:
        region = labels == label
        # a real patch is overwhelmingly pure white; a highlight is not
        if (lightness[region] >= floor).mean() >= 0.9:
            ground |= region
    alpha[ground] = 0
    # the fringe between patch and component: fade by whiteness, one pixel deep
    rim = ndimage.binary_dilation(ground, structure=np.ones((3, 3), bool)) & solid & ~ground
    fade = np.clip((lightness[rim] - 200) / 55.0, 0, 1)
    alpha[rim] = alpha[rim] * (1 - fade)
    arr[..., 3] = alpha.round().astype(np.uint8)
    return Image.fromarray(arr, "RGBA"), int(ground.sum())
