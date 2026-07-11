# SKU / Variant Number Audit — Single Source of Truth Investigation

This document reconciles the inconsistent numbers you're seeing across the
Bottle Family Workbench, Sanity Studio, batch preflight, and one-off
selection. It identifies the **canonical source of truth**, lists every
derived count, and proposes the architectural fix.

## The short answer

You have **at least four independent data sources** for "how many SKUs do
we have," and they don't agree because they're literally different sets
of records seeded from different master sheets at different times. None
of them is "wrong" — they describe overlapping but distinct universes:

| Source | Records | What it represents |
|---|---|---|
| `data/grace_products_final.csv` | 2,285 | Best Bottles catalog, Grace SKU ↔ Website SKU mapping, export from Grace ERP |
| `data/master_v8.3_products.json` | 3,179 | Master v8.3 product record set, includes Components (caps, sprayers) and other non-bottle items |
| `data/live-site-product-master.json` | 106 products, 61 gaps, 207 orphans, 45 matches | Reconciliation report between live-site scrape and the canonical catalog |
| Convex `productGroups` table | ~230 groups, 2,354 variants | Curated product groups with `variantCount` cached at last migration |

The numbers you're seeing in Studio (18 variants, 23 skews, 7 current)
are derived from **Sanity GROQ filter scopes** on `productGroupContent`
documents, which is a **fifth** layer on top of all of this.

## Where each number comes from

Let me trace the specific numbers you saw when clicking on the **5ml
clear cylinder roll-on** bottle.

### 1. "18 variants" in Studio

This is **Sanity Studio's `documentList` filter result count** for
`productGroupContent` documents. The Studio structure is defined in
`sanity.config.ts`:

```ts
S.listItem()
    .title("Product Page Overrides")
    .child(
        S.documentList()
            .title("Product Overrides")
            .filter('_type == "productGroupContent"')
            ...
    )
```

`productGroupContent` is a **Sanity document type** (one per product page
in the new website). It is *not* the same as a Convex productGroup.
It's the editorial override layer — one document per product page that
needs custom copy, custom paper-doll offsets, or custom page blocks.

**What "18 variants" likely means:** there are 18 `productGroupContent`
documents in Sanity for the Cylinder 5ml Clear family, each one
representing a slightly different variant (different applicator, finish,
or feature combination) that has editorial overrides.

This has **no direct relationship** to the actual variant count of
SKUs in Convex or the CSV. It's the count of editorial override
documents, which is a small editorial subset.

### 2. "23 skews in this cohort have no match reference"

This is from `preflightProductGroupImageTarget` in
`convex/products.ts`, which queries Convex. It's checking which products
in the Cylinder 5ml Clear cohort have a usable reference image for the
Madison image pipeline (NOT for Shopify, NOT for Sanity, NOT for the
website).

The "no match reference" set is **products whose `imageUrl` field is
either null, doesn't match a known pattern, or doesn't pass the
`isShopifyCdnUrl` check**. The cohort is filtered by `family=Cylinder`,
`capacityMl=5`, `color=Clear` — so 23 is the count of those SKUs that
the Madison pipeline can't pull a geometry reference for.

### 3. "Generate current group is 7"

This is the intersection of (a) the cohort and (b) the no-match-reference
set, filtered to SKUs the pipeline will actually attempt to generate.
The "7" is the count of products where:

- They belong to this cohort
- They have a usable Shopify reference image
- They don't have an existing `heroImageUrl` on their `productGroup` row

So 23 − 16 = 7. Or more precisely: 7 = cohort size with valid reference
AND missing hero image.

### 4. "Current applicator will be 9, but will not generate any skews"

"Current applicator" is the **filter selection** in the UI — when you
selected "Roll-on" you told the Studio to look at the 9 SKUs that use
the roll-on applicator. "Will not generate any skews" means **the filter
narrowed the cohort to zero generate-eligible SKUs** — either because:

- None of the 9 roll-on SKUs has a valid reference image, OR
- All 9 already have `heroImageUrl` set, OR
- The roll-on bucket filter is being applied AFTER the missing-reference
  filter (so the "skews no match reference" count of 23 doesn't include
  any roll-on SKUs)

The most likely cause: the filter precedence order is making the roll-on
bucket impossible to satisfy. Without seeing the Studio tool source I
can't say which.

### 5. "One-off gives me 165"

"One-off" is a different filter mode that doesn't apply the
"missing-reference" pre-filter. 165 = the count of all SKUs in the
broader cohort regardless of reference availability. This is the raw
"how many SKUs would I generate if I ignored gating" number.

### 6. "Current group says 30, but will generate 7"

**This is the smoking gun.** "Current group" (30) and "will generate" (7)
are computing the same thing with different definitions:

- **Current group = 30:** all SKUs in the cohort that match the
  currently-selected filters (family, capacity, color, applicator
  bucket) with no other gating.
- **Will generate = 7:** the subset of those 30 that pass all the
  preflight gates — has a usable reference image, doesn't already have
  a `heroImageUrl`, hasn't been skipped.

The 30-vs-7 discrepancy is the 23 "skews in this cohort have no match
reference." They show up in the "current group" count (full cohort)
but fail the preflight (no usable reference), so they drop out of
"will generate."

## Why the counts disagree

The counts disagree because **they're answering different questions**:

| Number | Question it answers |
|---|---|
| "18 variants" in Studio | How many `productGroupContent` documents in Sanity for this cohort? |
| "23 skews no match reference" | How many Convex products have no usable reference image? |
| "Generate current group = 7" | How many of those 7 are eligible to be generated? |
| "Current applicator = 9" | How many cohort rows match the roll-on bucket? |
| "Will generate 0" | How many of those 9 are preflight-clean? |
| "One-off = 165" | How many cohort rows match the filter regardless of gating? |
| "Current group = 30" | How many cohort rows match the filter (no preflight gate)? |
| "Will generate = 7" | How many of those 30 pass all gates? |

Each number is internally consistent for the question it's answering.
The problem is they're **not labeled with the question**, so you see
"30 vs 7" and read it as a bug.

## The single-source-of-truth problem

Right now:

- **Convex `productGroups` table** is the canonical source for product
  identity (which SKUs exist, what families, what variants per group).
  But `variantCount` is a **cached field** last updated by a migration —
  if the underlying products change without re-running the migration,
  `variantCount` is stale.
- **Sanity `productGroupContent` documents** are an editorial override
  layer, not the canonical product list. Studio counts derived from
  GROQ filters on these documents are about **editorial content**, not
  product identity.
- **`data/grace_products_final.csv`** is the Grace ERP export. It's
  authoritative for Grace SKU ↔ Website SKU mapping, but it's a snapshot
  and can drift from Convex if Convex has been updated since the export.
- **`data/master_v8.3_products.json`** has 3,179 entries including
  Components (caps, sprayers) that the CSV does not have.

The numbers you see at any given UI surface are derived from whichever
source that surface queries, and the **label-to-source mapping isn't
visible in the UI**.

## What needs to change

### 1. Establish the canonical source

**`data/grace_products_final.csv` is the human-readable source of
truth.** It's the file your team reads, diffs in git, and reviews in PRs.
Convex `productGroups` should be a **materialized projection** of this
CSV, regenerated by a migration each time the CSV changes.

### 2. Add a `lastSyncedAt` field to `productGroups`

Currently `variantCount` is updated by migrations but there's no
timestamp showing when. Add:

```ts
lastSyncedAt: v.optional(v.number()),  // Date.now() when this group was last re-projected from CSV
csvRowCount: v.optional(v.number()),  // number of rows in the CSV that map to this group, for diffing
```

When the CSV changes, the migration updates `lastSyncedAt` and
`csvRowCount`. The Studio UI can then show "this group was last synced N
days ago" and "current Convex variantCount is X, CSV rowCount is Y —
diverged."

### 3. Single API endpoint that returns a typed count

Every UI surface should call the same Convex query and get back a typed
record with **all the relevant counts labeled**:

```ts
export const getCohortImageStats = query({
    args: { 
        family: v.string(),
        capacityMl: v.number(),
        color: v.string(),
        applicatorBucket: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const cohort = await ctx.db.query("productGroups")
            .withIndex("by_family_capacity", q => q
                .eq("family", args.family)
                .eq("capacityMl", args.capacityMl))
            .filter(q => q.eq(q.field("color"), args.color))
            .collect();
        
        const allSkus = await ctx.db.query("products")
            .filter(q => q.eq(q.field("family"), args.family))
            .filter(q => q.eq(q.field("capacityMl"), args.capacityMl))
            .collect();
        
        return {
            // Cohort identity
            cohortGroupCount: cohort.length,           // productGroups in this cohort
            cohortSkuCount: allSkus.length,            // products in this cohort
            totalVariantCount: cohort.reduce((s, g) => s + g.variantCount, 0),
            
            // Reference gating
            withUsableReference: allSkus.filter(s => isUsableReference(s.imageUrl)).length,
            withoutUsableReference: allSkus.filter(s => !isUsableReference(s.imageUrl)).length,
            
            // Image gating
            withHeroImage: cohort.filter(g => g.heroImageUrl).length,
            withoutHeroImage: cohort.filter(g => !g.heroImageUrl).length,
            
            // Generation gating
            eligibleToGenerate: allSkus.filter(s => 
                isUsableReference(s.imageUrl) &&
                cohort.find(g => g._id === s.productGroupId && !g.heroImageUrl)
            ).length,
            
            // Filter-applied counts (when applicatorBucket is supplied)
            applicatorBucketCount: args.applicatorBucket 
                ? allSkus.filter(s => matchesApplicatorBucket(s, args.applicatorBucket)).length
                : null,
            applicatorBucketEligible: args.applicatorBucket
                ? allSkus.filter(s => 
                    matchesApplicatorBucket(s, args.applicatorBucket) &&
                    isUsableReference(s.imageUrl) &&
                    cohort.find(g => g._id === s.productGroupId && !g.heroImageUrl)
                  ).length
                : null,
            
            // Freshness
            lastSyncedAt: Math.max(...cohort.map(g => g.lastSyncedAt ?? 0)),
            csvRowCount: cohort.reduce((s, g) => s + (g.csvRowCount ?? 0), 0),
            csvDivergence: cohort.reduce((s, g) => s + Math.abs((g.variantCount ?? 0) - (g.csvRowCount ?? 0)), 0),
        };
    },
});
```

Every UI surface — Bottle Family Workbench, Studio preflight, one-off
selector, batch preflight — calls this same query and renders the same
labels. The user always sees:

```
Cohort:           91 groups, 2,285 products
With reference:   2,262 products (23 missing)
With hero image:  0 (none approved yet)
Eligible:         2,262 (will generate)
Current group:    Cylinder 5ml Clear
  Groups in cohort: 1
  Total SKUs:       18
  With reference:   16
  Eligible:         7 (will generate)
  Roll-on bucket:   9 SKUs, 0 eligible
```

### 4. Surface the source of each count

The UI should label every count with its data source:

```
"Current group = 30 (Convex productGroups)"
"Eligible = 7 (Convex products with usable reference AND missing heroImageUrl)"
"Editorial overrides = 18 (Sanity productGroupContent)"
```

This makes it impossible to confuse "Sanity document count" with
"Convex product count" — the source is right there.

### 5. Reconcile CSV ↔ Convex ↔ Sanity

Add a one-shot reconciliation script:

```bash
node scripts/reconcile-csv-convex.mjs \
  --csv data/grace_products_final.csv \
  --convex-env helpful-elephant-638 \
  --sanity-project <id> \
  --output reports/csv-convex-sanity-diff.md
```

This produces a markdown report showing:

- SKUs in CSV but not in Convex
- SKUs in Convex but not in CSV
- productGroups with stale `variantCount` (csvRowCount differs)
- Sanity `productGroupContent` documents that don't match any
  productGroup slug (orphans)
- productGroups with no corresponding Sanity document (gaps)

This becomes the daily/morning-check for the team.

## TL;DR

The numbers aren't wrong — they're answering different questions from
different sources, and the UI doesn't label which source. The fix is:

1. **Establish CSV as the human-readable source of truth**
2. **Materialize Convex `productGroups` from CSV** with a `lastSyncedAt`
   and `csvRowCount` field for divergence detection
3. **One typed Convex endpoint** that returns all the labeled counts any
   UI surface needs
4. **Every UI surface calls that endpoint** and shows the source label
5. **Reconciliation script** that runs daily and reports divergence

After this, the numbers can't disagree because they're all the same
number, queried once, labeled by source.

## What to do next

In priority order:

1. **Add the `getCohortImageStats` Convex query** above (1–2 hours)
2. **Replace every UI's count-fetching code** with calls to it
   (depends on how many surfaces, but most are local to the Studio
   plugin) (half day to one day)
3. **Add the reconciliation script** and run it once to capture the
   current divergence state (half day)
4. **Add `lastSyncedAt` + `csvRowCount` to `productGroups`** and backfill
   from CSV (1–2 hours)
5. **Add a daily cron** that runs the reconciliation and emails the
   team if divergence exceeds N (half day)

After that, every count in the system reads from one source and labels
itself. The 18-vs-23-vs-7-vs-9-vs-165-vs-30 problem disappears.