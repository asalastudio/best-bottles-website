from pathlib import Path
import json,copy
batch=Path('docs/reviews/tulip-amber-tube-2026-11-01')
source=json.loads(Path('public/local-kits/tulip-shoulder-2026-11-01/kits.json').read_text())
source['rows']={s:k for s,k in source['rows'].items() if s.startswith('GBTulipAmb5Spry')}
updated=copy.deepcopy(source)
for sku,kit in updated['rows'].items():
    for p in kit['parts']:
        if p['slot']=='diptube' and p.get('views')==['sidecar','capon']:
            p['blendMode']='multiply'
            p['opacity']=0.5
    assert [p for p in kit['parts'] if p['slot']!='diptube' or p.get('views')==['exploded']]==[p for p in source['rows'][sku]['parts'] if p['slot']!='diptube' or p.get('views')==['exploded']]
out=Path('public/local-kits/tulip-amber-tube-2026-11-01');out.mkdir(parents=True,exist_ok=True)
(out/'kits.json').write_text(json.dumps(updated,indent=2)+'\n')
(batch/'after-kits.json').write_text(json.dumps(updated,indent=2)+'\n')
print('Updated',len(updated['rows']),'amber seated tube treatments')
