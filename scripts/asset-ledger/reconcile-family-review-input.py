#!/usr/bin/env python3
"""Recover review candidates from exact master paths and saved page comparisons.

Never grants visual approval. Repairs only dedupe/path-selection holds; unknown
identity and catalog conflicts remain held. Originals and existing renders stay intact.
"""
import argparse, copy, hashlib, json, shutil, sys
from pathlib import Path

def main(batch,family):
    source=batch/family.lower();out=source/'recovery';target=out/'input';target.mkdir(parents=True,exist_ok=True)
    for p in (source/'input').glob('*.json'):shutil.copy2(p,target/p.name)
    xref=json.loads((target/'xref.json').read_text());selection=json.loads((target/'selection.json').read_text())
    inventory=json.loads((target/'inventory.json').read_text())['files']
    scores={r['sku']:r for r in json.loads((source/'source-similarity.json').read_text())['rows']};changes=[]
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'paperdoll'))
    from build_plates import validate_front_source, source_of
    from family_batch import MASTER as MASTER_ROOT
    def state(file,evidence):
        return {'chosen':file['sha256'],'chosenPath':file['relPath'],'chosenLibrary':'master','chosenCanvas':[file['canvas']['w'],file['canvas']['h']],
                'stateEvidence':evidence,'alternates':[],'locations':['master:'+file['relPath']],'samePhotograph':True}
    for row in xref['products']:
        reasons=row['blockReasons'];row['publishable']=False
        if not reasons or not all(r=='SAME_STEM_DIFFERENT_PHOTOGRAPH' or r.startswith('source_preflight:front source basename') for r in reasons):continue
        comparison=scores.get(row['websiteSku'])
        if not comparison or comparison['evidence'].get('conflicts'):continue
        cap=next((c for c in comparison['comparisons'] if '/capped/' in c['reference']['url']),None)
        if not cap:continue
        on=None
        for score in cap['scores']:
            exact=next((f for f in inventory if f['stem']==row['websiteSku'] and f['sha256']==score['source']['sha256'] and f['capState']=='on'),None)
            if exact and score['mae']<=0.025:
                on={**score,'source':exact};break
        if not on:continue
        front=on['source'];entry=copy.deepcopy(selection['stems'][row['stemKey']]);entry['states']={'on':state(front,'exact-source-path; exact-page capped-reference comparison; pending visual review')}
        enlarged=next((c for c in comparison['comparisons'] if '/enlarged_pics/' in c['reference']['url']),None);off=None
        if enlarged and enlarged['scores']:
            best=enlarged['scores'][0];on_score=next((s['mae'] for s in enlarged['scores'] if s['source']['sha256']==front['sha256']),1)
            if best['mae']<=0.025 and best['source']['sha256']!=front['sha256'] and on_score-best['mae']>=0.015:
                off=best;entry['states']['off']=state(best['source'],'exact-page alternate-view match; pending paired visual review')
        try:
            validate_front_source(source_of(entry,'on'),row['websiteSku'])
        except (ValueError, RuntimeError) as error:
            row['blockReasons'] = reasons + ['exact_source_crosswalk_required:' + str(error)]
            continue
        selection['stems'][row['stemKey']]=entry
        for s in entry['states'].values():
            path=(MASTER_ROOT/s['chosenPath']).resolve(strict=True)
            if not path.is_relative_to(MASTER_ROOT.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest()!=s['chosen']:raise ValueError('Master source changed')
        row['publishable']=True;row['blockReasons']=[]
        row['sourceReconciliation']={'status':'candidate-awaiting-visual-review','evidence':comparison['evidence'],'previousReasons':reasons,
            'onSha256':front['sha256'],'onReferenceError':on['mae'],'offSha256':off['source']['sha256'] if off else None,'offReferenceError':off['mae'] if off else None}
        changes.append({'sku':row['websiteSku'],**row['sourceReconciliation']})
    (target/'selection.json').write_text(json.dumps(selection,indent=1));(target/'xref.json').write_text(json.dumps(xref,indent=1))
    (out/'source-reconciliation.json').write_text(json.dumps({'family':family,'published':False,'approved':False,'rows':changes},indent=2)+'\n')
    print(json.dumps({'family':family,'additionalCandidates':len(changes),'paired':sum(bool(r['offSha256']) for r in changes)}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--batch',type=Path,required=True);ap.add_argument('--family',required=True);a=ap.parse_args();main(a.batch,a.family)
