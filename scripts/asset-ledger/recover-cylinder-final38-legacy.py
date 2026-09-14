import json,hashlib,re,urllib.request,concurrent.futures
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
R=Path('docs/reviews/cylinder-final38-2026-09-13');out=R/'legacy-media';out.mkdir(exist_ok=True)
pages=json.loads((R/'legacy-products.json').read_text())['pages']+[json.loads((R/f'legacy-refresh-{i}.json').read_text()) for i in [1,2,3]]
jobs=[]
for p in pages:
 sku=re.search(r'^# (.+)$',p['markdown'],re.M).group(1).strip();url=p.get('url') or p['metadata'].get('sourceURL');imgs=list(dict.fromkeys(re.findall(r'<img[^>]+src="([^"]+)"',p['html'])));imgs=[u for u in imgs if any(x in u for x in ['/enlarged_pics/','/capped/','/aerial/'])]
 for u in imgs:jobs.append({'sku':sku,'pageUrl':url,'url':u,'pageHtmlSha256':hashlib.sha256(p['html'].encode()).hexdigest()})
def get(j):
 raw=urllib.request.urlopen(j['url'],timeout=45).read();h=hashlib.sha256(raw).hexdigest();f=out/(h+Path(j['url']).suffix);f.write_bytes(raw);im=Image.open(f);return {**j,'sha256':h,'file':str(f),'width':im.width,'height':im.height,'format':im.format,'frames':getattr(im,'n_frames',1)}
with concurrent.futures.ThreadPoolExecutor(6) as pool:res=list(pool.map(get,jobs))
(R/'legacy-media.json').write_text(json.dumps({'rows':res},indent=2));print('Recovered',len(res),'views for',len(set(j['sku'] for j in res)),'exact SKUs')
for batch in range((len(res)+15)//16):
 canvas=Image.new('RGB',(1200,1400),'#eee')
 for i,j in enumerate(res[batch*16:batch*16+16]):
  im=Image.open(j['file']).convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);im=bg.convert('RGB');im.thumbnail((280,300));x=i%4*300;y=i//4*350;canvas.paste(im,(x+(300-im.width)//2,y));d=ImageDraw.Draw(canvas);d.text((x+5,y+305),j['sku'],fill='black');d.text((x+5,y+325),j['url'].split('/')[-2],fill='black')
 canvas.save(R/f'legacy-views-{batch+1}.jpg')
