# Approved catalog inventory — September 22, 2026

Completed in Shopify through the signed-in admin product CSV importer, with explicit user approval for 1,000 placeholder units per current approved catalog variant. These are placeholder quantities, not a physical warehouse count.

## Verified result

- 2,476 approved variants across 350 existing parent products: Active, inventory tracked, 1,000 available and 1,000 on hand at Shop location (80900882724).
- All 2,476 are available for sale in the final Shopify readback.
- Zero new or deleted variant IDs; SKU, options, prices, image assignments, product details, shipping, tax and weight fields unchanged in the before/after comparison.
- All 158 excluded variants unchanged, including test records, superseded/unmatched records and the 13 draft parents.
- The CSV contains 2,577 rows because 101 non-approved siblings were included unchanged to preserve existing parent variant sets. Only the 2,476 approved rows receive tracked inventory and 1,000 units.
- No artwork columns were imported. Inventory policies were preserved.

## Evidence

`import-before.json.gz` and `import-after.json.gz` preserve the full 2,634-variant baseline and final snapshot. `import-after-verification.json` records a passing comparison at 2026-09-23T05:35:19Z. `final-catalog-audit.json.gz` independently verifies catalog availability at 2026-09-23T05:35:54Z. `approved-catalog-inventory-1000.csv` is the applied import file.

A one-variant pilot was applied and verified before the full import. The final Shopify admin product list displayed inventory totals and no import-in-progress dialog.

This was a direct Shopify data update; no website deployment is required for the inventory change. Existing website stock labels remain 2,392 In Stock and 84 Available to order, with the current approved variants sellable. Source-artwork and component repairs are separate work.
