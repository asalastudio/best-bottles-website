# Mobile bottle builder — implementation review

Local branch: `codex/mobile-bottle-builder`, based on main `e3632d24`.
Preview: http://localhost:3001/matrix?family=Cylinder

The mobile presentation uses Bottle → Glass → Fitment → Finish → Review. It shares the existing configuration model, catalog loader, image mappings, quantity/pricing calculation, cart validation API and cart provider with desktop. Fitment uses the approved pencil drawings as requested; Finish and the preview use the existing product assets. No catalog, backend, hero media or pricing files were changed. This review accompanies the mobile redesign feature PR; production deployment and merge are separate release steps.

## Captures

Screenshots are actual 390 × 844 CSS-pixel Chrome renders, not generated mockups. The concept boards normalize the supplied 592 × 1280 images to 390 px wide. Mockup products/counts/prices are illustrative; actual returned data is retained.

| Screen | Before | After | Concept comparison |
| --- | --- | --- | --- |
| Bottle | [Before](before-bottle.png) | [After](after-bottle.png) | [Compare](comparison-bottle.png) |
| Glass | [Before](before-glass.png) | [After](after-glass.png) | [Compare](comparison-glass.png) |
| Fitment | [Before](before-fitment.png) | [After](after-fitment.png) · [Drawings in view](after-fitment-options.png) | [Compare](comparison-fitment.png) |
| Finish | [Before](before-finish.png) | [After](after-finish.png) | [Compare](comparison-finish.png) |
| Review | [Before](before-review.png) | [After](after-review.png) | [Compare](comparison-review.png) |

Additional: [200% text at 320 px](after-review-200-percent.png), [landscape](after-landscape.png), [successful add](after-confirmation.png), [unchanged desktop](after-desktop-matched.png).

The before walkthrough uses a 5 ml Clear Cylinder; the primary after walkthrough uses a 9 ml Frosted Cylinder, 17-415. They demonstrate the same stages, not identical product imagery. Exact purchase comparisons below use identical products and quantities on the unchanged desktop and redesigned mobile views against the same local catalog response. Published production options differed during inspection, so they were not treated as an immutable catalog snapshot.

## Verified

- Full suite: **1,518 passed; 7 skipped**, across 158 passing and 2 skipped files. Six new targeted UI tests cover explicit advancement, valid dependency preservation, invalid dependency explanation, quantity preservation, a valid sub-$50 add, duplicate submission prevention and approved drawing use/reset.
- Production build completed successfully. Final TypeScript check passed. Targeted ESLint has zero errors and one pre-existing unused `startDictation` warning in Navbar.
- Chrome: all five stages, explicit next, heading focus, Back/Edit, Clear-only glass, single-finish selection, reset, case quantity, family refresh, filters and recovery after a failed cart preflight.
- Widths 320, 375, 390 and 430 px: no horizontal overflow, with all ten returned roller caps reachable. At 390 × 844 the first complete bottle row ends at about 497 px. 200% root text at 320 px and landscape 844 × 390 reflow without horizontal overflow.
- Native radio keyboard selection, modal focus containment, Escape dismissal and trigger focus restoration passed. Axe WCAG 2/2.1/2.2 A/AA-tag checks reported zero violations on the changed header and all five builder screens. Visible changed controls met 44 × 44 px.
- Vintage list: nine finishes, six available and three disabled. Last option can scroll above the fixed action bar. Circle shows the returned 15/30/50/100 ml bodies and retains its family through refresh.
- A real one-unit add in an isolated local test cart succeeded at $0.61; confirmation showed $49.39 remaining and offered Build another bottle / View cart. Rapid double taps sent exactly one preflight request. No checkout/order was submitted; no user's existing browser cart was used.
- Desktop spot-check retained the original layout and shared purchase behavior. Hero source files and generated media were not edited.

### Exact purchase parity

Each pair produced equal family, SKU, selection, quantity, unit price and total in the unchanged desktop and new mobile flows. Validation requests were intercepted for these parity tests, so no cart was mutated.

| Configuration, quantity 12 | SKU | Unit | Total |
| --- | --- | --- | --- |
| 5 ml Clear / Metal Roller / Matte Gold Cap | GBCyl5MtlRollGlMatt | $0.61 | $7.32 |
| 9 ml Clear 17-415 / Fine Mist Sprayer / Black | GBCyl9SpryBlk | $0.88 | $10.56 |
| 50 ml Clear / Lotion Pump / Copper | LBCyl50LtnCu | $2.70 | $32.40 |
| 50 ml Clear / Vintage Bulb Sprayer / Black | GBCyl50AnSpBlk | $5.55 | $66.60 |

Raw results: [responsive](browser-results.json), [accessibility](accessibility-results.json), [purchase parity](purchase-parity.json), [filters/families/vintage](additional-results.json). Prices are observations from verification, not hardcoded application data.

## Intentional responsive differences

- Three finish columns at 390 px, four at 430 px, five at 640 px; full option names and all returned choices remain available through normal page scrolling.
- Larger readable controls, retained navigation menu, Start over/help and case-pack controls take more space than the illustrative mockups. Preview height is 220 px in normal portrait and reduced/released in short layouts.
- At 200% text the progress row becomes two rows and the action bar enters document flow. Readability and control access take priority over fixed positioning.
- Existing product geometry, crop registration and image quality are retained. The mockup's generated bottle geometry and prices are not copied.

## Limitations and follow-up

- **Physical iOS Safari, changing browser toolbar, native keyboard and VoiceOver are not verified.** Desktop Chrome emulation and axe are not substitutes for a device-level accessibility signoff. These checks remain before final mobile release approval.
- Existing unfinished-build session restoration/SKU preselection is not implemented in the baseline; family/from links and cart persistence are preserved. No new draft storage was introduced.
- All configurations currently returned by the model require a closure/finish; no finish-free branch is represented. No synthetic “Not applicable” configuration was invented. Existing single-finish auto-selection is preserved.
- Existing media quality/catalog discrepancies and local Clerk development-key warnings were observed and left outside this presentation scope. The application rendered and the cart checks succeeded despite those development warnings.

## Re-run

From the repository root, with `npm run dev -- --port 3001` running:

```sh
npx vitest run tests/mobile-bottle-builder.test.tsx
node docs/reviews/mobile-builder/checks/responsive.mjs
node docs/reviews/mobile-builder/checks/accessibility.mjs
node docs/reviews/mobile-builder/checks/purchase-parity.mjs
node docs/reviews/mobile-builder/checks/filters-and-families.mjs
```

Browser checks require the existing `puppeteer-core` and Chrome (`CHROME_PATH` may override the macOS path). Accessibility checks also require `axe-core`, available in the local dependency tree. The accessibility check creates an isolated one-unit browser cart only; it never checks out. See [baseline inventory](inventory.md).
