#!/bin/zsh
set -u
S="${SUNBURST_SCRATCH:?set SUNBURST_SCRATCH to the lane scratch dir (was a session scratchpad)}"
H="/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff"
W="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c"
cd "$S/heroes" && python3 apply_targets.py "$S" "$H" sunburst-v2-missing-groups-2026-09-09 sunburst-all-heroes-latest-2026-09-09-r3 sunburst-all-heroes-latest-2026-09-09-r4 2>&1 | grep -v Warning | head -1
cd "$W" && python3 "$S/heroes/size_group.py" "$S" "$S/heroes/out" 1562 "$S/heroes/targets.json" > "$S/heroes/size-r5.log" 2>&1
echo "sized rows logged: $(grep -c ' base ' "$S/heroes/size-r5.log"); capped: $(grep -c CAPPED "$S/heroes/size-r5.log")"; grep CAPPED "$S/heroes/size-r5.log" | sed 's/  */ /g' | cut -c1-200
grep -E 'TallRect10|GBRect10RollBlkDot' "$S/heroes/size-r5.log" | sed 's/  */ /g' | cut -c1-150
python3 - "$S" <<'PY'
import os,sys,json,hashlib,numpy as np
from PIL import Image
S=sys.argv[1]; BONE=np.array([0xF5,0xF3,0xEF],float); tight=[]; n=0
for f in sorted(os.listdir(f"{S}/heroes/out")):
    if not f.endswith(".sized.png"): continue
    n+=1; a=np.asarray(Image.open(f"{S}/heroes/out/{f}").convert("RGB"),float); m=np.abs(a-BONE).max(axis=2)>45; ys,xs=np.where(m); l,r,t=int(xs.min()),int(1560-1-xs.max()),int(ys.min())
    if min(l,r,t)<24: tight.append((f[:-10],l,r,t))
print(f"margins: {len(tight)} of {n} tight"); [print("  ",x) for x in tight]
lock=json.load(open(f"{S}/heroes/approved-lock.json")); ok=sum(1 for s,v in lock.items() if hashlib.sha256(open(f"{S}/heroes/out/{s}.sized.png",'rb').read()).hexdigest()==v['sha256']); print(f"lock intact: {ok}/{len(lock)}")
PY
echo "r5c done $(date +%H:%M:%S)"
