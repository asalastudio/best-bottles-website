# 50 ml jumbo roller bottle: complete PSD glass correction

The owner rejected the recovered 50 ml body and supplied the exact `GBCyl50RollBlk` source with its stated 98 mm height without cap, 37 mm diameter and 16 mm neck designation. The separate 28 ml reference is `GBCyl1ozRollWht`, stated 81 mm without cap and 31 mm diameter. The 28 ml runtime body is unchanged in this correction.

The isolated 50 ml body layer omits the broader neck visible in the complete assembly. The original PSD's roller/retouch layers contain additional glass-neck pixels. The corrected geometry guide includes layers 1, 3 and 4 from `1. GBCyl50RollBlk.psd`, in their native positions, through the glass-only viewport `[226,470,735,1821]`. Original source files are untouched.

The bare guide is 509 × 1351 pixels. Its aspect ratio is within 0.3% of the supplied 37 × 98 mm dimensions. The shoulder is registered from the complete source, and the wider rim determines the flange's image registration. This is photographic registration, not a new physical measurement of the roller or cap.

## Material and silhouette

Three built-in image-generator edits are preserved with their prompts in `generation-requests.json`. The first retained a roller ghost and rough alpha; the second had an exterior glow; the third supplies the chosen clean glass material. Its generated outline is not accepted as the product geometry.

`prepare-body.mjs` projects the generated neck/body materials uniformly inside the complete PSD's outer contour. The native photograph retains a narrow edge band. Internal retouch cutout holes are filled because they are not physical holes in the bottle. Disconnected debris is excluded. The final alpha matches the resulting filled outer-contour mask with zero differing values. This comparison does not claim preservation of old RGB values or of the PSD's internal cutout mask.

`50ml-body-registered.png` and `sources/50ml-body-psd-geometry-studio.svg` are candidate reusable body masters. The source guide, generated drafts and old recovered master remain separate.

## Assembly and release

The four 50 ml / 16 mm recipes share this one corrected body. Metal/plastic roller images and black/white cap images retain their approved bytes. The flange is fitted to the corrected mouth, and the cap is uniformly registered to cover the roller while its bottom meets the shoulder. The existing 53% height target and 91% baseline remain. The other 105 candidate recipes, including all four 28 ml assemblies, are identical to the snapshot immediately before this correction.

Review: http://localhost:3010/reviews/jumbo50-body-reference-2026-11-02/index.html?sku=GBCyl50MtlRollWht

The earlier jumbo-review URLs also show the current candidate. This correction is being saved to the draft PR for review and remains excluded from the hosted approved manifest. It awaits body approval and hosted verification before publication. The approved roller material remains separate from body approval. The 28 ml product page can be inspected at http://localhost:3010/products/cylinder-28ml-clear-16mm-rollon?sku=GBCyl1ozRollWht&assetPreview=gpt13; its body is unchanged while its metal roller uses the approved update.

```sh
node docs/reviews/jumbo-body-reference-2026-11-02/prepare-body.mjs
node_modules/.bin/tsx docs/reviews/cylinder-family-completion-2026-11-02/register-rollers.mts
node_modules/.bin/tsx docs/reviews/cylinder-family-completion-2026-11-02/prepare.mts
node docs/reviews/cylinder-family-completion-2026-11-02/build-display.mjs
node_modules/.bin/tsx docs/reviews/jumbo-body-reference-2026-11-02/build-review.mts
node docs/reviews/jumbo-body-reference-2026-11-02/verify-browser.cjs
```

Candidate source archive: https://drive.google.com/drive/folders/1bbRCPULGcclihr31TWzQyAGEGSYVTfUt

Verification: all 48 desktop/mobile jumbo states pass after retrying one transient localhost navigation timeout on the unchanged 28 ml page. Typecheck and scoped lint pass. Registration and source-hash checks pass for all 109 candidates. The family master index is refreshed from the actual current candidate kits.

## 28 ml reference check

The owner requested the 28 ml page for inspection after supplying the exact `GBCyl1ozRollWht` reference. The updated roller is present in all four 28 ml recipes, but visual comparison with `sources/28ml-complete-psd-reference.png` shows that the existing recovered body still has a narrower neck than the complete PSD assembly. This body is not marked corrected or approved. Its runtime bytes remain unchanged; a separate complete-source neck correction is pending. Browser passes establish rendering and state consistency, not acceptance of this shape.
