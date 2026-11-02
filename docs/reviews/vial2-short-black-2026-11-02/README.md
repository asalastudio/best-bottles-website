# Short amber 2 ml vial: black cap and size wording

Scope: `vial-2ml-amber-13-425`, the squat amber vial, 22 mm bare height and 16 mm diameter. The approved slender 2 ml / 8-425 clear and amber bottles are unchanged.

Local product page: http://localhost:3010/products/vial-2ml-amber-13-425?cap=black

The owner requested a black-cap choice and “0.08 oz” in the item description. Both cap choices now receive that exact wording. The underlying capacity remains 2 ml / 0.07 oz as recorded in the source; this copy correction does not change physical measurements.

The correct original black-cap website SKU is `GBVAmb1o5BlackCapSht`. The similarly named `GBVialAmb1o5BlackCapSht` is a different, taller source image and is not used. Original Photoshop files and the exact legacy short-vial image establish the restored identity.

## Catalog correction

`scripts/catalog-corrections/2026-11-02-short-amber-vial-black.mjs` defaults to a read-only plan. Its explicit `--apply` creates only the missing black-cap twin with the confirmed short-vial dimensions. The existing white record is checked for exact preservation after the write.

The black variant has no Shopify variant ID and is unavailable for online checkout until its own mapping is established. It never inherits the white cap's cart identifier. The $0.38 single-piece tier comes from the historical black-vial record; no volume ladder is invented. The known legacy website SKU is retained as its identifier pending canonical Grace/Shopify mapping.

Both options share the existing amber master body locally. The black 13-425 cap comes from the existing 4 ml component kit and is uniformly aligned to the white cap's visible width, center and seated bottom. The donor bottle is not reused. Hosted fallback for the new black catalog record is its correct original legacy photograph.

## Verification and release

The catalog readback confirms both caps, matching physical dimensions, no black Shopify linkage and an unchanged white record. The local browser check exercises actual cap-selector clicks, all three views and desktop/mobile sizes, with the same body across selections. White checkout stays enabled; black checkout stays disabled.

The copy and restoration tool are part of PR #388. The catalog record correction has been applied through the existing mutation. The new layered short-vial kit remains localhost-only and has not been added to the hosted approved image manifest.

```sh
node docs/reviews/vial2-short-black-2026-11-02/prepare.mjs
node docs/reviews/vial2-short-black-2026-11-02/verify-browser.cjs
node scripts/catalog-corrections/2026-11-02-short-amber-vial-black.mjs
```

Drive source archive: https://drive.google.com/drive/folders/1EH9xpA1aTtX4Ey5nA0yPV0rlYpJvzrOY
