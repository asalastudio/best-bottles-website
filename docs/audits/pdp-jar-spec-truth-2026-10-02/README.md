# Classic jar PDP specification audit — 2026-10-02

Base: `c243d4d02e740db04d835e9194777f31141a0296` (current `main` at checkout and pre-PR recheck).

## Reproduction and authority

The deployed `/products/cream-jar-30ml-mixed` HTML resolves `CJAmb30BlkCap` / `CJ-JAR-AMB-30ML-BLK` and its `cream-jar-30ml-amber-45mm` plate, but renders **Glass Finish: Clear** and **Closure: Fine Mist Spray**. The image alt text also calls it a fine mist spray.

Read-only production `products:getProductGroup` queries confirm the group and all four 30 ml variants have `color: null` and `applicator: null`. Their existing `itemName` descriptions explicitly say amber or frosted bottle with black or silver cap. Selected fields are preserved in [production-evidence.json](./production-evidence.json).

The exact [legacy CJAmb30BlkCap page](https://www.bestbottles.com/product/cream-jar-style-30-ml-amber-glass-bottle-black-cap) was fetched through the repository's read-only product-truth audit. It confirms amber glass, black cap, 30 ml, and 45 mm neck. It does **not** supply a closure-thread mechanism, so the correction says **Cap**, not a guessed screw-cap specification. Asset paths and SKU abbreviations are corroboration only, not the fallback's source.

The initial configured development endpoint had Amber in its structured color field and no `cream-jar-30ml-mixed` group. Production was therefore queried explicitly at `precise-raccoon-123.convex.cloud`; development results were not used as production evidence.

## Root cause and correction

- `ProductDetailClient.uniqueColorGroups` converted missing group color into Clear and shared that option with desktop and mobile.
- `ConfiguratorPdp` converted an unrecognized configurator route into a clear glass preset and sprayer closure. The legacy mixed jar route has no neck suffix and cannot match the configurator grammar.
- Mobile closure thumbnails made the same unsupported-route sprayer assumption.

The display boundary now resolves selected-SKU facts from populated structured fields, then explicit body/closure wording in the existing item name. Color may finally use a known group color. It never interprets a cap color as a body color and never decodes asset paths or SKU abbreviations into specifications. Missing facts stay absent. The selected SKU drives the active color on both desktop and mobile, so an explicit frosted-SKU selection does not retain the amber fact.

Unmapped routes no longer select sprayer capability by default. Registered roll-on, mist-spray, and lotion-pump routes retain their mapping. Catalog rows, prices, auth, dimensions, media, and routing are not changed.

## Verified scope and adjacent findings

| Case | Expected result |
| --- | --- |
| CJAmb30BlkCap / CJAmb30SlCap | Amber; Cap; existing black/silver closure finish retained |
| CJFrst30BlkCap / CJFrst30SlCap | Frosted; Cap; existing black/silver closure finish retained |
| 15 ml mixed plastic jar, pink/white caps | Cap; body finish omitted because descriptions do not state it |
| Unknown unmapped container | No fabricated Clear, Fine Mist Spray, or Bottle only fact |
| Registered cylinder roller/spray/pump | Existing closure capability retained |

The 60 ml mixed group's record has `capColor: Frosted`, but its description says frosted **plastic** with **clear cap**, capacity **63 ml**. Those existing cap-color/capacity/material inconsistencies need a separate focused correction; this PR does not rewrite them or assert a new specification. The mixed 30 ml group also still offers amber and frosted SKUs under a single route; this PR fixes selected-SKU facts, not grouping/selector architecture.

## Verification and release

Verification results are recorded in the PR description. The new regression suite renders the actual desktop configuration component for all four production variants, checks the shared mobile facts, exercises missing evidence and structured-field precedence, and checks nearby closure routes.

Draft PR only. No merge, production deployment, or production catalog mutation is authorized or performed by this task. The production issue remains until the fix is reviewed and released.
