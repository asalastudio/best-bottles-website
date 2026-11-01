from pathlib import Path
import json,hashlib,urllib.request,concurrent.futures,re
r=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31');rows=json.loads((r/'sources/catalog-production.json').read_text())['rows'];by={x.get('websiteSku') or x.get('graceSku'):x for x in rows};orig=json.loads((r/'audit/catalog-before-images.json').read_text());refs={}
for x in rows:
 for c in (x.get('components') or []):
  if c.get('grace_sku') and c.get('image_url'):refs.setdefault(c['grace_sku'],set()).add(c['image_url'])
def get(a):
 if a['status']=='downloaded':return a
 row=by.get(a['sku'],{});urls=[row.get('legacyShopifyImageUrl')]+sorted(refs.get(row.get('graceSku'),[]));urls=[u for u in urls if u and u!=a.get('url')];errors=[]
 for url in urls:
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'BestBottlesLocalReview/1.0'});f=urllib.request.urlopen(req,timeout=20);b=f.read();mime=f.headers.get_content_type()
   if not(mime.startswith('image/') and len(b)>500):raise ValueError('Not a usable image response')
   ext='.png' if b.startswith(b'\x89PNG') else '.gif' if b.startswith(b'GIF') else '.jpg' if b.startswith(b'\xff\xd8') else '.webp';dest=r/'renders/before/catalog'/(re.sub('[^a-zA-Z0-9_.-]+','_',a['sku'])+'-legacy-reference'+ext);dest.write_bytes(b)
   return {**a,'originalAssignment':a,'url':url,'status':'downloaded-legacy-reference','source':'Legacy exact-SKU/component reference from catalog source data; current catalog assignment unavailable','path':str(dest.relative_to(r)),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
  except Exception as e:errors.append(str(e))
 return {**a,'fallbackErrors':errors,'fallbackUrlsTried':urls}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:out=list(pool.map(get,orig))
(r/'audit/catalog-before-images-v2.json').write_text(json.dumps(out,indent=2));print('PICTURES',sum(bool(x.get('path')) for x in out),'LEGACY_FALLBACKS',sum(x['status']=='downloaded-legacy-reference' for x in out),'MISSING',sum(not x.get('path') for x in out),flush=True)
