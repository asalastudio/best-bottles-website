# Universal Catalog Refine and Continuous Product Grid

**Date:** 2026-08-04
**Status:** Approved direction; implementation pending written-spec review
**Owner:** Engineering / Codex
**Approver:** Jordan Richter

## Objective

Create one authoritative filtering system for the entire Best Bottles catalog while allowing each shopping surface to present only the facets relevant to its customer task. Refine must behave identically whether a constraint comes from a customer click, Grace AI, a shared URL, search, or a family page. At the same time, tighten the product grid into a continuous premium gallery with shared hairline dividers.

## Approved Experience

### Refine

- Desktop retains a visible, sticky left Refine rail.
- Capacity is expanded by default on the Cylinder family page.
- Other facet groups are collapsible and display a selected-count badge.
- Applied filters appear as removable chips above the product list.
- Mobile uses the existing full-height Refine drawer with draft selections and an explicit `Show N groups` action.
- Capacity and neck finish remain exact constraints until the customer explicitly removes or broadens them.
- Grace reads and writes the same state as the visible UI.

### Product grid

- The Refine rail remains separated from the product grid by 24–28 px.
- Product cards inside the grid have no visual gutters; a 1 px shared divider separates them.
- Cards have square corners, no floating shadow, and no lift animation.
- Product imagery remains the dominant part of each card.
- Swatches occupy a slim, consistent band between imagery and product information.
- Capacity, neck finish, delivery system, finish count, and unit price remain visible.
- Hover and focus use restrained color or outline changes without breaking the continuous grid.

## Approaches Considered

### 1. Shared state/query contract with surface manifests — selected

One catalog contract owns parsing, serialization, query arguments, result counts, and applied filters. A surface manifest fixes immutable scope and chooses which facets to render. For example, the Cylinder family surface fixes `families = ["Cylinder"]` and displays Capacity, Glass Color, Delivery System, and Neck Finish.

This preserves the editorial family experience while eliminating the second filtering engine.

### 2. Render the master `CatalogClient` inside every family page

This would guarantee shared behavior quickly, but it would force the master catalog hierarchy and controls into editorial family pages. It would weaken the approved hero/build experience and make surface-specific merchandising difficult.

### 3. Keep family-specific evaluators synchronized manually

This is the current transitional state. It shares URL vocabulary but allows semantic drift, such as `9 ml` being interpreted differently from `9 ml (0.3 oz)`. This approach is rejected.

## Architecture

### Canonical state

`CatalogFilters`, `SortValue`, and `ViewMode` remain the only public catalog state vocabulary. URL parsing and serialization continue to live in `src/lib/catalogFilters.ts`.

The universal state contains:

- category
- collection
- applicator bucket
- family
- color
- exact capacity
- neck finish
- component type
- price range
- search
- sort
- view

Exact capacities use canonical URL values such as `9 ml`. Customer-facing labels may add ounce equivalents, but presentation labels never become a second filter identity.

### Surface manifest

A small surface manifest defines presentation without redefining filter semantics:

```ts
type CatalogSurfaceManifest = {
  fixedFilters: Partial<CatalogFilters>;
  visibleFacets: CatalogFacetKey[];
  defaultOpenFacets: CatalogFacetKey[];
  defaultSort: SortValue;
  resultLabel: string;
};
```

The master catalog has no fixed family. The Cylinder manifest fixes the family and chooses its four customer-relevant facets. Future Boston Round, Elegant, and Diva/Empire pages reuse the same mechanism.

### Query authority

Convex `products.searchCatalog` becomes the sole evaluator for visible catalog results and facet counts. The family page may retain an unfiltered, family-scoped data set for editorial builder previews, but it must not use that snapshot to decide which ready-made product cards match Refine.

The family results flow is:

```text
URL / Grace / customer selection
  → parse canonical CatalogFilters
  → merge immutable family scope
  → Convex products.searchCatalog
  → contextual facets + verified result count
  → family card presentation
```

Within a facet, multiple values use OR logic. Across facets, constraints use AND logic. Contextual facet counts apply all other active constraints while excluding the facet being counted.

### Shared presentation components

- `RefineSection` remains the shared accordion shell.
- A shared Refine model converts canonical facets into labels, counts, selected state, and toggle actions.
- A shared `CatalogProductGrid` owns continuous-grid borders, column behavior, and focus containment.
- Master and family product cards may keep different information layouts, but both use the shared grid shell and the same spacing tokens.

## Responsive Behavior

### Desktop

- Sticky Refine rail: 240–260 px.
- Rail-to-grid gap: 24–28 px.
- Continuous grid: 3 or 4 columns according to available width.
- Grid gap: 1 px, supplied by the divider background.
- Product information padding: 16–20 px.
- Swatches-to-title spacing: 12 px.
- Title/specification/price rhythm: 8 px.

### Mobile

- Refine remains behind a clear 44 px minimum target button with active-count badge.
- Applied-filter chips remain above results and horizontally scroll when needed.
- The product list remains one column at narrow widths and moves to two columns only when the existing information remains readable.
- Cards retain hairline horizontal dividers without floating gaps.
- The drawer uses draft state; closing without applying does not change the URL.

## Product-Truth and Compatibility Rules

- `9 mL · 13-415` and `9 mL · 17-415` are separate platforms.
- A family constraint may narrow results but may never silently change capacity, neck finish, applicator, or compatibility.
- Grace may remove a constraint only after explicit customer language such as “show other sizes” or “broaden this search.”
- All visible result counts come from the same query response as the visible product groups.
- Legacy route aliases remain excluded from canonical result and facet counts.

## Loading, Empty, and Failure States

- Loading skeletons use the same continuous grid geometry as loaded cards.
- An empty state names the active constraints and offers individual removal plus `Clear all`.
- A failed query keeps the existing URL state visible and does not claim that filters were applied.
- Grace reports success only after the catalog query verifies the proposed state.
- A client/server result-count mismatch emits a structured Grace/catalog operational incident for later Executive Hub aggregation.

## Accessibility

- Accordion buttons expose `aria-expanded` and `aria-controls`.
- Checkboxes retain visible labels and at least 44 px targets.
- Applied-filter removal buttons name the facet and value.
- Keyboard focus remains visible across filter controls, cards, and swatches.
- Grid dividers are not the only indicator of focus or selection.
- Result-count changes use the existing polite live region.

## Acceptance Criteria

1. Master catalog and Cylinder use the same canonical state parser and serializer.
2. Cylinder ready-made results are evaluated by Convex, not `filterCylinderFamilyCards`.
3. A Grace route for `Cylinder + 9 ml + Roll-On + 17-415` selects all three visible facets and returns only matching groups.
4. No `13-415` product appears when `17-415` is active.
5. Browser back/forward and shared URLs restore the exact filter state.
6. Result count, facet counts, applied chips, and visible cards agree.
7. Desktop product cards form a continuous hairline-divided grid with no floating gaps, radii, or shadows.
8. Mobile retains readable product information and a complete Refine drawer.
9. Empty, loading, and query-failure states preserve customer context.
10. Grace and catalog operational telemetry distinguish verified success, no match, query failure, and rendered-state mismatch.

## Verification Plan

- Unit tests for fixed-scope merging, canonical capacities, URL round-trips, OR/AND semantics, and applied-filter removal.
- Integration tests proving both master and Cylinder produce the same Convex query arguments for identical constraints.
- Regression test proving `9 ml` selects the customer-facing `9 ml (0.3 oz)` option.
- Regression test preventing 13-415/17-415 mixing.
- Component tests for shared Refine accordion state and continuous-grid classes.
- Browser checks at desktop and mobile widths for Refine, chips, counts, grid density, keyboard focus, and empty state.
- Full Vitest, TypeScript, lint, and production build verification before commit.

## Out of Scope

- Paper Doll asset generation or Sanity publication.
- Product-card content redesign beyond spacing, divider treatment, and removal of floating-card decoration.
- New catalog facets that are not already supported by product truth.
- Executive Hub screen implementation; only the operational event contract needed by this filter work is included.
