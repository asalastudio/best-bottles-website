# PR reconciliation after #117 and #110

Base: `0417a361`.

## Empire (#103)

All six content-addressed images and catalog records already exist on main. Recovered the original approval manifest unchanged; verified all six SHA-256 hashes, URLs, and framing values against main. Its original publication flags and dates are historical evidence, not a fresh deployment assertion. No hero records or artwork replaced.

## Homepage (#95)

Applied only the original framing patch to current main. Preserved HomeCatalogBrowser, browse data, current search, and navigation. Five editorial panels use 3:2 cover framing; sample and packaging layouts stay stacked through tablet widths.

## Deferred work

#91 remains optional and targets an older mobile branch; do not merge that branch into main to recover the microphone animation.

#69 is rebuilt independently on `codex/reconcile-studio-materials`. Its rendering changes require browser/Blender parity and renewed visual review before release. Photographic kit approvals remain independent.

## Validation

- Existing homepage tests: 11 passed.
- HomePage ESLint: passed.
- Production Webpack build including TypeScript: passed.
- All six Empire asset hashes, catalog URLs, and framing values verified.
- Responsive browser results are recorded alongside this report.
- Browser: HTTP 200 at 390, 768, 1024, and 1357 px; all five images decoded, 3:2 frames, cover sizing, no horizontal overflow. Inspected mobile and desktop screenshots. Local Sanity live-update CORS and Clerk configuration warnings are outside the framing change.
