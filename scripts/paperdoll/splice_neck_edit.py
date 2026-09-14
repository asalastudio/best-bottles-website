#!/usr/bin/env python3
"""Confine a generated neck edit to the neck. No geometry drift by construction.

For each edited body the source layer (pre-edit body, exact master pixels) is kept
byte-for-byte everywhere except the neck: there the silhouette stays the source's
(intersected with the edit's, which only removes the insert that stood proud of
the rim) and the colour inside the bore comes from the edit. The threads' outer
profile and every pixel below the neck are the master photograph.

    /opt/homebrew/bin/python3 scripts/paperdoll/splice_neck_edit.py

Reads data/paper-doll/neck-cleanup/{pre-edit/<name>.webp, <name>-input.png, <name>-cutout.png}
Writes data/paper-doll/neck-cleanup/<name>-spliced.png and a drift report.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

D = Path('data/paper-doll/neck-cleanup'); OUT = D
names = [p.stem for p in (D / 'pre-edit').glob('*.webp')]
report = {}
for name in sorted(names):
    src = Image.open(D / 'pre-edit' / f'{name}.webp').convert('RGBA')
    inp = Image.open(D / f'{name}-input.png'); cut = Image.open(D / f'{name}-cutout.png').convert('RGBA')
    # the input placed the source body centred on a square bone canvas; map the cut-out back onto source pixels
    side = inp.width; scale = side / cut.width
    cut = cut.resize((int(round(cut.width * scale)), int(round(cut.height * scale))), Image.Resampling.LANCZOS)
    ox, oy = (side - src.width) // 2, (side - src.height) // 2
    edit = cut.crop((ox, oy, ox + src.width, oy + src.height))
    S = np.asarray(src).astype(np.float32); E = np.asarray(edit).astype(np.float32)
    a_src = S[..., 3] > 8; a_edit = E[..., 3] > 100
    # neck: rows from the top until the profile widens past 1.6x the neck width
    widths = a_src.sum(axis=1); rows = np.nonzero(widths)[0]
    top = rows[0]; neck_w = np.median(widths[top:top + max(4, int(0.03 * src.height))])
    neck_bottom = next((y for y in range(top, rows[-1]) if widths[y] > 1.6 * neck_w), top + int(0.15 * src.height))
    xs = np.nonzero(a_src[top:neck_bottom].any(axis=0))[0]; x0, x1 = xs.min(), xs.max()
    cx = (x0 + x1) / 2; bore_half = 0.30 * (x1 - x0)  # colour from the edit only inside the bore, threads keep the source colour
    out = S.copy()
    # the silhouette band also covers half a neck-width either side, so a flare
    # or retouch halo standing beside the neck in the source layer falls away too
    pad = int(0.5 * (x1 - x0))
    region = np.zeros(a_src.shape, bool); region[top:neck_bottom + 1, max(0, x0 - pad):min(a_src.shape[1], x1 + pad + 1)] = True
    # silhouette: source ∩ edit inside the neck (removes what stood proud of the rim)
    keep = a_src & (~region | a_edit)
    out[..., 3] = np.where(keep, S[..., 3], 0)
    bore = region.copy(); bore[:, :int(cx - bore_half)] = False; bore[:, int(cx + bore_half) + 1:] = False
    blend = (bore & keep & (E[..., 3] > 100))
    # soften the seam by 3 px
    w = ndimage.gaussian_filter(blend.astype(np.float32), 1.5)[..., None]
    out[..., :3] = np.where(blend[..., None], E[..., :3] * w + S[..., :3] * (1 - w), S[..., :3])
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    im.save(OUT / f'{name}-spliced.png')
    below = np.zeros(a_src.shape, bool); below[neck_bottom + 1:] = True
    changed_alpha = int(((keep != a_src) & below).sum()); changed_rgb_below = int((np.abs(out[..., :3] - S[..., :3]).sum(axis=2) > 0)[below].sum())
    removed = int((a_src & ~keep).sum())
    report[name] = {'size': src.size, 'neckRows': [int(top), int(neck_bottom)], 'neckX': [int(x0), int(x1)], 'pixelsRemovedInNeck': removed,
                    'alphaChangedBelowNeck': changed_alpha, 'rgbChangedBelowNeck': changed_rgb_below}
    print(f"{name:28} neck rows {top}-{neck_bottom} x {x0}-{x1}  removed {removed:6d} px  below-neck alpha/rgb changes {changed_alpha}/{changed_rgb_below}")
json.dump(report, open(OUT / 'splice-report.json', 'w'), indent=1)
