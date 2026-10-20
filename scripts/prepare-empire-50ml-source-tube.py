"""Recover the exact Empire 50 ml Matte Gold source tube, retaining native RGBA."""
from pathlib import Path
from psd_tools import PSDImage
import hashlib,json,io
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
source=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/paper-doll/reference-images/2. 18-415 Bottles/21. Empire 50ml/1. Empire 50ml PSD/13. GBEmp50SpryMtGl.psd')
psd=PSDImage.open(source);layer=list(psd)[2]
assert layer.name=='Layer 18' and layer.bbox==(186,673,382,2317)
im=layer.composite();crop=(110,0,196,726);out=im.crop(crop)
a=np.array(out)[:,:,3]
assert (a[3:722]>10).any(axis=1).all()
buf=io.BytesIO();out.save(buf,format='PNG');content=buf.getvalue();sha=hashlib.sha256(content).hexdigest()
url=f'/local-media/empire-bare-glass/empire-50ml-native-spray-tube.{sha[:12]}.png';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
record={'websiteSku':'GBEmp50SpryMtGl','plateKey':'empire-50ml-18-415|Clear','componentId':'CMP-SPR-MTGD-18-415-05','url':url,'sha256':sha,'bytes':len(content),'width':out.width,'height':out.height,'axisX':44,'sourceBodyHeight':1268,'sourcePath':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceLayer':layer.name,'sourceLayerIndex':2,'sourceLayerBounds':list(layer.bbox),'sourceCrop':crop,'method':'native RGBA crop of continuous source housing and tube; disconnected off-canvas scrap excluded','expectedUrls':['/images/register/tubes/empire-50ml-18-415-clear-spray.dcb167b9e11c.png','/images/register/tubes/empire-50ml-18-415-clear-spray-exploded.bcaeb3949ecb.png'],'expectedSprayerUrl':'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/register/components/18-415/CMP-SPR-MTGD-18-415-05/sprayer-dfdfa43883fb9e44b9aaec29fce18f00af8d5e2ada225a772bc58ff529a7fbed.png'}
(ROOT/'src/lib/register/local-empire-additional-spray-tubes.json').write_text(json.dumps([record],indent=2)+'\n')
(ROOT/'output/empire-both-sizes-pilot/tube-source-50.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
