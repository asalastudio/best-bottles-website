# Catalog and Paper Doll Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Best Bottles catalog, Cylinder golden family, responsive shell, Refine state, Grace context, and Beauty/Build experience ready for validated 2080×2288 Paper Doll assets.

**Architecture:** Extend the existing strict `CYL-9ML` release gate rather than bypassing it. Reuse the main catalog query vocabulary for the Cylinder family, keep Convex as product truth, keep Sanity as asset/editorial truth, and make UI release state explicit.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Convex, Sanity, Vitest.

## Global Constraints

- `CYL-9ML` means Cylinder · 9 mL · 17-415 only.
- The 9 mL · 13-415 Tall Cylinder never enters the unified cohort.
- Paper Doll assets remain unreleased until the complete 2080×2288 contract passes.
- No production data mutation or asset upload is part of this implementation.
- All behavior changes use failing tests first.

---

### Task 1: Freeze shared contracts

**Files:**
- Create: `src/lib/paper-doll/contract.ts`
- Modify: `src/lib/paper-doll/sanity.ts`
- Modify: `src/lib/paper-doll/types.ts`
- Test: `tests/paper-doll-shared-contract.test.ts`

**Interfaces:**
- Produces: `PAPER_DOLL_CANVAS`, `PAPER_DOLL_CANVAS_PRESET`, `PAPER_DOLL_SLOTS`, `PAPER_DOLL_LAYER_HIERARCHY`, and `PaperDollReleaseState`.
- Consumes: existing Sanity validation and configuration types.

- [ ] Write tests proving the exact canvas, slot set, hierarchy, and required release metadata.
- [ ] Run `npx vitest run tests/paper-doll-shared-contract.test.ts` and confirm it fails because the shared module does not exist.
- [ ] Implement the constants and import them from the Sanity validator.
- [ ] Run the focused test and existing Paper Doll suites.
- [ ] Commit the contract.

### Task 2: Make Cylinder Refine URL-backed and mobile-complete

**Files:**
- Create: `src/lib/products/cylinder-family-refine.ts`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Test: `tests/cylinder-family-refine.test.ts`

**Interfaces:**
- Produces: `parseCylinderFamilyRefine`, `serializeCylinderFamilyRefine`, `filterCylinderFamilyCards`, and `cylinderRefineChips`.
- Consumes: main catalog parameter keys and `CylinderFamilyPageModel` cards.

- [ ] Write failing round-trip, 13-415/17-415 separation, filtered-count, invalid-value, and applied-chip tests.
- [ ] Implement the pure Refine state functions with `rollon`, `finemist`, and `lotionpump` mappings.
- [ ] Replace local-only initialization with URL initialization and router replacement.
- [ ] Add synchronized visible group/configuration counts and removable chips.
- [ ] Add a mobile Refine sheet with all four facets and a sticky `Show X groups` action.
- [ ] Run the focused tests and `tests/graceRefineState.test.ts`.
- [ ] Commit authoritative Refine.

### Task 3: Fix the global responsive shell

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/mobile/MobileTabBar.tsx`
- Modify: `src/components/CartDrawer.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/responsive-shell-contract.test.ts`

**Interfaces:**
- Produces: one shared mobile tab-bar clearance token and a desktop header that fits at 1440 px.

- [ ] Write failing contract tests for the compact breakpoint, mobile wordmark, clearance token, and drawer bounds.
- [ ] Move the expanded navigation to the `xl` layout and make search/link spacing responsive through `2xl`.
- [ ] Replace the missing mobile-menu logo image with the typographic wordmark.
- [ ] Centralize safe-area/tab-bar clearance and apply it to main content and drawers.
- [ ] Run the focused test and browser-check 1440×1000 and 390×844.
- [ ] Commit responsive-shell fixes.

### Task 4: Finalize honest Beauty/Build behavior

**Files:**
- Modify: `src/app/catalog/cylinder/page.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Modify: `src/components/products/UnifiedBottlePdp.tsx`
- Modify: `src/lib/products/unified-cylinder-pdp.ts`
- Test: `tests/unified-cylinder-pdp.test.ts`
- Test: `tests/cylinder-family-page.test.ts`

**Interfaces:**
- Produces: explicit `ready` or `preparing` build availability and no silent view rewrite.

- [ ] Write failing tests proving Build remains discoverable while unavailable and `view=build` remains an explicit requested state.
- [ ] Pass released-asset status into the family page.
- [ ] Render Beauty and Build as persistent peers; disable Build with concise preparation copy until release.
- [ ] Change the unreleased family CTA to exact configuration preview rather than promising a live layered canvas.
- [ ] Keep configuration, SKU, price, availability, and cart identity synchronized.
- [ ] Run the focused PDP/family suites.
- [ ] Commit Beauty/Build behavior.

### Task 5: Normalize cards, mobile density, and interaction semantics

**Files:**
- Modify: `src/components/products/ProductCardImagePreview.tsx`
- Modify: `src/app/catalog/cylinder/CylinderFamilyPageClient.tsx`
- Modify: `src/components/HomePage.tsx`
- Test: `tests/product-card-variant-previews.test.ts`
- Test: `tests/ux-intuitiveness.test.ts`

- [ ] Write failing tests for unique preview labels, 44 px interactive targets, and denser mobile media.
- [ ] Include SKU/material context in interactive swatch names and remove misleading static control semantics.
- [ ] Use a denser mobile card media ratio while preserving desktop editorial proportions.
- [ ] Strengthen the mobile hero scrim and supporting-copy contrast.
- [ ] Verify empty, unavailable, and loading copy gives a next action.
- [ ] Run component and UX suites.
- [ ] Commit catalog polish.

### Task 6: Add the catalog-wide verification matrix

**Files:**
- Create: `src/lib/products/catalog-ux-matrix.ts`
- Create: `tests/catalog-ux-matrix.test.ts`
- Create: `docs/catalog-ux-verification-matrix.md`

- [ ] Write failing tests for the approved family, delivery, sellability, and compatibility cases.
- [ ] Implement immutable representative cases and expected route/state assertions.
- [ ] Document desktop/mobile/manual release checks without claiming unrun physical-device results.
- [ ] Run the matrix, full Vitest suite, lint, and production build.
- [ ] Commit the verification matrix.

### Task 7: Visual verification and branch completion

**Files:**
- Update only files required by issues reproduced during verification.

- [ ] Start the isolated worktree preview with the local environment loaded.
- [ ] Verify homepage, Cylinder family, filtered results, unified PDP, Grace, and cart at 1440×1000 and 390×844.
- [ ] Reproduce each visual issue before fixing it; add a regression test where behavior changed.
- [ ] Run `npx vitest run`, `npm run lint`, and `npm run build` fresh.
- [ ] Review the final diff, commit all scoped work, and preserve the feature branch for the requested integration decision.
