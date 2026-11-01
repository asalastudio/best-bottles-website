import json,urllib.request,hashlib,re,concurrent.futures,time
from pathlib import Path
root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31')
rows=json.load(open(root/'sources/catalog-production.json'))['rows'];out=root/'renders/before/catalog';out.mkdir(parents=True,exist_ok=True)
rows.sort(key=lambda p:(0 if p.get('family')=='Flair' else 1 if p.get('capacityMl')==5 else 2,p.get('websiteSku','')))
def get(p):
 sku=p.get('websiteSku') or p.get('graceSku') or p['_id'];url=p.get('imageUrl');safe=re.sub('[^a-zA-Z0-9_.-]','_',sku)
 meta=out/(safe+'.json')
 if meta.exists():return json.load(open(meta))
 r={'sku':sku,'url':url,'source':'production catalog image assignment; not a 3D verification'}
 try:
  if not isinstance(url,str) or not url.startswith('https://'):raise ValueError('No HTTPS image assigned')
  req=urllib.request.Request(url,headers={'User-Agent':'BestBottles-local-model-review/1.0'})
  with urllib.request.urlopen(req,timeout=25) as response:data=response.read();content=response.headers.get('content-type','')
  if 'image/' not in content:raise ValueError('Non-image response: '+content)
  ext={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/avif':'avif'}.get(content.split(';')[0],'image')
  f=out/(safe+'.'+ext);f.write_bytes(data);r.update(status='downloaded',path=str(f.relative_to(root)),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data))
 except Exception as e:r.update(status='unresolved',error=str(e))
 meta.write_text(json.dumps(r,indent=2));return r
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 for i,r in enumerate(pool.map(get,rows)):
  results.append(r)
  if i%100==0:print('CATALOG_IMAGES',i+1,len(rows),flush=True)
(root/'audit/catalog-before-images.json').write_text(json.dumps(results,indent=2));print('IMAGES_COMPLETE',len(results),sum(r['status']=='downloaded' for r in results),flush=True)
