# Builder thread repair — September 8, 2026

This is a local frontend repair against the current production catalog. No product publication, backend deployment, kit/plate/hero changes, or production release is included.

## Repaired

The builder purchases one complete bottle assembly. An included loose component's independent Shopify draft/unpublished status no longer hides a sellable complete assembly. Exact component identity, original listed compatibility, retired-alias provenance, thread, stock, complete assembly availability, price, checkout variant, and media validation remain required.

The read-only comparison across 2,007 assemblies and all 18 catalog families using 13-415, 17-415, and 18-415 increases selectable exact assemblies from **249 to 406: 157 restored and zero lost**. These are finished SKU combinations, not counts of mechanisms.

| Thread | Before | After |
|---|---:|---:|
| 13-415 | 56 | 148 |
| 17-415 | 132 | 132 |
| 18-415 | 61 | 126 |

All 157 restored exact assemblies passed the existing read-only `/api/bottle-builder/validate` route against production Convex records, preserving assembly SKU, Shopify variant, quantity 12 and charged unit price. The cart payload remains one complete assembly; no loose component charge is added. See `preflight.json`. This verifies local server/catalog preflight, not a live Shopify checkout or deployed storefront.

The 5 ml Cobalt Blue flow offers separate Screw Cap, Metal Roller, Plastic Roller and Fine Mist Sprayer mechanisms. Copy now explicitly distinguishes cap only with no roller from a roller with its selected cap. Review repeats what is included; sprayers retain the existing included-overcap disclosure.

## Source-linked but awaiting kits

Six missing Cobalt Blue short screw-cap relationships are now supplemented from reviewed exact assembly/component identities. No thread-wide list is introduced. Existing matrix entries are preserved, and any matching component identity takes precedence. Supplemental source URLs are carried separately from the original matrix resolution.

The short shiny-black component's website SKU is blank in the current record. The [actual component page](https://www.bestbottles.com/product/Short-Caps-lids-top-bottle-shiny-black-Color-13-415) identifies it as **CP13-415BlkShShtMtl**. The projection requires the exact Grace SKU, source URL, description, neck, category, stock and checkout identity before using that source SKU. It does not write to the catalog.

`short-cap-source-evidence.json` records all six exact assembly/component URLs, identities and source HTML hashes. The bottle's [legacy selector](https://www.bestbottles.com/product/cylinder-design-5-ml-blue-glass-bottle-short-shiny-black-cap) includes all ten screw caps. All six repaired links now pass compatibility, but their current `background-matte` body layers fail the existing media contract. Direct inspection of the shiny-black body confirms a white rectangle around the bottle, plus edge remnants. We did not bypass this check or alter the other branch's kits.

Consequently the **currently selectable** 5 ml Cobalt choices are:

- Screw Cap: 4 caps; 6 additional short caps linked and held for media, bringing the verified intended set to 10.
- Metal Roller: one mechanism with 9 caps.
- Plastic Roller: one mechanism with 9 caps.
- Fine Mist Sprayer: 7 exact finishes. The matte-black legacy link still lacks a verifiable product SKU/purchase block.

The six held assembly SKUs are GBCylBlu5BlkShSht, GBCylBlu5CuSht, GBCylBlu5GlMattSht, GBCylBlu5SlMattSht, GBCylBlu5GlSht and GBCylBlu5SlSht.

## Still incomplete

- Cylinder 50 ml and 100 ml now each recover six standard perfume-sprayer finishes and six standard lotion-pump finishes alongside their vintage choices. Reducer assemblies remain unpublished/unsellable, with other identity/media issues; no product was silently published. The clear-overcap pump needs a further exact component disambiguation.
- 17-415 retains 132 selectable assemblies. Twelve identified assemblies remain held by media/configuration validation and two by exact component matching.
- Other families have unresolved components, media, commerce or ambiguous selections. `assemblies.csv` is a per-SKU ledger; `summary.json` records overlapping blocker counts. This repair does not certify every future family ready.
- The fresh repair audit checked current catalog/kit records, not a new legacy crawl. Source scope and unresolved source pages remain documented in the [baseline audit](../builder-thread-readiness-2026-09-08/README.md).

## Verification

- Full Vitest suite on the final PR tree: 1,547 passed, 7 skipped.
- TypeScript and targeted ESLint checks passed.
- Webpack production build passed. Mobile WebKit and Chrome passed Screw Cap, Metal Roller, Plastic Roller and Fine Mist Sprayer selection, exact finish counts, review contents, enabled add action below the cart minimum, quantity entry and edit. Both passed a 320 px overflow check; desktop at 1440 px rendered successfully. See browser captures. These are browser-emulation checks, not a physical-device or VoiceOver certification.
- A development-only WebKit HMR chunk error was reproduced before the production build; the repeated production browser run completed with zero runtime errors.
- All four existing cap-only cobalt assemblies passed production-build preflight; all four rejected a request mislabeled as Metal Roller (409). See `cap-only-preflight.json`.
- Expanded-preview Close passed icon, label, lower-edge, native-dismissal and Escape checks in WebKit and Chrome, with focus, configuration and quantity preserved.
- Repeat mobile checks with `BB_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BB_CHROME_PATH=/path/to/chrome node docs/reviews/builder-thread-repair-2026-09-08/verify-mobile.mjs` against the local production build.
- Source-link regression coverage includes preserving nonempty matrix lists (9/9 tests).
- Regression tests cover unpublished loose components versus unsellable complete assemblies, exact retired alias restoration, six source-backed cap joins, wrong bottle identity, unavailable/conflicting components, and separate media diagnostics.
- Readiness checks for future families: [family readiness procedure](../../bottle-builder-family-readiness.md). `--check` remains fail-closed for missing source verification or unresolved rows.
