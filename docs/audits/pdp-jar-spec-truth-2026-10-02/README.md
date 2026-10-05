# Classic jar PDP specification audit — 2026-10-02

Initial base: `c243d4d02e740db04d835e9194777f31141a0296`. Integrated `main` at `e813b76e1e7656c756278f5aaec48991255bbbd8` (PR #353, Team Hub checklist); its four files do not overlap this fix.

## Reproduction and authority

The deployed `/products/cream-jar-30ml-mixed` HTML resolves `CJAmb30BlkCap` / `CJ-JAR-AMB-30ML-BLK` and its `cream-jar-30ml-amber-45mm` plate, but renders **Glass Finish: Clear** and **Closure: Fine Mist Spray**. The image alt text also calls it a fine mist spray.

Read-only production `products:getProductGroup` queries confirm the group and all four 30 ml variants have `color: null` and `applicator: null`. Their existing `itemName` descriptions explicitly say amber or frosted bottle with black or silver cap. Selected fields are preserved in [production-evidence.json](./production-evidence.json).

The exact [legacy CJAmb30BlkCap page](https://www.bestbottles.com/product/cream-jar-style-30-ml-amber-glass-bottle-black-cap) was fetched through the repository's read-only product-truth audit. It confirms amber glass, black cap, 30 ml, and 45 mm neck. It does **not** supply a closure-thread mechanism, so the correction says **Cap**, not a guessed screw-cap specification. Asset paths and SKU abbreviations are corroboration only, not the fallback's source.

The initial configured development endpoint had Amber in its structured color field and no `cream-jar-30ml-mixed` group. Production was therefore queried explicitly at `precise-raccoon-123.convex.cloud`; development results were not used as production evidence.

## Root cause and correction

- `ProductDetailClient.uniqueColorGroups` converted missing group color into Clear and shared that option with desktop and mobile.
- `ConfiguratorPdp` converted an unrecognized configurator route into a clear glass preset and sprayer closure. The legacy mixed jar route has no neck suffix and cannot match the configurator grammar.
- Mobile closure thumbnails made the same unsupported-route sprayer assumption.

The display boundary now resolves selected-SKU facts from populated structured fields, then explicit body/closure wording in the existing item name. Color may finally use a known group color. It never interprets a cap color as a body color and never decodes asset paths or SKU abbreviations into specifications. Missing facts stay absent. Inferred cap inclusion rejects negative, optional, compatibility, and separately sold wording. That guard does not override populated structured facts. The selected SKU drives the active color and swatch ID on both desktop and mobile for both unmapped and derived-family routes, so an explicit frosted-SKU selection does not retain the amber fact.

Unmapped routes no longer select sprayer capability by default. Registered roll-on, mist-spray, and lotion-pump routes retain their mapping. Catalog rows, prices, auth, dimensions, media, and routing are not changed.

## Verified scope and adjacent findings

| Case | Expected result |
| --- | --- |
| CJAmb30BlkCap / CJAmb30SlCap | Amber; Cap; existing black/silver closure finish retained |
| CJFrst30BlkCap / CJFrst30SlCap | Frosted; Cap; existing black/silver closure finish retained |
| 15 ml mixed plastic jar, pink/white caps | Cap; body finish omitted because descriptions do not state it |
| Unknown unmapped container | No fabricated Clear, Fine Mist Spray, or Bottle only fact |
| Registered cylinder roller/spray/pump | Existing closure capability retained |

The exact 60 ml SKU is `CreamJarFrstdPlsBlkPls2oz` / `CJ-JAR-FRS-60ML`. Its group and variant both have `category: Glass Jar`, `capacity: 60 ml (2.03 oz)`, `capacityMl: 60`, and `neckThreadSize: 58mm`. The record has `capColor: Frosted`, but its description says frosted **plastic** with **clear cap**, capacity **63 ml**. The exact legacy page was fetched on 2026-10-02: its capacity field also says **60 ml (2.03 oz)**, its description also says **frosted plastic / clear cap / 63 ml**, and its URL/SKU/image filename name **black cap**. The reconciliation script reports zero issues because it does not detect these internal legacy conflicts; that count is not clearance. The same scoped fallback safely recovers **Frosted** and generic **Cap**, but does not resolve cap finish, glass/plastic classification, or capacity. Required authoritative fields before those corrections: body material, supplied cap color/finish, sellable nominal capacity and whether 63 ml represents brimful/overflow capacity or a copy error. Confirm any resulting category/label correction against the exact SKU; do not infer it from the filename. These conflicts need a separate focused correction; this PR does not rewrite them or assert a new specification. The mixed 30 ml group also still offers amber and frosted SKUs under a single route; this PR fixes selected-SKU facts, not grouping/selector architecture.

## Verification and release

Verification results are recorded in the PR description. The new regression suite renders the actual desktop configuration component for all four production variants, checks the shared mobile facts, mounts the actual ProductDetailClient with observed child boundaries across Amber → Frosted → Amber URL-SKU transitions on unmapped and derived routes, exercises missing evidence and structured-field precedence, and checks nearby closure routes.

Draft PR only. No merge, production deployment, or production catalog mutation is authorized or performed by this task. The production issue remains until the fix is reviewed and released.

The child-boundary integration tests mock network/providers and the heavy desktop/mobile children; they exercise real page selection and memo wiring, not browser layout or live selector clicks. An unauthenticated request to the ready Vercel preview redirects to **Login – Vercel**, so it is not a live PDP smoke pass. Exact-head remote CI/preview status and local command outcomes are maintained in the PR description.

Review regression proof: running the new negative/optional closure cases and page-wiring tests against the pre-review source at `0158ccfe` produced **7 failures / 15 passes**; the corrected implementation passed all 22 of those tests. A further test prevents a derived clear preset from reviving an unknown selected color. Negation examples are synthetic hardening cases; no affected production SKU was established for them.
