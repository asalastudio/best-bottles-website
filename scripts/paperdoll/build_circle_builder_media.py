#!/usr/bin/env python3
"""Local Circle builder media: original PSD layers, no generated geometry.
Body layer indices were visually reviewed on a contrasting background.
Inputs remain in the master library. Output is static, reviewable frontend media.
"""
import hashlib, json, re
from pathlib import Path
from PIL import Image, ImageDraw
from psd_tools import PSDImage

ROOT = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO = Path(__file__).resolve().parents[2]
OUT = REPO / 'public/images/bottle-builder/circle'
OUT.mkdir(parents=True, exist_ok=True)
BODY_SOURCES = [
 ('Circle|15|Clear|13-415', '5.  13-415 Bottles/17. Circle 15ml/2. Circle 15ml (Capped) PSD/1. GBCrcl15BlkSht.psd', 1),
 ('Circle|30|Clear|15-415', '4.  15-415 Bottles/1. Circle Clear 30ml - Capped/Circle 30ml/2. GBCrcl30SpryShnGl.psd', 2),
 ('Circle|50|Clear|18-415', '2.  18-415 Bottles /4. Circle Glass 50ml/1. Circle Glass 50ml PSD/1. GBCrcl50RdcrShnGl.psd', 1),
 ('Circle|50|Frosted|18-415', '2.  18-415 Bottles /30. Circle (Frosted) Glass 50ml/1. Circle (Frosted) Glass 50ml/1. GBCrclFrst50RdcrShnGl.psd', 1),
 ('Circle|100|Clear|18-415', '2.  18-415 Bottles /5. Circle Glass Bottle 100ml (clear)/1. Circle Glass 100ml PSD/1. GBCrcl100RdcrShnGl.psd', 1),
 ('Circle|100|Frosted|18-415', '2.  18-415 Bottles /6. Circle (frosted) 100ml/1. Circle Frst 100ml PSD/1. GBCrclFrst100RdcrShnGl.psd', 1),
]

def save(im, name):
    im=im.convert('RGBA'); box=im.getchannel('A').getbbox()
    if not box: raise ValueError('Empty source')
    im=im.crop(box)
    im.thumbnail((1000,1200),Image.Resampling.LANCZOS)
    path=OUT / f'{name}.webp'; im.save(path,'WEBP',lossless=True)
    return {'url':f'/images/bottle-builder/circle/{path.name}','width':im.width,'height':im.height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

bodies={};sources=[]
for key,relative,index in BODY_SOURCES:
    source=ROOT/relative;psd=PSDImage.open(source);layer=psd[index]
    media=save(layer.composite(),key.lower().replace('|','-'))
    bodies[key]=media
    sources.append({'body':key,'path':relative,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'layerIndex':index,'layerName':layer.name,'bounds':list(layer.bbox),'asset':media})
(REPO/'src/lib/bottle-builder/circle-bodies.generated.json').write_text(json.dumps(bodies,indent=2)+'\n')
(REPO/'data/paper-doll/circle-builder-source-review.json').write_text(json.dumps({'review':'Bare threaded bodies visually verified on bone; no caps, tubes, or mechanisms. Uniform scaling only.','sources':sources},indent=2)+'\n')
print('Exported',len(bodies),'reviewed bare Circle bodies',flush=True)

# Exact-SKU assembled photos use the established front-source selection. They
# remain flat photographs; no claims of independently swappable layers.
if __name__ == '__main__':
    import argparse, numpy as np
    parser=argparse.ArgumentParser();parser.add_argument('--rows');parser.add_argument('--reuse', action='store_true');args=parser.parse_args()
    if args.rows:
        from build_plates import validate_front_source
        selection=json.loads((REPO/'data/paper-doll/selection.json').read_text())['stems']
        inventory=json.loads((REPO/'data/paper-doll/inventory.json').read_text())['files']
        photos={};lineage=[];skipped=[]
        previous_path=REPO/'data/paper-doll/circle-builder-assembly-review.json'
        previous={s['sku']:s for s in json.loads(previous_path.read_text())['sources']} if args.reuse and previous_path.exists() else {}
        corrected_views={f'{prefix}CrclFrst50{app}{finish}' for prefix,app in [('GB','Spry'),('LB','Ltn')] for finish in ['ShnGl','ShnBlk','MtSl','ShnSl']}
        dotted={'GBCrcl15MtlRollBlkDot','GBCrcl15RollBlkDot'}
        for row in json.loads(Path(args.rows).read_text()):
            sku=row['websiteSku'];key=f"{row['family']}|{row['capacityMl']}|{row['color']}|{row['neckThreadSize']}"
            if key not in bodies:continue
            if sku in previous and sku not in corrected_views | dotted:
                old=previous[sku]
                if hashlib.sha256((ROOT/old['path']).read_bytes()).hexdigest()==old['sourceSha256']:
                    photos[sku]=old['asset'];lineage.append(old);continue
            entry=selection.get(re.sub(r'[^a-z0-9]','',sku.lower()),{})
            src=entry.get('states',{}).get('on') or entry.get('states',{}).get('unknown')
            # Selection can share hashes across metal/plastic capped views or
            # misclassify cap-only shots by blob count. Prefer an exact basename
            # in a master folder that is not explicitly an uncapped view.
            if not src or re.sub(r'^\s*\d+[.-]?\s*','',Path(src['chosenPath']).stem).strip()!=sku:
                candidates=[]
                for item in inventory:
                    if item['library']!='master' or item['ext']!='psd':continue
                    try:validate_front_source({'relPath':item['relPath']},sku)
                    except RuntimeError:continue
                    candidates.append(item)
                candidates.sort(key=lambda item: ('capped' not in item['relPath'].lower(),len(item['relPath']),item['relPath']))
                if candidates:
                    item=candidates[0];src={'chosenPath':item['relPath'],'chosen':item['sha256'],'chosenLibrary':'master'}
            if not src or src.get('chosenLibrary')!='master':
                skipped.append({'sku':sku,'reason':'No exact master front source'});continue
            if sku in corrected_views:
                exact=[f for f in inventory if f.get('stem')==sku and f['ext']=='psd']
                item=max(exact,key=lambda f:int(re.match(r'\d+',Path(f['relPath']).name)[0]))
                src={'chosenPath':item['relPath'],'chosen':item['sha256'],'chosenLibrary':'master'}
            path=ROOT/src['chosenPath']
            try:
                validate_front_source({'relPath':src['chosenPath']},sku)
                digest=hashlib.sha256(path.read_bytes()).hexdigest()
                if digest!=src['chosen']:raise ValueError('Source hash changed')
                psd=PSDImage.open(path);backgrounds=[]
                for layer in psd:
                    if layer.kind!='pixel':raise ValueError('Non-pixel source needs review')
                    im=layer.topil().convert('RGBA');a=np.asarray(im.getchannel('A'))
                    if im.width*im.height/(psd.width*psd.height)>=.98 and (a>=250).mean()>=.98:backgrounds.append(layer)
                if len(backgrounds)!=1:raise ValueError('Ambiguous background')
                if sku in dotted:
                    # Reviewed Layer 36 contains a cap plus two disconnected
                    # white retouch patches. Keep the cap island in place.
                    from scipy.ndimage import label as connected_labels
                    layer=psd[2];original=layer.composite().convert('RGBA')
                    arr=np.array(original);labels,count=connected_labels(arr[:,:,3]>0)
                    axis=(psd[1].bbox[0]+psd[1].bbox[2])/2-layer.left
                    choices=[]
                    for region in range(1,count+1):
                        ys,xs=np.where(labels==region)
                        if len(xs)>20:choices.append((abs(xs.mean()-axis),region))
                    keep=min(choices)[1];arr[labels!=keep,3]=0
                    im=Image.new('RGBA',psd.size)
                    body=psd[1];im.alpha_composite(body.composite().convert('RGBA'),(body.left,body.top))
                    im.alpha_composite(Image.fromarray(arr),(layer.left,layer.top))
                else:
                    im=psd.composite(force=True,ignore_preview=True,alpha=0,color=(1,1,1),layer_filter=lambda l:l not in backgrounds and l.is_visible())
                asset=save(im,sku)
                photos[sku]=asset
                lineage.append({'sku':sku,'path':src['chosenPath'],'sourceSha256':digest,'excludedBackground':backgrounds[0].name,'reviewNote':'Cap island retained at original position; disconnected white retouch patches excluded' if sku in dotted else 'Original foreground; visually reviewed as a single assembled bottle','asset':asset})
            except Exception as exc:skipped.append({'sku':sku,'reason':str(exc)})
        (REPO/'src/lib/bottle-builder/circle-assemblies.generated.json').write_text(json.dumps(photos,indent=2)+'\n')
        (REPO/'data/paper-doll/circle-builder-assembly-review.json').write_text(json.dumps({'sources':lineage,'skipped':skipped},indent=2)+'\n')
        print('Exported',len(photos),'exact SKU foregrounds; skipped',len(skipped),flush=True)
        items=list(photos.items())
        for start in range(0,len(items),40):
            page=items[start:start+40];sheet=Image.new('RGB',(1200,((len(page)+7)//8)*220),'#eeeae4');draw=ImageDraw.Draw(sheet)
            for n,(sku,asset) in enumerate(page):
                im=Image.open(REPO/'public'/asset['url'].lstrip('/'));im.thumbnail((138,184))
                x=n%8*150;y=n//8*220;sheet.paste(im,(x+(150-im.width)//2,y),im)
                draw.text((x+2,y+186),sku.replace('GBCrcl','').replace('LBCrcl',''),fill='black')
            sheet.save(f'/tmp/circle-assemblies-{start//40}.jpg')
