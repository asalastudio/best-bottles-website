# Best Bottles Executive Hub V1 Design

Status: Approved design direction
Date: 2026-08-02
Primary route: `/executive`
Visitor mode: Operate
Audience: Best Bottles CEO and trusted leadership

## 1. Decision

Executive Hub V1 will use the approved B2B Executive Signal Board direction. It treats Best Bottles as a packaging supplier rather than a direct-to-consumer fragrance brand. Profitability, pipeline and backlog, inventory and supply, customer accounts, fulfillment, and leadership decisions lead. Ecommerce and Grace remain important supporting lanes rather than dominating the CEO overview.

The dashboard must answer three questions in under five minutes:

1. Are we growing profitably?
2. Is future revenue and supply healthy?
3. What needs the CEO's attention today?

The selected visual reference is `docs/executive-hub/executive-hub-signal-board-packaging-v2.jpg`. Every value in that reference is illustrative.

## 2. Experience thesis

The Executive Hub is a packaging-supply command instrument. It refuses the generic ecommerce dashboard pattern of leading with sessions, conversion, and cart abandonment. It also refuses a wall of equally weighted charts.

The first viewport presents three dominant question panels, a restrained line of headline KPIs, and an exception-first decision queue. Deeper operational detail is available by lane and through metric drill-downs. The CEO should always know what changed, why it matters, what action is recommended, who owns it, and when it is due.

## 3. Information architecture

```text
/executive
|-- Overview
|   |-- Performance
|   |-- Future revenue
|   |-- CEO attention
|   `-- Source freshness
|-- Sales
|   |-- Pipeline and forecast
|   |-- Quotes and samples
|   |-- Salesperson, territory, customer, industry
|   `-- Wins and losses
|-- Products
|   |-- Bottle family
|   |-- Closure and applicator
|   |-- Capacity, color, finish, material
|   `-- Decoration method
|-- Inventory
|   |-- Value, turns, and days on hand
|   |-- Stockout, overstock, and backorder
|   |-- Purchase orders and containers
|   `-- Replenishment exceptions
|-- Operations
|   |-- Waiting, picked, packed, and shipped
|   |-- On-time shipment and fulfillment time
|   `-- Accuracy, damage, and returns
|-- Manufacturing and Decoration
|   |-- Job queues by method
|   |-- Production time and utilization
|   `-- Scrap and rework
|-- Customers
|   |-- Top accounts and concentration
|   |-- Repeat ordering and reorder intervals
|   |-- At-risk accounts
|   `-- Support health
|-- Suppliers
|   |-- Vendor scorecards
|   |-- Lead times and on-time delivery
|   |-- Purchase-cost changes
|   `-- Outstanding purchase orders
|-- Financial
|   |-- Revenue, profit, margin, and EBITDA
|   |-- Cash flow and operating expenses
|   |-- Accounts receivable and payable
|   `-- Inventory value
|-- Ecommerce
|   |-- Website revenue and orders
|   |-- Quote and sample requests
|   |-- Search and conversion
|   `-- Channel performance
|-- Grace Operations
|   |-- Assisted outcomes
|   |-- Quality and filter preservation
|   |-- Voice, latency, and reliability
|   |-- Tool behavior and cost
|   `-- Controlled learning
`-- Platform
    |-- Deployments and errors
    |-- Integration health
    `-- Source freshness
```

## 4. CEO overview contract

### 4.1 The three primary panels

**Performance — Are we growing profitably?**

- Net revenue MTD and YTD
- Gross profit
- Gross margin percentage
- EBITDA
- Cash on hand
- Completed orders and average order value
- Performance against approved target and comparison period

**Future revenue — Is the pipeline healthy?**

- Qualified pipeline value
- Open quotes and quoted value
- Quote-to-order conversion
- Samples sent and sample-to-order conversion
- Confirmed backlog value
- Forecast against target
- Large opportunities above the approved threshold

**Attention — What needs me today?**

- Critical inventory or supplier exposure
- Material margin or cost change
- High-value customer or commercial approval
- Cash, receivables, fulfillment, production, or platform risk
- Estimated impact, evidence, recommendation, owner, and due date

### 4.2 Headline KPI strip

The default strip contains no more than six supporting KPIs:

1. Cash on hand
2. Orders received
3. Inventory value and turns
4. Stockout or backorder exposure
5. On-time shipment percentage
6. Overdue accounts receivable

Cards display value, comparison, target state, source, freshness, and drill-down. Red is reserved for material exceptions that require action.

### 4.3 Supporting panels

- Commercial funnel: lead → qualified → quote → sample → purchase order → production → delivered
- Inventory and supply health: policy coverage, supplier delivery, fill rate, slow-moving stock, decoration capacity, open purchase orders, containers in transit
- CEO decision queue: severity, impact, owner, due date, recommendation, evidence
- Top product families: revenue and gross margin with drill-down by closure, capacity, color, finish, material, and decoration
- Customer account health: concentration, repeat ordering, inactive accounts, support issues, at-risk revenue
- Operations and production: waiting orders, fulfillment time, accuracy, decoration jobs, scrap and rework

## 5. Visual system

The surface extends the established Best Bottles world rather than creating a separate brand.

- Dark obsidian operating field with warm mineral-white text
- Muted gold for selection, provenance, and premium brand detail
- Green, amber, and red used only as semantic operating signals
- Workhorse sans-serif for controls, labels, tables, and dense data
- Restrained serif used only for the product name and primary executive statement
- Compact, consistent density; square or lightly rounded shadcn surfaces
- Hairline borders and clear alignment replace decorative card effects
- No gradients, glassmorphism, oversized decorative charts, or multiple competing accents

The real product should use shadcn primitives for accessible behavior while tailoring their visual language to the approved signal board. Expected primitives include Card, Badge, Tabs, Table, Progress, Tooltip, Sheet, Skeleton, Alert, Dialog, and Dropdown Menu.

## 6. Interaction and drill-down

- Clicking a primary panel opens a focused detail view preserving the selected date range and comparison.
- Clicking a KPI opens its canonical report, not an unrelated generic page.
- Every detail view begins with the metric definition, source, `asOf`, coverage, and active filters.
- The decision queue supports review, assign, approve when authorized, dismiss with reason, and view evidence.
- Potentially destructive or financially material approvals require explicit confirmation and an audit record.
- The global date control supports Today, 7D, MTD, QTD, and YTD. A custom range lives in a popover rather than occupying the first viewport.
- Desktop uses a compact left rail with labels on expansion or hover. Mobile uses a Sheet and places the three primary questions in a vertical stack.
- Drill-downs use drawers or route-level detail based on complexity; dense tables are never forced into small modal dialogs.

## 7. Data and source rules

| Domain | Canonical source | V1 state until connected |
| --- | --- | --- |
| Completed ecommerce orders and sales | Shopify | Not connected to Executive Hub |
| Accounting, EBITDA, cash, A/R, A/P | Approved accounting or ERP source | Source not identified |
| Sales pipeline, quotes, samples, account ownership | Approved CRM or ERP source | Source not identified |
| Catalog and compatibility | Convex plus product-truth audits | Structurally available; live read required |
| Customer behavior and ecommerce journey | Mixpanel | Saved reports and service access required |
| Inventory, purchase orders, supplier and container state | Shopify plus approved ERP/WMS/logistics source | Partial; operational source not identified |
| Warehouse, fulfillment, manufacturing, decoration | Approved WMS or production source | Source not identified |
| Content | Sanity | Live completeness read required |
| Grace quality and assisted outcomes | Mixpanel, Convex, Shopify | Instrumentation in progress |
| OpenAI usage and billed cost | Dedicated OpenAI project | Cost connection required |
| Production health | Vercel | Observability connection required |

Every dashboard value must carry `source`, `asOf`, `status`, and `coverage`. Valid status values are `source-backed`, `directional`, `stale`, `not-connected`, and `error`. Illustrative data may appear only in an explicit preview or fixture mode.

## 8. States and accessibility

- Loading: stable Skeletons preserve the final layout.
- Empty: explain whether the period truly has no activity or the source has never populated.
- Not connected: name the required source and responsible setup action.
- Stale: show the last successful read and suppress false trend confidence.
- Error: retain the last known value only when clearly labeled and provide retry or source drill-down.
- Permissions: unauthorized users see neither values nor sensitive structural detail.
- Overflow: labels truncate only when full values remain available through Tooltip or detail view.
- Keyboard, focus, contrast, semantic heading, table, reduced-motion, and mobile requirements are release gates.

## 9. Scope and boundaries

V1 includes the authenticated shell, approved navigation, overview composition, source-aware metric contracts, preview fixtures, responsive behavior, and designed loading, missing, stale, error, and permission states.

V1 does not manufacture live numbers, replace accounting or ERP systems, expose raw Grace transcripts, implement autonomous product-truth learning, or require every operating source to be connected before the source-aware interface can ship.

Ecommerce conversion remains available in its own lane but does not lead the CEO overview. Grace Operations remains a first-class lane but is evaluated through business contribution, quality, latency, and cost rather than conversation volume alone.

## 10. Acceptance criteria

1. The first viewport answers performance, future revenue, and required attention.
2. Profitability, pipeline, inventory, fulfillment, and customer-account risk lead the information hierarchy.
3. No more than six supporting KPIs appear in the headline strip.
4. Each value exposes source, freshness, coverage, comparison, and drill-down.
5. The decision queue exposes impact, owner, deadline, recommendation, and evidence.
6. Ecommerce and Grace remain accessible without displacing B2B operating priorities.
7. Preview data is visibly illustrative and cannot be confused with production truth.
8. Missing systems render honest not-connected states.
9. Desktop and mobile preserve the same three-question hierarchy.
10. Keyboard, screen-reader, contrast, and reduced-motion requirements pass.
11. The implementation uses existing shadcn primitives where they provide the correct accessible behavior.
12. The page remains understandable without interpreting color alone.

## 11. Confirmed implementation sequence

1. Establish typed metric, source-health, date-range, and decision contracts.
2. Refactor the existing `/executive` page into a server auth boundary plus focused dashboard components.
3. Implement approved B2B Signal Board with explicit fixture mode and source states.
4. Add responsive drill-down behavior and the decision queue interaction shell.
5. Add Convex operational entities and Grace telemetry required by the approved broader operating-system design.
6. Connect live sources one lane at a time, beginning with the sources that already exist in the repository.
7. Verify desktop, mobile, accessibility, source honesty, and regression behavior before any production release.
