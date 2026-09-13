"""Repeatable, local-only cap-split pilot from hashed master layers and approved plate registration."""
import json,hashlib,sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage
ROOT=Path.cwd();MASTER=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master');OUT=ROOT/'public/images/boston-kit-pilot';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'scripts/paperdoll'))
from build_master_kits import parity
from build_cyl9_kits import alpha_gate
read=lambda p:json.loads((ROOT/p).read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
# Explicit assignments inspected in source-layers.json. Body and seated insert remain together.
recipes={'GBBstnAmb1ozMtlRollonMattBlk':{'on':3,'off':3},'GBBstnAmb1ozMtlRollonMattSl':{'on':3,'off':3},'GBBstnAmb1ozRollonMattBlk':{'on':3,'off':4},'GBBstnAmb1ozRollonMattSl':{'on':3,'off':4}}
plates={r['websiteSku']:r for r in read('dist/paper-doll/boston-master/plates/manifest.json')['rows']};catalog={r['sku']:r for r in read('src/lib/asset-ledger/ledger.json')['rows']};result={};anchors={}
def save(im):
 temp=OUT/'temporary.webp';im.save(temp,format='WEBP',lossless=True);h=sha(temp);dest=OUT/(h+'.webp');temp.replace(dest);return {'url':'/images/boston-kit-pilot/'+dest.name,'key':dest.name,'sha256':h,'bytes':dest.stat().st_size,'width':1000,'height':1100}
for sku,mapping in recipes.items():
 r=plates[sku];c=catalog[sku];assert c['family']=='Boston Round' and c['capacityMl']==30 and c['color']=='Amber';assert c['plate']['sha256']==r['plate']['sha256'] and c['plate']['complete']
 regpath=ROOT/'dist/paper-doll/boston-master/plates'/r['familyId']/('_registration-'+r['body']+'.json');reg=json.loads(regpath.read_text());row={'sku':sku,'graceSku':c['graceSku'],'groupSlug':c['groupSlug'],'applicator':c['applicator'],'capColor':c['capColor'],'expectedPlateUrl':c['plate']['imageUrl'],'registrationSha256':sha(regpath),'sources':{},'checks':{}}
 for state,key in [('on','plate'),('off','plateCapOff')]:
  asset=r[key];src=MASTER/asset['sourceRelPath'];assert sha(src)==asset['sourceSha256'];baseline=ROOT/'dist/paper-doll/boston-master/plates'/asset['key'];assert sha(baseline)==asset['sha256'];psd=PSDImage.open(src);layers=list(psd.descendants());cap=mapping[state];assert all(l.is_visible() and l.kind=='pixel' for l in layers);t=reg['plates'][f'{sku}.front-{state}'];session=next(x for x in reg['sessions'] if x['index']==t['session']);scale=reg['scale']*session['scaleFactor'];ox,oy=t['ox'],t['oy'];oldx,oldy=ox,oy
  # The inspected body layer is the physical anchor, not the whole-image center.
  body=layers[2];anchor=anchors.setdefault(state,(ox,oy,body.left,body.top));ox=anchor[0]+(anchor[2]-body.left)*scale;oy=anchor[1]+(anchor[3]-body.top)*scale
  reference=psd.composite().convert('RGB').transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC,fillcolor='white');fallback=save(reference)
  parts=[];composite=Image.new('RGBA',(1000,1100),'white');gates=[]
  for slot,ids in [('body',[i for i in range(1,len(layers)) if i!=cap]),('cap',[cap])]:
   selected={id(layers[i]) for i in ids};im=psd.composite(force=True,ignore_preview=True,color=1,alpha=0,layer_filter=lambda l:id(l) in selected).convert('RGBA');im=im.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC);ok,gate=alpha_gate(np.asarray(im));assert ok,(sku,state,slot,gate);a=save(im);decoded=Image.open(ROOT/'public'/a['url'].lstrip('/')).convert('RGBA');composite.alpha_composite(decoded);bb=decoded.getbbox();parts.append({'slot':slot,'variantKey':None,'zOrder':len(parts),'explodeIndex':0,'bounds':dict(zip(['left','top','right','bottom'],bb)),'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':0},'image':a,'image2x':None,'mask':None,'derivation':'psd-layer'});gates.append({'slot':slot,'indices':ids,**gate})
  pg=parity(composite,reference);assert pg['ok'],(sku,state,pg);reconstruction=save(composite.convert('RGB'));row[state]={'sku':sku,'familyId':r['familyId'],'plateSha256':r['plate']['sha256'],'canvas':{'width':1000,'height':1100},'anchors':{'axisX':500,'neckAxisX':500,'seatY':parts[0]['bounds']['top'],'baselineY':reg['baseOut'],'pxPerMm':None},'completeness':'capSplit','parts':parts,'three':None,'conflicts':[]};row['sources'][state]={'path':asset['sourceRelPath'],'sha256':asset['sourceSha256'],'plateSha256':asset['sha256']};row['checks'][state]={'registrationDelta':{'x':ox-oldx,'y':oy-oldy},'fallback':fallback,'alpha':gates,'parity':pg,'reconstruction':reconstruction,'before':'/images/plate-contact-sheets/'+asset['sha256']+'.webp'}
 result[sku]=row
# Reuse the verified common body/insert pixels so a finish change keeps the
# exact same browser image element and image bytes. Revalidate the assembly.
for material in ['Metal Roller Ball','Plastic Roller Ball']:
 matched=[r for r in result.values() if r['applicator']==material]
 for state in ['on','off']:
  canonical=matched[0][state]['parts'][0]
  for row in matched[1:]:
   prior=row[state]['parts'][0];a=np.asarray(Image.open(ROOT/'public'/canonical['image']['url'].lstrip('/'))).astype('int16');b=np.asarray(Image.open(ROOT/'public'/prior['image']['url'].lstrip('/'))).astype('int16');assert float(np.abs(a-b).mean())<1
   row[state]['parts'][0]=canonical.copy();composite=Image.new('RGBA',(1000,1100),'white')
   for part in row[state]['parts']:composite.alpha_composite(Image.open(ROOT/'public'/part['image']['url'].lstrip('/')).convert('RGBA'))
   pg=parity(composite,Image.open(ROOT/'public'/row['checks'][state]['fallback']['url'].lstrip('/')));assert pg['ok'];row['checks'][state]['parity']=pg;row['checks'][state]['reconstruction']=save(composite.convert('RGB'));row['checks'][state]['sharedBodyFromSku']=matched[0]['sku']
# A finish change must leave the glass/insert pixels stable in each state/material.
for material in ['Metal Roller Ball','Plastic Roller Ball']:
 matched=[r for r in result.values() if r['applicator']==material]
 for state in ['on','off']:
  a,b=[np.asarray(Image.open(ROOT/'public'/r[state]['parts'][0]['image']['url'].lstrip('/'))).astype('int16') for r in matched];err=float(np.abs(a-b).mean());assert err<1,(material,state,err)
# Exposed rollers must differ by actual photographed pixels.
a=result['GBBstnAmb1ozMtlRollonMattBlk']['off']['parts'][0]['image']['sha256'];b=result['GBBstnAmb1ozRollonMattBlk']['off']['parts'][0]['image']['sha256'];assert a!=b
payload={'schemaVersion':1,'id':'boston-30ml-amber-kit-pilot','publicationAuthorized':False,'glassStandardsSha256':sha(ROOT/'data/asset-ledger/bottle-standards.json'),'rows':result}
(ROOT/'data/asset-ledger/boston-kit-pilot.json').write_text(json.dumps(payload,indent=2)+'\n');print(json.dumps({'kits':len(result),'views':8,'parts':16,'maxParityMean':max(r['checks'][s]['parity']['mean'] for r in result.values() for s in ['on','off']),'publication':False}))
