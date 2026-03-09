# Bottle-Finding User Journey: Current State, Alternatives & Implementation Plan

**Date:** March 2026  
**Reference:** Baymard Institute E-Commerce UX Best Practices  
**Scope:** User journey from landing to finding a bottle on bestbottles.com

---

## 1. Current User Journey (As-Is)

### Flow Diagram

```mermaid
flowchart TB
    subgraph Entry [Entry Points]
        Home[Homepage]
        Navbar[Navbar Search / Mega Menu]
        Direct[/catalog URL]
    end

    subgraph PathChooser [PathChooser - Find Your Bottle]
        P1[I Know What I Need - Search]
        P2[Help Me Choose - Guided 3-Step]
        P3[Talk to Grace - AI]
    end

    subgraph HomepageSections [Homepage Sections]
        Hero[Hero - CTA: Explore Collections]
        StartHere[Start Here Cards - Use Case Links]
        DesignFamilies[Shop by Design Family Carousel]
    end

    subgraph Catalog [Catalog Page]
        SearchBar[Search Bar]
        FilterSidebar[Filter Sidebar - Category, Applicator, Family, Color, Capacity, Thread, Price]
        FilterChips[Active Filter Chips]
        ProductGrid[Product Grid - 24 per page]
        Sort[Sort: Featured, Price, Name, Capacity]
        ViewMode[View: Visual / Line]
    end

    subgraph PDP [Product Detail Page]
        Variants[Variant Selectors]
        Fitment[Fitment Drawer]
    end

    Home --> Hero
    Hero --> P1
    Hero --> P2
    Hero --> P3
    Hero --> DesignFamilies
    Home --> StartHere
    StartHere --> Catalog
    P1 --> Catalog
    P2 --> Catalog
    P3 --> Grace[Grace Panel]
    Grace --> Catalog
    DesignFamilies --> Catalog
    Navbar --> Catalog
    Direct --> Catalog

    Catalog --> SearchBar
    Catalog --> FilterSidebar
    Catalog --> FilterChips
    Catalog --> ProductGrid
    Catalog --> Sort
    Catalog --> ViewMode
    ProductGrid --> PDP
```

### Current Entry Paths Summary

| Path | Trigger | Destination |
|------|---------|-------------|
| **Hero CTA** | "Explore Collections" | `/catalog` |
| **Hero Grace** | "Ask Grace" | Grace panel (voice/text) |
| **PathChooser 1** | Search "e.g. 30ml amber dropper" | `/catalog?search=...` |
| **PathChooser 2** | "Help Me Choose" | GuidedSelector (3 steps: Use Case → Dispenser → Size) → `/catalog?applicators=...&capacities=...` |
| **PathChooser 3** | "Talk to Grace" | Grace panel |
| **Start Here Cards** | 6 use-case cards (roll-ons, skincare, samples, gift packaging, components, spray) | `/catalog?applicators=...` or `/catalog?families=Vial` etc. |
| **Design Families** | 9 family carousel cards | `/catalog?families=Cylinder` etc. |
| **Navbar** | Search, mega menu, voice | Catalog with filters |

### Catalog Page Structure (Current)

- **Filters:** Category, Collection, Applicator Type, Design Family, Glass Color, Capacity, Neck Thread, Component Type, Price Range
- **Sort:** 8 options (Featured, Price, Name, Capacity, Variants)
- **View:** Visual grid vs. compact line
- **Product cards:** Thumbnail, display name, price range, variant count
- **Mobile:** Filter drawer (slide-in), sort dropdown

### Baymard Alignment (Current)

| Baymard Guideline | Current State | Gap |
|-------------------|---------------|-----|
| Price visible on list items | Yes (price range) | OK |
| Product title/type | Yes (display name) | OK |
| Thumbnail image | Yes | OK |
| User ratings | N/A (B2B) | N/A |
| Product variations visible | Variant count shown | Partial – no swatches in grid |
| Multiple filter selection (OR) | Yes (multi-select within facets) | OK |
| Applied filters display | Yes (chips with remove) | OK |
| Visual filters for visual attributes | Color swatches in filter | OK |
| Faceted sorting | No – sort is global | **Gap** |
| Category-specific attributes | Generic – same for all | **Gap** (e.g. thread size more critical for bottles) |

---

## 2. Alternative Option A: Baymard-Optimized Catalog-First

**Concept:** Reduce cognitive load by making the catalog the primary surface. Simplify homepage entry, strengthen catalog UX per Baymard.

### Changes

1. **Homepage:** Single hero CTA "Browse Catalog" + prominent search. Remove PathChooser; replace with one search bar + "Not sure? Ask Grace."
2. **Catalog:** 
   - Add **faceted sorting** (sort within filtered set; e.g. "Price within Roll-On").
   - Show **category-specific attributes** in grid (e.g. thread size on bottle cards, applicator on components).
   - **Inline color swatches** on product cards where relevant.
   - **Sticky filter summary** bar showing active filters + result count.
3. **Guided flow:** Move "Help Me Choose" into catalog as a "Guided Browse" mode (wizard overlays catalog, applies filters step-by-step).

### Flow

```
Homepage (minimal) → Search or Browse Catalog → Catalog (enhanced) → PDP
                         ↓
                   Ask Grace (persistent)
```

### Baymard Score (Estimated): **82/100**

- Strong: Faceted sort, applied filters, category-specific attributes
- Weak: Guided flow less prominent; users who don't know terms may struggle

---

## 3. Alternative Option B: Intent-First with Progressive Disclosure

**Concept:** Match Baymard's "understand user intent first" principle. Use a lightweight qualifier before showing the catalog.

### Changes

1. **Homepage:** Keep PathChooser but reframe as "How are you shopping today?" with 3 options:
   - **By product type** (use case) → Start Here cards
   - **By design** (aesthetic) → Design Families
   - **I know exactly what I need** → Search + direct catalog
2. **One-question qualifier:** Before catalog, optional modal: "What are you packaging?" (Fragrance / Skincare / Samples / Other). Pre-applies applicator filter.
3. **Catalog:** Same as current, plus:
   - **Smart default sort** based on entry (e.g. from "Fragrance" → sort by popular spray/roll-on first).
   - **Contextual Grace prompts** ("Need a 30ml amber dropper? Ask Grace").
4. **GuidedSelector:** Becomes a "Quick Match" flow – 3 steps, but steps are shorter and lead to a curated subset (e.g. "Top 12 for your use case").

### Flow

```
Homepage → Qualifier (optional) → Catalog (contextual) → PDP
    ↓
Grace (always available)
```

### Baymard Score (Estimated): **78/100**

- Strong: Intent-first, reduced overwhelm
- Weak: Extra step can feel like friction for power users

---

## 4. Alternative Option C: Hybrid – Best of Both (Recommended)

**Concept:** Combine Option A's catalog strength with Option B's intent clarity. No extra mandatory steps, but smarter defaults and better catalog UX.

### Changes

1. **Homepage:**
   - Keep PathChooser (3 paths) but make "I Know What I Need" more prominent (larger search, above fold).
   - Keep Start Here + Design Families as quick links.
   - Add "Browse All" as a clear secondary CTA.
2. **Catalog:**
   - **Faceted sorting** (Baymard): Sort applies within current filters.
   - **Category-specific card attributes:** Thread size on bottles, applicator on components.
   - **Inline color swatches** on cards (where family has color variants).
   - **Sticky filter bar** on scroll with active count + "Clear all."
   - **Empty state:** When filters return 0 results, suggest "Try removing X" or "Ask Grace to find similar."
3. **GuidedSelector:** Keep as-is; ensure it lands on catalog with filters + a "Viewing X results for [use case]" banner.
4. **Grace:** Persistent entry point; after Grace navigates to catalog, show a small "Grace found these for you" contextual message.

### Flow

```
Homepage → PathChooser / Start Here / Design Families → Catalog (enhanced) → PDP
    ↓              ↓                    ↓
  Search      Guided 3-Step          Grace
    ↓              ↓                    ↓
    └──────────────┴────────────────────┘
                         ↓
              Catalog (facets, smart sort, better cards)
```

### Baymard Score (Estimated): **88/100**

- Strong: Multiple entry paths preserved, catalog UX improved, no mandatory extra steps
- Aligns with: Multiple filter selection, applied filters display, visual filters, faceted sorting, category-specific attributes

---

## 5. Scoring Summary

| Criterion | Current | Option A | Option B | Option C |
|-----------|---------|----------|----------|----------|
| Entry path clarity | 7/10 | 8/10 | 9/10 | 9/10 |
| Catalog findability | 6/10 | 9/10 | 7/10 | 9/10 |
| Baymard alignment | 6/10 | 8/10 | 7/10 | 9/10 |
| Power user efficiency | 7/10 | 8/10 | 6/10 | 9/10 |
| New user guidance | 7/10 | 6/10 | 8/10 | 8/10 |
| Implementation effort | — | Medium | Medium | Medium |
| **Total (weighted)** | **66** | **78** | **74** | **88** |

**Recommendation: Option C (Hybrid)** – Best balance of clarity, findability, and efficiency without adding friction.

---

## 6. Implementation Plan for Option C

### Phase 1: Catalog Enhancements (2–3 days)

1. **Faceted sorting**
   - File: `src/app/catalog/page.tsx`, `src/lib/catalogFilters.ts`
   - Ensure sort runs on `filtered` result set only (already the case; verify no regressions).
   - Add sort option: "Best match" when search is active (prioritize search relevance).

2. **Category-specific card attributes**
   - File: `src/app/catalog/page.tsx` (product card component)
   - For `Glass Bottle` / `Lotion Bottle`: show `neckThreadSize` on card.
   - For `Component`: show `applicator` or component type.
   - For bottles with color variants: show 2–3 color swatch dots.

3. **Sticky filter summary bar**
   - Add a sticky bar (below navbar) when filters are active: "X results · [Filter chips] · Clear all"
   - Collapse on scroll down, show on scroll up (optional).

### Phase 2: Homepage Refinements (1 day)

4. **PathChooser prominence**
   - Move "I Know What I Need" to the left (first in grid) or center.
   - Increase search input size; add placeholder "e.g. 9ml clear cylinder roll-on".

5. **"Browse All" CTA**
   - Add explicit "Browse All" link/button in PathChooser or below it.

### Phase 3: Empty State & Grace Integration (1 day)

6. **Catalog empty state**
   - When `filtered.length === 0`: show "No products match your filters. Try removing some filters or Ask Grace for suggestions."

7. **Grace → Catalog context**
   - When Grace navigates to catalog via `showProducts` or `navigateToPage`, pass a query param e.g. `?grace=1`.
   - Show a dismissible banner: "Grace found these for you" with option to refine.

### Phase 4: Mobile Polish (1 day)

8. **Mobile filter drawer**
   - Ensure filter summary (active count) is visible in drawer header.
   - Add "View X results" button at bottom of drawer to close and scroll to grid.

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/catalog/page.tsx` | Faceted sort verification, card attributes, sticky bar, empty state |
| `src/components/HomePage.tsx` | PathChooser order, Browse All CTA |
| `src/lib/catalogFilters.ts` | "Best match" sort option when search active |
| `src/components/GraceElevenLabsProvider.tsx` | Pass `grace=1` when navigating to catalog |

---

## 7. Visual Reference (Current vs Option C)

**Diagram assets (for Figma or presentations):**
- `assets/user-journey-bottle-finding-current.png` — Current flow
- `assets/user-journey-option-c-recommended.png` — Option C (recommended) flow

Import these into Figma for annotation, iteration, or stakeholder review.

### Current Flow (Simplified)

```
[Hero] → [PathChooser: Search | Guided | Grace]
              ↓
    [Catalog: Filters + Grid]
              ↓
    [PDP: Variants + Fitment]
```

### Option C Flow (Simplified)

```
[Hero] → [PathChooser: Search (prominent) | Guided | Grace] + [Browse All]
              ↓
    [Catalog: Sticky filter bar | Faceted sort | Enhanced cards | Empty state]
              ↓
    [PDP: Variants + Fitment]
```

---

## 8. Success Metrics

- **Time to first product view:** Reduce for users entering via PathChooser.
- **Filter usage:** Track which filters are used most; optimize order.
- **Zero-result rate:** Reduce via empty state + Grace prompt.
- **Grace → Catalog conversion:** Track when Grace navigates to catalog; measure subsequent add-to-cart or request-sample.
