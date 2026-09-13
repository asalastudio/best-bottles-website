export const plateStages = {
    complete: {label: 'Approved & indexed', detail: 'Current plate checks and image-byte approval pass.'},
    release: {label: 'Approved · awaiting release', detail: 'The final images are approved. Publication and indexing remain.'},
    review: {label: 'Ready for review', detail: 'Reuse the existing plate. Family visual review is still owed.'},
    reconcile: {label: 'Needs reconciliation', detail: 'Resolve source, sizing, pairing, or technical findings.'},
    missing: {label: 'Needs a plate', detail: 'No indexed plate. Match the master source and prepare a candidate.'},
};

export function plateStage(plate) {
    if (plate.scopeHold || plate.completionReviewHold) return 'reconcile';
    if (plate.complete) return 'complete';
    const prepared=plate.finalPreparation;
    if (prepared?.status==='approved' && prepared.paired && prepared.alignmentPassed && prepared.sourceDecisionRequired===false) return 'release';
    if (plate.completionReviewHold || plate.batchReviewHold) return 'reconcile';
    if (plate.checksPassed) return 'review';
    if (['none','hold'].includes(plate.state) && !plate.imageUrl) return 'missing';
    return 'reconcile';
}

export function plateReasons(row) {
    const p = row.plate, stage = plateStage(p), reasons = [];
    if (stage === 'complete') return ['Approved current image bytes; preserve this plate.'];
    if (stage === 'release') return ['Final image and source approval is recorded. No repeat review is needed for these exact bytes. Publish the named release, verify its hosted files, and register the indexed views.'];
    if (p.completionReviewHold) return [p.completionReviewHold];
    if (p.finalPreparation?.paired && p.finalPreparation.alignmentPassed) return [
        'The final cap-on/cap-off pair is prepared and alignment passes. Open the final Cylinder batch review.',
        p.finalPreparation.sourceDecisionRequired ? 'Accept the documented original legacy source or provide its exact master counterpart.' : 'Register final batch approval and release-specific ship before indexing.',
    ];
    if (!row.productGroupId) reasons.push('Catalog product-group link needs reconciliation.');
    if (p.state === 'plated-legacy-source') reasons.push('Replace the legacy image with its master Photoshop source.');
    if (p.state === 'plated-cap-on-only') reasons.push('Find and prepare the exact cap-off pair.');
    if (p.state === 'plated-wrong-size' || p.sizeHold) reasons.push('Resolve the glass sizing finding.');
    if (p.sourceHold) reasons.push('Reconcile the exact master source mapping.');
    if (p.scopeHold) reasons.push(p.scopeHold);
    if (p.imageUrl && !p.masterSourceRecorded) reasons.push('Confirm the original source in BB-PSD-Files-Master.');
    if (p.hold || p.reason) reasons.push(p.reason || p.hold);
    if (p.completionReviewHold) reasons.push(p.completionReviewHold);
    if (p.batchReviewHold) reasons.push(p.batchReviewHold);
    if (p.issues?.length) reasons.push(...p.issues);
    if (p.state === 'measurement-stale') reasons.push('Refresh measurement of the currently indexed bytes.');
    if (!reasons.length) reasons.push(plateStages[stage].detail);
    return [...new Set(reasons)];
}

// Exactly one work stage per applicable catalog record. Review-only artifacts
// remain outside the denominator, and missing group links remain explicit.
export function buildPlatePlan(ledger) {
    const empty = () => ({total:0,complete:0,release:0,review:0,reconcile:0,missing:0});
    const rows = ledger.rows.filter(r => r.productRecord && r.plate.state !== 'not-applicable' && !r.plate.scopeExclusion).map(r => ({
        sku:r.sku,graceSku:r.graceSku,family:r.family,capacityMl:r.capacityMl,color:r.color,
        itemName:r.itemName || r.sku,applicator:r.applicator,capColor:r.capColor,
        productGroupId:r.productGroupId,groupSlug:r.groupSlug,imageUrl:r.plate.imageUrl,
        stage:plateStage(r.plate),reasons:plateReasons(r),sha256:r.plate.sha256,
        capOff:r.plate.capOff,plateState:r.plate.state,sourcePath:r.plate.sourcePath,
        visualApprovalRecorded:r.plate.approval?.status === 'approved' || r.plate.appearanceApproval?.status === 'approved',
        finalPreparation:r.plate.finalPreparation ?? null,
    }));
    const counts = empty(), familyMap = new Map();
    for (const row of rows) {
        counts.total++;counts[row.stage]++;
        if (!familyMap.has(row.family)) familyMap.set(row.family,{family:row.family,...empty(),sizes:new Set(),unlinked:0});
        const f=familyMap.get(row.family);f.total++;f[row.stage]++;
        if(row.capacityMl != null) f.sizes.add(row.capacityMl);
        if(!row.productGroupId) f.unlinked++;
    }
    const families = [...familyMap.values()].map(f => ({...f,sizes:[...f.sizes].sort((a,b)=>a-b)}))
        .sort((a,b)=>b.total-a.total || a.family.localeCompare(b.family));
    return {
        version:1,focus:'plates',paused:['kits','heroes'],stages:plateStages,counts,families,rows,
        scope:{
            reconciled:ledger.scope?.catalogReconciled === true,
            reviewOnly:ledger.rows.filter(r=>!r.productRecord).length,
            notApplicable:ledger.rows.filter(r=>r.productRecord&&r.plate.state==='not-applicable').length,
            missingSku:ledger.scope?.missingSkuRecords ?? [],
            unlinked:rows.filter(r=>!r.productGroupId).length,
            excludedDuplicates:ledger.rows.filter(r=>r.productRecord&&r.plate.scopeExclusion).map(r=>({sku:r.sku,family:r.family,itemName:r.itemName,...r.plate.scopeExclusion})),
        },
    };
}
