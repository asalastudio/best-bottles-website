# Remaining 13-415 bottle review

450 configurations use 16 shared bottle/color masters on localhost. The tall 9 ml 13-415 Clear and Frosted bodies have new built-in GPT material candidates registered to their existing source outlines. The other bodies retain recovered material pixels, with a filled outer silhouette mask that removes the backdrop without reopening the old middle cutout.

The completed Cylinder 5 ml and Tulip sprayer/roller configurations are excluded from this batch. Tulip pour variants reuse their approved sprayer body. The original files remain intact.

## Component registration

- Eight PSD fine-mist sprayers and matching overcaps reuse the approved Cylinder 5 ml component sources by exact component ID.
- Metal and plastic 13-415 rollers use the corrected full-plug sources. One roller layer replaces duplicate heads and old tube-like roller layers.
- Pour and roll-on caps reuse exact 13-415 component masters. Ribbed caps retain their artwork and vertical seating.
- Visible collar/cap edges are centered on one assembly axis for each bottle design, shared across glass materials. Measured datums and bottle sizing are unchanged.
- The tall 9 ml clear collar meets the shoulder; Frosted uses its own slightly higher shoulder crest. The tube reaches the interior floor without entering the solid base. Seated frosted tubes use 16% opacity with CSS multiply blending; exploded tubes retain the natural plastic appearance.
- Other tube endpoints use visually registered interior-floor landmarks. These are source-image estimates, not new certified physical depth measurements. The shaft is 1.1 mm visually inferred diameter; only its middle length changes.

## Review and release limits

This is a local review batch, not an approval or production release. Review each body, finish and assembled state before replacing production media. Vercel and non-localhost guards remain.

Seven current Minaret configurations have no separate closure kit: GBRect10MinarCu, GBRect10MinarSl, GBFlair15MinarCu, GBFlair15MinarSl, GBElg15MinarCu, GBRoyal13MinarCu, GBRoyal13MinarSl. No exact Minaret filename was found in the master inventory search. Alternate-layer and legacy-source recovery remain open; these SKUs keep their current product photos. Do not substitute an ordinary cylindrical cap.

Circle 15 ml's catalog clearance hold remains. Pillar's legacy route identity discrepancy remains. Bell/Pillar options have not been invented or expanded. The scope is the current configured catalog inventory, not proof of complete live-legacy coverage.

## Files and reproduction

`registration.json` records each SKU, floor and component placement. `center-verification.json` records visible-edge centering. `before-current-inventory.json` is the read-only snapshot. `protected-skus.json` protects completed work. `runtime-files-to-track.json` lists all new local runtime dependencies needed in a clean checkout.

Run `node docs/reviews/remaining-13-415-2026-11-01/register.cjs`, then `audit-centers.cjs`, then `register-centers.cjs` to reproduce the registrations. Restore the two GPT raw source images from the Cylinder Drive candidate archive if the original generation paths are unavailable, and set `REMAINING13_SOURCE_DIR` to that directory. Exported PNGs are individually labeled for later marketing reuse; they remain candidates until visual approval.

Review: http://localhost:3010/reviews/remaining-13-415-2026-11-01/index.html
