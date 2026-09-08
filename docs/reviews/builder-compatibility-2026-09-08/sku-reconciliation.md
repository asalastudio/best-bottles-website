# SKU reconciliation independent of kit completion

September 8, 2026. Local implementation; no production data changes or publication.

## Exact joins corrected

| Assembly SKU | Already-listed component | Why the prior matcher failed |
|---|---|---|
| GBCrcl30GlCap | CP15-415ShnGl | Imported assembly color is Gold; exact source describes Shiny Gold. |
| GBCrcl30SlCap | CP15-415ShnSl | Imported assembly color is Silver; exact source describes Shiny Silver. |
| LBCyl50LtnMtSl | Ltn18-415MtSl | Both the standard and clear-overcap component tokenize as Matte Silver. |
| LBCyl100LtnMtSl | Ltn18-415MtSl | Same collision between standard and clear-overcap pump. |

The exact joins require matching bottle family, capacity, glass, neck and applicator. The component must already be listed by the existing compatibility resolver, have the appropriate kind and neck, be nonretired, and pass the existing stock/sellability checks. Missing exact records fail closed; the matcher cannot substitute the clear-overcap pump. No broad gold/shiny-gold equivalence was introduced. Kit validation remains unchanged.

Evidence:

- [Circle 30 ml shiny gold cap assembly](https://www.bestbottles.com/product/circle-design-30-ml-clear-glass-bottle-shiny-gold-cap)
- [Circle 30 ml shiny silver cap assembly](https://www.bestbottles.com/product/circle-design-30-ml-clear-glass-bottle-shiny-silver-cap)
- [Cylinder 50 ml matte silver pump assembly](https://www.bestbottles.com/product/cylinder-design-50-ml-glass-bottle-matte-silver-lotion-pump-and-cap)
- [Cylinder 100 ml matte silver pump assembly](https://www.bestbottles.com/product/cylinder-design-100-ml-glass-bottle-matte-silver-lotion-pump-and-cap)
- [Standard matte silver pump](https://www.bestbottles.com/product/lotion-top-matte-silver-color-18-415)
- [Distinct clear-overcap pump](https://www.bestbottles.com/product/lotion-top-matte-silver-clear-overcap-color-18-415)

Exact product descriptions and source URLs were also retrieved from production SKU records. The browser source reader returned the two Circle pages and 100 ml pump page; the 50 ml pump page could not be opened through that reader. The Circle gold source page reports Out of Stock in its indexed response, so its stock must be freshly reconciled before publication. A component identity correction is not a claim of current availability. No stock flags were changed here.

## Production component crosswalk

`component-reconciliation.json` records all 102 distinct website SKUs already referenced by the live Circle/Cylinder compatibility lists, including the exact resolved Grace SKU, source URL, neck, affected bottle SKUs and stored commercial state. This is a read-only snapshot, not a live Shopify inventory certification.

- 81 referenced component records resolve with the expected identity and neck, a checkout variant, and no stored stock/sellability block.
- 21 referenced component records are blocked by publication or commerce status.
- No missing exact website-SKU records or neck mismatches were found in this referenced set.

Run `npx tsx scripts/audit_builder_component_reconciliation.ts --out <directory>` against the intended catalog deployment to refresh. The default connection comes from `.env.local`; `--url` selects another public Convex endpoint. The script only queries records and writes reports. It never publishes products or modifies references.

Next catalog action: review the 21 blocked records against current Shopify publishing intent. In particular, determine whether loose components should be independently sold or only supplied inside complete assemblies. Publishing loose components or relaxing their sellability guard is not part of this correction. Reducer assembly publication restrictions, ambiguous source identities and kit readiness remain separate follow-up items.
