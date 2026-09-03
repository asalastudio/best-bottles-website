# Task 14 — Focused PDP rollout

Base: `45c2e284`

## Capability truth table

`resolveFocusedPdpCapabilities` is pure and consumes only these real readiness
fields: `hasVariants`, `hasApprovedPhoto`, `hasPlate`, `hasApproved3d`,
`hasReleasedKit`, and `hasDimensions`. It has no family or SKU allowlist.

| Group truth | Focused shell | Purchase | Available stage modes |
| --- | --- | --- | --- |
| Real variants + approved photo or plate | Yes | Yes | Photo plus only approved optional modes |
| Real variants + photo/plate, no 3D or released kit | Yes | Yes | Photo only (and Dimensions when real data exists) |
| Real variants, no approved visual | No shell fallback, page remains visible | Yes | Existing truthful gallery/placeholder path |
| Empty or invalid group | No | No | None |

The 9 mL Clear Cylinder 17-415 Roll-On is covered only as an acceptance fixture.
It does not affect eligibility. Diva 46 stays photo-only because its approved
geometry field is false; both geometry and released-kit availability are passed
through the capability gate from the exact selected-SKU kit record.

## Route and redirect audit

- Canonical direct PDP and SKU URLs resolve without finder state.
- The historical `/products/cylinder-9ml-17-415` cohort URL now redirects via
  the common legacy override map to
  `/products/cylinder-9ml-clear-17-415-rollon`, preserving query parameters.
- Existing Diva, 5 mL, 9 mL drift, and vial aliases remain redirect-only
  compatibility routes.
- The product page no longer owns the retired cohort special case.

## Optional media and transaction audit

- A real group is never hidden solely because 3D, a kit, dimensions, or even
  approved primary media is unavailable.
- Eligible photo/plate groups use the shared stage/purchase shell. Optional
  modes are omitted rather than rendered as placeholders.
- The focused purchase panel still reads its price, availability, SKU, cart
  truth, and compatible-component query from the exact selected variant.
- Protected `componentPhotoSkuBelongsToBase`, `photoKeysForVariant`, and
  `resolveCapOptionPhoto` behavior passed their regression suites unchanged.

## Dead-code and accessibility cleanup

- Removed the unreferenced `UnifiedBottlePdp` and `BottleConfigurator` UI,
  retired builder URL helpers, and unified-only view/query/readiness helpers.
  The retained configuration-selection helper is still used by Grace.
- Replaced stale layout source-marker tests with rendered mobile shell behavior:
  a 390px-contained six-control rail, no horizontal escape, 44px controls,
  preserved 10:11 stage ratio, and stage-before-purchase composition.
- Changed the stage-mode dock from incomplete ARIA tabs to accurate
  pressed-button semantics, preserving 44px targets, focus styling, and
  reduced-motion behavior.
- Removed the stale fitment-drawer comment and synchronized the stale Mizan
  assertions with the Task 10 discovery/fitment architecture.
- Hardened `safePdpReturnPath` against protocol-relative, backslash, and
  absolute-URL escapes with regression coverage.

## RED → GREEN evidence

RED:

- `tests/focused-pdp-rollout.test.ts` initially failed because the capability
  resolver did not exist.
- The ARIA test failed against the old `tablist`/`tab` markup.
- The return-path test failed because the helper was not exported or hardened.
- The redirect/dead-builder tests failed against the retained cohort route and
  UI files.

GREEN:

- Task 14 focused, purchase/discovery, layout/mode, and protected-image suite:
  **13 files, 96 tests passed**.
- Full verification: **118 files, 846 tests passed; 2 live suites skipped
  (7 skipped tests)**.
- `npx tsc --noEmit --pretty false` passed.
- Changed-file ESLint passed.
- `git diff --check` passed.

## Constraints and concerns

- No network calls, Convex CLI/deploy/data actions, inventory or image
  regeneration, or legacy PSD path changes were performed.
- The full test run prints expected mocked knowledge-provider and missing
  Sentry-secret diagnostics; it exits successfully.
- `git diff --name-only 45c2e284 | rg 'data/.+(inventory|selection|xref)|legacy.+PSD|BB-PSD'`
  returned no matches.

## Fix round 1 (base `ba8f8351`)

### Grace navigation and retired-builder cleanup

- Removed `setPaperDollSelection` from Grace's realtime schema, policy registry,
  provider implementation, session context, audit stubs, and live audit
  manifests. The obsolete controller and its focused unit test were deleted.
- Grace now states one navigation rule: broad or ambiguous shopping requests go
  to the focused finder; an exact verified product/configuration goes only to
  its canonical PDP with its stored website SKU when present (otherwise its
  verified Grace SKU). It does not dispatch through aliases or a builder.
- Added regression coverage proving no customer-facing Grace tool, provider
  path, or instruction advertises the retired flow.

### Selected-SKU capability truth and fallbacks

- The PDP alone queries `productKits.forSku` for the exact selected variant and
  supplies that one result to `ConfiguratorPdp`. `hasReleasedKit` and Exploded
  mode now share that field-driven result; a pending query remains non-negative
  and does not hide the shell. The 9 mL released-kit fixture enables Exploded;
  a no-kit group remains photo-only.
- An empty or invalid filtered group now exits to an unavailable/Ask Grace
  recovery surface before any quantity, cart, quote, or sticky purchase markup.
  A real variant with no optional media remains purchasable.

### Mobile and redirect regressions

- Replaced the fabricated 390px rail fixture with rendered `ConfiguratorPdp`
  purchase surfaces, mocking only Convex/three data hooks. The DOM regression
  instruments the actual rail's `clientWidth`/`scrollWidth` and proves overflow
  is contained there rather than the 390px page; it also covers stage, selected
  variant controls, price, quantity, primary CTA, and 44px touch targets.
  Browser-level physical layout remains Task 15 scope.
- Added page-source redirect coverage for preserving an alias URL query into the
  canonical PDP and proving the canonical destination has no further override.

### Fix-round RED → GREEN and verification

RED: schema/registry/provider tests failed against the old paper-doll tool;
the selected-kit and 390px surface assertions failed before wiring/mocking; the
purchasability recovery assertion failed before the early return.

GREEN:

- Focused Grace/PDP/protected suites: **10 files, 50 tests passed**.
- Full Vitest: **119 files, 847 tests passed; 2 live files / 7 tests skipped**.
- `npx tsc --noEmit` and `git diff --check` passed.
- No network, Convex CLI/deploy/data action, media regeneration, or PSD-path
  change occurred.

## Fix round 2 (base `5dd6dead`)

### Customer/editor terminology and Grace navigation

- Replaced Catalog Cylinder copy that advertised a Paper Doll builder with a
  focused product-page callout. Kept the existing `featuredCohortSlug` storage
  key for content compatibility, but renamed its Studio title and description
  to canonical focused PDP terminology. Internal Paper Doll media records stay
  named for the asset pipeline; their editorial descriptions now reference the
  focused PDP stage rather than a builder.
- `resolveGraceRecommendationHref` is now production truth for exact results:
  it canonicalizes legacy group aliases, requires a verified stored SKU, and
  emits `/products/<canonical>?sku=<websiteSku|graceSku>`. Broad or ambiguous
  results still use the finder path. The generic navigation validation path now
  canonicalizes aliases and uses the same resolver when a verified direct hit
  is found.
- Extracted the operative server redirect target into `pdp-redirect.ts`; page
  routing uses it, and tests verify SKU/query preservation and no canonical
  loop without relying on client source text.

### Exact selected-SKU kits and mobile containment

- Added `resolveSelectedSkuKit`: stage capability accepts a kit only when its
  stored `sku` matches the selected website or Grace SKU. `ProductDetailClient`
  and `ConfiguratorPdp` both consume it. A pending B query clears A's parts and
  never advertises Exploded; the requested Exploded intent remains available
  for a later exact B kit and falls back honestly when B has none.
- The real 390px Configurator DOM test now instruments rail, root container,
  and document widths. It proves only the closure rail overflows; page/root
  remain at or below 390px with real stage, controls, quantity, and CTA.

### Fix-round 2 RED → GREEN and verification

RED: exact-Grace-SKU, alias canonicalization, pure server redirect, selected
kit transition, mobile root-overflow, and retired-language regressions failed
against `5dd6dead`.

GREEN:

- Focused Grace/PDP/protected suites: **10 files, 45 tests passed**.
- Full Vitest: **122 files, 851 tests passed; 2 live files / 7 tests skipped**.
- `npx tsc --noEmit`, changed-file ESLint, and `git diff --check` passed.
- Safety audit found no inventory/selection/xref or legacy PSD path change; no
  network, Convex CLI/deploy/data action, or media regeneration occurred.

## Fix round 3 (base `5582b720`)

### Exact Grace PDP verification

- Added production `resolveVerifiedGracePdpHref`, used by Grace's generic PDP
  navigation path after `getProductGroup`. It accepts a destination only when
  the requested SKU exactly matches a stored website or Grace SKU in that exact
  group's variants, then rebuilds the canonical URL through
  `resolveGraceRecommendationHref`.
- Canonical PDP routes with no SKU, wrong SKU, or an ambiguous/broad request
  now fall back to the focused finder. Legacy aliases remain canonicalized
  before verification. Regression coverage includes canonical/no-SKU rejection,
  wrong-SKU rejection, exact stored-SKU acceptance, and alias acceptance.

### Synchronous selected-kit transition safety

- `ProductDetailClient` now passes raw kit-query state to the stage so pending
  (`undefined`) remains distinct from resolved no-kit (`null`). The stage keeps
  a decoded `{ sku, parts }` record and synchronously renders it only when its
  SKU equals the current selected kit. This prevents an A layer from painting
  during B's first pending render, while preserving requested Exploded intent
  until an exact B kit arrives.
- A DOM transition test covers A-kit → B-pending → B-kit and B-no-kit: pending
  and no-kit show B's plate without A/B stale parts or Exploded; only exact B
  restores the mode.

### Real focused-shell mobile measurement

- Replaced echoed root width properties with a test-only deterministic geometry
  shim over the mounted `.focused-pdp-shell` tree. It derives inherited widths
  from actual node classes/styles, excludes the rail's contained overflow, and
  proves an intentionally widened shell fails the 390px page/root/shell check.

### Fix-round 3 RED → GREEN and verification

RED: verified-PDP helper expectations and the A→B actual DOM transition failed
before the new validation and synchronous SKU render gate.

GREEN:

- Focused Grace/PDP/protected suites: **9 files, 46 tests passed**.
- Full Vitest: **122 files, 853 tests passed; 2 live files / 7 tests skipped**.
- `npx tsc --noEmit`, changed-file ESLint, and `git diff --check` passed.
- Safety scan found no inventory/selection/xref or legacy PSD path change; no
  network, Convex CLI/deploy/data action, or media generation occurred.
