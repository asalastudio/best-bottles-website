# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Best Bottles serves B2B buyers sourcing bottles, closures, fitments, pumps, sprayers, rollers, and related packaging components. Buyers need to identify a bottle platform, understand compatible components, request samples or quotes, and place or repeat orders without confusing physically different specifications.

The Executive Hub serves the CEO and trusted leadership. Its primary job is to make business performance, material change, and decisions requiring leadership attention understandable in under five minutes. Operators may receive assigned work from the hub, but the CEO overview is not an operator task board.

## Product Purpose

Best Bottles supplies packaging rather than operating as a direct-to-consumer fragrance brand. The digital system supports product discovery and configuration, sales and quote generation, repeat purchasing, catalog truth, and the internal operation of a packaging-supply business.

The Executive Hub is the leadership operating system for that business. Success means the CEO can determine whether the company is growing profitably, whether future revenue and inventory are healthy, whether customers are being served on time, and what requires a decision.

## Positioning

The customer experience connects a large packaging catalog to verified compatibility and configurable bottle families. Grace AI, Refine, and the Paper Doll builder share the same catalog and filter state so customers can evaluate compatible components without treating unlike bottle platforms as interchangeable.

The Executive Hub connects commercial, financial, inventory, supplier, fulfillment, manufacturing or decoration, customer, catalog, Grace, and platform signals to explicit decisions with owners and evidence.

## Operating Context

- Best Bottles manages thousands of product and component SKUs.
- Sales work includes leads, qualification, quotes, samples, purchase orders, backlog, fulfillment, and repeat orders.
- Supply work includes inventory, outstanding purchase orders, overseas containers, supplier lead times, fill rate, stockouts, and overstock.
- Operational work includes picking, packing, shipping, order accuracy, damage, returns, and potentially printing or decoration workflows.
- Shopify controls completed ecommerce order and sales truth; Convex controls catalog and Grace operational entities; Mixpanel controls behavior; Sanity controls content; Vercel controls production health; OpenAI controls authoritative API cost.
- Financial, CRM, ERP, warehouse, production, and supplier-logistics systems must be identified before those dashboard values can be source-backed.

## Capabilities and Constraints

- The catalog and builder must preserve exact physical constraints, including the separation of 9 mL 13-415 and 9 mL 17-415 platforms.
- Grace voice and text use the shared catalog, Refine state, and Paper Doll compatibility rules.
- The Executive Hub must distinguish source-backed, directional, stale, not-connected, and error states.
- Checkout activity cannot be reported as completed revenue. Shopify completed orders control commerce truth.
- Customer feedback may create controlled-learning candidates for Grace but cannot directly rewrite product truth, compatibility, price, inventory, policy, or production behavior.
- The dashboard may show illustrative data during design and development only when it is unmistakably labeled.
- Raw transcripts and unnecessary personal customer data do not belong on the CEO overview.

## Brand Commitments

Best Bottles should feel premium, precise, calm, and credible rather than templated or visually noisy. Language is direct and useful. The Executive Hub preserves the established Best Bottles identity while adopting the density and confidence appropriate to a serious operating instrument.

## Evidence on Hand

- The repository contains the authenticated `/executive` shell, shadcn-based interface primitives, Best Bottles tokens, catalog and checkout instrumentation, Grace OpenAI Realtime integration, Convex schemas, and regression tests.
- The approved Executive Hub and Grace Operations design artifact is in `docs/executive-hub/`.
- Current visual concepts use illustrative values. No live financial, ERP, CRM, warehouse, manufacturing, or supplier-logistics dataset has been approved as dashboard truth.

## Product Principles

1. Outcomes before activity.
2. One canonical owner for every fact.
3. Exceptions and decisions before exhaustive reporting.
4. Evidence before learning or product-truth changes.
5. Missing or stale data is labeled, never silently inferred.

## Accessibility & Inclusion

The public product experience must work on mobile. The Executive Hub must support keyboard operation, visible focus, semantic structure, sufficient contrast, reduced motion, and an ADHD-friendly hierarchy that keeps the most important decision visible without requiring a wall of charts.
