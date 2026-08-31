# Universal Catalog Refine and Continuous Product Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cylinder-only filtering evaluator with the same canonical Convex-backed catalog query used by the master catalog, then give both shopping surfaces the approved Refine behavior and premium continuous divider grid.

**Architecture:** `CatalogFilters`, `SortValue`, and `ViewMode` remain the only public state vocabulary. A small `CatalogSurfaceManifest` fixes immutable scope and controls presentation; `/api/catalog/search` and `products.searchCatalog` remain the only result/facet evaluator. The Cylinder page retains a complete family snapshot only for its editorial hero and builder preview, while its ready-made list is constructed exclusively from the current authoritative query response.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Convex, Vitest, Mixpanel analytics adapter.

## Global Constraints

- Preserve the strict separation between `9 mL · 13-415` and `9 mL · 17-415`.
- Preserve all user-owned and unrelated working-tree files; stage only files named in the active task.
- Do not change Paper Doll/Sanity asset release behavior in this implementation.
- Do not introduce a second result evaluator, second URL vocabulary, or client-side faceting engine.
- Use canonical capacity values such as `9 ml` in URLs; ounce equivalents are presentation labels only.
- Keep the master catalog line view intact; the continuous grid applies to visual card views and their skeletons.
- Treat accessibility, failure states, and mobile drawer draft behavior as release requirements.

---

## Task 1: Define the universal surface contract

**Files:**

- Create: `src/lib/catalogSurface.ts`
- Create: `tests/catalogSurface.test.ts`
- Modify: `src/lib/catalogFilters.ts`

- [ ] **Step 1: Write the failing surface-contract tests**

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import {
    CYLINDER_CATALOG_SURFACE,
    MASTER_CATALOG_SURFACE,
    applyCatalogSurface,
} from "@/lib/catalogSurface";

describe("catalog surface manifests", () => {
    it("leaves master catalog scope open", () => {
        expect(applyCatalogSurface(
            { ...EMPTY_FILTERS, capacities: ["9 ml"] },
            MASTER_CATALOG_SURFACE,
        ).families).toEqual([]);
    });

    it("makes Cylinder scope immutable without dropping customer constraints", () => {
        expect(applyCatalogSurface({
            ...EMPTY_FILTERS,
            families: ["Boston Round"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        }, CYLINDER_CATALOG_SURFACE)).toMatchObject({
            families: ["Cylinder"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        });
    });

    it("opens Capacity by default on Cylinder and exposes only its approved facets", () => {
        expect(CYLINDER_CATALOG_SURFACE.visibleFacets).toEqual([
            "capacities", "colors", "applicators", "neckThreadSizes",
        ]);
        expect(CYLINDER_CATALOG_SURFACE.defaultOpenFacets).toEqual(["capacities"]);
    });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npx vitest run tests/catalogSurface.test.ts`

Expected: FAIL because `@/lib/catalogSurface` does not exist.

- [ ] **Step 3: Add the facet key and surface manifest implementation**

Add the public facet key beside `CatalogFilters` in `src/lib/catalogFilters.ts`:

```ts
export type CatalogFacetKey =
    | "applicators"
    | "families"
    | "capacities"
    | "colors"
    | "neckThreadSizes"
    | "category"
    | "collection"
    | "componentType"
    | "price";
```

Create `src/lib/catalogSurface.ts`:

```ts
import {
    EMPTY_FILTERS,
    type CatalogFacetKey,
    type CatalogFilters,
    type SortValue,
} from "@/lib/catalogFilters";

export type CatalogSurfaceManifest = {
    id: "master" | "cylinder";
    fixedFilters: Partial<CatalogFilters>;
    visibleFacets: CatalogFacetKey[];
    defaultOpenFacets: CatalogFacetKey[];
    defaultSort: SortValue;
    resultLabel: string;
};

export const MASTER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "master",
    fixedFilters: {},
    visibleFacets: ["applicators", "families", "capacities", "colors", "category", "collection", "componentType", "neckThreadSizes", "price"],
    defaultOpenFacets: ["applicators", "families", "capacities"],
    defaultSort: "featured",
    resultLabel: "products",
};

export const CYLINDER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "cylinder",
    fixedFilters: { families: ["Cylinder"] },
    visibleFacets: ["capacities", "colors", "applicators", "neckThreadSizes"],
    defaultOpenFacets: ["capacities"],
    defaultSort: "capacity-asc",
    resultLabel: "Cylinder groups",
};

export function applyCatalogSurface(
    filters: Partial<CatalogFilters>,
    surface: CatalogSurfaceManifest,
): CatalogFilters {
    return {
        ...EMPTY_FILTERS,
        ...filters,
        ...surface.fixedFilters,
    };
}
```

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/catalogSurface.test.ts tests/catalogFilters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/catalogFilters.ts src/lib/catalogSurface.ts tests/catalogSurface.test.ts
git commit -m "feat(catalog): define universal surface manifests"
```

---

## Task 2: Add a shared catalog-search request and integrity contract

**Files:**

- Create: `src/lib/catalogSearchClient.ts`
- Create: `src/lib/catalogResultIntegrity.ts`
- Create: `tests/catalogSearchClient.test.ts`
- Create: `tests/catalogResultIntegrity.test.ts`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Write failing tests for one request shape and strict thread integrity**

```ts
import { describe, expect, it } from "vitest";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";

describe("buildCatalogSearchArgs", () => {
    it("produces the same canonical API shape for Grace, master, and family UI state", () => {
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters: {
                capacities: ["9 ml"],
                applicators: ["rollon"],
                neckThreadSizes: ["17-415"],
            },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
        })).toMatchObject({
            filters: {
                families: ["Cylinder"],
                capacities: ["9 ml"],
                applicators: ["rollon"],
                neckThreadSizes: ["17-415"],
            },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
            cursor: null,
        });
    });
});
```

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import { auditCatalogResult } from "@/lib/catalogResultIntegrity";

describe("catalog result integrity", () => {
    it("flags a 13-415 group under an active 17-415 constraint", () => {
        expect(auditCatalogResult({
            filters: { ...EMPTY_FILTERS, neckThreadSizes: ["17-415"] },
            expectedCount: 1,
            items: [{ _id: "bad", neckThreadSize: "13-415" }],
        })).toEqual({
            status: "constraint_mismatch",
            expectedCount: 1,
            renderedCount: 1,
            violatingGroupIds: ["bad"],
        });
    });
});
```

- [ ] **Step 2: Run both tests and confirm they fail**

Run: `npx vitest run tests/catalogSearchClient.test.ts tests/catalogResultIntegrity.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the shared request builder and fetcher**

`src/lib/catalogSearchClient.ts` must export:

```ts
export function buildCatalogSearchArgs(input: {
    surface: CatalogSurfaceManifest;
    filters: Partial<CatalogFilters>;
    sort?: SortValue;
    view?: ViewMode;
    limit?: number;
    cursor?: string | null;
}): CatalogSearchArgs;

export async function fetchCatalogSearch(
    args: CatalogSearchArgs,
    signal?: AbortSignal,
): Promise<CatalogSearchResultShape>;
```

The fetcher must `POST` JSON to `/api/catalog/search`, throw a typed error when `response.ok` is false, and never mutate the URL or broaden constraints during recovery.

- [ ] **Step 4: Implement a pure post-query integrity audit and analytics event**

`auditCatalogResult` compares the active family, capacity, applicator, color, and neck-finish filters with each rendered group. It returns one of:

```ts
type CatalogIntegrityResult =
    | { status: "verified"; expectedCount: number; renderedCount: number; violatingGroupIds: [] }
    | { status: "count_mismatch"; expectedCount: number; renderedCount: number; violatingGroupIds: string[] }
    | { status: "constraint_mismatch"; expectedCount: number; renderedCount: number; violatingGroupIds: string[] };
```

Add this provider-neutral call in `src/lib/analytics.ts`:

```ts
catalogRefineIncident(properties: {
    surface: "master" | "cylinder";
    status: "query_failure" | "count_mismatch" | "constraint_mismatch";
    expectedCount?: number;
    renderedCount?: number;
    capacityCount: number;
    applicatorCount: number;
    threadCount: number;
}) {
    adapter.track("Catalog Refine Incident", properties);
},
```

Do not send raw customer search text or product data in this event.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run tests/catalogSearchClient.test.ts tests/catalogResultIntegrity.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the query/integrity layer**

```bash
git add src/lib/catalogSearchClient.ts src/lib/catalogResultIntegrity.ts src/lib/analytics.ts tests/catalogSearchClient.test.ts tests/catalogResultIntegrity.test.ts
git commit -m "feat(catalog): centralize search and integrity contracts"
```

---

## Task 3: Build the reusable canonical Refine view model

**Files:**

- Create: `src/lib/catalogRefineModel.ts`
- Create: `tests/catalogRefineModel.test.ts`
- Modify: `src/app/catalog/CatalogClient.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`

- [ ] **Step 1: Write failing tests for labels, selected state, and removable chips**

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import { buildAppliedFilterChips, removeCatalogFilterChip } from "@/lib/catalogRefineModel";

describe("canonical refine view model", () => {
    const filters = {
        ...EMPTY_FILTERS,
        families: ["Cylinder"],
        capacities: ["9 ml"],
        applicators: ["rollon"],
        neckThreadSizes: ["17-415"],
    };

    it("uses customer-facing labels without changing URL identity", () => {
        expect(buildAppliedFilterChips(filters)).toEqual(expect.arrayContaining([
            { facet: "capacities", value: "9 ml", label: "Capacity: 9 ml (0.3 oz)" },
            { facet: "applicators", value: "rollon", label: "Delivery: Roll-On" },
            { facet: "neckThreadSizes", value: "17-415", label: "Neck: 17-415" },
        ]));
    });

    it("removes only the requested constraint", () => {
        expect(removeCatalogFilterChip(filters, { facet: "neckThreadSizes", value: "17-415" }))
            .toMatchObject({ capacities: ["9 ml"], applicators: ["rollon"], neckThreadSizes: [] });
    });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npx vitest run tests/catalogRefineModel.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement `buildAppliedFilterChips`, `removeCatalogFilterChip`, and `toggleCatalogFacetValue`**

The module must use the lookup helpers already defined in `catalogFilters.ts`, preserve the fixed family scope at the surface layer, and return new immutable `CatalogFilters` objects. It must not inspect result cards.

- [ ] **Step 4: Replace duplicated chip/toggle helpers in both clients**

Both `CatalogClient.tsx` and `CylinderFamilyPageClient.tsx` consume the shared helpers. Keep `RefineSection` as the accordion shell and use the manifest to decide `defaultOpen`. On Cylinder, only Capacity is open by default; selected closed facets display the existing active-count badge.

- [ ] **Step 5: Run the view-model and Refine structural tests**

Run: `npx vitest run tests/catalogRefineModel.test.ts tests/graceRefineState.test.ts tests/catalogFilters.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the shared Refine model**

```bash
git add src/lib/catalogRefineModel.ts src/app/catalog/CatalogClient.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx tests/catalogRefineModel.test.ts
git commit -m "refactor(catalog): share canonical refine model"
```

---

## Task 4: Migrate Cylinder ready-made results to the authoritative query

**Files:**

- Modify: `src/app/catalog/cylinder/page.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Modify: `src/lib/products/cylinder-family-refine.ts`
- Modify: `tests/cylinder-family-refine.test.ts`
- Create: `tests/cylinder-authoritative-query.test.ts`

- [ ] **Step 1: Replace the local-evaluator tests with authoritative-query regression tests**

Remove the test import and expectations for `filterCylinderFamilyCards`. Add:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { paramsToFilters } from "@/lib/catalogFilters";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";

describe("Cylinder authoritative catalog query", () => {
    it("keeps the approved 9 ml 17-415 roll-on constraints exact", () => {
        const filters = paramsToFilters(new URLSearchParams(
            "families=Cylinder&capacities=9+ml&applicators=rollon&threads=17-415",
        ));
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters,
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
        }).filters).toMatchObject({
            families: ["Cylinder"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        });
    });

    it("does not call the retired local card evaluator", () => {
        const source = readFileSync(join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"), "utf8");
        expect(source).not.toContain("filterCylinderFamilyCards");
        expect(source).toContain("fetchCatalogSearch");
    });
});
```

- [ ] **Step 2: Run the tests and confirm the structural failure**

Run: `npx vitest run tests/cylinder-family-refine.test.ts tests/cylinder-authoritative-query.test.ts`

Expected: FAIL because Cylinder still imports and calls the local evaluator.

- [ ] **Step 3: Split base family data from active ready-made results**

In `page.tsx`, rename the unfiltered response to `baseCatalog` and use it only for:

- `buildCylinderFamilyPageModel(baseCatalog.items, baseCatalog.variantPreviewRows)` for the hero/builder inventory map;
- the initial ready-made result only when the incoming URL has no customer constraints;
- Paper Doll cohort/release calculations.

Pass explicit props:

```ts
type CylinderFamilyPageClientProps = {
    baseCatalog: CatalogSearchResultShape;
    initialReadyMadeCatalog: CatalogSearchResultShape;
    model: CylinderFamilyPageModel;
    editorial: ProductFamilyPageContent | null;
    paperDollBuildReady: boolean;
};
```

The page server component must accept `searchParams`, parse them with `paramsToFilters`, merge `CYLINDER_CATALOG_SURFACE`, and issue a second query only when the active constraints differ from the base request.

- [ ] **Step 4: Make the Cylinder client fetch from canonical URL state**

On `searchParams` change:

1. parse with `paramsToFilters`;
2. merge the immutable Cylinder surface;
3. call `fetchCatalogSearch(buildCatalogSearchArgs(...))` with an `AbortController`;
4. preserve the previous result and URL while loading;
5. replace the active result only on success;
6. emit `catalogRefineIncident` on query failure or integrity mismatch.

Build visible cards only from:

```ts
const activeModel = useMemo(
    () => buildCylinderFamilyPageModel(
        activeCatalog.items,
        activeCatalog.variantPreviewRows,
    ),
    [activeCatalog],
);
const visibleCards = activeModel.cards;
```

Use `activeCatalog.facets` for all facet options/counts and `activeCatalog.totalCount` for the live result count. `BuilderPreview` continues to receive `baseCatalog`.

- [ ] **Step 5: Retire the local evaluator**

Delete `filterCylinderFamilyCards` from `cylinder-family-refine.ts`. Keep only customer-facing presentation helpers still needed during the migration; delete the family-specific parser/serializer after all call sites use `paramsToFilters` and `filtersToParams`.

- [ ] **Step 6: Preserve mobile draft semantics and exact URLs**

The desktop controls update canonical URL state immediately. The mobile drawer updates `mobileDraft` only; `Show N groups` commits with `filtersToParams`, and closing without applying leaves the URL unchanged. Browser back/forward must restore the controls and results.

- [ ] **Step 7: Run the focused authoritative-state tests**

Run: `npx vitest run tests/cylinder-family-refine.test.ts tests/cylinder-authoritative-query.test.ts tests/catalogFilters.test.ts tests/graceRefineState.test.ts tests/catalog.smoke.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the Cylinder migration**

```bash
git add src/app/catalog/cylinder/page.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx src/lib/products/cylinder-family-refine.ts tests/cylinder-family-refine.test.ts tests/cylinder-authoritative-query.test.ts
git commit -m "feat(cylinder): use authoritative catalog refine query"
```

---

## Task 5: Add the shared continuous visual grid

**Files:**

- Create: `src/components/catalog/CatalogProductGrid.tsx`
- Create: `tests/catalogProductGrid.test.ts`
- Modify: `src/app/catalog/CatalogClient.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`

- [ ] **Step 1: Write the failing grid-contract test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("continuous catalog product grid", () => {
    it("owns the hairline dividers and responsive columns", () => {
        const source = readFileSync(join(process.cwd(), "src/components/catalog/CatalogProductGrid.tsx"), "utf8");
        expect(source).toContain("gap-px");
        expect(source).toContain("border-champagne");
        expect(source).toContain("sm:grid-cols-2");
        expect(source).toContain("xl:grid-cols-4");
    });

    it("is used by both visual catalog surfaces", () => {
        for (const file of [
            "src/app/catalog/CatalogClient.tsx",
            "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx",
        ]) {
            const source = readFileSync(join(process.cwd(), file), "utf8");
            expect(source).toContain("<CatalogProductGrid");
        }
    });
});
```

- [ ] **Step 2: Run the test and confirm the missing-component failure**

Run: `npx vitest run tests/catalogProductGrid.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the grid shell**

```tsx
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export default function CatalogProductGrid({
    className,
    ...props
}: ComponentPropsWithoutRef<"div">) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-px border border-champagne/70 bg-champagne/70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                className,
            )}
            {...props}
        />
    );
}
```

- [ ] **Step 4: Move both visual product views and skeletons into the shell**

Replace the master and Cylinder `gap-4` visual grids with `CatalogProductGrid`. Keep the Cylinder-specific 3/4-column overrides only when required by the 240–260 px Refine rail.

Update the card articles so the shared grid owns the outer line:

- `border-0`, `rounded-none`, `shadow-none`;
- no translate/lift hover animation;
- `bg-white` so `gap-px` reveals only the divider color;
- visible `focus-within:outline`/`focus-visible` treatment;
- product information padding between 16 and 20 px;
- swatch/title spacing of 12 px and 8 px internal information rhythm.

- [ ] **Step 5: Run the grid test and catalog smoke tests**

Run: `npx vitest run tests/catalogProductGrid.test.ts tests/catalog.smoke.test.ts tests/cylinder-v3-acceptance.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the continuous grid**

```bash
git add src/components/catalog/CatalogProductGrid.tsx src/app/catalog/CatalogClient.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx tests/catalogProductGrid.test.ts
git commit -m "feat(catalog): add continuous product divider grid"
```

---

## Task 6: Complete loading, empty, and query-failure behavior

**Files:**

- Modify: `src/app/catalog/CatalogClient.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Create: `tests/catalogRefineStates.test.ts`

- [ ] **Step 1: Write failing structural tests for context-preserving states**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("catalog Refine states", () => {
    const cylinder = readFileSync(join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"), "utf8");

    it("keeps the prior result while an authoritative request loads", () => {
        expect(cylinder).toContain("aria-busy={isFetchingCatalog}");
        expect(cylinder).toContain("CatalogProductGrid");
    });

    it("names the active constraints and exposes clear-all recovery", () => {
        expect(cylinder).toContain("activeConstraintSummary");
        expect(cylinder).toContain("Clear all");
    });

    it("does not claim success on a query error", () => {
        expect(cylinder).toContain("Unable to update these results");
        expect(cylinder).toContain("catalogRefineIncident");
    });
});
```

- [ ] **Step 2: Run the test and confirm the missing-state failures**

Run: `npx vitest run tests/catalogRefineStates.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the shared state behavior in both surfaces**

- Loading: retain current cards at reduced opacity, mark the results region `aria-busy`, and use the continuous-grid skeleton only on first load.
- Empty: list the active chips as readable constraints; retain individual chip removal and `Clear all`.
- Failure: retain URL, controls, chips, and previous cards; show an inline alert with `Retry`; do not alter filters or claim a successful result count.
- Live updates: announce only verified result counts through the polite live region.

- [ ] **Step 4: Run the state tests**

Run: `npx vitest run tests/catalogRefineStates.test.ts tests/catalogRefineModel.test.ts tests/graceRefineState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the resilient states**

```bash
git add src/app/catalog/CatalogClient.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx tests/catalogRefineStates.test.ts
git commit -m "fix(catalog): preserve refine context across result states"
```

---

## Task 7: Verify the customer journey in the browser

**Files:**

- Modify only if verification reveals a defect in files already named above.

- [ ] **Step 1: Start the development server**

Run: `npm run dev`

Expected: application is available on the assigned localhost port with no startup error.

- [ ] **Step 2: Verify the master catalog at desktop width**

Open `/catalog` at 1440 px and confirm:

- Refine rail remains visible and approximately 240–260 px.
- Sections toggle independently; defaults come from `MASTER_CATALOG_SURFACE`.
- Applied chips, facet counts, result count, and cards agree.
- Product cards touch through one hairline divider without radii, shadows, or gaps.
- Keyboard focus is clearly visible on section buttons, checkboxes, chips, swatches, and card links.

- [ ] **Step 3: Verify the strict Cylinder URL at desktop width**

Open:

`/catalog/cylinder?families=Cylinder&capacities=9+ml&applicators=rollon&threads=17-415#ready-made`

Confirm:

- Capacity, Roll-On, and 17-415 are all visibly selected.
- Capacity is expanded by default; the other facet sections remain usable toggles.
- No card displays `13-415`.
- Result and configuration counts match the rendered cards.
- Beauty/build editorial content remains intact above the ready-made list.

- [ ] **Step 4: Verify history and Grace-owned state**

- Remove `17-415`, use browser Back, and confirm it returns selected with exact results.
- Ask Grace for “9 mL Cylinder roll-ons with a 17-415 neck” and confirm Grace produces the same canonical URL.
- Confirm Grace does not report completion until the UI selection and verified results are present.

- [ ] **Step 5: Verify mobile behavior at 390 × 844**

- Refine button has at least a 44 px target and displays the active count.
- Drawer changes remain draft-only until `Show N groups` is pressed.
- Closing the drawer without applying leaves URL and cards unchanged.
- Applied chips scroll horizontally and remain removable.
- Cards are readable in the chosen one/two-column breakpoint and retain hairline dividers.
- Bottom navigation does not cover Refine, cards, or purchase/navigation actions.

- [ ] **Step 6: Verify empty and failure recovery**

- Select a real no-match combination and confirm the active constraints are named.
- Remove one chip and confirm results recover without clearing the other constraints.
- Simulate a failed `/api/catalog/search` request and confirm the previous cards and URL remain visible with Retry.

---

## Task 8: Run the complete release checks and make the final implementation commit

**Files:**

- All implementation files from Tasks 1–6.

- [ ] **Step 1: Run all Vitest tests**

Run: `npx vitest run`

Expected: all tests pass; no failed, skipped-for-this-change, or unhandled-error result.

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: zero errors. Existing unrelated warnings may remain only if their count and files are recorded.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: production build and sitemap generation pass.

- [ ] **Step 5: Audit the final diff and working tree**

```bash
git status --short
git diff --check
git diff --stat HEAD~6..HEAD
```

Expected: no whitespace errors; unrelated local files remain unstaged and unmodified by this work.

- [ ] **Step 6: Commit any verification-only corrections**

```bash
git add src/lib/catalogFilters.ts src/lib/catalogSurface.ts src/lib/catalogSearchClient.ts src/lib/catalogResultIntegrity.ts src/lib/catalogRefineModel.ts src/lib/analytics.ts src/lib/products/cylinder-family-refine.ts src/components/catalog/CatalogProductGrid.tsx src/app/catalog/CatalogClient.tsx src/app/catalog/cylinder/page.tsx src/app/catalog/cylinder/CylinderFamilyPageClient.tsx tests/catalogSurface.test.ts tests/catalogSearchClient.test.ts tests/catalogResultIntegrity.test.ts tests/catalogRefineModel.test.ts tests/cylinder-family-refine.test.ts tests/cylinder-authoritative-query.test.ts tests/catalogProductGrid.test.ts tests/catalogRefineStates.test.ts
git commit -m "fix(catalog): complete universal refine verification"
```

Create this final commit only if Task 8 required source changes; otherwise leave the prior task commits as the implementation history.

## Final Acceptance Gate

- [ ] Master catalog and Cylinder use `CatalogFilters`, `filtersToParams`, and `paramsToFilters`.
- [ ] Convex supplies all visible results and facet counts on both surfaces.
- [ ] `filterCylinderFamilyCards` no longer exists or appears in the Cylinder client.
- [ ] `9 ml + rollon + 17-415` never contains a 13-415 group.
- [ ] Grace, shared URLs, browser history, desktop controls, and mobile drawer resolve to identical state.
- [ ] Loaded cards and first-load skeletons share the continuous divider grid.
- [ ] Failure and empty states preserve the customer’s constraints.
- [ ] Product-truth, Vitest, TypeScript, lint, build, desktop browser, and mobile browser checks pass before the branch is presented for review.
