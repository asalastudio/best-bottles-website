"""User-authorized 107 x 46 mm silhouette correction. Original masters retained.
Widen the body around its existing axis, blending across the shoulder. Keep
all neck rows, vertical coordinates, glass height, and hardware seat unchanged.
"""
from pathlib import Path
import hashlib,json,io
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/empire-proportion-pilot';OUT.mkdir(parents=True,exist_ok=True)
manifest=ROOT/'src/lib/register/local-empire-bare-glass.json'
assets=json.loads(manifest.read_text());a=assets[1]
source=ROOT/'public/local-media/empire-bare-glass/empire-100ml-empty-alpha.cea2bf27e051.png'
expected='cea2bf27e051959c0a0b6fbaaa44f678e6500baade907ce4a271e65d9293a8f7'
assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
im=np.array(Image.open(source).convert('RGBA'));h,w=im.shape[:2]
# Source silhouette measured before feathering: 1548 high x 636 wide.
source_h,source_w=1548,636
factor=(source_h*46/107)/source_w
axis=435.;start,end=350,422
ys,xs=np.indices((h,w),dtype=float)
t=np.clip((ys-start)/(end-start),0,1);smooth=t*t*(3-2*t)
scale=1+(factor-1)*smooth
coords=np.array([ys,axis+(xs-axis)/scale])
# Premultiplication avoids a fringe when resampling the transparent perimeter.
alpha=im[:,:,3]/255.
pm=im[:,:,:3].astype(float)*alpha[:,:,None]
outa=map_coordinates(alpha,coords,order=1,mode='constant',cval=0)
outrgb=np.stack([map_coordinates(pm[:,:,i],coords,order=1,mode='constant',cval=0) for i in range(3)],axis=2)
outrgb=np.divide(outrgb,outa[:,:,None],out=np.zeros_like(outrgb),where=outa[:,:,None]>0)
result=np.dstack([np.rint(outrgb).clip(0,255).astype('uint8'),np.rint(outa*255).clip(0,255).astype('uint8')])
result[:start+1]=im[:start+1]
assert np.array_equal(result[:start+1],im[:start+1])
b=io.BytesIO();Image.fromarray(result).save(b,format='PNG');content=b.getvalue();sha=hashlib.sha256(content).hexdigest()
url=f'/local-media/empire-bare-glass/empire-100ml-107x46.{sha[:12]}.png';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
a.update(url=url,sha256=sha,bytes=len(content))
a['landmarks']['left']=round(axis+(118-axis)*factor,4)
a['landmarks']['right']=round(axis+(753-axis)*factor,4)
a['proportionCorrection']={'sourceAlphaUrl':'/local-media/empire-bare-glass/'+source.name,'sourceAlphaSha256':expected,'targetHeightMm':107,'targetWidthMm':46,'sourceSilhouetteBounds':[118,128,754,1676],'bodyScaleX':factor,'axisX':axis,'transitionY':[start,end],'neckPixelsPreservedThroughY':start,'method':'horizontal body resample with smooth shoulder transition; neck and all vertical coordinates unchanged','authorization':'Jordan requested 107 x 46 mm proportions on 2026-10-19; local review only'}
manifest.write_text(json.dumps(assets,indent=2)+'\n')
record={'source':str(source),'sha256':sha,'url':url,'correction':a['proportionCorrection'],'targetSilhouetteWidthPx':source_h*46/107,'targetRatio':107/46,'neckRgbaEqual':bool(np.array_equal(result[:start+1],im[:start+1])),'canvasUnchanged':[w,h]}
(OUT/'proportion-export.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
