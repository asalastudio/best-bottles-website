"""Local-only native PSD recovery. No RGB edits, generated parts, or remote writes."""
from pathlib import Path
from psd_tools import PSDImage
import hashlib,json,io
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/empire-completion-pilot'
SOURCE=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images/2. 18-415 Bottles')
register=json.loads((OUT/'source-register.json').read_text())
sprayers=json.loads((OUT/'sprayer-registration.json').read_text())
rows=json.loads((ROOT/'src/lib/register/local-empire-additional-spray-tubes.json').read_text())[:1]
rows[0]['visibleBottomFraction']=390/400

def extract(path,crop,sku):
 psd=PSDImage.open(path);layer=list(psd)[2];im=layer.composite().crop(crop)
 a=np.array(im)[:,:,3]
 assert (a[3:-4]>10).any(axis=1).all(),sku
 b=io.BytesIO();im.save(b,format='PNG');content=b.getvalue();sha=hashlib.sha256(content).hexdigest()
 url=f'/local-media/empire-bare-glass/{sku}-native-tube.{sha[:12]}.png';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
 return {'url':url,'sha256':sha,'bytes':len(content),'width':im.width,'height':im.height,'sourcePath':str(path),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceLayer':layer.name,'sourceLayerIndex':2,'sourceLayerBounds':list(layer.bbox),'sourceCrop':crop,'method':'native RGBA crop; excludes the disconnected off-canvas fragment; source pixels unchanged'}

for size in [50,100]:
 folder=SOURCE/('21. Empire 50ml' if size==50 else '22. Empire Bottle 100ml')/f'1. Empire {size}ml PSD'
 base=json.loads((ROOT/'src/lib/register/local-empire-100ml-spray-tube.json').read_text()) if size==100 else rows[0]
 for suffix,number in [('MtSl',23),('ShnGl',15),('ShnSl',29),('ShnBlk',19),('Cu',59 if size==50 else 56)]:
  sku=f'GBEmp{size}Spry{suffix}';p=folder/f'{number}. {sku}.psd'
  crop=(130,0,229,994) if size==100 else (110,0,196,726) if suffix!='Cu' else (115,0,204,766)
  r=extract(p,crop,sku);assembly=next(a for a in register['assemblies'] if a['websiteSku']==sku);component=assembly['parts'][0]['componentId'];spray=sprayers[component]
  r.update(websiteSku=sku,plateKey=assembly['plateKey'],componentId=component,axisX=50 if size==100 else 44 if suffix!='Cu' else 46,sourceBodyHeight=1504 if size==100 else 1268,expectedUrls=base['expectedUrls'],expectedSprayerUrl=spray['layer']['url'],visibleBottomFraction=(spray['visibleBottom']-1)/spray['layer']['height'])
  rows.append(r)
(ROOT/'src/lib/register/local-empire-additional-spray-tubes.json').write_text(json.dumps(rows,indent=2)+'\n')
p=ROOT/'src/lib/register/local-empire-100ml-spray-tube.json';r=json.loads(p.read_text());r['visibleBottomFraction']=390/400;p.write_text(json.dumps(r,indent=2)+'\n')

# The same white 18-415 pump is verified in the exact Empire source photos.
# Reuse its existing source-backed hardware record and empty-cover candidate.
# Recover the 100 ml tube independently from its own PSD.
old=json.loads((ROOT/'src/lib/register/local-empire-white-pump.json').read_text())
a=next(a for a in register['assemblies'] if a['websiteSku']=='LBEmp100WhtClOvrCp')
plate=register['plates'][a['plateKey']]
p=SOURCE/'22. Empire Bottle 100ml/1. Empire 100ml PSD/52. LBEmp100WhtClOvrCp.psd'
# Full continuous native tube; the empty bottom rows are omitted.
r=extract(p,(0,0,174,1063),a['websiteSku'])
r.update(websiteSku=a['websiteSku'],plateKey=a['plateKey'],componentId=old['component']['componentId'],axisX=111,sourceBodyHeight=1504,expectedUrls=['/images/register/tubes/empire-100ml-18-415-clear-lotion.7bff5d0b1d6a.png'],expectedPumpUrl=old['component']['layers'][0]['url'],visibleBottomFraction=596/602)
# Resolve the exact existing tube URLs rather than assuming their hashes.
tubes=json.loads((ROOT/'src/lib/register/hero-tubes.json').read_text())['tubes'][a['plateKey']+'|lotion']
r['expectedUrls']=[tubes[k]['url'] for k in ['seated','exploded'] if tubes.get(k)]
(ROOT/'src/lib/register/local-empire-100ml-white-pump-tube.json').write_text(json.dumps(r,indent=2)+'\n')
candidate={'websiteSku':a['websiteSku'],'graceSku':a['graceSku'],'expectedAssembly':a,'expectedPlate':plate,'component':old['component'],'visualApproval':False,'sourceReference':{'psd':str(p),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'pumpLayer':'Layer 2 copy','pumpBounds':[386,101,754,691],'hardware':'Same white 18-415 pump as 50 ml, retained library source pixels and registration. Exact 100 ml PSD visually checked.','emptyCover':'Existing local PR 341 empty-overcap candidate, still awaiting owner visual approval.'}}
(ROOT/'src/lib/register/local-empire-100ml-white-pump.json').write_text(json.dumps(candidate,indent=2)+'\n')
(OUT/'source-recovery.json').write_text(json.dumps({'sprays':rows,'whitePumpTube':r,'whitePump':candidate},indent=2)+'\n')
print('Recovered ten exact spray tubes and the 100 ml white-pump tube.')
