from pathlib import Path
import sys, json, hashlib, shutil
import numpy as np
from PIL import Image
from psd_tools import PSDImage

root=Path(sys.argv[1])
sys.path.insert(0,str(root/'scripts/paperdoll'))
from build_master_kits import layer_inventory, validate_part_map, parity, place_exploded
from build_cyl9_kits import alpha_gate, save_part
master=Path('/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master')
review=root/'docs/reviews/vial-2ml-source-correction-2026-10-31'
out=root/'public/local-kits/vial-2ml-source-2026-10-31'
review.mkdir(parents=True,exist_ok=True); (out/'parts').mkdir(parents=True,exist_ok=True)
old=json.loads((review/'previous-production-kits.json').read_text())
rows={}; evidence=[]
scale=900/428; ox=500-237*scale; oy=1001-711*scale
for color,stem,sku in [('white','GBVClr2mlWhtCap.','GBVialClr2mlWhtCap'),('black','GBVClr2mlBlackCap.','GBVialClr2mlBlackCap')]:
    source=master/f'12. Vials/0. All Vials/Capped/1. {stem}.psd'
    psd=PSDImage.open(source); layers=list(psd.descendants()); digest=hashlib.sha256(source.read_bytes()).hexdigest()
    mapping={'sourceSha256':digest,'reviewedBy':'Codex source inspection, candidate only; not user release approval',
      'evidence':'Visible Layer 6 is the rounded vial matching the current legacy exact-SKU white-cap photo; own closure layer retained. The hidden angular Layer 4 is rejected. Layer 5 is an obsolete white closure, hidden in the white source and left enabled beneath the black closure in the black source. Black closure pixels also match its uncapped master.',
      'parts':{'body':[3],'cap':[4]},'exclude':{'1':'Obsolete angular body; hidden in source','2':'Obsolete white closure; not the black cap. White source hides this layer.'}}
    inventory=layer_inventory(psd)
    validate_part_map(mapping,[r for r in inventory if not r['background']],digest)
    kit=json.loads(json.dumps(old[sku])); kit['parts']=[]
    kit['anchors']={'axisX':500,'neckAxisX':500,'baselineY':1001,'seatY':round(oy+layers[4].bbox[3]*scale),'pxPerMm':None}
    composite=Image.new('RGBA',(1000,1100),'white')
    for index,slot in [(3,'body'),(4,'cap')]:
        layer=layers[index]
        native=Image.new('RGBA',psd.size); native.alpha_composite(layer.topil().convert('RGBA'),layer.bbox[:2])
        part=native.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),resample=Image.Resampling.BICUBIC)
        ok,gate=alpha_gate(np.asarray(part)); assert ok,(sku,slot,gate)
        temp=out/'parts/part.tmp.webp'; info=save_part(np.asarray(part),str(temp))
        name=info['sha256']+'.'+slot+'.webp'; dest=out/'parts'/name; temp.replace(dest)
        decoded=Image.open(dest).convert('RGBA'); composite.alpha_composite(decoded); l,t,r,b=decoded.getbbox()
        kit['parts'].append({'slot':slot,'variantKey':color if slot=='cap' else None,'zOrder':len(kit['parts']),'explodeIndex':len(kit['parts']),
          'bounds':{'left':l,'top':t,'right':r,'bottom':b},'assembled':{'x':0,'y':0},'exploded':{'dx':0,'dy':0},
          'image':{'url':'/local-kits/vial-2ml-source-2026-10-31/parts/'+name,'key':name,'sha256':info['sha256'],'bytes':dest.stat().st_size,'width':1000,'height':1100},
          'image2x':None,'mask':None,'derivation':'psd-layer'})
    expected=psd.composite(force=True,ignore_preview=True,color=1.0,alpha=1.0,layer_filter=lambda l:l in [layers[0],layers[3],layers[4]]).convert('RGBA')
    expected=expected.transform((1000,1100),Image.Transform.AFFINE,(1/scale,0,-ox/scale,0,1/scale,-oy/scale),resample=Image.Resampling.BICUBIC,fillcolor='white')
    check=parity(composite,expected); assert check['ok'],check
    place_exploded(kit['parts'])
    composite.save(out/(sku+'.on.png'))
    sidecar=Image.new('RGBA',(1000,1100),'white')
    for part in kit['parts']:
        img=Image.open(out/'parts'/Path(part['image']['url']).name).convert('RGBA')
        offset=(0,0) if part['slot']=='body' else (round(kit['parts'][0]['bounds']['right']+40-part['bounds']['left']),1001-part['bounds']['bottom'])
        sidecar.alpha_composite(img,offset)
    sidecar.save(out/(sku+'.off.png'))
    kit['plateSha256']=hashlib.sha256((out/(sku+'.on.png')).read_bytes()).hexdigest()
    rows[sku]=kit
    evidence.append({'sku':sku,'source':str(source.relative_to(master)),'sourceSha256':digest,'mapping':mapping,'layers':inventory,'registration':{'scale':scale,'ox':ox,'oy':oy,'uniformScale':True},'encodedLayerParity':check,'status':'local-review-candidate','userVisualApproval':False})
(out/'kits.json').write_text(json.dumps({'rows':rows},indent=2)+'\n')
(review/'source-manifest.json').write_text(json.dumps(evidence,indent=2)+'\n')
for name in ['vial-legacy-sidecar.gif','vial-legacy-capped.gif','vial-local.png','vial-production.png','vial-alternate-Uncapped.png','vial-white-master-preview.png']:
    src=Path('/tmp/bb-review-2026-10-31')/name
    if src.exists(): shutil.copy2(src,review/name)
print(json.dumps({'kits':len(rows),'parts':sum(len(k['parts']) for k in rows.values()),'parity':[e['encodedLayerParity'] for e in evidence],'overlay':str(out/'kits.json')}))
