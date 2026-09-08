# Mobile family catalog review

Implemented on `codex/mobile-family-catalog`, based on main after builder PR #107. This is a separate presentation change for `/catalog/[family]` and mobile homepage family cards.

Mobile family pages now open with the existing product listings: title, results count, compact filters, and a two-column grid. Introductory copy and existing lifestyle photography live in an expandable About section after the listings. The shipping announcement scrolls with the page. Navigation, search, cart and Grace remain available. The secondary builder link carries the selected family.

The filter panel exposes the existing size, glass, application and neck facets, with roller material when appropriate. Applying a draft preserves unrelated URL filters; cancelling leaves results unchanged. Active chips can be removed individually. Finish remains a product-page choice because the existing catalog API has no finish facet. No product records, schemas, pricing, compatibility, image assets/mappings, builder configuration, or cart requests were changed.

Desktop retains its existing introduction, application choices, result expansion and product cards. The existing 1024px family layout breakpoint bounds the mobile presentation. Cards use the same component and exact product links on both layouts.

## Captures

| Surface | Before | After |
| --- | --- | --- |
| Cylinder, 390 × 844 | [Before](before-cylinder.png) | [After](after-cylinder.png) |
| Desktop, 1440 × 1000 | [Before](before-desktop.png) | [After](after-desktop.png) |

[Mobile filter panel](filters.png) · [Filtered Cylinder results](filtered-cylinder.png)

## Verification

- Automated local Chrome followed homepage Shop Cylinder into the catalog. All 51 mobile product links matched desktop exactly, including SKU and return-context parameters.
- First two product images visible on arrival at widths 320, 375, 390 and 430 CSS px. At 390 × 844, images occupy y=300–492; the complete first row of cards also fits before the bottom navigation.
- Size + glass + roller filters, reload, individual chip removal, empty-result recovery, Circle product loading, and family-preserving builder links passed.
- Filter dialog closes with Escape and restores trigger focus. Automated axe WCAG A/AA checks found no violations in the changed catalog or filter dialog.
- No horizontal page overflow at those widths, in 844 × 390 landscape, or with an enlarged root font at 320px. No browser exceptions in the checked flow.
- 1,524 unit tests passed; 7 existing tests skipped. Includes five new filter-state regressions and a Webpack CSS-module compilation regression. Desktop tests explicitly target desktop controls now that both responsive presentations exist.
- Production build passed using Vercel's Webpack build command with backend deployment explicitly disabled. The local Cylinder route returned HTTP 200 after verification.
- TypeScript passed. Repository lint passed with 50 existing warnings and no errors.

The reproducible browser script and measurements are [verify-mobile.mjs](verify-mobile.mjs) and [verification.json](verification.json). Run from the repository root with `node docs/reviews/mobile-family-catalog/verify-mobile.mjs`; optionally set `PREVIEW_URL` and `CHROME_PATH`.

## Limits

Browser checks used desktop Chrome's mobile viewport emulation, not physical Safari/Chrome devices or VoiceOver. Enlarged-root-font reflow is a useful check, not a replacement for physical-device text resizing. Purchasing and cart services were reused without modification; no checkout/order was submitted. No production deployment is included.

## PR #109 deployment repair

The initial Vercel Preview failed because Webpack rejects global-only selectors in CSS modules. The earlier local and CI builds used Turbopack and did not enforce that check. Mobile header styles now attach through a local CSS-module class. A regression test uses Next's bundled CSS-module purity plugin; it reproduced the original error before the fix and passes after it. CI now uses `npm run build -- --webpack`, matching Vercel's compiler. No backend or environment configuration was changed.
