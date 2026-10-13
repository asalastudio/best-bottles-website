# Execution ledger — updated 13 October 2026


**Updated 13 October 2026. In progress; not ready for final acceptance or release.** The directory retains its original 2026-10-12 session date. Evidence spans 12–13 October.

## What was implemented locally

1. Builder images recover after transient optimized/raw loading failures: one bounded delayed retry, connectivity recovery, and manual recovery on full previews. Thumbnail recovery does not introduce nested buttons or select an item.
2. Removed the decorative horizontal line behind PDP bottles. Registration and seating datums remain intact.
3. PDP controls honor the existing assembled-closure policy, label a flat fallback PHOTO, and select a supported view after SKU changes.

The branch is `codex/product-media-completion-2026-10-12`, based on current-main commit `5c019e69002bb943d1cf55fe7e78745125bd1cd5`. The divergent original checkout and prior assets were preserved. No fixes have been merged, deployed, published to Blob, or loaded into production data during this run.

## One issue list

- [Searchable register](index.html)
- [Issue CSV](backlog.csv) and [structured issue data](backlog.json)
- [Every-record acceptance matrix](acceptance-matrix.csv)
- [67 offered Builder register exceptions](builder-register-exceptions.csv)
- [200 historical replacement approval candidates](replacement-approval-queue.csv)
- [Separate development image-gap list](development-image-gaps.csv)
- [Held artwork comparison](pilots/review.html)

The register has **60 records**, including grouped review queues and historical holds. This is not a claim of 60 independent customer defects. Exact SKUs and served configuration IDs are recorded separately per issue. Four distinct technical defects are confirmed from source/tests/delivery: three local UI/loading fixes and one broken hosted group-hero reference. Root causes of the remaining data gaps and reported visual faults still need verification.

## Current evidence, with denominators

| Measure | Finding | Boundary |
| --- | --- | --- |
| Production catalogue | 2,485 records / 2,482 nonblank unique website SKUs | Eligibility still needs final classification |
| Image coverage | 2,283 exact plates; 164 healthy remote-only; 38 source/assignment matching gaps | Does not certify visual identity or quality |
| 38 gaps | 30 named catalogue candidates; 3 identity decisions; 5 reference/retired/test records | Do not call all 38 missing customer images |
| Builder | 2,125 served configurations across 45 locally enumerated bodies | Live API responses matched local replay; independently enumerating deployment-only/cached bodies and rendered UI remains pending |
| Builder drawing exceptions | 67 offered configurations without a renderable register assembly | They may use legacy imagery; not 67 missing products |
| Register unresolved | 316 builds | Includes holds/retired/non-Builder scope; not a customer-defect count |
| Hosted media requests | 11,585 unique URLs checked; 11,584 decoded; 1 HTTP 404 | Plates, thumbs, kits, registered layers and group heroes; Shopify assignment is a separate measure; no visual acceptance |
| Legacy kits | 146 partial kits | Some roles/views may legitimately be unavailable; precedence must be checked |
| Development | 2,541 records; 73 matching gaps | Kept separate from production |

Shared assembled-policy exposure is 965 SKUs (922 served configurations), mirroring the renderer's policy including exact exceptions. Actual applicability requires a kit. This is potential exposure, not 965 witnessed failures. Flat-photo labeling also affects no-kit fallbacks.

Shopify audit: 1,041 assigned, 1,437 missing variant image, 3 unmatched, 4 duplicate-SKU records. These assignment states do not establish missing PDP images. Cart/checkout identity requires browser checks.

The broken group hero belongs to `cylinder-5ml-clear-13-415-rollon`. Its primary identity is `GBCyl5MtlRollBlkSh`. [Proposed data repair](proposed-data-repair.json) contains the exact before/after reference and rollback receipt. It has not been applied; visual identity and the actual fallback path remain gates.

## Artwork pilots: all held

Five image-editing candidates cover Round78 clear/frosted, Boston15 amber/cobalt, and a silver tassel-hardware detail. Prompts, source/output hashes, tool identity, dimensions and comparison evidence are in `pilots/`. The image tool did not expose the model version; no GPT-2.5 claim is made.

The first pass fails the accuracy gate: normalized Boston widths differ approximately 9–11% from the source assembly; other candidates have alpha-edge, tube, mechanism or hardware geometry concerns. These are finish studies, not approved replacement artwork. No generated candidate was installed in the component register or public asset paths. Pilot approval should follow geometry correction, not override known errors.

The original master-library symlink resolves to an unavailable Achive volume. Prior extracts and recorded hashes survive, but original PSD layers cannot currently be re-opened or freshly certified. See `pilots/master-lineage-check.json`.

## Verification completed

- 43 tests passed across six targeted Builder/PDP files, including failure-before/fix-after retry and view-control regressions.
- TypeScript check passed; `git diff --check` passed.
- Reconciliation validation passed: unique record IDs, served/replay identity sets, 30/3/5 gap split, 965 policy exposure, 12 held 13-425 records and four held Vial4 dropper records.
- Independent source review found no remaining actionable defect in the local UI fixes. Three audit-count/provenance findings were corrected; see REVIEW.md.

**Not completed:** local or production browser acceptance; catalogue-wide visual inspection; physical iPhone Safari/network recovery; exact cart-image identity; full independent legacy-catalogue reconciliation; owner pilot approval. Both local and production browser attempts were declined by the permission gate. No alternate access route was used to bypass those denials.

## PR and release sequence

1. Validate these shared fixes locally on desktop/mobile, including transient failure recovery and the exact reported pages. Reconcile against #368's overlapping PDP/Builder changes before release.
2. Correct and approve the three pilot families with mounted exact masters. Use preserved geometry/Blender if image editing cannot retain geometry. Then expand family work, with a contact sheet and every-combination browser matrix.
3. Review existing #341 → #342 → #343 drawing stack in that order. Its historical 26 locally resolved backlog entries and reported expanded 29-build scope require exact branch/asset checks; neither is recertified here.
4. Keep #347 finish-image migration held. #368 is also a draft with overlapping source changes. #340 and #345 are merged, but that is not media release acceptance. Additional open drawing/factual work such as #296 and #354 must be reconciled against exact scope.
5. For each family, prepare CI evidence, approved hashes, publication/reference payload and rollback receipt. Ask for the user's explicit merge/publication/production-write approval only with a concrete reviewed release.
6. After approved release, repeat exact configuration checks against production. Close each issue only with live evidence.

Stages stay separate: built locally → browser verified → visually approved → PR/CI passed → merged → assets published → Convex/Shopify references loaded → deployed → verified live.

## What is needed next

Restore browser permission for local and production testing, and reconnect `/Volumes/Achive` or provide the master PSD library's new path. Then complete source-faithful pilot corrections and rendered QA before requesting artwork approval. No approval to merge, publish or write production data has been assumed. Pricing, shipping, Grace and accounts remain outside this programme.


Evidence root: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`
