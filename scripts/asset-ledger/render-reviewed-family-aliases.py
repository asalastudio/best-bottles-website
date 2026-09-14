#!/usr/bin/env python3
"""Render visually reconciled master-source aliases into review-only batches.

Uses the existing reviewed-source validator rather than changing the conservative
filename guard. Exact catalog records, page bytes, source bytes and inspection
sheet are bound together. Neither originals nor indexed plates are modified.
"""
import hashlib,json,sys
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];BATCH=ROOT/'dist/paper-doll/four-family-plates-2026-09-13'
sys.path.insert(0,str(ROOT/'scripts/paperdoll'))
from complete_family_plates import check_source,check_evidence,inside,digest,MASTER
from build_plates import build_registered
ALLOWED={'GBElg30SpryShGl','GBCrcl15SprySlSh','GBDiva46AnSpBlkRng','GBDiva46AnSpIvySlRng','GBDiva46AnSpLvnRng','GBDiva46AnSpRedRng','GBDiva46AnSpTslBlkRng','GBDiva46AnSpTslIvySlRng','GBDiva46AnSpTslLvnRng','GBDiva46AnSpTslRedRng'}

def main():
    plans=[json.loads((BATCH/('source-review/'+name)).read_text()) for name in ['alias-inspection.json','diva-ring-aliases.json']]
    receipts={};groups=defaultdict(list)
    for plan in plans:
        if digest(ROOT/plan['comparison'])!=plan['comparisonSha256']:raise ValueError('Inspection image changed')
    for match,plan in [(r,p) for p in plans for r in p['rows']]:
        sku=match['sku']
        if sku not in ALLOWED:continue
        family=match['family'];folder=BATCH/family.lower();out=folder/'aliases/plates';out.mkdir(parents=True,exist_ok=True)
        rows=json.loads((folder/'input/xref.json').read_text())['products'];row=next(r for r in rows if r['websiteSku']==sku)
        if not row['productGroupId'] or not row['familyId']:raise ValueError('Physical group is unresolved')
        page=match['evidence'];evidence={**page,'file':str(BATCH/page['file']),'returnedSku':page['sku']}
        if page['conflicts'] or page['sku']!=sku:raise ValueError('Catalog/page identity unresolved')
        item={'sku':sku,'graceSku':row['graceSku'],'familyId':row['familyId'],'family':family,'closure':row['applicator'],'warnings':[],'mode':'registered','off':None}
        if match['views'].get('off') and match['views']['on']['sourceSha256']==match['views']['off']['sourceSha256']:raise ValueError('Two distinct views required')
        for role,source in match['views'].items():
            path=inside(MASTER/source['sourcePath'],MASTER)
            if digest(path)!=source['sourceSha256']:raise ValueError('Master bytes changed')
            if role=='on':
                # Explicit assembled-view inspection is required for an alias; a similar basename is insufficient.
                check_source({'websiteSku':sku,'evidence':evidence,'source':{'kind':'master','path':str(path),'sha256':source['sourceSha256'],'view':'assembled',
                    'reviewedBy':'Codex technical source inspection','matchEvidence':{'comparisonSha256':plan['comparisonSha256'],'exactPageSha256':page['sha256']}}},BATCH)
            else:check_evidence({'websiteSku':sku,'evidence':evidence},BATCH)
            item[role]={'library':'master','relPath':source['sourcePath'],'path':path,'sha256':source['sourceSha256'],'stateEvidence':'Exact-page and original-source visual comparison '+plan['comparisonSha256']}
        if not item['off'] and row['applicator'] not in json.loads((ROOT/'src/lib/products/closure-presentation-policy.json').read_text())['assembledApplicators']:raise ValueError('A required alternate view is missing')
        groups[(family,row['familyId'],row['productGroupId'])].append(item)
    for (family,fid,group),items in groups.items():
        folder=BATCH/family.lower();target=folder/'aliases/plates'/fid;target.mkdir(parents=True,exist_ok=True)
        candidates,registration=build_registered(fid,group,items,target,print)
        if len(candidates)!=len(items):raise ValueError('Reviewed aliases were not all accounted for')
        (target/('_registration-'+group+'.json')).write_text(json.dumps(registration,indent=1)+'\n')
        receipts.setdefault(family,[]).extend(candidates)
        (folder/'aliases/source-receipt.json').write_text(json.dumps({'reviewer':'Codex technical source inspection','plateApproval':False,'sourceComparisons':plans},indent=2)+'\n')
    for family,rows in receipts.items():
        (BATCH/family.lower()/'aliases/plates/manifest.json').write_text(json.dumps({'rows':rows,'counts':{'rows':len(rows),'publishable':sum(r['publishable'] for r in rows)},'publicationAuthorized':False},indent=1)+'\n')
        print(family,len(rows),'additional original master candidates')
if __name__=='__main__':main()
