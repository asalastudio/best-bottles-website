import json,urllib.request,hashlib
from pathlib import Path
from PIL import Image
import numpy as np
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/empire-completion-pilot';s=json.loads((O/'source-register.json').read_text());out={}
for id,c in s['components'].items():
 l=next(x for x in c['layers'] if x['slot']=='sprayer');b=urllib.request.urlopen(l['url']).read();p=O/(id+'.png');p.write_bytes(b);a=np.array(Image.open(p).convert('RGBA'))[:,:,3];ys,xs=np.where(a>10)
 out[id]={'layer':l,'visibleBottom':int(ys.max()+1),'visibleTop':int(ys.min()),'sha256':hashlib.sha256(b).hexdigest()};print(id,l['width'],l['height'],'bottom',ys.max()+1)
(O/'sprayer-registration.json').write_text(json.dumps(out,indent=2))
