"""Local alpha-only exports. Preserve every RGB byte and source registration.

Exterior mask follows contrast against the source's bone backdrop. Fill the
closed bottle silhouette to retain the existing interior glass treatment.
Original files are immutable; outputs use new content-addressed names.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image,ImageFilter,ImageDraw
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/empire-alpha-pilot';OUT.mkdir(parents=True,exist_ok=True)
assets=json.loads((ROOT/'src/lib/register/local-empire-bare-glass.json').read_text())
records=[];panels=[]
for asset in assets:
 source_url=asset.get('sourceRgbUrl',asset['url'])
 source_sha=asset.get('sourceRgbSha256',asset['sha256'])
 source=ROOT/'public'/source_url.lstrip('/')
 assert hashlib.sha256(source.read_bytes()).hexdigest()==source_sha
 rgb=np.array(Image.open(source).convert('RGB'));h,w=rgb.shape[:2]
 # Background varies slightly down the flattened source. Measure each row at
 # the canvas edges, outside both bottle silhouettes.
 bg=np.median(np.concatenate([rgb[:,:24],rgb[:,-24:]],axis=1),axis=1)
 contrast=np.max(np.abs(rgb.astype(float)-bg[:,None,:]),axis=2)
 edges=contrast>14
 edges=ndimage.binary_closing(edges,iterations=2)
 filled=ndimage.binary_fill_holes(edges)
 labels,n=ndimage.label(filled);areas=np.bincount(labels.ravel());areas[0]=0
 silhouette=labels==int(areas.argmax())
 silhouette=ndimage.binary_fill_holes(silhouette)
 ys,xs=np.where(silhouette)
 assert 85<xs.min()<145 and 730<xs.max()<790
 assert 115<ys.min()<145 and 1660<ys.max()<1745
 assert silhouette[h//2,w//2], 'Interior must be preserved, not keyed away'
 # One-pixel exterior allowance keeps faint antialiased glass edges. A narrow
 # feather avoids a stair-step boundary; it does not change RGB or geometry.
 mask=Image.fromarray((ndimage.binary_dilation(silhouette,iterations=1)*255).astype('uint8'))
 mask=mask.filter(ImageFilter.GaussianBlur(0.55))
 alpha=np.array(mask);alpha[alpha<2]=0;alpha[alpha>253]=255
 result=np.dstack([rgb,alpha]);image=Image.fromarray(result)
 import io
 buffer=io.BytesIO();image.save(buffer,format='PNG');content=buffer.getvalue();sha=hashlib.sha256(content).hexdigest()
 size=asset['physicalGuide']['heightMm'];capacity=50 if size==88 else 100
 name=f'empire-{capacity}ml-empty-alpha.{sha[:12]}.png';dest=source.parent/name;dest.write_bytes(content)
 decoded=np.array(Image.open(dest));assert np.array_equal(decoded[:,:,:3],rgb)
 record={'capacityMl':capacity,'source':source_url,'sourceSha256':source_sha,'url':'/local-media/empire-bare-glass/'+name,'sha256':sha,'bytes':len(content),'width':w,'height':h,'maskMethod':'row-edge background contrast >14; 2px close; fill holes; largest silhouette; 1px exterior allowance; 0.55px feather','rgbChangedPixels':int(np.any(decoded[:,:,:3]!=rgb,axis=2).sum()),'transparentPixels':int((alpha==0).sum()),'transparentFraction':float((alpha==0).mean()),'silhouetteBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'landmarksUnchanged':asset['landmarks'],'physicalGuide':asset['physicalGuide'],'visualApproval':False}
 records.append(record)
 # Review on actual stage bone, checkerboard, and dark field at native ratio.
 for label,bgcolor in [('before',None),('alpha on grid','grid'),('alpha on dark','dark')]:
  if bgcolor is None:panel=Image.fromarray(rgb).convert('RGBA')
  else:
   background=Image.new('RGBA',(w,h),'#252a30' if bgcolor=='dark' else '#f5f3ef')
   if bgcolor=='grid':
    d=ImageDraw.Draw(background)
    for x in range(0,w,40):d.line((x,0,x,h),fill='#b6b9b8',width=1)
    for y in range(0,h,40):d.line((0,y,w,y),fill='#b6b9b8',width=1)
   panel=Image.alpha_composite(background,image)
  panel=panel.convert('RGB');panel.thumbnail((290,602))
  cell=Image.new('RGB',(310,650),'#f5f3ef');cell.paste(panel,((310-panel.width)//2,35));ImageDraw.Draw(cell).text((15,12),f'{capacity} ml / {label}',fill='#222222');panels.append(cell)
sheet=Image.new('RGB',(930,1300),'#f5f3ef')
for i,panel in enumerate(panels):sheet.paste(panel,((i%3)*310,(i//3)*650))
sheet.save(OUT/'alpha-mask-review.png')
(OUT/'alpha-exports.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
