#!/bin/zsh
# r3 prep: wait for the r2/v3 imports to finish → re-render 4 (colour refs + rebuilt Boston base) → regate them → size EVERYTHING with Jordan's
# body targets (group-centred placement) → margin + baseline audit. No import here; that happens after a visual check.
set -u
W="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c"
S="${SUNBURST_SCRATCH:?set SUNBURST_SCRATCH to the lane scratch dir (was a session scratchpad)}"
cd "$W"; set -a; . ./.env.local; set +a
while ps aux | grep -qE "[m]aster_collection_r2|[p]ackage_v3\.sh|[s]hadow_audit\.py"; do sleep 10; done; echo "r2/v3 imports finished at $(date +%H:%M:%S)"
SK="$(python3 -c "import json;print(' '.join(j['sku'] for j in json.load(open('$S/missing/jobs-recolour.json'))))")"
for i in 0 1; do JOBS_FILE="$S/missing/jobs-recolour.json" FORCE_SKUS="$SK" nohup python3 "$S/heroes/hero_batch.py" "$S" $i 2 > "$S/missing/recolour-shard-$i.log" 2>&1 & done
sleep 5; while ps aux | grep -q "[h]ero_batch.py $S [01] 2$"; do sleep 10; done
echo "=== recolour pass: $(cat "$S"/missing/recolour-shard-[01].log | grep -c ' PASS ') PASS / $(cat "$S"/missing/recolour-shard-[01].log | grep -c ' FAIL ') FAIL / $(cat "$S"/missing/recolour-shard-[01].log | grep -c FAILED) errors ==="; cat "$S"/missing/recolour-shard-[01].log | grep -E ' PASS | FAIL |FAILED'
python3 "$S/heroes/regate_heroes.py" "$S" ${=SK} | tail -n 2
python3 "$S/heroes/size_group.py" "$S" "$S/heroes/out" 1562 "$S/heroes/targets.json" > "$S/heroes/size-r3.log" 2>&1; echo "sized: $(grep -c ' base ' "$S/heroes/size-r3.log") rows; target-applied: $(grep -c "Jordan's target" "$S/heroes/size-r3.log"); clearance flags: $(grep -c 'clearance' "$S/heroes/size-r3.log"); wider flags: $(grep -c 'wider' "$S/heroes/size-r3.log")"
python3 - "$S" <<'PY'
import json,sys,os,numpy as np
from PIL import Image
S=sys.argv[1]; BONE=np.array([0xF5,0xF3,0xEF],float); tight=[]; n=0
for f in sorted(os.listdir(f"{S}/heroes/out")):
    if not f.endswith(".sized.png"): continue
    n+=1; a=np.asarray(Image.open(f"{S}/heroes/out/{f}").convert("RGB"),float); m=np.abs(a-BONE).max(axis=2)>45; ys,xs=np.where(m)
    l,r,t=int(xs.min()),int(1560-1-xs.max()),int(ys.min())
    if min(l,r,t)<24: tight.append((f[:-10],l,r,t))
print(f"margins after r3 sizing: {len(tight)} of {n} with any margin < 24px"); [print("  ",x) for x in tight]
PY
echo "r3 prep done at $(date +%H:%M:%S)"
