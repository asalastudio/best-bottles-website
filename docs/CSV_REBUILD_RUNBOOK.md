# CSV → Convex Rebuild Runbook

This runbook documents how to materialize the Convex `productGroups` table
from the canonical CSV (`data/grace_products_final.v2.csv`).

> ## ⛔ STOP — `--apply` is currently UNSAFE (verified 2026-07-11)
>
> `buildGroupSlug()` in `convex/productGroupsRebuild.ts` produces
> `family-capacityMl-color` slugs, but the **live** `productGroups` table
> uses the richer grammar from `convex/migrations.ts` `buildSlug()`
> (`family-capacity-color-neckThread-applicator`, hyphenated colors,
> e.g. `elegant-15ml-frosted-13-415-rollon`). The measured overlap between
> the rebuild's slugs and the live slugs is **0 of 194** — running
> `--apply` today would create ~194 duplicate groups alongside the ~369
> live ones and corrupt catalog navigation.
>
> Until `buildGroupSlug` is reconciled with the live slug grammar (or a
> crosswalk table is added), run **dry-run only**. `--apply` becomes safe
> only when a dry-run reports `created: 0` and orphans ≈ 0.
>
> **Code interlock:** `rebuildFromCsv` refuses to `--apply` any run that
> would create more than `APPLY_CREATE_LIMIT` (20) new groups — it throws
> before writing anything. This is a backstop for the warning above, not a
> substitute for reconciling the slugs. `--force` overrides it and must
> only be used once the slug grammar is reconciled and a dry-run reviewed.

## Recommended sequence to make `--apply` safe

1. Resolve the 153 duplicate-website-SKU pairs (catalog dedupe) first — the
   canonical group set changes once dupes are removed.
2. Reconcile `buildGroupSlug()` to emit the live grammar
   (`family-capacity-color-neckThread-applicator`, hyphenated colors), or
   add a slug crosswalk table.
3. Run the dry-run (`node scripts/rebuild_product_groups.mjs`) and confirm
   `created: 0` (or a small, explainable number) and orphans ≈ 0.
4. Only then `--apply`. The interlock will still block a bad run; do not
   reach for `--force` to get past it — a large create count means step 2
   is not done.

## When to run

- After any edit to `data/grace_products_final.v2.csv` (new rows, removed
  rows, color/capacity/family changes).
- After running `scripts/backfill_color.mjs --apply` (the v2 CSV is the
  source of truth, Convex is a projection).
- Once a week as a safety net, even if no CSV edits happened.
- Before any image generation campaign, to make sure Convex has the
  freshest productGroup metadata (the image pipeline queries Convex).

## What it does

Reads the CSV, computes canonical productGroups as
`(family, capacityMl, color)` tuples with row counts, and upserts each
into Convex:

- **Create** new groups that don't exist yet.
- **Update** existing groups whose `variantCount`, `family`, `color`,
  or `capacityMl` drifted from the CSV. Sets `lastSyncedAt = Date.now()`
  and `csvRowCount = N`.
- **Skip** groups that are already in sync (idempotent — re-running is
  cheap).
- **Report** orphans in Convex not in CSV (does NOT auto-delete — you
  decide whether to archive or keep).

## The schema fields it touches

Adds two new fields to `productGroups` (already in `convex/schema.ts`):

- `lastSyncedAt: v.optional(v.number())` — Unix ms timestamp of last rebuild
- `csvRowCount: v.optional(v.number())` — number of CSV rows mapped to this group

When `csvRowCount` differs from `variantCount`, the group has drifted
from the CSV (a SKU was added/removed in CSV without rebuilding).
Use the reconciliation script to detect this:

```bash
node scripts/reconcile_catalog.mjs --convex-url <url>
```

## How to run

### 1. First, deploy the schema change

The new fields are in `convex/schema.ts`. After deploying:

```bash
npx convex dev       # or `npx convex deploy` for prod
```

The schema push is additive — existing groups just get `null` for the new
fields until the rebuild runs.

### 2. Dry-run the rebuild

Convex actions can't read the repo filesystem, so a local runner script reads
the CSV and passes its content to the action:

```bash
node scripts/rebuild_product_groups.mjs
```

Expected output on a fresh Convex:

```json
{
  "dryRun": true,
  "csvRowCount": 2285,
  "canonicalGroupCount": 218,
  "created": 218,
  "updated": 0,
  "unchanged": 0,
  "orphansInConvex": [
    /* any legacy groups not in CSV */
  ],
  "csvOnlyGroups": [
    /* all canonical slugs */
  ]
}
```

Review the `orphansInConvex` list. Each one is a Convex group with no
matching CSV row. Common cases:

- **Hand-created test groups** — safe to delete after review
- **Legacy groups for Components** — may be intentional, keep
- **Genuine drift** — investigate whether a SKU was added/removed

### 3. Apply the rebuild

```bash
node scripts/rebuild_product_groups.mjs --apply
```

Expected output:

```json
{
  "dryRun": false,
  "created": 218,
  "updated": 0,
  "unchanged": 0
}
```

### 4. Re-run to verify idempotence

```bash
node scripts/rebuild_product_groups.mjs --apply
```

Expected output (second run):

```json
{
  "dryRun": false,
  "created": 0,
  "updated": 0,
  "unchanged": 218
}
```

If you see `updated > 0` on the second run, there's a non-deterministic
field being read from CSV (likely a parsing issue — check `canonical_slug`
uniqueness).

### 5. Delete orphans (manual, after review)

After reviewing the `orphansInConvex` list, pass the slugs to delete:

```bash
npx convex run productGroupsRebuild:deleteOrphanedGroups '{
  "slugs": ["legacy-group-slug-1", "legacy-group-slug-2"],
  "confirm": "DELETE"
}'
```

This is intentionally NOT auto-called by the rebuild. Orphan deletion
should always be a human decision.

## Editing the CSV between rebuilds

After editing `data/grace_products_final.v2.csv`:

1. Run `scripts/reconcile_catalog.mjs` to see what changed.
2. Run the rebuild dry-run to see what it would do.
3. Apply the rebuild.
4. Run `scripts/reconcile_catalog.mjs --convex-url <url>` to verify
   Convex now agrees with CSV.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `created > 0` on every run | CSV not stable (different row count each time) | Check for BOM, line ending, encoding issues |
| `updated > 0` on every run | `canonical_slug` regex differs from Convex | Re-run dry-run, diff the affected groups |
| Convex rejects the mutation | Schema field mismatch | Run `npx convex dev` to sync schema |
| `orphansInConvex` includes all groups | CSV is empty or wrong path | Check the `--csv` path passed to `scripts/rebuild_product_groups.mjs` |
| Mutation timeout | 218 upserts in one transaction exceeds Convex limits | Lower batch size; split into multiple runs |

## When Phase 2 is done

After this lands, every image generation campaign can read productGroups
with confidence that:

- Every CSV row has a corresponding group in Convex
- Every group has `csvRowCount === variantCount` (no drift)
- Every group has `lastSyncedAt > 0` (rebuilt at least once)
- Orphans are reviewed and either deleted or marked as intentional

This is the foundation for Phase 5 (style-reference shoot + family sweep).
The image pipeline will read from Convex; Convex will be a projection of
CSV; CSV will be git-tracked.

## Files

- `convex/productGroupsRebuild.ts` — the mutation
- `convex/schema.ts` — schema fields (`lastSyncedAt`, `csvRowCount`)
- `data/grace_products_final.v2.csv` — the canonical CSV (output of
  `scripts/backfill_color.mjs --apply`)
- `scripts/backfill_color.mjs` — produces the v2 CSV from the original
- `scripts/reconcile_catalog.mjs` — verifies CSV ↔ Convex ↔ Sanity
- `reports/reconciliation-<date>.md` — the baseline reconciliation