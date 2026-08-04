# Executive Hub V1 implementation notes

## What shipped

The authenticated `/executive` route now renders the approved Executive Signal Board. It is structured for a B2B packaging-supply CEO rather than a direct-to-consumer ecommerce operator.

The overview answers three questions first:

1. Are we growing profitably?
2. Is the pipeline healthy?
3. What needs me today?

Supporting sections cover headline financial and operating signals, commercial funnel, inventory and supply health, the CEO decision queue, product-family performance, customer account health, and operations or production.

## Data posture

V1 uses a validated illustrative fixture. Every metric carries a source identifier, source status, timestamp, coverage statement, tone, and drill-down destination. The interface explicitly says the values are not live business data.

Only the `Today` range contains fixture values. Selecting 7D, MTD, QTD, or YTD replaces every value with a not-connected state rather than inferring totals or trends.

## Interaction model

- Desktop uses a compact Executive Hub command rail.
- Mobile uses an accessible shadcn Sheet for navigation.
- Metric and decision selections open a shared detail Sheet.
- Metric detail includes comparison, status, source, timestamp, coverage, and lane link.
- Decision detail includes impact, owner, deadline, recommendation, evidence, and source.
- Future lanes are visibly unavailable until their source is connected; they are not dead links.

## Source connections still required

The fixture should be replaced one source at a time after the metric contract and reconciliation rules for each source are approved. Highest priority:

1. Finance or accounting: net revenue, gross profit, gross margin, EBITDA, cash, and A/R.
2. CRM or sales system: leads, quotes, samples, opportunities, win rate, and backlog.
3. ERP, warehouse, or inventory: value, coverage, stockouts, purchase orders, fill rate, and supplier delivery.
4. Production or decoration: capacity, open jobs, scrap, and rework.
5. Customer-account system: concentration, reorder behavior, inactivity, and support risk.

Shopify, Convex, Sanity, Mixpanel, OpenAI, and Vercel remain supporting digital sources. They must not substitute for the canonical finance, CRM, ERP, warehouse, or production owner of a business fact.

## Verification

The V1 surface was checked at 1440 × 900 and 390 × 844. Browser checks covered page load, framework overlays, mobile navigation, metric detail, and honest unavailable-range behavior. Contract, component, access-control, route, type, lint, and production-build verification are part of the final handoff.
