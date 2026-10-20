from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from io import BytesIO
import urllib.request,json,hashlib,re,concurrent.futures,datetime
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-lotion-completion');D=O/'legacy';D.mkdir(exist_ok=True)
s=json.loads((O/'legacy-bestbottles-pages.json').read_text());kits=json.loads((O/'kits.json').read_text());records=[];jobs=[]
for row in s['pages']:
 p=row['page'];md=p['markdown'];sku=re.search(r'^# (LBRnd\w+)',md,re.M)[1];raw=p['rawHtml'];(D/(sku+'.html')).write_text(raw);(D/(sku+'.md')).write_text(md)
 images=sorted(set(re.findall(r'https://www\.bestbottles\.com/images/store/(?:enlarged_pics|capped|measured|depthview)/[^)\s]+',md)))
 assert all(sku in u for u in images),(sku,images)
 fields={k:(re.search(r'\*\*'+re.escape(k)+r':\*\*\s*([^\n]+)',md)[1] if re.search(r'\*\*'+re.escape(k)+r':\*\*\s*([^\n]+)',md) else None) for k in ['Item Name','Item Description','Item Capacity','Item Height with Cap','Item Height without Cap','Item Diameter','Neck Thread Size','Purchase']}
 assert fields['Item Name']==sku
 r=next(r['row'] for r in kits if r['row']['websiteSku']==sku)
 records.append({'websiteSku':sku,'url':row['url'],'retrieved':p['metadata'],'htmlSha256':hashlib.sha256(raw.encode()).hexdigest(),'fields':fields,'sourceCapColor':r['sourceCapColor'],'displayCapColor':r['capColor'],'identity':'Exact SKU linked in current Best Bottles option selectors and returned by product page','priceTreatment':'Raw selectable tiers captured as evidence only; no data changes','fieldStatus':{'capacity':'78 ml agrees','neck':'18-415 agrees','glassHeight':'73 mm bare glass corroborated by exact page','diameter':'59 mm corroborated by exact page','finish':'Local label derived from registered component; raw frosted glass label retained','publication':'local only'},'galleryUrls':images,'videoUrls':sorted(set(re.findall(r'https://www\.youtube\.com/watch\?v=[\w-]+',md)))})
 jobs.extend((sku,u) for u in images)
def one(job):
 sku,url=job;view=urlparse(url).path.split('/')[-2];name=f'{sku}-{view}.gif'
 try:
  b=urllib.request.urlopen(url,timeout=45).read();im=Image.open(BytesIO(b));im.load();(D/name).write_bytes(b)
  return {'websiteSku':sku,'view':view,'url':url,'file':name,'sha256':hashlib.sha256(b).hexdigest(),'dimensions':list(im.size),'format':im.format,'frames':getattr(im,'n_frames',1),'bytes':len(b)}
 except Exception as e:return {'websiteSku':sku,'view':view,'url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:assets=list(ex.map(one,jobs))
assert set(r['websiteSku'] for r in records)==set(r['row']['websiteSku'] for r in kits)
(D/'receipts.json').write_text(json.dumps({'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Current Best Bottles product pages reached through observed category and option-selector links','scope':'Fourteen Round 78 ml lotion variants; Nemat eight-SKU listing is incomplete for this scope','products':records,'assets':assets},indent=2))
print('Confirmed',len(records),'SKUs; recovered',sum('error' not in a for a in assets),'gallery views;',sum('error' in a for a in assets),'retrieval errors')
