#!/usr/bin/env python3
"""Exact legacy cap photographs plus the verified same-bottle master neck.
The original legacy pixels remain authoritative below the cap seat. Only the
otherwise occluded neck comes from the reviewed master body; no generated parts.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import binary_propagation
from complete_family_plates import digest,geometry
from build_cyl9_kits import save_part,alpha_gate
from build_master_kits import parity
R=Path('dist/paper-doll/cylinder-release');B=Path('dist/paper-doll/cylinder-complete');K=R/'kits'
ss=json.load(open(R/'short-caps-sources.json'));plates={r['websiteSku']:r for r in json.load(open(B/'plates/manifest.json'))['rows']}
# Each six-SKU block was visually reviewed in short-caps-review.jpg and the cap
# seat was measured on the four source photos in cylinder-cap-cuts.jpg.
donors=[('GBCyl5BlkSht',115),('GBCylBlu5BlkSht',115),('GBTallCyl9BlkSht',60),('GBTallCylFrst9WhtSht',60)]
results=[]
for i,x in enumerate(ss):
 sku=x['sku'];row=plates[sku];source=Path(row['source']['path']);original=Image.open(source).convert('RGBA');donor,cut=donors[i//6];dk=json.load(open(K/donor/'kit.json'));dp=next(p for p in dk['parts'] if p['slot']=='body');di=Image.open(K/dp['image']).convert('RGBA');white=Image.new('RGBA',di.size,'white');white.alpha_composite(di);dg=geometry(white);tg=geometry(original);s=tg['bodyWidth']/dg['bodyWidth'];ox=tg['bodyCenter']-dg['bodyCenter']*s;oy=tg['base']-dg['base']*s
 body=di.transform(original.size,Image.Transform.AFFINE,(1/s,0,-ox/s,0,1/s,-oy/s),Image.Resampling.BICUBIC)
 # Preserve the exact legacy visible bottle, including color/reflections.
 a=np.asarray(original).copy();ink=a[:,:,:3].min(2)<248;ys,xs=np.where(ink[cut:]);left=max(0,int(xs.min())-2);right=min(original.width,int(xs.max())+3);bottom=min(original.height,int(ys.max())+cut+3)
 body.paste(original.crop((left,cut,right,bottom)),(left,cut))
 cap=original.copy();ca=np.asarray(cap).copy();ca[cut:,:,3]=0
 pale=ca[:,:,:3].min(2)>=248;seed=np.zeros(pale.shape,bool);seed[0]=pale[0];seed[:,-1]=pale[:,-1];seed[:,0]=pale[:,0];outside=binary_propagation(seed,mask=pale);ca[outside,3]=0;cap=Image.fromarray(ca)
 t=row['transform'];s=t['scale'];ox=t['ox'];oy=t['oy'];parts=[];composite=Image.new('RGBA',(1000,1100),'white');gates=[]
 for z,(slot,im) in enumerate([('body',body),('cap',cap)]):
  im=im.transform((1000,1100),Image.Transform.AFFINE,(1/s,0,-ox/s,0,1/s,-oy/s),Image.Resampling.BICUBIC);ok,g=alpha_gate(np.asarray(im));gates.append({'slot':slot,'ok':ok,**g});assert ok,(sku,g)
  tmp=K/'parts'/f'{sku}.{slot}.tmp.webp';asset=save_part(np.asarray(im),str(tmp));name=asset['sha256']+'.'+slot+'.webp';tmp.replace(K/'parts'/name);im=Image.open(K/'parts'/name).convert('RGBA');composite.alpha_composite(im);bb=im.getbbox()
  parts.append({'slot':slot,'variantKey':None,'zOrder':z,'explodeIndex':z,'bounds':dict(zip(['left','top','right','bottom'],bb)),'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':-160*z},'image':'parts/'+name,'storeKey':'kits/cylinder-master/'+name,**asset,'width':1000,'height':1100,'derivation':'background-matte'})
 pg=parity(composite,Image.open(B/'plates'/row['plate']['key']));assert pg['ok'],(sku,pg)
 r={'sku':sku,'websiteSku':sku,'graceSku':row.get('graceSku'),'familyId':row['familyId'],'status':'candidate','publishable':False,'plateSha256':row['plate']['sha256'],'canvas':{'width':1000,'height':1100},'parts':parts,'completeness':'capSplit','three':None,'source':{'library':'legacy-exact+verified-master-neck','path':x['imageUrl'],'releaseVersion':digest(source)},'gates':{'alpha':gates,'parity':pg},'anchors':{'axisX':500,'neckAxisX':500,'seatY':parts[0]['bounds']['top'],'baselineY':parts[0]['bounds']['bottom'],'pxPerMm':None},'supplementReviewed':True,'mappingEvidence':{'capSeatSourceY':cut,'sourceSha256':digest(source),'bodyDonorSku':donor,'bodyDonorSource':dk['source'],'bodyDonorPartSha256':dp['sha256'],'review':'short-caps-review.jpg; cylinder-cap-cuts.jpg; exact 13-415 same-bottle family'},'notes':['Cap profile and finish retained from exact legacy photograph; master neck only beneath the cap.']}
 dest=K/sku;dest.mkdir(exist_ok=True);(dest/'kit.json').write_text(json.dumps(r,indent=1));composite.convert('RGB').save(dest/'assembled.webp',quality=90);results.append(r)
 print(sku,pg,flush=True)
(R/'short-cap-kit-review.json').write_text(json.dumps(results,indent=1))
