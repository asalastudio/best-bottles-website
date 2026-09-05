#!/usr/bin/env python3
"""Finish a reviewed family source plan without modifying catalog or hosted media.

Plan rows either reuse a validated plate or identify a reviewed master/legacy
front source with exact-SKU page evidence. Database readiness is separate from
image readiness. Outputs are local and never imply publication.
"""
import argparse
import csv
import hashlib
import html
import json
import re
import shutil
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from urllib.parse import urljoin

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage

from family_report import verify_asset
from build_plates import save_webp, thumb_of

MASTER = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
SIZE = (1000, 1100)


@lru_cache(maxsize=4096)
def _digest_unchanged(path, size, mtime_ns, ctime_ns):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(path):
    stat=path.stat()
    return _digest_unchanged(path,stat.st_size,stat.st_mtime_ns,stat.st_ctime_ns)


def inside(path, root):
    value = path.resolve(strict=True)
    if not value.is_relative_to(root.resolve(strict=True)):
        raise ValueError(f'Source escapes allowed root: {path}')
    return value


def check_evidence(row, batch):
    evidence = row['evidence']
    if evidence['returnedSku'] != row['websiteSku']:
        raise ValueError('Exact website SKU differs from returned evidence')
    path = inside(Path(evidence['file']), batch / 'evidence')
    if digest(path) != evidence['sha256']:
        raise ValueError('Evidence changed after review')
    text = path.read_text()
    flattened = html.unescape(re.sub(r'<[^>]+>', ' ', text)).replace('\xa0', ' ')
    if not re.search(r'(?<![A-Za-z0-9])' + re.escape(row['websiteSku']) + r'(?![A-Za-z0-9])', flattened):
        raise ValueError('Exact SKU absent from source page')
    return evidence, text


def check_source(row, batch, master=MASTER):
    evidence, text = check_evidence(row, batch)
    source = row['source']
    if source.get('view') != 'assembled' or not source.get('reviewedBy'):
        raise ValueError('Assembled front view has not been reviewed')
    if source['kind'] == 'master':
        path = inside(Path(source['path']), master)
        if not source.get('matchEvidence'):
            raise ValueError('Master filename/identity review is required')
    elif source['kind'] == 'legacy':
        path = inside(Path(source['path']), batch / 'sources' / 'legacy')
        links = {urljoin(evidence['url'], html.unescape(m)) for m in re.findall(r'(?:src|data-original)=["\']([^"\']+)["\']', text, re.I)}
        if source['url'] not in links:
            raise ValueError('Legacy image URL is not linked by exact SKU evidence')
    else:
        raise ValueError('Unsupported source kind')
    if digest(path) != source['sha256']:
        raise ValueError('Source bytes changed after review')
    return path


def load_front(path):
    if path.suffix.lower() == '.psd':
        # Preserve the author's merged Photoshop image, not a guessed combination
        # of visible/hidden physical-part layers. Kits have a separate extractor.
        image = PSDImage.open(path).topil()
        if image is None:
            raise ValueError('PSD has no merged preview')
    else:
        image = Image.open(path)
    image = image.convert('RGBA')
    white = Image.new('RGBA', image.size, 'white')
    white.alpha_composite(image)
    return white.convert('RGB')


def geometry(image, region=None):
    gray = np.asarray(image.convert('L'))
    ys, xs = np.where(gray < 245)
    if not len(ys):
        raise ValueError('Blank product image')
    x0, x1, y0, base = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    # Bottom body band excludes pumps, side bulbs and tassels. Reviewed contact
    # sheets verify this anchor before it is used for family alignment.
    body=gray.copy()
    if region:
        left,top,right,bottom=[int(v*n) for v,n in zip(region,[image.width,image.height,image.width,image.height])]
        body[:top]=255;body[bottom:]=255;body[:,:left]=255;body[:,right:]=255
        by,bx=np.where(body<245)
        if not len(by):raise ValueError('Reviewed body region contains no product')
        base=int(by.max())
    band = body[max(y0, base - max(3, int((base-y0)*.04))):base+1] < 245
    cols = np.where(band.any(axis=0))[0]
    return dict(box=[x0,y0,x1,int(ys.max())],bodyWidth=int(cols.max()-cols.min()+1),
                bodyCenter=float((cols.max()+cols.min())/2),base=base)


def render(image, target_width, target_base, target_center=500, region=None):
    g = geometry(image,region);scale=target_width/g['bodyWidth']
    ox=target_center-g['bodyCenter']*scale;oy=target_base-g['base']*scale
    box=g['box'];bounds=[box[0]*scale+ox,box[1]*scale+oy,box[2]*scale+ox,box[3]*scale+oy]
    if bounds[0]<30 or bounds[1]<30 or bounds[2]>SIZE[0]-30 or bounds[3]>SIZE[1]-30:
        raise ValueError(f'Product would be clipped by family framing: {bounds}')
    result=image.transform(SIZE,Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC,fillcolor='white')
    output_region=None if not region else [(region[0]*image.width*scale+ox)/SIZE[0],0,1,1]
    out=geometry(result,output_region)
    if abs(out['bodyCenter']-target_center)>2:
        # Thresholding a resampled glass edge can move the measured axis. Apply
        # a translation only; never warp the product to meet the axis gate.
        dx=target_center-out['bodyCenter'];ox+=dx
        result=image.transform(SIZE,Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),Image.Resampling.BICUBIC,fillcolor='white')
        out=geometry(result,output_region)
        if abs(out['bodyCenter']-target_center)>2:
            raise ValueError(f'Rendered body axis exceeds 2 px: {out}, source: {g}')
    x0,y0,x1,y1=out['box']
    if x0<30 or y0<30 or x1>SIZE[0]-30 or y1>SIZE[1]-30:
        raise ValueError('Rendered product exceeds the safe image margins')
    return result,dict(scale=scale,ox=ox,oy=oy,sourceGeometry=g,outputGeometry=out)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan',type=Path,required=True)
    parser.add_argument('--batch',type=Path,required=True)
    args=parser.parse_args();batch=args.batch.resolve();plan=json.loads(args.plan.read_text())
    rows=plan['rows'];skus=[r['websiteSku'] for r in rows]
    if len(set(skus))!=len(skus) or set(skus)!=set(plan['scopeSkus']):
        raise ValueError('Plan must account for every scope SKU exactly once')
    out=batch/'plates';out.mkdir(parents=True,exist_ok=True)
    baseline=Path(plan['baselineRoot']);groups=defaultdict(list);images={};anchors=defaultdict(list)
    for row in rows:
        check_evidence(row,batch)
        if row.get('reuse'):
            old=row['reuse']
            if old['websiteSku']!=row['websiteSku'] or not old.get('publishable'):
                raise ValueError('Cannot reuse a held or different SKU plate')
            for role in ['plate','thumb','plateCapOff','thumbCapOff']:
                if old.get(role):
                    a=old[role];verify_asset(baseline,a)
                    source=inside(MASTER/a['sourceRelPath'],MASTER)
                    if digest(source)!=a['sourceSha256']:raise ValueError('Reused plate master source has changed')
            anchors[row.get('frameKey',row['familyId'])].append(geometry(Image.open(baseline/old['plate']['key']),row.get('bodyRegion')))
        else:
            images[row['websiteSku']]=load_front(check_source(row,batch))
            groups[row.get('frameKey',row['familyId'])].append(row)
    targets={}
    for fid,members in groups.items():
        if anchors[fid]:
            targets[fid]=(float(np.median([g['bodyWidth'] for g in anchors[fid]])),float(np.median([g['base'] for g in anchors[fid]])),float(np.median([g['bodyCenter'] for g in anchors[fid]])))
        else:
            gs=[geometry(images[r['websiteSku']],r.get('bodyRegion')) for r in members]
            center,base=(780.0,830.0) if members[0].get('bodyRegion') else (500.0,1000.0)
            widths=[]
            for g in gs:
                x0,y0,x1,y1=g['box'];cx=g['bodyCenter'];by=g['base']
                limits=[(center-40)/max(1,cx-x0),(SIZE[0]-40-center)/max(1,x1-cx),
                        (base-40)/max(1,by-y0),(SIZE[1]-40-base)/max(1,y1-by)]
                widths.append(min(limits)*g['bodyWidth'])
            targets[fid]=(min(widths),base,center)
    result=[];checks=[]
    for row in sorted(rows,key=lambda r:(r['familyId'],r['websiteSku'])):
        sku=row['websiteSku'];fid=row['familyId'];receipt={'websiteSku':sku,'familyId':fid,'convexRecordId':row.get('convexRecordId'),
            'graceSku':row.get('graceSku'),'legacyUrl':row['evidence']['url'],'evidence':row['evidence'],'catalogNotes':row.get('catalogNotes',[]),
            'releaseBlockers':row.get('releaseBlockers',[]),'published':False,'plateCapOff':None,'thumbCapOff':None}
        if row.get('reuse'):
            for role in ['plate','thumb','plateCapOff','thumbCapOff']:
                a=row['reuse'].get(role)
                if a:
                    dest=out/a['key'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(baseline/a['key'],dest);receipt[role]=a
            receipt['renderMode']='validated-master-reuse'
        else:
            print('Rendering',sku,flush=True);image,transform=render(images[sku],*targets[row.get('frameKey',fid)],region=row.get('bodyRegion'));source=row['source'];receipt['transform']=transform;receipt['source']=source
            receipt['renderMode']='reviewed-body-anchor';receipt['frameKey']=row.get('frameKey',fid);receipt['bodyRegion']=row.get('bodyRegion');receipt['nativeSourceSize']=list(images[sku].size)
            receipt['sourceQualityNote']='Legacy raster; canvas size does not increase source detail' if source['kind']=='legacy' else 'Merged master PSD'
            for role,im in [('plate',image),('thumb',thumb_of(image))]:
                name=sku+'.front-on'+('-thumb' if role=='thumb' else '')+'.webp';key=f'{fid}/{name}';asset=save_webp(im,out/key,88 if role=='plate' else 82)
                asset.update(key=key,storeKey=f'plates/{fid}/{sku}/{asset["sha256"]}.front-on-{im.width}x{im.height}.webp',sourceLibrary=source['kind'],sourceRelPath=source['path'],sourceSha256=source['sha256'],sourceEvidence=row['evidence'])
                receipt[role]=asset
        for role in ['plate','thumb','plateCapOff','thumbCapOff']:
            if receipt.get(role):verify_asset(out,receipt[role]);checks.append(dict(sku=sku,role=role,sha256=receipt[role]['sha256'],passed=True))
        receipt['mediaStatus']='validated_local';receipt['publishable']=False
        receipt['blockReasons']=['Not published; source integration and release review required']+receipt['releaseBlockers']
        result.append(receipt)
    manifest=dict(family=plan['family'],scopeSkus=skus,rows=result,counts=dict(products=len(result),validatedPlates=len(result),verifiedAssets=len(checks),published=0),planSha256=digest(args.plan))
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    review=batch/'review';review.mkdir(exist_ok=True);(review/'validation.json').write_text(json.dumps(dict(counts=manifest['counts'],checks=checks),indent=2)+'\n')
    fields=['websiteSku','convexRecordId','familyId','mediaStatus','renderMode','legacyUrl','releaseBlockers','catalogNotes','platePath','sourceQualityNote']
    with (review/'plate-status.csv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');w.writeheader()
        for r in result:w.writerow({**{k:' | '.join(r.get(k,[])) if isinstance(r.get(k),list) else r.get(k,'') for k in fields},'platePath':str(out/r['plate']['key'])})
    cards=[]
    for i,r in enumerate(result):
        src='../plates/'+r['plate']['key'];reference=next(x for x in rows if x['websiteSku']==r['websiteSku'])['referencePath']
        ref=Path(reference);ref_rel='../sources/legacy/'+ref.name
        cards.append(f'<article data-search="{html.escape((r["websiteSku"]+" "+r["familyId"]).lower())}"><div class="images"><a href="{src}"><img loading="lazy" src="{src}" alt="{r["websiteSku"]} plate"></a><img loading="lazy" src="{ref_rel}" alt="Legacy reference"></div><h2>{r["websiteSku"]}</h2><p>{r["familyId"]}</p><p>Plate · Legacy reference</p><p>{html.escape("; ".join(r["releaseBlockers"]))}</p></article>')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cylinder plates review</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f4ef;color:#232821;font:15px system-ui}main{max-width:1400px;margin:auto;padding:30px}h1{font-size:36px}input{padding:14px;width:100%;font:inherit;margin:20px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}article{background:white;padding:16px;border:1px solid #ddd}h2{font-size:15px;overflow-wrap:anywhere}p{line-height:1.5;overflow-wrap:anywhere}.images{display:flex;height:260px}.images>a,.images>img{width:50%;object-fit:contain}.images img{width:100%;height:100%;object-fit:contain}.images>img{width:50%}article[hidden]{display:none}a{color:#315b4b}@media(max-width:440px){main{padding:16px}}</style><main><h1>Cylinder plates</h1><p>COUNT exact-SKU plates validated locally. Click a plate to inspect the full image. Each card compares the plate with its current legacy reference; a reference may show an alternate view. These files are not published. Kits are a separate task.</p><a href="plate-status.csv">Download per-SKU status</a><input id="search" aria-label="Search SKU or family" placeholder="Search SKU, size, color or neck"><div class="grid">CARDS</div></main><script>document.getElementById('search').addEventListener('input',e=>document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.includes(e.target.value.toLowerCase())));</script></html>'''
    (review/'index.html').write_text(page.replace('COUNT',str(len(result))).replace('CARDS','\n'.join(cards)))
    for fid in sorted({r['familyId'] for r in result}):
        members=[r for r in result if r['familyId']==fid]
        for part in range(0,len(members),30):
            subset=members[part:part+30];sheet=Image.new('RGB',(1200,((len(subset)+5)//6)*235),'white');draw=ImageDraw.Draw(sheet)
            for i,r in enumerate(subset):
                im=Image.open(out/r['plate']['key']);im.thumbnail((190,200));x=i%6*200;y=i//6*235;sheet.paste(im,(x+(200-im.width)//2,y));draw.text((x+3,y+201),r['websiteSku'],fill='black')
            sheet.save(review/f'{fid}-{part//30+1}.jpg')
    print(json.dumps(manifest['counts']))


if __name__=='__main__':main()
