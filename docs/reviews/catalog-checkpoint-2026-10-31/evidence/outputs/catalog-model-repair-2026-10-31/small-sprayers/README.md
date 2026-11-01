# Small Cylinder profile review

Clear and cobalt 5 ml v19 were approved by Jordan on October 31, 2026. The masters and kit snapshot are preserved in `approved-five-v19/`; `approved-five-v19.json` records their hashes. All 71 SKU mappings are checked against the builder API, with browser handoff evidence in `five-approved-handoff-checks.json`. Production is unchanged.

LOCAL REVIEW ONLY. No originals replaced, no upload or production changes. Not a catalog-wide sign-off.

## Corrections

75 exact SKUs use the local review: 4 small sprayers and 71 five-millilitre configurations.

The 3.3/4 ml bottles remain product-page only. The 5 ml body is shared with the builder. Approved framing stays at 28%, 32.5%, and 36.5% shoulder-to-foot with the foot at 91%.

## Source limits

- The exact 3.3/4 ml original PSD photos have the sprayer on. Their concealed 12 mm finish geometry is inferred, not manufacturer-verified.
- Five ml dimensions now follow Jordan caliper measurements. A uniform 7.32 mm opening is inferred from the measured 12.60 mm crest and 2.64 mm wall; the 1.80 mm rim wall gives a 10.92 mm plain rim. Unthreaded neck lands follow that diameter and the supplied clear reference. This is not a manufacturing tolerance drawing.
- The legacy technical drawing, label-fit diagram and PDF link are omitted only for these local measured-body previews because they still carry the earlier dimensions. They require a separate measured drawing update before release.
- The product data still carries legacy 5 ml dimensions; local callouts and the tech sheet now show 53.23 mm height and 17.45 mm nominal diameter. No backend record was changed.
- This local review does not approve unrelated product families, checkout or redirects.

## Files

- `renders/*profile-v4.blend` and `renders/*measured-v19.blend`: editable native copies
- `renders/*profile-v4.png` and `renders/*measured-v19.png`: isolated glass exports; `mechanism-5-measured-v6.png` is the measured tube
- `user-photos/orientation-review.json`: orientation classification for all ten physical reference photos
- `five-measured-verification.json`: dimension, shared geometry, orientation and camera-clip checks
- `source-review/sources.json`: original PSD paths, hashes and layers
- `before-*.png`, `before-profile-v4/`, `after-*.png`: browser comparisons
- `profile-review-report.json`: per-SKU defects, fixes and provenance
- `browser-checks.json`, `five-browser-checks.json`, `five-layout-checks.json`: QA evidence

## Small sprayer mechanism revision

The first audit verified black/white consistency, not manufacturer fidelity. Mechanism v2 now uses the exact-SKU PSD pump photos to guide the housing, spring and tapered lower connector. The original spring existed and was render-enabled; its earlier appearance was poorly legible. The revised mechanism remains a visual review candidate. Glass bodies, bases, sprayer heads and overcaps are unchanged. See `small-sprayer-consistency-report.json` and `../reducer-review/review-report.json`.
