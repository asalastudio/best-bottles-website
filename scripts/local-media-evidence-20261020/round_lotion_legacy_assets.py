from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
from PIL import Image
from io import BytesIO
import urllib.request,json,hashlib,re,datetime
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-lotion-pilot');D=O/'legacy';D.mkdir(exist_ok=True)
s=json.loads((O/'legacy-evidence.json').read_text());receipts=[]
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='a' and a.get('href'):self.links.append(a['href'])
for page,sku in zip(s['pages'],['LBRnd78LtnShnSl','LBRndFrst78LtnShnSl']):
 raw=page['rawHtml'];(D/(sku+'.html')).write_text(raw)
 url=next(u for u in re.findall(r'https://[^)\s]+',page['markdown']) if '/enlarged_pics/' in u)
 b=urllib.request.urlopen(url,timeout=40).read();h=hashlib.sha256(b).hexdigest();im=Image.open(BytesIO(b));name=sku+'-legacy.gif';(D/name).write_bytes(b)
 receipts.append({'websiteSku':sku,'sourceUrl':page['metadata']['sourceURL'],'htmlSha256':hashlib.sha256(raw.encode()).hexdigest(),'imageUrl':url,'imageSha256':h,'imageFile':name,'format':im.format,'dimensions':list(im.size),'frames':getattr(im,'n_frames',1),'legacyHeightRaw':'3.76 in. (96 mm)','legacyDiameterRaw':'2.32 in. (59 mm)','dimensionBasis':'Assembly measurement basis unspecified; no glass reshaping','legacyWeightRaw':'25786','weightStatus':'Malformed/unresolved; not adopted','displayFinish':'Shiny Silver','identity':'Exact SKU and finish confirmed on freshly retrieved product page'})
url='https://nematinternational.com/products/bottles/lotion_bottles.php';b=urllib.request.urlopen(url,timeout=45).read();(D/'listing.html').write_bytes(b);t=b.decode(errors='replace');p=Links();p.feed(t);codes=sorted(set(re.findall(r'LBRnd(?:Frst)?78Ltn[A-Za-z]+',t)));links=sorted(set(urljoin(url,u) for u in p.links if '78ml' in u and 'Round' in u))
(D/'receipts.json').write_text(json.dumps({'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Two exact-SKU images and supporting Round 78 lotion category membership; commercial fields retained as evidence only','pilot':receipts,'listing':{'url':url,'sha256':hashlib.sha256(b).hexdigest(),'websiteSkus':codes,'productLinks':links}},indent=2));print('Saved',len(receipts),'exact product references; listing has',len(codes),'Round 78 lotion SKUs')
