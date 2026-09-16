"""Restore the locked Cylinder sizing (docs/reviews/cylinder-family-final-manifest-2026-09-07.json)
on the photoreal renders.

Jordan locked every Cylinder hero's glass-shoulder height on 2026-09-07 ("Call cylinder bottles look
perfect. Let's lock it in."). The lock records, per SKU, where the shoulder and the base sit in the
source assembly and the target shoulder height on the 1716 canvas. The photoreal renders are built
from the same PSD parts with the geometry locked, so the lock's shoulder position transfers as a
fraction of the standing assembly height - no width reading of clear glass anywhere.

    shoulder_px(render) = lockRatio x assembly_px(render),   lockRatio = (baseY - shoulderY) / assemblyHeight (lock)
    factor              = targetPercent/100 x 1716 / shoulder_px(render)

Then each render is scaled about its foot, its product group re-centred on x = 780, the paper kept
on exact bone. Output: cyl-locked/<sku>.png + lock-restore.json.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

from hero_paths import WORK as S
from hero_paths import REPO
LOCK = f"{REPO}/docs/reviews/cylinder-family-final-manifest-2026-09-07.json"
AMEND = json.load(open(f"{REPO}/docs/reviews/sunburst-heroes-release-5/lock-amendment-2026-09-16.json"))
BONE = np.array((245, 243, 239), dtype=np.float64)
CW, CH, BASE, CX = 1560, 1716, 1562, 780
FEATHER = 48


def product_mask(a):
    """Product pixels, grain removed, shadow excluded (the shadow lives at and below the foot)."""
    m = np.abs(a - BONE).max(axis=2) > 40
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
    m[BASE - 6:, :] = False
    return m


def extent(a):
    m = product_mask(a)
    rows = np.where(m.sum(axis=1) >= 3)[0]
    cols = np.where(m.sum(axis=0) >= 3)[0]
    return int(rows.min()), int(cols.min()), int(cols.max())


def resize_about_foot(img, f, cx):
    big = img.resize((round(CW * f), round(CH * f)), Image.LANCZOS)
    canvas = Image.new("RGB", (CW, CH), tuple(int(v) for v in BONE))
    canvas.paste(big, (round(CX - cx * f), round(BASE - BASE * f)))
    a = np.asarray(canvas).astype(np.float64)
    # feather the outer band back to bone so corners are exact whatever the paper did
    yy, xx = np.mgrid[0:CH, 0:CW]
    d = np.minimum(np.minimum(yy, CH - 1 - yy), np.minimum(xx, CW - 1 - xx)).astype(np.float64)
    w = np.clip(d / FEATHER, 0, 1)[..., None]
    out = a * w + BONE * (1 - w)
    return Image.fromarray(np.round(out).astype(np.uint8))


def main():
    lock = {r["sku"]: r for r in json.load(open(LOCK))["rows"]}
    geom = {g["sku"]: g for g in json.load(open(f"{S}/cyl-geom.json"))}
    os.makedirs(f"{S}/cyl-locked", exist_ok=True)
    out = {}
    for sku in geom:
        r = lock[sku]
        ss, mc = r["shoulderSizing"], r["measurement"]["mainComponent"]
        lock_ratio = (ss["sourceBaseY"] - ss["sourceShoulderY"]) / (mc["bottom"] - mc["top"])
        target_pct = ss["targetPercent"]
        for b in AMEND["bodies"]:
            if (b.get("skus") and sku in b["skus"]) or (not b.get("skus") and ss["group"] == b["group"]):
                target_pct = b["shoulderPercent"]
        target_px = target_pct / 100 * CH

        img = Image.open(f"{S}/cyl-ship/{sku}.png").convert("RGB")
        a = np.asarray(img).astype(np.float64)
        top, x0, x1 = extent(a)
        assy = BASE - top
        shoulder_now = lock_ratio * assy
        f = target_px / shoulder_now
        cx = (x0 + x1) / 2
        res = resize_about_foot(img, f, cx)
        res.save(f"{S}/cyl-locked/{sku}.png")

        b = np.asarray(res).astype(np.float64)
        t2, l2, r2 = extent(b)
        corners = max(np.abs(c.reshape(-1, 3).mean(axis=0) - BONE).max()
                      for c in (b[:60, :60], b[:60, -60:], b[-60:, :60], b[-60:, -60:]))
        out[sku] = dict(
            profile=r["physicalProfileKey"], group=ss["group"], targetPct=target_pct, lockedPct=ss["targetPercent"],
            lockRatio=round(lock_ratio, 4), assyPxShip=int(assy), shoulderPxShip=round(shoulder_now, 1),
            factor=round(f, 4), shoulderY=round(BASE - target_px, 1), shoulderPx=round(target_px, 1),
            topMarginPx=int(t2), leftMarginPx=int(l2), rightMarginPx=int(CW - 1 - r2),
            occupancyPct=round((BASE - t2) / CH * 100, 1),
            barrelPxScaled=round(geom[sku]["barrelPx"] * f, 1), cornersOff=round(float(corners), 2),
            glassMm=geom[sku]["glassMm"])
    json.dump(out, open(f"{S}/lock-restore.json", "w"), indent=1)

    print(f'{"sku":26}{"group":13}{"tgt%":>6}{"ratio":>7}{"assy":>6}{"factor":>8}{"occ%":>6}{"top":>5}{"L":>5}{"R":>5}{"barrel":>8}{"corner":>7}')
    for sku, o in sorted(out.items(), key=lambda kv: (kv[1]["glassMm"], kv[1]["group"], kv[0])):
        print(f'{sku:26}{o["group"]:13}{o["targetPct"]:6.1f}{o["lockRatio"]:7.3f}{o["assyPxShip"]:6d}{o["factor"]:8.3f}'
              f'{o["occupancyPct"]:6.1f}{o["topMarginPx"]:5d}{o["leftMarginPx"]:5d}{o["rightMarginPx"]:5d}{o["barrelPxScaled"]:8.1f}{o["cornersOff"]:7.2f}')
    # same-body check: every SKU of a physical profile must show the same glass -> same barrel width
    print("\nbarrel width per physical profile after restore (px, min-max, spread):")
    by = {}
    for sku, o in out.items():
        by.setdefault(o["profile"], []).append(o["barrelPxScaled"])
    for p, v in sorted(by.items()):
        print(f"  {p:44} n={len(v)}  {min(v):6.1f} - {max(v):6.1f}   spread {max(v) - min(v):5.1f}")
    bad = [(s, o) for s, o in out.items() if o["topMarginPx"] < 26 or o["leftMarginPx"] < 32 or o["rightMarginPx"] < 32 or o["cornersOff"] > 2]
    print(f"\nenvelope/corner failures: {len(bad)}")
    for s, o in bad:
        print("  ", s, {k: o[k] for k in ("topMarginPx", "leftMarginPx", "rightMarginPx", "cornersOff")})


if __name__ == "__main__":
    main()
