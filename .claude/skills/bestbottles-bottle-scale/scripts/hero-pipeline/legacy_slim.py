"""The two 9 ml Slim SKUs that have no PSD keep their legacy photographs, but their body moved to the
amended shoulder line (54.1 % from 62.5 %). Scale each about its foot by amended / measured shoulder
percent, re-centre the product group on x = 780, paper to bone. Writes legacy-slim/<sku>.png + json."""
import json, sys
import numpy as np
from PIL import Image
from hero_paths import WORK as S
from hero_paths import REPO
sys.path.insert(0, S)
import restore_lock as rl
lock = {r["sku"]: r for r in json.load(open(f"{REPO}/docs/reviews/cylinder-family-final-manifest-2026-09-07.json"))["rows"]}
amend = {b["group"]: b for b in json.load(open(f"{REPO}/docs/reviews/sunburst-heroes-release-5/lock-amendment-2026-09-16.json"))["bodies"]}
reg = {h["websiteSku"]: h for h in json.load(open(f"{REPO}/src/lib/products/catalog-heroes.json"))}
out = {}
for sku in ("GBTallCyl9GlMattSht", "GBTallCylFrst9GlMattSht"):
    ss = lock[sku]["shoulderSizing"]; target = amend[ss["group"]]["shoulderPercent"]
    f = target / ss["measuredPercent"]
    img = Image.open(f"{REPO}/public{reg[sku]['url']}").convert("RGB")
    a = np.asarray(img).astype(np.float64); top, x0, x1 = rl.extent(a)
    res = rl.resize_about_foot(img, f, (x0 + x1) / 2); res.save(f"{S}/legacy-slim/{sku}.png")
    b = np.asarray(res).astype(np.float64); t2, l2, r2 = rl.extent(b)
    corners = max(np.abs(c.reshape(-1, 3).mean(axis=0) - rl.BONE).max() for c in (b[:60, :60], b[:60, -60:], b[-60:, :60], b[-60:, -60:]))
    out[sku] = dict(fromUrl=reg[sku]["url"], measuredShoulderPercent=round(ss["measuredPercent"], 2), shoulderPercent=target,
                    factor=round(f, 4), topMarginPx=int(t2), leftMarginPx=int(l2), rightMarginPx=int(rl.CW - 1 - r2), cornersOff=round(float(corners), 2))
    print(sku, out[sku])
json.dump(out, open(f"{S}/legacy-slim/legacy-slim.json", "w"), indent=1)
