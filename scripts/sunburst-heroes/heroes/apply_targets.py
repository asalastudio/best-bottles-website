"""Turn Jordan's per-row target heights (review library decisions) into per-BODY targets for size_group.py, so one decision sizes every SKU that
shares the physical body (family × capacity × neck). Height is measured from the 91% baseline (1562) on the RAW Sunburst output with measure_hero:
bottle_with_fitment = base − top; glass_body / glass_shoulder = base − glass_top. Conflicts (same body, targets differing > 3%) resolve to the
median and are reported. usage: apply_targets.py <scratch> <handoff> <collection-id> [collection-id ...]  → heroes/targets.json + targets-report.json"""
import json, os, sys, collections, statistics
sys.path.insert(0, os.path.dirname(__file__)); from measure_hero import measure
S, H, *CIDS = sys.argv[1:]; OUT = f"{S}/heroes/out"; CANVAS_H = 1716
prod = {}
for p in json.load(open(f"{S}/convex-prod-enriched.json")):
    for k in ("websiteSku", "graceSku"):
        if p.get(k): prod[p[k]] = p
def body_key(sku):                                                    # same normalised key as size_group.py
    p = prod.get(sku, {}); cap = (p.get("capacity") or "").split(" (")[0].replace(" ", "").lower(); fam = (p.get("family") or "").lower().replace(" ", "-")
    tall = "tall-" if "Tall" in sku else ""
    return f"{tall}{fam}-{cap}-{p.get('neckThreadSize') or 'none'}" if p else sku
# scope overrides where the written note contradicts the dropdown (Jordan: "I set the height where the shoulders should be … top of the bottle, right below the cap")
SCOPE_OVERRIDE = {}
FORCE_SCOPE = "glass_body"   # 2026-09-10: Jordan's numbers are where the glass top / shoulder should sit (coherent with every "too small" note); the dropdown stayed at its default
wants = collections.defaultdict(list); decisions = []
for cid in CIDS:
    fb = json.load(open(f"{H}/hero-reviews/{cid}/feedback.json")); dec = fb.get("decisions") if isinstance(fb, dict) else fb
    for d in (dec.values() if isinstance(dec, dict) else dec):
        t = d.get("targetHeight")
        if not t or not t.get("heightPercent"): continue
        sku = d["sku"]; raw = f"{OUT}/{sku}.png"
        if not os.path.exists(raw): continue
        if any(x["sku"] == sku for xs in wants.values() for x in xs): [xs.remove(x) for xs in wants.values() for x in list(xs) if x["sku"] == sku]   # later card overrides
        m = measure(raw); scope = FORCE_SCOPE or SCOPE_OVERRIDE.get(sku, t.get("measurement")); pct = float(t["heightPercent"])
        cur = (m["base"] - m["top"]) if scope == "bottle_with_fitment" else (m["base"] - m["glass_top"])
        if cur <= 0: continue
        scale = (pct / 100 * CANVAS_H) / cur; target_w = m["body_w"] * scale
        wants[body_key(sku)].append(dict(sku=sku, pct=pct, scope=scope, cur_px=int(cur), cur_pct=round(cur / CANVAS_H * 100, 1), scale=round(scale, 3), target_w=round(target_w, 1), collection=cid))
# proposals (fit of Jordan's numbers vs physical glass height) for bodies he has not set — labelled, never mistaken for his
if os.path.exists(f"{S}/heroes/target-proposals.json"):
    have = {sku for xs in wants.values() for x in xs for sku in [x["sku"]]}
    for body, n, mm_, pct in json.load(open(f"{S}/heroes/target-proposals.json"))["proposals"]:
        if body in wants: continue
        members = [f[:-4] for f in os.listdir(OUT) if f.endswith(".png") and not f.endswith(".sized.png") and ".2080." not in f and body_key(f[:-4]) == body]
        est = []
        for sku in members:
            m = measure(f"{OUT}/{sku}.png"); cur = m["base"] - m["glass_top"]
            if cur > 0: est.append(m["body_w"] * (pct / 100 * CANVAS_H) / cur)
        if est: wants[body].append(dict(sku="(proposed)", pct=pct, scope="glass_body", cur_px=0, cur_pct=0, scale=1.0, target_w=round(float(statistics.median(est)), 1), collection="fit-proposal"))
# chat overrides: a body-level number Jordan gave in conversation (newest of all); measured on every member's raw output
CHAT = f"{S}/heroes/targets-chat.json"
if os.path.exists(CHAT):
    sizing = json.load(open(f"{OUT}/sizing.json")) if os.path.exists(f"{OUT}/sizing.json") else {}
    for o in json.load(open(CHAT)):
        members = [s for s, v in sizing.items() if v.get("group") == o["body"] and os.path.exists(f"{OUT}/{s}.png")]
        xs = []
        for s in members:
            m = measure(f"{OUT}/{s}.png"); cur = (m["base"] - m["glass_top"]) if o.get("scope", "glass_body") != "bottle_with_fitment" else (m["base"] - m["top"])
            if cur > 0: sc = (o["pct"] / 100 * CANVAS_H) / cur; xs.append(dict(sku=s, pct=float(o["pct"]), scope=o.get("scope", "glass_body"), cur_px=int(cur), cur_pct=round(cur / CANVAS_H * 100, 1), scale=round(sc, 3), target_w=round(m["body_w"] * sc, 1), collection="chat-override"))
        if xs: wants[o["body"]] = xs
CIDS = list(CIDS) + ["chat-override"]
targets = {}; report = []
for key, xs in wants.items():
    rank = {c: i for i, c in enumerate(CIDS)}; newest = max(rank.get(x.get("collection"), -1) for x in xs); xs = [x for x in xs if rank.get(x.get("collection"), -1) == newest]   # newest card wins per body
    ws = [x["target_w"] for x in xs]; med = statistics.median(ws); conflict = (max(ws) - min(ws)) / med > 0.03
    anchor = statistics.median([x["scale"] for x in xs])
    proposed = all(x["collection"] == "fit-proposal" for x in xs)
    targets[key] = dict(target_w=round(med, 1), anchor_scale=round(anchor, 4), anchors=[x["sku"] for x in xs if x["sku"] != "(proposed)"], target_pct=statistics.median([x["pct"] for x in xs]), source="proposed" if proposed else "jordan"); report.append(dict(body=key, target_body_w=round(med, 1), anchor_scale=round(anchor, 4), from_skus=xs, conflict=conflict))
json.dump(targets, open(f"{S}/heroes/targets.json", "w"), indent=1); json.dump(report, open(f"{S}/heroes/targets-report.json", "w"), indent=1)
print(f"{len(targets)} body targets from {sum(len(x) for x in wants.values())} decisions")
for r in sorted(report, key=lambda r: r["body"]):
    print(f"{r['body']:36s} target body {r['target_body_w']:6.0f}px  {'CONFLICT ' if r['conflict'] else ''}" + "; ".join(f"{x['sku']} {x['cur_pct']}%→{x['pct']}% ({x['scope']}, ×{x['scale']})" for x in r["from_skus"]))
