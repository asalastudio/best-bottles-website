#!/usr/bin/env python3
"""Prepare four isolated family batches serially, verify, and recount after each.

Resume only this dated preparation. Never publishes, approves, changes master
files or replaces current indexed plates. Stop on failed checks/count drift.
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
BATCH=ROOT/'dist/paper-doll/four-family-plates-2026-09-13'
FAMILIES=['Elegant','Diva','Circle','Sleek']
PYTHON='/opt/homebrew/bin/python3'
baseline=json.loads((BATCH/'ledger-before.json').read_text())
progress={'id':'four-family-plates-2026-09-13','status':'preparing','reviewUrl':None,'families':FAMILIES,'preparedFamilies':[]}
steps=json.loads((BATCH/'steps.json').read_text()) if (BATCH/'steps.json').exists() else []
progress['preparedFamilies']=[step['preparationAfter'] for step in steps]

def run(args,log):
    print('Running',log,flush=True)
    with (BATCH/log).open('w') as f:subprocess.run(args,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,check=True,env={**os.environ,'PYTHONUNBUFFERED':'1','PATH':'/opt/homebrew/bin:'+os.environ['PATH']})

def validate(folder):
    manifest=json.loads((folder/'plates/manifest.json').read_text());seen=set()
    for row in manifest['rows']:
        if row['websiteSku'] in seen:raise ValueError('Duplicate candidate SKU')
        seen.add(row['websiteSku'])
        for role in ['plate','thumb','plateCapOff','thumbCapOff']:
            a=row.get(role)
            if not a:continue
            p=folder/'plates'/a['key']
            if not p.resolve().is_relative_to((folder/'plates').resolve()) or hashlib.sha256(p.read_bytes()).hexdigest()!=a['sha256']:raise ValueError('Candidate bytes changed')
            with Image.open(p) as im:
                if im.size!=(a['width'],a['height']):raise ValueError('Candidate dimensions differ')
                im.verify()
            master=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master');s=master/a['sourceRelPath']
            if a['sourceLibrary']!='master' or not s.resolve().is_relative_to(master.resolve()):raise ValueError('Non-master source')
            if hashlib.sha256(s.read_bytes()).hexdigest()!=a['sourceSha256']:raise ValueError('Source changed')
    return manifest['rows']

for family in FAMILIES:
    folder=BATCH/family.lower()
    if any(step['family']==family for step in steps):
        validate(folder);validate(folder/'recovery')
        print('Already verified',family,flush=True)
        continue
    if not (folder/'input/xref.json').exists():run([PYTHON,'scripts/paperdoll/family_batch.py','--family',family,'--catalog',str(BATCH/'catalog.json'),'--out',str(folder),'--stage','prepare'],family.lower()+'-prepare.log')
    xref_path=folder/'input/xref.json';xref=json.loads(xref_path.read_text())
    preserved=[r for r in baseline['rows'] if r['family']==family and r['productRecord'] and r['plate']['complete']]
    approved={r['sku'] for r in preserved};(folder/'preserved.json').write_text(json.dumps(preserved))
    for row in xref['products']:
        if row['websiteSku'] in approved:row['publishable']=False;row['blockReasons']=['preserve_approved_current_plate']
    xref_path.write_text(json.dumps(xref,indent=1))
    if not (folder/'plates/manifest.json').exists():run([PYTHON,'scripts/paperdoll/family_batch.py','--family',family,'--catalog',str(BATCH/'catalog.json'),'--out',str(folder),'--stage','plates'],family.lower()+'-render.log')
    if not (folder/'source-similarity.json').exists():run([PYTHON,'scripts/asset-ledger/score-family-master-sources.py',family.lower()],family.lower()+'-source-scores.log')
    if not (folder/'recovery/plates/manifest.json').exists():
        run([PYTHON,'scripts/asset-ledger/reconcile-family-review-input.py','--batch',str(BATCH),'--family',family],family.lower()+'-recovery-prepare.log')
        run([PYTHON,'scripts/paperdoll/family_batch.py','--family',family,'--catalog',str(BATCH/'catalog.json'),'--out',str(folder/'recovery'),'--stage','plates'],family.lower()+'-recovery-render.log')
    candidates=validate(folder)+validate(folder/'recovery')
    if len({r['websiteSku'] for r in candidates})!=len(candidates):raise ValueError('Primary/recovery candidate overlap')
    original=next(r for r in baseline['platePlan']['families'] if r['family']==family)
    duplicates=sum(r['family']==family for r in json.loads((BATCH/'proposed-duplicate-dispositions.json').read_text())['rows'])
    summary={'family':family,'catalogRows':original['total'],'preserved':len(preserved),'candidates':sum(bool(r.get('plate')) for r in candidates),'paired':sum(bool(r.get('plateCapOff')) for r in candidates),'holds':original['total']-len(preserved)-sum(bool(r.get('plate')) for r in candidates)-duplicates,'duplicateProposals':duplicates}
    progress['preparedFamilies'].append(summary)
    (ROOT/'data/asset-ledger/four-family-plate-progress.json').write_text(json.dumps(progress,indent=2)+'\n')
    before=json.loads((ROOT/'src/lib/asset-ledger/ledger.json').read_text())
    run(['/bin/zsh','-c','python3 scripts/asset-ledger/measure-plates.py && npm run ledger:build'],family.lower()+'-ledger-check.log')
    after=json.loads((ROOT/'src/lib/asset-ledger/ledger.json').read_text())
    if after['generatedAt']==before['generatedAt'] or after['platePlan']['counts']!=baseline['platePlan']['counts']:raise ValueError('Unexpected ledger movement; investigate before continuing')
    if after['platePlan']['preparedReview']!=progress:raise ValueError('Prepared counts did not reach the ledger')
    steps.append({'family':family,'before':next(r for r in before['platePlan']['families'] if r['family']==family),'after':next(r for r in after['platePlan']['families'] if r['family']==family),'preparationAfter':summary,'ledgerAt':after['generatedAt']})
    (BATCH/'steps.json').write_text(json.dumps(steps,indent=2)+'\n')
    print('FAMILY VERIFIED',json.dumps(steps[-1]),flush=True)
print('FOUR FAMILIES PREPARED. Combined review assembly still required.',flush=True)
