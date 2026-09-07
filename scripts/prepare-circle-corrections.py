"""Versioned Circle matte candidate. Preserve geometry and all pixels outside the glass body region."""
import json,pathlib,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=pathlib.Path(__file__).resolve().parents[1]; D=R/'docs/reviews/circle-recovery'
locked=D/'alignment-and-matte-report.json'
if locked.exists() and json.load(open(locked)).get('visualApproved'):
 raise SystemExit('Approved Circle correction is locked. Create a new revision rather than overwriting the manifest.')
rows=json.load(open(R/'src/lib/products/catalog-heroes.json')); lm={r['sku']:r for r in json.load(open(D/'shoulder-landmarks.json'))}
originals={r['sku']:r for r in json.load(open(R/'docs/reviews/circle-family-final-manifest-2026-09-06.json'))['rows']}
output=[]; sheet=Image.new('RGB',(1200,1650),'#f5f3ef'); draw=ImageDraw.Draw(sheet)
for h in [h for h in rows if h['family']=='Circle' and h['bottleColor']=='Clear' and h['capacityMl']>15]:
 sku=h['websiteSku'];h={**h,'url':originals[sku]['url']};m=lm[sku];im=Image.open(R/('public'+h['url'])).convert('RGB');a=np.array(im).astype(float);hh,ww=a.shape[:2];yy,xx=np.mgrid[:hh,:ww]
 # Glass region includes complete side/base matte; collar and detached hardware are outside.
 left=m['bodyLeft'];right=left+m['bodyWidth'];top=m['shoulderY']-30;base=1562
 region=(xx>=left-8)&(xx<=right+8)&(yy>=top)&(yy<=base+1)
 # Preserve the collar above the body; permit correction of paper fragments beside it.
 collar=(abs(xx-(left+right)/2)<m['bodyWidth']*.17)&(yy<m['shoulderY']-5)
 region &= ~collar
 # Restrict to near-neutral, pale photographic matte. Exposed bone is warm (chroma6), not selected.
 lo=a.min(2);hi=a.max(2);neutral=np.clip((6-(hi-lo))/3,0,1);bright=np.clip((lo-231)/20,0,1)
 weight=neutral*bright*region
 # Map the old white paper to bone while retaining luminance variation and edge antialiasing.
 # Smooth chroma adaptation, no new shadow and no remasking the silhouette.
 b=np.clip(np.rint(a-weight[:,:,None]*np.array([8,10,14])),0,255).astype('uint8')
 edited=Image.fromarray(b);temp=D/(sku+'.matte-candidate.png');edited.save(temp);sha=hashlib.sha256(temp.read_bytes()).hexdigest();url='/images/catalog/bone-review/'+sku+'.'+sha[:12]+'.png';dest=R/('public'+url);dest.write_bytes(temp.read_bytes());temp.unlink()
 changed=np.any(b!=a,2);assert not changed[~region].any()
 rec={'sku':sku,'inputUrl':h['url'],'inputSha256':hashlib.sha256((R/('public'+h['url'])).read_bytes()).hexdigest(),'url':url,'assetSha256':sha,'changedPixels':int(changed.sum()),'protectedOutsideRegionIdentical':True,'region':[left-8,top,right+8,base+1],'algorithm':'neutral white matte adaptation v2; complete glass-region mask, no ellipse feather boundary; original highlights and outlines retained as source luminance','visualApproved':False}
 output.append(rec)
 j=len(output)-1;x=j%4*300;y=j//4*400;edited.thumbnail((300,330));sheet.paste(edited,(x,y));draw.text((x+5,y+335),sku,fill='black')
json.dump(output,open(D/'matte-candidates.json','w'),indent=2);sheet.save(D/'matte-candidates-sheet.png')
