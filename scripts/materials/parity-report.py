#!/usr/bin/env python3
"""parity-report.py — measure a render against its canonical reference.

Jordan's standard is that realism is non-negotiable; this makes it
checkable. The reference PNGs in public/references/closures/ are the
target (extracted from the PSD library, which IS the standard). The render
metrics come from /dev/parity via the browser.

Both sides are normalised by the part's own silhouette area, so framing
differences do not pollute the comparison. Three numbers:

  shell dE      CIE76 distance between the shell midtones (target <= 6)
  sparkle       bright-pixel share, render vs reference (target 0.6-1.4x)
  bezel         dark-pixel share, render vs reference   (target 0.6-1.4x)

Usage:
  python3 scripts/materials/parity-report.py \
      --ref 12-17-415-roll-on-cproll17-415pnkdot \
      --render '{"coveredPx":217300,"meanColor":"#e4d2dd","brightPx":1882,"darkPx":0}'
"""
import argparse, json, sys
import numpy as np
from PIL import Image

REF_DIR = "public/references/closures"


def srgb_to_lab(rgb):
    """sRGB 0-255 -> CIE L*a*b* (D65)."""
    c = np.asarray(rgb, dtype=float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805],
                  [0.2126, 0.7152, 0.0722],
                  [0.0193, 0.1192, 0.9505]])
    xyz = m @ c
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def hex_to_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def measure_reference(path):
    """Same metrics the browser computes on the render."""
    img = np.array(Image.open(path).convert("RGB")).astype(float)
    lum = img.mean(axis=2)
    ink = lum < 248                      # the part, against the white sweep
    if not ink.any():
        raise SystemExit(f"no part found in {path}")
    ys, xs = np.where(ink)
    covered = int(ink.sum())
    # shell midtone: the 70-85th percentile band excludes stones and shadow
    vals = img[ink]
    vl = vals.mean(axis=1)
    lo, hi = np.percentile(vl, [70, 85])
    shell = np.median(vals[(vl >= lo) & (vl <= hi)], axis=0)
    return dict(
        coveredPx=covered,
        shell=shell,
        brightPx=int((lum[ink] > 235).sum()),
        darkPx=int((lum[ink] < 110).sum()),
        bbox=(int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="reference slug (no .png)")
    ap.add_argument("--render", required=True, help="JSON from /dev/parity")
    args = ap.parse_args()

    r = measure_reference(f"{REF_DIR}/{args.ref}.png")
    d = json.loads(args.render)

    # normalise by silhouette area — framing must not affect the verdict
    r_bright = r["brightPx"] / r["coveredPx"]
    r_dark = r["darkPx"] / r["coveredPx"]
    d_bright = d["brightPx"] / d["coveredPx"]
    d_dark = d["darkPx"] / d["coveredPx"]

    d_shell = np.array(hex_to_rgb(d["meanColor"]), dtype=float)
    dE = float(np.linalg.norm(srgb_to_lab(r["shell"]) - srgb_to_lab(d_shell)))

    def ratio(a, b):
        return float("inf") if b == 0 else a / b

    sparkle = ratio(d_bright, r_bright)
    bezel = ratio(d_dark, r_dark)

    def verdict(v, lo, hi):
        return "PASS" if lo <= v <= hi else "FAIL"

    hexs = "#%02x%02x%02x" % tuple(int(x) for x in r["shell"])
    print(f"reference : {args.ref}")
    print(f"            shell {hexs}  bright {r_bright*100:5.2f}%  dark {r_dark*100:5.2f}%")
    print(f"render    : shell {d['meanColor']}  bright {d_bright*100:5.2f}%  dark {d_dark*100:5.2f}%")
    print()
    print(f"  shell dE    {dE:6.2f}   {verdict(dE, 0, 6)}   (target <= 6)")
    print(f"  sparkle     {sparkle:6.2f}x  {verdict(sparkle, 0.6, 1.4)}   (target 0.6-1.4x)")
    print(f"  bezel       {bezel:6.2f}x  {verdict(bezel, 0.6, 1.4)}   (target 0.6-1.4x)")
    print()
    fails = sum(v == "FAIL" for v in
                [verdict(dE, 0, 6), verdict(sparkle, 0.6, 1.4), verdict(bezel, 0.6, 1.4)])
    print("GATE: " + ("PASS" if fails == 0 else f"FAIL ({fails}/3)"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
