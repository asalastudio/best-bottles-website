# Shopify Variant Media / CodexSync Cleanup Summary

Generated: 2026-06-15

## Actions Completed

- Added `scripts/reconcile_shopify_variant_media_assignments.mjs` for conservative existing-media assignment:
  - Reads `coordinator/missing_shopify_variant_images.csv`.
  - Only acts on `product_media_not_assigned_to_variant`.
  - Matches exact Shopify CDN URLs first, then unique canonical filename matches.
  - Does not upload or generate media.
- Assigned existing Shopify product media to 50 Shopify variants total:
  - 9 for `atomizer-5ml`.
  - 41 additional safe matches across 17 Shopify products.
- Synced Convex/CodexSync image URLs to Shopify variant media:
  - Initial stale Convex drift after assignment: 111 rows.
  - Applied 111 rows by Grace SKU.
  - Applied a final 4-row Grace SKU pass after duplicate-key rows surfaced.
- Fixed cleanup tooling to patch Convex by `graceSku`, not `websiteSku`.
  - Root cause found: some component rows share `websiteSku`, which caused image ping-pong between SKUs.

## Final Verification

- Shopify safe assignment dry-run:
  - `planReady: 0`
  - `failed: 0`
- Convex backfill dry-run:
  - `patchesReady: 0`
  - `failed: 0`
- Shopify variant media audit:
  - `matchedSkuVariants: 2474`
  - `missingShopifyVariantImage: 462`
  - `shopifyImageNotCachedInConvex: 0`
  - `convexDiffersFromShopify: 0`
  - `convexNonShopifyWhenShopifyExists: 0`
- Shopify SKU mapping audit:
  - `matchedSkus: 2474`
  - `unmatchedSkus: 0`
  - `productsWithShopifyVariantIdMismatch: 0`
  - `productsMarkedOrderableButNotCheckoutReady: 0`

## Remaining Image Worklist

Fresh residual CSV:

`data/audits/stage-in-sight-image-sync-2026-06-15/cleanup/remaining_missing_shopify_variant_images_after_cleanup.csv`

Residual rows: 462

- `no_product_media`: 241
- `shopify_product_media_present_but_variant_image_missing`: 221

Largest remaining families:

- `Sleek`: 117
- `Slim`: 96
- `Roll-On Cap`: 35
- `Diva`: 31
- `Cap/Closure`: 30
- `Rectangle`: 26
- `Sprayer`: 26
- `Dropper`: 22

## Atomizer 5ml Spot Check

The original broken 5 ml atomizer issue is resolved at the data/source-of-truth layer:

- `GB-CYL-BLK-5ML-ATM-BLK-01` / `GBAtom5Blk`
- `GB-CYL-BLK-5ML-ATM-BLK-02` / `GBAtom5BlkDot`
- `GB-CYL-CLR-5ML-ATM-SLV-03` / `GBAtom5SlStars`

For these sampled variants, Convex and Shopify now point to the same assigned Shopify CDN image URLs, and the CDN URLs returned HTTP 200 with `image/png`.

Note: direct `curl` to `http://localhost:3001/products/atomizer-5ml` returned `404` during this cleanup session, and the in-app browser connector could not attach to a webview. A rendered PDP screenshot should be rechecked once the local server/browser attachment is healthy.
