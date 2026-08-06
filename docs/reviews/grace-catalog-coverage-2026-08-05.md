# Grace Full-Catalog Coverage Audit — 2026-08-05

Question answered: "Is Grace pulling the correct FULL catalog from Convex for every single
product?" Tool: `scripts/grace_catalog_coverage_audit.mjs` (deterministic, no LLM calls —
re-runnable against prod after deploy).

## The number, settled

There is no "2,318." Live counts today:

| | products table | stats (groups' variantCount) | groups |
|---|---|---|---|
| **dev** | **2,474** | 2,474 (exact after yesterday's reconcile) | 362 |
| **prod** | **2,330** | 2,320 (prod has its own ±10 denorm drift + stale groups) | 356 |

The live site reads **prod**, so customers' Grace answers from 2,330 rows today. Dev is
the corrected, larger catalog.

## Layer 1 — Integrity (dev): 100% CLEAN

Every one of 2,474 products links to a real group; zero orphans, zero dangling refs,
zero empty groups, `variantCount` and `priceRangeMin/Max` denormalizations exact on all
362 groups, every product priced and named. The data layer Grace queries is sound.

## Layer 2 — Reachability through Grace's own searchCatalog (dev)

- **PDP slugs: 362/362 resolve** via `getProductGroup`.
- **Search: 354/362 groups (97.8%) reachable** with realistic customer phrasing
  (family + capacity + color, plus the applicator when the group is an applicator
  sub-line — matching how customers actually ask).
- The 51 groups that required the applicator word are expected: "50ml clear Empire"
  returns the family's core results; "50ml clear Empire lotion pump" surfaces the
  lotion-pump sub-group (the intent-boost fix from 2026-08-04 doing its job).
- **8 residual unreachable groups**, all metadata edge cases, mostly capacity-0
  component groups whose probe text is degenerate:
  `cap-closure-13-415`, `cap-closure-Specialty`, `lotion-pump-17-415`,
  `vintage-bulb-sprayer`, `vintage-bulb-sprayer-18-415`, `cylinder-9ml-clear`
  (legacy unsuffixed group), `diva-46ml-clear-18-415`, `elegant-15ml-clear-13-415-capclosure`.
  Fix: give component groups searchable display terms / capacity-null handling, or fold
  legacy groups into their suffixed successors.

## Layer 3 — Dev ↔ prod SKU drift (full list: `docs/reviews/dev-prod-sku-drift.json`)

- **155 SKUs exist only on dev** (Diva 49, Elegant 36, Sprayer 14, Cylinder 11, …) —
  dev-side enrichment/additions since prod last synced.
- **11 SKUs exist only on prod**: `HMAC-TEST-ONLY` (a test row in production — delete)
  plus 10 stale pre-rename SKUs (`GB-CIR-FRS-50ML-ASP-01..09`, `GB-CYL-CLR-25ML-SPR-SBLK`)
  that dev renamed to descriptive suffixes. Prod is *behind*, not diverging.
- Found in passing: prod's old `getByFamily` silently caps at 100 rows/family, and prod's
  `getAllForAudit` full-table read now exceeds the 16MB transaction limit — both worth
  fixing in the next deploy (the audit script uses cursor pagination instead).
- Catalog strays on dev worth a taxonomy pass: `GBTallCyl9WhtSht` (malformed SKU, own
  one-row "Tall Cylinder" family, name/color contradiction), `PKG-BOX-BRN-4X4X4` in
  family "Unknown".

## What "fully tested and synced" requires from here

1. **Deploy to prod** (Grace fixes + OpenAI-only migration are dev-only), run
   `migrations:reconcileProductGroups` on prod, delete `HMAC-TEST-ONLY` + the 10 stale
   SKUs (or re-run the rename migration there).
2. **Re-run this audit against prod** — the script takes an export dir + URL; target
   green: integrity clean, 100% slugs, ≥97% search reachability, drift = 0.
3. Fix the 8 edge groups on dev first so prod inherits the fix.
4. Then the LLM layer on prod: the 14-question consistency battery + the 5-case
   navigation battery, both already scripted (`scripts/grace_consistency_battery.mjs`,
   `tests/grace-navigation-battery.live.test.ts`).

When those four are green on prod, "she's pulling the correct full catalog for every
product" is a measured fact on the deployment customers actually use.
