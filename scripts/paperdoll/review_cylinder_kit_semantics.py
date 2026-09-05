import json
from pathlib import Path
import sys
sys.path.insert(0,'scripts/paperdoll')
from PIL import Image
import numpy as np
from build_cyl9_kits import save_part
from build_master_kits import parity
R=Path('dist/paper-doll/cylinder-release');K=R/'kits';B=Path('dist/paper-doll/cylinder-complete');products={p['websiteSku']:p for p in json.load(open(R/'production-products-after.json'))};plates={p['websiteSku']:p for p in json.load(open(B/'plates/manifest.json'))['rows']};changed=[]
for f in K.glob('*/kit.json'):
 k=json.load(open(f));p=products[k['sku']]
 if k.get('semanticReview'):continue
 if p.get('applicator')=='Reducer':
  for part in k['parts']:
   if part['slot']=='cap':part['slot']='fitment'
  k.setdefault('notes',[]).append('Reducer closure remains one photographed fitment assembly; no unverified independent insert or cap-off state is exposed.')
 if p.get('applicator')=='Lotion Pump':
  selected=[p for p in k['parts'] if p['slot'] in ['sprayer','pump']]
  if len(selected)==1:selected[0]['slot']='pump'
  elif len(selected)>1:
   im=Image.new('RGBA',(1000,1100))
   for part in sorted(selected,key=lambda x:x['zOrder']):im.alpha_composite(Image.open(K/part['image']).convert('RGBA'))
   tmp=K/'parts'/f'{k["sku"]}.pump.tmp.webp';a=save_part(np.asarray(im),str(tmp));name=a['sha256']+'.pump.webp';tmp.replace(K/'parts'/name);base={**selected[0],**a,'slot':'pump','image':'parts/'+name,'storeKey':'kits/cylinder-master/'+name,'bounds':dict(zip(['left','top','right','bottom'],im.getbbox()))};k['parts']=[part for part in k['parts'] if part['slot'] not in ['sprayer','pump']]+[base]
 k['parts'].sort(key=lambda p:p['zOrder']);comp=Image.new('RGBA',(1000,1100),'white')
 for i,part in enumerate(k['parts']):part['zOrder']=i;comp.alpha_composite(Image.open(K/part['image']).convert('RGBA'))
 pg=parity(comp,Image.open(B/'plates'/plates[k['sku']]['plate']['key']))
 if not pg['ok'] and (pg['mean']>12 or pg['tailOver40']>.08):raise ValueError((k['sku'],pg))
 if not pg['ok']:pg['requiresVisualAlignmentReview']=True
 k['gates']['parity']=pg;k['semanticReview']=True;f.write_text(json.dumps(k,indent=1));changed.append(k['sku'])
print('Semantic review',len(changed))
