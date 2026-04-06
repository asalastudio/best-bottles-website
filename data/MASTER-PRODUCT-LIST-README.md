# Best Bottles Master Product List

## Overview

Comprehensive analysis comparing 106 products found on the live bestbottles.com site against 225 product groups in the Convex database.

**Build Date:** 2026-04-06  
**Products Analyzed:** 106 (from live site crawl)

## Key Findings

### Match Rate: 42.5%
- **Matched:** 45 products (exist in both live site and Convex)
- **Gaps:** 61 products (on live site but NOT in Convex—need to add)
- **Orphans:** 207 products (in Convex but NOT on live site—need investigation)

### Product Breakdown

#### By Applicator Type
| Type | Count | % |
|------|-------|---|
| Cap | 50 | 47.2% |
| Roll-On | 31 | 29.2% |
| Spray | 25 | 23.6% |

#### By Glass Color
| Color | Count | % |
|-------|-------|---|
| Clear | 74 | 69.8% |
| Frosted | 16 | 15.1% |
| Cobalt Blue | 7 | 6.6% |
| Amber | 7 | 6.6% |
| Swirl | 2 | 1.9% |

#### Top Product Families
1. Cylinder (20 products)
2. Elegant (12 products)
3. Sleek (9 products)
4. Circle (8 products)
5. Tulip (6 products)
6. Tall Cylinder (6 products)
7. Boston Round (6 products)

## Gap Analysis

### 61 Products Missing from Convex

The live site has 61 products that don't match any Convex product groups. Primary gaps:

- **Boston Round:** 4 variants (amber/blue roll-on sizes)
- **Cylinder:** 10 variants (colored sprays and roll-ons)
- **Elegant:** 11 variants (frosted caps, sprays, roll-ons)
- **Diva:** 4 variants (frosted variants)
- **Other families:** 32 variants distributed across Circle, Diamond, Empire, Flair, Grace, Round, Sleek, Slim, Square, Tall Cylinder

**Most common patterns in gaps:**
- Colored glass versions (Amber, Cobalt Blue, Frosted, Swirl)
- Alternate applicator types for existing families
- Small format bottles (3ml, 4ml)

### 207 Products in Convex Not on Live Site

These are product groups that exist in the database but aren't currently displayed on the live site. Categories include:

- **Component/Accessory Products:** Droppers, atomizers, caps, closures, pumps, vials (~60 products)
- **Alternative Applicators:** Dropper, lotion pump, reducer, antique spray, glass wand, glass applicator variants (~90 products)
- **Different Product Types:** Cream jars, decorative bottles, plastic bottles, aluminum bottles, gift packaging (~40 products)
- **Large Format Bottles:** 118ml–454ml cylinders, 118ml+ variants (~20 products)

## Output Files

### 1. `live-site-product-master.json`
Machine-readable format containing:
- **products[]** - All 106 parsed products with:
  - Legacy code (e.g., GBCyl5BlkShSht)
  - Normalized properties (family, capacity, color, applicator)
  - Convex match status and slug
  - Legacy URL
  - gridImageNeeded flag (all true)
- **summary** - Statistics by applicator, family, color
- **gaps[]** - The 61 products needing Convex entries
- **orphans[]** - The 207 Convex products not on live site
- **matches[]** - The 45 successfully matched products

### 2. `PRODUCT-GAP-REPORT.txt`
Human-readable report with:
- Summary metrics
- Detailed gap listing (by family)
- Detailed orphan listing (by family)
- Next steps

### 3. `MASTER-PRODUCT-LIST-README.md`
This file—overview and context

## Next Steps

### Phase 1: Gap Closure
1. Review the 61 gaps in `PRODUCT-GAP-REPORT.txt`
2. Add missing products to Convex database
3. Ensure consistent schema (family, capacity, color, applicatorBucket)

**Estimated Impact:**
- Increases matched products from 45 → ~106 (100% match)
- Increases grid image coverage from 45 → 106 products

### Phase 2: Orphan Investigation
1. Review 207 orphans—determine which should be on live site
2. For each orphan, decide:
   - **Keep in Convex:** These are legitimate products, add to product catalog
   - **Remove from Convex:** These are deprecated or components, not standalone products
   - **Investigate:** Unclear—needs domain review

**Categories to consider:**
- **Components** (caps, droppers, pumps) — likely don't need grid images, may not display as standalone products
- **Alternative applicators** (dropper, lotion pump variants) — likely should be included if the family is offered
- **Large formats** (118ml+) — check if these are actually offered or test batches
- **Decorative bottles** (Genie, Marble, Tola) — verify if in catalog

### Phase 3: Grid Image Pipeline
1. All 106 matched products need grid images for product cards
2. Use Paper Doll image pipeline to generate composites
3. Set: `gridImageNeeded = true` for all (already marked in export)

**Estimated effort:**
- 106 images × ~1-2 min per image via Paper Doll pipeline
- ~2-3 hours for full batch processing

## Technical Details

### Legacy Code Parser
The script parses legacy product codes (e.g., `GBCyl5BlkShSht`) to extract:
- **Family:** GB**Cyl** → Cylinder
- **Glass Color:** **Blu** → Cobalt Blue (or no color prefix → Clear)
- **Capacity:** **5** → 5ml (from position after family)
- **Applicator:** **BlkShSht** → cap, **Spry** → spray, **Roll** → roll-on

### Matching Algorithm
For each live site product, fuzzy-matches against Convex groups on:
1. **Family name** (70% similarity threshold)
2. **Capacity** (within 1-2ml tolerance)
3. **Color** (60% similarity if present)
4. **Applicator type** (exact match if specified)

**42.5% match rate** reflects:
- Gaps in color/applicator combinations on live site vs. Convex
- Differences in capacity encoding (some live products are ambiguous: 2oz → assumed 59ml)
- Legacy code ambiguities for smaller bottles

---

**Generated by:** Master Product List Builder v1.0  
**Data Sources:** 
- Convex: `/data/product_groups_by_family.json` (225 groups)
- SKU Matrix: `/clients/best-bottles/paper-doll/product-family-matrix.json` (2,081 SKUs)
- Live Site: Manual crawl of category pages
