from pathlib import Path
from psd_tools import PSDImage
import json,hashlib,urllib.request,re
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-two-bottle-pilot');root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images/2. 18-415 Bottles');out=[]
for folder,sub,sku in [('9. Round 78ml','1. Round 78ml PSD','GBRnd78SpryShnSl'),('8. Round 78ml Frosted','1. Round Frst 78ml Psd','GBRndFrst78SpryShnSl')]:
 path=root/folder/sub/f'29. {sku}.psd';psd=PSDImage.open(path);layers=[]
 for i,l in enumerate(psd):
  layers.append({'index':i,'name':l.name,'bbox':l.bbox});
  if i==2:l.composite().save(O/(sku+'-source-tube.png'))
 psd.composite().save(O/(sku+'-source.png'))
 out.append({'sku':sku,'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'layers':layers});print(sku,layers)
(O/'psd-sources.json').write_text(json.dumps(out,indent=2))
urls=['https://www.bestbottles.com/product/round-design-78-ml-glass-bottle-shiny-silver-spray-and-cap','https://nematinternational.com/products/bottles/classic_perfume_spray_bottles.php']
for i,url in enumerate(urls):
 try:
  b=urllib.request.urlopen(url,timeout=40).read();(O/f'legacy-{i}.html').write_bytes(b)
  h=b.decode(errors='replace');print('legacy',url,len(b));
  if i==0:
   print('frosted links',re.findall(r'href=["\']([^"\']*(?:frost|Frst)[^"\']*)',h)[:20]);print('images',re.findall(r'(?:src|data-original)=["\']([^"\']*(?:Rnd|round)[^"\']*)',h)[:15])
 except Exception as e:print(str(e))
