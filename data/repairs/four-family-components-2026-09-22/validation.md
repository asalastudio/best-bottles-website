# Validation — 2026-09-22

## Framing follow-up

- 98 targeted tests passed across nine files; the 68 PDP tests were rerun after the final Empire cap-toggle correction and passed.
- The final production Webpack build passed, including TypeScript and all 68 static pages.
- 16 new production-build browser checks passed: four PDPs at 1440 × 900, 1280 × 650 and 390 × 844; plus Circle 100 mL Clear/Frosted × Gold/Matte Silver in Builder. All photo canvases retained 10:11, paired cap toggles kept their zoom, and all four Circle Builder choices measured **224.16 px glass width**. No page errors or broken visible PDP images.
- Mobile Builder reached review at 390 × 844. The final screenshot waits for every SVG image to decode; the bottle and integrated gold hose/tassel are visible. No order submitted.
- Saved-audit bounds checks: **4,128 Builder views** from 688 kitted configurations, and **1,646 PDP cap states** from 823 kits. Zero clipped bounds, zero changing Builder cameras within a body/material, and consistent glass width across all material colors in each body group. Nine local Circle role repairs are applied to this audit. Missing kits and incorrectly classified source layers remain separate work.
- Desktop artwork inventory adds exact-name source candidates for 30 SKUs absent from the earlier master-only match. These candidates still require layer and visual verification.

Evidence: `framing-audit.json`, `framing-browser-checks.json`, `framing-test-results.txt`, `mobile-builder-check.json`, and `desktop-artwork-inventory.json`. See the README for the distinction between safe display framing and completed source/component repairs.

## Initial component repair batch

- **210 tests passed in 20 files**, covering the repair transaction, PDP framing, mobile PDP models, Builder selection, source links, payloads and component registration. Full output: `test-results.txt`.
- **TypeScript and production Webpack build passed**. Final build compiled successfully in 44 seconds, completed TypeScript in 28.6 seconds and generated all 68 static pages. The local build required the existing Clerk runtime configuration to serve public routes; the ignored local environment was configured before final browser checks.
- **18 production-build browser checks passed**: nine exact Circle Builder combinations, four family PDPs at 1440px and 390px, and one component-only PDP. Zero page errors and zero broken visible images in the final run. See `browser-checks.json`.
- **Mobile Builder passed** at 390 x 844: Circle 100 mL, Frosted, Vintage Style Bulb Sprayer with Tassel, Gold. Correct integrated sprayer hash reached step 4 review. No order submitted. See `mobile-builder-check.json`.
- **Nine native kit checks passed** with identical assembled pixels before/after, plate parity below 6/255, transparency and clipping gates. See `native-kit-checks.json` and `circle-component-repair-sheet.jpg`.
- ESLint passed for the changed production repair/helpers and registration code. `git diff --check` passed.

Local review is running at <http://localhost:3056/matrix?family=Circle> and returns HTTP 200. The corrected kits use the existing local Builder overlay; production catalog records remain unchanged. PDP grouping changes were verified transactionally against the captured 72 variants and are prepared for a later approved data release.

The approved four-family hero registries and 2080 x 2288 assets are untouched. This is the first repair batch, not full-family completion or publication clearance. See `README.md` for remaining source/compatibility work and release boundaries.
