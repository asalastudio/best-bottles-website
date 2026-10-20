from pathlib import Path
import urllib.request,hashlib,json,re
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/diva46-two-bottle-pilot');url='https://nematinternational.com/products/bottles/view_all_empty_perfume_bottles_atomizers_packaging_accessories.php';data=urllib.request.urlopen(url,timeout=60).read();(O/'legacy-all.html').write_bytes(data);text=data.decode(errors='replace');records=[]
for sku in ['GBDiva46SpryShnSl','GBDivaFrst46SpryShnSl']:
 matches=[m.start() for m in re.finditer(sku,text)];records.append({'sku':sku,'occurrences':len(matches)})
 for i in matches[:1]:print(sku,text[max(0,i-800):i+800])
(O/'legacy-evidence.json').write_text(json.dumps({'url':url,'htmlSha256':hashlib.sha256(data).hexdigest(),'records':records,'scope':'Exact-SKU search in linked legacy all-products listing; absence here is unresolved legacy matching, not evidence the SKU is retired.'},indent=2))
