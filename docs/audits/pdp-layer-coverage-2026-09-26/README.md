# Product-page layer coverage — 26 September 2026

Read-only production Convex audit of 2,272 current bottle-related variants with a product group. The CSV lists every SKU whose product page has neither a renderable component-register kit nor a published legacy kit and therefore falls back to a flat product image.

| Coverage | Variants |
| --- | ---: |
| Shared register kit | 1,767 |
| Published legacy kit | 279 |
| Flat-image fallback | 226 |

Of the 226 fallbacks, 186 are Glass Bottle variants. The remaining 40 are Metal Atomizer (21), Aluminum Bottle (7), Plastic Bottle (7), and Glass Jar (5); these own-class products need individual presentation review before anyone treats a missing layered kit as a catalog defect. The frosted 15 ml Elegant matte-gold sprayer (`GBElgFrst15SpryGlMatt`) is a confirmed gap: its source frosted body and matte-gold sprayer are registered separately, but its exact assembly is absent.

The [flat-image-fallbacks.csv](flat-image-fallbacks.csv) is the repair queue. `registerReason` states whether the SKU is absent, quarantined, unresolved by neck rule, or held because its images are unapproved. A row marked as fallback may still have a usable flattened product photo. This audit checks layer presence and approval in Convex; it does not certify visual alignment or every image URL's HTTP response. Re-run `scripts/audit-pdp-layer-coverage.mjs` against the production public Convex URL after each register release.

The audit also checks that layered fine-mist and roller builds include a removable cap or overcap for the sidecar. None of the 2,046 layered builds failed that check in this run. [layer-issues.csv](layer-issues.csv) combines flat-image fallbacks with any future incomplete layered kits.
