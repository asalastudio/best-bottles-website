# Approved Apothecary catalog heroes

Five reviewed Sunburst 2.5 images replace the old catalog scale proofs when the existing `NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22` family release is enabled: 15 mL cobalt, 30 mL clear/cobalt/green, and the 118 mL clear pear assembly included in the review. The green stopper is seated inside the neck; its loose-stopper draft is not selected.

The September 24 user instruction “ok lets push these to the UI ad create a PR” approves this reviewed set for integration. `approval.json` records exact SKU, group, Shopify variant, native render hash, model, input hashes and delivered asset hash. `approved-review.jpg` is the reviewed family sheet. Body framing, green glass and contact shadows are retained from the approved renders. The saved 91% baseline and shoulder spans are framing targets; this release does not claim new physical measurements or pixel-exact background cleanup.

Exports uniformly downsample the native 2080 × 2288 renders to 1560 × 1716, then encode lossless WebP. The exporter checks decoded WebP pixels against the resized RGB input. Next Image continues to serve responsive derivatives in catalog cards. No new CSS scaling is applied.

The existing exact-SKU and visible-variant checks control image selection, including precedence over an older Shopify group photo. The existing family flag is required in the build environment. Flag-off and Cylinder-only behavior remain unchanged. The PR does not change Convex, Shopify media, PDP component layers, Builder kits or other families.

Rollback: remove the Apothecary release import/spread in `src/lib/products/catalog-heroes.ts` and rebuild. Previous catalog assets remain available. The raw generation workspace stays local; `scripts/hero-families/release-apothecary.cjs` exports from its hash-checked render receipts.

Validation: all 10 targeted release, exact-SKU, Shopify-precedence and catalog-card tests pass, along with changed TypeScript-file lint. The local `/catalog?family=Apothecary` page returned HTTP 200 with all five actual catalog cards; browser inspection confirmed all five images decoded successfully from the new content-addressed paths through Next Image (`w=384`), and each product link carried its exact SKU. The stored image set is 6,071,702 bytes versus 14,378,307 native PNG bytes, a 57.8% reduction before responsive delivery.
