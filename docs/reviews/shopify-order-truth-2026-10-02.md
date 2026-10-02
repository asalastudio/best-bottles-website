# Shopify order and shipment truth — 2026-10-02

Base: `asalastudio/best-bottles-website` main `008097682467abdd665354f7c0d870c09b6aa98e`.
Scope: order/fulfillment normalization, persisted snapshot ordering, existing portal read projections and corresponding order labels. No Grace tool, private-access permission, account provisioning, address mapping, or certificate workflow changes.

## Confirmed root causes

| Source path on base | Defect | Result in this change |
| --- | --- | --- |
| `src/lib/shopify-webhooks.ts` / `orderStatusFromShopify` | Every existing fulfillment delivered implied the whole order delivered, even when `fulfillment_status` was partial. Fulfilled/partial alone implied transit. | Whole-order delivery requires fulfilled status, a complete snapshot and delivered evidence for every active fulfillment. Partial, label-created, delivery-problem and unknown states are distinct. |
| Same file / `shipmentFromFulfillment` | Only first tracking number/URL survived; fulfillment creation time was called shipping time. | Preserve every tracking tuple, including number-only and URL-only entries, and preserve fulfillment creation as a separate fact. |
| `src/lib/shopify-order-fetch.ts` | Independent filtering of number/URL arrays could associate different packages; raw fulfillment status and resource update timestamps were not fetched. Unknown order provider states became null. | Keep GraphQL tracking tuples intact; request order/fulfillment update times and fulfillment status; preserve unknown provider values. |
| `convex/portal.ts` / `upsertOrderFromShopify` | ID upsert prevented duplicate rows but allowed stale payloads to overwrite newer data and refresh local `updatedAt`. | Compare order and fulfillment versions separately in the transaction. Equal/older entity versions do not replace that entity. A newer fulfillment can advance independently. A wholly duplicate/stale delivery makes no write and does not refresh receipt time. |
| `scripts/backfill_portal_orders.mjs` | A second normalizer duplicated unsafe status and first-package behavior. | Use the same fetch adapter and mutation-argument builder as the webhook path. This script was not run against Shopify or Convex. |
| Portal detail page | Missing status read “Shipped”; fulfillment success read “Delivered”; missing tracking implied nothing shipped; cancelled orders implied nothing ever shipped. | Render evidence and unknown states, all package links, source/receipt timestamps and fulfillment-recorded time without those claims. |

## Data contract for later Grace integration

- `status` is the conservative aggregate; `shopifyFulfillmentStatus` retains the normalized provider order state. Shipment `fulfillmentStatus` and `shipmentStatus` remain separate raw provider strings.
- List and detail projections expose order `sourceUpdatedAt`, `syncedAt`, `shipmentSnapshotComplete` and each shipment's independent `sourceUpdatedAt`. `syncedAt` is local receipt time for the last accepted change, not proof of current carrier data. The existing `updatedAt` detail field remains for compatibility.
- `shipments[].packages[]` preserves number/URL/carrier tuples. A tuple may contain only a number or only a URL. Fulfillment line quantities belong to the fulfillment, not to each package; no per-package item allocation is invented.
- `fulfillmentCreatedAt` means the fulfillment was recorded. It does not establish carrier pickup. Legacy `shippedAt` remains schema-compatible but is not newly written or rendered as proof of shipping.
- Old Shopify rows without `sourceUpdatedAt` project as unknown. QuickBooks history remains protected from Shopify upserts and is not reclassified by the legacy Shopify guard.
- Missing or invalid source timestamps fail closed. Signed webhook requests return 500 so Shopify can retry; direct legacy mutation callers without a source version are skipped. New timestamps are never inferred from receipt time.
- Fulfillment events fetch their parent order. If the fetched fulfillment is missing or older than the triggering event, the request returns 500 without writing rather than acknowledging an update that was not observed.
- Missing shipment arrays do not delete saved tracking. A newer order snapshot without shipment coverage cannot reuse an older delivered box as evidence that a newly fulfilled remainder arrived. A complete snapshot at the same parent version can restore the completeness flag.
- Equal-version conflicting data is conservatively ignored. This is resource-version idempotency, not an event-log/dedup table. No new persistent access or permission was added.

## Acceptance coverage (fixtures only)

- Partial order with all existing boxes delivered remains partially fulfilled; fulfilled labels do not imply movement; unknown/missing provider states remain unknown; cancellation wins.
- Full delivered, mixed delivery, failures, attempted delivery, pickup/confirmation ambiguity, cancelled fulfillments and new provider strings.
- Multiple tracking tuples, unequal/empty plural fields, singular fallback, per-package carriers and GraphQL tuple preservation.
- ID upsert, account-owner lookup, guest/retail skips, write-token rejection and QuickBooks protection.
- Duplicates, equal-version conflicts and old replays leave source fields, prices, shipment evidence and local freshness unchanged.
- Newer fulfillment with unchanged/older parent version; newer parent with older fulfillment evidence; parent cancellation survives carrier updates; omitted shipments preserve tracking.
- Legacy row uncertainty; full list/detail package projection; snapshot completeness recovery after omitted remainder evidence.
- Signed webhook ingress, rejected HMAC before any I/O, missing timestamp rejection and lagging-read retry.
- Server-rendered detail shows every package, unknown states and fulfillment-recorded time; it does not claim fulfillment success means delivery.
- GraphQL snapshot overflow checks and shared normalizer import/syntax check for the backfill entry point.

## Verification

- Focused tests: 58 passed across order sync, tracking, snapshot adapter, signed webhook route and rendered detail.
- Final full suite (`vitest run --maxWorkers=4`): **312 passed files / 2 skipped; 2,873 passed tests / 7 skipped**, exit 0. An earlier unrestricted run had one unrelated preview-build fixture timeout under concurrent machine load; its isolated retest and the final complete run passed.
- TypeScript: passed in `/tmp/bb-order-truth-verify` against copied source and this repository's installed dependencies, with `--noEmit --typeRoots ./node_modules/@types`. Typechecking in the Documents worktree stalled reading an unrelated ancestor `Documents/node_modules/@types/prop-types/package.json`; those stalled processes were stopped. An empty log was not counted as a pass.
- Full ESLint: zero errors, 87 existing warnings. Changed TypeScript files lint clean.
- Shopify GraphQL operation validated successfully with the connected schema validator and locally against bundled schema `2025-10`. The repository still requests API version `2025-01`; updating that shared API pin is outside this change. No live order query was executed to establish the effective runtime version.
- Production build (`npm run build -- --webpack`): **passed**, exit 0, including TypeScript, 61 static pages and sitemap generation, in the isolated verification directory. CI placeholder config used; no customer credentials copied into this worktree. The original attempt compiled but hit a redundant-checkout disk/cache limit and the ancestor type-resolution stall. Redundant content-addressed Git copies were removed, source stayed intact, and the successful build was rerun in isolation. Placeholder-generated sitemap changes were restored before handoff.

## Runtime evidence and remaining limits

This work proves defects in current main and fixes exercised by local fixtures. It does **not** prove that production is fully synchronized. No production Convex schema/function push, live order/customer write, production backfill, merge, or deployment was performed.

1. The GraphQL adapter still uses 100 order lines, 100 fulfillment lines and 50 fulfillments. It now rejects `hasNextPage` and the 50-fulfillment boundary instead of silently treating truncated data as complete. Full nested pagination remains follow-up work. The boundary check is deliberately conservative even for exactly 50 fulfillments.
2. No scheduled order reconciliation was found in `convex/crons.ts`. Webhook registration, delivery health, missing historical orders and legacy rows need separate read-only production assessment and an approved reconciliation/backfill plan. Timestamp guards cannot recover an event never received.
3. `listOrdersByOrg` and other existing portal reads still collect an organization's orders without pagination. Very large histories remain a scalability gap; no cross-account access pattern was changed.
4. Source freshness is available, but no freshness SLA or “currently live” claim is established. Grace should state the saved source update time, preserve uncertainty, and not invent carrier events, delivery dates or per-package item allocations.
5. Schema changes are additive optional metadata and widened order status literals. They have not been applied to a runtime deployment. Backend/schema and frontend rollout must be coordinated later; older order writers without source versions will be rejected/skipped after rollout.
6. Account provisioning and address mapping are owned by task `01a0fa06-ded6-741b-beb2-d50b3ac3d057`; certificate/security workflow by `01a0fa0a-37dc-77ee-aec1-05a84d58a068`. Overlapping order-only sections and the `portalOrders` schema block were reported before editing.

Provider references: [webhook ordering and reconciliation](https://shopify.dev/docs/apps/build/webhooks#ordering-event-data), [fulfillment shipment/status/tracking semantics](https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillment), [GraphQL fulfillment fields](https://shopify.dev/docs/api/admin-graphql/latest/objects/Fulfillment), [display-status vocabulary](https://shopify.dev/docs/api/admin-graphql/latest/enums/FulfillmentDisplayStatus).
