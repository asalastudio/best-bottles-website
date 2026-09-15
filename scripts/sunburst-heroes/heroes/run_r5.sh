#!/bin/zsh
# r5: material re-renders (atomizers, pump collar, funnel) → regate → size everything with Jordan's targets, lock respected → audit → import r5 master + a re-look card
set -u
W="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c"
S="${SUNBURST_SCRATCH:?set SUNBURST_SCRATCH to the lane scratch dir (was a session scratchpad)}"
cd "$W"; set -a; . ./.env.local; set +a
SK="$(python3 -c "import json;print(' '.join(j['sku'] for j in json.load(open('$S/heroes/jobs-material-fix.json'))))")"
for i in 0 1 2; do JOBS_FILE="$S/heroes/jobs-material-fix.json" FORCE_SKUS="$SK" nohup python3 "$S/heroes/hero_batch.py" "$S" $i 3 > "$S/heroes/material-fix-shard-$i.log" 2>&1 & done
sleep 5; while ps aux | grep -q "[h]ero_batch.py $S [012] 3$"; do sleep 10; done
cat "$S"/heroes/material-fix-shard-[012].log | grep -E ' PASS | FAIL |FAILED'
python3 "$S/heroes/regate_heroes.py" "$S" ${=SK} | tail -n 1
python3 "$S/heroes/size_group.py" "$S" "$S/heroes/out" 1562 "$S/heroes/targets.json" > "$S/heroes/size-r5.log" 2>&1
echo "sized: $(grep -c ' base ' "$S/heroes/size-r5.log"); locked: $(grep -c LOCKED "$S/heroes/size-r5.log"); target-applied: $(grep -c "Jordan's target" "$S/heroes/size-r5.log"); clearance: $(grep -c clearance "$S/heroes/size-r5.log")"
python3 - "$S" <<'PY'
import os,sys,numpy as np
from PIL import Image
S=sys.argv[1]; BONE=np.array([0xF5,0xF3,0xEF],float); tight=[]; n=0
for f in sorted(os.listdir(f"{S}/heroes/out")):
    if not f.endswith(".sized.png"): continue
    n+=1; a=np.asarray(Image.open(f"{S}/heroes/out/{f}").convert("RGB"),float); m=np.abs(a-BONE).max(axis=2)>45; ys,xs=np.where(m); l,r,t=int(xs.min()),int(1560-1-xs.max()),int(ys.min())
    if min(l,r,t)<24: tight.append((f[:-10],l,r,t))
print(f"margins: {len(tight)} of {n} tight"); [print("  ",x) for x in tight]
PY
echo "r5 prep done $(date +%H:%M:%S)"
