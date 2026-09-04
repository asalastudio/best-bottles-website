# Production measurement sync-back — ledger (captured 2026-09-04)

The canonical-truth measurement sync-back described in `AGENT-HANDOFF.md` §4
("Best-Bottles-Website repo agent: own the 839-SKU measurement sync-back
migration") **has been applied to the production Convex deployment**
(`precise-raccoon-123`). It was applied directly to the database; the code
that performed the write was never committed to this repository. This file
records what production contains so the work is reproducible and cannot be
lost.

## What production holds

Snapshot: `prod-sync-back-snapshot-2026-09-04.csv` — one row per `products`
document (2,444), exported 2026-09-04 ~04:15 UTC through the public
`products:getAllForAudit` / `products:getBySku` queries. Columns are the
identity keys plus every measurement field the sync-back touches.

| Metric | Before (truth sheet, 2026-07-12) | Production 2026-09-04 |
|---|---|---|
| Rows stamped `measurementSource` | 0 | **2,024** |
| Rows `verified: true` | 10 | **974** (all 974 are stamped rows) |
| Rows with real depth (`widthMm != depthMm`) | 0 | **567** (all stamped) |
| `measurementSource` value | — | `best-bottles-master-truth@2026-07-12:f2b25bbe4ffe` (single value) |

`f2b25bbe4ffe` is `sha256(best-bottles-master-truth.csv)[:12]` of the CSV
committed beside this file. Verified:

```
$ sha256sum data/audits/canonical-truth-2026-07-12/best-bottles-master-truth.csv | cut -c1-12
f2b25bbe4ffe
```

Value check: for the 1,943 stamped rows that have a `canon_bodyHeightMm` in
the master CSV, 1,937 match `heightWithoutCap` exactly. The 6 that differ are
component rows (gift bags, a cap) whose `93.8` copy-paste value (truth sheet
finding F8) was correctly cleared to blank.

## What is still unstamped (420 rows)

**112 rows are not in the master CSV at all** — they were imported after the
2026-07-12 truth sheet (`legacy-sweep-2026-09-02`: 108,
`component_reference_reconciliation_2026-09-03`: 2, other: 2). They need a
truth-sheet pass before they can be synced.

**308 rows are in the master CSV but were not written:**

| Family | Unstamped | of which master says `ready` | axis class |
|---|---|---|---|
| Round | 178 | 174 | round |
| Diamond | 43 | 43 | flat |
| Royal | 30 | 12 | round |
| Packaging Supply | 12 | 0 | component |
| Cap/Closure | 12 | 0 | component |
| Sprayer | 8 | 0 | component |
| Gift Bag | 7 | 0 | component |
| Plastic Bottle | 4 | 2 | round |
| Cap/Component, Bell, Gift Box | 2 each | 0 | — |
| Aluminum Bottle, Tool, Dropper, Roll-On Cap, Boston Round, Apothecary, Lotion Bottle, Unknown | 1 each | Apothecary only | — |

Round, Diamond and Royal line up with the truth sheet's §8 physical-measurement
escalations (Round 78/128 ml spec-vs-render conflict, Diamond 60 ml depth,
Royal 13 ml 17 mm rows, Aluminum 100 ml body height), so their omission is
plausibly deliberate. Whether *all* 174 `ready` Round rows were skipped on
purpose or the run stopped early is not recorded anywhere; treat them as the
open remainder.

## Schema

`convex/schema.ts` did not declare `measurementSource` when the write
happened, so every production deploy from 2026-09-04 03:04 UTC failed at
`npx convex deploy` with *"Object contains extra field `measurementSource`"*
until [#78](https://github.com/asalastudio/best-bottles-website/pull/78)
added it (optional, nullable string). Any future direct write to production
must land its schema change in `main` first.

## Not in this repo

- The mutation/script that wrote the 2,024 rows. If it still exists on a
  local machine, commit it under `convex/` or `scripts/` and reference this
  ledger; otherwise the snapshot CSV plus the `canon_*` columns are sufficient
  to re-derive the same writes.
- `image-generation-coverage-2026-08-05/` (still ignored; regenerable).
