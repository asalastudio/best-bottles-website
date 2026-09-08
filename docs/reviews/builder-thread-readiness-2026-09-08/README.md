# Three-thread builder readiness audit

September 8, 2026. Production catalog read-only; no publication, component, kit, hero, or storefront changes. Exact timestamps and endpoint are in `summary.json`. The source comparison reprocessed the HTML retrieved earlier in this same audit; its snapshot timestamp is retained.


Historical baseline before the authorized repair. See the [repair results and remaining blockers](../builder-thread-repair-2026-09-08/README.md) for the current local implementation.

## Scope and result

Counts in the table are exact finished bottle/fitment/cap SKU combinations, **not fitment types**. The customer chooses a mechanism once (for example Metal Roller), then chooses one of its compatible caps.

Paginated all 2,481 product records, then checked all 2,007 bottle/vial assemblies on 13-415, 17-415 and 18-415 across 18 families. Unlike the customer family picker, this includes families that currently have no usable builder configurations. No in-scope catalog assembly was absent from its matrix result. All kits were queried even when commercial or compatibility gates rejected a row.

| Neck | Catalog assemblies | Currently selectable | Selectable in diagnostic standalone-publication comparison |
|---|---:|---:|---:|
| 13-415 | 591 | 56 | 148 |
| 17-415 | 146 | 132 | 132 |
| 18-415 | 1,270 | 61 | 126 |
| Total | 2,007 | 249 | 406 |

The comparison ignores only the loose component's sellability flag, in memory. It does not relax exact identity, retirement, stock, assembly price/availability, duplicate selection, or kit checks. It is not a new storefront rule, not an orderability certification, and does not change any records. The business decision about standalone versus assembled availability remains pending.

## Reported 5 ml Cobalt Blue Cylinder

The supplied [short shiny black cap product](https://www.bestbottles.com/product/cylinder-design-5-ml-blue-glass-bottle-short-shiny-black-cap) links **10 distinct screw caps**. It has **one Plastic Roller fitment** and **one Metal Roller fitment**. The [plastic roller selector](https://www.bestbottles.com/product/cylinder-design-5-ml-blue-glass-bottle-plastic-roller-ball-plug-black-shiny-cap-with-dots) and [metal roller selector](https://www.bestbottles.com/product/cylinder-design-5-ml-blue-glass-bottle-metal-roller-ball-plug-black-shiny-cap-with-dots) each link **nine cap choices**. These are cap choices under one mechanism, not nine different rollers.

- Four screw caps currently pass. The six excluded exact assemblies already have cap-split kits, but their matrix component lists are empty: `GBCylBlu5BlkShSht`, `GBCylBlu5CuSht`, `GBCylBlu5GlMattSht`, `GBCylBlu5SlMattSht`, `GBCylBlu5GlSht`, `GBCylBlu5SlSht`. Do not fill these relationships by copying every same-thread component.
- Seven fine-mist assemblies have full kits and stored sellable assembly records. Their exact listed loose sprayers are `STATUS_DRAFT+NOT_PUBLISHED` and rejected by the current matcher.
- The **one Metal Roller fitment with nine cap choices** and **one Plastic Roller fitment with nine cap choices** pass the component match but need the validated bare-bottle reference supplied by an eligible full kit of the same bottle. The sprayer gate removes that reference. In the isolated comparison, both roller fitments become selectable with all nine cap choices each, without changing their artwork. The 18 records are exact finished SKU combinations, not 18 mechanisms.
- The sprayer selector has an eighth matte-black link, but that page currently returns no product Item Name or purchase block. Keep it unresolved; do not invent an eighth assembly SKU or assume it is purchasable.

## Reported 18-415 Cylinder, 50 ml and 100 ml

For each size, six standard perfume-sprayer and six standard lotion-pump assemblies have full kits and stored sellable assembly records. Their listed loose components are draft/unpublished. The diagnostic comparison restores these twelve choices per size, in addition to the two vintage mechanisms already visible.

The clear-overcap lotion-pump record remains an unresolved exact component match. It must not be substituted with an ordinary pump just because both share a finish. Twelve reducer assemblies per size are stored unsellable; their kits are cap-split body/fitment records. They remain blocked in the comparison and require separate assembly publication and media/identity review.

## 17-415 findings

132 of 146 assemblies are selectable. The remaining 14 are twelve media/configuration exclusions and two unresolved component matches. The twelve include Clear/Cobalt/Swirl roller variants and a shiny-silver sprayer. The two unresolved matches are `GBCyl9SpryRd` and `GBPillar9SpryBlkMatt`. Every exact SKU is listed in `assemblies.csv`; loosening standalone publication would not recover these fourteen.

## Legacy scope and follow-ups

Inspected 2,050 unique legacy URLs from catalog source links and recursively linked variant selectors, saving response hashes. Fifty exact source identities were not represented in the audited matrix scope, and ten URLs remained unresolved. "Not represented" does not automatically mean a record is absent from Convex: family, thread, capacity, retirement or imported identity may differ. Reconcile the exact rows in `summary.json` before introducing any records.

Two field comparisons need review: `GBCyl5SpryBlkMatt` reports 5 ml in the source specification versus 5.5 in the catalog (the legacy description itself also uses 5.5 ml); `GBRect10MinarSl` uses `13/415` on the source versus `13-415` in the catalog, a notation difference. Neither was changed automatically.

This crawl is seeded by the current catalog and follows actual selector links. It is **not a complete independent census of every legacy category**, so it cannot by itself certify an entirely new family. Use the [family readiness checklist](../../bottle-builder-family-readiness.md) to reconcile independent source scope, all exact finishes, commercial state, media, preflight and mobile behavior before release.

## Evidence and verification

- `assemblies.csv`: all 2,007 exact assembly records and separately classified blockers.
- `source-index.csv`: all inspected URLs, returned identities, source facts, SHA-256 and source errors.
- `summary.json`: thread/family totals, source-only records, field differences and unresolved pages.
- Full JSON and original HTML are retained locally at `/tmp/bb-thread-readiness-production/`.
- Four new audit regression tests plus 37 existing builder/component tests pass (41 total). They cover standalone publication, unchanged assembly/retirement/stock checks, missing relationships versus media failures, and the blocked sibling-preview dependency. TypeScript and targeted lint also pass.
- No new assemblies were enabled, no live Shopify availability certification was performed, and no cart was created. The findings provide the correction scope; they are not a claim that all missing options are repaired.
