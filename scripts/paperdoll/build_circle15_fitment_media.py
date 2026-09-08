#!/usr/bin/env python3
"""Extract reviewed Circle 15 ml foregrounds/fitments without changing geometry."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
from psd_tools import PSDImage
import numpy as np
ROOT=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO=Path(__file__).resolve().parents[2]
BASE=ROOT/'5.  13-415 Bottles/17. Circle 15ml'
OUT=REPO/'public/images/bottle-builder/circle'
files={'BlkMatt':'3. GBCrcl15SpryBlkMatt.psd','BlkSh':'4. GBCrcl15SpryBlkSh.psd','BluMatt':'5. GBCrcl15SpryBluMatt.psd','CuMatt':'30. GBCrcl15SpryCuMatt.psd','GlMatt':'7. GBCrcl15SpryGlMatt.psd','GlSh':'6. GBCrcl15SpryGlSh.psd','SlMatt':'8. GBCrcl15SprySlMatt.psd','SlSh':'9. GBCrcl15SprySlSh copy.psd'}
registry_path=REPO/'src/lib/bottle-builder/circle-assemblies.generated.json'
registry=json.loads(registry_path.read_text());review_path=REPO/'data/paper-doll/circle-builder-assembly-review.json';review=json.loads(review_path.read_text());new=[];thumbs=[]
def save(im,name):
 im=im.convert('RGBA');im=im.crop(im.getchannel('A').getbbox());im.thumbnail((1000,1200),Image.Resampling.LANCZOS)
 path=OUT/f'{name}.webp';im.save(path,'WEBP',lossless=True)
 thumbs.append((name,im.copy()))
 return {'url':f'/images/bottle-builder/circle/{path.name}','width':im.width,'height':im.height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
for suffix,filename in files.items():
 sku='GBCrcl15Spry'+suffix;path=BASE/'2. Circle 15ml (Capped) PSD'/filename;p=PSDImage.open(path)
 assert len(p)==3 and p[0].name=='Layer 0' and p[1].is_group() and len(p[1])==2 and p[2].kind=='pixel'
 # Reviewed group contains original glass and dip tube. Top-level layer 2 is
 # the original capped sprayer. Preserve the source canvas/positions.
 im=p.composite(force=True,ignore_preview=True,alpha=0,color=(1,1,1),layer_filter=lambda l:l is not p[0] and l.is_visible())
 if suffix=='CuMatt':
  # White retouch pixels are external to the copper cap, not product ink.
  cap=p[2];a=np.array(cap.composite().convert('RGBA'));a[np.min(a[:,:,:3],axis=2)>=245,3]=0
  im=Image.new('RGBA',p.size);group=p[1]
  im.alpha_composite(group.composite().convert('RGBA'),(group.left,group.top))
  im.alpha_composite(Image.fromarray(a),(cap.left,cap.top))
 asset=save(im,sku);registry[sku]=asset
 new.append({'sku':sku,'path':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'excludedBackground':'Layer 0','reviewNote':'Reviewed glass/dip-tube group plus original capped sprayer; native registration, uniform scale only'+('; external white retouch patch excluded from copper layer' if suffix=='CuMatt' else ''),'asset':asset})
review['sources']=[s for s in review['sources'] if s['sku'] not in {n['sku'] for n in new}]+new
review['skipped']=[s for s in review['skipped'] if s['sku'] not in {n['sku'] for n in new}]
registry_path.write_text(json.dumps(registry,indent=2)+'\n');review_path.write_text(json.dumps(review,indent=2)+'\n')
parts={};sources=[]
for name,filename,index,crop in [('Metal Roller','26. GBCrcl15MtlRollBlkDot.psd',1,(0,0,213,116)),('Plastic Roller','27. GBCrcl15RollBlkDot.psd',1,(0,0,145,112)),('Fine Mist Sprayer','3. GBCrcl15SpryBlkMatt.psd',3,None)]:
 path=BASE/'1. Circle 15ml (Uncapped) PSD '/filename;p=PSDImage.open(path);layer=p[index];im=layer.composite()
 # Metal layer includes a white retouch polygon below the plug. Its reviewed
 # boundary is y=116 in layer-local coordinates; keep the photographed plug.
 if crop:
  im=im.crop(crop)
  if name=='Metal Roller':
   a=np.array(im.convert('RGBA'));a[np.min(a[:,:,:3],axis=2)>=245,3]=0;im=Image.fromarray(a)
 asset=save(im,'fitment-'+name.lower().replace(' ','-'));parts['Circle|15|13-415|'+name]=asset
 sources.append({'fitment':name,'path':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'layerIndex':index,'layerName':layer.name,'layerBounds':list(layer.bbox),'crop':crop,'reviewNote':'Mechanism only; metal white retouch polygon or plastic near-transparent paint residue below plug excluded. Original product pixels and proportions retained.','asset':asset})
(REPO/'src/lib/bottle-builder/fitments.generated.json').write_text(json.dumps(parts,indent=2)+'\n')
(REPO/'data/paper-doll/circle15-fitment-source-review.json').write_text(json.dumps({'sources':sources},indent=2)+'\n')
sheet=Image.new('RGB',(1200,720),'#eeebe5');d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(thumbs):
 im.thumbnail((180,295));x=i%6*200;y=i//6*360;sheet.paste(im,(x+(200-im.width)//2,y),im);d.text((x+3,y+305),name.replace('GBCrcl15',''),fill='black')
sheet.save('/tmp/circle15-repaired-media.png')
print('Saved eight assemblies and three fitment images')
