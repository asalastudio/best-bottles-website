# Build Your Bottle

## Visual target and decisions

The supplied September 5 screenshot is the primary build target: bottle-body tiles,
a large neutral preview, gold selection states, and a persistent summary. The written
brief governs behavior and product truth; sample sizes, prices, and fitments in the
mockup are illustrative, not catalog data.

| Decision | Source | Application |
| --- | --- | --- |
| Three columns on desktop; stacked mobile with sticky action | User screenshot and brief | Options / preview / summary; mobile preview precedes options |
| EB Garamond + Inter, bone canvas, gold actions | Existing Best Bottles tokens and screenshot | Preserve site typography; gold reserved for selection and purchase controls |
| Flat cards and narrow borders | Refero Peak Design style, 374af946-0972-40c3-a888-2700c29b3d5f | Product hierarchy without decorative elevation |
| Real isolated product layers, no decorative overlays | Refero Palmer style, 66430c0f-bed3-4ff7-a16c-4e742e9e7f19 | Imagery supplies detail, fixed preview canvas |
| Focus rings, numeric input, mobile touch sizing | Refero craft-details | Keyboard and touch controls, labeled quantity |
| Progressive selections and post-add choices | User brief | Bottle → Color → Fitment (contextual cap/finish) → Review |

## Order and media contract

The matrix contains assembled products, not independently priced bare bodies. The
builder resolves a selection to exactly one existing orderable assembly SKU. It adds
one cart line for that assembly, never an assembly plus a second loose component.

Source records come from the existing `matrix.getFamilyRows` compatibility resolver.
Unknown compatibility, unavailable products, missing price/checkout identity, missing
or mismatched kits, ambiguous selection tuples, and unseparated fitment bodies are
excluded. A `capSplit` kit is accepted for a screw-cap-only assembly; other assemblies
need `full` kits with independently registered mechanisms. Kit SKU, color, capacity,
canvas, anchors and source derivation are checked. A staged body/fitment/cap always
uses parts from one exact kit; layers from different SKUs are never composed together.
The 5.5 ml short Cylinder import remains excluded pending identity reconciliation.

The existing rule is a $50 order minimum, not a unit MOQ or case-pack multiple. Case
quantity is informational and can fill the quantity input. Already-orderable cart
items count toward the minimum. The total uses the shared checkout-price policy.
A read-only server preflight refreshes compatibility, kit and price before adding.
Checkout continues through the existing cart, which owns the Shopify handoff.

## Backend and data boundaries

No Convex, Shopify, Sanity, or image-store mutations or deployments are required.
Existing read-only kit queries use bounded concurrency and a five-minute Next cache.
Cart preflight bypasses that kit cache. First uncached family loads are slower than
subsequent visits because the existing API exposes kits one SKU at a time. A future
bulk Convex read can remove this cost after a separately reviewed backend deployment.

## Local acceptance

- TypeScript and targeted ESLint pass. All 30 builder, compatibility and analytics tests pass.
- Desktop: 9 ml / 17-415 → Amber → Metal Roller → Shiny Gold Cap resolves to
  `GB-CYL-AMB-9ML-MRL-SGLD`. The $0.74 price requires 68 units for $50.32.
  Adding creates one exact configured cart line and automatically resets the
  selections to Step 1. A confirmation above the chooser offers Build Another Bottle,
  Go to Checkout, and Continue Shopping. The same 68-unit line survived a page refresh.
  The QA line was removed afterward, returning the previously empty cart to empty.
- Mobile at 390 × 844: stacked layout, sticky preview, sticky step/cart action above
  the existing mobile navigation, and no horizontal overflow. Below-minimum review
  displays 56 more units needed and disables Add to Cart.
- Changing the completed amber 9 ml build to 5 ml clears the unavailable amber,
  fitment and closure; only Clear and Cobalt Blue are offered for that body.
- User-requested chooser proportions: 9 ml / 17-415 uses 84% of the default visual
  size, 9 ml / 13-415 uses 68%, and 5 ml uses 56%, with aligned baselines. These are
  visual cues, not an assertion of physical dimensions; the registered layers remain intact.
- Current eligible Cylinder data yields six body choices. Unmapped or inadequately
  separated assets remain excluded; this is not a full-catalog media certification.
- This acceptance covers the local frontend and cart preflight. No production or
  backend deployment, Shopify checkout submission, or image publication was performed.

## PR build corrections

The first CI run caught a finder-navigation assertion still expecting the previous
Build a Bottle label. It now verifies a single `/matrix` link labeled Build Your Bottle.
Vercel compiled successfully but was killed with exit 137 during TypeScript checking;
its build report explicitly recorded an out-of-memory event. The Sentry Webpack hook
disables Next's default build worker, so the configuration now enables that worker
explicitly to release compilation memory before type checking. TypeScript build
validation remains enabled. The full local suite passes 1,071 tests with 7 skipped.
