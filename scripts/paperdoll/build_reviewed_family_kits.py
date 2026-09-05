#!/usr/bin/env python3
"""Build photographic kits from hash-reviewed master layers and a plate plan.

No catalog writes. Every physical role is reviewed against layer pixels, never
derived from a SKU. Recipes retain fused source assemblies as a single part.
"""
import argparse,hashlib,json,sys,time
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from complete_family_plates import digest,MASTER,geometry
from build_master_kits import parity
from build_cyl9_kits import save_part,alpha_gate

def transform_for(row,plan,baseline):
 if 'transform' in row:
  t=row['transform'];return t['scale'],t['ox'],t['oy']
 old=plan['reuse'];reg=json.loads((baseline/old['familyId']/f'_registration-{old["body"]}.json').read_text())
 t=reg['plates'][row['websiteSku']+'.front-on'];session=next(s for s in reg['sessions'] if s['index']==t['session'])
 return reg['scale']*session['scaleFactor'],t['ox'],t['oy']

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--batch',type=Path,required=True);ap.add_argument('--review',type=Path,required=True);ap.add_argument('--sku',action='append');ap.add_argument('--additional',action='store_true');args=ap.parse_args()
 batch=args.batch;review=args.review;out=review/'kits';out.mkdir(exist_ok=True)
 plan=json.load(open(batch/'source-plan.json'));plans={r['websiteSku']:r for r in plan['rows']};baseline=Path(plan['baselineRoot'])
 plates=json.load(open(batch/'plates/manifest.json'))['rows'];roles={r['hash']:r for r in json.load(open(review/'all-reviewed-layer-roles.json'))}
 inventories={r['sku']:r for r in json.load(open(review/('legacy-layer-inventory.json' if args.additional else 'layer-inventory.json')))};results=[]
 for row in plates:
  sku=row['websiteSku']
  if args.additional and sku not in inventories:continue
  if args.sku and sku not in args.sku:continue
  dest=out/sku/'kit.json'
  if dest.exists():results.append(json.load(open(dest)));continue
  result={'sku':sku,'websiteSku':sku,'familyId':row['familyId'],'status':'review','publishable':False}
  try:
   inv=inventories[sku]
   if inv['status']!='inventoried':raise ValueError('Editable source matching required; current front is a legacy raster')
   source=Path(inv['sourcePath'])
   if not source.resolve().is_relative_to(MASTER):raise ValueError('Outside master source root')
   if digest(source)!=inv['sourceSha256']:raise ValueError('Reviewed source changed')
   plate_path=batch/'plates'/row['plate']['key']
   if digest(plate_path)!=row['plate']['sha256']:raise ValueError('Plate changed')
   psd=PSDImage.open(source);all_layers=list(psd.descendants());selected=defaultdict(list);mapping=[]
   for l in inv['layers']:
    if not l.get('visible') or l.get('background') or not l.get('pixelHash'):continue
    role=roles.get(l.get('pixelHash'))
    if role is None:raise ValueError('Unreviewed layer '+str(l['index']))
    slot=role['role'];mapping.append({'index':l['index'],'pixelHash':l['pixelHash'],'slot':slot,'review':role['evidence']})
    if slot!='exclude':selected[slot].append(l['index'])
   if 'body' not in selected or len(selected)<2:raise ValueError('Source has no separable body/component assembly')
   fused=False
   # White Photoshop repair cards are not a physical part. Preserve the actual
   # roller and the real neck beneath it, rather than baking the card into glass.
   # Photographed nozzle repair patches belong to the pump, not a separate part.
   # Mapping deliberately keeps the entire photographed assembly together.
   if args.additional:
    target_g=geometry(Image.open(plate_path));source_g=geometry(psd.topil())
    scale=target_g['bodyWidth']/source_g['bodyWidth'];ox=target_g['bodyCenter']-source_g['bodyCenter']*scale;oy=target_g['base']-source_g['base']*scale
   else:scale,ox,oy=transform_for(row,plans[sku],baseline)
   parts=[];composite=Image.new('RGBA',(1000,1100),'white');gates=[]
   for slot,ids in sorted(selected.items(),key=lambda x:max(x[1])):
    chosen={id(all_layers[i]) for i in ids}
    layers=[all_layers[i] for i in ids]
    adjustments={id(all_layers[l['index']]) for l in inv['layers'] if l.get('visible') and not l.get('pixelHash')}
    if not adjustments and all(l.kind=='pixel' and l.opacity==255 and not l.has_mask() and str(l.blend_mode.value)=="b'norm'" for l in layers):
     im=Image.new('RGBA',psd.size)
     for l in layers:
      lim=l.topil().convert('RGBA');info=next(x for x in inv['layers'] if x['index']==all_layers.index(l))
      if roles.get(info.get('pixelHash'),{}).get('trimWhiteRetouch') or slot=='roller':
       a=np.asarray(lim).copy();ys,xs=np.where((a[:,:,:3].min(2)<240)&(a[:,:,3]>20));mask=np.zeros(a.shape[:2],bool);mask[max(0,ys.min()-2):ys.max()+3,max(0,xs.min()-2):xs.max()+3]=True;a[~mask,3]=0;lim=Image.fromarray(a)
      im.alpha_composite(lim,(l.left,l.top))
    else:
     im=psd.composite(force=True,ignore_preview=True,alpha=0.,color=1.,layer_filter=lambda l:l.is_group() or id(l) in chosen or id(l) in adjustments).convert('RGBA')
    im=im.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),resample=Image.Resampling.BICUBIC)
    ok,gate=alpha_gate(np.asarray(im));gates.append({'slot':slot,'ok':ok,**gate})
    if not ok:raise ValueError(f'{slot} alpha gate: {gate}')
    partdir=out/'parts';partdir.mkdir(exist_ok=True);tmp=partdir/(sku+'.'+slot+'.tmp.webp');asset=save_part(np.asarray(im),str(tmp));name=f'{asset["sha256"]}.{slot}.webp';path=partdir/name;tmp.replace(path)
    im=Image.open(path).convert('RGBA');composite.alpha_composite(im);bounds=im.getbbox();exp=0 if slot=='body' else 1
    parts.append({'slot':slot,'variantKey':None,'zOrder':len(parts),'explodeIndex':exp,'bounds':dict(zip(['left','top','right','bottom'],bounds)),
     'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':0 if slot=='body' else -110},'image':'parts/'+name,'storeKey':'kits/cylinder-master/'+name,
     **asset,'width':1000,'height':1100,'derivation':'psd-layer','sourceLayerIndices':ids})
   pg=parity(composite,Image.open(plate_path))
   if not pg['ok']:
    if pg['mean']<=12 and pg['tailOver40']<=.08:
     pg['strictOk']=False;pg['requiresVisualAlignmentReview']=True
    else:raise ValueError('Assembled parity failed '+str(pg))
   # Keep grouped assemblies together; arrange parts using source geometry and
   # leave fitting the exploded frame to the viewer's shared canvas transform.
   body=next(p for p in parts if p['slot']=='body');ceiling=body['bounds']['top']
   for i,p in enumerate(sorted((p for p in parts if p['slot']!='body'),key=lambda p:p['bounds']['bottom'],reverse=True),1):
    p['explodeIndex']=i;p['exploded']['dy']=min(-90*i,ceiling-p['bounds']['bottom']-24);ceiling=p['bounds']['top']+p['exploded']['dy']
   target=out/sku;target.mkdir(exist_ok=True);composite.convert('RGB').save(target/'assembled.webp',quality=90)
   result.update(status='candidate',plateSha256=row['plate']['sha256'],graceSku=row.get('graceSku'),canvas={'width':1000,'height':1100},parts=parts,
    completeness='capSplit' if fused or (len(parts)==2 and 'cap' in selected) else 'full',three=None,mappingEvidence=mapping,
    source={'library':'master','path':str(source.relative_to(MASTER)),'releaseVersion':inv['sourceSha256']},gates={'alpha':gates,'parity':pg},
    anchors={'axisX':500,'neckAxisX':500,'seatY':body['bounds']['top'],'baselineY':body['bounds']['bottom'],'pxPerMm':None},
    notes=['Roller and original neck retouch retained with body; cap separates.'] if fused else [])
   dest.write_text(json.dumps(result,indent=1))
  except Exception as e:result['reason']=str(e)
  results.append(result)
  if len(results)%20==0:print(len(results),dict(Counter(r['status'] for r in results)),flush=True)
 name='additional-manifest.json' if args.additional else 'sample-manifest.json' if args.sku else 'manifest.json'
 (out/name).write_text(json.dumps({'generatedAt':time.time(),'rows':results,'counts':dict(Counter(r['status'] for r in results))},indent=1));print(dict(Counter(r['status'] for r in results)),flush=True)
if __name__=='__main__':main()
