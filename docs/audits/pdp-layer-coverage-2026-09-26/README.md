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

## Image and Builder follow-up

The [background-issues.csv](background-issues.csv) checks the live image URLs for all 226 flat fallbacks. The catalog URLs returned HTTP 404 for 86 SKUs; 129 had opaque white edges, three had transparent edges, one had a bone edge, six were mixed, and one was absent. An exact `productPlates` image exists for 133 SKUs, but 123 have opaque white edges and ten have bone edges. Swapping to an exact plate alone therefore does not remove the white square. These are edge checks, not a glass-matte quality approval.

The [builder-eligibility.csv](builder-eligibility.csv) joins the same 226 SKUs to current matrix rules. All 226 are present in the matrix; only 61 Glass Bottle variants pass the Builder's current component and sellability checks. Of those, 57 already have an exact reviewed transparent raw-body cutout. The other 165 must not be offered in Build Your Bottle merely because they have a product page: their component association or product class has not passed those rules. Of the 61 eligible variants, 41 have an exact flat plate, all with white edges, and 20 have no exact plate. A correct assembled preview still needs an approved kit or a reviewed exact assembled image.

The local PDP change uses released exact-SKU hero media, then an exact plate, then the SKU's catalog image, then a historical exact-SKU hero, and retries if an image URL fails. Of the 86 broken catalog URLs, 85 have a valid exact plate; the remaining Glass Jar has a historical exact-SKU hero candidate. It never borrows another finish's group photo. If every exact assembled source fails, it can show a labeled reviewed uncapped body from the same `bodies.generated.json` source Build Your Bottle uses. This improves retrieval without asserting that the remaining flat photos are transparent or that unverified SKUs have complete component layers. The frosted Elegant matte-gold register composition is a separate local fix; neither change was deployed by this audit.
