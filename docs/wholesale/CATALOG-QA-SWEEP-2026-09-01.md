# Catalog QA — first full sweep

Ran `src/lib/wholesale/catalogQa.ts` against **every family** in the dev
Convex deployment, 2026-09-01. Paginated by family: a whole-table scan
exceeds Convex's 16 MB per-execution read limit.

**2,472 of 2,474 claimed variants scanned across 38 families.**

## Headline

| | count | share |
|---|---|---|
| Complete | 2,193 | **89%** |
| Degraded (sells, but worse) | 56 | 2% |
| Incomplete (blocking) | 223 | 9% |
| **Duplicate SKUs** | **0** | — |

Zero duplicate SKUs catalogue-wide, and zero rows missing a price or a
Shopify variant link. The commerce-critical spine is sound; the gaps are
in merchandising data.

## Blocking findings

| finding | rows | note |
|---|---|---|
| `missing_components` | 168 | configurable bottles whose picker would open empty |
| `missing_fitment` | ~9 | real bottles with no neck recorded (after excluding packaging) |
| `missing_website_sku` | 2 | |

## Advisory / degraded

| finding | rows |
|---|---|
| `missing_case_quantity` | 322 |
| `missing_color` | 67 |
| `missing_image` | 23 |
| `missing_dimensions` | 4 |

## Family health (worst first, bottles only)

| family | n | complete |
|---|---|---|
| Diva | 225 | 78% |
| Elegant | 290 | 87% |
| Cylinder | 382 | 93% |
| Slim | 129 | 95% |
| Rectangle | 63 | 95% |
| Round | 186 | 96% |
| Empire / Grace / Diamond / Vial | — | 96% |
| Sleek | 192 | 97% |
| Circle | 209 | 98% |
| Boston Round | 123 | 99% |
| Atomizer / Flair / Square / Decorative / Teardrop | — | 100% |

`Sprayer` (42%) and `Cap/Closure` (69%) are components, not bottles —
their gaps are `missing_color` and `missing_case_quantity`, not fitment.

## THREE RULES THE DATA CORRECTED

The first pass reported far worse numbers. Every correction below came
from reading the flagged rows instead of trusting the check.

1. **Components are not bottles.** Requiring a component list of every row
   flagged all 42 Droppers, Roll-On Caps, Sprayers and Caps — they *are*
   components — plus 15 Metal Atomizers, whose closure is integrated
   (PRD §38: not every fitment is a threaded neck). The catalog already
   records this in `assemblyType`
   (`component` | `complete-set` | `2-part` | `3-part`); the check now
   reads it. **35 false positives removed.**

2. **`paperDollBodyUrl` is dead.** PRD §34 asks for a missing-3D check, but
   that column — and every `paperDoll*` sibling — is populated on **0 of
   400** sampled rows. The check fired on 382 of 382 Cylinders. 3D coverage
   lives in code (`src/lib/configurator/families.ts`), not that column, so
   the check was removed rather than left to flag everything forever.
   **382 false positives removed.**

3. **Packaging has no neck.** Gift bags, cartons, resealable bags and a
   funnel were flagged `missing_fitment`. They attach to nothing.
   Categories `Packaging`/`Accessory` and `assemblyType: accessory` are now
   exempt. **51 false positives removed**, and four families move off 0%.

A validator that cries wolf is one people learn to ignore, which defeats
the point of building it. Uncorrected, this sweep would have reported
~468 false findings against 223 real ones.

## Caveats

- **Dev deployment**, not prod. Prod has historically carried fewer rows
  (2,320 vs 2,478), so prod numbers will differ.
- `missing_case_quantity` (322) is advisory because no ordering rule
  depends on it today — the order minimum is $50 per order, not a pack
  multiple.
