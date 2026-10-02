# Catalog kit completion inventory — live PROD refresh 2026-09-20

This inventory replaces the Sep 8, 2026 snapshot. It is a **read-only** census of Convex **PROD** (`https://precise-raccoon-123.convex.cloud`) taken 2026-09-20 via public `productPlates` + `productKits` queries. It does not publish catalog data.

## Exact plate and kit ledger (live)

| Kit state | Rows | Meaning |
| --- | ---: | --- |
| Kit complete | **1,728** | `productKits` row served for the current published plate (`forSkus` non-null; plateSha256 matches). |
| · full | 1,582 | Layered kit with body + fitment/cap parts as registered. |
| · capSplit | 146 | Body + cap only (no separate fitment layer). |
| · bodyOnly | 0 | — |
| No kit | **555** | Published plate with no served kit for the current plate hash. ≈415 bottle-family plates + ≈140 component/loose-fitment plates (Sprayer, Roll-On Cap, Dropper, Cap/Closure, Bell, Pillar, …). |
| Kit integrity issues | **0** | `productKits:integrity` reported no duplicate / stale / missing-body issues. |

**Plates published:** **2,283** unique SKUs in `productPlates`.

### vs obsolete Sep 8 snapshot

| Metric | Sep 8 ledger | **Live PROD 2026-09-20** |
| --- | ---: | ---: |
| Kit complete | 420 | **1,728** |
| Kit candidate | 411 | *(candidates were shipped Sep 19 — see below)* |
| Held with reason | 927 | *(superseded; use no_kit + family gaps)* |
| Plates / exact rows | 1,876 | **2,283** |

Do **not** use `docs/reviews/catalog-kit-completion-2026-09-08/` counts for planning. Keep that folder only as historical evidence of the pre-ship candidate/hold classification.

### Sep 19 ship

Jordan authorized publishing the prepared kits on 2026-09-19. Release receipts under `docs/reviews/*-2026-09-19/` cover **1,304 unique SKUs** published to PROD (and mostly DEV). Contact sheets: `public/reviews/kit-completion-2026-09-19/`. Live PROD kit count is higher (1,728) because Cylinder and earlier publishes were already indexed before that ship.

## Build Your Bottle (funnel × live kits)

| | Configs | full | capSplit | none |
| --- | ---: | ---: | ---: | ---: |
| **TOTAL** | **1,107** | **926** | **62** | **119** |

Cylinder configs are fully kitted. Remaining `none` configs (approx): Elegant 18, Circle 35, Diva 20, Boston Round 26, Round 14, Empire 6. See `builder-kit-accounting-prod.json`.

## Coarse family — kits on PROD

See `KIT-STATUS-2026-09-20.md` and `coarse-family.json` for the full table (Cylinder 420 kits, Elegant 232, Circle 167, …).

## Files

- `kit-completion-ledger.csv` — one row per published plate SKU (`kit_complete` | `no_kit`) with `completeness` when present.
- `live-kit-census.json` — headline totals + per-familyName breakdown.
- `builder-kit-accounting-prod.json` — builder funnel configs vs live kits.
- `coarse-family.json` — rolled-up family totals.
- `KIT-STATUS-2026-09-20.md` — narrative summary for chat / handoffs.
- `README.md` — this file.

## How this was generated

Read-only against PROD:

1. `productPlates:families` + `productPlates:byFamily` → all plate SKUs.
2. `productKits:forSkus` (batches of 50) → served kits / completeness.
3. `productKits:integrity` → row count + issue scan (0 issues).

Re-run whenever kit or plate publishes land; do not invent counts from older ledgers.
