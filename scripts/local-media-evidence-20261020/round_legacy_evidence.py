from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
import urllib.request,json,hashlib,concurrent.futures,re
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-spray-completion');D=O/'legacy';D.mkdir(exist_ok=True)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.img=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='a' and a.get('href'):self.links.append(a['href'])
  if t=='img' and a.get('src'):self.img.append(a['src'])
index='https://nematinternational.com/products/bottles/classic_perfume_spray_bottles.php'
raw=urllib.request.urlopen(index,timeout=45).read();(D/'index.html').write_bytes(raw);parser=Links();parser.feed(raw.decode(errors='replace'));urls=set(urljoin(index,h) for h in parser.links if '78' in h and 'round' in h.lower())
def one(url):
 try:
  raw=urllib.request.urlopen(url,timeout=40).read();text=raw.decode(errors='replace');h=hashlib.sha256(raw).hexdigest();(D/(h+'.html')).write_bytes(raw);skus=sorted(set(re.findall(r'GBRnd(?:Frst)?78Spry[A-Za-z]+',text)));p=Links();p.feed(text)
  candidates=[urljoin(url,u) for u in p.img if any(s in u for s in skus)];imgs=[]
  for u in dict.fromkeys(candidates):
   b=urllib.request.urlopen(u,timeout=40).read();sha=hashlib.sha256(b).hexdigest();(D/(sha+'.img')).write_bytes(b);imgs.append({'url':u,'sha256':sha,'bytes':len(b)})
  return {'url':url,'htmlSha256':h,'websiteSkus':skus,'images':imgs}
 except Exception as e:return {'url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:records=list(ex.map(one,urls))
(D/'receipts.json').write_text(json.dumps({'scope':'Directly linked Round 78 spray legacy pages; supplemental identity evidence, not a full catalog census','pages':records},indent=2));print('Legacy linked pages',len(records),'errors',sum('error' in r for r in records))
