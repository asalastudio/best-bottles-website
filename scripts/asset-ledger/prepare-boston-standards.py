#!/usr/bin/env python3
"""Prepare exact master-glass comparisons, never edit a hero or a shadow.

Registration coordinates are the separately inspected evidence in the review folder.
This produces review candidates only; it cannot grant approval or publish assets.
"""
import hashlib, json, os
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
REVIEW = ROOT/'docs/reviews/boston-glass-standards-2026-09-12'
DEST = ROOT/'public/images/bottle-standards/boston-2026-09-12'
DOCUMENT = ROOT/'data/asset-ledger/bottle-standards.json'
CANVAS = (1560,1716)
BASELINE = CANVAS[1]*.91

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def save_asset(image, label):
    temporary = DEST/(label+'.tmp.png')
    image.save(temporary)
    digest = sha(temporary)
    output = DEST/(label+'.'+digest[:16]+'.png')
    if output.exists():
        if sha(output) != digest: raise ValueError('Existing immutable asset has changed')
        temporary.unlink()
    else: temporary.rename(output)
    return dict(url='/'+str(output.relative_to(ROOT/'public')),sha256=digest)

def frame(layer, scale, x, y):
    # The selected source is the inspected, isolated glass layer. No shadow
    # detection, masking, removal, retouching or resampling is performed.
    placed = layer.transform(CANVAS,Image.Transform.AFFINE,(1/scale,0,-x/scale,0,1/scale,-y/scale),resample=Image.Resampling.BICUBIC)
    return Image.alpha_composite(Image.new('RGBA',CANVAS,(245,243,239,255)),placed).convert('RGB')

def main():
    raw=DOCUMENT.read_bytes(); doc=json.loads(raw)
    registrations=json.loads((REVIEW/'registration.json').read_text())
    ledger=json.loads((ROOT/'src/lib/asset-ledger/ledger.json').read_text())
    catalog=json.loads((ROOT/'docs/reviews/plate-grouping-2026-09-12/catalog.json').read_text())
    records={r['sku']:r for r in ledger['rows']}
    DEST.mkdir(parents=True,exist_ok=True)
    at=datetime.now(timezone.utc).isoformat()
    packets=[]
    for registration in registrations:
        s=next(s for s in doc['standards'] if s['reference']['sku']==registration['sku'])
        if s['state']=='locked': raise ValueError('A locked standard requires a separate versioned preparation')
        if s.get('referenceDecision',{}).get('sha256')!=s['reference']['sha256']: raise ValueError('Reference choice approval required')
        if s.get('sizingRequest',{}).get('percent') is None: raise ValueError('Explicit sizing amount required')
        if sha(ROOT/'public'/s['reference']['url'].lstrip('/'))!=s['reference']['sha256']: raise ValueError('Reference bytes changed')
        source=(MASTER/records[s['reference']['sku']]['plate']['sourcePath']).resolve()
        if not source.is_relative_to(MASTER) or str(source)!=registration['sourcePath']: raise ValueError('Master source crosswalk changed')
        members=[p for p in catalog['products'] if p.get('productGroupId') in s['productGroupIds']]
        if set(p['productGroupId'] for p in members)!=set(s['productGroupIds']): raise ValueError('Unresolved group mapping')
        for product in members:
            if product['family']!=s['family'] or product['capacityMl']!=s['capacityMl'] or product['neckThreadSize'] not in s['neckFinishes'] or product['color'] not in s['colors']: raise ValueError('Physical group conflict')
        psd=PSDImage.open(source); layer=psd[registration['layerIndex']]
        if layer.name!=registration['layerName'] or list(layer.offset)!=registration['layerOffset']: raise ValueError('Source layer changed')
        glass=layer.topil().convert('RGBA')
        if registration['registrationMedianPx']>3 or registration['registrationP95Px']>16: raise ValueError('Registration needs further inspection')
        scale=registration['scale']; x=registration['translateX']; y=BASELINE-registration['baseLocalY']*scale
        multiplier=1+s['sizingRequest']['percent']/100
        after_scale=scale*multiplier; after_x=780+(x-780)*multiplier; after_y=BASELINE-registration['baseLocalY']*after_scale
        # Verify the full source assembly also fits this size, keeping its offsets.
        for part in list(psd)[1:]:
            left,top,right,bottom=part.bbox
            left-=layer.left;right-=layer.left;top-=layer.top;bottom-=layer.top
            if min(left*after_scale+after_x,top*after_scale+after_y)<0 or right*after_scale+after_x>CANVAS[0] or bottom*after_scale+after_y>CANVAS[1]: raise ValueError('An original assembly part would clip')
        before=save_asset(frame(glass,scale,x,y),f"{s['capacityMl']}ml-current-glass")
        after=save_asset(frame(glass,after_scale,after_x,after_y),f"{s['capacityMl']}ml-proposed-glass")
        bare=save_asset(glass,f"{s['capacityMl']}ml-source-glass")
        p=dict(kind='bare-glass-standard',preparedAt=at,requestId=s['sizingRequest']['id'],standardVersion=s['version'],referenceSha256=s['reference']['sha256'],referenceImage={k:s['reference'][k] for k in ['url','sha256']},measurement='full_glass',before=before,after=after,
            bareGlass={**bare,'identityVerified':True,'verifiedBy':'Codex · exact catalog crosswalk and visual PSD layer inspection','verifiedAt':at,'sourcePath':str(source),'sourceSha256':sha(source),'layerIndex':registration['layerIndex'],'layerName':layer.name},
            canvas={'width':CANVAS[0],'height':CANVAS[1]},glass={'rimY':registration['rimLocalY']*after_scale+after_y,'baseY':BASELINE},beforeGlass={'rimY':registration['rimLocalY']*scale+y,'baseY':BASELINE},baselinePercent=91,
            registrationVerified=True,assemblyBoundsVerified=True,scopeVerified=True,productGroupIds=s['productGroupIds'],affectedSkus=sorted(p['websiteSku'] for p in members),
            registration=registration,transform={'before':{'scale':scale,'x':x,'y':y},'after':{'scale':after_scale,'x':after_x,'y':after_y},'relativePercent':s['sizingRequest']['percent']},
            note='Bare-glass standard from the exact master layer. Current framing is calibrated to the approved hero body. Existing hero pixels and shadows are untouched. Registration residuals are recorded; no claim that generated hero pixels exactly match the master.')
        s['preparedReview']=p
        packets.append({'standardId':s['id'],**p})
    if DOCUMENT.read_bytes()!=raw: raise ValueError('Review decisions changed during preparation; run again')
    lock=DOCUMENT.with_suffix('.json.write-lock')
    fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    try:
        if DOCUMENT.read_bytes()!=raw: raise ValueError('Review decisions changed; no write made')
        temp=DOCUMENT.with_suffix('.json.prepare.tmp');temp.write_text(json.dumps(doc,indent=2)+'\n');temp.replace(DOCUMENT)
    finally:os.close(fd);lock.unlink()
    (REVIEW/'prepared-comparisons.json').write_text(json.dumps(packets,indent=2)+'\n')
    print(json.dumps([dict(size=s['capacityMl'],change=s['sizingRequest']['percent'],glassHeight=round(s['preparedReview']['glass']['baseY']-s['preparedReview']['glass']['rimY'],2),state='prepared-not-approved') for s in doc['standards']],indent=2))

if __name__=='__main__':main()
