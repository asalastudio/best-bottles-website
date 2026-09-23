# Validation — 2026-09-22

- **210 tests passed in 20 files**, covering the repair transaction, PDP framing, mobile PDP models, Builder selection, source links, payloads and component registration. Full output: `test-results.txt`.
- **TypeScript and production Webpack build passed**. Final build compiled successfully in 44 seconds, completed TypeScript in 28.6 seconds and generated all 68 static pages. The local build required the existing Clerk runtime configuration to serve public routes; the ignored local environment was configured before final browser checks.
- **18 production-build browser checks passed**: nine exact Circle Builder combinations, four family PDPs at 1440px and 390px, and one component-only PDP. Zero page errors and zero broken visible images in the final run. See `browser-checks.json`.
- **Mobile Builder passed** at 390 x 844: Circle 100 mL, Frosted, Vintage Style Bulb Sprayer with Tassel, Gold. Correct integrated sprayer hash reached step 4 review. No order submitted. See `mobile-builder-check.json`.
- **Nine native kit checks passed** with identical assembled pixels before/after, plate parity below 6/255, transparency and clipping gates. See `native-kit-checks.json` and `circle-component-repair-sheet.jpg`.
- ESLint passed for the changed production repair/helpers and registration code. `git diff --check` passed.

Local review is running at <http://localhost:3056/matrix?family=Circle> and returns HTTP 200. The corrected kits use the existing local Builder overlay; production catalog records remain unchanged. PDP grouping changes were verified transactionally against the captured 72 variants and are prepared for a later approved data release.

The approved four-family hero registries and 2080 x 2288 assets are untouched. This is the first repair batch, not full-family completion or publication clearance. See `README.md` for remaining source/compatibility work and release boundaries.
