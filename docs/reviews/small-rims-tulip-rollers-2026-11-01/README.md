# Small sprayer rims and Tulip rollers

Prepared for owner review, November 1, 2026. Local only. Not published or visually approved as a new batch.

## Corrected scope

- Four small-sprayer SKUs: GBSpry3mlClBlk, GBSpry3mlClWht, GBSpry4mlClBlk and GBSpry4mlClWh. Regenerated continuous glass removes the pasted-neck shoulder seam. Black and white sprayers share one body per size.
- Thirty-six Tulip roll-on SKUs: 5 ml amber and 6 ml clear, each with metal and plastic rollers across nine cap finishes. Reuses the approved level 13-415 roller masters, places the full plug behind the neck, seats the flange on the visible front lip, centers the cap, and seats the existing cap artwork at the shoulder.
- Body scale, baseline and approved family exceptions retained. Small sprayers remain product-page only. Tulip body masters match the existing approved sprayer bodies exactly. Existing sprayer/tube/overcap corrections are preserved.

## Provenance and limits

The 3.3/4 ml geometry guide comes from the existing profile-v4 Blender renders, originally developed against the PSD photographs and catalog dimensions: 37/49 mm heights and 14 mm diameter. The short 12 mm necks were inferred because the original PSD photographs show the sprayer installed; these edits do not constitute new verified neck measurements. GPT regenerated the glass appearance. Native-profile alpha registration preserves the original outer shape and the old RGB seam is not reused.

Tulip uses the existing approved GPT body images. Roller imagery comes from the previously approved corrected 13-415 master shared with Cylinder 5 ml. Front-lip placement is visual registration, not a certified new plug dimension. Existing Tulip cap pixels and dimensions are retained. Family regrouping under Cylinder is deferred.

## Verification

120 desktop product states across all forty SKUs, twenty-four mobile states across eight representative SKUs, all thirty-six shared builder API kits, and four real builder entries passed. One concurrent development-browser protocol timeout on the 3.3 ml white sprayer passed in an isolated rerun; both records are preserved. TypeScript and fourteen relevant regression tests passed. Full release CI still needs to run on the new commit.

## Review

Local review: http://localhost:3010/reviews/small-rims-tulip-rollers-2026-11-01/index.html

Archive folder: https://drive.google.com/drive/folders/1pU1DZleZWsABYRIO6adBaWzwK0OwZVJ2

Candidates stay separate from approved master folders until owner sign-off. Original images, native kits, and the previous small-sprayer kit are retained in the source and before snapshots. No production backend, live media, merge or deployment is changed.
