"""Recover Circle shoulder landmarks from original PSD alpha and register to committed heroes.
Only reports measurements: never changes source artwork or catalog assets.
"""
import json, pathlib
import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage
ROOT=pathlib.Path(__file__).resolve().parents[1]
rows=json.load(open(ROOT/'docs/reviews/circle-family-final-manifest-2026-09-06.json'))['rows']
heroes={r['websiteSku']:r for r in json.load(open(ROOT/'src/lib/products/catalog-heroes.json'))}
out=[]
for ix,r in enumerate(rows):
 sku=r['sku']; h=heroes[sku]
 if ix<3: continue
 p=PSDImage.open(r['sourcePsd']); layers=list(p.descendants())
 # Visually inspected inventory: frost 50 body is behind the top layer; frost100 tassel body is layer2.
 bi=2 if sku in ['GBCrclFrst50AnSpGl','GBCrclFrst50DrpGl','LBCrclFrst50LtnMtGl','GBCrclFrst50SpryMtGl','GBCrclFrst100AnSpTslIvyGl'] else 1
 im=layers[bi].topil().convert('RGBA'); ar=np.array(im); box=Image.fromarray((ar[:,:,3]>16).astype('uint8')*255).getbbox(); im=im.crop(box)
 a=np.array(im); widths=(a[:,:,3]>32).sum(axis=1)
 # First sustained expansion beyond neck into the round shoulder.
 sy=next(y for y in range(len(widths)-5) if np.all(widths[y:y+5]>.32*widths.max()))
 bw=655 if h['capacityMl']==30 else 785 if h['capacityMl']==50 else 920.3556
 if sku=='GBCrcl50AnSpTslIvyGl':bw*=.935
 scale=bw/im.width; sw=round(bw);sh=round(im.height*scale)
 template=np.array(im.resize((sw,sh),Image.Resampling.LANCZOS)); base_y=1562-sh
 # Opaque distinctive source pixels below the neck; avoid near-white flat matte and tubing.
 good=(template[:,:,3]>240)&(template[:,:,:3].min(2)<235)
 good[:int(sh*.35)]=False
 yy,xx=np.where(good); pick=np.linspace(0,len(xx)-1,min(700,len(xx)),dtype=int);yy=yy[pick];xx=xx[pick];colors=template[yy,xx,:3].astype(float)
 original=np.array(Image.open(ROOT/('public'+r['url'])).convert('RGB')).astype(float)
 best=(1e20,0,0)
 for dy in range(-4,5):
  y=base_y+dy
  for x in range(0,1560-sw):
   delta=original[yy+y,xx+x]-colors;err=np.minimum((delta**2).sum(1),3000).mean()
   if err<best[0]:best=(err,x,y)
 err,x,y=best
 rec={'sku':sku,'sourcePsd':r['sourcePsd'],'sourceLayer':bi,'alphaCrop':box,'sourceShoulderY':sy,'sourceScale':scale,'bodyLeft':x,'bodyTop':y,'bodyWidth':sw,'bodyHeight':sh,'baseY':y+sh,'shoulderY':y+sy*scale,'registrationError':err,'definition':'First sustained body alpha span above 32% of maximum width, at the rounded body-to-neck transition; provisional estimator; review overlay before use.'}
 out.append(rec);print(sku,round(rec['shoulderY'],1),rec['baseY'],round(err,1),flush=True)
json.dump(out,open(ROOT/'docs/reviews/circle-recovery/shoulder-landmarks.json','w'),indent=2)
