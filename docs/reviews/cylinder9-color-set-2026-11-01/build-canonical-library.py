from pathlib import Path
import json,hashlib,shutil,copy,math
root=Path.cwd();d=root/'docs/reviews/cylinder9-color-set-2026-11-01';p=root/'public/reviews/cylinder9-color-set-2026-11-01';out=root/'public/local-kits/cylinder9-masters-2026-11-01';out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();assets={}
for name in ['body-clear','body-amber','body-cobalt','body-frosted','body-swirl','collar-black','collar-gold','collar-matte-silver','collar-shiny-silver','collar-red','collar-turquoise','actuator','overcap','tube-fitted']:
 b=(p/(name+'.png')).read_bytes();digest=sha(b);file=name+'.'+digest[:12]+'.png';shutil.copy2(p/(name+'.png'),out/file);w,h=(743,2116) if name.startswith('body-') else (1204,1028) if name.startswith('collar-') else (992,1208) if name=='actuator' else (427,569) if name=='overcap' else (180,1457);assets[name]={'url':'/local-kits/cylinder9-masters-2026-11-01/'+file,'sha256':digest,'bytes':len(b),'width':w,'height':h}
configs=json.loads((root/'data/paper-doll/CYL-9ML/configurations.json').read_text());source=json.loads((d/'source-complete-kits.json').read_text())['rows'];ref=source['GBCyl9SpryBlk'];oldbody=next(x for x in ref['parts'] if x['slot']=='body');axis=500;rim=oldbody['box']['y'];H=oldbody['box']['height'];s=H/1905;ppm=H/70;foot=rim+H;bound={'left':axis-256*s,'right':axis+256*s,'top':rim,'bottom':foot};glasses={'Clear':'clear','Amber':'amber','Cobalt Blue':'cobalt','Frosted':'frosted','Swirl':'swirl'};finishes={'Black':'black','Gold':'gold','Matte Silver':'matte-silver','Shiny Silver':'shiny-silver','Red':'red','Turquoise':'turquoise'};rows={};skuIndex={}
def part(slot,asset,box,z,component=None,index=0,views=None,exploded=None):
 a=assets[asset];r={'slot':slot,'variantKey':None,'zOrder':z,'explodeIndex':index,'bounds':{'left':box['x'],'top':box['y'],'right':box['x']+box['width'],'bottom':box['y']+box['height']},'assembled':{'x':0,'y':0},'exploded':exploded or {'dx':0,'dy':0},'image':{**a,'key':''},'image2x':None,'mask':None,'derivation':'psd-layer','box':box,'componentId':component}
 if views:r['views']=views
 return r
def physical(slot,asset,nw,nh,nppm,ax,ay,z,cid,iy=0,dx=0,dy=0,index=1,views=None):
 return part(slot,asset,{'x':axis+dx-ax*ppm/nppm,'y':rim+iy+dy-ay*ppm/nppm,'width':nw*ppm/nppm,'height':nh*ppm/nppm},z,cid,index,views,{'dx':30*ppm,'dy':-13*ppm})
for c in configs:
 sku=c['websiteSku'];kit=copy.deepcopy(source[sku]);g=glasses[c['glassLabel']];body=part('body','body-'+g,{'x':axis-375*s,'y':rim-113*s,'width':743*s,'height':2116*s},1);body['bounds']=copy.deepcopy(bound);parts=[];deltaX=axis-kit['anchors']['axisX'];deltaY=rim-kit['anchors']['seatY']
 for old in kit['parts']:
  if old['slot']=='body':continue
  old['box']['x']+=deltaX;old['box']['y']+=deltaY
  for key,delta in [('left',deltaX),('right',deltaX),('top',deltaY),('bottom',deltaY)]:old['bounds'][key]+=delta
  if g!='clear' and old['slot'] in ['diptube','pipette']:
   if old.get('views') and 'exploded' not in old['views']:continue
   old['views']=['exploded']
  parts.append(old)
 if c['applicatorKey']=='fine-mist-sprayer':
  finish=finishes[c['finishLabel']];cid=kit['register']['componentIds'][0];lift=-.7*ppm
  tube=physical('diptube','tube-fitted',180,1457,39/1.4,86,0,0,cid,iy=12.2*ppm,index=1,views=None if g=='clear' else ['exploded'])
  head=physical('sprayer','actuator',992,1208,15.338*4,122.5*4,299.9*4,4,cid,iy=lift,index=1)
  collar=physical('collar','collar-'+finish,1204,1028,15.338*4,148.5*4,30.9*4,5,cid,iy=lift,index=1)
  cap=part('overcap','overcap',{'x':410.52,'y':55-.7*ppm,'width':179.37,'height':239.02},8,cid,2,exploded={'dx':-280,'dy':767})
  parts=[tube,body,head,collar,cap]
 else:parts=[body,*parts]
 kit.update({'sku':sku,'parts':parts,'plateSha256':assets['body-'+g]['sha256'],'glassSizing':{**ref['glassSizing'],'landmarkY':ref['glassSizing']['landmarkY']+(foot-oldbody['bounds']['bottom']),'source':'Approved Cylinder 9 ml family scale and November 1 master registration'},'anchors':{**ref['anchors'],'baselineY':foot}})
 kit['register'].update({'glass':c['glassLabel'],'plateKey':'cylinder-9ml-17-415|'+c['glassLabel']});rows[sku]=kit;skuIndex[sku]={'glass':g,'fitment':c['applicatorLabel'],'finish':c['finishLabel'],'productGroupSlug':c['productGroupSlug']}
version=sha(''.join(a['sha256'] for a in assets.values()).encode())[:12]
payload={'version':version,'bodyId':'cylinder-9ml-17-415','rows':rows,'defaultPdpSkus':list(rows)};(out/'kits.json').write_text(json.dumps(payload,indent=2)+'\n')
index={'version':version,'bodyId':'cylinder-9ml-17-415','assets':assets,'skus':skuIndex,'kitFile':'public/local-kits/cylinder9-masters-2026-11-01/kits.json'};(root/'src/lib/products/cylinder9-master-index.json').write_text(json.dumps(index,indent=2)+'\n');(d/'canonical-library.json').write_text(json.dumps(index,indent=2)+'\n');print(json.dumps({'version':version,'kits':len(rows),'canonicalBodies':5,'sharedAssets':len(assets)}))
