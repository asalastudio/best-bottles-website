# 4 ml vial family: completed local update

Clear, amber, cobalt blue and green are connected to all eight black/white screw-cap SKUs on localhost. Amber, green and cobalt were generated with the explicitly requested gpt-image-2.5-sunburst model, quality high, using the same corrected clear master. Exactly three additional calls were made under Jordan's latest approval. Original transparent PNGs are 1195 x 1316; no upscaling or image-pixel modifications.

## Fixed registration

Reference dimensions are 44.98 mm overall height, 14.60 mm body diameter, 12.50 mm outside thread diameter, and 7 mm shoulder-to-rim height. All four use the approved 51.74% glass height, 91% baseline and a shared centerline. Display width calibration is 4.33% clear, 3.91% amber, 3.52% green and 2.94% cobalt. These are 2D images registered to the measured proportions, not a new dimensional Blender mesh.

Normalized silhouette edge RMS differences from the clear master are 0.36% for amber, 0.23% green and 0.33% cobalt, relative to body width. Shoulder-height differences are 0.2%, 0.2% and 0.4% of bottle height. Both cap source files are shared unchanged across all four colors.

## Verification

64 product-page browser checks passed: both cap finishes, cap off/sidecar, cap on, exploded, desktop/mobile, glass lineup, component strips, old cap=clear links and reload. Visible bottle and cap bounds remain inside the stage. Cap seating differs from the specified display anchor by less than 0.01 px. Observed glass height ranges from 51.7382% to 51.7399%; foot ranges from 90.9960% to 90.9998%. Six shared-review control checks also passed. All three new masters and representative desktop/mobile product screenshots were inspected visually.

The earlier cap-color normalization change has 31 passing targeted tests from the preceding implementation pass. No application source changed during the three color-edit pass.

## Files

- sunburst/clear-v3.png, amber-v2.png, green-v2.png, cobalt-v2.png: native masters.
- sunburst/*-color-edit-prompt.txt: exact color-edit prompts.
- sunburst/additional-colors-approved.json: explicit approval, inputs and outputs.
- selected-masters.json and registration.json: selected files and display placement.
- shape-consistency.json: silhouette comparisons.
- defects-by-sku.json: corrections and before/after screenshot paths for every SKU.
- screenshots/: product-page captures for all views and both viewport sizes.
- backups/clear-only-before-colors/: rollback to the preceding clear-only local state.
- generation-ledger.json: earlier rejected shape attempts plus the three successful color edits.

The active manifest is public/local-kits/vial-4ml-measured-2026-10-31/kits.json. The shared review is public/reviews/vial-4ml-short-neck-2026-10-31/index.html.

## Review links

- http://localhost:3010/reviews/vial-4ml-short-neck-2026-10-31/index.html
- http://localhost:3010/products/vial-4ml-clear-13-425?cap=black
- http://localhost:3010/products/vial-4ml-amber-13-425?cap=black
- http://localhost:3010/products/vial-4ml-blue-13-425?cap=black
- http://localhost:3010/products/vial-4ml-green-13-425?cap=black

Black/white finish selection remains in the URL. Add cap=white for white caps. Dropper variants and the separate 2 ml family are unchanged by this update. No production publication, live-store upload or merge.

Four client-side color-navigation checks also passed: white-cap selection, exact SKU and new master persist through amber, cobalt, green and clear.
