# Focused B2B Shopping and Split PDP Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add family-first and application-first product discovery, simplify each PDP to one exact purchasing intent, retain Grace beside the buying workspace, and keep the advanced compatibility matrix separate and consistent with the PDP.

**Architecture:** One canonical catalog/filter model feeds the existing general catalog, the new guided finder surfaces, exact PDPs, Grace context, and the Product Compatibility Matrix. Finder state is canonical and URL-backed. The PDP resolves one application-specific product group, keeps only valid in-intent options above the fold, and derives lower-page sizes, alternate dispensing methods, and components from live product groups plus the shared fitment resolver.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Convex, Vitest, Framer Motion, existing Mixpanel analytics adapter, and the existing Grace provider/drawer.

**Spec:** [Focused B2B Shopping and Split PDP Architecture](../specs/2026-09-03-focused-b2b-shopping-and-pdp-architecture-design.md)

## Global Constraints

- Work only in `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.worktrees/focused-pdp-shopping-architecture` on `codex/focused-pdp-shopping-architecture`.
- Keep `5756e56a` and `3df2b635` as ancestors. Preserve `componentPhotoSkuBelongsToBase`, `photoKeysForVariant`, `resolveCapOptionPhoto`, and their applicator-aware usage.
- Do not restore legacy/archive PSD paths. The only approved PSD source remains `/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`.
- Do not mutate production Convex data. All new Convex work in this plan is read-only query code.
- Do not regenerate large inventory, selection, cross-reference, or plate JSON files.
- Do not hard-code family inventories from `data/rollon_bottles_complete.json` or mockup art. Runtime results come from `productGroups`, real product variants, fitment rules, stock state, and checkout eligibility.
- Keep `/catalog` and its current filters. The focused finders are additional shopping surfaces.
- Keep `/matrix` public and separate. Its customer-facing title becomes **Build a Bottle** with **Product Compatibility Matrix** as the subtitle.
- Do not add a decoration option. Do not describe a compatible or alternate part as included with the bottle.
- Diva 46 remains photo-only. Kits remain available only where a released kit exists; missing 3D/kit/plate media must fall back to the approved product photo without blocking purchase.
- At the end of every task, run its focused tests before committing. Do not batch unrelated changes into one commit.

## Target Contracts

The implementation must converge on these shared types. Keep them in ordinary TypeScript modules that both UI and Convex code can import; do not recreate them inside page components.

```ts
export type BrowseEntryMode = "family" | "application" | "search" | "grace" | "matrix";
export type RollerMaterial = "metal" | "plastic";

export type BrowseContext = {
  entryMode: BrowseEntryMode;
  family?: string;
  application?: ApplicatorNavValue;
  capacities?: string[];
  rollerMaterials?: RollerMaterial[];
  glassColors?: string[];
  neckThreads?: string[];
  sort?: SortValue;
};

export type FocusedPdpRelations = {
  currentApplication: ApplicatorNavValue | null;
  sameApplicationSizes: ProductGroupRelation[];
  otherApplications: ProductGroupRelation[];
};
```

Use the existing `APPLICATOR_NAV`, `APPLICATOR_BUCKETS`, `CatalogFilters`, canonical glass-color helper, capacity parser, route slugs, and shared `componentUtils` functions underneath these contracts.

---

## Task 1: Establish the Integration Baseline

**Files:**

- Verify: `src/lib/products/closure-swatch-keys.ts`
- Verify: `tests/closure-swatch-keys.test.ts`
- Verify: `tests/paper-doll-master-source-policy.test.mjs`
- Integrate from commit `482e28b2`: `src/lib/grace/pushLayout.ts`, Grace drawer/shell/provider/launcher changes, homepage editorial work and assets
- Integrate from commits `7061f4d1`, `5441b717`, `c56f72d5`, `d37c598d`: `src/app/matrix/page.tsx`, `src/components/matrix/*`, `convex/matrix.ts`

- [ ] Confirm the branch and protected ancestry before changing anything:

```bash
git status --short --branch
git merge-base --is-ancestor 5756e56a HEAD
git merge-base --is-ancestor 3df2b635 HEAD
```

Expected: both ancestry checks exit `0`; only the approved specification and this plan are present in branch history.

- [ ] Run the protected baseline tests:

```bash
npx vitest run tests/closure-swatch-keys.test.ts tests/paper-doll-mapping-resolver.test.ts tests/paper-doll-master-source-policy.test.mjs tests/pdp-closure-rail.test.ts
```

Expected: PASS before integration.

- [ ] Cherry-pick the previously approved Grace/homepage commit, resolve conflicts by retaining the protected PDP image code from `HEAD`, and do not drop the editorial assets:

```bash
git cherry-pick 482e28b2
```

- [ ] Cherry-pick only the four Product Matrix commits. Do not cherry-pick `c617cf35`, which is an unrelated backup commit:

```bash
git cherry-pick 7061f4d1 5441b717 c56f72d5 d37c598d
```

- [ ] Run the imported Grace test and a build-level type check:

```bash
npx vitest run tests/grace-push-layout.test.ts tests/closure-swatch-keys.test.ts
npx tsc --noEmit
```

- [ ] Inspect the resulting diff for accidental image-pipeline or generated-data changes:

```bash
git status --short
git diff --name-only 3df2b635..HEAD | rg 'inventory|selection|xref|legacy|paper-doll'
```

Expected: only intentional homepage assets/docs may match; no regenerated inventory/selection/xref payloads.

No additional commit is needed: the cherry-picks retain their original commits.

## Task 2: Add the Canonical Browse Context and Roller-Material Facet

**Files:**

- Create: `src/lib/products/focused-shopping.ts`
- Modify: `src/lib/catalogFilters.ts`
- Modify: `src/lib/catalogSearchFallback.ts`
- Modify: `src/lib/catalogServer.ts`
- Modify: `convex/products.ts`
- Modify: `src/lib/catalogSurface.ts`
- Test: `tests/focused-shopping-context.test.ts`
- Test: `tests/catalogFilters.test.ts`
- Test: `tests/catalog-vocabulary-alignment.test.ts`
- Test: `tests/catalogSearchClient.test.ts`

- [ ] Write failing tests for:
  - `/catalog/application/roll-on` resolving to canonical application `rollon`;
  - `/catalog/cylinder?applicators=rollon&capacities=9+ml&roller=metal` round-tripping without losing Cylinder, Roll-On, capacity, or roller material;
  - invalid application and roller values being rejected rather than silently invented;
  - `metal` matching `Metal Roller Ball`/`Metal Roller`, and `plastic` matching the plastic equivalents;
  - `filtersAreEmpty`, `activeFilterCount`, `filtersToParams`, and `paramsToFilters` including roller material.

- [ ] Run the tests and confirm the new cases fail:

```bash
npx vitest run tests/focused-shopping-context.test.ts tests/catalogFilters.test.ts tests/catalog-vocabulary-alignment.test.ts tests/catalogSearchClient.test.ts
```

- [ ] Implement `focused-shopping.ts` with:

```ts
export const APPLICATION_ROUTE_SLUGS = {
  "roll-on": "rollon",
  spray: "spray",
  dropper: "dropper",
  "lotion-pump": "lotionpump",
  reducer: "reducer",
} as const;

export function parseBrowseContext(
  pathname: string,
  params: URLSearchParams,
): BrowseContext;

export function browseContextToFilters(context: BrowseContext): Partial<CatalogFilters>;
export function applicationFinderHref(application: ApplicatorNavValue): string;
export function familyFinderHref(family: string, context?: Partial<BrowseContext>): string;
```

Family is inferred from `/catalog/cylinder`; application is inferred from `/catalog/application/roll-on`; refinements remain in canonical query parameters. Use `applicators` for catalog buckets and `roller` for `metal,plastic` values.

- [ ] Extend `CatalogFilters` with `rollerMaterials: RollerMaterial[]`, `CatalogFacetKey` with `rollerMaterials`, and the catalog result facets with `rollerMaterials: Record<RollerMaterial, number>`.

- [ ] Implement one shared `rollerMaterialMatchesProductValues` helper in `catalogFilters.ts` and use it in both `buildCatalogSearchResult` and `convex/products.ts::searchCatalog`. Derive the facet from `productGroups.applicatorTypes`; do not scan or hard-code family names.

- [ ] Extend `normalizeCatalogSearchArgs` and the Convex validator with `rollerMaterials`, and add `roller` to `CATALOG_FACET_PARAM_KEYS` so Grace navigation cannot leave stale roller state behind.

- [ ] Add `applicationCatalogSurface(application)` to `catalogSurface.ts`. It must use the appropriate canonical bucket(s), expose only `capacities`, `rollerMaterials` when Roll-On, `colors`, `neckThreadSizes`, and `families`, and default to `capacity-asc`.

- [ ] Run focused tests:

```bash
npx vitest run tests/focused-shopping-context.test.ts tests/catalogFilters.test.ts tests/catalog-vocabulary-alignment.test.ts tests/catalogSearchClient.test.ts tests/catalogSurface.test.ts tests/catalog-server-sanitization.test.ts
```

- [ ] Commit:

```bash
git add src/lib/products/focused-shopping.ts src/lib/catalogFilters.ts src/lib/catalogSearchFallback.ts src/lib/catalogServer.ts convex/products.ts src/lib/catalogSurface.ts tests/focused-shopping-context.test.ts tests/catalogFilters.test.ts tests/catalog-vocabulary-alignment.test.ts tests/catalogSearchClient.test.ts
git commit -m "feat(catalog): add canonical focused-shopping context"
```

## Task 3: Enrich Catalog Results with the B2B Decision Fields

**Files:**

- Modify: `src/lib/catalogSearchFallback.ts`
- Modify: `convex/products.ts`
- Create: `src/lib/products/guided-finder.ts`
- Test: `tests/guided-finder-model.test.ts`
- Test: `tests/catalogProductGrid.test.ts`

- [ ] Write failing tests proving an exact result model exposes:
  - approved product image with the existing fallback policy;
  - family, exact capacity, color, application, roller material, and neck finish;
  - explicit stock/confirm-availability state;
  - case quantity;
  - starting unit price;
  - `checkoutReady` derived through `isCheckoutReady`, including `shopifySellable === false` overriding a variant ID;
  - exact `/products/[slug]` destination;
  - family grouping sorted by the existing `FAMILY_ORDER`, then capacity.

- [ ] Run the new tests and confirm they fail:

```bash
npx vitest run tests/guided-finder-model.test.ts tests/catalogProductGrid.test.ts tests/checkout-readiness.test.ts
```

- [ ] Extend every catalog variant-preview producer and type with these narrow fields:

```ts
stockStatus: string | null;
caseQuantity: number | null;
webPrice1pc: number | null;
shopifyVariantId: string | null;
shopifySellable: boolean | null;
```

Update both `searchCatalog` and `getCatalogGroupVariantPreviewData`; keep the fallback interface in lockstep.

- [ ] Implement `guided-finder.ts` with pure functions:

```ts
export type GuidedFinderProduct = { /* the tested B2B fields above */ };
export type GuidedFinderFamily = {
  family: string;
  exactProducts: GuidedFinderProduct[];
};

export function buildGuidedFinderFamilies(
  result: CatalogSearchResultShape,
): GuidedFinderFamily[];

export function conflictingRefinement(
  context: BrowseContext,
  facets: CatalogSearchResultShape["facets"],
): keyof BrowseContext | null;
```

Do not infer stock or checkout readiness from a non-null price.

- [ ] Run tests:

```bash
npx vitest run tests/guided-finder-model.test.ts tests/catalogProductGrid.test.ts tests/checkout-readiness.test.ts tests/catalogResultIntegrity.test.ts
```

- [ ] Commit:

```bash
git add src/lib/catalogSearchFallback.ts convex/products.ts src/lib/products/guided-finder.ts tests/guided-finder-model.test.ts tests/catalogProductGrid.test.ts
git commit -m "feat(catalog): expose B2B fields for exact finder results"
```

## Task 4: Build Reusable Focused-Finder UI

**Files:**

- Create: `src/components/catalog/FocusedApplicationCards.tsx`
- Create: `src/components/catalog/FocusedFinderControls.tsx`
- Create: `src/components/catalog/FocusedFinderResults.tsx`
- Create: `src/components/catalog/FocusedProductCard.tsx`
- Create: `src/components/catalog/FinderNavigationMemory.tsx`
- Test: `tests/focused-finder-components.test.ts`

- [ ] Add failing source-contract and pure-behavior tests proving:
  - results render before any optional refinement;
  - application cards are buttons/links with `aria-pressed` or current-route state;
  - Capacity and Roller Material use visible 44px controls, not a mandatory wizard;
  - result updates announce count through `aria-live="polite"`;
  - family headings contain exact product cards rather than a broad family-only destination;
  - zero-result recovery exposes a one-click removal action and never changes filters silently;
  - each result link preserves the exact finder URL in a safe `from` query parameter;
  - session storage restores the expanded family and scroll position for the exact finder URL.

- [ ] Run and observe failure:

```bash
npx vitest run tests/focused-finder-components.test.ts tests/guided-finder-model.test.ts
```

- [ ] Implement the four presentational components using the existing Best Bottles tokens (`bone`, `obsidian`, `muted-gold`, `champagne`), serif identity, thin borders, no decorative gradients, and no floating card shadows.

- [ ] Implement `FinderNavigationMemory` with a namespaced session-storage key based on `pathname + search`. Restore only same-route state, and validate `from` values with:

```ts
export function safeCatalogReturnPath(value: string | null): string | null {
  if (!value?.startsWith("/catalog")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
```

- [ ] Use the existing `ProductCardImagePreview`, `getProductCardVariantPreviews`, `getCustomerFacingProductName`, and image-fallback rules in `FocusedProductCard`. Do not create a second product-image resolver.

- [ ] Run tests and lint:

```bash
npx vitest run tests/focused-finder-components.test.ts tests/product-card-variant-previews.test.ts tests/product-image-fallback.test.ts
npx eslint src/components/catalog/FocusedApplicationCards.tsx src/components/catalog/FocusedFinderControls.tsx src/components/catalog/FocusedFinderResults.tsx src/components/catalog/FocusedProductCard.tsx src/components/catalog/FinderNavigationMemory.tsx
```

- [ ] Commit:

```bash
git add src/components/catalog/FocusedApplicationCards.tsx src/components/catalog/FocusedFinderControls.tsx src/components/catalog/FocusedFinderResults.tsx src/components/catalog/FocusedProductCard.tsx src/components/catalog/FinderNavigationMemory.tsx tests/focused-finder-components.test.ts
git commit -m "feat(catalog): add reusable focused-finder interface"
```

## Task 5: Implement the Application-First Finder

**Files:**

- Create: `src/app/catalog/application/[application]/page.tsx`
- Create: `src/app/catalog/application/[application]/ApplicationFinderClient.tsx`
- Modify: `src/components/HomePage.tsx`
- Modify: `src/components/Navbar.tsx`
- Test: `tests/application-finder-route.test.ts`

- [ ] Write failing tests for:
  - `/catalog/application/roll-on` selecting Roll-On before client hydration;
  - initial products being visible with no capacity/material choice;
  - capacity and roller choices updating the URL and result request in place;
  - `spray`, `dropper`, `lotion-pump`, and `reducer` mapping only to existing canonical buckets;
  - unknown route slugs returning `notFound()`;
  - homepage applicator links targeting the dedicated finder while the Navbar's general Catalog link remains `/catalog`;
  - the secondary **Build a Bottle** link targeting `/matrix`.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/application-finder-route.test.ts tests/focused-shopping-context.test.ts
```

- [ ] In the server page, parse the route slug with `focused-shopping.ts`, call `searchCatalogServer` with `applicationCatalogSurface`, and pass both the unrefined facet source and the active result into the client component. Invalid applications call `notFound()`.

- [ ] In the client component, update the URL with `router.replace`, refetch through `fetchCatalogSearch`, keep results rendered during the request, and focus the results heading after an application scope switch. Do not add Next or Apply buttons.

- [ ] Render a persistent summary such as `Roll-On / 9 ml / Metal roller` only from active values. Disabled zero-count controls must use `disabled`, `aria-disabled`, and explanatory text or title.

- [ ] Run tests and lint:

```bash
npx vitest run tests/application-finder-route.test.ts tests/focused-finder-components.test.ts tests/catalogSearchClient.test.ts
npx eslint 'src/app/catalog/application/[application]/page.tsx' 'src/app/catalog/application/[application]/ApplicationFinderClient.tsx' src/components/HomePage.tsx src/components/Navbar.tsx
```

- [ ] Commit:

```bash
git add 'src/app/catalog/application/[application]/page.tsx' 'src/app/catalog/application/[application]/ApplicationFinderClient.tsx' src/components/HomePage.tsx src/components/Navbar.tsx tests/application-finder-route.test.ts
git commit -m "feat(catalog): add application-first bottle finder"
```

## Task 6: Convert Cylinder to the Family-First Finder

**Files:**

- Modify: `src/app/catalog/cylinder/page.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Modify: `src/lib/products/cylinder-family-page.ts`
- Modify: `tests/cylinder-family-page.test.ts`
- Test: `tests/cylinder-focused-finder.test.ts`

- [ ] Replace tests that encode the retired multi-application `BuilderPreview` with failing tests for:
  - Cylinder being fixed by the route and never shown as a required choice;
  - verified application cards being derived from the Cylinder result set;
  - selecting Roll-On producing `/catalog/cylinder?applicators=rollon` plus optional capacity/roller parameters;
  - results updating in place and retaining the application-card scope switcher;
  - one remaining exact product not auto-navigating;
  - every exact card linking directly to a PDP;
  - **Build a Bottle** remaining secondary.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/cylinder-family-page.test.ts tests/cylinder-focused-finder.test.ts
```

- [ ] Remove `CYLINDER_9ML_BUILDER_OPTIONS` and `BuilderPreview` from the family discovery surface. Retain any functions still used by existing 9 mL deep links until Task 9 migrates them; do not break historical PDP URLs in this task.

- [ ] Reuse the components from Task 4. Keep the existing family editorial hero, but make the finder the operative shopping area directly below it. The application cards must be computed from live Cylinder facets/variants, not the three-item mockup array.

- [ ] Make the Cylinder page server request respect canonical URL filters on first render, so refresh and share reproduce the same results without a client-side flash.

- [ ] Run tests and lint:

```bash
npx vitest run tests/cylinder-family-page.test.ts tests/cylinder-focused-finder.test.ts tests/catalog.smoke.test.ts tests/catalogResultIntegrity.test.ts
npx eslint src/app/catalog/cylinder/page.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx src/lib/products/cylinder-family-page.ts
```

- [ ] Commit:

```bash
git add src/app/catalog/cylinder/page.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx src/lib/products/cylinder-family-page.ts tests/cylinder-family-page.test.ts tests/cylinder-focused-finder.test.ts
git commit -m "feat(catalog): make Cylinder a family-first finder"
```

## Task 7: Add the Focused-PDP Relations Query

**Files:**

- Create: `src/lib/products/pdp-relations.ts`
- Modify: `convex/products.ts`
- Modify: `convex/grace.ts`
- Modify: `src/app/products/[slug]/page.tsx`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Test: `tests/pdp-relations.test.ts`
- Test: `tests/compatibility-resolver-parity.test.ts`

- [ ] Write failing unit tests for `buildFocusedPdpRelations` proving:
  - same-family + same-application + different-capacity groups go only into **Also available in these sizes**;
  - same-family + different-application groups go only into **Other ways to dispense**;
  - the current group is marked in the size list and never duplicated;
  - different neck sizes are allowed as alternate sizes but are labeled accurately, never called compatible components;
  - duplicate colors/groups collapse by canonical group identity, not display name;
  - no hard-coded Cylinder-only behavior exists.

- [ ] Add a failing parity test that asserts `convex/matrix.ts`, `convex/grace.ts`, and the new PDP compatibility path all compose:

```ts
normalizeComponentsByType
selectBestFitmentRule
filterGroupedComponentsByFitmentRule
```

- [ ] Run and confirm failure:

```bash
npx vitest run tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts
```

- [ ] Implement `buildFocusedPdpRelations(currentGroup, familyGroups)` as a pure function using canonical application classification from Task 2.

- [ ] Add read-only `products.getFocusedPdpRelations({ slug })`. It loads the current group plus that family's `productGroups`, filters out zero-variant groups and legacy aliases, and returns only the narrow relation card fields needed by the PDP.

- [ ] Extend `grace.getBottleComponents` to return component `imageUrl`, `shopifyVariantId`, and `shopifySellable`. Let the UI call the existing `isCheckoutReady` helper; do not duplicate checkout eligibility or fitment logic inside Convex.

- [ ] Load relations and primary-SKU compatibility in `src/app/products/[slug]/page.tsx` with the existing sibling, Sanity block, and plate requests. Pass them as initial props so the lower page does not begin empty.

- [ ] Run tests:

```bash
npx vitest run tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts tests/graceSearchUtils.test.ts tests/closure-swatch-keys.test.ts
```

- [ ] Commit:

```bash
git add src/lib/products/pdp-relations.ts convex/products.ts convex/grace.ts 'src/app/products/[slug]/page.tsx' 'src/app/products/[slug]/ProductDetailClient.tsx' tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts
git commit -m "feat(pdp): derive sizes alternatives and components from product truth"
```

## Task 8: Build the Shared Two-Panel PDP Shell and Stage Dock

**Files:**

- Create: `src/components/products/FocusedPdpLayout.tsx`
- Create: `src/components/products/PdpStageModeDock.tsx`
- Create: `src/lib/products/pdp-stage-modes.ts`
- Modify: `src/components/products/ConfiguratorPdp.tsx`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Test: `tests/focused-pdp-layout.test.ts`
- Test: `tests/pdp-stage-modes.test.ts`

- [ ] Write failing tests proving:
  - desktop has exactly two primary columns, approximately `minmax(0, 1.6fr) minmax(360px, 0.95fr)`;
  - the product stage is visually dominant and retains the 10:11 plate aspect;
  - mobile stacks stage before purchase panel at 390px;
  - mode availability is data-driven: Photo/Configure requires an image or plate, 3D requires approved geometry, Exploded requires a released kit, Dimensions requires real dimension fields;
  - unsupported modes are omitted, not disabled placeholders;
  - Diva/photo-only groups never show 3D;
  - active stage mode remains stable when a valid in-intent variant changes.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/focused-pdp-layout.test.ts tests/pdp-stage-modes.test.ts tests/cylinder-v3-acceptance.test.ts
```

- [ ] Implement `FocusedPdpLayout` as a slot component with `stage`, `purchase`, and optional `mobileStickySummary`. Use container queries or a measured container class so a Grace inset can switch to the stacked form before either panel clips.

- [ ] Extract the existing Photo/3D/Exploded controls from `ConfiguratorPdp` into `PdpStageModeDock`; add Dimensions only when real height/diameter data exists. Keep the current stage image/plate/3D selection and fallback functions intact.

- [ ] Replace the current three-column `stage | steps | configuration` desktop grid in `ConfiguratorPdp` with the shared two-panel shell. Combine identity, valid options, summary, price, quantity, and CTA into the right panel.

- [ ] Apply the same `FocusedPdpLayout` wrapper to photo-only/classic PDPs in `ProductDetailClient`, preserving their image gallery and purchase logic while removing layout duplication.

- [ ] Run tests and lint:

```bash
npx vitest run tests/focused-pdp-layout.test.ts tests/pdp-stage-modes.test.ts tests/cylinder-v3-acceptance.test.ts tests/product-image-fallback.test.ts tests/responsive-shell-contract.test.ts
npx eslint src/components/products/FocusedPdpLayout.tsx src/components/products/PdpStageModeDock.tsx src/lib/products/pdp-stage-modes.ts src/components/products/ConfiguratorPdp.tsx 'src/app/products/[slug]/ProductDetailClient.tsx'
```

- [ ] Commit:

```bash
git add src/components/products/FocusedPdpLayout.tsx src/components/products/PdpStageModeDock.tsx src/lib/products/pdp-stage-modes.ts src/components/products/ConfiguratorPdp.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' tests/focused-pdp-layout.test.ts tests/pdp-stage-modes.test.ts
git commit -m "refactor(pdp): establish the split product workspace"
```

## Task 9: Restrict the Purchase Panel to One Product Intent

**Files:**

- Modify: `src/components/products/ConfiguratorPdp.tsx`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Modify: `tests/pdp-closure-rail.test.ts`
- Create: `tests/focused-pdp-purchase-panel.test.ts`

- [ ] Rewrite the old closure-rail test around the new invariant while retaining its protected photo-resolution assertions. Add failing tests proving:
  - no `Closure Type`/application switcher is rendered above the fold;
  - a Roll-On PDP exposes only valid Roll-On options: glass/color siblings, roller material when offered, cap/closure finish, pack/case quantity, order quantity;
  - another application navigates only from **Other ways to dispense** below the fold;
  - there is no decoration selector;
  - price, selected SKU, stock/quote state, stage media, and Add to Cart resolve from the same selected variant;
  - `shopifySellable === false` routes to Request Quote rather than a dead checkout;
  - no unsupported Request Sample CTA is invented.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/pdp-closure-rail.test.ts tests/focused-pdp-purchase-panel.test.ts tests/checkout-readiness.test.ts
```

- [ ] Remove `closureRow`, `ranked` cross-application tiles, and `commit(base)` from the primary panel. Keep `activeBase` derivation because the stage and `componentPhotoSkuBelongsToBase` still need the current product's applicator identity.

- [ ] Keep `photoKeysForVariant` and `resolveCapOptionPhoto` in the finish-option path. Do not replace photographed closure swatches with display-name/color-only lookup.

- [ ] Make quantity a direct numeric input with decrement/increment controls and enforce `>= 1`. Keep per-unit and case/pack pricing visible beside the CTA.

- [ ] When a glass, roller material, or cap-finish selection resolves another real SKU/group, update the canonical product URL with `router.replace` and preserve stage mode plus safe `from` context. Never synthesize a SKU locally.

- [ ] Run the focused PDP and protected image tests:

```bash
npx vitest run tests/pdp-closure-rail.test.ts tests/focused-pdp-purchase-panel.test.ts tests/closure-swatch-keys.test.ts tests/paper-doll-mapping-resolver.test.ts tests/checkout-readiness.test.ts
```

- [ ] Commit:

```bash
git add src/components/products/ConfiguratorPdp.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' tests/pdp-closure-rail.test.ts tests/focused-pdp-purchase-panel.test.ts
git commit -m "feat(pdp): focus the buy panel on one dispensing intent"
```

## Task 10: Render the Three Distinct Below-Fold Buying Sections

**Files:**

- Create: `src/components/products/PdpDiscoverySections.tsx`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Test: `tests/pdp-discovery-sections.test.ts`

- [ ] Write failing tests proving the fixed order and vocabulary:
  1. **Also available in these sizes**;
  2. **Other ways to dispense**;
  3. **Compatible components**;
  4. technical specifications and volume/fulfillment content;
  5. **Compare all compatible combinations** linking to `/matrix?family=<family>`.

- [ ] Add tests that reject `comes with` for alternatives/components and require the phrases `Also available as` and `Compatible with this bottle` where appropriate.

- [ ] Add tests that component cards expose the actual fitment-resolved SKU, image, availability, unit price, and cart/quote state; unknown compatibility must say it is unmapped and offer Grace rather than show an empty-compatible state.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts
```

- [ ] Implement `PdpDiscoverySections` from `FocusedPdpRelations` and `getBottleComponents`. Fetch compatibility again when the selected SKU changes, while keeping the server-provided initial result visible during transition.

- [ ] Remove the old in-buy-box `This bottle also takes` block and any duplicate cross-applicator list. Keep technical specs, volume pricing, fulfillment information, and Sanity editorial content below the three decision sections.

- [ ] Use approved product/component images only; missing images render the existing honest media-preparation fallback.

- [ ] Run tests and lint:

```bash
npx vitest run tests/pdp-discovery-sections.test.ts tests/pdp-relations.test.ts tests/compatibility-resolver-parity.test.ts tests/product-image-fallback.test.ts
npx eslint src/components/products/PdpDiscoverySections.tsx 'src/app/products/[slug]/ProductDetailClient.tsx'
```

- [ ] Commit:

```bash
git add src/components/products/PdpDiscoverySections.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' tests/pdp-discovery-sections.test.ts
git commit -m "feat(pdp): separate sizes dispensing alternatives and components"
```

## Task 11: Make Grace Push Container-Aware and Preserve Exact Shopping Context

**Files:**

- Modify: `src/lib/grace/pushLayout.ts`
- Modify: `src/components/grace/GraceLayoutShell.tsx`
- Modify: `src/components/grace/GraceChatDrawer.tsx`
- Modify: `src/components/grace/GraceProvider.tsx`
- Modify: `src/components/GraceContext.ts`
- Create: `src/lib/grace/pageContextEvents.ts`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Test: `tests/grace-push-layout.test.ts`
- Test: `tests/grace-shopping-context.test.ts`

- [ ] Extend the failing Grace layout tests to cover:
  - push mode only when `availableContentWidth >= 920` after subtracting the real drawer width;
  - overlay before the two-panel PDP drops below its safe content width;
  - homepage/editorial routes remaining overlay-only;
  - `/catalog`, family finders, application finders, and `/products/*` being push-eligible;
  - close/navigation preserving the conversation and explicit New Chat resetting it.

- [ ] Write failing context tests proving Grace receives:
  - finder entry mode, family, application, capacity, roller material, and current result URL;
  - exact PDP SKU, selected application, selected glass/roller/finish values, and current URL;
  - broad recommendations navigating to a finder;
  - exact resolved products navigating directly to a PDP.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts tests/grace-catalog-navigation.test.ts
```

- [ ] Change `resolveGraceSurface` to receive measured `viewportWidth`, resolved drawer width, and `minimumContentWidth`. `GraceLayoutShell` should use a `ResizeObserver`/window resize measurement and expose `--grace-content-inset`; it must not decide solely from the old 1100px breakpoint.

- [ ] Keep Grace as a side drawer, not a third PDP column. On overlay mode, render the backdrop and leave the underlying page width unchanged. At mobile widths use full/near-full-screen overlay and do not permanently consume the mobile tab bar.

- [ ] Add a typed `bestbottles:pdp-context-change` event in `pageContextEvents.ts`. Dispatch it whenever the PDP's actual selected SKU/options change; merge it into `GraceProvider`'s page context. Finder context remains parsed from route and query parameters.

- [ ] Confirm closing and reopening Grace preserves both messages and page state. Only `handleNewChat` may call the conversation reset path.

- [ ] Run Grace and responsive tests:

```bash
npx vitest run tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts tests/grace-catalog-navigation.test.ts tests/graceRefineState.test.ts tests/responsive-shell-contract.test.ts
```

- [ ] Commit:

```bash
git add src/lib/grace/pushLayout.ts src/components/grace/GraceLayoutShell.tsx src/components/grace/GraceChatDrawer.tsx src/components/grace/GraceProvider.tsx src/components/GraceContext.ts src/lib/grace/pageContextEvents.ts 'src/app/products/[slug]/ProductDetailClient.tsx' tests/grace-push-layout.test.ts tests/grace-shopping-context.test.ts
git commit -m "feat(grace): preserve context beside focused shopping"
```

## Task 12: Present the Existing Matrix as Build a Bottle

**Files:**

- Modify: `src/app/matrix/page.tsx`
- Modify: `src/components/matrix/MatrixClient.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/Footer.tsx`
- Test: `tests/product-compatibility-matrix.test.ts`

- [ ] Write failing tests proving:
  - the H1 is `Build a Bottle`;
  - the visible subtitle and metadata use `Product Compatibility Matrix`;
  - the page remains public and does not promise wholesale-only pricing;
  - family, size, finish, neck, and closure filters remain family-scoped;
  - every component list still comes from `convex/componentUtils.ts` through `convex/matrix.ts`;
  - unknown compatibility is not treated as compatible;
  - finder and PDP links can preselect `?family=` without creating a second compatibility engine.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/product-compatibility-matrix.test.ts tests/compatibility-resolver-parity.test.ts
```

- [ ] Rename customer-facing copy only. Keep `/matrix` stable and keep the existing single-price/tax explanation.

- [ ] Add a visible utility entry to Navbar/Footer labeled **Build a Bottle**. Keep **Catalog** as a separate destination.

- [ ] Ensure the matrix's product/component links point to exact PDP or catalog identities and never describe the component as included.

- [ ] Run tests and lint:

```bash
npx vitest run tests/product-compatibility-matrix.test.ts tests/compatibility-resolver-parity.test.ts tests/customer-facing-product-names.test.ts
npx eslint src/app/matrix/page.tsx src/components/matrix/MatrixClient.tsx src/components/Navbar.tsx src/components/Footer.tsx
```

- [ ] Commit:

```bash
git add src/app/matrix/page.tsx src/components/matrix/MatrixClient.tsx src/components/Navbar.tsx src/components/Footer.tsx tests/product-compatibility-matrix.test.ts
git commit -m "feat(matrix): present compatibility tool as Build a Bottle"
```

## Task 13: Add Measurement Without Leaking Sensitive Data

**Files:**

- Modify: `src/lib/analytics.ts`
- Modify: finder client components from Tasks 5-6
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Modify: `src/components/products/PdpDiscoverySections.tsx`
- Modify: `src/components/matrix/MatrixClient.tsx`
- Modify: `tests/analytics-events.test.ts`

- [ ] Add failing analytics tests for these provider-agnostic methods:

```ts
finderEntered({ entryMode, application?, family?, resultCount })
finderRefined({ entryMode, dimension, action, value, resultCount })
finderZeroResultRecovered({ entryMode, removedDimension })
finderResultOpened({ entryMode, family, application?, slug })
matrixOpened({ source: "finder" | "pdp" | "nav" | "grace", family? })
graceOpenedFromShopping({ source: "finder" | "pdp", family?, application? })
pdpVariantResolved({ slug, sku, application, dimension? })
```

Do not send customer text, uploaded files, formulas, or conversation content.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/analytics-events.test.ts
```

- [ ] Implement the methods through the existing adapter and call them at the real interaction boundaries. Keep existing Add to Cart and form events; do not double-count them.

- [ ] Run analytics plus finder/PDP tests:

```bash
npx vitest run tests/analytics-events.test.ts tests/application-finder-route.test.ts tests/cylinder-focused-finder.test.ts tests/focused-pdp-purchase-panel.test.ts tests/pdp-discovery-sections.test.ts
```

- [ ] Commit:

```bash
git add src/lib/analytics.ts 'src/app/catalog/application/[application]/ApplicationFinderClient.tsx' src/app/catalog/cylinder/CylinderFamilyPageClient.tsx 'src/app/products/[slug]/ProductDetailClient.tsx' src/components/products/PdpDiscoverySections.tsx src/components/matrix/MatrixClient.tsx tests/analytics-events.test.ts
git commit -m "feat(analytics): measure focused shopping journeys"
```

## Task 14: Activate the Focused PDP Safely Across Product Groups

**Files:**

- Create: `src/lib/products/focused-pdp-rollout.ts`
- Modify: `src/app/products/[slug]/ProductDetailClient.tsx`
- Modify: `src/app/products/[slug]/page.tsx`
- Test: `tests/focused-pdp-rollout.test.ts`
- Test: `tests/legacy-product-route-overrides.test.ts`

- [ ] Write failing rollout tests proving:
  - the 9 mL Clear Cylinder 17-415 Roll-On is the first reference product;
  - groups with real variants and at least one approved photo/plate use the shared two-panel shell;
  - groups lacking 3D/kit media still use the shell with photo-only modes;
  - legacy aliases continue redirecting to canonical PDPs;
  - direct SKU/PDP URLs do not require finder state;
  - no product is hidden solely because media is incomplete;
  - invalid or empty product groups remain non-purchasable.

- [ ] Run and confirm failure:

```bash
npx vitest run tests/focused-pdp-rollout.test.ts tests/legacy-product-route-overrides.test.ts tests/product-image-fallback.test.ts
```

- [ ] Implement a pure capability gate, not a hard-coded family inventory. The gate may select shell capabilities from real fields:

```ts
resolveFocusedPdpCapabilities({
  hasVariants,
  hasApprovedPhoto,
  hasPlate,
  hasApproved3d,
  hasReleasedKit,
  hasDimensions,
});
```

The 9 mL Cylinder can be named only as the staged reference/acceptance fixture; eligibility for other products is field-driven.

- [ ] Remove any now-dead unified-cohort/family builder UI that redirects back into a catalog-wide configurator, while retaining redirects for historical inbound URLs.

- [ ] Run rollout and regression tests:

```bash
npx vitest run tests/focused-pdp-rollout.test.ts tests/legacy-product-route-overrides.test.ts tests/product-image-fallback.test.ts tests/unified-cylinder-pdp.test.ts tests/cylinder-9ml-cohort.test.ts
```

- [ ] Commit:

```bash
git add src/lib/products/focused-pdp-rollout.ts 'src/app/products/[slug]/ProductDetailClient.tsx' 'src/app/products/[slug]/page.tsx' tests/focused-pdp-rollout.test.ts tests/legacy-product-route-overrides.test.ts
git commit -m "feat(pdp): roll out the focused shell with media fallbacks"
```

## Task 15: Full Verification and Handoff

**Files:**

- Create: `docs/reviews/focused-b2b-shopping-2026-09-03.md`
- Verify all touched files and routes

- [ ] Run all unit/integration tests:

```bash
npx vitest run
```

- [ ] Run catalog truth and protected image-policy tests explicitly:

```bash
npx vitest run tests/product-truth-reconciliation.test.ts tests/catalog-vocabulary-alignment.test.ts tests/compatibility-resolver-parity.test.ts tests/closure-swatch-keys.test.ts tests/paper-doll-master-source-policy.test.mjs tests/paper-doll-source-lineage.test.mjs
```

- [ ] Run TypeScript, touched-file lint, and production build:

```bash
npx tsc --noEmit
npx eslint src/app/catalog src/app/products src/app/matrix src/components/catalog src/components/products src/components/grace src/lib/catalogFilters.ts src/lib/catalogSearchFallback.ts src/lib/catalogServer.ts src/lib/products src/lib/grace convex/products.ts convex/grace.ts convex/matrix.ts
npm run build
```

- [ ] Start the local site and verify these journeys at 1440px, with Grace both closed and open:
  - `/catalog` retains the general filter catalog;
  - `/catalog/application/roll-on` shows immediate results and optional live refinements;
  - `/catalog/cylinder` retains Cylinder while switching applications;
  - `/products/cylinder-9ml-clear-17-415-rollon` shows the split stage/purchase layout with no application switcher;
  - the PDP lower sections are distinct and `/matrix?family=Cylinder` opens from the final link;
  - `/matrix?family=Cylinder` displays Build a Bottle / Product Compatibility Matrix.

- [ ] Repeat the PDP/finder journeys at 390px. Confirm no bottle, control label, price, availability state, or primary CTA is clipped; Grace opens as an overlay and returns to the exact state.

- [ ] Verify back navigation restores finder URL, expanded family, and practical scroll position. Verify a copied canonical PDP URL opens and purchases without finder history.

- [ ] Record route, viewport, test/build results, any intentionally unsupported media modes, and screenshots in `docs/reviews/focused-b2b-shopping-2026-09-03.md`.

- [ ] Run the safety diff checks:

```bash
git status --short
git diff --check 3df2b635..HEAD
git diff --name-only 3df2b635..HEAD | rg 'data/.+(inventory|selection|xref)|legacy.+PSD|BB-PSD'
git log --oneline --decorate 3df2b635..HEAD
```

Expected: no production data changes, no regenerated large artifacts, no legacy PSD path, and all task commits present.

- [ ] Commit the review evidence:

```bash
git add docs/reviews/focused-b2b-shopping-2026-09-03.md
git commit -m "docs: verify focused B2B shopping architecture"
```

## Definition of Done

- The general catalog still works independently with its filter system.
- Family-first shoppers never reselect the family.
- Application-first shoppers see exact products before refining.
- Exact result cards expose B2B decision fields and go directly to stable PDP URLs.
- The desktop PDP is a dominant stage plus one focused purchase panel; mobile is complete at 390px.
- Cross-application choices are absent above the fold and separated below it from compatible components.
- Grace preserves page, filter, selected SKU, and conversation state; it pushes only when safe.
- Build a Bottle remains a dedicated compatibility matrix using the same fitment resolver as the PDP.
- Protected image-selection behavior, master-only PSD sourcing, direct reorder/SKU paths, and truthful checkout/availability behavior remain intact.
- Focused tests, full tests, lint, TypeScript, production build, responsive verification, and safety diff checks pass.
