"""Render only Step 1's existing, preflighted sources; never rebuild or publish."""
import collections, hashlib, json, os, shutil, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'scripts/paperdoll'))
from build_plates import source_of
DATA=ROOT/'data/paper-doll'
pre=json.loads((HERE/'preflight.json').read_text())
xref=json.loads((DATA/'xref.json').read_text())
selection=json.loads((DATA/'selection.json').read_text())
snapshot=json.loads((HERE/'catalog.json').read_text())
by_sku={p['websiteSku']:p for p in snapshot['products'] if p.get('websiteSku')}
allowed={r['sku'] for r in pre['pass']}
issues={r['sku']:r['reasons'] for r in pre['issues']}
report=[]
for fid in pre['families']:
    batch=ROOT/'dist/paper-doll/step1-grouping-2026-09-12'/fid
    inp=batch/'input';inp.mkdir(parents=True,exist_ok=True)
    rows=[dict(r) for r in xref['products'] if r.get('publishable') and r.get('familyId')==fid]
    for row in rows:
        sku=row['websiteSku']; row['publishable']=sku in allowed
        if not row['publishable']: row['blockReasons']=issues[sku]
        else:
            row['graceSku']=by_sku[sku].get('graceSku')
            entry=selection['stems'][row['stemKey']]
            for state in ('on','part','unknown','off'):
                src=source_of(entry,state)
                if src and hashlib.sha256(src['path'].read_bytes()).hexdigest()!=src['sha256']:
                    row['publishable']=False;row['blockReasons']=['source_hash_changed'];break
    family=rows[0]['family']
    (inp/'inventory.json').write_text(json.dumps({'scope':family,'note':'Step 1 copies existing selection; no inventory or source reclassification.'}))
    for name in ('selection.json','tokens.json','sources.json'):
        shutil.copyfile(DATA/name,inp/name)
    (inp/'xref.json').write_text(json.dumps({**xref,'products':rows},indent=1))
    cmd=[sys.executable,'-u',str(ROOT/'scripts/paperdoll/family_batch.py'),'--family',family,'--catalog',str(HERE/'catalog.json'),'--out',str(batch),'--stage','plates']
    print(f"START {fid}: {sum(r['publishable'] for r in rows)}/{len(rows)} pass",flush=True)
    with (batch/'render.log').open('w') as log:
        result=subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
    manifest=batch/'plates/manifest.json'
    rec={'familyId':fid,'scope':len(rows),'preflightPass':sum(r['publishable'] for r in rows),'exitCode':result.returncode,'batch':str(batch),'holds':[{'sku':r['websiteSku'],'reasons':r['blockReasons']} for r in rows if not r['publishable']]}
    if manifest.exists():rec['counts']=json.loads(manifest.read_text())['counts']
    report.append(rec);(HERE/'render-report.json').write_text(json.dumps(report,indent=1))
    print(json.dumps(rec.get('counts',{'exitCode':result.returncode})),flush=True)
    if result.returncode:
        print((batch/'render.log').read_text()[-3500:],flush=True)
        break
