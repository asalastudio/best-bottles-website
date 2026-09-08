# Builder loading and SKU correction verification

September 8, 2026. Verification performed before PR publication. No production deployment was performed.

## Loading behavior

- A shared responsive loading screen now appears during initial route navigation and selected-family loading. It uses a gently pulsing outline of the actual Circle 30 ml perfume bottle and tall cap, an indeterminate accent line, and concise preparation copy. Reduced-motion users receive a still illustration. Navigation and cart access remain in the loading shell.
- The selected family is loaded first. Other **validated eligible** families are discovered by a separate read-only request after the selected workspace renders. Failure in background discovery offers Retry without clearing the selected build.
- No kit format, image mapping, catalog schema, price rule, cart request or retirement/publication guard changed.
- Representative local development requests: before 7.68 seconds to finish the streamed response; after 2.27 seconds. These single observations include different compilation/cache states and are not a controlled benchmark or a production speed guarantee. The regression test establishes the important change: requested-family entry does not wait for the all-family kit scan.

## Verification

- The final full suite passed: 1,532 tests, 7 skipped. Targeted coverage includes: selected-family loading, fallback/default entry, discovery failure/retry, exact component joins, original alias/retirement guards, preview registration, mobile navigation/purchase behavior and compatibility matrix tests.
- TypeScript check and scoped ESLint passed. Production `npm run build -- --webpack` passed, including TypeScript and static generation.
- Local mobile browser verified that the Circle workspace renders while other-family discovery is still pending, then receives Circle/Cylinder family options without losing the workspace. No horizontal overflow or page errors.
- Responsive browser checks at 320, 390 and 1440 CSS pixels confirmed Circle-to-Cylinder switching, correct selected family and no horizontal overflow or page errors. Loading screenshots were inspected; reduced-motion styling was checked when the loading screen was present. These are emulated Chrome checks, not physical iPhone certification.
- Current local exact-match checks resolve all four mapped SKUs. Both Cylinder matte-silver lotion-pump configurations returned HTTP 200 from read-only preflight with the same requested SKU. Both Circle cap matches still report media unavailable, correctly preserving the kit requirement. See `local-match-verification.json`.
- Production catalog data was only read. All 102 referenced component records were located, with 21 still blocked by stored commercial state; these were not automatically published.

## Remaining work

Finish and publish the approved kits through their existing branch. Reconcile current Shopify publication intent for the blocked component/assembly records. Recheck the Circle gold cap source stock discrepancy. Then re-run exact-assembly preflight against the intended deployment for all newly available finishes. No production repair or full-catalog purchase clearance is claimed by this local change.

## Screenshots

- [Circle perfume-bottle loading screen](screenshots/loading-mobile.png)
- [Mobile workspace](screenshots/ready-mobile.png)
- [Desktop workspace](screenshots/ready-desktop.png)
