# Boston15 supported views — 13 October 2026

Extended the offline source review through the storefront's `stageLayout`, `availableViews` and shared-envelope functions. This is local function/raster evidence, not a browser simulation or live acceptance.

- 21 source combinations: 16 identities in the saved catalogue, five legacy-only candidates.
- 27 supported views: 18 assembled droppers, plus Cap On, Sidecar and Exploded for each of three short-cap bottles.
- 63 requested-view decisions recorded. Unsupported dropper requests resolve to Cap On under the existing assembled-closure policy; they are not offered as distinct views.
- No visible part bounds fall outside the canvas at the recorded alpha threshold. Body placement remains identical between Cap On and Sidecar for all three short-cap bottles.
- The contact sheet was visually inspected: all heads and short caps are present, all three cap-view states differ as intended, and the clear dropper pipettes remain visible.

The renderer uses original local image bytes and actual stage framing, offsets, z-order and bottom clipping. It does not make network requests. Its shared envelope contains these 21 candidate kits; a deployed envelope may include additional finishes. Alpha-bounds checks cannot establish photographic quality, occlusion or fitment acceptance. Edge quality, exact source proportions, selectors, loading recovery, desktop/mobile UI and cart identity remain separate gates.

Reproduce with `scripts/review-boston15-stage-views.ts SOURCE_RECOVERY_DIRECTORY`. Outputs are `stage-view-review/contact-sheet.jpg`, `receipt.json`, `matrix.csv` and 27 labelled PNGs. All browser verification, owner approval and release flags remain false.

TypeScript and whitespace checks pass. Browser access was retried and still rejected by the saved permission policy. No workaround was used; no merge, publication or deployment occurred.
