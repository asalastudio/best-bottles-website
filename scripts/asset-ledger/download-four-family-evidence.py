import json,pathlib,urllib.request,hashlib,concurrent.futures,threading
from PIL import Image
b=pathlib.Path('dist/paper-doll/four-family-plates-2026-09-13');data=json.loads((b/'evidence/index.json').read_text());urls=sorted({x['url'] for r in data['pages'] for x in r['gallery']});out=b/'evidence/gallery';out.mkdir(exist_ok=True);results=[]
def run(url):
 key=hashlib.sha256(url.encode()).hexdigest();p=out/(key+'.original');record=out/(key+'.json')
 try:
  if record.exists() and p.exists():return json.loads(record.read_text())
  with urllib.request.urlopen(url,timeout=25) as r:raw=r.read()
  p.write_bytes(raw)
  with Image.open(p) as im:wh=im.size;fmt=im.format;im.verify()
  d={'url':url,'file':str(p.relative_to(b)),'sha256':hashlib.sha256(raw).hexdigest(),'width':wh[0],'height':wh[1],'format':fmt};record.write_text(json.dumps(d));return d
 except Exception as e:return {'url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
 for r in pool.map(run,urls):
  results.append(r)
  if len(results)%100==0:print('images',len(results),'/',len(urls),flush=True)
(b/'evidence/gallery-index.json').write_text(json.dumps({'images':results,'counts':{'total':len(results),'downloaded':sum('sha256' in x for x in results),'failed':sum('error' in x for x in results)}},indent=2));print('done',len(results),flush=True)
