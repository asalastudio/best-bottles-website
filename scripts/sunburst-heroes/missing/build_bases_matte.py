"""Composite-matte bases for groups whose PSD layers are NOT isolated (product photographed on white inside a layer). Source = Photoshop's own
flatten (psd.composite(), z-order respected) → non-white matte (min RGB < 238, closing 3, holes filled) → connected components: body = tallest;
loose = components whose bottom sits within 5% of body height of the body's bottom (the cap standing beside); everything else dropped. Scale, baseline
and centring exactly as build_bases_v2. Writes into missing/built-v2 and updates jobs-v2.json (method=composite-matte). No AI here."""
import json, os, sys, numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage
from scipy import ndimage
sys.path.insert(0, f"{sys.argv[1]}/heroes"); from measure_hero import measure
S, LIB = sys.argv[1:3]; SKUS = sys.argv[3:]; BONE = (245, 243, 239); OUT = f"{S}/missing/built-v2"
groups = {g["rep_sku"]: g for g in json.load(open(f"{S}/missing/missing-groups.json")) if g.get("rep_sku")}
jobs = json.load(open(f"{S}/missing/jobs-v2.json")); byjob = {j["sku"]: j for j in jobs}
def band_width(mask, y0, y1): ws = [np.ptp(np.where(r)[0]) + 1 for r in mask[y0:y1] if r.sum() >= 3]; return float(np.percentile(ws, 90)) if ws else 0
tiles = []
for sku in SKUS:
    j = byjob[sku]; psd = PSDImage.open(os.path.join(LIB, j["psd"])); comp = psd.composite().convert("RGB"); arr = np.asarray(comp)
    m = arr.min(axis=2) < 238; m = ndimage.binary_closing(m, iterations=3); m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m); comps = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < 0.002 * m.size: continue
        comps.append(dict(id=i, x0=int(xs.min()), y0=int(ys.min()), x1=int(xs.max()) + 1, y1=int(ys.max()) + 1, area=len(xs)))
    if not comps: print(f"{sku:26} no components"); continue
    body = max(comps, key=lambda c: c["y1"] - c["y0"]); bh = body["y1"] - body["y0"]
    loose = [c for c in comps if c is not body and abs(c["y1"] - body["y1"]) <= 0.05 * bh]
    dropped = [c for c in comps if c is not body and c not in loose]
    keep = np.isin(lab, [body["id"]] + [c["id"] for c in loose])
    X0 = min(c["x0"] for c in [body] + loose); Y0 = min(c["y0"] for c in [body] + loose); X1 = max(c["x1"] for c in [body] + loose); Y1 = max(c["y1"] for c in [body] + loose)
    rgba = np.dstack([arr, (keep * 255).astype(np.uint8)])[Y0:Y1, X0:X1]; cut = Image.fromarray(rgba, "RGBA")
    bodym = (lab == body["id"])[body["y0"]:body["y1"], body["x0"]:body["x1"]]; pw = band_width(bodym, int(0.35 * bh), int(0.65 * bh))
    mm = measure(f"{S}/heroes/out/{j['sibling']}"); s = mm["body_w"] / pw
    if not 0.2 < s < 5: print(f"{sku:26} implausible scale {s:.2f} — left as is"); continue
    t = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS); canvas = Image.new("RGBA", (1560, 1716), BONE + (255,))
    x = 780 - t.width / 2; y = 1562 - (body["y1"] - Y0) * s; flag = f"too tall at sibling scale (top {int(y)})" if y < 40 else ""
    canvas.alpha_composite(t, (int(round(x)), int(round(y)))); canvas.convert("RGB").save(j["hero"])
    j.update(method="composite-matte", scale=round(s, 3), body="matte:tallest-component", fitted=[], loose=[f"component@x{c['x0']}-{c['x1']}" for c in loose],
             dropped=[f"component@x{c['x0']}-{c['x1']}y{c['y0']}-{c['y1']}" for c in dropped], flag=flag)
    print(f"{sku:26} comps {len(comps)}  body {body['x1']-body['x0']}x{bh}  loose {len(loose)}  dropped {len(dropped)}  scale {s:.3f}  {flag}")
    a = comp.resize((int(comp.width * 420 / comp.height), 420)); b = Image.open(j["hero"]).convert("RGB").crop((250, 150, 1310, 1650)); b = b.resize((int(b.width * 420 / b.height), 420))
    tile = Image.new("RGB", (a.width + b.width + 12, 440), (255, 255, 255)); tile.paste(a, (0, 20)); tile.paste(b, (a.width + 12, 20)); ImageDraw.Draw(tile).text((3, 4), f"{sku}: Photoshop flatten (left) → matte base (right)", fill=(0, 0, 0)); tiles.append(tile)
json.dump(jobs, open(f"{S}/missing/jobs-v2.json", "w"), indent=1)
if tiles:
    W = max(t.width for t in tiles); sheet = Image.new("RGB", (W, sum(t.height for t in tiles)), (225, 225, 225)); y = 0
    for t in tiles: sheet.paste(t, (0, y)); y += t.height
    sheet.save(f"{S}/missing/matte-bases-sheet.png"); print("matte-bases-sheet.png", sheet.size)
