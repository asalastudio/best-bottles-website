"""Swap the 39 photoreal Cylinder heroes into the catalogue registry.

For each SKU: hash the shipped PNG, copy it to public/images/catalog/bone-review/<sku>.<sha12>.png,
point its registry row and its release-manifest row at the new file, and set identity framing - the
size and placement now live in the pixels, so no framing nudge may be applied on top. The registry
and the manifest move together because the test hashes every registry url against the manifest.

Also records Jordan's approval as sunburst-heroes-release-5/approved-lock.json, which is how the
project marks a Sunburst hero as approved bytes.
"""
import hashlib, json, os, shutil
from datetime import date

from hero_paths import REPO
from hero_paths import WORK as S
REG = f"{REPO}/src/lib/products/catalog-heroes.json"
MAN = f"{REPO}/docs/reviews/catalog-complete-hero-release-2026-09-07.json"
DEST = f"{REPO}/public/images/catalog/bone-review"
LOCK_DIR = f"{REPO}/docs/reviews/sunburst-heroes-release-5"
IDENTITY = {"scale": 1, "translateXPercent": 0, "translateYPercent": 0}


def dump(path, data):
    # byte-identical round trip verified for both files: indent 2, ASCII escapes, trailing newline
    with open(path, "w") as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=True) + "\n")


def main():
    geom = {b["sku"]: b for b in json.load(open(f"{S}/cyl-geom.json"))}
    heights = {r["sku"]: r["mm"] for r in json.load(open(f"{S}/render-resize.json"))}
    heights.update({s: g["glassMm"] for s, g in geom.items() if s not in heights})
    plan = json.load(open(f"{S}/lock-restore.json"))
    reg = json.load(open(REG))
    man = json.load(open(MAN))
    reg_by = {h["websiteSku"]: h for h in reg}
    man_by = {r["websiteSku"]: r for r in man["rows"]}

    lock, swapped = {}, []
    for sku in geom:
        src = f"{S}/cyl-locked/{sku}.png"
        data = open(src, "rb").read()
        sha = hashlib.sha256(data).hexdigest()
        rel = f"/images/catalog/bone-review/{sku}.{sha[:12]}.png"
        shutil.copyfile(src, f"{DEST}/{sku}.{sha[:12]}.png")

        h, m = reg_by[sku], man_by[sku]
        old = h["url"]
        h["url"] = rel
        h["framing"] = dict(IDENTITY)
        m["url"] = rel
        m["sha256"] = sha
        m["framing"] = dict(IDENTITY)

        g, z = geom[sku], plan[sku]
        lock[sku] = {
            "sha256": sha,
            "file": f"public{rel}",
            "glassHeightMm": heights[sku],
            "sizedBy": "glass shoulder on the height locked for this body in docs/reviews/cylinder-family-final-manifest-2026-09-07.json",
            "lockGroup": z["group"],
            "shoulderPercent": z["targetPct"],
            "lockedShoulderPercent2026_09_07": z["lockedPct"],
            **({"amendedBy": "lock-amendment-2026-09-16.json"} if z["targetPct"] != z["lockedPct"] else {}),
            "shoulderY": z["shoulderY"],
            "shoulderToFootPx": z["shoulderPx"],
            "standingHeightPercent": z["occupancyPct"],
            "source": g["psd"],
        }
        swapped.append((sku, old, rel))

    dump(REG, reg)
    dump(MAN, man)

    os.makedirs(LOCK_DIR, exist_ok=True)
    with open(f"{LOCK_DIR}/approved-lock.json", "w") as f:
        f.write(json.dumps(dict(sorted(lock.items())), indent=2, ensure_ascii=True) + "\n")

    print(f"swapped {len(swapped)} rows")
    for sku, old, new in swapped[:3]:
        print(f"  {sku}: {os.path.basename(old)} -> {os.path.basename(new)}")
    json.dump(swapped, open(f"{S}/swapped.json", "w"), indent=1)


if __name__ == "__main__":
    main()
