#!/usr/bin/env python3
"""Extract Boston 15 mL / 18-400 parts locally from hash-locked master sources.

Uses the approved bottle plates. The short cap is cut from the exact sold-SKU
photo because the separate library cap has a different silhouette. Six dropper
hardware layers come from high-resolution component PSDs, registered against
exact Clear bottle photos. Source-only alpha masks remove exterior retouch
scraps; photographed RGB is never repainted. Clear glass uses its photographed
pipette layer in front of its opaque studio plate; the full component pipette
remains behind coloured glass. No publishing or Convex calls.
"""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from cut_components import canvas_of, centre_line, crop_save, iou_after_fit, measure_body, sha, solid_bottom

def open_source(root: Path, source: dict):
    path=root/source['psd']
    if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:
        raise ValueError(f"source changed; review before extraction: {source['psd']}")
    return PSDImage.open(path)

def layer(psd, name):
    found=[l for l in psd.descendants() if l.name==name]
    if len(found)!=1: raise ValueError(f'expected exactly one source layer: {name}')
    return found[0]

def physical_mask(img: Image.Image, threshold: int):
    a=np.asarray(img).copy()
    ink=(a[...,3]>16)&(a[...,:3].min(axis=2)<threshold)
    labels,count=ndimage.label(ink)
    if not count: raise ValueError('no physical source ink')
    areas=np.bincount(labels.ravel());areas[0]=0
    core=ndimage.binary_fill_holes(labels==areas.argmax())
    mask=np.zeros(core.shape,bool)
    for y in range(mask.shape[0]):
        xs=np.flatnonzero(core[y])
        if len(xs): mask[y,xs.min():xs.max()+1]=True
    removed=int(((a[...,3]>0)&~mask).sum())
    a[~mask,3]=0
    return Image.fromarray(a),removed

def extract(plan: dict, plates: dict, out: Path):
    root=Path(plan['psdRoot']);out.mkdir(parents=True,exist_ok=True);entries=[]
    for cid,spec in plan['components'].items():
        ref=open_source(root,spec['reference']);psd=open_source(root,spec['source'])
        bm=measure_body(canvas_of(ref,[layer(ref,spec['reference']['bodyLayer'])]))
        plate=plates[spec['reference']['plateKey']]
        ppm=plate['pxPerMm']*(bm['foot']-bm['rim'])/(plate['anchors']['baselineY']-plate['anchors']['seatY'])
        refim,refremoved=physical_mask(canvas_of(ref,[layer(ref,spec['reference']['hardwareLayer'])]),spec['mask']['referencePaperThreshold'])
        full,removed=physical_mask(canvas_of(psd,[layer(psd,n) for n in spec['source']['hardwareLayers']]),spec['mask']['sourcePaperThreshold'])
        if spec['type']=='cap': score,scale,tx,ty=1.0,1.0,0.0,0.0
        else:
            score,scale,(tx,ty)=iou_after_fit(np.asarray(full.getchannel('A'))>128,np.asarray(refim.getchannel('A'))>128)
            if score<.90: raise ValueError(f'{cid}: source registration below 0.90 gate ({score:.3f})')
        nativeppm=ppm/scale;anchor=((bm['axisX']-tx)/scale,(bm['rim']-ty)/scale)
        entry={'componentId':cid,'websiteSku':spec['websiteSku'],'type':spec['type'],'psd':spec['source']['psd'],'sourceSha256':spec['source']['sha256'],'reference':{'psd':spec['reference']['psd'],'sourceSha256':spec['reference']['sha256'],'sku':spec['reference']['websiteSku'],'masterStem':spec['reference']['masterStem'],'bodyId':'boston-round-15ml-18-400','glass':'Clear','plateKey':spec['reference']['plateKey'],'bodyLayer':spec['reference']['bodyLayer'],'bottlePxPerMm':round(ppm,4),'rimY':bm['rim'],'axisX':bm['axisX'],'seatToFootPx':bm['foot']-bm['rim']},'layers':[],'checks':{'registrationIoU':round(score,4),'referenceSilhouetteFitPassed':True,'approvable':False,'reviewStatus':'local extraction; rendered visual acceptance and release approval pending','sourceRGBUnchanged':True,'exteriorMaskPixels':removed,'referenceExteriorMaskPixels':refremoved,'sourceMaskRecipe':spec['mask']}}
        def save(img,slot,names,pxmm,origin_anchor,z,glass=None):
            file=f"{cid}--{slot}{'-clear' if glass else ''}.png";cut,ox,oy=crop_save(img,out/file)
            record={'slot':slot,'layerName':names,'file':file,'width':cut.width,'height':cut.height,'sha256':sha(cut),'pxPerMm':round(pxmm,4),'anchor':{'x':round(origin_anchor[0]-ox,1),'y':round(origin_anchor[1]-oy,1)},'z':z,'explodeIndex':1 if slot in ('cap','fitment') else 0,'solidBottomY':solid_bottom(cut)}
            if glass:record['glass']=glass
            entry['layers'].append(record);return record,cut
        hardware,cut=save(full,'cap' if spec['type']=='cap' else 'fitment',', '.join(spec['source']['hardwareLayers']),nativeppm,anchor,'front')
        if spec['source'].get('pipetteLayer'):
            name=spec['source']['pipetteLayer'];pipe,_=save(canvas_of(psd,[layer(psd,name)]),'pipette',name,nativeppm,anchor,'behind-body')
            entry['checks']['pipetteTipMmBelowSeat']=round((pipe['solidBottomY']-pipe['anchor']['y'])/nativeppm,2)
        if spec['reference'].get('photoPipetteLayer'):
            name=spec['reference']['photoPipetteLayer'];save(canvas_of(ref,[layer(ref,name)]),'pipette',name+' (photographed through Clear glass)',ppm,(bm['axisX'],bm['rim']),'front','Clear')
        # Each source has a different resolution: apply one physical displacement,
        # rather than incorrectly copying a library-pixel shift to the photo tube.
        move=(hardware['anchor']['x']-centre_line(cut))/nativeppm
        if abs(move)>.015:
            for l in entry['layers']:l['anchor']['x']=round(l['anchor']['x']-move*l['pxPerMm'],1)
        entry['checks']['axisRecentreMm']=round(move,4)
        entries.append(entry)
    return {'neck':'18-400','scope':plan['scope'],'psdRoot':plan['psdRoot'],'method':'explicit hash-locked Boston15 source plan; approved bottle registration; source RGB preserved','components':entries}

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--plan',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--measurements',type=Path,required=True);args=ap.parse_args()
    plan=json.loads(args.plan.read_text());plates={p['plateKey']:p for p in json.loads((ROOT/'data/register/bodies/bodies-measurements.json').read_text())};result=extract(plan,plates,args.out)
    args.measurements.parent.mkdir(parents=True,exist_ok=True);args.measurements.write_text(json.dumps(result,indent=1)+'\n')
    print(f"Prepared {len(result['components'])} Boston15 source components locally; visual/release approval remains pending")

if __name__=='__main__':main()
