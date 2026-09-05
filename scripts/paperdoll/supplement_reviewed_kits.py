#!/usr/bin/env python3
"""Add exact uncapped-source physical parts without changing cap identity.
Only reviewed visible source layers are eligible. Registration uses actual body
landmarks, and every result is rechecked against its assembled plate.
"""
import json,sys
from pathlib import Path
from collections import defaultdict,Counter
from PIL import Image
import numpy as np
from psd_tools import PSDImage
from complete_family_plates import digest
from build_cyl9_kits import save_part
from build_master_kits import parity
R=Path('dist/paper-doll/cylinder-release');B=Path('dist/paper-doll/cylinder-complete');K=R/'kits'
roles={x['hash']:x['role'] for x in json.load(open(R/'all-reviewed-layer-roles.json'))}
inv={r['sku']:r for f in ['layer-inventory.json','legacy-layer-inventory.json'] for r in json.load(open(R/f)) if r['status']=='inventoried'}
offs={r['sku']:r for r in json.load(open(R/'off-layer-inventory.json'))}
plates={r['websiteSku']:r for r in json.load(open(B/'plates/manifest.json'))['rows']}
products={r['websiteSku']:r for r in json.load(open(R/'backup/production-products.json'))['rows']}
results=[]
for path in sorted(K.glob('*/kit.json')):
 r=json.load(open(path));sku=r['sku']
 if r.get('supplementReviewed') and (products.get(sku,{}).get('applicator')!='Plastic Roller Ball' or r.get('plasticRollerSourceReviewed')):continue
 try:
  parts=r['parts'];slots={p['slot'] for p in parts};off=offs.get(sku);catalog=products.get(sku,{})
  selected=defaultdict(list)
  if off and catalog.get('applicator')=='Plastic Roller Ball':
   parts[:]=[p for p in parts if p['slot']!='roller'];slots.discard('roller')
  if off:
   for l in off['layers']:
    role=roles.get(l.get('pixelHash'))
    if l.get('visible') and not l.get('background') and role in ['sprayer','pump','roller','reducer','fitment'] and role not in slots:
     if role=='roller' and catalog.get('applicator')!='Plastic Roller Ball':continue
     if role=='sprayer' and 'pump' in slots:continue
     if role=='pump' and 'sprayer' in slots:continue
     selected[role].append(l)
  if selected:
   body=next(p for p in parts if p['slot']=='body');ons=inv[sku]
   onbody=max((l for l in ons['layers'] if l.get('visible') and roles.get(l.get('pixelHash'))=='body'),key=lambda l:(l['bounds'][2]-l['bounds'][0])*(l['bounds'][3]-l['bounds'][1]))
   offbody=max((l for l in off['layers'] if l.get('visible') and roles.get(l.get('pixelHash'))=='body'),key=lambda l:(l['bounds'][2]-l['bounds'][0])*(l['bounds'][3]-l['bounds'][1]))
   bb=body['bounds'];ob=offbody['bounds'];ib=onbody['bounds'];scale=(bb['right']-bb['left'])/(ob[2]-ob[0]);ox=(bb['right']+bb['left'])/2-(ob[0]+ob[2])/2*scale;oy=bb['bottom']-ob[3]*scale
   # Exact body crops may have a one-pixel Photoshop padding difference.
   if abs((ib[2]-ib[0])/(ob[2]-ob[0])-1)>.04:raise ValueError('Uncapped body geometry needs review')
   source=Path(off['sourcePath'])
   if digest(source)!=off['sourceSha256']:raise ValueError('Uncapped source drift')
   psd=PSDImage.open(source);layers=list(psd.descendants())
   for role,ls in selected.items():
    im=Image.new('RGBA',psd.size)
    for l in ls:
     layer=layers[l['index']];lim=layer.topil().convert('RGBA')
     if role=='roller':
      a=np.asarray(lim).copy();ys,xs=np.where((a[:,:,:3].min(2)<240)&(a[:,:,3]>20));mask=np.zeros(a.shape[:2],bool);mask[max(0,ys.min()-2):ys.max()+3,max(0,xs.min()-2):xs.max()+3]=True;a[~mask,3]=0;lim=Image.fromarray(a)
     im.alpha_composite(lim,(layer.left,layer.top))
    im=im.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC)
    tmp=K/'parts/supplement.tmp.webp';a=save_part(np.asarray(im),str(tmp));name=a['sha256']+'.'+role+'.webp';tmp.replace(K/'parts'/name);bounds=Image.open(K/'parts'/name).getbbox()
    parts.append({'slot':role,'variantKey':None,'zOrder':0,'explodeIndex':1,'bounds':dict(zip(['left','top','right','bottom'],bounds)),'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':-110},'image':'parts/'+name,'storeKey':'kits/cylinder-master/'+name,**a,'width':1000,'height':1100,'derivation':'psd-layer','sourceLayerIndices':[l['index'] for l in ls]})
   parts.sort(key=lambda p:10 if p['slot'] in ['cap','overcap'] else 0 if p['slot']=='body' else 3)
   composite=Image.new('RGBA',(1000,1100),'white')
   for i,p in enumerate(parts):p['zOrder']=i;composite.alpha_composite(Image.open(K/p['image']).convert('RGBA'))
   pg=parity(composite,Image.open(B/'plates'/plates[sku]['plate']['key']))
   if not pg['ok']:
    if pg['mean']<=12 and pg['tailOver40']<=.08:pg['strictOk']=False;pg['requiresVisualAlignmentReview']=True
    else:raise ValueError('Supplement parity '+str(pg))
   r['gates']['parity']=pg;r['supplementSource']={'path':off['sourcePath'],'sha256':off['sourceSha256'],'slots':list(selected)};composite.convert('RGB').save(path.parent/'assembled.webp',quality=90)
  # Recalculate non-overlapping exploded positions after source additions.
  body=next(p for p in parts if p['slot']=='body');ceiling=body['bounds']['top']
  for i,p in enumerate(sorted((p for p in parts if p['slot']!='body'),key=lambda p:p['bounds']['bottom'],reverse=True),1):p['explodeIndex']=i;p['exploded']['dy']=min(-90*i,ceiling-p['bounds']['bottom']-24);ceiling=p['bounds']['top']+p['exploded']['dy']
  r['supplementReviewed']=True;r['plasticRollerSourceReviewed']=bool(off and catalog.get('applicator')=='Plastic Roller Ball' and 'roller' in selected);path.write_text(json.dumps(r,indent=1));results.append({'sku':sku,'status':'ready','added':list(selected)})
 except Exception as e:results.append({'sku':sku,'status':'review','reason':str(e)})
 if len(results)%30==0:print(len(results),dict(Counter(r['status'] for r in results)),flush=True)
(R/'kit-supplement-review.json').write_text(json.dumps(results,indent=1));print(Counter(r['status'] for r in results))
