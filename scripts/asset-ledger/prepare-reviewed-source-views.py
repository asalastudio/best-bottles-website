#!/usr/bin/env python3
"""Prepare the visually checked Diva or Circle source pairs for the combined review.

The neutral source folders do not encode cap state. Exact legacy-page evidence,
original source fingerprints and the saved visual comparison determine it here.
This is a technical source-view receipt, never a customer plate approval.
"""
import argparse, copy, hashlib, json, shutil, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BATCH=ROOT/'dist/paper-doll/four-family-plates-2026-09-13'
FOLDER=BATCH/'diva'
SKUS=['GBDivaFrst46SpryMtGl','GBDivaFrst46SpryShnGl','GBDivaFrst46SpryShnBlk','GBDivaFrst46SpryMtSl','GBDivaFrst46SpryShnSl','GBDivaFrst46SpryCu','LBDivaFrst46LtnMtGl','LBDivaFrst46LtnMtSl','LBDivaFrst46LtnCu','LBDivaFrst46LtnShnGl','LBDivaFrst46LtnShnBlk','LBDivaFrst46LtnShnSl','LBDivaFrst46LtnClOvrCap']
sys.path.insert(0,str(ROOT/'scripts/paperdoll'))
from build_plates import source_of,validate_front_source
from family_batch import MASTER

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main(family):
    folder=BATCH/family.lower()
    skus=SKUS if family=='Diva' else ['LBCrclFrst50LtnClOvrCap','LBCrclFrst50LtnCu','LBCrclFrst50LtnMtGl','LBCrclFrst50LtnMtSl','LBCrclFrst50LtnShnBlk','LBCrclFrst50LtnShnGl','LBCrclFrst50LtnShnSl','GBCrclFrst50SpryCu','GBCrclFrst50SpryMtGl','GBCrclFrst50SpryMtSl','GBCrclFrst50SpryShnBlk','GBCrclFrst50SpryShnGl','GBCrclFrst50SpryShnSl']
    target=folder/'view-recovery/input';target.mkdir(parents=True,exist_ok=True)
    for p in (folder/'input').glob('*.json'):shutil.copy2(p,target/p.name)
    xref=json.loads((target/'xref.json').read_text());selection=json.loads((target/'selection.json').read_text())
    scores={r['sku']:r for r in json.loads((folder/'source-similarity.json').read_text())['rows']}
    visual=BATCH/('source-review/'+family.lower()+'13.jpg')
    receipt={'reviewer':'Codex technical source inspection','visualComparison':str(visual.relative_to(ROOT)),'visualSha256':sha(visual),'approvedForPublication':False,'rows':[]}
    seen=set()
    for row in xref['products']:
        row['publishable']=False
        if row['websiteSku'] not in skus:continue
        sku=row['websiteSku'];comparison=scores[sku];evidence=comparison['evidence']
        if evidence['conflicts'] or evidence['sku']!=sku or sha(BATCH/evidence['file'])!=evidence['sha256']:raise ValueError('Exact-page evidence changed')
        if '<h1>'+sku+'</h1>' not in (BATCH/evidence['file']).read_text():raise ValueError('Page does not prove exact SKU')
        entry=copy.deepcopy(selection['stems'][row['stemKey']]);entry['states']={};views=[]
        for role,segment in [('on','/capped/'),('off','/enlarged_pics/')]:
            scored=next(c for c in comparison['comparisons'] if segment in c['reference']['url'])['scores'][0]
            source=scored['source'];path=(MASTER/source['relPath']).resolve(strict=True)
            if source['stem']!=sku or scored['mae']>(0.025 if family=='Diva' else 0.04) or not path.is_relative_to(MASTER.resolve()) or sha(path)!=source['sha256']:raise ValueError('Source comparison changed')
            entry['states'][role]={'chosen':source['sha256'],'chosenPath':source['relPath'],'chosenLibrary':'master','chosenCanvas':[source['canvas']['w'],source['canvas']['h']],
                'stateEvidence':'Codex inspected exact original pair against exact legacy page; '+str(visual.relative_to(BATCH))+' '+receipt['visualSha256'],'alternates':[],'samePhotograph':True,'locations':['master:'+source['relPath']]}
            views.append({'role':role,'sourcePath':source['relPath'],'sourceSha256':source['sha256'],'referenceMae':scored['mae']})
        if entry['states']['on']['chosen']==entry['states']['off']['chosen']:raise ValueError('Identical bytes cannot prove two views')
        validate_front_source(source_of(entry,'on'),sku)
        row['stemKey']='reviewed-source-view:'+sku;selection['stems'][row['stemKey']]=entry;row['publishable']=True;row['blockReasons']=[];seen.add(sku)
        receipt['rows'].append({'sku':sku,'evidence':evidence,'views':views})
    if seen!=set(skus):raise ValueError('Missing expected source-view row')
    (target/'selection.json').write_text(json.dumps(selection,indent=1)+'\n');(target/'xref.json').write_text(json.dumps(xref,indent=1)+'\n')
    (target.parent/'source-view-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('Prepared',len(seen),'exact original pairs for rendering; no plate approval recorded.')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--family',choices=['Diva','Circle'],required=True);main(parser.parse_args().family)
