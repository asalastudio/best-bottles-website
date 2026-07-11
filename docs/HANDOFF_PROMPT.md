# Best Bottles PDP Pipeline — Handoff Document

You are taking over a multi-turn work session on the Best Bottles PDP image-generation pipeline. This document captures exactly what was done, what is live in the repo, what is queued, what is broken, and the open questions. Read it end-to-end before touching anything.

## 1. What we were building

A reference-locked image-generation pipeline for the Best Bottles catalog (~2,285 SKUs across 23 families). The pipeline reads a canonical CSV, composes a four-section prompt per SKU (geometry + glass behavior + style + forbidden mutations), and renders 2080×2288 PDP images via `gpt-image-2`. Output is intended for the new Best Bottles website (the legacy `bestbottles.com` site is the data source, not the rendering target).

## 2. Repo state at handoff

**Repo root:** `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`
**Branch the work happened on:** `codex/best-bottles-product-hub-pipeline` (per the session-start snapshot, but the handoff user should verify this is the active branch).
**Sanity project:** embedded Studio at `/studio` route in the Next.js app.
**Convex deployment:** `helpful-elephant-638.convex.cloud`.

## 3. What is LIVE and verified

### 3a. SKU-lock sidecar composer system

**Path:** `pipeline/image-gen/sku-lock/`

This is the heart of the new system. It contains:

- `README.md` — slot reference and taxonomy for the sidecar JSON schema
- `schema.json` — JSON Schema (draft-07) for sidecar files
- `glass-behaviors/` — 6 files: `clear.json`, `colored_clear.json`, `frosted.json`, `swirl.json`, `apothecary.json`, `novelty.json`. Each contains a §2 lighting block (camera, lens, key/fill/edge, contact shadow, material truth language).
- `families/` — 23 family default files: `apothecary.json`, `boston-round.json`, `circle.json`, `cylinder.json`, `decorative.json`, `diamond.json`, `diva.json`, `dropper.json`, `elegant.json`, `empire.json`, `flair.json`, `grace.json`, `rectangle.json`, `roll-on-cap.json`, `royal.json`, `round.json`, `sleek.json`, `slim.json`, `spray-bottle.json`, `sprayer.json`, `square.json`, `vial.json`, `cap-closure.json`.
- `families/_closures/` — 12 closure-class override files: `apothecary_stopper.json`, `atomizer.json`, `dropper.json`, `fine_mist_spray.json`, `lotion_pump.json`, `phenolic_cap.json`, `reducer.json`, `roll_on.json`, `screw_cap.json`, `vintage_bulb.json`, `with_overcap.json`, `with_tassel.json`.
- `style-references/SHOOT_BRIEF.md` — photographer's brief for the 10 calibration photos.

**Resolution order** (later layers override earlier):
1. composer defaults (in `prompt_composer.mjs`)
2. `families/<family>.json` (per-family geometry)
3. `families/_closures/<closure-class>.json` (per-closure geometry + forbidden mutations)
4. `families/<family>/<slug>.json` (per-SKU override, rarely used)
5. `glass-behaviors/<behavior>.json` (§2 lighting overlay)

**12 closure classes** (taxonomy, exact spelling matters):
```
apothecary_stopper  fine_mist_spray  roll_on        vintage_bulb
atomizer            lotion_pump     screw_cap      with_overcap
dropper             phenolic_cap    with_tassel
```

**6 glass behaviors:** `clear`, `colored_clear`, `frosted`, `swirl`, `apothecary`, `novelty`.

### 3b. Composer

**Path:** `pipeline/image-gen/grid-images/scripts/prompt_composer.mjs`

Resolves sidecars into a four-section prompt. Public exports:
- `resolveSkuLock(job)` — returns the merged SKU-lock object (defaults + family + closure + per-SKU + glass behavior)
- `buildComposedPrompt(job)` — returns the full 4-section prompt as a string
- `resolveStyleReference(sku)` — returns the absolute path to the style reference photo (or null)
- `getResolvedSkuLock(job)` — alias of `resolveSkuLock`
- `classifyClosureClass(job)` — pattern-matches the job's `itemName` text against the 12 closure classes

The composer auto-infers:
- `glassBehavior` from `job.color` when family default is "clear"
- `glassColor` from `job.color` (the catalog's `color` column is empty in `grace_products_final.csv` but the new `grace_products_final.v2.csv` is backfilled)
- Closure class from `itemName` text via `classifyClosureClass()`

### 3c. Generator integration

**Path:** `pipeline/image-gen/grid-images/scripts/generate_openai_grid_images.mjs`

Two new CLI flags added:
- `--sku-lock` (default ON) — routes prompt through the composer
- `--no-sku-lock` — falls back to the original `buildPrompt()` function

The composer import is at the top of the file. The dispatch logic at the prompt-build call site is at line ~1067. If the composer returns null, the script falls back to the legacy `buildPrompt()` so existing jobs don't break.

### 3d. QA gate

**Path:** `pipeline/image-gen/grid-images/scripts/qa_gate.mjs`

Two-layer check system. Exit codes: 0 = pass, 1 = any failures, 2 = manifest missing.

Layer A — manifest checks (no image file required):
- A01: promptSource = sku-lock-composer (no legacy fallback regression)
- A02–A05: all four prompt sections present
- A06: no unresolved `{{vars}}` in the prompt
- A07: no empty "Material truth — ." lines
- A08–A10: closureClass / glassBehavior / glassColor in valid enums
- A11: behavior × color alignment (cobalt→colored_clear, frosted→frosted, etc.)
- A12: capState matches closureClass expectations (with_overcap→detached_right)
- A13: forbidden-applicator rule present in §4
- A14: "tassel" in prompt when closureClass = with_tassel
- A15: Apothecary closures properly forbidden

Layer B — image checks (per rendered PNG):
- B10: exact 2080×2288 dimensions
- B11: PNG format
- B12: background color within Δ of expected bgHex (default #F5F3EF)
- B13: product coverage 3–75% of pixels

CLI: `node qa_gate.mjs --manifest <path> [--raw-dir <path>] [--skip-images] [--verbose]`

### 3e. Pre-render sanity check

**Path:** `pipeline/image-gen/grid-images/scripts/pre_render_check.sh`

Bash script that runs dry-run + QA gate + per-job summary table. Exit 0 = safe to render. CLI: `bash pre_render_check.sh [--family NAME] [--limit N] [--jobs PATH] [--output DIR]`

### 3f. Color backfill

**Path:** `scripts/backfill_color.mjs` + output `data/grace_products_final.v2.csv`

The original `data/grace_products_final.csv` had **every row's `color` column empty**. This script:
1. Mines color from `item_name` + `item_description` text with priority ordering (cobalt blue > cobalt > blue start, etc.)
2. Falls back to graceSku code parsing (CLR / BLU / AMB / FRS / SWL / GRN / BLK / WHT)
3. Marks Component / Packaging / Glass Jar / Aluminum / Plastic Bottle rows as "n/a"
4. Adds traceability columns: `color`, `canonical_slug`, `colorSource`, `csvLastUpdatedAt`, `convexSyncedAt`

**Coverage result:** 2,060 inferred from text + 21 from graceSku code + 202 marked N/A + 0 could not infer. Out of 2,285 rows, 100% accounted for.

**Run modes:**
- Dry-run: `node scripts/backfill_color.mjs`
- Apply: `node scripts/backfill_color.mjs --apply` (writes v2 CSV)
- Report: `node scripts/backfill_color.mjs --report reports/color-backfill-baseline.json`

### 3g. Reconciliation script

**Path:** `scripts/reconcile_catalog.mjs`

Compares CSV ↔ master_v8.3 ↔ Convex ↔ Sanity. Outputs markdown report. CLI: `node scripts/reconcile_catalog.mjs [--convex-url URL] [--sanity-project ID] [--apply]`

**Critical finding from baseline report** (`reports/reconciliation-2026-06-24.md`): **0 of 194 CSV canonical slugs match Convex slugs** because the two systems use different slug conventions (CSV: `apothecary-15ml-cobalt-blue`, Convex: `apothecary-15ml-cobalt-blue-Ground-glassapplicator`). This is the architectural divergence that needs to be resolved by Phase 2 rebuild.

### 3h. Convex rebuild mutation

**Path:** `convex/productGroupsRebuild.ts`

The mutation that materializes Convex `productGroups` from the canonical CSV. Includes:
- `rebuildFromCsv` action — reads CSV, computes canonical (family, capacityMl, color) groups, upserts each, reports created/updated/unchanged + orphans
- `listAllGroups` internalQuery
- `insertGroup` internalMutation
- `updateGroupStats` internalMutation
- `deleteOrphanedGroups` internalMutation (requires explicit `"confirm": "DELETE"`)

Schema additions to `convex/schema.ts` (additive, no breaking changes):
- `lastSyncedAt: v.optional(v.number())` — Unix ms timestamp of last rebuild
- `csvRowCount: v.optional(v.number())` — number of CSV rows that mapped to this group

**Runbook:** `docs/CSV_REBUILD_RUNBOOK.md`

### 3i. Documentation

- `PIPELINE_QUICK_REFERENCE.md` (repo root) — one-page map of every artifact
- `docs/NUMBER_AUDIT.md` — the canonical explanation of the 18-vs-23-vs-7-vs-165-vs-30 numbering inconsistency you saw in Studio
- `docs/CSV_REBUILD_RUNBOOK.md` — Phase 2 runbook
- `docs/PHOTOGRAPHER_HANDOFF.md` — full photographer package
- `docs/STUDIO_BRIEF_ONE_PAGER.md` — printable one-pager for the shoot
- `pipeline/image-gen/grid-images/scripts/EMPIRE_SMOKE_TEST.md` — first live render recipe

## 4. What is QUEUED (not done yet)

- **Convex rebuild (Phase 2):** `productGroupsRebuild.ts` is written but **not deployed**. Runbook says: deploy schema change via `npx convex dev`, then run `npx convex run productGroupsRebuild:rebuildFromCsv '{"csvPath":"...","dryRun":true}'`. The current Convex state has 369 productGroups, 354 of which have NULL `primaryGraceSku` or `primaryWebsiteSku` (orphaned in Convex). Until rebuild runs, Convex and CSV are divergent.
- **Background hex unification:** Legacy `generate_openai_grid_images.mjs` hardcodes `#EEE6D4` (line 42, `BONE` constant). The new aios-shopify-pdp-images pipeline uses `#F5F3EF`. The composer is already calibrated to `#F5F3EF`. When the new pipeline takes over, the legacy hex needs to be replaced.
- **Style-reference shoot:** Photographer brief exists. 10 reference photos to be shot per `style-references/SHOOT_BRIEF.md`. After delivery, wire `styleReference` into the relevant family JSONs.
- **Empire smoke test for real:** All infrastructure (composer, QA gate, pre-render check, jobs JSON builder) is ready. 12-job dense slice at `/tmp/sku-lock-smoke-test-jobs.json` has 12/12 manifest checks passing. **5-bottle manual test** at `/tmp/manual-test-jobs.json` is what the user is about to run. The pre-render check passes. The actual OpenAI call has not been made yet.
- **Per-SKU long-tail overrides:** The 12 closure-class files cover the bulk. Per-SKU files in `families/<family>/<slug>.json` would only be needed for SKUs with genuinely unique closure geometry not captured by the closure-class patterns.

## 5. Known issues / quirks

- **Family name leak in §1:** The composer renders "Product is a single Clear Transparent Glass **Spray Bottle** bottle" (doubled noun) when `family` is "Spray Bottle" or "Roll-On Cap" or "Cap/Closure". Cosmetic, not blocking. Fix is in `renderSection1` where it interpolates `sku.family` — could be "Product is a single Clear Transparent Glass spray bottle" (lowercase family) for ambiguous family names.
- **`Applicator: follow product reference` header line** appears in the prompt when `applicatorTypes` is empty in the jobs JSON. The composer falls back to `applicatorType: none` and the §1 section skips the applicator component. Cosmetic.
- **Detected Apothecary stopper bug:** The `classifyClosureClass()` function originally didn't match "ground" + "stopper" — that was a bug. The `detect_applicators` function in the smoke test job builder also didn't match "ground" + "stopper" until I added the rule. **This is now fixed** in `classifyClosureClass()` but the `detect_applicators` fix in the smoke test job builder is only in `/tmp/sku-lock-smoke-test-jobs.json`'s inline code, not in any committed script.
- **Pre-existing script bug in `generate_openai_grid_images.mjs`:** `localRef.path` crash when `preferPsdReference` is true and `localRef` is null. I patched this with a `localRef ? ... : ...` guard at the `rejectedLocalReference` assignment. Not the same as the SKU-lock work — was blocking the dense dry-run from completing.
- **Capacity type confusion:** Some Convex records have `capacityMl` as float (e.g. `100.0`) instead of int. The reconciliation script handles this with `int()` conversion. Be careful if you write new code that joins on capacity.

## 6. Open questions the next agent must answer

1. **Where does the "Bottle Family Workbench" UI live?** The Studio source is in `src/app/studio/[[...tool]]/StudioPageClient.tsx` but that file is only 13 lines — it just embeds Sanity Studio. The Bottle Family Workbench / Batch Preflight / One-off selection UIs are not in the files I read. The user described them as showing different counts (18, 23, 7, 165, 30) for the 5ml clear cylinder roll-on bottle, but I never saw the UI source. If those UIs are in a different codebase, the canonical source-of-truth work is incomplete.
2. **What's the relationship between v2 CSV and the live website?** The v2 CSV is git-tracked, but the live Best Bottles site reads from Grace ERP / Shopify / Convex. The v2 CSV is the canonical source for the image pipeline, but it's not necessarily the canonical source for the e-commerce site. Confirm with the user before pushing CSV changes to production data.
3. **What's the Sanity project ID and dataset for the image-uploads?** `sanity.config.ts` reads from `process.env.SANITY_STUDIO_PROJECT_ID` and `process.env.NEXT_PUBLIC_SANITY_DATASET`. The reconciliation script needs these to query Sanity. The handoff user should confirm.
4. **Is `convexSyncedAt` column populated anywhere yet?** No — it's set up in the schema and in the rebuild mutation, but no CSV has been through the rebuild yet. The first rebuild run will populate it.

## 7. Files added/modified in this session (in order of importance)

**New files (created):**
- `pipeline/image-gen/sku-lock/` (entire directory, ~20 files)
- `pipeline/image-gen/grid-images/scripts/prompt_composer.mjs`
- `pipeline/image-gen/grid-images/scripts/qa_gate.mjs`
- `pipeline/image-gen/grid-images/scripts/pre_render_check.sh`
- `pipeline/image-gen/grid-images/scripts/test_composer.mjs`
- `pipeline/image-gen/grid-images/scripts/EMPIRE_SMOKE_TEST.md`
- `scripts/backfill_color.mjs`
- `scripts/reconcile_catalog.mjs`
- `convex/productGroupsRebuild.ts`
- `data/grace_products_final.v2.csv` (output of backfill, git-trackable)
- `reports/color-backfill-baseline.json`
- `reports/reconciliation-2026-06-24.md`
- `PIPELINE_QUICK_REFERENCE.md`
- `docs/NUMBER_AUDIT.md`
- `docs/CSV_REBUILD_RUNBOOK.md`
- `docs/PHOTOGRAPHER_HANDOFF.md`
- `docs/STUDIO_BRIEF_ONE_PAGER.md`

**Modified files:**
- `pipeline/image-gen/grid-images/scripts/generate_openai_grid_images.mjs` — added composer import, `--sku-lock` / `--no-sku-lock` CLI flags, dispatch logic, pre-existing `localRef.path` crash patch
- `convex/schema.ts` — added `lastSyncedAt` and `csvRowCount` fields to `productGroups`

**Test artifacts (NOT git-tracked, in `/tmp/`):**
- `/tmp/sku-lock-smoke-test-jobs.json` — 12-job dense slice
- `/tmp/sku-lock-smoke/_generation-manifest.json` — the dry-run manifest
- `/tmp/sku-lock-smoke-prompts.txt` — all 12 composed prompts (~70KB)
- `/tmp/manual-test-jobs.json` — 2-bottle user test (Empire tassel + Spray Bottle)
- `/tmp/test-spray.json` — 1-bottle minimal test

## 8. How to test the pipeline RIGHT NOW

```bash
cd /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026

# 1. Preview (no API spend)
bash pipeline/image-gen/grid-images/scripts/pre_render_check.sh \
  --jobs /tmp/manual-test-jobs.json \
  --output /tmp/manual-test

# 2. Render (costs API credits — requires OPENAI_API_KEY in .env.local)
node pipeline/image-gen/grid-images/scripts/generate_openai_grid_images.mjs \
  --jobs /tmp/manual-test-jobs.json \
  --output-root /tmp/manual-test

# 3. View results
open /tmp/manual-test/_contact-sheet.png

# 4. Post-render QA gate
node pipeline/image-gen/grid-images/scripts/qa_gate.mjs \
  --manifest /tmp/manual-test/_generation-manifest.json \
  --raw-dir /tmp/manual-test/raw
```

## 9. What the user is about to do

The user is running the manual-test command sequence above with 5 bottles:
1. Spray Bottle 30ml clear (fine-mist sprayer)
2. Empire 100ml clear (vintage bulb with tassel)
3. Cylinder 100ml clear (lotion pump + overcap detached)
4. Cylinder 9ml frosted (fine-mist sprayer)
5. Apothecary 15ml cobalt blue (ground-glass stopper)

They have the JSON for all 5 ready and the pre-render check is passing. **They have not yet made the OpenAI call that costs money.** When they do, expect 5 PNGs at `/tmp/test-XX-render/raw/` plus a contact sheet. The QA gate will catch structural failures (dimensions, background color, product coverage, prompt structure) but the editorial quality judgment is still a human eye on the contact sheet.

## 10. The most important thing to know

The composer is **brittle to schema drift**. The closure-class file `families/_closures/<class>.json` is the single source of truth for what a closure renders as. If you add a new closure class, you must add a new file there AND a new case in `classifyClosureClass()` in `prompt_composer.mjs` AND a new case in §1 of `renderSection1()` if the closure renders differently from the standard "applicator on top of collar" pattern. The Apothecary stopper is the one example of a non-standard closure that needed custom §1 rendering.

Test discipline: **never trust that a prompt is correct without seeing the rendered image**. The QA gate catches structural problems (wrong dimensions, wrong background, component count off), but it does NOT catch aesthetic problems (model interpreted "vintage bulb" as a pump, omitted the tassel, rendered a sprayer as a roller ball). Always render at least one example per closure class and visually inspect it before scaling up.

— End of handoff.