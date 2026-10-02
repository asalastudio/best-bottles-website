"""v2 deterministic hero bases for product groups with no registry hero — registry convention: roller/pump FITTED, cap standing LOOSE beside the
bottle on the same baseline (as the PSD photographed it). Rules: prefer the UNCAPPED PSD of the same file name when the chosen one is a capped shot;
visible, non-full-bleed pixel layers only; body = largest such layer that is not a near-white cleanup patch; fitted = layers centred over the body
(patches dropped); loose = other layers whose bottom sits within 5% of body height of the body's bottom; everything else dropped and printed.
Composite in PSD z-order (verified against Photoshop's own flatten). Scale: body mid-width → same-body sibling's SIZED Sunburst hero; body bottom at
1562; bottle+cap group centred at x=780 (registry: group cx = 780). No AI here."""
import json, os, sys, glob, numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage
sys.path.insert(0, f"{sys.argv[1]}/heroes"); from measure_hero import measure
S, LIB = sys.argv[1:3]; BONE = (245, 243, 239); OUT = f"{S}/missing/built-v2"; os.makedirs(OUT, exist_ok=True)
groups = json.load(open(f"{S}/missing/missing-groups.json")); prod = {}
for p in json.load(open(f"{S}/convex-prod-enriched.json")):
    for k in ("websiteSku", "graceSku"):
        if p.get(k): prod[p[k]] = p
body_of = lambda p: (p.get("family"), (p.get("capacity") or "").split(" (")[0], p.get("neckThreadSize") or "")
sib = {}
for f in os.listdir(f"{S}/heroes/out"):
    if f.endswith(".png.json") and ".2080." not in f:
        sku = f[:-9]; p = prod.get(sku); sized = f"{S}/heroes/out/{sku}.sized.png"
        if p and os.path.exists(sized) and "Tsl" not in sku: sib.setdefault(body_of(p), sized)
def band_width(mask, y0, y1): ws = [np.ptp(np.where(r)[0]) + 1 for r in mask[y0:y1] if r.sum() >= 3]; return float(np.percentile(ws, 90)) if ws else 0
def prefer_uncapped(rel):
    if "ncapped" in rel.lower() or "napped" in rel.lower(): return rel
    base = os.path.basename(rel); d = os.path.dirname(rel)
    for up in range(1, 5):                                          # same file name in an (Uncapped) branch up to 4 folders up
        d = os.path.dirname(d)
        for c in glob.glob(os.path.join(LIB, d, *(["*"] * up), base)):
            r = os.path.relpath(c, LIB).lower()
            if ("ncapped" in r or "napped" in r) and "(capped)" not in r: return os.path.relpath(c, LIB)
    return rel
jobs = []; skipped = []
for g in groups:
    if not g["psd"] or not g["rep_sku"]: continue
    p = prod[g["rep_sku"]]; sp = sib.get(body_of(p))
    if not sp: skipped.append((g["rep_sku"], f"no sized sibling hero for {body_of(p)}")); continue
    rel = prefer_uncapped(g["psd"]); psd = PSDImage.open(os.path.join(LIB, rel)); layers = []
    for l in psd.descendants():                                   # psd-tools order = file order = bottom → top
        if l.is_group() or l.kind != "pixel" or l.name == "Background" or not l.visible: continue
        im = l.topil()
        if im is None: continue
        im = im.convert("RGBA"); arr = np.array(im); a = arr[..., 3]; ys, xs = np.where(a > 24)
        if not len(xs): continue
        full = (l.bbox[2] - l.bbox[0]) >= psd.width and (l.bbox[3] - l.bbox[1]) >= psd.height
        op = a > 128; white = float((arr[..., :3].min(axis=2)[op] > 235).mean()) if op.any() else 0.0
        layers.append(dict(name=l.name, im=im, off=l.bbox[:2], bb=(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), full=full, white=white))
    usable = [c for c in layers if not c["full"]]
    if not usable: skipped.append((g["rep_sku"], "only full-bleed layers")); continue
    box = lambda c: (c["off"][0] + c["bb"][0], c["off"][1] + c["bb"][1], c["off"][0] + c["bb"][2], c["off"][1] + c["bb"][3])
    cands = [c for c in usable if c["white"] < 0.85] or usable
    body = max(cands, key=lambda c: (c["bb"][2] - c["bb"][0]) * (c["bb"][3] - c["bb"][1])); bx0, by0, bx1, by1 = box(body); bh = by1 - by0
    fitted, loose, dropped = [], [], []
    for c in usable:
        if c is body: continue
        x0, y0, x1, y1 = box(c); cx = (x0 + x1) / 2
        if bx0 < cx < bx1: (dropped if c["white"] >= 0.85 else fitted).append(c)
        elif abs(y1 - by1) <= 0.05 * bh: loose.append(c)
        else: dropped.append(c)
    parts = [c for c in usable if c is body or c in fitted or c in loose]          # keeps PSD z-order
    X0 = min(box(c)[0] for c in parts); Y0 = min(box(c)[1] for c in parts); X1 = max(box(c)[2] for c in parts); Y1 = max(box(c)[3] for c in parts)
    cut = Image.new("RGBA", (X1 - X0, Y1 - Y0), (0, 0, 0, 0))
    for c in parts:
        x0, y0, x1, y1 = box(c); tile = c["im"].crop(c["bb"])
        if c in fitted:                                            # cleanup-patch wings: near-white pixels outside the body's x-range are not product
            arr = np.array(tile); xs_abs = np.arange(x0, x1)[None, :].repeat(arr.shape[0], 0)
            wing = (arr[..., :3].min(axis=2) > 225) & ((xs_abs < bx0) | (xs_abs >= bx1)); arr[wing, 3] = 0; tile = Image.fromarray(arr)
        cut.alpha_composite(tile, (x0 - X0, y0 - Y0))
    # z-order check against Photoshop's flatten inside the parts window (both on white)
    ref = psd.composite().convert("RGB").crop((X0, Y0, X1, Y1)); mine = Image.new("RGB", cut.size, (255, 255, 255)); mine.paste(cut, mask=cut)
    zdiff = float(np.abs(np.asarray(ref, float) - np.asarray(mine, float)).mean())
    bodym = np.array(body["im"])[..., 3] > 128; pw = band_width(bodym, int(0.35 * bh) + body["bb"][1] - 0, int(0.65 * bh) + body["bb"][1])
    m = measure(sp); s = m["body_w"] / pw
    if not 0.2 < s < 5: skipped.append((g["rep_sku"], f"implausible scale {s:.2f} (body {pw:.0f}px, sibling {m['body_w']:.0f}px)")); continue
    t = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS); canvas = Image.new("RGBA", (1560, 1716), BONE + (255,))
    x = 780 - t.width / 2; y = 1562 - (by1 - Y0) * s; flag = ""
    if y < 40: flag = f"too tall at sibling scale (top {int(y)})"
    canvas.alpha_composite(t, (int(round(x)), int(round(y)))); out = f"{OUT}/{g['rep_sku']}.png"; canvas.convert("RGB").save(out)
    jobs.append(dict(sku=g["rep_sku"], family=p.get("family"), hero=out, group=g["group"], n=g["n"], psd=rel, sibling=os.path.basename(sp), scale=round(s, 3),
                     body=body["name"], fitted=[c["name"] for c in fitted], loose=[c["name"] for c in loose], dropped=[f"{c['name']}(w{c['white']:.2f})" for c in dropped], zdiff=round(zdiff, 2), flag=flag))
    print(f"{g['rep_sku']:26} {'UNCAPPED' if rel != g['psd'] else '        '} body {body['name']:9} fitted {[c['name'] for c in fitted]} loose {[c['name'] for c in loose]} dropped {[c['name'] for c in dropped]}  scale {s:.3f}  zdiff {zdiff:.2f}  {flag}")
for sku, why in skipped: print(f"{sku:26} SKIPPED — {why}")
json.dump(jobs, open(f"{S}/missing/jobs-v2.json", "w"), indent=1); print(f"\n{len(jobs)} bases built, {len(skipped)} skipped")
tiles = [Image.open(j["hero"]).convert("RGB").resize((260, 286)) for j in jobs]; cols = 7; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 270 + 10, rows * 316 + 10), (235, 233, 229)); d = ImageDraw.Draw(sheet)
for i, (t, j) in enumerate(zip(tiles, jobs)): x = 10 + (i % cols) * 270; y = 10 + (i // cols) * 316; sheet.paste(t, (x, y + 24)); d.text((x, y + 6), f"{j['sku'][:22]} ×{j['scale']}", fill=(30, 30, 30))
sheet.save(f"{S}/missing/built-v2-sheet.png"); print("built-v2-sheet.png", sheet.size)
