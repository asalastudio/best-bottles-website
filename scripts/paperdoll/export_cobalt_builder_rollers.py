import json,hashlib,argparse
from pathlib import Path
from PIL import Image
from psd_tools import PSDImage
import numpy as np
parser=argparse.ArgumentParser(description='Export exact Cobalt 5ml metal rollers from original uncapped PSDs')
parser.add_argument('--source-root',required=True)
parser.add_argument('--configurations',required=True,help='Read-only builder configuration JSON snapshot')
args=parser.parse_args()
root=Path(args.source_root)
rows=[c for c in json.load(open(args.configurations)) if c['family']=='Cylinder' and c['capacityMl']==5 and c['color']=='Cobalt Blue' and c['fitment']=='Metal Roller']
assert len(rows)==9 and len({c['id'] for c in rows})==9, 'Expected all nine exact Cobalt metal-roller assemblies'
out=Path('public/images/bottle-builder/rollers');out.mkdir(exist_ok=True,parents=True)
registry={};evidence=[]
for c in rows:
 sku=c['id'];matches=[p for p in root.rglob('*'+sku+'.psd') if 'Uncapped' in str(p)];assert len(matches)==1
 p=matches[0];psd=PSDImage.open(p);group=next(l for l in psd.descendants() if l.is_group() and l.name=='Metal Roller Ball');layers=list(group)
 assert len(layers)==2
 roller,body=layers;assert roller.top<body.top and roller.bottom<body.bottom
 target=next(p for p in c['kit']['parts'] if p['slot']=='body');bb=target['bounds']
 scale=(bb['right']-bb['left'])/body.width;ox=(bb['left']+bb['right'])/2-(body.left+body.right)/2*scale;oy=bb['bottom']-body.bottom*scale
 assert abs(body.height*scale-(bb['bottom']-bb['top']))<4
 # Remove only the surrounding white Photoshop retouch rectangle, retaining the
 # photographed mechanism pixels and its original body-relative registration.
 rgba=np.array(roller.topil().convert('RGBA'));ys,xs=np.where((rgba[:,:,:3].min(2)<240)&(rgba[:,:,3]>20));mask=np.zeros(rgba.shape[:2],bool);mask[max(0,ys.min()-2):ys.max()+3,max(0,xs.min()-2):xs.max()+3]=True;rgba[~mask,3]=0
 canvas=Image.new('RGBA',psd.size);canvas.alpha_composite(Image.fromarray(rgba),(roller.left,roller.top));canvas=canvas.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC)
 file=out/(sku+'.webp');canvas.save(file,'WEBP',lossless=True);bounds=canvas.getbbox();assert bounds[1]<bb['top']
 part={'slot':'roller','variantKey':None,'zOrder':-.5,'explodeIndex':0,'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':0},'bounds':dict(zip(['left','top','right','bottom'],bounds)),'image':{'url':'/images/bottle-builder/rollers/'+file.name,'key':'builder/rollers/'+file.name,'width':1000,'height':1100,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size},'image2x':None,'mask':None,'derivation':'psd-layer'}
 registry[sku]={'bodySha256':target['image']['sha256'],'part':part}
 evidence.append({'sku':sku,'source':str(p.relative_to(root)),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rollerLayer':roller.name,'bodyLayer':body.name,'bodySha256':target['image']['sha256'],'scale':scale,'ox':ox,'oy':oy})
 print(sku,bounds)
Path('src/lib/bottle-builder/rollers-cobalt.generated.json').write_text(json.dumps(registry,indent=2)+'\n')
Path('docs/reviews/builder-mobile-preview-controls/cobalt-roller-sources.json').write_text(json.dumps(evidence,indent=2)+'\n')
