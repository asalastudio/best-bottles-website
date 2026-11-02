# 25 ml Cylinder, 18-415: material and copper-cap review

The regenerated clear body and cleaned copper overcap are ready for local visual review. The current body remains preserved. The new glass is not in the approved hosted master manifest.

Review: http://localhost:3010/reviews/cylinder25-material-cleanup-2026-11-02/index.html

Candidate product page: http://localhost:3010/products/cylinder-25ml-clear-18-415-lotionpump?sku=LBCyl25LtnCu&assetPreview=gpt13

Candidate Builder: http://localhost:3010/matrix?family=Cylinder&sku=LBCyl25LtnCu&assetPreview=gpt13&from=pdp

## Source artwork located

The master PSD root is `/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master`.

The native 25 ml lotion product artwork is in `2.  18-415 Bottles /1. Cylindrical 25ml /1. Cylindrical 30ml PSD /14. LBCyl30LtnMtGl.psd`. Layer 21 contains the lotion head, Layer 19 the internal mechanism and tube, Layer 25 the glass, and Layer 22 the overcap. The historical filename says 30 ml; the 25 ml catalog identity and 83 mm by 32 mm reference are recorded separately. The filename was not used to infer capacity.

Original standalone component artwork is in `20. Caps/8. 18-415 Lotion/`: copper in `16. Ltn18-415Cu.psd`, Layer 1; matte gold in `16. Ltn18-415MtGl.psd`, Layer 1 copy; polished silver in `21. Ltn18-415ShnSl.psd`, Layer 2 copy. The unaltered layer exports and complete PSD paths and hashes are in `psd-layers.json` and the Drive source archive.

## What changed

- One newly generated clear body serves all 36 prepared local configurations. Its rim and external foot are uniformly registered to the existing datum. The 46.5% shoulder span, 91% baseline, canvas, anchors, and 18-415 neck identity are retained.
- The copper overcap source contained detached white polygons above its rim. A clean transparent replacement keeps the visible copper width, center and seated bottom, using uniform scaling. Only the two exact 25 ml lotion/fine-mist copper component sources are matched. Other finishes and body sizes are unchanged.
- The existing clean lotion tube remains the sole internal source. Pump-head artwork is unchanged.
- The first generated body was rejected for poor interior alpha. The second body is the review candidate. The built-in image editor was used; its model version is not exposed.

The original assets remain intact. Nine tassel assemblies from the earlier 25 ml pilot are still held for their own source/placement reconciliation. This is not a claim that the complete Cylinder family is finished.

## Validation

The full suite passed with 3,276 tests and seven skipped. Typecheck, scoped lint and whitespace checks passed. The browser review covered 58 final desktop/mobile states across ten representative configurations, checked ten Builder API entries, and confirmed the same body and clean copper cap in the actual Builder. Screenshots wait for cap transitions to finish.

The new copper source has lossless responsive WebP copies. Pixel comparisons found zero visible-color or alpha changes against each resized reference. The source PNG remains unchanged. The candidate body stays in the localhost review path until visual acceptance.

The preceding lotion-tube batch, commit `7cebdf7b4ec3f85d3bb892a033dbe6374da6fa0a`, passed CI and hosted checks: 132 PDP states, 22 Builder API entries and two actual Builder pages. Its one-hour preview-access link was revoked after testing. Six cold-cache mobile measurements at 9 Mbps down and 80 ms RTT ranged from 1.78 to 2.87 seconds for all hero images to decode. The two-second target has not been met consistently.

Drive review folder: https://drive.google.com/drive/folders/18OTIo2bJpu8ftRhQDWFtlskgmIK7djwl

## Reproduce locally

Restore candidate images and native source exports from the Drive archive, then run:

```sh
node --import tsx docs/reviews/cylinder25-material-cleanup-2026-11-02/prepare.mts
node docs/reviews/cylinder25-material-cleanup-2026-11-02/verify.cjs
```

`assetPreview=gpt13` is an existing localhost-only review gate. Normal hosted pages continue to use the currently registered glass. No production merge or deployment was performed for this candidate.
