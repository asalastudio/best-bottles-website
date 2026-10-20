from pathlib import Path
import json,urllib.request,hashlib,concurrent.futures
from PIL import Image
from io import BytesIO
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-spray-completion';P=R/'output/round78-two-bottle-pilot'
s=json.loads((O/'development-snapshot.json').read_text());source=json.loads((R/'src/lib/register/local-round78-tubes.json').read_text());pairs=[]
urls=set()
for p in s['register']['plates'].values():urls.add(p['url'])
for c in source['components']:
 for l in c['layers']:urls.add(l['url'])
cache=O/'image-cache';cache.mkdir(exist_ok=True)
def one(url):
 data=urllib.request.urlopen(url,timeout=50).read();h=hashlib.sha256(data).hexdigest();(cache/(h+'.png')).write_bytes(data);im=Image.open(BytesIO(data));return url,{'file':h+'.png','sha256':h,'bytes':len(data),'size':list(im.size)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: index=dict(ex.map(one,urls))
(O/'image-cache-index.json').write_text(json.dumps(index,indent=2))
for c in source['components']:
 l=next(l for l in c['layers'] if l['slot']=='sprayer');skus=[a['websiteSku'] for a in s['register']['assemblies'].values() if any(p['componentId']==c['componentId'] for p in a['parts'])];assert len(skus)==2
 if c['componentId']=='CMP-SPR-SHSL-18-415-06':continue
 pairs.append({'websiteSkus':skus,'componentId':c['componentId'],'sprayerUrl':l['url'],'sprayerHeight':l['height'],'solidBottomY':l['solidBottomY']})
(O/'planned-joins.json').write_text(json.dumps(pairs,indent=2));print('Cached',len(index),'original image sources; planned',len(pairs),'new finish joins')
