#!/bin/zsh
# v2 missing-groups pass: locked Sunburst edit on every v2 base (forced re-render), v6 regate, size, shadow audit, package, import as a NEW collection.
set -u
W="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c"
S="${SUNBURST_SCRATCH:?set SUNBURST_SCRATCH to the lane scratch dir (was a session scratchpad)}"
H="/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff"
CID="sunburst-v2-missing-groups-2026-09-09"
cd "$W"; set -a; . ./.env.local; set +a
SK="$(python3 -c "import json;print(' '.join(j['sku'] for j in json.load(open('$S/missing/jobs-v2.json'))))")"
for i in 0 1 2; do JOBS_FILE="$S/missing/jobs-v2.json" FORCE_SKUS="$SK" nohup python3 "$S/heroes/hero_batch.py" "$S" $i 3 > "$S/missing/v2-shard-$i.log" 2>&1 & done
sleep 5; while ps aux | grep -q "[h]ero_batch.py $S [012] 3$"; do sleep 15; done
echo "=== v2 missing-groups pass: $(cat "$S"/missing/v2-shard-[012].log | grep -c ' PASS ') PASS / $(cat "$S"/missing/v2-shard-[012].log | grep -c ' FAIL ') FAIL / $(cat "$S"/missing/v2-shard-[012].log | grep -c FAILED) errors ==="
python3 "$S/heroes/regate_heroes.py" "$S" ${=SK}
python3 - "$S" "$H" "$CID" <<'PY'
import json,os,sys,shutil,subprocess
S,H,cid=sys.argv[1:4]; jobs=json.load(open(f"{S}/missing/jobs-v2.json")); skus=[j["sku"] for j in jobs]; PUB=f"{S}/heroes/public/{cid}"
for d in ("sunburst-v1","prior"): os.makedirs(f"{PUB}/{d}",exist_ok=True)
subprocess.run(["python3",f"{S}/heroes/size_group.py",S,f"{S}/heroes/out","1562"],capture_output=True,text=True); sizing=json.load(open(f"{S}/heroes/out/sizing.json"))
subprocess.run(["python3",f"{S}/heroes/shadow_audit.py",S],capture_output=True,text=True); shadows=json.load(open(f"{S}/heroes/shadow-audit.json"))
groups={j["sku"]:j for j in jobs}; rows=[]
for sku in skus:
    jp=f"{S}/heroes/out/{sku}.png.json"
    if not os.path.exists(jp): print("missing render",sku); continue
    rec=json.load(open(jp)); src=f"{S}/heroes/out/{sku}.sized.png" if os.path.exists(f"{S}/heroes/out/{sku}.sized.png") else f"{S}/heroes/out/{sku}.png"
    shutil.copy(src,f"{PUB}/sunburst-v1/{sku}.png"); shutil.copy(rec["hero"],f"{PUB}/prior/{sku}.png"); sz=sizing.get(sku,{}); sh=shadows.get(sku,{}); g=groups[sku]
    how="Photoshop-flatten matte (layers not isolated)" if g.get("method")=="composite-matte" else "PSD layers in z-order"
    pres="roller fitted, cap standing beside (registry convention)" if g.get("loose") else "as the PSD shows it (cap on / no loose cap layer)"
    notes=[f"NEW hero v2 — this product group had no registry hero; base built from {os.path.basename(g['psd'])} via {how}; {pres}; scaled to sibling {g['sibling']} (×{g['scale']}); the 'previous draft' is that deterministic base",
           f"group: {' | '.join(str(x) for x in g['group'])} ({g['n']} SKUs)",
           f"geometry gate {rec.get('verdict')}: top {rec.get('top_shift',0):+d}px, left {rec.get('left_shift',0):+d}px — note: the base carries no shadow, so a left shift here is usually the contact-shadow feather; mid-body glass edges were checked separately",
           f"sizing: {sz.get('group')} scale {sz.get('scale')} baseline {sz.get('base_from')}→{sz.get('base_to')}"+(f" — {sz['flag']}" if sz.get('flag') else ""),
           f"shadow {'conforms' if sh.get('ok') else 'OUTSIDE spec'}: contact {sh.get('contact')}, cast {sh.get('cast_depth')} toward {sh.get('clock')} o'clock, floating {sh.get('floating')}"]
    if g.get("flag"): notes.append(f"builder flag: {g['flag']}")
    rows.append(dict(sku=sku,family=rec["family"],url=f"/sunburst-v1/{sku}.png",priorUrl=f"/prior/{sku}.png",title=sku,stage="visual-review",reviewNotes=notes))
json.dump(dict(rows=rows),open(f"{PUB}/manifest.json","w"),indent=1); print("manifest:",len(rows),"rows")
r=subprocess.run(["node",f"{H}/tools/hero-review/import.cjs","--id",cid,"--title","Sunburst 2.5 heroes v2 — NEW heroes for product groups that had none (roller fitted, cap beside; PSD-built base → Sunburst, sized, locked shadow)","--manifest",f"{PUB}/manifest.json","--public-root",PUB],capture_output=True,text=True); print([l.strip() for l in r.stdout.split("\n") if '"id"' in l or '"count"' in l] or r.stderr[-400:])
PY
