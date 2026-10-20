from pathlib import Path
from psd_tools import PSDImage
import json,hashlib
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/diva46-two-bottle-pilot';root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images/2. 18-415 Bottles');records=[]
for sku in ['GBDiva46SpryShnSl','GBDivaFrst46SpryShnSl']:
 files=[p for p in root.rglob('*'+sku+'.psd') if '31. Capped &' not in str(p)]
 for i,p in enumerate(sorted(files)):
  psd=PSDImage.open(p);psd.topil().save(O/f'{sku}-source-{i}.png');layers=[]
  for n,l in enumerate(psd):layers.append({'index':n,'name':l.name,'bbox':list(l.bbox),'visible':l.visible,'kind':l.kind})
  records.append({'websiteSku':sku,'path':str(p),'sha256':hashlib.file_digest(open(p,'rb'),'sha256').hexdigest(),'size':list(psd.size),'layers':layers,'preview':f'{sku}-source-{i}.png'})
(O/'psd-sources.json').write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
