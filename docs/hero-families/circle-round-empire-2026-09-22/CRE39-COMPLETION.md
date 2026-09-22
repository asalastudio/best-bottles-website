> Current approval: Jordan approved all 60 displayed heroes: “Those look totally good.” Exact bytes, reviewed sheets and body targets are locked in `complete-family-approval.json`. Earlier pending-review statements below are historical. Staging is deployed and verified; see STAGING-RELEASE.md and staging-deployment.json. Production publication is separate.

# Completed 39-image alignment and tassel batch

All 39 requested existing heroes now have 2080 × 2288 final review exports: 17 Circle, 11 Round and 11 Empire. Thirty-seven were salvaged by one uniform scale and translation of the complete existing photograph; two ivory-tassel compositions were corrected with the explicitly authorized Sunburst API and then registered as whole photographs. The Circle correction required one localized fringe retry, for three successful API calls total. Original renders and all intermediate attempts remain preserved.

The full family sheets include the 21 current frosted finals: **28 Circle, 21 Round and 11 Empire = 60 exact-SKU images**. All 12 prior approved frosted image hashes remain unchanged. The 39 new images and nine remaining frosted Round images await visual review; no approvals were inferred from the request to finish the batch.

Targets remain body-specific: Circle 15/30/50/100 mL spans 44.625/46/54/58%; Round 78/128 mL spans 48/54%; Empire 50/100 mL spans 50/55%. Every glass foot is mapped to 91%. Circle/Round use the cap/glass seating datum; open necks use the corresponding shoulder/neck seating transition. Empire uses the flat glass shoulder. Verified source and native landmark crops, final enlarged crops and measured foreground bounds are preserved. Visual source-landmark uncertainty is approximately ±5 px (up to ±8 px after enlargement). The transform’s exact target coordinates are not a claim of subpixel landmark identification.

## Tassel corrections

- GBCrcl50AnSpTslIvyGl: exact clear Circle 50 mL, ivory bulb/hose/tassel, shiny gold sprayer and collar. The original low tassel exceeded the canvas at the target body size. A compact arrangement and localized inward-folded fringe now fit. Final visible bounds: x24–2013, y222–2203.
- GBRnd128AnSpTslIvyGl: exact clear Round 128 mL with ivory bulb/hose/tassel and shiny gold hardware. The original spread was too wide. The compact connected arrangement now fits. Final visible bounds: x25–1990, y154–2208.

Both use the exact master PSD composites plus the approved clear-glass reference. Circle retains its flatter face and straight integral foot; Round retains its fuller globe and rounded foot. The bulb, hose and tassel remain connected. No accessory was detached or converted to a sidecar. Each final has 54% cap/glass-to-foot span and 91% glass foot. Generated corrections are not pixel-identical to originals; their optical/geometry appearance awaits user approval. Prompts, masks, hashes and generation records are in output/imagegen/cre-final39/tassel-corrections/.

## Reused image fidelity

The 37 reused images preserve their original 1560 × 1716 detail; 2080 × 2288 delivery exports do not imply new native detail. Existing materials and presentation states are retained, including the two Empire white-pump clear-overcap images. No hardware, material, neck, foot, shadow, or cap state was selectively edited in these 37. Source SHA-256 verification passed for all 39 original photographs. The two new tassel renders are native 2080 × 2288.

## Review deliverables and verification

Local review: http://localhost:3052/complete-family-review/. Full guided and clean sheets plus two-column mobile pages are in output/imagegen/cre-final39/sheets/. The review copies live in the task’s visualization folder. Gold guides mark shoulder/closure seat; green guides mark the 91% glass foot. Every row exposes its exact SKU and final image.

Browser verification passed all 60 image loads at 390 px and 1440 px: HTTP 200, exact 2080 × 2288 dimensions, no horizontal overflow or page errors, and working guide toggle. Canvas, whole-image transform, source/approval hash preservation and independent foreground-bound checks passed. No image or tassel is clipped by the canvas.

Reproduction: scripts/hero-families/align-cre-existing.cjs handles the 37 source photographs; scripts/hero-families/align-frosted-circle-round.cjs accepts the tassel correction directory for the two new outputs; scripts/hero-families/build-cre-final-review.cjs assembles all 60 and the sheets; scripts/hero-families/verify-cre-family-review.cjs checks mobile/desktop. Supporting measurement scripts are preserved in output/imagegen/cre-final39/qa-scripts/.

No registry, backend media, staging alias or production site was changed. No commit/PR or publication was performed in this review-only step. The next action is Jordan’s review of the complete family sheets, followed by the explicitly approved release work.

Required pre/post alignment recounts passed with no backend count movement in Circle, Round, Empire or Cylinder. All 2,286 plate measurements completed without failures. Exact family states are in cre39-recount.json. Original tracked ledger files were restored and the temporary cache symlink removed.
