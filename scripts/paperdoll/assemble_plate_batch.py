#!/usr/bin/env python3
"""Assemble a kit-extraction batch from the published plate index.

Each productPlates row names the master PSD it was rendered from (source.path,
source.psdSha256) and the plate object (front.url/sha256). This downloads the
plates, verifies their hashes and the PSD hashes, and writes the batch layout
build_master_kits.py expects: plates/manifest.json, input/xref.json,
input/convex-snapshot.json. Registration is solved afterwards by
solve_plate_registration.py. Read-only against the deployment.

    python3 scripts/paperdoll/assemble_plate_batch.py --rows data/asset-ledger/boston-remaining-plates.json --catalog data/asset-ledger/boston-finish-components.json --out dist/paper-doll/boston-remaining-2026-09-16
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
from family_batch import MASTER
ap = argparse.ArgumentParser(); ap.add_argument('--rows', type=Path, required=True); ap.add_argument('--catalog', type=Path, required=True); ap.add_argument('--out', type=Path, required=True); args = ap.parse_args()
rows = json.load(open(args.rows)); catalog = json.load(open(args.catalog))
out = args.out; (out / 'plates').mkdir(parents=True, exist_ok=True); (out / 'input').mkdir(exist_ok=True)
manifest = []; products = []; xref = []; problems = []
for r in rows:
    if r.get('missing'): problems.append((r['sku'], 'no published plate')); continue
    src = r['source']; psd = MASTER / src['path']
    if not psd.exists(): problems.append((r['sku'], 'master PSD missing: ' + src['path'])); continue
    if hashlib.sha256(psd.read_bytes()).hexdigest() != src['psdSha256']: problems.append((r['sku'], 'master PSD hash drift')); continue
    key = f"{r['familyId']}/{r['sku']}.front-on.webp"; dest = out / 'plates' / key; dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists(): subprocess.run(['curl', '-sS', '-o', str(dest), r['front']['url']], check=True)
    if hashlib.sha256(dest.read_bytes()).hexdigest() != r['front']['sha256']: problems.append((r['sku'], 'plate hash drift')); continue
    cat = catalog.get(r['sku'], {})
    manifest.append({'websiteSku': r['sku'], 'graceSku': r['graceSku'], 'familyId': r['familyId'], 'body': 'published-' + r['familyId'], 'mode': 'published', 'publishable': True,
        'registrationSource': 'solved-from-plate',
        'plate': {'key': key, 'storeKey': r['front']['key'], 'sha256': r['front']['sha256'], 'bytes': r['front']['bytes'], 'width': 1000, 'height': 1100,
                  'sourceLibrary': src['library'], 'sourceRelPath': src['path'], 'sourceSha256': src['psdSha256'], 'sourceStateEvidence': 'plate index'}})
    products.append({'websiteSku': r['sku'], 'graceSku': r['graceSku'], 'applicator': cat.get('applicator'), 'color': cat.get('color'), 'capacityMl': cat.get('capacityMl'), 'neckThreadSize': cat.get('neck')})
    xref.append({'websiteSku': r['sku'], 'publishable': True, 'kitApplicability': 'applicable'})
json.dump({'builder': 'assemble_plate_batch.py', 'rows': manifest}, open(out / 'plates/manifest.json', 'w'), indent=1)
json.dump({'products': products}, open(out / 'input/convex-snapshot.json', 'w'), indent=1)
json.dump({'products': xref}, open(out / 'input/xref.json', 'w'), indent=1)
print(f"{len(manifest)} rows assembled → {out}; {len(problems)} problems")
for p in problems: print('  ', *p)
