# Approved Sleek hero release

All 21 Sleek heroes were visually approved on September 23, including the narrower regenerated 100 mL reducer. This release copies the exact approved final PNG bytes into content-addressed catalog paths and records source, input and final hashes in approval.json. There were 22 Sunburst 2.5 generations: the 21-image batch and one targeted reducer correction; only the 21 approved selections are activated.

The canvas is 2080 × 2288 with bone sRGB #F5F3EF and a 91% glass-foot baseline. Shoulder-to-base spans for 5/8/30/50/100 mL are 30/43/47/56/60.5%. Complete assemblies were uniformly scaled and positioned without independent hardware warping. Measurements carry approximately two preview pixels of uncertainty; the corrected reducer was measured at native size with approximately six pixels of uncertainty. Review sheets show guides; delivered PNGs have none. All sampled empty-background patches passed tolerance and no strong content intersects the checked 24-pixel canvas border. Shadows and glass are excluded from background checks.

All 21 exact SKUs have catalog group and Shopify variant mappings in the reviewed intake. The existing NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22 flag selects the new release. Flag-off and Cylinder-only behavior remain unchanged. This release updates catalog heroes and exact-SKU hero lookup; it does not replace PDP component layers or publish Shopify/Convex data.

The original rejected reducer and other native renders remain preserved in the ignored local image workspace. All 20 sibling final hashes were unchanged by the correction. This is a PR candidate, not evidence of a production deployment.

Rollback: remove the Sleek release import and spread from catalog-heroes.ts. Previous registries remain intact.
