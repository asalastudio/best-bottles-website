# 46 ml Diva dropper records on production

18 September 2026. The plate promotion to production surfaced this; it did not cause it. `productPlates.integrity` reported three `grace_sku_mismatch` rows on production and none on dev.

## What Shopify says

Both Shopify products are ACTIVE and all six variants are available for sale.

| Grace SKU | Variant | Price | Shopify product |
|---|---|---|---|
| GB-DVA-CLR-46ML-DRP-CPR | 53343643238692 | $2.40 | 46 ml Clear Diva Dropper Bottle |
| GB-DVA-CLR-46ML-DRP-GLD | 53343643205924 | $2.40 | 46 ml Clear Diva Dropper Bottle |
| GB-DVA-CLR-46ML-DRP-SLV | 56214700491044 | $2.40 | 46 ml Clear Diva Dropper Bottle |
| GB-DVA-FRS-46ML-DRP-CPR | 56214700556580 | $2.90 | 46 ml Frosted Diva Dropper Bottle |
| GB-DVA-FRS-46ML-DRP-GLD | 56214700523812 | $2.90 | 46 ml Frosted Diva Dropper Bottle |
| GB-DVA-FRS-46ML-DRP-SLV | 53343642485028 | $2.90 | 46 ml Frosted Diva Dropper Bottle |

Dev matches this exactly. Production did not.

## What production held

| Record | Defect |
|---|---|
| GBDiva46DrpCu | bound to the clear copper variant, carried the frosted grace SKU |
| GBDiva46DrpGl | same defect in gold |
| GBDiva46DrpSl | is the clear silver bottle — same item name, same $2.40 ladder and same import source as dev's clear silver — but carries the frosted grace SKU, is bound to the frosted variant, sits in the frosted group and stores color "Frosted" |
| GBDivaFrst46DrpCu / Gl / Sl | no record at all |

The commercial consequence of the third row: a page labelled clear silver at $2.40 puts the frosted silver variant, priced $2.90 in Shopify, into the cart.

## Applied

Copper and gold grace SKUs were corrected on production (`setGraceSku`). Both were metadata only: variant, price, group and stock untouched. Plate integrity went from 3 issues to 1. Receipt: `data/asset-ledger/diva-dropper-record-fix-2026-09-18.json`.

## Not yet applied — blocked on permission

`scripts/asset-ledger/fix-diva-dropper-records.mjs` carries the rest in four phases, each dry by default. The remaining writes were refused by the Claude Code auto-mode classifier as "Modify Shared Resources" and need Jordan to grant that in chat.

```bash
node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase grace  --apply   # silver -> GB-DVA-CLR-46ML-DRP-SLV
node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase create --apply   # the 3 frosted records, from their clear twin
node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase bind   --apply   # each record to the variant Shopify names
node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase group  --apply   # silver into the clear group, color from the group
```

Each phase re-reads production and refuses to act on anything that has moved: the grace phase only touches a record still bound to the variant it expects, create refuses an existing website or grace SKU, bind skips a record already bound, and group refuses until the grace phase has run.

The stored "Frosted" on the clear silver record is corrected by `moveProductToGroup` with `setColorFromGroup`, so no new backend code is needed.

After the four phases, production should read: three clear records in `diva-46ml-clear-18-415-dropper` at $2.40 on the three CLR variants, three frosted records in `diva-46ml-frosted-18-415-dropper` at $2.90 on the three FRS variants, and `productPlates.integrity` clean. The three frosted plates that were refused as orphans during the promotion can then be indexed by re-running the promoter.

Created records start `shopifySellable: false` with reason `NOT_IN_SHOPIFY` until a sellability pass runs, so they will show as quote-only until then.
