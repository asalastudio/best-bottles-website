"""The 18-415 reducer insert, levelled (Jordan, 4 Nov 2026: "it looks like it's a little bit tilted forward ... adjust
it so it sits flat"). The shared insert photographs (public/local-kits/elegant60-reducer-2026-10-31/reducer-18415-*.png)
were taken from slightly above: the flange's underside is an arc (72 px at the ends, 80 px at the centre of the
316 px seated image), while the glass necks are photographed level. Each column of the flange is moved down so its
underside lies on one straight line (the centre's): the flange sits flush on the neck lip. Only the flange is moved; in
the EXPLODED image the plug below it stays where it is. Pixels are moved, never repainted.
Writes public/local-kits/egd-masters-2026-11-04/reducer/reducer-18415-{seated,full}-flat.<sha>.png.
Usage: python3 scripts/empire-grace-diamond/flat-reducer.py
"""
import hashlib, io, os
import numpy as np
from PIL import Image

SRC = "public/local-kits/elegant60-reducer-2026-10-31"
OUT = "public/local-kits/egd-masters-2026-11-04/reducer"


def outline(a):
    """Per column: (top, underside) opaque rows of the seated image, -1 where empty."""
    solid = a[..., 3] > 60; h, w = solid.shape
    top = np.array([np.where(solid[:, x])[0].min() if solid[:, x].any() else -1 for x in range(w)])
    floor = np.array([np.where(solid[:, x])[0].max() if solid[:, x].any() else -1 for x in range(w)])
    return top, floor


def shifted(col, d):
    """The column moved down by d px (fractional: linear between rows), transparent where nothing moves in."""
    h = col.shape[0]; src = np.arange(h) - d; i0 = np.floor(src).astype(int); f = (src - i0)[:, None]
    def at(i):
        ok = (i >= 0) & (i < h); out = np.zeros_like(col, dtype=float); out[ok] = col[i[ok]]; return out
    a0, a1 = at(i0), at(i0 + 1)
    # premultiplied, so colour never bleeds from transparent rows
    p0 = a0[:, :3] * a0[:, 3:] / 255; p1 = a1[:, :3] * a1[:, 3:] / 255
    alpha = a0[:, 3:] * (1 - f) + a1[:, 3:] * f; prem = p0 * (1 - f) + p1 * f
    rgb = np.where(alpha > 0, prem * 255 / np.maximum(alpha, 1e-6), 0)
    return np.concatenate([rgb, alpha], 1)


def level(a, top, floor, flange_rows):
    """Eye-level flange: the underside on one straight line (a parabola fitted to the arc, so no stair-steps), and
    outside the raised centre boss the flange is its side band only (constant thickness; the top face, seen from above in
    the photograph, is left out). Under the boss the column moves down with it. Rows below flange_rows (the EXPLODED
    plug) are untouched except where the flange lands on them."""
    h, w = a.shape[:2]; xs = np.where(floor >= 0)[0]
    fit = np.polyval(np.polyfit(xs, floor[xs], 2), np.arange(w)); target = fit[xs].max()
    boss = top >= 0
    boss &= top < (top[xs].min() + top[xs].max()) / 2
    ends = np.r_[xs[:max(3, len(xs) // 30)], xs[-max(3, len(xs) // 30):]]
    band = float(np.median(floor[ends] - top[ends] + 1))
    out = a.astype(float).copy(); out[:flange_rows] = 0
    for x in xs:
        d = target - fit[x]
        col = shifted(a[:flange_rows, x].astype(float), d)
        if not boss[x]:
            col[: max(0, int(np.floor(target - band + 1)))] = 0
        # keep what the plug already has below the flange where it is more opaque
        out[:flange_rows, x] = col
    return np.clip(np.rint(out), 0, 255).astype(np.uint8), band, target


def save(img, name):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    sha = hashlib.sha256(data).hexdigest(); os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.startswith(name + ".") and not old.startswith(f"{name}.{sha[:12]}"):
            os.remove(f"{OUT}/{old}")
    path = f"{OUT}/{name}.{sha[:12]}.png"; open(path, "wb").write(data)
    return path


seated = np.asarray(Image.open(f"{SRC}/reducer-18415-seated.png").convert("RGBA"))
full = np.asarray(Image.open(f"{SRC}/reducer-18415-full.png").convert("RGBA"))
top, floor = outline(seated)
# The two images share the flange: same width, and the same flange outline where no plug hangs below it.
assert seated.shape[1] == full.shape[1]
edge = [x for x in range(seated.shape[1]) if floor[x] >= 0 and not (full[seated.shape[0]:, x, 3] > 60).any()]
assert edge and all(np.array_equal(seated[:, x, 3] > 60, full[:seated.shape[0], x, 3] > 60) for x in edge), "flange outlines differ"
flat_seated, band, target = level(seated, top, floor, seated.shape[0])
flat_full, _, _ = level(full, top, floor, seated.shape[0])
print(save(Image.fromarray(flat_seated), "reducer-18415-seated-flat"))
print(save(Image.fromarray(flat_full), "reducer-18415-full-flat"))
print(f"flange underside arc {int(floor[floor >= 0].min())}-{int(floor.max())} px -> straight at {target:.1f}; side band {band:.0f} px")

# Put the levelled insert into every Empire/Grace/Diamond reducer kit (same size and box: only the pixels change).
import json
KITS = "public/local-kits/egd-masters-2026-11-04/kits.json"
kits = json.load(open(KITS)); n = 0
flat = {"reducer-18415-seated.png": (flat_seated, "reducer-18415-seated-flat"), "reducer-18415-full.png": (flat_full, "reducer-18415-full-flat")}
saved = {}
for sku, kit in kits["rows"].items():
    for part in kit["parts"]:
        name = part["slot"] == "reducer" and part["image"]["url"].rsplit("/", 1)[-1]
        if name in flat:
            if name not in saved:
                path = [f for f in os.listdir(OUT) if f.startswith(flat[name][1] + ".")][0]
                data = open(f"{OUT}/{path}", "rb").read()
                saved[name] = {"url": "/" + f"{OUT}/{path}".removeprefix("public/"), "key": "", "sha256": hashlib.sha256(data).hexdigest(),
                               "bytes": len(data), "width": flat[name][0].shape[1], "height": flat[name][0].shape[0]}
            assert part["image"]["width"] == saved[name]["width"] and part["image"]["height"] == saved[name]["height"]
            part["image"] = dict(saved[name]); part["derivation"] = "psd-layer:levelled (flat-reducer.py)"; n += 1
kits["version"] = hashlib.sha256(json.dumps(kits["rows"], sort_keys=True).encode()).hexdigest()[:12]
open(KITS, "w").write(json.dumps(kits, indent=1) + "\n")
print(n, "reducer parts levelled; kits version", kits["version"])
