#!/usr/bin/env python3
"""Extract registered photographic kits from exact master PSD layers.

No archive sources, invented geometry, or publishing. A part map can explicitly
assign PSD layer indices to physical slots. Without a reviewed map only the
strict two-layer cap-only case is eligible, with the identical cap layer in the
uncapped source as independent evidence. Everything else is a review exception.

python3 scripts/paperdoll/build_master_kits.py --batch dist/paper-doll/cylinder-master
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from family_batch import checked_source, MASTER
from build_plates import validate_front_source
from build_cyl9_kits import alpha_gate, save_part

SLOTS={'body','fitment','roller','cap','overcap','sprayer','pump','diptube','collar','bulb','tassel','reducer','pipette'}

def digest_image(im):
    return hashlib.sha256(str((im.size,im.mode)).encode()+im.tobytes()).hexdigest()

def layer_inventory(psd):
    out=[]
    for i,l in enumerate(psd.descendants()):
        if l.is_group(): continue
        if l.kind != 'pixel':
            raise ValueError(f'non-pixel layer {i} requires source review')
        if not l.is_visible():
            raise ValueError(f'hidden layer {i} requires source review')
        if l.opacity != 255 or str(l.blend_mode.value) not in ("b'norm'",'norm'):
            raise ValueError(f'layer {i} blending/opacity requires source review')
        im=l.topil()
        if im is None: continue
        alpha=np.asarray(im.convert('RGBA').getchannel('A'))
        fraction=im.width*im.height/(psd.width*psd.height)
        background=(fraction>=0.98 and float((alpha>=250).mean())>=0.98)
        out.append({'index':i,'name':l.name,'bounds':list(l.bbox),'background':background,
                    'pixelHash':digest_image(im),'size':list(im.size)})
    return out

def validate_part_map(mapping,foreground,source_sha):
    if mapping.get('sourceSha256') != source_sha:
        raise ValueError('part map is stale for this source hash')
    if not mapping.get('reviewedBy') or not mapping.get('evidence'):
        raise ValueError('part map requires reviewer and evidence')
    parts=mapping.get('parts',{})
    if 'body' not in parts or len(parts)<2 or set(parts)-SLOTS:
        raise ValueError('part map needs a body and valid physical component slots')
    assigned=[i for ids in parts.values() for i in ids]
    if any(not ids for ids in parts.values()) or len(assigned)!=len(set(assigned)) or set(assigned)!={l['index'] for l in foreground}:
        raise ValueError('part map must cover each foreground layer exactly once')
    return parts

def automatic_cap_map(product,foreground,off_psd):
    if product.get('applicator')!='Cap/Closure' or len(foreground)!=2 or off_psd is None:
        raise ValueError('explicit component-layer mapping required')
    body=max(foreground,key=lambda l:l['size'][1]); cap=next(l for l in foreground if l!=body)
    if body['size'][1] <= cap['size'][1]*2:
        raise ValueError('body/cap geometry is ambiguous')
    off_layers=layer_inventory(off_psd)
    matches=[l for l in off_layers if not l['background'] and l['pixelHash']==cap['pixelHash']]
    if len(matches)!=1:
        raise ValueError('cap layer not independently confirmed in uncapped source')
    return {'body':[body['index']],'cap':[cap['index']]}

def parity(composite,plate):
    a=np.asarray(composite.convert('RGB')).astype(np.int16);b=np.asarray(plate.convert('RGB')).astype(np.int16)
    ink=(a.min(axis=2)<245)|(b.min(axis=2)<245)
    if not ink.any(): return {'ok':False,'reason':'empty composite'}
    diff=np.abs(a-b).max(axis=2)[ink]
    mean=float(np.abs(a-b)[ink].mean());tail=float((diff>40).mean())
    return {'ok':mean<=6 and tail<=.01,'mean':round(mean,4),'tailOver40':round(tail,6)}

def place_exploded(parts):
    """Separate the photographed parts without cropping or hiding overlap."""
    ceiling=next(p['bounds']['top'] for p in parts if p['slot']=='body')
    for part in sorted((p for p in parts if p['slot']!='body'),key=lambda p:p['explodeIndex']):
        dy=min(-120*part['explodeIndex'],ceiling-part['bounds']['bottom']-32)
        if part['bounds']['top']+dy<8:
            raise ValueError(f"{part['slot']} exploded bounds would leave the frame; explicit spacing review required")
        part['exploded']={'dx':0,'dy':dy}
        ceiling=part['bounds']['top']+dy

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--batch',type=Path,required=True);ap.add_argument('--part-map',type=Path);ap.add_argument('--sku',action='append');args=ap.parse_args()
    batch=args.batch.resolve(); plates=batch/'plates'; output=batch/'kits';output.mkdir(exist_ok=True)
    manifest=json.loads((plates/'manifest.json').read_text());xref=json.loads((batch/'input/xref.json').read_text());qualified={r['websiteSku'] for r in xref['products'] if r['publishable'] and r.get('kitApplicability')!='notApplicable'}
    catalog=json.loads((batch/'input/convex-snapshot.json').read_text()); products={p['websiteSku']:p for p in catalog['products']}
    maps=json.loads(args.part_map.read_text()) if args.part_map else {}
    results=[]
    for row in manifest['rows']:
        sku=row['websiteSku']
        if sku not in qualified or (args.sku and sku not in args.sku):continue
        record={'sku':sku,'familyId':row['familyId'],'status':'review','publishable':False,'parts':[]}
        try:
            if not row['publishable']:raise ValueError('plate registration failed')
            src=row['plate'];path=checked_source(MASTER/src['sourceRelPath']);validate_front_source({'relPath':src['sourceRelPath']},sku)
            source_sha=hashlib.sha256(path.read_bytes()).hexdigest()
            if source_sha!=src['sourceSha256']:raise ValueError('source hash drift')
            plate_path=plates/src['key'];plate_bytes=plate_path.read_bytes()
            if hashlib.sha256(plate_bytes).hexdigest()!=src['sha256']:raise ValueError('plate hash drift')
            psd=PSDImage.open(path);layers=layer_inventory(psd);foreground=[l for l in layers if not l['background']]
            record.update({'sourcePath':src['sourceRelPath'],'sourceSha256':source_sha,'layers':layers,'applicator':products[sku].get('applicator')})
            if sku in maps:
                parts=validate_part_map(maps[sku],foreground,source_sha); mapping_evidence=maps[sku]
            else:
                off_src=row.get('plateCapOff');off=None
                if off_src:
                    off_path=checked_source(MASTER/off_src['sourceRelPath'])
                    if hashlib.sha256(off_path.read_bytes()).hexdigest()!=off_src['sourceSha256']:raise ValueError('uncapped source hash drift')
                    off=PSDImage.open(off_path)
                parts=automatic_cap_map(products[sku],foreground,off)
                mapping_evidence={'method':'two-layer cap-only source plus identical uncapped cap pixels'}
            registration=json.loads((plates/row['familyId']/f"_registration-{row['body']}.json").read_text());t=registration['plates'][f'{sku}.front-on'];session=next(s for s in registration['sessions'] if s['index']==t['session']);scale=registration['scale']*session['scaleFactor'];ox,oy=t['ox'],t['oy']
            all_layers=list(psd.descendants());composite=Image.new('RGBA',(1000,1100),'white');part_rows=[];gates=[]
            # Slots must not interleave in Photoshop's stack. Interleaving can
            # change compositing even if all original pixel layers are present.
            ordered=sorted(parts.items(),key=lambda kv:min(kv[1])); previous=-1
            for slot,ids in ordered:
                if min(ids)<=previous:raise ValueError('interleaved physical-part layers need review')
                previous=max(ids); selected={id(all_layers[i]) for i in ids}
                im=psd.composite(force=True,ignore_preview=True,alpha=0.0,color=1.0,layer_filter=lambda l:l.is_group() or id(l) in selected).convert('RGBA')
                transformed=im.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),resample=Image.Resampling.BICUBIC)
                ok,gate=alpha_gate(np.asarray(transformed));gates.append({'slot':slot,'ok':ok,**gate})
                if not ok:raise ValueError(f'{slot} alpha gate failed: {gate}')
                part_dir=output/'parts';part_dir.mkdir(exist_ok=True);tmp=part_dir/'part.tmp.webp';asset=save_part(np.asarray(transformed),str(tmp));name=f"{asset['sha256']}.{slot}.webp";dest=part_dir/name;tmp.replace(dest)
                # Gate the exact encoded bytes the browser will display.
                decoded=Image.open(dest).convert('RGBA');composite.alpha_composite(decoded)
                bbox=decoded.getbbox()
                explode_index=0 if slot=='body' else 1+sum(p['slot']!='body' for p in part_rows)
                part_rows.append({'slot':slot,'variantKey':None,'zOrder':len(part_rows),'explodeIndex':explode_index,
                  'image':f'parts/{name}','storeKey':f"kits/master-parts/{name}",**asset,'width':1000,'height':1100,
                  'bounds':{'left':bbox[0],'top':bbox[1],'right':bbox[2],'bottom':bbox[3]},'assembled':{'x':0,'y':0},
                  'exploded':{'dx':0,'dy':0},'derivation':'psd-layer','sourceLayerIndices':ids})
            place_exploded(part_rows)
            pg=parity(composite,Image.open(plate_path))
            if not pg['ok']:raise ValueError(f'plate parity failed: {pg}')
            sku_dir=output/row['familyId']/sku;sku_dir.mkdir(parents=True,exist_ok=True);composite.convert('RGB').save(sku_dir/'assembled.webp',quality=90)
            exploded=Image.new('RGBA',(1000,1100),'white')
            for part in part_rows:exploded.alpha_composite(Image.open(output/part['image']).convert('RGBA'),(0,part['exploded']['dy']))
            exploded.convert('RGB').save(sku_dir/'exploded.webp',quality=90)
            record.update({'status':'candidate','publishable':False,'reviewRequired':'visual component and exploded-frame review before publishing','websiteSku':sku,'graceSku':products[sku]['graceSku'],
                'plateSha256':src['sha256'],'canvas':{'width':1000,'height':1100},'parts':part_rows,'completeness':'full',
                'three':None,'mappingEvidence':mapping_evidence,'gates':{'alpha':gates,'parity':pg},
                'source':{'library':'master','path':src['sourceRelPath'],'releaseVersion':None},
                'anchors':{'axisX':500,'neckAxisX':500,'seatY':next(p['bounds']['bottom'] for p in part_rows if p['slot']!='body'),'baselineY':registration['baseOut'],'pxPerMm':None}})
            (sku_dir/'kit.json').write_text(json.dumps(record,indent=2))
        except Exception as e:
            record['reason']=f'{type(e).__name__}: {e}'
        results.append(record)
        if len(results)%25==0:print(f'Kit extraction {len(results)}: {dict(Counter(r["status"] for r in results))}',flush=True)
    # A sample run is a separate artifact, never a replacement for the complete
    # batch manifest. Reports and future publishers must use the complete run.
    manifest_name='sample-manifest.json' if args.sku else 'manifest.json'
    (output/manifest_name).write_text(json.dumps({'builder':'master-psd-kit 1','partial':bool(args.sku),'rows':results,'counts':dict(Counter(r['status'] for r in results))},indent=1))
    print(dict(Counter(r['status'] for r in results)))

if __name__=='__main__':main()
