#!/bin/bash
# Solve placements, map parts, extract kits, render the review sheet, write the
# approval file and dry-run the publisher for one assembled family batch.
#   scripts/paperdoll/run_family_kit_chain.sh <family-slug> <Family Name> [reviewer]
set -u
slug="$1"; name="$2"; reviewer="${3:-Jordan Richter, chat 2026-09-16 ('the kit is built, so that is how it is going to be… just the white background needs to be removed'); layer roles by geometry: Claude Fable 5.1}"
B="dist/paper-doll/${slug}-2026-09-16"; PY=/opt/homebrew/bin/python3
echo "=== $name ($B)"
if [ -n "${WAIT_PID:-}" ]; then
  # a solver already running for this batch (started by an earlier chain): wait for it
  while kill -0 "$WAIT_PID" 2>/dev/null; do sleep 15; done
else
  $PY scripts/paperdoll/solve_plate_registration.py --batch "$B" --from-batch dist/paper-doll/boston-master --fine > "$B/solve.log" 2>&1
fi
echo "solver: $(grep -c '^solved' "$B/solve.log") solved, $(grep -c '^FAILED' "$B/solve.log") failed"
$PY scripts/paperdoll/family_part_map.py --batch "$B" --reviewer "$reviewer" 2>&1 | tail -2
rm -rf "$B/kits"
$PY scripts/paperdoll/build_master_kits.py --batch "$B" --part-map "$B/part-map.json" 2>&1 | tail -1
$PY scripts/paperdoll/kit_review_sheet.py --batch "$B" --out "public/reviews/builder-bodies-2026-09-14/${slug}-kits-2026-09-16.jpg"
node -e '
const fs=require("fs"); const [B,slug,name]=process.argv.slice(1); const m=JSON.parse(fs.readFileSync(B+"/kits/manifest.json")); const skus={}; for(const r of m.rows) if(r.status==="candidate") skus[r.sku]=r.plateSha256;
const st={}; for(const r of m.rows) if(r.status!=="candidate"){ const k=(r.reason||"").replace(/ValueError: |KeyError: |RuntimeError: /,"").slice(0,70); st[k]=(st[k]||0)+1; } console.log("held:", JSON.stringify(st));
fs.writeFileSync(B+"/kits/approval.json", JSON.stringify({release:`${slug}-master-kits-2026-09-16`, ship:`ship ${name} kit release 2026-09-16`, approvedBy:"PENDING — Jordan Richter", approvedAt:null, reviewSheet:`/reviews/builder-bodies-2026-09-14/${slug}-kits-2026-09-16.jpg`, skus},null,1)+"\n"); console.log("approval prepared", Object.keys(skus).length);' "$B" "$slug" "$name"
set -a; source .env.local; set +a
node scripts/paperdoll/publish-master-kits.mjs --batch "$B" 2>&1 | grep -E "DRY|candidates|verified|Ready|publish-master-kits:"
