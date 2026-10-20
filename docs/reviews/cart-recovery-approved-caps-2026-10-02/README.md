# Cart recovery and approved Square finishes

This change extracts two independent fixes from held PR #346. It does not change price resolution, tier labels, PDP/cart price presentation, checkout price policy, stock, or live data.

## Causes and corrections

- CartProvider cleared `bb-grace-cart` when navigation to Shopify triggered `pagehide`. Departure does not establish payment. Keep storage and reset redirect state on `pageshow`, including bfcache Back. This deliberately leaves the cart available after payment too; clearing after successful purchase needs a trusted completion signal, which this change does not invent.
- Catalog preview/quick-add data bypassed the PDP's existing assembly and group-intent restrictions. Apply those same predicates to server and fallback catalog results and replace an excluded primary identity with an allowed preview. Keep the existing Square 15 ml open-mouth allowlist closed when a partial response contains only an excluded cap. No new physical compatibility is inferred.
- The approved Square set remains `GBSqr15WhtSht`, `GBSqr15BlkSht`, `GBSqr15Gl`, and `GBSqr15Sl`. `GBSqr15CuSht` is removed from this group's purchase choices instead of linking to a PDP which silently resolves Black Short. Spray and roller groups retain their existing predicates.

## Regression evidence

Before implementation, four new cases failed: checkout departure erased storage; both catalog data paths exposed Copper; and a Copper-only partial response reopened the allowlist. After implementation all six cases in the two focused test files pass. The tests exercise the real CartProvider and redirect lifecycle; only external browser navigation is stubbed. Square tests follow preview SKU links through the actual PDP selection resolver and verify identity/price agreement for each approved choice.

Full suite: `node node_modules/vitest/vitest.mjs run --maxWorkers=2` — 301 files passed, 2 skipped; 2,724 tests passed, 7 skipped. `npm run lint` — zero errors, 87 pre-existing warnings.

## Separate pricing work

The reported Elegant 60-unit mismatch is not solved by this PR. PR #346 is held because its flat-price/quote presentation conflicts with the approved September 25 direction. Tier enforcement at Shopify checkout must be completed separately; no environment flag is flipped here. The separate Shopify stock suggestion to reduce 60 to 50 also remains an inventory issue, not a pricing correction.
