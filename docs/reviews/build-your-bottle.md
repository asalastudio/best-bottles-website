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
| Progressive selections and post-add choices | User brief | Bottle → Glass → Fitment (contextual cap/finish) → Review |

## Order and media contract

The matrix contains assembled products, not independently priced bare bodies. The
builder resolves a selection to exactly one existing orderable assembly SKU. It adds
one cart line for that assembly, never an assembly plus a second loose component.

Source records come from the existing `matrix.getFamilyRows` compatibility resolver.
Unknown compatibility, unavailable products, missing price/checkout identity and
ambiguous selection tuples are excluded. The selected assembly must match one active
component in the matrix by component type, neck and exact finish token. Retired
component identifiers are excluded. A matching neck alone is not eligibility.

Step 1 requires a verified bare body. Complete product photographs never substitute
for that body. Circle uses reviewed original PSD body layers for 15/30/50/100 ml
Clear and 50/100 ml Frosted. A local exact-SKU transparent assembly is also required
for those Circle configurations. Other families require valid published kits.
The unresolved decorative 30 ml Cylinder atomizer is excluded.

For layered previews, a `capSplit` kit is accepted for a screw-cap-only assembly;
other assemblies need `full` kits with independently registered mechanisms. Kit
SKU, color, capacity, canvas, anchors and source derivation are checked. A staged
body/fitment/cap always uses parts from one exact kit; layers from different SKUs
are never composed together.
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

## Earlier local acceptance (before the September 6 correction)

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

## September 6 bare-body correction — local, unpublished

Customer-facing flow: **Bottle → Glass → Fitment → Review**. The second heading is
“Choose your glass,” covering glass colors and finishes. The chooser is restricted
to the selected family and shows each available physical body once. Current live
eligible media yields Cylinder and Circle; other families are not represented with
preassembled stand-in photos while their bare layers remain unverified.

Circle has four body choices: 15 ml / 13-415, 30 ml / 15-415, 50 ml / 18-415 and
100 ml / 18-415. The stray 50 ml / 18-400 import has no reviewed body source and is
excluded. Six original bare-body exports include Clear and Frosted variants.
129 exact-SKU foreground assembly images were extracted and visually reviewed.
Source paths, hashes and layer evidence are recorded in the Circle source-review
JSON files under `data/paper-doll/`. All assets are local static files. No artwork
was generated, no bottle geometry was stretched, and no backend media was published.

The export uses exact master basenames, preserves source coordinates, removes the
background layer, and uniformly scales the output. Eight frosted 50 ml sources use
the verified capped view instead of the uncapped alternate. Two black dotted-cap
sources contain disconnected white retouch patches; only the cap island is retained
at its original position. The copper 15 ml spray source contains a grouped body and
needs additional source review; that assembly is excluded rather than substituting
another SKU or showing a misleading finished preview.

Fitments use a two-column grid with larger component imagery and finish counts.
Finish tiles use isolated cap layers or component photos. Assembled bottle photos
never appear inside those tiles. The central Circle preview stays bare until a
complete finish is selected, then shows that exact transparent assembly. Cylinder
retains its registered layer-by-layer preview.

Current chooser scales are 5 ml 52%, 9 ml / 13-415 84%, 9 ml / 17-415 68%, 25 ml
90%, 50 ml 106%, and 100 ml 124%. Circle scales graduate from 68% to 100%.
These are visual cues, not physical measurements, and preserve image proportions.

Validation: full local suite passed 1,076 tests with 7 skipped; targeted builder and
cap-photo tests passed after the final media eligibility change (30 tests).
TypeScript and targeted ESLint pass. Browser checks confirmed four bare Circle
choices, Clear/Frosted glass options, actual component finish tiles and an empty
initial preview. The local Circle cart preflight and Cylinder route are checked
separately. No PR push, production deployment or Shopify checkout was performed.
