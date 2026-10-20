"""Recover the exact 100 ml Matte Gold sprayer's original photographic tube.
Crop the single continuous component above the PSD's disconnected off-canvas
scrap. Preserve the native RGBA; no drawing or synthesized tube segments.
"""
from pathlib import Path
import hashlib,json,io
import numpy as np
from PIL import Image
from psd_tools import PSDImage
ROOT=Path(__file__).resolve().parents[1]
source=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master/2.  18-415 Bottles /22. Empire Bottle 100ml/1. Empire 100ml PSD/13. GBEmp100SpryMtGl.psd')
psd=PSDImage.open(source);layer=list(psd)[2]
assert layer.name=='Layer 16' and layer.bbox==(183,670,412,2582)
im=layer.composite();arr=np.array(im);active=(arr[:,:,3]>10).any(axis=1)
# Retain the first continuous source component, excluding the detached scrap
# below the PSD canvas. Soft fringes stay in the crop.
y0=int(np.where(active)[0][0]);y1=y0
while y1<len(active) and active[y1]:y1+=1
crop=(130,0,229,y1+2)
assert 980<y1<1000 and not active[1100:1500].any()
out=im.crop(crop);buf=io.BytesIO();out.save(buf,format='PNG');content=buf.getvalue();sha=hashlib.sha256(content).hexdigest()
url=f'/local-media/empire-bare-glass/empire-100ml-native-spray-tube.{sha[:12]}.png'
(ROOT/'public'/url.lstrip('/')).write_bytes(content)
a=json.loads((ROOT/'src/lib/register/local-empire-bare-glass.json').read_text())[1]
record={'websiteSku':'GBEmp100SpryMtGl','plateKey':a['plateKey'],'componentId':'CMP-SPR-MTGD-18-415-05','url':url,'sha256':sha,'bytes':len(content),'width':out.width,'height':out.height,'axisX':50,'sourceBodyHeight':1504,'sourcePath':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceLayer':'Layer 16','sourceLayerIndex':2,'sourceLayerBounds':list(layer.bbox),'sourceCrop':crop,'method':'native RGBA crop of continuous source housing and tube; off-canvas disconnected scrap excluded','expectedUrls':['/images/register/tubes/empire-100ml-18-415-clear-spray.545fa0538cce.png','/images/register/tubes/empire-100ml-18-415-clear-spray-exploded.8023ba8f5bdf.png'],'expectedSprayerUrl':'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/register/components/18-415/CMP-SPR-MTGD-18-415-05/sprayer-dfdfa43883fb9e44b9aaec29fce18f00af8d5e2ada225a772bc58ff529a7fbed.png'}
(ROOT/'src/lib/register/local-empire-100ml-spray-tube.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
