## Approval lock recorded — September 13

Jordan approved all 38 final pairs in the local batch form, including the 27
documented legacy source bases. The exact decision was revalidated, the 76 staged
views were hash-checked, and approved-lock.json freezes the decision and manifest.
Earlier statements below describe preparation history. Final visual/source
approval is now complete. Publication and indexing have not happened for this
batch; the 38 must not yet count as complete live plates.

The locked release outputs are also archived in
../../releases/boston-cylinder-2026-09-13/ for restoration from a fresh checkout.
Do not restage this locked manifest. A separate release-specific ship is required.

# Cylinder — final 38 prepared pairs

All 38 remaining catalog configurations have a prepared cap-on / cap-off pair.
This is a local review batch. It has not been approved or published.

- Review: http://localhost:3040/reviews/cylinder-final38-2026-09-13/index.html
- Immutable packet: `prepared-v2.json`, SHA-256 `b26271bbda3fe698e4134e459b3ac6ede866843157f17de13e0f3a35ba3cc89b`.
- Workbench before/after: `workbench-comparison.html`, equal 1440 × 1000 viewports.
- Source and image approvals already saved for prior batches remain unchanged.
- Kits and heroes remain paused. No `.claude/launch.json` changes were made or committed.

## Prepared work

24 plain short-cap rows retain their exact approved legacy front bytes. Their
cap-off images use the original bare-glass layer/group from four master PSDs:
clear/cobalt 5 mL and clear/frosted tall 9 mL. There is no roller in these products.
Glass-only cap-off views show the photographed opening; no component is invented.
`bare-glass-inspection.json`, `legacy-products.json` and `legacy-media.json` preserve
the explicit source crosswalk and exact live product-page evidence.

Six sprayer pairs use the original master views Jordan approved in the prior
source audit. The 30 mL source measurement was corrected to measure the entire
assembly instead of its disconnected metal cap. Both 30 mL pairs have zero mean
body difference; the smaller sprayers remain below 2.23/255.

Five roller pairs use the previously approved original source sets. Four reuse
their already-approved final bytes. The plastic black-dot cap-off was corrected:
its prior 29.247/255 body difference is now 1.6834/255. Historical size findings
remain recorded; this is not a new shared glass-height lock.

Three plastic flip-top pairs retain their approved fronts and add real cap-off
photos from their exact legacy product pages. The original rasters are 360 × 480;
resizing does not create additional detail. Their metadata is honestly recorded
as legacy raster provenance, with no fabricated master path or PSD hash.

## Verification and counts

All 38 paired body checks pass (76 final views); the worst mean error is
3.1762/255 against the existing 12/255 limit. Seven diagnostic contact sheets were
visually inspected. There are 20 distinct new image files after excluding current
and previously approved bytes. 33 cap-on files are unchanged.

Desktop 1440 px and mobile 390 px review checks each returned HTTP 200, loaded all
82 comparison images, showed no overflow or page errors, and filtered the three
plastic rows correctly. The approval button stays disabled until both review
acknowledgments are selected. Invalid submissions returned 409. No valid approval
was submitted during automated testing. TypeScript and 18 focused tests passed.

Before preparation: Cylinder 398/436 complete, 38 reconcile, zero review/missing.
After preparation: Cylinder 398/436 complete, 38 reconcile, zero review/missing;
38 prepared pairs and zero alignment failures are now recorded separately.
Global counts remain 686/2,305 complete, 431 review, 677 reconcile, 511 missing.
Every recount used measurement first, then `npm run ledger:build`.

## The remaining human decision

The current ledger definition requires master provenance. 27 retained fronts
are verified original legacy photographs; their exact master finish counterparts
remain unmatched. The batch approval explicitly asks Jordan to accept those
original sources, including the three original-resolution plastic cap-off images.
It does not falsely convert these into master renders or clear existing holds
without a decision. The 5 mL nominal naming exception is preserved. The natural
16 oz plastic wording and the frosted copper item's stale description are noted
in the evidence; catalog copy was not changed by image preparation.

The local button writes `data/asset-ledger/cylinder-final38-decisions.json`, with
an exact packet token, per-SKU image hashes and source acceptance. The endpoint
rechecks original sources, images, current catalog identity, and served reference
bytes. The browser compares its displayed packet token with the server token.
Rerendered bytes therefore cannot inherit an older card's approval.

## Reproduce and release

1. `python3 scripts/asset-ledger/recover-cylinder-final38-legacy.py` retrieves only
   image URLs captured on the exact saved product pages. Review changed upstream
   evidence as a new revision; do not overwrite accepted review packets.
2. `python3 scripts/asset-ledger/prepare-cylinder-final38.py --revision 2` verifies
   sources and reproduces the same immutable candidate bindings.
3. `python3 scripts/asset-ledger/build-cylinder-final38-review.py` creates the
   single family sheet. Preserve the reviewed HTML when accepting a new revision.
4. `node scripts/asset-ledger/stage-cylinder-final38.mjs` stages all 76 final views
   and performs a read-only preflight for the 38 exact products in ten existing
   plate families. `release-preflight.json` captures product IDs and full original
   family/index records for rollback. Zero ambiguous SKUs were found.

Staged manifest: `dist/paper-doll/cylinder-final38-2026-09-13/manifest.json`.
While approval is pending its 38 rows have `publishable: false`. After approval,
restage to bind the approved status. Jordan's release-specific ship remains
required. Before applying the release, bind that instruction to the exact
manifest, validate accepted legacy provenance in ledger completion, preserve
family metadata, and verify all 76 hosted view hashes and both exact SKU forms.
The approved-source exceptions must be projected only for the exact approved and
indexed views, never by changing the global legacy-source rule. Refresh the
family contact sheet and register the existing batch decision against those
indexed hashes. Then measure and rebuild the ledger to verify 436/436.

The source-acceptance and publication steps are outstanding. Do not report the
family complete from the existence of this review packet or staged manifest.
