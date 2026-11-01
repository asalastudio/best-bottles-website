from pathlib import Path
import base64, json, hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import label
p=Path('docs/reviews/cylinder5-finemist-2026-11-01');out=Path('public/local-kits/cylinder5-finemist-2026-11-01');out.mkdir(parents=True,exist_ok=True)
rows=json.loads((p/'source-inventory.json').read_text());assets={}
for r in rows:
 raw=(p/'sources'/r['file']).read_bytes();im=Image.open(p/'sources'/r['file']).convert('RGBA');a=np.array(im)[:,:,3]
 groups,n=label(a>=128);counts=np.bincount(groups.ravel());counts[0]=0;main=groups==int(counts.argmax());ys,xs=np.where(main)
 # Display clipping follows the main source silhouette, excluding disconnected matte specks.
 left=[];right=[]
 for y in range(int(ys.min()),int(ys.max())+1):
  x=np.where(main[y])[0]
  if len(x):left.append((int(x.min()),y));right.append((int(x.max()+1),y))
 points=left+right[::-1];d='M '+' L '.join(f'{x} {y}' for x,y in points)+' Z'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{im.width}" height="{im.height}" viewBox="0 0 {im.width} {im.height}"><defs><clipPath id="source"><path d="{d}"/></clipPath></defs><image width="{im.width}" height="{im.height}" href="data:image/png;base64,{base64.b64encode(raw).decode()}" clip-path="url(#source)"/></svg>'.encode()
 digest=hashlib.sha256(svg).hexdigest();file=r['file'][:-4]+'.'+digest[:12]+'.svg';(out/file).write_bytes(svg)
 assets[r['sku']+'|'+r['slot']]={'url':'/'+str(out.relative_to('public'))+'/'+file,'sha256':digest,'bytes':len(svg),'width':im.width,'height':im.height,'ink':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'source':r['file'],'sourceSha256':r['sha256'],'excludedOpaqueSpecks':int(((a>=128)&~main).sum())}
(p/'hardware-assets.json').write_text(json.dumps(assets,indent=2)+'\n')
print('Registered',len(assets),'unchanged PSD layers with source silhouette clips')
