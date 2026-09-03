# Task 10 Report — PDP discovery sections

Base commit: `5df82c67`

## Plan and critique

1. Render the focused relation model as exactly three distinct lower-PDP buying
   sections: size alternatives, alternate dispensing intents, and fitment-resolved
   components.
2. Retain the server-loaded compatibility payload while the selected SKU's client
   query is pending, then use the resolved selected-SKU result rather than a
   display-name, color, or locally inferred fitment match.
3. Put existing editorial and specification content after those decisions, with
   the Build a Bottle matrix escape hatch last.
4. Remove the legacy in-buy-box cross-application list so alternate product
   intents and compatible parts cannot be conflated.

Critique/ruling: Task 9's selected variant remains the source of the selected
website SKU, price, media, and purchase CTA. Task 10 only reads that identity
for a new fitment refresh; it does not alter canonical navigation, stage media,
or purchase-panel selection.

## RED → GREEN evidence

RED, after adding `tests/pdp-discovery-sections.test.ts` before any discovery
component existed:

```text
npx vitest run tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts

FAIL tests/pdp-discovery-sections.test.ts
Error: Cannot find module '@/components/products/PdpDiscoverySections'
```

The already implemented relation and fitment-resolver parity suites passed. A
second focused RED exposed the missing ordered composition export before the
matrix-tail behavior was added. The production component was then implemented
and refactored to keep the page composition explicit without a test-only API.

GREEN:

```text
npx vitest run tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts tests/product-image-fallback.test.ts

Test Files  4 passed (4)
Tests       23 passed (23)

npx tsc --noEmit --pretty false
Exit 0

npx eslint src/components/products/PdpDiscoverySections.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' tests/pdp-discovery-sections.test.ts
Exit 0

git diff --check
Exit 0
```

## Data-flow and truth audit

- Sizes and alternate dispensing cards consume only `FocusedPdpRelations`.
  They do not contain a family/applicator inventory list or a color/display-name
  closure lookup.
- The server-provided compatibility result is used immediately. `useQuery` then
  calls `api.grace.getBottleComponents` again with the currently selected
  website SKU (falling back to the selected Grace SKU only when website identity
  is absent). While that query is `undefined`, the server result stays visible;
  it is not cleared into a blank rail.
- Components come directly from that fitment-resolved payload. Every card shows
  website SKU when present plus Grace SKU, approved `imageUrl` or the honest
  “Media preparation in progress” fallback, stock/lead-time state, unit price,
  and the real `isCheckoutReady` cart versus quote result.
- An absent/empty fitment result is explicitly called unmapped and offers Grace;
  it never claims that an empty result means no parts fit.
- Alternative application text uses “Also available as”; component cards use
  “Compatible with this bottle.” Neither discovery surface uses “comes with.”
- The matrix link is `/matrix?family=<encodeURIComponent(canonical family)>`.
  It remains after the three decision sections and the existing editorial and
  specifications. The legacy `This bottle also takes` rail, its stale drawer
  state, and its duplicate cross-application cards were removed.

## Files

- `src/components/products/PdpDiscoverySections.tsx` — reusable discovery UI,
  selected-SKU compatibility refresh, truthful component cards, unmapped state,
  and matrix action.
- `src/app/products/[slug]/ProductDetailClient.tsx` — wires selected SKU and
  server models into discovery, adds real component cart data, places discovery
  before lower editorial/specification content, and removes the legacy rail.
- `tests/pdp-discovery-sections.test.ts` — order, vocabulary, SKU/media/
  availability/price/cart-or-quote truth, unmapped Grace recovery, and
  no-blank-refresh coverage.

## Constraints and concerns

- No network calls, Convex CLI/deploy/data actions, production writes, or
  inventory/image generation were used.
- Task 8 shell and Task 9 selected-SKU/canonical purchase behavior are
  untouched. Protected photo helpers remain unchanged.
- The focused tests render the real discovery components with hand-checked
  relation and fitment fixtures. Interactive browser coverage remains outside
  the required command set.

## Fix round 1 — lower-page order and fitment truth

Base reviewed: `1846d8d0`.

### RED

Added two regressions to `tests/pdp-discovery-sections.test.ts` against the
real `ProductDetailClient` composition boundary, not a synthetic wrapper.

```text
npx vitest run tests/pdp-discovery-sections.test.ts

FAIL places the real PDP's lower content in the binding buying order
Expected lower-page volume/fulfillment marker after Specifications; received -1.

FAIL keeps fitment claims out of the legacy sibling-derived buy-panel summary
ProductDetailClient still contained ProductConfidenceSummary.
```

### Fix

- The actual page now composes: `PdpDiscoverySections` → specifications →
  `pdp-volume-fulfillment` → `PdpEditorialZone` → matrix action.
- The concise selected unit price remains beside the purchase CTA. The fuller
  lower section now presents availability, case quantity, shipping, and the
  real volume-price ladder after technical specifications.
- Removed `ProductConfidenceSummary`, its “Fitment ready” empty state, its
  neck-size-as-fitment copy, sibling-derived related count, and the obsolete
  sibling sorting path. Remaining application siblings only support canonical
  product navigation; they are not used to make a fitment claim.

### GREEN

```text
npx vitest run tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts tests/product-image-fallback.test.ts

Test Files  4 passed (4)
Tests       25 passed (25)

npx tsc --noEmit --pretty false
Exit 0

npx eslint src/components/products/PdpDiscoverySections.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' tests/pdp-discovery-sections.test.ts
Exit 0

git diff --check
Exit 0
```

No network, Convex CLI, deployment, data mutation, production action, or
inventory/media regeneration was performed.
