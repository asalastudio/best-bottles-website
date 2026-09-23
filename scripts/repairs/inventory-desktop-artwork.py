"""Read-only exact-name inventory. Candidates remain unapproved until visually matched."""
import json,re,sys
from pathlib import Path
source=Path(sys.argv[1])
desktop=Path('/Users/jordanrichter/Desktop/Best Bottles')
master=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
groups=json.loads((source/'production/pdp-groups.json').read_text())
skus={v['websiteSku'] for g in groups.values() for v in g['variants'] if v.get('websiteSku')}
by_lower={s.lower():s for s in skus}
rows=[];count=0
for p in desktop.rglob('*'):
 if p.suffix.lower() not in ['.psd','.psb','.png','.jpg','.jpeg','.webp','.tif','.tiff'] or not p.is_file():continue
 count+=1
 name=re.sub(r'^\d+\s*[.\-]?\s*','',p.stem).strip().lower()
 sku=by_lower.get(name)
 if not sku:continue
 row={'sku':sku,'path':str(p),'bytes':p.stat().st_size,'status':'exact-name candidate; visual and layer comparison required'}
 rows.append(row)
existing=json.loads((source/'master-source-candidates.json').read_text())
master_skus={r['sku'] for r in existing['rows'] if r.get('candidates')}
desktop_skus={r['sku'] for r in rows}
report={'roots':{'desktop':str(desktop),'master':str(master)},'desktopMediaFiles':count,'scopedSkuCount':len(skus),
 'masterExactNameSkus':len(master_skus),'desktopExactNameSkus':len(desktop_skus),'additionalDesktopCandidateSkus':sorted(desktop_skus-master_skus),
 'note':'These are distinct directories, not aliases. Preserve both source sets. Filename matching locates candidates; existing reviewed layer assignments remain authoritative. No source files were modified.',
 'rows':rows}
Path('data/repairs/four-family-components-2026-09-22/desktop-artwork-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
