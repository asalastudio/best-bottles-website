import json,numpy as np
from PIL import Image
from scipy import ndimage as nd,optimize
from psd_tools import PSDImage
from pathlib import Path
root=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
ledger=json.load(open('src/lib/asset-ledger/ledger.json')); records={r['sku']:r for r in ledger['rows']}
results=[]
for s in json.load(open('data/asset-ledger/bottle-standards.json'))['standards']:
 sku=s['reference']['sku'];r=records[sku];psd=PSDImage.open(root/r['plate']['sourcePath']);layer=psd[1];rgba=np.array(layer.topil().convert('RGBA')); mask=rgba[:,:,3]>180
 labs,n=nd.label(mask);counts=np.bincount(labs.ravel());counts[0]=0;mask=labs==counts.argmax()
 sy=np.where(mask.sum(1)>20)[0]; sourcebase=int(sy.max()); sourcerim=int(sy.min());
 rows=np.arange(int(len(mask)*.24),int(len(mask)*.87),3)
 left=np.array([np.where(mask[y])[0].min() for y in rows]);right=np.array([np.where(mask[y])[0].max() for y in rows]);
 a=np.array(Image.open('public'+s['reference']['url']).convert('RGB')).astype(float);diff=np.abs(a-[245,243,239]).max(2)
 # Restrict registration to photographed body sides, above the base/shadow zone.
 valid=np.zeros(len(a),bool);tl=np.zeros(len(a));tr=np.zeros(len(a))
 for y in range(700,1530):
  xs=np.where(diff[y]>25)[0];xs=xs[(xs>480)&(xs<1080)]
  if len(xs)>10 and 230 < np.ptp(xs) < 500:tl[y]=xs.min();tr[y]=xs.max();valid[y]=True
 vy=np.where(valid)[0]; base=1561.0
 initial=np.median(tr[1250:1400]-tl[1250:1400])/np.median(right-left)
 def residual(params):
  scale,tx=params;ty=base-sourcebase*scale;y=rows*scale+ty
  return np.r_[left*scale+tx-np.interp(y,vy,tl[vy]),right*scale+tx-np.interp(y,vy,tr[vy])]
 opt=optimize.least_squares(residual,[initial,780-rgba.shape[1]/2*initial],loss='soft_l1',f_scale=2,bounds=([initial*.9,300],[initial*1.1,850]))
 scale,tx=opt.x;res=residual(opt.x)
 result=dict(sku=sku,capacity=s['capacityMl'],sourcePath=str(root/r['plate']['sourcePath']),layerIndex=1,layerName=layer.name,layerOffset=list(layer.offset),rimLocalY=sourcerim,baseLocalY=sourcebase,scale=float(scale),translateX=float(tx),translateY=base-sourcebase*scale,glassHeight=(sourcebase-sourcerim)*scale,baseY=base,registrationMedianPx=float(np.median(np.abs(res))),registrationP95Px=float(np.percentile(np.abs(res),95)))
 results.append(result);print(json.dumps(result))
Path('/tmp/boston-registration.json').write_text(json.dumps(results,indent=2))
