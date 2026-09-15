// Exact release evidence. A ship instruction, a receipt, or a family-level
// approval alone never makes another image complete.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {remoteHash} from './plate-contact-sheet.mjs';

const DIR='docs/reviews/cylinder-final38-2026-09-13';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function readCylinderFinalRelease(root){
    const read=async file=>{const bytes=await readFile(path.join(root,file));return {sha256:sha(bytes),data:JSON.parse(bytes)};};
    let receipt;
    try{receipt=await read(DIR+'/published-verification.json');}catch(e){if(e.code==='ENOENT')return null;throw e;}
    const lock=await read(DIR+'/approved-lock.json'),authorization=await read(DIR+'/ship-authorization.json');
    let manifest;
    try{manifest=await read(lock.data.manifestFile);}catch(e){
        if(e.code!=='ENOENT')throw e;
        // The original locked outputs are preserved in Git; a fresh checkout
        // need not restore ignored build output to validate this release.
        const archive=await read('docs/releases/boston-cylinder-2026-09-13/preservation.json');
        const entry=archive.data.files.find(f=>f.restorePath===lock.data.manifestFile);
        assert.equal(entry?.sha256,lock.data.manifestSha256);
        manifest=await read(entry.archivePath);
    }
    const approval=await read(lock.data.approvalFile),packet=await read(DIR+'/prepared-v2.json');
    assert.equal(authorization.data.publicationAuthorized,true);
    assert.equal(authorization.data.approvedLockSha256,lock.sha256);
    assert.equal(authorization.data.manifestSha256,manifest.sha256);
    assert.equal(authorization.data.approvalFileSha256,approval.sha256);
    assert.equal(authorization.data.reviewPacketSha256,packet.sha256);
    assert.equal(lock.data.manifestSha256,manifest.sha256);
    assert.equal(lock.data.approvalFileSha256,approval.sha256);
    assert.equal(lock.data.reviewPacketSha256,packet.sha256);
    assert.equal(receipt.data.authorizationSha256,authorization.sha256);
    assert.equal(receipt.data.manifestSha256,manifest.sha256);
    assert.equal(receipt.data.phase,'published');
    assert.equal(receipt.data.deployment,authorization.data.deployment);
    assert.equal(receipt.data.rows,38);assert.equal(receipt.data.uniqueViewAssets,76);
    assert.equal(receipt.data.assets.length,76);assert.deepEqual(receipt.data.conflicts,[]);
    assert.equal(new Set(manifest.data.rows.map(r=>r.websiteSku)).size,38);
    assert.equal(manifest.data.rows.length,38);assert.equal(lock.data.rows.length,38);
    assert.deepEqual(authorization.data.skus,manifest.data.rows.map(r=>r.websiteSku).sort());
    const decision=approval.data.history.find(d=>d.id===lock.data.approvalId);
    assert.equal(decision?.token,packet.sha256);assert.equal(decision.visualApproved,true);assert.equal(decision.legacySourcesAccepted,true);
    for(const row of manifest.data.rows){
        const saved=decision.entries.find(d=>d.sku===row.websiteSku),locked=lock.data.rows.find(d=>d.sku===row.websiteSku);
        assert.deepEqual(saved,locked);assert.equal(saved.status,'approved');
        assert.equal(saved.productGroupId,row.productGroupId);assert.equal(saved.binding,row.reviewBinding);
        for(const [role,key,field] of [['on','plate','image'],['off','plateCapOff','imageCapOff']]){
            assert.equal(saved.views.find(v=>v.role===role)?.sha256,row[key].sha256);
            const assets=receipt.data.assets.filter(a=>a.sku===row.websiteSku&&a.view===field);
            assert.equal(assets.length,1);assert.equal(assets[0].sha256,row[key].sha256);
            assert.equal(new URL(assets[0].url).pathname,'/'+row[key].storeKey);
        }
    }
    return {lock:lock.data,authorization:authorization.data,receipt:receipt.data,manifest:manifest.data};
}

export async function applyCylinderFinalRelease(rows,plateIndex,sheet,release,hashRemote=remoteHash){
    const audit={approved:0,held:0,resolvedSizeFindings:0,acceptedLegacySources:0};
    if(!release)return audit;
    assert.equal(sheet.status,'approved');assert.equal(sheet.token,release.lock.reviewPacketSha256);
    const hashes=new Map();
    const once=url=>{if(!hashes.has(url))hashes.set(url,hashRemote(url));return hashes.get(url);};
    for(const staged of release.manifest.rows){
        const matches=rows.filter(r=>r.productRecord&&r.sku===staged.websiteSku),row=matches[0];
        if(!row)continue;
        try{
            const card=sheet.rows.find(r=>r.sku===row.sku),current=plateIndex.get(row.sku),plate=row.plate;
            assert.equal(matches.length,1);assert.equal(row.family,'Cylinder');
            assert.equal(row.productGroupId,staged.productGroupId);assert.equal(row.graceSku,staged.graceSku);
            assert.equal(card?.binding,staged.reviewBinding);assert.equal(card.pairCheck.passed,true);
            assert.equal(plate.sha256,staged.plate.sha256);assert.equal(plate.imageUrl,current?.image);
            assert.ok(['plated','plated-legacy-source','plated-wrong-size'].includes(plate.state),'Current measurement is missing or failed');
            assert.ok(!(['changes_requested','rejected'].includes(plate.review?.status)&&!(Date.parse(plate.review.updatedAt)<Date.parse(release.lock.approvedAt))),'A newer review requests changes');
            assert.ok(!plate.issues?.length&&!plate.hold&&!plate.scopeHold&&!plate.sourceHold,'A current technical or identity hold remains');
            // Only the pre-existing sizing finding reviewed on this exact final
            // packet is superseded; future findings remain blocking.
            assert.ok(!plate.sizeHold||plate.sizeHold==='Earlier sizing finding remains open; regrouping is not approval');
            assert.equal(current?.familyId,staged.familyId);assert.equal(current.sourcePath,staged.plate.sourceRelPath);assert.deepEqual(current.views,[]);
            for(const [field,key] of [['image','plate'],['imageCapOff','plateCapOff'],['thumb','thumb'],['thumbCapOff','thumbCapOff']]){
                const verified=release.receipt.assets.find(a=>a.sku===row.sku&&a.view===(field.includes('CapOff')?'imageCapOff':'image'));
                assert.equal(current[field],verified.url);assert.equal(await once(current[field]),staged[key].sha256,'Served view changed');
            }
            const accepted=release.lock.rows.find(d=>d.sku===row.sku).sourceBasis==='accepted-exact-original-legacy-raster';
            const findings=[];
            if(plate.sizeHold){findings.push({kind:'size',finding:plate.sizeHold});audit.resolvedSizeFindings++;delete plate.sizeHold;}
            if(plate.state!=='plated')findings.push({kind:'historical-diagnostic',finding:plate.state});
            plate.resolvedFindings={reviewBinding:card.binding,plateSha256:plate.sha256,findings,reason:'Jordan approved this exact final paired render and its source basis; current hosted views match every approved byte.'};
            plate.state=accepted?'plated-approved-legacy-source':'plated';
            plate.acceptedSourceRecorded=accepted;
            plate.sourceAcceptance=accepted?release.lock.rows.find(d=>d.sku===row.sku).sourceDecision:null;
            plate.release={name:release.lock.release,manifestSha256:release.lock.manifestSha256,verifiedAt:release.receipt.verifiedAt,deployment:release.receipt.deployment};
            plate.approval={status:'approved',sha256:plate.sha256,binding:card.binding,scope:'Jordan exact final Cylinder paired-image approval',updatedAt:release.lock.approvedAt,views:card.views.map(({sha256,role})=>({sha256,role}))};
            plate.checksPassed=true;plate.complete=true;
            delete plate.batchReviewHold;delete plate.completionReviewHold;
            audit.approved++;if(accepted)audit.acceptedLegacySources++;
        }catch(e){row.plate.approval=null;row.plate.complete=false;row.plate.checksPassed=false;row.plate.completionReviewHold='Released Cylinder evidence failed: '+e.message;audit.held++;}
    }
    return audit;
}
