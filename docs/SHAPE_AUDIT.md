# Best Bottles — Shape Classification Audit

Generated: 2026-04-06
Source: Legacy site dimension data + Convex catalog

## Purpose

Customers describe bottles by visual shape ("I want a square bottle"), not by family name ("I want an Elegant"). This audit maps every bottle family to the shape words a customer would use, based on actual physical dimensions from the legacy site.

Grace must resolve shape-based queries to the correct family (or families), and suggest adjacent shapes when an exact match doesn't exist at the requested size.

---

## Family Dimension Data

| Family | Sample Size | Width (mm) | Depth (mm) | Diameter (mm) | H w/Cap (mm) | Cross-Section Profile |
|---|---|---|---|---|---|---|
| **Square** | 15ml | 26 | 26 | — | 65 | True square (1:1) |
| **Elegant** | 15ml | 36 | 18 | — | 73 | Flat rectangle (2:1) |
| **Flair** | 15ml | 41 | 20 | — | 68 | Flat rectangle (2:1) |
| **Grace** | 55ml | 52 | 30 | — | 117 | Wide oval (1.7:1) |
| **Empire** | 50ml | 37 | — | — | 93 | ⚠️ NEEDS CONFIRMATION — width only, no depth |
| **Sleek** | 50ml | 28 | — | — | 143 | Very tall + narrow (H:W = 5:1) |
| **Slim** | 30ml | — | — | 30 | 91 | Cylindrical (round, H:D = 3:1) |
| **Diva** | 46ml | — | — | 49 | 93 | Round, wide body (H:D = 1.9:1) |
| **Round** | 78ml | — | — | 59 | 77 | Squat globe (H:D = 1.3:1) |
| **Cylinder** | 5ml | — | — | 17 | 59 | Narrow cylinder (H:D = 3.5:1) |
| **Boston Round** | 60ml | — | — | — | — | Classic round laboratory bottle |
| **Circle** | 30ml | — | — | — | — | Round/circular — ⚠️ need dimensions |
| **Diamond** | 60ml | — | — | — | — | Angular/faceted — ⚠️ need dimensions |
| **Tulip** | 6ml | — | — | 23 | 47 | Bulbous/tulip (H:D = 2:1) |
| **Bell** | 10ml | — | — | 27 | 66 | Bell-shaped flare (H:D = 2.4:1) |
| **Pillar** | 9ml | — | — | 21 | 69 | Cylindrical pillar (H:D = 3.3:1) |
| **Royal** | 13–14ml | — | — | — | — | Described as "Royal cylinder" — cylindrical |
| **Teardrop** | 9ml | — | — | — | — | Teardrop/pear-shaped |
| **Apothecary** | 15–118ml | — | — | — | — | Pear-shaped (shape field = "Pear") |
| **Rectangle** | 9–10ml | — | — | — | — | Rectangular, described as "Tall rectangular" |

---

## Shape Classification by Visual Impression

### Flat-Faced / Angular (customer sees flat sides, corners)

| Visual Shape | Families | Notes |
|---|---|---|
| **Square** (all 4 sides equal) | Square (26x26) | Only comes in 15ml |
| **Rectangular / flat** (wide front, thin side) | Elegant (36x18), Flair (41x20) | Elegant: 15, 30, 60, 100ml. Flair: 15ml only |
| **Tall rectangular** | Rectangle (9–10ml) | Small sizes only |
| **Wide oval / rounded rectangle** | Grace (52x30) | Only 55ml |

### Round Cross-Section (customer sees a tube or globe)

| Visual Shape | Families | Notes |
|---|---|---|
| **Cylindrical / tube** | Cylinder (3–454ml), Slim (30–100ml), Pillar (9ml), Royal (13–14ml) | Slim is indistinguishable from Cylinder at same size |
| **Tall + thin cylinder** | Sleek (5–100ml) | Extremely tall H:W ratio (5:1 at 50ml) |
| **Wide round / globe** | Round (78, 128ml), Diva (30, 46, 100ml), Circle (15–100ml), Boston Round (15–60ml) | Wide bodies, shorter proportions |
| **Bulbous / squat** | Tulip (5–6ml), Bell (10ml) | Small sizes, decorative |

### Organic / Specialty Shapes

| Visual Shape | Families | Notes |
|---|---|---|
| **Teardrop / pear** | Teardrop (9ml), Apothecary (15–118ml) | Ground glass stoppers |
| **Diamond / angular** | Diamond (60ml) | Faceted glass |
| **Heart** | Decorative (3–6ml) | Novelty/gift |

---

## Customer Vocabulary → Family Mapping

This is the lookup table Grace needs. When a customer uses any word in the left column, Grace should search the families in the right column.

| Customer Says | Primary Families | Also Consider |
|---|---|---|
| "square bottle" | **Square** | Elegant, Flair (flat-faced, looks square from front) |
| "rectangular bottle" / "flat bottle" | **Elegant**, **Flair** | Rectangle, Grace |
| "boxy" / "angular" | **Square**, **Elegant** | Rectangle, Diamond |
| "round bottle" / "circular" | **Circle**, **Round**, **Boston Round** | Diva |
| "globe" / "globe-shaped" | **Round** | Diva |
| "cylindrical" / "tube" / "tubular" | **Cylinder**, **Slim**, **Pillar** | Sleek, Royal |
| "tall bottle" / "skinny" / "thin" | **Sleek** | Slim, Cylinder (smaller sizes) |
| "wide bottle" / "squat" / "short and wide" | **Round**, **Diva** | Circle, Tulip |
| "classic perfume bottle" | **Diva**, **Empire**, **Elegant** | Grace, Diamond |
| "lab bottle" / "pharmacy" / "apothecary" | **Boston Round**, **Apothecary** | — |
| "teardrop" / "pear-shaped" | **Teardrop**, **Apothecary** | — |
| "diamond" / "faceted" / "gem" | **Diamond** | — |
| "bell-shaped" | **Bell** | — |
| "heart" / "heart-shaped" | **Decorative** | — |
| "slim" / "slender" | **Slim**, **Sleek** | Cylinder |
| "oval" | **Grace** | Diva, Circle |
| "bulb" / "tulip" | **Tulip** | Bell |
| "pillar" / "column" | **Pillar** | Cylinder, Royal |
| "decorative" / "ornate" | **Decorative**, **Diamond**, **Apothecary** | Teardrop, Bell |

---

## Identified Issues (Action Required)

### 1. Missing Dimension Data
The following families have no width/depth/diameter data in Convex. This makes programmatic shape classification impossible without manual input:
- Circle, Diamond, Boston Round, Royal, Rectangle, Teardrop, Apothecary

**Action:** Populate dimension data from legacy site or product specs.

### 2. `shape` Field Is Null
The `shape` field in the products table is null for 99%+ of products. Only Apothecary ("Pear") and Decorative ("Heart") have values.

**Action:** Populate `shape` for all products based on this audit's classification.

### 3. Empire Needs Depth Measurement
Empire shows width (37mm) but no depth or diameter. Need to confirm: is it flat/rectangular or round/cylindrical?

**Action:** Owner to confirm Empire cross-section.

### 4. Adjacent Shape Suggestions
When a customer asks for a shape+size combination that doesn't exist, Grace must suggest:
- Same shape, different size (e.g., "no 50ml Square, but we have 15ml Square")
- Similar shape, requested size (e.g., "the Elegant has a similar flat profile and comes in 60ml")

### 5. Size Coverage Gaps by Shape
| Shape Category | Available Sizes (ml) | Gaps |
|---|---|---|
| Square (true) | 15 | No sizes above 15ml |
| Flat/rectangular | 9, 10, 15, 30, 55, 60, 100 | No 50ml flat bottle |
| Cylindrical | 3, 4, 5, 9, 13, 14, 25, 28, 30, 50, 100+ | Very good coverage |
| Wide round | 15, 30, 46, 50, 60, 78, 100, 128 | Good coverage |

---

## Validation Checklist (for owner)

- [ ] Confirm Square (26x26mm) is truly square — **CONFIRMED 2026-04-06**
- [ ] Confirm Elegant is rectangular/flat (36x18mm), NOT the same as Square
- [ ] Confirm Empire cross-section: flat or round?
- [ ] Confirm Circle is round (need dimensions)
- [ ] Confirm Diamond is angular/faceted (need dimensions)
- [ ] Review customer vocabulary mapping — any missing terms your sales team hears?
- [ ] Review "Also Consider" column — any incorrect associations?
