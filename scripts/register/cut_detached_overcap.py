#!/usr/bin/env python3
"""Cut an overcap as it looks OFF the bottle, from a master-library cap-off photograph.

A clear overcap's register layer was cut from the capped photograph, so it carries the pump
and collar seen through the cover. Parked beside the glass it reads as a second pump (Jordan
2026-09-27). The cap-off twin of the same PSD stands the empty cover beside the bottle as its
own layer; this cuts that layer, trims it to its pixels and measures the cover's width in both
images, which is all src/lib/register/detached-overcaps.ts needs to draw it at the seated
cover's size.

  python3 scripts/register/cut_detached_overcap.py \
    --psd "<BB-PSD-Files-Master>/2.  18-415 Bottles /14. Slim 30ml/1. Slim 30ml PSD/27. LBSlm30LtnClOvrCap.psd" \
    --layer "Layer 19" \
    --seated <register overcap layer URL> \
    --out public/assets/register/overcaps/ltn-18-415-clear-overcap.webp

Prints the entry for DETACHED_OVERCAPS. Reads the PSD and the seated layer; writes only --out.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage


def row_widths(alpha: np.ndarray) -> np.ndarray:
    widths = np.zeros(alpha.shape[0])
    for y, row in enumerate(alpha > 128):
        xs = np.flatnonzero(row)
        widths[y] = xs[-1] - xs[0] + 1 if xs.size else 0
    return widths


def band_width(alpha: np.ndarray, top: float, bottom: float) -> float:
    widths = row_widths(alpha)
    h = alpha.shape[0]
    return float(np.median(widths[int(h * top):int(h * bottom)]))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--psd", required=True)
    ap.add_argument("--layer", required=True, help="the empty cover's layer name in the cap-off PSD")
    ap.add_argument("--seated", required=True, help="the register's seated overcap layer URL")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    psd = PSDImage.open(args.psd)
    matches = [layer for layer in psd.descendants() if not layer.is_group() and layer.name == args.layer]
    if len(matches) != 1:
        raise SystemExit(f"expected one layer named {args.layer!r}, found {len(matches)}")
    cover = matches[0].topil().convert("RGBA")
    cover = cover.crop(cover.getchannel("A").getbbox())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cover.save(out, "WEBP", lossless=True, method=6)

    seated = Image.open(io.BytesIO(urllib.request.urlopen(args.seated, timeout=60).read())).convert("RGBA")
    sha = re.search(r"([a-f0-9]{64})\.png", args.seated)
    entry = {
        "seatedLayerSha256": sha.group(1) if sha else None,
        # The capped photograph's cover sits above the collar: the top half of the seated layer.
        "seatedCoverWidth": round(band_width(np.asarray(seated)[..., 3], 0.10, 0.50), 1),
        "url": "/" + str(out).split("public/", 1)[1],
        "width": cover.width,
        "height": cover.height,
        "coverWidth": round(band_width(np.asarray(cover)[..., 3], 0.10, 0.90), 1),
        "source": f"BB-PSD-Files-Master/{args.psd.split('BB-PSD-Files-Master/', 1)[-1]}, layer {args.layer!r}",
        "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
    }
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    main()
