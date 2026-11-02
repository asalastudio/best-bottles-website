# Tulip pour variants and shared hero masters

Fresh legacy option pages list twenty pour variants: ten 5 ml Amber and ten 6 ml Clear. The current production builder returns nineteen: ten Amber and nine Clear. `legacy-products.json` records each exact printed SKU and its public product page. `reconciliation.csv` and `reconciliation.json` preserve the differences.

Nineteen supported recipes now use the exact same hosted body part, glass sizing and source bytes as the approved Tulip sprayers and rollers. Catalog cap swaps resolve those recipes through the common master API instead of old flattened hero photos. The original 271 hosted recipes are unchanged; the manifest now contains 290. No new image was generated or uploaded to public media. Native black and white ribbed-cap images and vertical seating remain intact, while the smooth caps reuse the approved 13-415 masters and Tulip shoulder registration.

The missing `GBTulip6BlkShSht` is the Clear short shiny-black option. Its legacy page is priced and selectable, and its exact catalog product record exists. Existing source reconciliation reports no verified current component association. No exact source file was recovered in the canonical master tree during this pass. It remains an explicit component-identity hold; its route and product record were not deleted and no other cap was substituted. Backend records, prices, stock and Shopify identities are unchanged.

Local verification passed all 114 product-page states and 38 catalog cap selections across desktop/mobile. Every catalog selection kept the same body source, SVG view box and body coordinates for its glass color. The shared-master tests check catalog routing, PDP/body parity, stable framing and the unresolved identity hold. Hosted preview and production verification remain separate release steps.

Review: http://localhost:3010/reviews/tulip-pour-reconciliation-2026-11-01/index.html

`reconcile.py` rebuilds the exact current 19-variant comparison from saved catalog, legacy and source snapshots. `connect-shared-masters.cjs` connects only their existing approved source images to the hosted manifest. `verify-catalog.cjs` checks all catalog cap choices and accepts `QA_ORIGIN` for hosted verification. No database mutation or image generation is performed.
