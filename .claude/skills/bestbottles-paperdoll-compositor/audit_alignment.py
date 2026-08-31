#!/usr/bin/env python3
"""Alignment gate for a composited family (step 5 of the skill).

Checks only what MUST be invariant. Body width is deliberately not checked:
a contrast mask cannot see transparent glass, so it reports a huge phantom
spread on composites that are in fact consistent.
"""
import argparse, pathlib, sys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--dir", required=True)
ap.add_argument("--foot-tol", type=int, default=10)
ap.add_argument("--centre-tol", type=int, default=12)
a = ap.parse_args()

feet, cxs, bright = [], [], []
files = sorted(pathlib.Path(a.dir).glob("*.png"))
for f in files:
    arr = np.array(Image.open(f).convert("RGB"), dtype=float)
    H, W, _ = arr.shape
    edge = np.concatenate([arr[:, :int(W*.10)], arr[:, int(W*.90):]], axis=1)
    m = (np.abs(arr - np.median(edge, axis=1)[:, None, :]).max(axis=2)) > 10
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        continue
    feet.append(ys.max()); cxs.append((xs.min()+xs.max())//2)
    ref = arr[int(H*.45):int(H*.75), int(W*.10):int(W*.16)].mean()
    core = arr[int(H*.45):int(H*.75), int(W*.47):int(W*.53)].mean()
    if core - ref > 18:
        bright.append((round(core-ref, 1), f.stem))

ok = True
def gate(name, spread, tol):
    global ok
    good = spread <= tol
    ok &= good
    print(f"  {name:<12} spread {spread:>4} px  tol {tol:<4} {'PASS' if good else 'FAIL'}")

print(f"{a.dir}: {len(feet)} composites")
if feet:
    gate("foot line", max(feet)-min(feet), a.foot_tol)
    gate("centre axis", max(cxs)-min(cxs), a.centre_tol)
if bright:
    ok = False
    print(f"  opaque glass  {len(bright)} composite(s) FAIL — glass not transmitting:")
    for d, n in sorted(bright, reverse=True)[:8]:
        print(f"      +{d} {n}")
else:
    print("  opaque glass  none            PASS")
print("OVERALL:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
