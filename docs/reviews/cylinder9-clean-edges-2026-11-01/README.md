# Cylinder 9 ml fixed-edge cleanup v04

The user requested sharper glass and clean edges while preserving the exact bottle shape and level rim, shown at the real product-page size.

The review deliverable uses the existing Sunburst v03 image in a fixed-coordinate SVG layer, with a mild 3 × 3 detail filter that preserves alpha. A clip path follows the source's row extents at alpha >=128 and removes the low-opacity fringe outside the actual bottle. The same source pixels remain in the same positions. No resizing, warping or image regeneration is used in this final cleanup layer. Chromium exports the layer to a native transparent 743 × 2116 PNG. This is modest detail sharpening, not a resolution increase or a new optical render.

Pixel verification reports zero structural-mask mismatches across 766,172 pixels, and zero alpha changes inside the retained silhouette. All 33,050 nonzero-alpha pixels outside that silhouette were removed. The rim and silhouette therefore remain identical to v03 at the declared alpha threshold. This preserves the chosen image geometry, not a new certification of manufacturer dimensions.

One authorized high-quality Sunburst cleanup generation was tried first. It returned a 743 × 2115 image whose outline aspect changed −1.142%. That alternative is retained and clearly labeled REJECTED-shape-drift; it is not the deliverable.

## Product-page preview

http://localhost:3010/reviews/cylinder9-clean-edges-2026-11-01/index.html

The review embeds the actual local Cylinder 9 ml clear fine-mist page and replaces only its visible body layer inside the isolated frame. Default view shows the full bare bottle, including its rim. The hardware toggle shows the existing sprayer, collar, dip tube and overcap for context. Before/after use identical image registration. It does not change the product's data, normal page artwork, builder assignments or catalog records.

At a 1440 px viewport the bottle occupies 76.54 × 284.79 CSS px in the 696 × 540 px stage. At 390 px it occupies 56.69 × 210.92 CSS px in the 390 × 400 px stage. Both retain the actual PDP's body height and baseline. Six desktop/mobile states passed loading, uniform scaling, complete-bottle bounds and overflow checks. Screenshots show the full stage and product page.

The unchanged active 5 ml kit and clear/cobalt master hashes are recorded in preserved-assets.json.

## Files and recovery

- BB_Cylinder_9ml_17-415_Clear_BODY_Fixed-Edges-v04_REVIEW.png: native cleaned transparent PNG.
- BB_Cylinder_9ml_17-415_Clear_BODY_Fixed-Edges-v04_REVIEW.svg: editable fixed-coordinate source layer with embedded original pixels.
- before-v03.png: preserved input.
- Sunburst-cleanup-v04_REJECTED-shape-drift.png and sunburst-prompt.txt: the rejected generated alternative and its exact prompt.
- geometry-contract.json, pixel-verification.json and browser-checks.json: evidence.
- runtime/: restorable review page and assets.

Restore with `node docs/reviews/cylinder9-clean-edges-2026-11-01/restore.mjs --apply`.

Drive: https://drive.google.com/drive/folders/1qsoRIZJoStFeOF7raT5QVGB_v36rCOWv

This batch is saved for review. No production deployment, merge, database change or approved-master replacement.
