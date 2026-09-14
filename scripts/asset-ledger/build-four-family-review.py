#!/usr/bin/env python3
"""One immutable, same-zoom contact sheet for the four family preparation.

All catalog rows, duplicate proposals and additional exact legacy SKUs remain
accounted for. It never approves or publishes a plate.
"""
import argparse,hashlib,json,shutil
from pathlib import Path
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[2]
BATCH=ROOT/'dist/paper-doll/four-family-plates-2026-09-13'
ID='four-family-plates-2026-09-13'
FAMILIES=['Elegant','Diva','Circle','Sleek']
DOCS=ROOT/'docs/reviews'/ID
PUBLIC=ROOT/'public/reviews'/ID
MEDIA=ROOT/'public/images'/ID
POLICY=json.loads((ROOT/'src/lib/products/closure-presentation-policy.json').read_text())

def hashfile(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def media(p,sha):
    if hashfile(p)!=sha:raise ValueError('Review image changed: '+str(p))
    target=MEDIA/(sha+'.webp')
    if not target.exists():shutil.copy2(p,target)
    if hashfile(target)!=sha:raise ValueError('Review copy differs')
    return '/images/'+ID+'/'+target.name

def main(draft):
    for p in [DOCS,PUBLIC,MEDIA]:p.mkdir(parents=True,exist_ok=True)
    ledger=json.loads((BATCH/'ledger-before.json').read_text());catalog=json.loads((BATCH/'catalog.json').read_text())
    current={p['websiteSku']:p for p in catalog['products'] if p.get('websiteSku')}
    before=json.loads((BATCH/'before-plates.json').read_text());images={r['url']:r for r in json.loads((BATCH/'before-images.json').read_text()) if 'sha256' in r}
    legacy=json.loads((BATCH/'evidence/index.json').read_text());pages={r['sku']:r for r in legacy['pages']}
    duplicates={r['sku']:r for r in json.loads((BATCH/'proposed-duplicate-dispositions.json').read_text())['rows']}
    candidates={};preparations={};xrefs={}
    for family in FAMILIES:
        folder=BATCH/family.lower()
        if not (folder/'recovery/plates/manifest.json').exists() and not draft:raise ValueError(family+' preparation is not complete')
        if (folder/'input/xref.json').exists():xrefs.update({r['websiteSku']:r for r in json.loads((folder/'input/xref.json').read_text())['products']})
        for p in [folder,folder/'recovery',folder/'aliases',folder/'view-recovery']:
            manifest=p/'plates/manifest.json'
            if manifest.exists():
                for row in json.loads(manifest.read_text())['rows']:
                    # Recovery manifests can repeat a primary row that was
                    # deliberately held. Only rendered candidates enter the
                    # combined packet; held rows remain represented below.
                    if not row.get('plate'):
                        continue
                    if row['websiteSku'] in candidates:raise ValueError('Overlapping candidates')
                    candidates[row['websiteSku']]=(row,p/'plates')
    rows=[]
    for old in ledger['platePlan']['rows']:
        if old['family'] not in FAMILIES:continue
        sku=old['sku'];p=current[sku];base=before.get(sku);pair=[]
        if base:
            for role,url in [('on',base['image']),('off',base.get('imageCapOff'))]:
                if not url:continue
                a=images.get(url)
                if not a:raise ValueError('Missing before image: '+sku)
                pair.append({'role':role,'sourceUrl':url,'sha256':a['sha256'],'url':media(BATCH/a['file'],a['sha256'])})
        assembled=p.get('applicator','') in POLICY['assembledApplicators'] or sku in POLICY['assembledExactSkus']
        row={k:old.get(k) for k in ['sku','graceSku','family','capacityMl','color','applicator','capColor','itemName','productGroupId','groupSlug']}
        row.update(recordId=p['_id'],familyId=base.get('familyId') if base else None,inCatalog=True,baselineStage=old['stage'],referenceSha256=old.get('sha256'),before=pair,
            views=[],sources=[],technicalHolds=[],notes=[],legacyEvidence=[],status='hold',presentation='Assembled swap' if assembled else 'Cap on / cap off')
        page=pages.get(sku)
        if page:
            # Preserve exact evidence bytes in the durable packet; no SKU inferred from URL.
            evidence_file=BATCH/page['file'];target=DOCS/'evidence'/evidence_file.name;target.parent.mkdir(exist_ok=True)
            if hashfile(evidence_file)!=page['sha256']:raise ValueError('Exact page evidence changed')
            shutil.copy2(evidence_file,target)
            row['legacyEvidence']=[{**{k:page[k] for k in ['url','sha256','description','fetchedAt']},'file':str(target.relative_to(ROOT))}]
            row['technicalHolds'].extend(page['conflicts'])
        else:row['notes'].append('Current legacy page is unverified; the exact catalog identity is retained.')
        if old['stage']=='complete':
            row['status']='preserved';row['views']=pair;row['technicalHolds']=[]
        elif sku in duplicates:
            d=duplicates[sku];row['status']='duplicate';row['duplicateProposal']={'record':d['record'],'canonical':d['candidates'][0] if len(d['candidates'])==1 else None,'status':'pending scope review'}
        elif sku in candidates and candidates[sku][0].get('plate'):
            c,folder=candidates[sku]
            row['familyId']=c['familyId']
            for role,key in [('on','plate'),('off','plateCapOff')]:
                a=c.get(key)
                if not a:continue
                # Preserve the paired source inventory even when presentation is assembled-only.
                source={'kind':'master-psd','role':role,'sourcePath':a['sourceRelPath'],'sourceSha256':a['sourceSha256']}
                row['sources'].append(source)
                row['views'].append({'role':role,'sha256':a['sha256'],'url':media(folder/a['key'],a['sha256']),'width':a['width'],'height':a['height']})
            row['technicalHolds'].extend(c.get('blockReasons', []))
            if not assembled and not c.get('plateCapOff'):row['technicalHolds'].append('Required cap-off pairing remains unresolved.')
            row['status']='hold' if row['technicalHolds'] else 'ready'
            row['notes'].append('Prepared from original master PSDs. New image bytes require this review.')
        else:
            row['technicalHolds'].extend((candidates[sku][0].get('blockReasons',[]) if sku in candidates else xrefs.get(sku,{}).get('blockReasons',[])) or ['Master source integration remains unresolved.'])
            row['notes'].append('Existing image, if shown, is retained as reference; no replacement is approved.')
        hold_messages={
            'match:no-psd':'No verified master source is linked to this exact product yet.',
            'registration_unmatched':'Glass alignment did not pass. A corrected render is required.',
            'SAME_STEM_DIFFERENT_PHOTOGRAPH':'Different source photographs share this name; the correct view needs reconciliation.',
            'closure_axis:3.5px':'The closure is 3.5 pixels off center, above the 2-pixel limit. Alignment correction is required.'}
        row['technicalHolds']=[hold_messages.get(reason,reason) for reason in row['technicalHolds']]
        if sku=='GBElg30SpryShnSl' and row['status']=='hold':row['technicalHolds']=['The candidate in the capped folder shows the cap off. The exact cap-on master still needs locating.']
        if sku=='GBElgFrst15BlkShSht' and row['status']=='hold':row['technicalHolds']=['The available master pair shows a ribbed cap; the exact product reference shows a smooth cap. The matching master source is unresolved.']
        row['binding']=hashlib.sha256(json.dumps({k:row[k] for k in ['sku','recordId','productGroupId','views','sources']},sort_keys=True,separators=(',',':')).encode()).hexdigest()
        rows.append(row)
    # Legacy-only products are visible evidence holds, never silently dropped or auto-created.
    for sku,page in pages.items():
        if sku in current:continue
        rows.append({'sku':sku,'family':page['family'],'itemName':page['description'],'inCatalog':False,'status':'legacy','before':[],'views':[],
            'sources':[],'technicalHolds':['Exact product is on legacy; reconcile or create its catalog identity before indexing.'],
            'legacyEvidence':[{'url':page['url'],'sha256':page['sha256']}],'notes':[],'gallery':page['gallery']})
    rows.sort(key=lambda r:(FAMILIES.index(r['family']),r.get('capacityMl') or 0,r.get('color') or '',r.get('applicator') or '',r.get('capColor') or '',r['sku']))
    counts={s:sum(r['status']==s for r in rows) for s in ['preserved','ready','hold','duplicate','legacy']}
    families=[{'family':f,'total':sum(r['family']==f for r in rows),**{s:sum(r['family']==f and r['status']==s for r in rows) for s in counts}} for f in FAMILIES]
    packet={'schemaVersion':1,'id':ID,'createdAt':datetime.now(timezone.utc).isoformat(),'draft':draft,'status':'pending','publicationAuthorized':False,
        'canvas':{'width':1000,'height':1100},'catalogRows':sum(r.get('inCatalog',False) for r in rows),'counts':counts,'families':families,'rows':rows,
        'ledgerBefore':ledger['platePlan']['counts'],'deployment':catalog['deployment'],'scopeNote':'Current catalog plus exact additional legacy products. Duplicate removals are proposals pending review.'}
    raw=(json.dumps(packet,indent=1)+'\n').encode();(DOCS/'prepared.json').write_bytes(raw);(PUBLIC/'prepared.json').write_bytes(raw)
    template=(ROOT/'scripts/asset-ledger/templates/four-family-review.html').read_text();(PUBLIC/'index.html').write_text(template.replace('PACKET_HASH',hashlib.sha256(raw).hexdigest()));(DOCS/'index.html').write_text(template.replace('PACKET_HASH',hashlib.sha256(raw).hexdigest()))
    (DOCS/'summary.json').write_text(json.dumps({'counts':counts,'families':families,'packetSha256':hashlib.sha256(raw).hexdigest()},indent=2)+'\n')
    print(json.dumps({'counts':counts,'families':families}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--draft',action='store_true');args=ap.parse_args();main(args.draft)
