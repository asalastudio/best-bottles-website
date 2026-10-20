from pathlib import Path
from psd_tools import PSDImage
import json,hashlib
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/diva46-spray-completion';root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images/2. 18-415 Bottles');records=[]
source=json.loads((R/'src/lib/register/local-diva46-tubes.json').read_text())
for sku in source['plates'][0]['websiteSkus']+source['plates'][1]['websiteSkus']:
 files=[p for p in root.rglob('*'+sku+'.psd') if '31. Capped &' not in str(p)];assert files,sku
 selected=None;inventory=[]
 for p in sorted(files):
  psd=PSDImage.open(p);layers=[{'index':i,'name':l.name,'bbox':list(l.bbox),'visible':l.visible,'kind':l.kind} for i,l in enumerate(psd)]
  receipt={'path':str(p),'sha256':hashlib.file_digest(open(p,'rb'),'sha256').hexdigest(),'size':list(psd.size),'layers':layers};inventory.append(receipt)
  if selected is None or len(psd)>selected[0]:selected=(len(psd),psd,receipt)
 selected[1].topil().save(O/(sku+'-source.png'));records.append({'websiteSku':sku,'masters':inventory,'selected':selected[2]['path'],'preview':sku+'-source.png'})
(O/'psd-sources.json').write_text(json.dumps(records,indent=2));print('Inspected',sum(len(r['masters']) for r in records),'masters for',len(records),'exact SKUs')
