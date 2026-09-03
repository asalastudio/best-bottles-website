# Catalog filtering & search — Baymard audit and alignment pass

_2026-09-02. Branch `claude/product-details-filtering-a17ffc`. Scope: `/catalog` (master) and `/catalog/cylinder`, the Convex search behind them, Grace's catalog tools, the guided PDP, and the Shopify push/sync._

Baymard's product-list research (2025 update, [baymard.com/blog/current-state-product-list-and-filtering](https://baymard.com/blog/current-state-product-list-and-filtering)) is the reference. The eight guidelines that apply to a B2B packaging catalogue are scored below against what the code actually does, with file references so the next person can verify instead of trust.

## 1. Scorecard

| # | Baymard guideline | Before this pass | After this pass |
|---|---|---|---|
| 1 | **Filters for all displayed list-item info** — every attribute a card shows must be filterable ([source](https://baymard.com/blog/have-filters-for-list-item-info)) | Cards show product type, capacity, colour, neck, family, price. Product Type facet could not reach the 95 groups whose only applicator value is `Cap/Closure`, nor the 9 `Glass Stopper` groups. Five real categories (Glass Jar, Aluminum Bottle, Plastic Bottle, Metal Atomizer, Packaging) were missing from the Categories list. | `capclosure` and `glassstopper` buckets added; every `products.applicator` schema literal is now bucketed or explicitly excluded (test). Categories list is the full data vocabulary (11 values), unknown ones append instead of vanishing. |
| 2 | **AND across filter types, OR within** — always allow combining values of one type ([source](https://baymard.com/blog/allow-applying-of-multiple-filter-values)) | Already correct: 5 multi-select facets, drill-down-aware counts (`convex/products.ts` `runFilters(skipKeys)`). | Unchanged. Category / collection counts are now also drill-down aware (`categoryFacetBase`), so choosing "Cap/Closure" no longer collapses the sidebar to one lonely row. |
| 3 | **Applied-filters overview** with per-chip removal and clear-all | Present (`CatalogClient.tsx` chip row, `data-testid="catalog-active-filter-chip"`). | Unchanged. Chips now render canonical colour labels (`Cobalt Blue`, never `Blue`). |
| 4 | **Essential filter types** (price, colour, size, brand/line; ratings n/a) | All present but price was **wrong**: both bounds compared against the group's cheapest variant, so a $2–$40 group passed `priceMax=5` and a `priceMin=10` filter hid it. 120 of 362 groups span a range. Slider ceiling was the max of the cheapest variants. | Overlap semantics: a group matches when any variant is inside the window. Slider ceiling is the real top price. Tested in `tests/catalog-price-filter-semantics.test.ts`. |
| 5 | **Truncate long value lists** with an explicit "show more"; never a scroll box | Families, capacities, colours, threads were fixed-height boxes with `hide-scroll` — invisible scrollbar, no hint of hidden values. | `TruncatedFacetList`: first 8 values + "Show N more" / "Show less"; selected values always stay visible. |
| 6 | **Hierarchy** — most-used, category-specific filters first; collapse the rest | Desktop order was Product Type → Families → Capacity → Colour → Categories → Component → Neck → Price. Categories (scope) buried at #5 and collapsed; Neck Thread (the fit-critical B2B attribute) at #7; Price last. Mobile used a different hardcoded order; the surface manifest was ignored. | Order now comes from `MASTER_CATALOG_SURFACE.visibleFacets` and the sidebar maps over it: **Categories → Product Type → Capacity → Neck Thread → Glass Colour → Price → Design Families → Component Type**. Desktop opens the first five; mobile opens Product Type and Capacity. Any facet with an active value opens itself. |
| 7 | **Truthful counts and no dead ends** — grey out zero-result values rather than dropping them silently | Category counts were SKU totals from a global taxonomy; every other facet counted product groups in context. Two units in one sidebar. | Categories/collections count product groups in the current context (same unit everywhere); zero-result scopes render disabled with `0`, so the catalogue's scope stays visible. |
| 8 | **Mobile: real dialog, apply with live count** | Live count on the sticky button existed. Drawer was a bare `motion.div` — no `role`, no `aria-modal`, no Escape. Catalog search box hidden below `md`. | `role="dialog" aria-modal aria-label`, Escape closes, close button takes focus. Search box on every viewport. |

Sort: the four Baymard essentials are price, rating, best-selling, newest. We offer price (both directions), best match, name, capacity, variants. Rating does not apply; **best-selling and newest need Shopify order data** and are the one sort gap left open (see §5).

## 2. Alignment: one vocabulary, six consumers

The deeper problem behind most of the findings was that the same concept lived in several hand-typed lists. The audit (see the mismatch table in §6) found six applicator vocabularies, five family lists (none matching the data), four colour lists, and a `normalizeCatalogSearchText` copy in Convex that had silently lost the `roller ball` synonym.

`src/lib/catalogFilters.ts` is now the single source of truth, and every consumer imports from it:

| Consumer | What it now imports | Files |
|---|---|---|
| Convex catalog search | `APPLICATOR_BUCKETS`, `FAMILY_ORDER`, `BOTTLE_CATEGORIES`, `COMPONENT_CATEGORIES`, search + classify helpers, `canonicalGlassColor`, `parseCapacityLabelMl` | `convex/products.ts` (local copies deleted) |
| Client fallback | same | `src/lib/catalogSearchFallback.ts` |
| Sidebar | `CATEGORY_ORDER`, `COMPONENT_CATEGORIES`, manifest order/defaults | `src/app/catalog/CatalogClient.tsx`, `src/lib/catalogSurface.ts` |
| Grace — OpenAI Realtime tool specs | `CATALOG_CATEGORY_VALUES` (enum), `APPLICATOR_BUCKET_VALUES` (enum + `maxItems`), `CATALOG_FAMILIES`, `PRODUCT_APPLICATOR_VALUES`, `CANONICAL_GLASS_COLORS` in descriptions | `src/lib/knowledge/toolSchemas.ts` |
| Grace — GPT-5 text tool defs | `CATALOG_CATEGORY_VALUES`, `CATALOG_FAMILIES`, `PRODUCT_APPLICATOR_VALUES` (drops the invented `'Specialty'` category and the legacy `Antique Bulb Sprayer` names) | `convex/graceToolDefs.ts` |
| Grace — search ranking | `detectCatalogFamily` (longest name wins, so "Tall Cylinder" ≠ "Cylinder"), `detectCanonicalGlassColor` | `convex/grace.ts`, `convex/graceSearchUtils.ts` |
| Shopify | plain tags kept; new prefixed tags `family:` `category:` `glass:` `collection:` `capacity:` `neck:` `applicator:` carry the identical strings; the webhook sync reads them back and **no longer overwrites `category` with the family name** (productType) on every Shopify update | `scripts/push_convex_to_shopify.mjs`, `convex/shopifySync.ts` |
| Result integrity audit | `canonicalGlassColor` | `src/lib/catalogResultIntegrity.ts` |

Guardrails:

- `tests/catalog-vocabulary-alignment.test.ts` fails if any consumer re-declares a list, if a schema applicator literal is unreachable, if Grace's enums drift from the catalogue, or if the shape-intent map routes to a family the catalogue does not know.
- `npm run audit:catalog-vocabulary` pulls the live productGroups from Convex and diffs them against the canonical lists (exit 1 on a hard gap). Run it against prod with `--url https://precise-raccoon-123.convex.cloud` before a catalogue import.

Live data facts the lists were built from (dev, 362 groups, 2026-09-02): 11 categories, 38 family values (24 design families + 4 product-type lines + component lines), 13 applicator values, 11 raw colours (`Blue` ×4 and `Cobalt Blue` ×19 both present), 34 neck values, 37 capacities.

## 3. What Grace can now do that it could not

- Ask for caps by category (`Cap/Closure`) or by product type (`capclosure`), and for `Glass Jar`, `Roll-On Bottle`, `Packaging`.
- Refine on `Cobalt Blue` and hit the rows stored as `Blue` — the sidebar, the URL and Grace share `canonicalGlassColor`.
- Name any of the 28 families the data actually has, including `Decorative`, `Apothecary`, `Teardrop`, `Pillar`, `Tall Cylinder` — previously the shape map routed "heart"/"tola" to `Decorative`, which the family tool's own description said did not exist.
- Be told the truth in tool descriptions: the category list, family list and applicator list in both the Realtime and text schemas are generated from the same constants the filters use, so a value that matches nothing can no longer be advertised.

Still Grace-blind (data, not code): `trimColor`, `capHeight`, `assemblyType`, `componentGroup`, `priceTiers` outside `getProductBySku`. See §5.

## 4. Search

Unchanged in this pass and worth stating: storefront search is a token-AND substring scan over an in-memory copy of all groups, with a hand-built synonym table (`normalizeCatalogSearchText`). It composes with every facet and gets its own chip. It has no fuzzy matching, no product-backed autocomplete (the navbar suggestions are eight static strings), and no zero-result logging. Grace's search uses Convex's `search_itemName` index and is better than the customer-facing one.

## 5. Backlog, in priority order

1. **Compatibility facet** ("fits 18-415") — the single most valuable B2B filter; the data exists in `fitments` and `productGroups.neckThreadSize`. P0 for the new PDP too.
2. **Best-selling / newest sorts** — needs Shopify order data or a `createdAt` on groups. Baymard essentials.
3. **Product-backed autocomplete** with result counts and keyboard/ARIA combobox, plus zero-result query logging (`analytics.catalogFiltered` exists but is never called).
4. **Cap / trim colour facet** — `products.capColor` / `trimColor` are PDP-only today; Grace has to be told in prose that closure colours are not refinable.
5. **Material facet** (glass / aluminium / plastic) — categories carry it; a facet would make it explicit.
6. **Dual-thumb price slider with numeric inputs** — today two stacked single sliders.
7. **Data hygiene**: rename the four `Blue` groups to `Cobalt Blue`; decide what `Unknown`, `Tall Cylinder` (1 group) and the `mm`-style neck values should be. The vocabulary audit lists them.
8. **Performance**: `/catalog` is `force-dynamic` and every request `.collect()`s the whole `productGroups` table twice, then does an N+1 variant fetch per page; "Load more" refetches from offset 0. This pass removed one live full-table subscription (the taxonomy `useQuery`). The indexed `products.searchProducts` / `getCatalogGroups` queries exist and are unused.
9. **Unify the two mobile filter paradigms** (master: instant apply; Cylinder page: draft-then-apply with a debounced count). The Cylinder pattern is the better one.

## 6. Mismatch table (as found, before this pass)

| Concept | Convex | Catalog sidebar | Grace | PDP | Status now |
|---|---|---|---|---|---|
| Applicator / closure type | schema enum of 18 literals; `applicatorTypes[]` on groups | 8 buckets (copy in Convex) | raw values in one tool, bucket slugs in another, legacy `Antique…` names advertised | slug-suffix list of 12; SKU-token regex; configurator bases | one bucket list, 10 buckets, enums generated; legacy names hidden; PDP slug suffixes unchanged (documented) |
| Family | free string | exact match, 19-name order incl. two phantoms | four different lists (16–25 names) | slug grammar + 10 registered configurator families | one 28-name list built from data; all Grace lists generated |
| Glass colour | raw strings (`Blue`, `Cobalt Blue`) | raw exact match | canonical via `normalizeRawColor` | raw | canonical everywhere the customer can filter; PDP spec row still shows raw |
| Category | free string | 9-name hardcoded order (5 real categories missing) | 9-value enum (2 real categories missing, `Specialty` invented in the text tool) | label composition | one 11-value list |
| Capacity | `capacityMl` + label | exact set of labels; mega-menu labels did not match | parsed from free text; exact set in refine | label | label normaliser on URL parse; same parser everywhere |
| Neck finish | `neckThreadSize` / `threadSize` / `finish` / `neckFinish` | `threads` URL key, regex hides non-GPI values | `threadSize` | coerced to 17-415 / 18-415 | unchanged — five field names remain; audit reports hidden values |
| Price | `priceRangeMin/Max`, `webPrice*`, `priceTiers` | both bounds vs `priceRangeMin` | tiers only via `getProductBySku` | tiers ladder | overlap semantics; Grace tier exposure unchanged |
