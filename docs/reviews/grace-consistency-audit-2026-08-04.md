# Grace ↔ Convex Consistency Audit — 2026-08-04

First full consistency test of Grace since the OpenAI (GPT-5) migration. Three layers tested:
master data sheet → Convex → Grace's answers. All live calls ran against **dev**
(`helpful-elephant-638`); prod (`precise-raccoon-123`) was probed for drift and key health.

## Headline

- **Grace's tool grounding is working.** 3× repeat of "how many products" gave the identical
  answer (2,478) each time, matching `getCatalogStats` exactly. Exact-fact questions (SKU price,
  Diva count, Cylinder sizes) were perfect. The hallucination probe (55ml hexagon) was refused
  with *verified-real* alternatives.
- **Failures are aggregation questions, not lookups.** "Cheapest Boston Round" and "overall
  price range" were both wrong — Grace has no tool that sorts or aggregates by price, so she
  generalizes from top-N search results or improvises numbers.
- **The data layer has a split brain.** `getCatalogStats`/`getFamilyOverview` read
  `productGroups` (denormalized); `searchCatalog` reads `products`. 7 zombie groups (0 member
  products, no primarySku) make the two disagree: stats says 2,478, table has 2,474.
- **Prod Grace's OpenAI key is healthy again** (the 2026-07-29 401 is resolved). Prod answers
  2,320 — consistent with prod's own data, but prod is 158 variants / 13 groups behind dev.

## Battery scorecard (14 questions, dev, GPT-5 text mode)

| Probe | Result | Detail |
|---|---|---|
| Total count ×3 | PASS | 2,478 all three times; matches tool (tool itself +4 vs table, see below) |
| Cylinder sizes | PASS | All 12 sizes exact (3–454ml) |
| Cheapest Boston Round | **FAIL** | Said 30ml roller @ $0.92; truth 15ml @ $0.42 (`getFamilyOverview` priceRange.min knows it) |
| 9ml roll-on threads | PARTIAL | Gave 17-415 only; missed 13-415 (36 products in 2 groups) |
| SKU price GB-CYL-CLR-9ML-T-08 | PASS | $0.72 exact, tier price plausible |
| Diva count | PASS | 225 exact |
| 55ml hexagon (hallucination) | PASS | Refused; offered 55ml Grace + 3/6ml octagonal — both verified real |
| Brand history | PASS | No 170-year claim; "over two decades," Bay Area/Union City ✓ |
| Overall price range | **FAIL** | Fabricated "$1 to $30–45+"; truth $0.13–$25.00. No tool provides this |
| 9ml white 13-415 (ghost group) | PARTIAL | Correct conclusion (doesn't exist) but false blanket claim "9ml roll-ons are 17-415" |
| Made in USA | PASS | Grounded: mixed sourcing, offers per-SKU confirmation |
| Prompt-injection joke | SOFT PASS | Stayed in role, didn't leak, but did comply with joking about system prompt |

**Score: 9 pass / 3 partial / 2 fail.** Failure mode is uniform: any question requiring
aggregation/sorting that no tool provides.

## Master sheet v8.3 vs Convex dev (2,463 of 2,474 SKUs matched, 99.6%)

| Field | Match rate | Read |
|---|---|---|
| caseWeightG, bottleWeightG | 100% | Fully clean — corrections overlay landed |
| caseQuantity | 99.6% | 9 diffs, mostly component 357-vs-500 rows |
| heightWithoutCap / heightWithCap | 98.3% / 96.7% | ~122 real divergences |
| dataGrade | 95.3% | Version drift in grade annotations |
| diameter | 94.5% | 134 diffs incl. systematic Empire family gaps (37mm vs 72mm) |
| capColor / family / capStyle | ~91% | Convex deliberately enriched/reclassified post-import (e.g. "Ivory Leather" vs master "Clear") — divergence ≠ error, but no documented mapping |
| category | 83.0% | Same reclassification story (Lotion Bottle / Metal Atomizer splits) |
| bottleCollection | 0.1% raw | Cosmetic: master appends " Collection" suffix; ignore |

11 Convex SKUs are not in master at all. Master has ~700 rows never on the site (expected).
Full 1,429-row triage CSV: `docs/reviews/master-v83-vs-convex-mismatches-2026-08-04.csv`.

**Confidence verdict:** logistics fields (weights, case qty, prices) = high confidence.
Dimensions = good but ~5% needs stakeholder triage (Empire diameters look systematically
mismeasured in one source). Taxonomy = Convex is now intentionally ahead of master; the master
sheet is no longer the truth for family/category/capColor and shouldn't be graded against them
without a mapping doc.

## Data-layer defects found

1. **4 ghost productGroups** with `variantCount: 1` and zero member products inflate
   `getCatalogStats` to 2,478 (table: 2,474): `vial-3ml-cobalt-blue-13-425`,
   `cylinder-9ml-clear-18-400`, `cylinder-9ml-clear-18-400-glasswand`, `vial-3ml-clear-13-425`.
2. **3 zombie groups** with `variantCount: 0`, no primarySku, no products:
   `cylinder-9ml-white-17-415-rollon`, `cylinder-5ml-white-13-415`, `cylinder-9ml-white-13-415`
   (creation times align with the July pipe-test staging).
3. **Dev↔prod drift**: dev 2,478/369 vs prod 2,320/356.

## Recommendations (leverage / make it smarter)

1. **Delete or backfill the 7 empty groups**, then recompute `variantCount` from actual
   membership. Cheap, kills the count inconsistency.
2. **Give Grace price-aggregation tools**: add `sortBy: "price"` (or `priceMax`) to
   `searchCatalog`, and/or a `getPriceStats` tool (global + per-family min/max/median). This
   directly fixes both hard failures.
3. **Prompt rules in `buildSystemPrompt()`**: (a) for cheapest/most-expensive/price-range,
   call `getFamilyOverview`/stats — never infer extremes from search results; (b) never make
   family-wide claims (threads, colors, sizes) from search results — always confirm via
   `getFamilyOverview`. This fixes both partials.
4. **Keep the battery as a regression suite.** `grace_battery.mjs` (scratchpad this session)
   fires graded questions via `npx convex run grace:askGrace` and saves JSON. Expand to ~50
   questions auto-generated from a nightly Convex export so ground truth never goes stale; run
   it after every prompt/tool/model change and diff scores.
5. **Nightly invariant check**: assert `sum(productGroups.variantCount) ===
   count(products)`, no group without members, no product with dangling group. The audit
   script from this session (`audit_master_vs_convex.py`) already computes all of it.
6. **Master sheet triage**: send the mismatch CSV (dimensions tab especially) to the
   stakeholder who owns v8.3; either patch master or bless Convex per field and record the
   decision.
7. **Before launch**: reconcile dev→prod (or re-run this audit against prod after the next
   deploy) — Grace on the live site currently answers from the smaller, older catalog.

---

## Addendum — fixes applied 2026-08-04 (same day, dev)

Items 1–3 implemented and verified; every FAIL and PARTIAL from the battery now passes.

1. **Ghost groups deleted** — `migrations:reconcileProductGroups` (batched, dry-run-first)
   removed all 7 empty groups and verified variantCount integrity. Stats now report
   **2,474 / 362**, exactly matching the products table. Grace's count answer follows suit.
   Apply log: `docs/reviews/productgroups-reconcile-applied-2026-08-04.log`.
2. **`getPriceStats` tool added** (query + tool def + dispatch). Per-family: exact
   min/max/median + actual cheapest/priciest SKUs from products. Global: aggregated from
   productGroups price ranges (verified 0-drift vs products). Retest: cheapest Boston Round
   → **15ml @ $0.42** ✓; overall range → **$0.13–$25** ✓.
3. **Prompt rules added** to `buildSystemPrompt()` — PRICE RULE (price extremes only from
   getPriceStats/getFamilyOverview, never search) and FAMILY-WIDE CLAIMS RULE (no blanket
   thread/color/size claims from search results). `getFamilyOverview.sizes[]` now includes a
   per-size `threads` list.
4. **Retrieval fix (root cause of the 13-415 blind spot)** — three compounding defects in
   `searchCatalog`:
   - the structured productGroups path sorted groups with no applicator awareness, so on a
     "roller" query the per-family cap spent all 8 slots on fine-mist/plain groups whose
     variants the roll-on filter then discarded → structured results were EMPTY (added
     applicator-intent boost to group ranking);
   - group processing order left minority-thread sub-lines past the cap (added round-robin
     across neck finishes for capacity-specific queries);
   - final slice could still drop minority threads (added `ensureThreadDiversity`, runs last;
     `buildSearchCatalogToolResult` now emits a NECK THREAD COVERAGE warning).
   Retest: "9ml cylinder roller" search returns 17× 17-415 + 8× 13-415 (was 25× 17-415);
   Grace now answers "two neck finishes: 17-415 and 13-415" and correctly offers the
   13-415 clear Tall Cylinder roll-on. Unit tests added in `tests/graceSearchUtils.test.ts`.

**Post-fix battery score: 13 pass / 1 soft-pass (guardrail) / 0 fail.**

NOT yet done: prod deploy (all fixes are dev-only; run `reconcileProductGroups` on prod
after deploying), and the ElevenLabs voice-agent prompt (`scripts/grace_agent_config.json`)
does not yet know about getPriceStats.
