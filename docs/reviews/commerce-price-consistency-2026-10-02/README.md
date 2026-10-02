# Purchase pricing and abandoned checkout recovery

## Reproduced failure and source

SKU `GBElg15MtlRollSlSh` (15 ml Clear Elegant, metal roller, shiny silver): the redesigned PDP advertised 60 × $0.84 = $50.40; the shared cart charged 60 × $0.88 = $52.80.

The [exact legacy PDP](https://www.bestbottles.com/product/elegant-design-15-ml-glass-bottle-metal-roller-ball-plug-shiny-silver-cap), read without a cart/session on 2026-10-02, publishes unit rates of $0.88 at 1, $0.84 at 12, $0.79 at 144, $0.75 at 288 and $0.69 at 1,440. These match the repository's July tier snapshot and August site-truth scrape. `convex/pricing.ts` documents legacy as the source of the imported ladder.

The legacy pack totals have more precision than the displayed rounded unit rates (for example, 12 pieces costs $10.03 there, rather than 12 × $0.84). This change does not reinterpret those pack totals or introduce a checkout discount.

## Cause and correction

`volumePricing.ts` intentionally keeps volume tiers quote-only until `NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT=true` is backed by verified Shopify support. The redesigned PDP's `unitPriceAt`, its “In this order” panel, and the catalog purchase card bypassed that policy and advertised quote rates as purchase totals. `CartProvider` used the charged-price resolver, producing the visible jump.

PDP and catalog purchase prices now use the same resolver as the cart. Published tiers remain visible, with unhonored rates labeled “by quote.” The PDP order panel uses the real cart line price. Restoring a saved cart reapplies the current policy. Under the current flat-price policy, quantity 60 consistently displays $0.88/set and $52.80 before taxes/shipping. The existing flag is not enabled or otherwise changed.

The checkout endpoint resolves verified Shopify variants and prices server-side, checks the $50 merchandise minimum, and sends variant IDs/quantities to Shopify. Anonymous Storefront Cart/permalink and wholesale draft-order paths do not consume browser price overrides. No checkout-price mutation is introduced.

Separately, `CartProvider` cleared localStorage on `pagehide` during the Shopify redirect. Page departure is not a successful purchase. The cart now survives that handoff, and returning via browser Back resets the redirect state. Without a trusted paid-order callback, completed purchases also leave this local cart until the shopper removes/clears its lines; automatic post-payment reconciliation remains outside this fix.

## Catalog to PDP approved-cap selection

Parent QA additionally reproduced `GBSqr15CuSht` (Short Matte Copper, $0.60) in catalog quick-add, while its 15 ml Clear Square open-mouth PDP selected `GBSqr15BlkSht` ($0.44) instead. The existing Abbas/ASA-195 restriction in `group-variant-intent.ts` permits only `GBSqr15WhtSht`, `GBSqr15BlkSht`, `GBSqr15Gl`, and `GBSqr15Sl` for that open-mouth group.

Catalog server and fallback results now reuse the PDP's product-integrity and group-intent filters before constructing swatches or purchase options. A rejected primary SKU is replaced by an eligible row from that same group. The explicit Square allowlist no longer fails open when a partial response contains no approved cap. Spray and roll-on siblings retain their own existing rules. No physical compatibility is inferred, no new finish is approved, and no catalog records are mutated.

Regression coverage checks both server and fallback catalog paths, the quick-add option set, deep-linked SKU/price agreement with the PDP, and the unapproved-only partial-response case. This is a separate compatibility correction within the same frontend commerce release.

## Separate stock issue

Parent live QA reported Shopify proposing to reduce this SKU from 60 to 50. This is an inventory/availability issue, not evidence for a different price. No stock fields, availability settings, live products, or quantities are changed by this fix. Automated checkout coverage asserts that requested quantities reach the checkout resolver unchanged.

## Release sequence

1. Review the scoped draft PR and its checks; parent coordinates promotion with the other audit fixes.
2. Merge only this scoped change once ready, then use the normal frontend release workflow. No Convex deployment, migration, Shopify setting change, price sync, or tier flag change is required.
3. On the frontend preview/release, verify the exact SKU at quantity 60, the published quote labels, PDP/cart totals, and Back/reload after a checkout handoff. Keep inventory warnings visible. Do not complete an order.
4. Roll back by reverting this PR's code commit and redeploying the prior frontend. There are no data changes to undo.

## Automated coverage

- Exact-SKU tier boundary fixtures cover 1/11/12/13/60/143/144/145/287/288/289/1439/1440/1441, with the checkout flag both off and on.
- Real PDP + CartProvider + cart-page tests cover the quantity-60 unit/CTA/sticky/order totals, 6+6 merged additions, upward/downward quantity edits, stored-price normalization, and checkout departure/Back/remount recovery.
- Checkout endpoint tests cover the $49.28/$50.16 minimum boundary at 56/57 pieces and the requested 60 pieces. Browser-supplied quote rates cannot override Shopify prices.
- The new DOM regressions were verified failing against the unchanged production files, including the lost cart on pagehide, then passing with the fix.

Final local checks:

- `node node_modules/typescript/bin/tsc --noEmit`: passed (also `npx tsc --noEmit` and non-incremental typecheck passed).
- `npm run lint`: passed with 0 errors and 87 existing warnings. ESLint on all changed source/test files passed with no warnings.
- `npx vitest run --maxWorkers=2`: 302 files passed, 2 skipped; 2,756 tests passed, 7 skipped. The initial unconstrained run had four mobile DOM timing failures which passed in isolation and in this complete rerun; the fifth initial failure was an obsolete quote-label expectation updated with the fix.
- `npx vitest run tests/pdp-cart-price-consistency.test.tsx tests/purchase-price-policy.test.ts tests/checkout-minimum.test.ts tests/catalog-server-sanitization.test.ts`: final focused rerun, 45 passed.
- Production build: `npm run build -- --webpack`, with the same placeholder public configuration as `.github/workflows/ci.yml`: passed. Generated placeholder sitemap/robots/Next environment outputs were removed from the diff. Expected missing OpenAI-key and placeholder Convex connection warnings do not require live credentials for this build.
- `git diff --check`: passed.

Live hosted checkout totals and inventory remain governed by Shopify; no real order or live data mutation was used for these tests. Preview/hosted-browser verification remains a parent release step.

## Separate route/indexing follow-up assessed

The late soft-404 report is corroborated by the code: `products/[slug]/page.tsx` only calls `notFound()` for explicit source holds, then proceeds after a null product lookup; `server-sitemap.xml/route.ts` publishes every returned group slug using raw interpolation. The safe follow-up is a tested server-side missing-product/invalid-route guard and shared sitemap eligibility/URL encoding. Keep it separate from these tested commerce fixes. The malformed Pillar route's canonical destination must be validated independently; this PR does not guess the 13-415 versus 17-415 mapping or rename products.
