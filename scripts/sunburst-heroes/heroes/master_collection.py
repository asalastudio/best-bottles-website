"""One review collection with EVERY registry hero's latest Sunburst version (sized), prior hero beside it, gate + sizing + shadow notes per row.
usage: master_collection.py <scratch> <collection-id> <title>   (run after all lanes are quiet; sizes + audits everything first)"""
import json, os, sys, shutil, subprocess, collections
S, cid, title = sys.argv[1:4]; OUT = f"{S}/heroes/out"; PUB = f"{S}/heroes/public/{cid}"; H = "/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff"
for d in ("sunburst-latest", "prior"): os.makedirs(f"{PUB}/{d}", exist_ok=True)
subprocess.run(["python3", f"{S}/heroes/regate_heroes.py", S], capture_output=True, text=True)
sizing = json.load(open(f"{OUT}/sizing.json"))  # r2: sizing already re-run with group-centred placement
subprocess.run(["python3", f"{S}/heroes/shadow_audit.py", S], capture_output=True, text=True); shadows = json.load(open(f"{S}/heroes/shadow-audit.json"))
rows = []; fam = collections.Counter()
targets_report = {r["body"]: r for r in json.load(open(f"{S}/heroes/targets-report.json"))} if os.path.exists(f"{S}/heroes/targets-report.json") else {}
LOCK = json.load(open(f"{S}/heroes/approved-lock.json")) if os.path.exists(f"{S}/heroes/approved-lock.json") else {}
newjobs = {j["sku"]: j for j in json.load(open(f"{S}/missing/jobs-v2.json"))}   # the 29 NEW heroes (groups that had no registry hero) join the master
for f in sorted(os.listdir(OUT)):
    if not f.endswith(".png.json") or ".2080." in f: continue
    rec = json.load(open(f"{OUT}/{f}")); sku = rec["sku"]; src = f"{OUT}/{sku}.sized.png" if os.path.exists(f"{OUT}/{sku}.sized.png") else f"{OUT}/{sku}.png"
    if not os.path.exists(src): continue
    shutil.copy(src, f"{PUB}/sunburst-latest/{sku}.png"); shutil.copy(rec["hero"], f"{PUB}/prior/{sku}.png"); sz = sizing.get(sku, {}); sh = shadows.get(sku, {}); tassel = "Tsl" in sku
    notes = [f"r5: material re-renders (aluminum atomizers, pump collar, funnel); Jordan's 2026-09-10 approvals LOCKED (copied untouched); targets from r3/r4 cards applied per body; whole product group centred (r1 pushed 63 loose caps/tassels off the canvas); sizing = Jordan's target heights (2026-09-10, read as glass base → glass top / shoulder at the 91% baseline) applied per physical body, so every SKU sharing a body moved together; amber/cobalt cylinders re-rendered with the cobalt/amber references; GBBstn2ozMtlRollGl rebuilt with its metal roller", f"geometry gate {rec['verdict']}: height {rec['height_pct']:+.1f}%, left {rec.get('left_shift', 0):+d}px, base {rec['base_shift']:+d}px",
             f"sizing: body group {sz.get('group')} (n={sz.get('n')}), scale {sz.get('scale')}, baseline {sz.get('base_from')}→{sz.get('base_to')}" + (f" — {sz['flag']}" if sz.get("flag") else ""),
             "shadow: tassel beside the bottle — judge by eye" if tassel else f"shadow {'conforms' if sh.get('ok') else 'OUTSIDE spec'}: contact {sh.get('contact')}, cast {sh.get('cast_depth')} toward {sh.get('clock')} o'clock, feather {sh.get('feather')}, floating {sh.get('floating')}",
             f"model gpt-image-2.5-sunburst · ${rec.get('cost_usd', 0):.3f}"]
    tr = targets_report.get(sz.get("group"))
    if sku in LOCK: notes.insert(0, f"LOCKED — approved by Jordan on {LOCK[sku]['card']} on this exact image; carried untouched into every later issue")
    if tr: notes.insert(0, f"target: glass top at {sorted(set(x['pct'] for x in tr['from_skus']))} % of the canvas for body {tr['body']} — set by Jordan on {', '.join(x['sku'] for x in tr['from_skus'])}" + (" — CONFLICTING numbers on the same body, median used" if tr.get("conflict") else ""))
    if sku in newjobs:
        g = newjobs[sku]; how = "Photoshop-flatten matte (layers not isolated)" if g.get("method") == "composite-matte" else "PSD layers in z-order"
        pres = "roller fitted, cap standing beside (registry convention)" if g.get("loose") else "as the PSD shows it (cap on / no loose cap layer)"
        notes.insert(0, f"NEW hero — this product group ({' | '.join(str(x) for x in g['group'])}, {g['n']} SKUs) had no registry hero; base built from {os.path.basename(g['psd'])} via {how}; {pres}; scaled to sibling {g['sibling']} (×{g['scale']}); the 'previous draft' is that deterministic base, so a gate left-shift here is usually the contact-shadow feather")
    rows.append(dict(sizingLocked=(sku in LOCK), sku=sku, family=rec["family"], url=f"/sunburst-latest/{sku}.png", priorUrl=f"/prior/{sku}.png", title=sku, stage="visual-review", reviewNotes=notes)); fam[rec["family"]] += 1
json.dump(dict(rows=rows), open(f"{PUB}/manifest.json", "w"), indent=1); print(f"manifest: {len(rows)} heroes across {len(fam)} families")
r = subprocess.run(["node", f"{H}/tools/hero-review/import.cjs", "--id", cid, "--title", title, "--manifest", f"{PUB}/manifest.json", "--public-root", PUB], capture_output=True, text=True)
print([l.strip() for l in r.stdout.split("\n") if '"id"' in l or '"count"' in l] or r.stderr[-300:])
