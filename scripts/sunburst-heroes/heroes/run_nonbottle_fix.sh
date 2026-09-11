#!/bin/zsh
set -u
W="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c"
S="${SUNBURST_SCRATCH:?set SUNBURST_SCRATCH to the lane scratch dir (was a session scratchpad)}"
H="/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff"
CID="sunburst-r3-corrections-nonbottle-2026-09-10"
cd "$W"; set -a; . ./.env.local; set +a
SK="$(python3 -c "import json;print(' '.join(j['sku'] for j in json.load(open('$S/heroes/jobs-nonbottle-fix.json'))))")"
for i in 0 1; do JOBS_FILE="$S/heroes/jobs-nonbottle-fix.json" FORCE_SKUS="$SK" nohup python3 "$S/heroes/hero_batch.py" "$S" $i 2 > "$S/heroes/nonbottle-fix-shard-$i.log" 2>&1 & done
sleep 5; while ps aux | grep -q "[h]ero_batch.py $S [01] 2$"; do sleep 10; done
cat "$S"/heroes/nonbottle-fix-shard-[01].log | grep -E ' PASS | FAIL |FAILED'
python3 "$S/heroes/regate_heroes.py" "$S" ${=SK} | tail -n 1
python3 "$S/heroes/size_group.py" "$S" "$S/heroes/out" 1562 "$S/heroes/targets.json" > "$S/heroes/size-r3.log" 2>&1; echo "re-sized $(grep -c ' base ' "$S/heroes/size-r3.log")"
python3 - "$S" "$H" "$CID" <<'PY'
import json,os,sys,shutil,subprocess
S,H,cid=sys.argv[1:4]; jobs=json.load(open(f"{S}/heroes/jobs-nonbottle-fix.json")); PUB=f"{S}/heroes/public/{cid}"
for d in ("sunburst-latest","prior"): os.makedirs(f"{PUB}/{d}",exist_ok=True)
sizing=json.load(open(f"{S}/heroes/out/sizing.json")); rows=[]
for j in jobs:
    sku=j["sku"]; rec=json.load(open(f"{S}/heroes/out/{sku}.png.json")); src=f"{S}/heroes/out/{sku}.sized.png"
    shutil.copy(src,f"{PUB}/sunburst-latest/{sku}.png"); shutil.copy(f"{S}/heroes/public/sunburst-all-heroes-latest-2026-09-09-r3/sunburst-latest/{sku}.png",f"{PUB}/prior/{sku}.png"); sz=sizing.get(sku,{})
    why="closure-only wording (r3 had invented a bottle)" if "CLOSURE ONLY" in j["material_clause"] else "material wording (r3 had turned the frosted / white plastic jar into clear glass)"
    notes=[f"r3 correction: re-rendered with {why}; the 'previous draft' is the r3 image", f"geometry gate {rec['verdict']}: height {rec['height_pct']:+.1f}%, left {rec.get('left_shift',0):+d}px",
           f"sizing: {sz.get('group')} scale {sz.get('scale')} baseline {sz.get('base_from')}→{sz.get('base_to')}"+(f" — {sz['flag']}" if sz.get('flag') else ""), f"model gpt-image-2.5-sunburst · ${rec.get('cost_usd',0):.3f}"]
    rows.append(dict(sku=sku,family=rec["family"],url=f"/sunburst-latest/{sku}.png",priorUrl=f"/prior/{sku}.png",title=sku,stage="visual-review",reviewNotes=notes))
json.dump(dict(rows=rows),open(f"{PUB}/manifest.json","w"),indent=1); print("manifest:",len(rows))
r=subprocess.run(["node",f"{H}/tools/hero-review/import.cjs","--id",cid,"--title","r3 corrections — closures and jars (closure-only / material wording)","--manifest",f"{PUB}/manifest.json","--public-root",PUB],capture_output=True,text=True); print([l.strip() for l in r.stdout.split("\n") if '"id"' in l or '"count"' in l] or r.stderr[-300:])
PY
