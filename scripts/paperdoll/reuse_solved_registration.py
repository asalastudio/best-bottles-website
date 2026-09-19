#!/usr/bin/env python3
"""Reuse a registration already solved for the exact plate bytes being published.

solve_plate_registration.py recovers a plate's PSD-to-canvas placement by
searching for it. When a batch on disk rendered that plate and its manifest
records the same sha256, the placement is not something to recover: it is
recorded, exactly, in that batch's registration file. Re-deriving it costs
minutes per row and can only land back on the same answer or a worse one.

Each reused row is given its own body key, `reused-<batch>-<body>`, and its own
registration file carrying only that source's entries. Two batches are never
merged into one file, so a scale baseline from one can never be applied to a
plate from the other.

    python3 scripts/paperdoll/reuse_solved_registration.py --batch BATCH --reuse reg-reuse.json
"""
import argparse, json, shutil
from collections import defaultdict
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--batch', type=Path, required=True)
ap.add_argument('--reuse', type=Path, required=True)
ap.add_argument('--apply', action='store_true')
args = ap.parse_args()

batch = args.batch.resolve()
reuse = json.loads(args.reuse.read_text())
manifest_path = batch / 'plates/manifest.json'
manifest = json.loads(manifest_path.read_text())

# group the rows by the file they will read, so each is written once
groups = defaultdict(list)
for row in manifest['rows']:
    hit = reuse.get(row['websiteSku'])
    if hit:
        groups[(hit['reg'], hit['body'], row['familyId'])].append(row['websiteSku'])

written, adopted = 0, {}
for (reg_path, body, family_id), skus in sorted(groups.items()):
    source = json.loads(Path(reg_path).read_text())
    batch_name = Path(reg_path).parts[-3] if len(Path(reg_path).parts) >= 3 else 'unknown'
    new_body = f"reused-{batch_name}-{body}"
    keep = {f"{s}.front-on": source['plates'][f"{s}.front-on"] for s in skus if f"{s}.front-on" in source['plates']}
    if len(keep) != len(skus):
        raise SystemExit(f"{reg_path}: {len(skus) - len(keep)} plate entries missing; refusing to guess")
    out = dict(source, body=new_body, plates=keep,
               reusedFrom={'file': reg_path, 'body': body,
                           'why': 'the batch that rendered these exact plate bytes recorded this placement'})
    dest = batch / 'plates' / family_id / f"_registration-{new_body}.json"
    if args.apply:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(out, indent=1))
    written += 1
    for s in skus:
        adopted[s] = new_body

for row in manifest['rows']:
    body = adopted.get(row['websiteSku'])
    if body:
        row['body'] = body
        # not solved from the plate: the solver must leave this row alone
        row['registrationSource'] = 'reused-from-batch'

if args.apply:
    shutil.copy(manifest_path, manifest_path.with_suffix('.json.before-reuse'))
    manifest_path.write_text(json.dumps(manifest, indent=1))

print(f"{'wrote' if args.apply else 'would write'} {written} registration file(s) covering {len(adopted)} rows")
print(f"rows still to solve: {sum(1 for r in manifest['rows'] if r.get('registrationSource') == 'solved-from-plate')}")
