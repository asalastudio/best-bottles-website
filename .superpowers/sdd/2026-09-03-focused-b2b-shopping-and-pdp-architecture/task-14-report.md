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
geometry field is false; mode availability is passed through the capability
gate, while released-kit state continues to come from the exact selected-SKU
kit record.

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
