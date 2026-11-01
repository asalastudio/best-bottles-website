from pathlib import Path
import json, hashlib, shutil, urllib.request, datetime
from psd_tools import PSDImage
root=Path.cwd();d=root/'docs/reviews/cylinder9-pumps-rollers-2026-11-01';s=d/'sources';base=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master')
config=json.loads((root/'data/paper-doll/CYL-9ML/configurations.json').read_text());kits=json.loads((root/'public/local-kits/cylinder9-masters-2026-11-01/kits.json').read_text());rows=kits['rows']
shutil.copy2(root/'public/local-kits/cylinder9-masters-2026-11-01/kits.json',d/'before-kits.json');shutil.copy2(root/'src/lib/products/cylinder9-master-index.json',d/'before-index.json')
meta=[]
for sku in ['LBCyl9LtnBlk','LBCyl9LtnGl','LBCyl9LtnMtSl','GBCyl9MtlRollBlkDot','GBCyl9RollBlkDot']:
 p=next(p for p in base.rglob('*.psd') if p.stem.endswith(sku) and 'Uncapped' in str(p));psd=PSDImage.open(p)
 psd.composite().save(s/(sku+'-source.png'))
 layers=[]
 for i,l in enumerate(psd):
  if l.name=='Layer 0':continue
  file=sku+'-layer-'+str(i)+'.png';l.composite().save(s/file);layers.append({'name':l.name,'file':file,'bbox':list(l.bbox),'visible':l.visible})
 parts=[]
 for i,piece in enumerate(rows[sku]['parts']):
  url=piece['image']['url'];file=sku+'-registered-'+str(i)+'-'+piece['slot']+'.png'
  if url.startswith('http'):b=urllib.request.urlopen(url,timeout=30).read()
  else:b=(root/'public'/url.lstrip('/')).read_bytes()
  (s/file).write_bytes(b);parts.append({'file':file,'url':url,'sha256':hashlib.sha256(b).hexdigest(),'part':piece})
 meta.append({'sku':sku,'psd':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'layers':layers,'parts':parts})
(d/'source-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'skus':len(meta),'sources':len(list(s.glob('*')))}))
