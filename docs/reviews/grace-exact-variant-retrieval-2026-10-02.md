# Grace exact variant retrieval and Refine alignment

Related issue: [ASA-207](https://linear.app/asala-dev/issue/ASA-207/grace-fix-add-to-cart-match-filters-and-size-ranges). Existing issue inspected; no duplicate created. This PR addresses the verified retrieval/filter failures, not every acceptance item in that wider issue.

## Reported live reproduction

At https://best-bottles-website.vercel.app, ask Grace for a **clear 15 ml Elegant bottle, metal roller, shiny silver cap**, its neck finish, price for **60 units**, and product link. The parent launch audit repeated the request twice: Grace returned plastic `GBElg15RollSlSh` and asserted metal was unavailable. Exact-SKU lookup succeeded for `GBElg15MtlRollSlSh`, with **13-415** neck and **$0.84** tier. The checked-in catalogue source also contains that metal SKU and those fields. This is evidence of retrieval failure, not evidence that catalogue data needs editing. Live observations were supplied by the parent task; this worker did not repeat cart/checkout interactions.

Additional parent audit cases: Specialty selected but an Elegant 13-415 card escaped the filter; Grace refused the supported 6–15 ml range; Cobalt → Amber follow-up lost colour/neck constraints in catalogue navigation; impossible Elegant 999 ml Cobalt criteria displayed a prior 15 ml Clear card.

## Root causes

1. `convex/grace.ts` took the first eight variants from each product group before filtering. The metal/cap combination can appear later in that indexed group.
2. Its broad roller fallback accepts both materials. The explicit applicator filter applied only to the text/description `results`; the subsequent merge prepended unfiltered `structuredResults`. Coverage injections could likewise bypass that filter.
3. `toolGatewayServer` restored all visible rows when active Refine facets excluded every row, making zero-match searches fail open.
4. `refineFacetMatch` treated Specialty as permission for every neck, including standard GPI. It also expanded ranges into preset discrete sizes rather than using the catalogue's shared range predicate.
5. `showProducts` omitted active Refine state, and its generated catalogue URL lost colour and neck constraints. Raw row requests and storefront filter verification shared an ambiguous `returnRaw + refineState` branch.
6. The Refine schema/client handler omitted roller material, claimed capacities were exact-only, and described only GPI necks. Three query capacity parsers and result narration truncated decimals with integer-only regex/parseInt.

## Changes

- Apply one hard variant predicate before the indexed group's representative limit and after merging candidate sources; filter special coverage candidates too. Explicit metal/plastic requirements intersect explicit applicator filters. Named family, size, glass colour and cap finish constrain material-specific requests. Fully specified family/colour/capacity requests also cannot silently substitute a different variant.
- Preserve broad roller browsing for requests that do not specify a material. Exact-SKU database lookup is unchanged; its gateway payload now supplies the existing canonical `verifiedPdpHref` helper for link requests. Quantity quotes still use the full exact-SKU price ladder.
- Return empty/no-match without excluded products and without treating bounded search as proof of unavailability. Empty `showProducts` does not navigate or add cards.
- Reuse `neckSelectionMatches` and `capacitySelectionMatches`; expose shared range/neck/material vocabulary, support roller material in the client handler, and normalize known range labels.
- Carry Refine into raw row searches and catalogue destinations; parse explicit query facets so Cobalt → Amber can change colour while retaining Cylinder/9 ml/roll-on/17-415. Explicit `verifyRefinements` distinguishes storefront group verification from raw product arrays.
- Parse decimal millilitre sizes with one numeric helper.

No catalogue, price, inventory, schema, authentication, cart, or production data changes. No new dependency: indexed stream filtering uses the existing `convex-helpers` package.

## Verification

- Real `convex-test` query fixture deliberately inserts twelve plastic variants and nine wrong-cap metal variants before the correct silver metal SKU. Running the **original** `convex/grace.ts` against the new retrieval tests: **8 failed / 3 passed**. Fixed query: **11 passed**.
- Targeted suite: **71 tests / 7 files pass**. Covers natural material requests with and without explicit filters; merged plastic rejection; unavailable cap/material combinations; impossible 999 ml criteria; broad material browse; exact website/Grace SKU lookup with neck, tier and slug; decimal 3.3/1.5 ml; Specialty vs 13-415/Ground/missing; range boundaries; clearing old filters; follow-up colour/neck retention; raw array vs group envelope; no excluded cards after zero results; exact-SKU URL.
- Adjacent suite: **101 tests / 11 files pass**, including Grace search utilities, bottle component compatibility, hardening, navigation, plate swap, Realtime adapter/configuration and catalogue vocabulary.
- `npm run test:knowledge-gateway`: **66 tests / 14 files pass** (some overlap the above suites).
- Final `tsc --noEmit --pretty false`: **exit 0**. Focused check of all src/Convex and new tests also passed. Initial full check completed against an intermediate edit; its four errors were fixed before final verification.
- Changed-file ESLint: no errors; existing unused-import/directive warnings remain in grace.ts and pre-existing Provider warnings are not part of this fix. `git diff --check` passes.

Tests use local fixtures/mocked gateways, not live inventory. No production Convex push or live model/voice end-to-end verification was performed in this worktree. Model tool choice, wording, and live retrieval latency still require the parent's release smoke test. In particular the multi-turn regression covers deterministic state and destination construction, not a recorded Realtime conversation. This does not claim all ASA-207 conversational cases are complete.

## Coordinated release and rollback

Parent owns serialized deployment alongside pricing and transcript-auth fixes. This branch has no overlapping pricing/auth files. After review and a green preview, deploy the Convex query code, then deploy the matching frontend/gateway commit. Backend query arguments are unchanged and no schema/data migration is needed. The frontend and gateway should be promoted together because raw row requests now use an explicit refinement-verification flag; restart active Grace sessions for new tool schemas.

Read-only release smoke: repeat metal/silver request and exact SKU lookup; verify 13-415 and the 60-unit tier from getProductBySku; select Specialty and ensure no 13-415 card; clear filters and apply 6-15ml metal roll-on; repeat Cobalt → Amber while retaining 9 ml/17-415; request an impossible exact variant and confirm no substitute cards. Do not place an order.

Rollback: revert the single fix commit from this PR (recorded in the PR/hand-off), redeploy the prior Convex query and matching frontend. No database rollback is required. Base before this fix: `5abf5205`.
