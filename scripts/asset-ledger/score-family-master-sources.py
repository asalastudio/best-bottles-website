import json,pathlib,hashlib,sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage
b=pathlib.Path('dist/paper-doll/four-family-plates-2026-09-13');pages={r['sku']:r for r in json.loads((b/'evidence/index.json').read_text())['pages']};master=pathlib.Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master');f=sys.argv[1];inv=json.loads((b/f/'input/inventory.json').read_text())['files'];x=json.loads((b/f/'input/xref.json').read_text())['products']
def thumb(im):
 im=im.convert('RGBA');w=Image.new('RGBA',im.size,'white');w.alpha_composite(im);im=w.convert('RGB');arr=np.asarray(im);ys,xs=np.where(np.min(arr,axis=2)<235);im=im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1));im.thumbnail((128,128));out=Image.new('RGB',(128,128),'white');out.paste(im,((128-im.width)//2,(128-im.height)//2));return np.asarray(out).astype(float)/255
results=[]
for row in x:
 if not row['blockReasons'] or 'preserve_approved_current_plate' in row['blockReasons'] or not row.get('productGroupId'):continue
 page=pages.get(row['websiteSku']);files=[r for r in inv if r['stem']==row['websiteSku'] and r['role'] in ['front','capped','uncapped']];seen=set();sources=[]
 for r in files:
  if r['sha256'] in seen:continue
  seen.add(r['sha256']);p=master/r['relPath'];im=PSDImage.open(p).topil()
  if im:sources.append((r,thumb(im)))
 if not page:continue
 records=[]
 for ref in page['gallery']:
  if not any('/'+folder+'/' in ref['url'] for folder in ['enlarged_pics','capped']):continue
  k=hashlib.sha256(ref['url'].encode()).hexdigest();p=b/'evidence/gallery'/(k+'.original')
  if not p.exists():continue
  try:t=thumb(Image.open(p))
  except Exception:continue
  scores=sorted([{'source':r,'mae':round(float(np.abs(t-arr).mean()),5)} for r,arr in sources],key=lambda r:r['mae']);records.append({'reference':ref,'scores':scores})
 results.append({'sku':row['websiteSku'],'family':page['family'],'evidence':page,'comparisons':records});print(row['websiteSku'],[(r['reference']['url'].split('/')[-2],[(s['source']['capState'],s['mae']) for s in r['scores']]) for r in records],flush=True)
(b/f/'source-similarity.json').write_text(json.dumps({'rows':results,'note':'Similarity ranks source candidates. It is not identity approval or a cap-state decision.'},indent=2))
