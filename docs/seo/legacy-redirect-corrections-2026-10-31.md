# Legacy redirect corrections, 31 October 2026

Checked all 54 rows previously marked `Fix` against the SKU actually printed on each live legacy page, then compared current production variants and exact source URLs. The October 27 audit remains unchanged as the historical input.

- 50 product destinations corrected: tassel sprayers, rectangle sprays, the clear Diva dropper, amber cream jar and aluminum black-sprayer bottle. Each corrected product link includes its exact current `sku` so the finish is preserved.
- One discontinued aluminum bottle with a white plug/tear-off cap now leads to `/catalog/aluminum-bottle`. Its legacy page says it is unavailable, and no equivalent current closure was found. The previous proposal incorrectly substituted a black sprayer.
- Three mappings preserved: the legacy URLs misstate the product they actually sell. The “16 oz” URL sells `PbClear8ozFlpWh` (227 ml), the “8 oz” URL sells `PbNat16ozFlpWh` (454 ml), and the “amber” Boston Round URL sells `GBBstnBlu15BlkDrprGlTrim` (cobalt). Changing those to match URL words would send customers to a different SKU. The conflicting legacy copy remains a client-data issue.

Two imported SKU aliases were verified by exact source URL and matching product details: `CreamJarAmb5mlSlcap` becomes `CJAmb5mlSlCap`, and `Alu250SpryBl` becomes `Alu250mlSprayBlack`. These corrections route to the whole product rather than the similarly named component group.

The JSON beside this note records all source URLs, observed SKUs and capacities, previous targets, final targets and reasons. Regression tests read that reviewed fixture. HTTP verification confirmed all 54 mappings return 301 and retain campaign tags, and all 14 destination paths return 200 on the deployed storefront. Development lacks one destination group, which is available in production.

The earlier 39 `Decide` rows, 75 `Upgrade` rows, two `Upgrade (confirm neck)` rows and 11 `Closest available` rows remain unchanged. This correction pass does not approve the entire cutover map.
