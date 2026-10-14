# Dip-tube audit and local source pilot — 13 October 2026

**In progress. The catalogue has not passed dip-tube acceptance. Nothing in this batch is published.**

## Latest continuation

Fresh backend metadata and explicit runtime-mode counts are saved in [dip-tube-continuation-2026-10-13/STATUS.md](/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/dip-tube-continuation-2026-10-13/STATUS.md). This is the current tube checkpoint. The whole-media inventory has 11,585 historical URLs; the refreshed tube subset has 443 URLs / 272 hashes. No browser or visual acceptance is inferred.

The exporter now validates expanded-shaft continuity before any asset writes and preserves previous PNGs. Four exporter regression tests and four existing source-tube tests pass. No batch re-export was run.

## Earlier saved evidence

- 1,260 production and 1,291 development candidate SKUs matched sprayer, pump or dropper descriptions. These include held records and standalone components; they are not customer-visible defect counts.
- All 442 distinct referenced tube/pipette URLs decoded (271 distinct image hashes). Delivery success did not establish image correctness.
- Inspected contact sheets for 126 seated hero cuts, 127 expanded hero cuts, and 59 other distinct tube/pipette assets. No catalogue-wide visual acceptance is claimed.
- Continuity screening flags 55 hero-layer entries / 46 image hashes: 53 seated and two expanded. Supported-view references span 437 production and 424 development SKUs. These are exposure candidates; glass refraction and assembly masking still require exact source comparisons.
- Confirmed expanded alpha gaps: **Empire 50 ml lotion** (57 pixels; seven production SKUs) and **Square 15 ml spray** (18 pixels; seven SKUs in both environments). Empire's development body-specific layers differ from production, so a local-only check would miss its production gap.
- Cylinder 25 ml bulb cuts contain a broad glass fragment; additional measured and legacy layers contain glass-wall or collar remnants. These require assembly/source review before deciding their visible impact. Combined hardware/tube layers are not rejected solely because their slot is named diptube.
- 132 production and 173 development candidates have no separate tube layer. Some use flat photos or complete assemblies. They remain a distinct image-review queue.

## Implemented locally: Square 15 ml spray pilot

Seven currently returned exact catalogue finishes use the intact **Layer 13** from `7. GBSqr15SpryGlMatt.psd` in both seated and expanded views. The extracted 62 × 454 source PNG is unchanged, including alpha. Registration uses one uniform scale from the source body's rim to foot. The approved register bottle and hardware remain unchanged; the tube moves with the sprayer. A changed plate URL or geometry disables the local override. NODE_ENV production retains the existing images.

The user approved the clearer lighting direction shown by the native image-generation candidate. The tool did not expose its model/version. The candidate's outline differed from the source, so it remains review evidence. After the user rejected the seated tube as looking like an exterior sticker, the local renderer now applies `brightness(0.625) contrast(4)` only in **Exploded**. Cap On and Sidecar retain original PSD lighting, including Builder magnification. Source pixels, outline and alpha remain unchanged. The exact pilot URL is scoped; other images are unaffected. This corrects the excessive seated contrast, but does not simulate refraction through the flattened glass plate. Final assembled visual approval remains pending.

Offline output covers all seven configurations × three views × both environment snapshots (42 renders). The 18-pixel alpha break is absent from the source pilot. Source hash, plate guards, view consistency and production exclusion have regression coverage. Browser/CSS/optimizer behavior and owner approval of every final assembled view remain pending.

## Local versus production alignment

Local uses development Convex. Its media records differ substantially from production: 96 production website-SKU keys absent from development, 2,194 matching-key primary URL differences, and 1,185 cap-off URL differences. Different URLs are not automatically different pixels or defects. Do not point the entire local app at production: catalogue/media reads need a controlled production-matched baseline while checkout, writes and test data remain isolated. No environment or database was changed in this audit.

## Remaining work, in order

1. Confirm the exact URL/SKU for the amber-bottle screenshot; the crop alone does not establish identity. A URL question is pending.
2. Review the Square pilot's final assembled appearance in local PDP and Builder, including zoom and physical Safari.
3. Recover and register exact source tubes for Round 78 clear/frosted and Empire 50 lotion. Original layers exist, but Round's photographed glass omits its neck. Empire's full raster bounds include faint pixels below its meaningful tube; the latest source inspection supersedes the earlier apparent-overlength finding. Exact registration and mechanism identity need review before reuse.
4. Resolve the 55 continuity flags and the glass-fragment candidates by family; retain body-specific fitment and tube length. Verify all supported views and every affected finish.
5. Review flat photos and combined assemblies in the no-separated-tube queue. Add absent legacy sellable SKUs to scope as evidence establishes them.
6. Establish the production-matched read-only local baseline, then repeat SKU/view/selection/cart verification. No publish, merge or production write without explicit release approval.

Agent browser access to localhost was denied by a saved permission during the earlier audit. No alternate browser or indirect page-access workaround was used. Offline composition and public image-source checks are not browser acceptance.

## Files

- `tube-configuration-matrix.csv`: exact SKU/view/source URLs, local repair and acceptance status.
- `tube-review-queue.json`: every referenced image, source hash and affected records.
- `summary.json`: deduplicated measures and scope limitations.
- `production-no-separated-tube-review.json`, `development-no-separated-tube-review.json`: photo/combined-assembly review queues.
- `square15-pilot/comparison.jpg`: previous expanded view / local source pilot / local sidecar.
- `square15-pilot/verification.json`: all 42 offline views.
- `source-inspection/`: original layer extraction and master hash receipts.

Evidence directory: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/dip-tube-audit-2026-10-13`
