import {lockApprovedSkus} from './plate-release-locks.mjs';

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

export function plateReasons(row, legacyAsset = null, legacySourceApproved = null, legacyRegenerate = null) {
    const p = row.plate, stage = plateStage(p), reasons = [];
    if (stage === 'complete') return ['Approved current image bytes; preserve this plate.'];
    if (stage === 'release') return ['Final image and source approval is recorded. No repeat review is needed for these exact bytes. Publish the named release, verify its hosted files, and register the indexed views.'];
    if (p.byteDecision?.status === 'rejected') reasons.push(p.byteDecision.reason);
    if (p.byteDecision?.scope === 'paper-doll-appearance-review') reasons.push(p.byteDecision.reason);
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
    // A source hold is a task, not a dead end, whenever the legacy site still
    // serves this exact product's photograph. The master PSD stays preferred:
    // legacy files are small GIFs and are a fallback, never an upgrade.
    if (legacyRegenerate) {
        return ['The legacy photograph sits on a green matte and cannot be matted onto the plate canvas. Jordan queued this bottle for regeneration with Higgsfield GPT Image 2.5.'];
    }
    if (legacySourceApproved) {
        return [`Source settled: Jordan approved this product's legacy photograph (${legacySourceApproved.view}, ${legacySourceApproved.pixels}) as its source, cap-on only, with no cap-off owed. Prepare the plate from that source; the prepared bytes are new and come back for their own review before indexing.`];
    }
    if (legacyAsset && (stage === 'missing' || stage === 'reconcile')) {
        reasons.push(`Fallback source available on the legacy site (${legacyAsset.roles.join(', ') || 'image'}). Prefer the master PSD; use the legacy image only where no master view exists, and record it as a legacy source.`);
    }
    return [...new Set(reasons)];
}

// Exactly one work stage per applicable catalog record. Review-only artifacts
// remain outside the denominator, and missing group links remain explicit.
export function buildPlatePlan(ledger) {
    const empty = () => ({total:0,complete:0,release:0,review:0,reconcile:0,missing:0});
    const isRetiredScopeHold = (r) => r.stockStatus === 'Discontinued' &&
        typeof r.importSource === 'string' && r.importSource.includes(':retired') && !r.productGroupId &&
        (!r.plate?.scopeExclusion || r.plate.scopeExclusion.kind === 'retired-scope-hold');
    const preparedApproved = new Set(ledger.preparedPlateReview?.approvedSkus ?? []);
    // Rows whose exact bytes are already approved under a named family release lock.
    const lockApproved = lockApprovedSkus(ledger.plateReleaseLocks);
    // Which outstanding rows the live legacy site can still supply an image for.
    // Rows whose source Jordan settled on the legacy evidence page.
    const legacySourceApproved = new Map();
    for (const r of ledger.legacyHoldDecision?.rows ?? []) legacySourceApproved.set(r.sku, r);
    const legacyRegenerate = new Map();
    for (const r of ledger.legacyHoldDecision?.regenerate ?? []) legacyRegenerate.set(r.sku, r);
    const legacyAsset = new Map();
    for (const e of ledger.legacyAssetReconciliation?.rows ?? []) {
        if (!e.assetAvailable) continue;
        legacyAsset.set(e.sku, { roles: e.liveImageRoles ?? [], url: e.legacy?.url ?? null,
            legacySku: e.legacy?.sku ?? null, matchedBy: e.legacy?.matchedBy ?? 'image path only' });
    }
    const awaitingRelease = (r) => !r.plate.complete && (preparedApproved.has(r.sku) || lockApproved.has(r.sku));
    const rows = ledger.rows.filter(r => r.productRecord && r.plate.state !== 'not-applicable' && !r.plate.scopeExclusion).map(r => ({
        sku:r.sku,graceSku:r.graceSku,family:r.family,capacityMl:r.capacityMl,color:r.color,
        itemName:r.itemName || r.sku,applicator:r.applicator,capColor:r.capColor,
        productGroupId:r.productGroupId,groupSlug:r.groupSlug,imageUrl:r.plate.imageUrl,
        stage:awaitingRelease(r)?'release':plateStage(r.plate),
        legacySourceApproved:legacySourceApproved.get(r.sku) ?? null,
        regenerateQueue:legacyRegenerate.get(r.sku)?.queue ?? null,
        reasons:awaitingRelease(r)
            ? [`Exact image bytes are approved and locked${lockApproved.has(r.sku)?` under "${lockApproved.get(r.sku)}"`:' on the four-family review'}. Do not review these bytes again. Publish the named release, verify its hosted views, and register the indexed plates.`]
            : plateReasons(r, legacyAsset.get(r.sku), legacySourceApproved.get(r.sku), legacyRegenerate.get(r.sku)),sha256:r.plate.sha256,
        capOff:r.plate.capOff,plateState:r.plate.state,sourcePath:r.plate.sourcePath,
        visualApprovalRecorded:r.plate.approval?.status === 'approved' || r.plate.appearanceApproval?.status === 'approved',
        preparedApprovalRecorded:preparedApproved.has(r.sku),
        releaseLock:lockApproved.get(r.sku) ?? null,
        legacyAsset:legacyAsset.get(r.sku) ?? null,
        finalPreparation:r.plate.finalPreparation ?? null,
        byteDecision:r.plate.byteDecision ?? null,
        acquisitionCandidate:r.plate.acquisitionCandidate ?? null,
    }));
    const counts = empty(), familyMap = new Map();
    for (const row of rows) {
        counts.total++;counts[row.stage]++;
        if (!familyMap.has(row.family)) familyMap.set(row.family,{family:row.family,...empty(),retired:0,sizes:new Set(),unlinked:0});
        const f=familyMap.get(row.family);f.total++;f[row.stage]++;
        if(row.capacityMl != null) f.sizes.add(row.capacityMl);
        if(!row.productGroupId) f.unlinked++;
    }
    const retiredRows = ledger.rows.filter(r=>r.productRecord&&isRetiredScopeHold(r));
    for (const r of retiredRows) {
        const family = familyMap.get(r.family);
        if (family) family.retired++;
    }
    const families = [...familyMap.values()].map(f => ({...f,sizes:[...f.sizes].sort((a,b)=>a-b)}))
        .sort((a,b)=>b.total-a.total || a.family.localeCompare(b.family));
    return {
        version:1,focus:'plates',paused:['kits','heroes'],stages:plateStages,counts,families,rows,
        preparedReview:ledger.preparedPlateReview ?? null,
        releaseLocks:(ledger.plateReleaseLocks ?? []).map(l=>l.skipped
            ?{release:l.release,path:l.path,skipped:l.skipped}
            :{release:l.release,path:l.path,rows:l.rows,held:l.held,approvedAt:l.approvedAt,
              publicationAuthorized:l.publicationAuthorized,indexingAuthorized:l.indexingAuthorized}),
        scope:{
            reconciled:ledger.scope?.catalogReconciled === true,
            reviewOnly:ledger.rows.filter(r=>!r.productRecord).length,
            notApplicable:ledger.rows.filter(r=>r.productRecord&&r.plate.state==='not-applicable').length,
            missingSku:ledger.scope?.missingSkuRecords ?? [],
            unlinked:rows.filter(r=>!r.productGroupId).length,
            excludedDuplicates:ledger.rows.filter(r=>r.productRecord&&r.plate.scopeExclusion&&!isRetiredScopeHold(r)).map(r=>({sku:r.sku,family:r.family,itemName:r.itemName,...r.plate.scopeExclusion})),
            retiredScopeHolds:retiredRows.map(r=>({sku:r.sku,family:r.family,itemName:r.itemName,graceSku:r.graceSku,status:r.plate.scopeExclusion.status,importSource:r.plate.scopeExclusion.importSource,reason:r.plate.scopeExclusion.reason})),
            acquisitionCandidates:ledger.scope?.acquisitionCandidates ?? 0,
            acquisitionRows:ledger.scope?.acquisitionRows ?? 0,
            technicalRows:ledger.scope?.technicalRows ?? 0,
            technicalReviewRows:ledger.scope?.technicalReviewRows ?? 0,
            technicalReconcileRows:ledger.scope?.technicalReconcileRows ?? 0,
        },
    };
}
