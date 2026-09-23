import path from 'node:path';
import {indexedViews, remoteHash} from './plate-contact-sheet.mjs';

const MASTER = '/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const checkedStates = new Set(['plated', 'plated-no-capoff-by-design']);

// Receives the result of readCompletion, which verifies local image/source
// bytes, catalog identity, locked glass standards, and the review binding.
// A rejected older source attempt must not hold a reviewed replacement forever.
export async function applyPreparedPlateReviews(rows, plateIndex, prepared, hashRemote = remoteHash) {
    const audit = {approved: 0, resolvedSourceFindings: 0, resolvedSizeFindings: 0, held: 0};
    for (const candidate of prepared?.rows ?? []) {
        const matches = rows.filter(r => r.productRecord && r.sku === candidate.sku);
        const row = matches[0];
        if (matches.length !== 1 || row.productGroupId !== candidate.productGroupId) continue;
        const plate = row.plate;
        plate.preparedCandidate = {
            state: candidate.eligible ? candidate.status : 'held',
            binding: candidate.binding,
            views: candidate.views.map(({url, sha256, label}) => ({url, sha256, label})),
            holds: candidate.holds,
        };
        const capOn = candidate.views.find(v => v.label === 'Cap on');
        // An unindexed replacement does not invalidate the currently approved plate.
        if (capOn?.sha256 !== plate.sha256) continue;
        if (!candidate.eligible || candidate.status !== 'approved') {
            plate.approval = null;
            plate.complete = false;
            continue;
        }
        try {
            const current = plateIndex.get(row.sku);
            if (!current?.sourcePath || !capOn.source?.sourcePath ||
                path.resolve(MASTER, current.sourcePath) !== path.resolve(MASTER, capOn.source.sourcePath))
                throw Error('The indexed source differs from the approved master source.');
            const views = indexedViews(current);
            if (views.length !== candidate.views.length ||
                new Set(views.map(v => v.label)).size !== views.length)
                throw Error('The indexed views differ from the approved pair.');
            await Promise.all(views.map(async view => {
                const approved = candidate.views.find(v => v.label === view.label);
                if (!approved || await hashRemote(view.sourceUrl) !== approved.sha256)
                    throw Error('An indexed view changed after approval.');
            }));
            // Retain each historical finding and the exact evidence that superseded
            // it. Current measurement/integrity failures are never cleared here.
            const resolved = [];
            if (plate.sourceHold) {
                resolved.push({kind: 'source', finding: plate.sourceHold});
                delete plate.sourceHold;
                audit.resolvedSourceFindings++;
            }
            if (plate.sizeHold && candidate.origin === 'existing-correction' &&
                candidate.standardId && candidate.standardVersion && candidate.standardReferenceSha256) {
                resolved.push({kind: 'size', finding: plate.sizeHold});
                delete plate.sizeHold;
                audit.resolvedSizeFindings++;
            }
            if (resolved.length) plate.resolvedFindings = {
                reviewBinding: candidate.binding, plateSha256: plate.sha256,
                standardId: candidate.standardId, standardVersion: candidate.standardVersion,
                reason: 'Reviewed replacement is indexed; all served views and master-source evidence match.',
                findings: resolved,
            };
            plate.approval = {
                status: 'approved', binding: candidate.binding, notes: candidate.notes || '',
                views: candidate.views.map(({sha256, label}) => ({sha256, label})),
                scope: 'Jordan explicit review; all indexed view bytes and the approved master source verified.',
            };
            plate.checksPassed = checkedStates.has(plate.state) && !plate.hold &&
                !plate.issues?.length && !plate.sizeHold && !plate.sourceHold && plate.masterSourceRecorded;
            plate.complete = !!plate.checksPassed;
            audit.approved++;
        } catch (error) {
            plate.approval = null;
            plate.complete = false;
            plate.completionReviewHold = error.message;
            audit.held++;
        }
    }
    return audit;
}
