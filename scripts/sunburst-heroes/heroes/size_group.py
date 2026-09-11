"""Deterministic same-size normalization for finished heroes (post-process, no AI): within each family × capacity group, scale every hero uniformly about
its own baseline so its glass body width equals the group TARGET (default: the group's median), then translate so the baseline sits at BASELINE_Y.
Re-matted onto bone by colour distance (soft edge). Writes <sku>.sized.png + a JSON of factors; refuses factors outside [0.5, 2.0].
usage: size_group.py <scratch> <in-dir> <baseline_y> [targets.json]"""
import json, os, sys, collections, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__)); from measure_hero import measure
S, IN, BASE_Y = sys.argv[1], sys.argv[2], int(sys.argv[3]); H = 1716;
LOCK = json.load(open(f"{S}/heroes/approved-lock.json")) if os.path.exists(f"{S}/heroes/approved-lock.json") else {}
targets = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
BONE = (245, 243, 239); prod = {}
import re
reg = json.load(open("src/lib/products/catalog-heroes.json")); rows = reg if isinstance(reg, list) else reg.get("rows") or list(reg.values()); slug = {}
for r in rows:
    if isinstance(r, dict):
        for k in ("websiteSku", "graceSku"):
            if r.get(k): slug[r[k]] = r.get("groupSlug") or ""
def body_key(sku, p):
    if p.get("family") and p.get("capacity"):                          # normalised: family-capacity-neck from Convex, same for registry and new heroes
        cap = (p.get("capacity") or "").split(" (")[0].replace(" ", "").lower(); fam = (p.get("family") or "").lower().replace(" ", "-")
        tall = "tall-" if (slug.get(sku, "").startswith("tall-") or "Tall" in sku) else ""          # Tall Rectangle / Tall Cylinder are different bodies from their footed siblings
        return f"{tall}{fam}-{cap}-{p.get('neckThreadSize') or 'none'}"
    m = re.match(r"^(.*?)-(\d+(?:\.\d+)?ml)-(.*?)-(\d+-\d+|\d+mm)", slug.get(sku, ""))
    return f"{m.group(1)}-{m.group(2)}-{m.group(4)}" if m else sku
for p in json.load(open(f"{S}/convex-prod-enriched.json")):
    for k in ("websiteSku", "graceSku"):
        if p.get(k): prod[p[k]] = p
recs = []
for f in sorted(os.listdir(IN)):
    if not f.endswith(".png") or f.endswith(".sized.png") or ".2080." in f: continue
    sku = f[:-4]; p = prod.get(sku, {}); m = measure(f"{IN}/{f}")
    # satin-aware base: frosted glass is invisible to the strong ruler, which then reads the FITMENT's bottom as the base. Take the lowest row where a
    # soft mask (>12 from bone) still has pixels within ±200px of the bottle's centre; if that is >40px below the strong base, the strong base was wrong.
    _a = np.abs(np.array(Image.open(f"{IN}/{f}").convert("RGB")).astype(float) - np.array(BONE)).max(axis=2); _soft = _a > 12
    _cx = int(m["cx"]); _win = _soft[:, max(0, _cx - 200):_cx + 200]; _rows = np.where(_win.sum(axis=1) >= 5)[0]
    if len(_rows) and _rows.max() - m["base"] > 40: m["base_strong"] = m["base"]; m["base"] = int(_rows.max()) - 3; m["satin"] = True
    recs.append(dict(sku=sku, family=p.get("family"), cap=(p.get("capacity") or "").split(" (")[0], neck=p.get("neckThreadSize") or "", path=f"{IN}/{f}", **m))
groups = collections.defaultdict(list); [groups[body_key(x["sku"], prod.get(x["sku"], {}))].append(x) for x in recs]; out = {}
for key, xs in groups.items():
    tg = targets.get(key); explicit = tg is not None
    target = (tg["target_w"] if isinstance(tg, dict) else tg) if explicit else float(np.median([x["body_w"] for x in xs]))
    s_ref = (tg.get("anchor_scale") if isinstance(tg, dict) else None) or float(np.median([target / x["body_w"] for x in xs]))   # Jordan's own row(s) define the scale; siblings whose ruler disagrees >15% (frosted, shaped, tassel) take it
    anchors = set(tg.get("anchors", [])) if isinstance(tg, dict) else set()
    pct = tg.get("target_pct") if isinstance(tg, dict) else None
    sib = [target / x["body_w"] for x in xs if x["sku"] not in anchors]; s_sib = float(np.median(sib)) if sib else s_ref   # siblings' own ratios (Jordan's rows excluded)
    for x in xs:
        if x["sku"] in LOCK:
            import shutil as _sh; _sh.copy(LOCK[x["sku"]]["file"], f"{IN}/{x['sku']}.sized.png"); out[x["sku"]] = dict(group=key, n=len(xs), scale=1.0, body_w=x["body_w"], target=None, base_from=x["base"], base_to=x["base"], flag="LOCKED: approved by Jordan on this exact image; copied untouched"); continue
        s = target / x["body_w"]; flag = ""
        if explicit and x["sku"] not in anchors:
            # own ratio is the truth unless the width ruler was blind on this SKU: accept it if it agrees with the siblings (±12%) or lands the glass top near Jordan's % ; else use the siblings' median
            pred = (x["base"] - x["glass_top"]) * s / H * 100 if pct else None
            agrees_sib = len(sib) > 1 and abs(s / s_sib - 1) <= 0.12; agrees_h = pred is not None and abs(pred - pct) <= 6
            if not (agrees_sib or agrees_h): flag = f"ruler unreliable on this SKU (own ×{s:.3f}; siblings ×{s_sib:.3f}; glass top would land at {pred:.0f}% vs target {pct}%) — siblings' ratio used"; s = s_sib
        if explicit and not 0.4 <= s <= 2.5: flag = f"REVIEW: explicit target implies ×{s:.3f} — outside 0.4–2.5, not applied"; s = 1.0
        elif not explicit and abs(s - 1) > 0.08: flag = f"REVIEW: measured {s:.3f} — not applied (tassel/loose-cap measurement or a different body); baseline only"; s = 1.0
        who = "PROPOSED target (fit of Jordan's numbers vs glass height — not his decision)" if isinstance(tg, dict) and tg.get("source") == "proposed" else "Jordan's target"
        if explicit and not flag: flag = f"{who} applied to the body group (×{s:.3f})"
        elif explicit and flag.startswith("ruler unreliable"): flag = f"Jordan's target applied to the body group (×{s:.3f}); " + flag
        if BASE_Y - (x["base"] - x["top"]) * s < 24:                                       # hard cap: nothing may scale past the canvas top
            s_cap = (BASE_Y - 24) / max(x["base"] - x["top"], 1); flag = (flag + " | " if flag else "") + f"CAPPED ×{s:.3f}→×{s_cap:.3f}: this size would clip the top — fitted to the canvas instead; check by eye"; s = s_cap
        img = Image.open(x["path"]).convert("RGB"); W, H = img.size
        # cut the bottle on a soft alpha from colour distance, scale about (cx, base), place base at BASE_Y
        a = np.clip((np.abs(np.array(img).astype(float) - np.array(BONE)).sum(axis=2) - 8) / 24, 0, 1); rgba = np.dstack([np.array(img), (a * 255).astype(np.uint8)])
        cut = Image.fromarray(rgba, "RGBA"); cut = cut.resize((round(W * s), round(H * s)), Image.LANCZOS)
        # horizontal placement: centre the WHOLE product group (bottle + any loose cap / tassel), measured on the strong mask so the light cast shadow is ignored
        diff = np.abs(np.array(img).astype(float) - np.array(BONE)).max(axis=2); strong = diff > 45
        soft = diff > 12; soft[max(0, x["base"] - 80):, :] = False          # satin glass counts for the group extent; the shadow rows at the base do not
        gxs = np.where((strong | soft).any(axis=0))[0]
        gcx = (gxs.min() + gxs.max()) / 2 if len(gxs) else x["cx"]; gw = (gxs.max() - gxs.min() + 1) * s if len(gxs) else 0
        if gw > W - 48:                                                                    # hard cap: nothing past the sides either
            s_cap = s * (W - 48) / gw; flag = (flag + " | " if flag else "") + f"CAPPED ×{s:.3f}→×{s_cap:.3f}: group wider than the canvas at that size ({gw:.0f}px) — fitted instead; check by eye"
            s = s_cap; gw = W - 48; cut = Image.fromarray(rgba, "RGBA").resize((round(W * s), round(H * s)), Image.LANCZOS)
        hanging = (x.get("family") in ("Sprayer", "Dropper", "Lotion Pump")) and "Roll" not in x["sku"]   # dip-tube products do not stand on a base: keep the render's vertical placement
        if hanging: flag = (flag + " | " if flag else "") + "hanging product (dip tube): vertical placement kept from the render, not anchored to the baseline"
        canvas = Image.new("RGBA", (W, H), BONE + (255,)); dx = round(W / 2 - gcx * s); dy = 0 if hanging else round(BASE_Y - x["base"] * s); canvas.alpha_composite(cut, (dx, dy)) if dx >= 0 and dy >= 0 else canvas.alpha_composite(cut.crop((max(0, -dx), max(0, -dy), cut.width, cut.height)), (max(0, dx), max(0, dy)))
        canvas.convert("RGB").save(x["path"][:-4] + ".sized.png"); out[x["sku"]] = dict(group=key, n=len(xs), scale=round(s, 4), body_w=x["body_w"], target=round(target, 1), base_from=x["base"], base_to=BASE_Y, group_cx=round(float(gcx)), satin_base=bool(x.get("satin")), flag=(flag + " | " if flag else "") + "satin-aware base (strong ruler had read the fitment as the base)" if x.get("satin") else flag)
        print(f"{x['sku']:24} {key[:30]:30} body {x['body_w']:.0f}→{target:.0f}px  scale {s:.3f}  base {x['base']}→{BASE_Y}  {flag}")
json.dump(out, open(f"{IN}/sizing.json", "w"), indent=1)
