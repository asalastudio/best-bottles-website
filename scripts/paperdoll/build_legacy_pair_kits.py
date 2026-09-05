#!/usr/bin/env python3
"""Build cap-split kits from reviewed exact capped/uncapped photo pairs."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import binary_propagation
from complete_family_plates import digest
from build_cyl9_kits import save_part,alpha_gate
from build_master_kits import parity
R=Path('dist/paper-doll/cylinder-release');B=Path('dist/paper-doll/cylinder-complete');K=R/'kits';plates={r['websiteSku']:r for r in json.load(open(B/'plates/manifest.json'))['rows']}
for sku in ['GBSpry1ozGl','GBSpry1ozSl']:
 row=plates[sku];source=Path(row['source']['path']);off=R/'legacy-off'/f'{sku}.gif';on=Image.open(source).convert('RGBA');body=Image.open(off).convert('RGBA');a=np.asarray(body).copy();a[:,185:,3]=0;body=Image.fromarray(a);cut=188
 body.paste(on.crop((60,cut,185,on.height)),(60,cut));a=np.asarray(body).copy();pale=a[:,:,:3].min(2)>=248;seed=np.zeros(pale.shape,bool);seed[0]=pale[0];seed[:,0]=pale[:,0];seed[:,-1]=pale[:,-1];seed[-1]=pale[-1];a[binary_propagation(seed,mask=pale),3]=0;body=Image.fromarray(a)
 cap=on.copy();a=np.asarray(cap).copy();a[cut:,:,3]=0;pale=a[:,:,:3].min(2)>=248;seed=np.zeros(pale.shape,bool);seed[0]=pale[0];seed[:,0]=pale[:,0];seed[:,-1]=pale[:,-1];a[binary_propagation(seed,mask=pale),3]=0;cap=Image.fromarray(a)
 t=row['transform'];s=t['scale'];ox=t['ox'];oy=t['oy'];parts=[];gates=[];composite=Image.new('RGBA',(1000,1100),'white')
 for i,(slot,im) in enumerate([('body',body),('overcap',cap)]):
  im=im.transform((1000,1100),Image.Transform.AFFINE,(1/s,0,-ox/s,0,1/s,-oy/s),Image.Resampling.BICUBIC);ok,g=alpha_gate(np.asarray(im));assert ok,g;gates.append(g);tmp=K/'parts'/f'{sku}.{slot}.tmp.webp';a=save_part(np.asarray(im),str(tmp));name=a['sha256']+'.'+slot+'.webp';tmp.replace(K/'parts'/name);im=Image.open(K/'parts'/name).convert('RGBA');composite.alpha_composite(im);parts.append({'slot':slot,'variantKey':None,'zOrder':i,'explodeIndex':i,'bounds':dict(zip(['left','top','right','bottom'],im.getbbox())),'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':-220*i},'image':'parts/'+name,'storeKey':'kits/cylinder-master/'+name,**a,'width':1000,'height':1100,'derivation':'background-matte'})
 pg=parity(composite,Image.open(B/'plates'/row['plate']['key']));assert pg['ok'],(sku,pg)
 r={'sku':sku,'websiteSku':sku,'graceSku':row.get('graceSku'),'familyId':row['familyId'],'status':'candidate','publishable':False,'plateSha256':row['plate']['sha256'],'canvas':{'width':1000,'height':1100},'parts':parts,'completeness':'capSplit','three':None,'source':{'library':'legacy-exact-pair','path':row['source']['url'],'releaseVersion':digest(source)},'gates':{'alpha':gates,'parity':pg},'anchors':{'axisX':500,'neckAxisX':500,'seatY':parts[0]['bounds']['top'],'baselineY':parts[0]['bounds']['bottom'],'pxPerMm':None},'supplementReviewed':True,'mappingEvidence':{'capSeatSourceY':cut,'offSource':{'path':str(off),'sha256':digest(off),'url':f'https://www.bestbottles.com/images/store/enlarged_pics/{sku}.gif'},'review':'Exact 30 mL source pair; pump and decorated body remain a photographed assembly.'},'notes':['Complete pump/body photographic assembly plus independently removable overcap.']};dest=K/sku;dest.mkdir(exist_ok=True);(dest/'kit.json').write_text(json.dumps(r,indent=1));composite.convert('RGB').save(dest/'assembled.webp',quality=90);print(sku,pg,flush=True)
