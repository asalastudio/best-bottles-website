# Best Bottles Customer Portal — Product Requirements Document

**Version:** 1.0 DRAFT
**Date:** March 3, 2026
**Author:** Jordan Richter / Claude
**Status:** Design & Planning

---

## 1. Executive Summary

The Best Bottles Customer Portal is a B2B-first web application that transforms how wholesale packaging buyers interact with Nemat International. Rather than relying on phone calls, emailed spreadsheets, and manual order tracking, the portal gives authenticated business customers a single destination to browse the catalog, build orders, track shipments, manage their account, and consult Grace — an AI concierge who understands every SKU, fitment rule, and business policy.

**The core thesis:** Best Bottles customers are busy formulators, brand owners, and procurement managers. The portal should feel like having a dedicated account manager available 24/7 — fast, knowledgeable, and frictionless.

---

## 2. Problem Statement

### Current Pain Points (B2B Buyers)

| Pain Point | Impact |
|------------|--------|
| Order placement requires email/phone → slow turnaround | Lost revenue from abandoned inquiries |
| No self-service order tracking | Support team fields repetitive "where's my order?" calls |
| Pricing tiers are opaque — buyers don't know their volume discount | Under-ordering (customers don't realize they're close to a price break) |
| Reordering requires remembering past SKUs | Friction on repeat purchases — Best Bottles' bread and butter |
| No visibility into credit terms or account standing | Finance team manually sends statements |
| Fitment compatibility is tribal knowledge | Wrong components shipped → returns, restocking fees, customer frustration |
| Sample requests require back-and-forth emails | Slow onboarding of new customers evaluating Best Bottles |

### Current Pain Points (Best Bottles Operations)

| Pain Point | Impact |
|------------|--------|
| Manual order entry from emails/calls | Error-prone, time-consuming |
| No unified customer activity view | Account managers lack context |
| QuickBooks is source of truth but not customer-facing | Data exists but isn't actionable for buyers |
| Peak season (Sept–Dec) overwhelms support | 2x processing time during highest-revenue period |

---

## 3. Users & Personas

### Primary Personas

#### 1. "The Scaler" — Growth-Stage Brand Owner
- **Profile:** Fragrance or beauty brand doing $50K–$500K/yr, 2–5 employees
- **Behavior:** Orders monthly, usually 10–20 SKUs, price-sensitive at volume breaks
- **Needs:** Fast reordering, volume pricing visibility, fitment guidance
- **Portal use:** Weekly — checking orders, reordering, exploring new bottles

#### 2. "The Formulator" — Contract Manufacturer / Private Label
- **Profile:** Fills bottles for multiple brands, high SKU variety
- **Behavior:** Large orders (50+ line items), needs technical specs (thread sizes, fill volumes)
- **Needs:** Draft orders, multi-project management, spec sheet downloads, bulk ordering
- **Portal use:** Daily — managing multiple projects, cross-referencing specs

#### 3. "The Boutique Owner" — Small Business / Etsy Seller
- **Profile:** 1-person operation, <$10K/yr with Best Bottles
- **Behavior:** Small orders (5–15 units), visual shopper, needs hand-holding on fitment
- **Needs:** Visual catalog, Grace AI guidance, simple checkout, sample ordering
- **Portal use:** Monthly — placing small orders, asking Grace for recommendations

#### 4. "The Procurement Manager" — Enterprise Buyer
- **Profile:** Large company, dedicated procurement role, $500K+/yr
- **Behavior:** Scheduled bulk orders, needs invoices/SDS for compliance, Net 60 terms
- **Needs:** Document vault, credit visibility, order history exports, account admin
- **Portal use:** Weekly — pulling invoices, tracking shipments, reviewing spend

### Secondary Personas

#### 5. Internal: Account Manager (Best Bottles Staff)
- Needs visibility into customer portal activity
- Should see what customers see (for support calls)
- May need to create/edit draft orders on behalf of customers

#### 6. Internal: Operations / Fulfillment
- Needs submitted portal orders to flow into fulfillment pipeline
- Needs draft-to-order conversion workflow

---

## 4. Product Vision & Principles

### Vision Statement
> The Best Bottles portal should be the most intuitive B2B packaging purchasing experience in the industry — combining the convenience of modern e-commerce with the depth of a dedicated account relationship. It should feel like Salesforce meets Notion — structured, organized, and deeply practical — wrapped in the Best Bottles brand aesthetic.

### Design Philosophy: "Luxury Workspace"

The portal sits at the intersection of two worlds:

**Brand continuity** — The same EB Garamond headlines, obsidian/bone/champagne/gold palette, and editorial tone that define the public site. Customers should feel they're in the same house, just a different room.

**Business-grade structure** — The organizational rigor of Salesforce (data tables, status pipelines, KPI cards) and the clarity of Notion (clean hierarchy, thoughtful whitespace, composable blocks). Every screen should answer: "What am I looking at? What can I do? What's the status?"

The result: a portal that looks like a luxury brand but works like an enterprise tool.

#### Design System: shadcn/ui + Best Bottles Brand Tokens

The portal leverages **shadcn/ui** as its component foundation — battle-tested, accessible, composable primitives styled with Best Bottles brand tokens. This gives us:

- **Consistency** — Every table, button, card, dialog, and form follows the same interaction patterns
- **Accessibility** — WCAG 2.1 AA compliance built into every component (keyboard nav, screen readers, focus management)
- **Speed** — No reinventing wheels; shadcn components are production-ready
- **Customization** — CSS variable theming lets us apply the Best Bottles palette without forking components

**Registries:**
- `@shadcn` — Core component library (buttons, tables, dialogs, forms, tabs, popovers, etc.)
- `@cult-ui` — Extended components (animated numbers, texture buttons, direction-aware tabs)

**Currently installed:**
`button`, `card`, `badge`, `table`, `separator`, `progress`, `animated-number`, `minimal-card`, `texture-button`, `direction-aware-tabs`

**Planned additions for portal:**

| Component | Use Case |
|-----------|----------|
| `data-table` | Order history, draft line items, document vault — sortable, filterable, paginated |
| `dialog` / `sheet` | Confirm order submission, edit draft details, quick-view product specs |
| `command` | Command palette (Cmd+K) for power users — search orders, jump to pages, ask Grace |
| `tabs` | Account page sections, order detail views, Grace workspace projects |
| `form` + `input` + `select` | Draft order builder, account settings, filters |
| `tooltip` | Pricing tier explanations, fitment status indicators |
| `popover` | Quick actions on table rows (reorder, download invoice, track) |
| `dropdown-menu` | Bulk actions, export options, sort controls |
| `skeleton` | Loading states for all data-driven sections |
| `toast` / `sonner` | Success/error feedback (order submitted, draft saved, export ready) |
| `breadcrumb` | Navigation hierarchy in top bar |
| `avatar` | User/org identity, account manager profile |
| `calendar` + `date-picker` | Date range filtering on orders, delivery scheduling |
| `pagination` | Order history, document vault |
| `resizable` | Grace workspace (chat panel + project sidebar) |
| `chart` (Recharts) | Dashboard spend trends, order volume, credit utilization |
| `sidebar` | Already built custom, but consider migrating to shadcn sidebar for consistency |

#### Visual Language

| Element | Treatment |
|---------|-----------|
| **Data tables** | Clean rows, subtle champagne borders, gold accent on hover. Status badges use `Badge` with brand colors (green/delivered, gold/processing, muted/cancelled). |
| **KPI cards** | `Card` with `animated-number` for live metrics. Obsidian header stripe, bone background. |
| **Navigation** | Fixed sidebar (Notion-style) with collapsible sections. Active state = gold left border + champagne background. |
| **Forms** | Generous padding, clear labels, inline validation. `texture-button` for primary CTAs. |
| **Empty states** | Illustration + helpful copy + CTA. Never a blank page. ("No orders yet — browse the catalog or ask Grace for recommendations") |
| **Loading states** | `Skeleton` shimmer in champagne tones. Never a spinner. |
| **Modals/sheets** | Slide-in sheets (right side) for detail views. Centered dialogs for confirmations. Always dismissable. |
| **Toast notifications** | Bottom-right, auto-dismiss after 5s. Gold accent for success, red for errors. |

#### Information Architecture: Notion-Inspired

Every portal page follows this hierarchy:

```
Page Header (eyebrow + title + subtitle + action buttons)
  └── Section blocks (Card containers with SectionLabel headers)
       └── Data presentation (Table, Grid, Chart, or Form)
            └── Row-level actions (inline buttons, popovers, context menus)
```

This mirrors Notion's block-based structure: pages are composed of discrete, understandable sections. Users can scan the page top-to-bottom and immediately orient themselves.

#### Interaction Patterns: Salesforce-Inspired

| Pattern | Implementation |
|---------|----------------|
| **Pipeline views** | Order status as horizontal stage tracker (like Salesforce Opportunity stages) |
| **Inline editing** | Click to edit draft line item quantities without opening a separate form |
| **Bulk actions** | Select multiple orders/drafts → batch reorder, export, or archive |
| **Quick actions** | Context menus on every data row (right-click or "..." button) |
| **Command palette** | Cmd+K to search everything — orders, products, drafts, Grace, navigation |
| **Keyboard shortcuts** | Power users can navigate entirely by keyboard (N = new draft, R = reorder, G = Grace) |
| **Filters as pills** | Active filters shown as removable badges above data tables |
| **Saved views** | Customers can save filter combinations ("My 30ml orders", "Pending deliveries") |

### Product Principles

1. **Speed over ceremony** — Repeat buyers should be able to reorder in under 60 seconds. Every click must earn its place.

2. **Transparency builds trust** — Show pricing tiers, credit terms, order status, and delivery estimates proactively. No information should require a phone call to obtain.

3. **Grace is the differentiator** — AI concierge is not a gimmick. Grace should have full context on the customer's account, order history, and current needs. She's the 24/7 account manager.

4. **Progressive complexity** — The boutique owner and the enterprise buyer use the same portal, but the interface reveals depth only when needed. Simple by default, powerful on demand.

5. **Trust the catalog data** — 2,285 SKUs with 63 fitment rules is a competitive moat. The portal should make this data a feature, not a liability (compatibility checks, smart recommendations, cross-sell).

6. **Offline-to-online bridge** — Many customers started with phone/email relationships. The portal should enhance (not replace) the human account manager relationship.

7. **Component-driven consistency** — Every UI element comes from the shadcn/ui system. No one-off styled divs. If a pattern appears twice, it becomes a component.

---

## 5. Feature Specification

### 5.1 Authentication & Organization Management

**Status:** Clerk integration LIVE

| Requirement | Priority | Status |
|-------------|----------|--------|
| Email + password sign-in | P0 | Done (Clerk) |
| Google / Microsoft SSO | P1 | Clerk supports, needs config |
| Organization (multi-user company accounts) | P0 | Clerk Orgs enabled |
| Role-based access (Owner, Admin, Buyer, Viewer) | P1 | Planned |
| Invite team members to organization | P1 | Clerk Orgs supports |
| Organization-level data isolation (orders, drafts, account) | P0 | Schema indexed by clerkOrgId |
| Session persistence (stay logged in) | P0 | Clerk default |
| Magic link / passwordless option | P2 | Clerk supports |

**Open Questions:**
- Should new sign-ups auto-create an org, or must they be invited by an existing customer?
- How do we handle the initial onboarding of existing QuickBooks customers? (Bulk invite? Claim flow?)
- Do we gate portal access behind account approval, or is it open registration with a limited view?

---

### 5.2 Dashboard (Home)

**Status:** UI complete, static data

The dashboard is the customer's command center. It should answer: "What do I need to know right now?"

| Feature | Description | Priority |
|---------|-------------|----------|
| KPI Cards | YTD Spend, Active Orders, Units In Flight, Credit Available | P0 |
| Order Pipeline | Visual stage tracker (Processing → Shipped → Delivered) | P0 |
| Spend Trend | 6-month bar chart of spending history | P1 |
| Credit Utilization | Net 30/60 usage progress bar with due dates | P0 |
| Recent Deliveries | Last 5 delivered orders with quick reorder | P0 |
| Grace Recommendations | AI-curated product suggestions based on order history | P1 |
| Quick Reorder Strip | Top 5 most-reordered SKUs, one-click add to cart | P0 |
| Alerts / Notifications | Price changes, back-in-stock, approaching credit limit | P2 |

**Data Sources:**
- `portalAccounts` → tier, terms, credit
- `portalOrders` → order history, active orders, spend calculation
- `products` / `productGroups` → recommendation engine input
- Grace AI → personalized recommendations

---

### 5.3 Order Management

**Status:** UI complete, static data

#### 5.3.1 Order History

| Feature | Description | Priority |
|---------|-------------|----------|
| Paginated order list | All historical orders, newest first | P0 |
| Status filtering | Filter by: All, Processing, In Transit, Delivered, Cancelled | P0 |
| Date range filtering | Custom date range picker | P1 |
| Order detail view | Expand to see full line items, quantities, pricing | P0 |
| Reorder button | One-click: adds all line items from a past order to cart | P0 |
| Invoice download | PDF invoice generation/retrieval per order | P0 |
| Export to CSV | Download order history for accounting integration | P1 |
| Search orders | By order ID, SKU, or product name | P1 |

#### 5.3.2 Live Tracking

| Feature | Description | Priority |
|---------|-------------|----------|
| 5-stage timeline | Order Received → Processing → Picked & Packed → Shipped → Delivered | P0 |
| Carrier integration | UPS / USPS tracking number with external link | P0 |
| Estimated delivery | Calculated from carrier data | P0 |
| Shipment details | Carrier, weight, carton count, ship-from/ship-to | P0 |
| Grace contextual tips | "Your order typically takes 3 days to Union City" | P2 |
| Push notifications | Email/SMS alerts on status changes | P2 |
| Multi-shipment support | Orders that ship in multiple packages | P1 |

---

### 5.4 Draft Orders (Cart Builder)

**Status:** UI complete, static data — this is a critical workflow

Drafts are the heart of the B2B ordering experience. Unlike B2C where you add to cart and checkout immediately, B2B buyers often build orders over days/weeks, get internal approval, then submit.

| Feature | Description | Priority |
|---------|-------------|----------|
| Create new draft | Start from scratch or from a past order | P0 |
| Add products to draft | From catalog, search, or Grace recommendation | P0 |
| Quantity editing | Inline quantity adjustment with live price recalc | P0 |
| Volume pricing preview | Show price breaks as quantity approaches tier thresholds | P0 |
| Fitment validation | Warn if incompatible bottle + component combo in draft | P0 |
| Save and resume | Drafts persist across sessions | P0 |
| Share draft | Send draft link to colleague for review/approval | P1 |
| Draft status workflow | Draft → In Review → Submitted → Converted to Order | P0 |
| Notes per line item | Buyer can annotate ("for Client X project") | P1 |
| Duplicate draft | Clone an existing draft as starting point | P1 |
| Draft comparison | Side-by-side compare two drafts | P2 |
| Grace draft review | "Hey Grace, review my draft for any issues" | P1 |

**Critical UX Consideration:**
The transition from Draft → Submitted should feel deliberate. This is a purchase commitment. Include:
- Order summary with total
- Shipping method selection
- Net terms confirmation (or payment method)
- "Submit Order" with confirmation modal

---

### 5.5 Grace AI Workspace

**Status:** UI scaffolded, chat not wired

The Grace Workspace is where the portal's AI concierge becomes a genuine productivity tool rather than just a chatbot.

| Feature | Description | Priority |
|---------|-------------|----------|
| Conversational chat | Full Grace AI with account context | P0 |
| Account-aware responses | Grace knows the customer's tier, history, preferences | P0 |
| Product search from chat | "Find me a 30ml frosted cylinder with a fine mist sprayer" | P0 |
| Add to draft from chat | Grace can add recommended products directly to a draft | P0 |
| Fitment check from chat | "Will this cap fit my Diva 15ml?" | P0 |
| Conversation history | Persistent per-organization, searchable | P1 |
| Projects | Group conversations + saved bottles by project/client | P1 |
| Grace-generated quotes | "Grace, build me a quote for 500 units of this set" | P2 |
| Export chat to PDF | For internal approvals or sharing | P2 |
| Voice interaction | Speak to Grace (ElevenLabs integration) | P2 |

**Account Context Grace Should Have:**
- Customer tier and pricing level
- Last 10 orders (SKUs, quantities, dates)
- Active drafts
- Credit terms and utilization
- Preferred bottle families (inferred from history)
- Any open support issues

---

### 5.6 Document Vault

**Status:** UI complete, static data

| Feature | Description | Priority |
|---------|-------------|----------|
| Invoices | Auto-generated per delivered order | P0 |
| Spec Sheets | Product specification PDFs | P0 |
| SDS Documents | Safety Data Sheets for compliance | P0 |
| Agreements | Terms of service, pricing agreements | P1 |
| Certificates | COA, material certifications on request | P2 |
| Bulk download | Select multiple docs, download as ZIP | P1 |
| Search documents | By name, order number, date | P1 |
| Upload (customer) | Customers upload their own docs (POs, labels) | P2 |

---

### 5.7 Tools & Calculators

**Status:** Fully functional (client-side)

| Tool | Description | Priority |
|------|-------------|----------|
| Fill Volume Calculator | Input container dimensions → calculate fill volume (5–120ml) | P0 — Done |
| Label Dimension Generator | Input bottle diameter → recommend label width/height | P0 — Done |
| Volume Pricing Calculator | Input quantity → show tiered pricing breakdown | P0 — Done |
| Shipping Estimator | Input ZIP + order weight → estimate shipping cost | P1 |
| Case Pack Calculator | Input units needed → calculate cases to order | P1 |
| MOQ Optimizer | "You need 47 units, but 48 (4 cases) saves you $X" | P2 |

---

### 5.8 Account & Pricing

**Status:** UI complete, static data

| Feature | Description | Priority |
|---------|-------------|----------|
| Company profile display | Name, address, account number, member since | P0 |
| Tier status + benefits | Current tier with unlocked perks | P0 |
| Account manager card | Name, photo, phone, email, schedule call CTA | P0 |
| Net terms display | Terms, credit limit, current utilization | P0 |
| Pricing tier visibility | "You're on Tier 2 — order $5K more this year for Tier 3 pricing" | P1 |
| Edit company profile | Update address, billing info, tax exemption docs | P1 |
| Team management | View/invite/remove org members (Clerk Organizations) | P1 |
| Notification preferences | Email/SMS preferences for order updates, marketing | P2 |
| API key management | For customers who want to integrate programmatically | P3 |

---

## 6. Data Architecture & Integration

### 6.1 Data Flow Overview

```
                    QuickBooks (Source of Truth)
                           |
                    [Manual Seed / Sync]
                           |
                           v
    Clerk Orgs  <----->  Convex DB  <----->  Sanity CMS
    (Auth/Identity)     (Transactions)     (Editorial Content)
         |                  |                      |
         |                  v                      |
         +-------->  Portal Frontend  <------------+
                           |
                     [Future Phase]
                           |
                           v
                      Shopify API
                   (Checkout / Payments)
```

### 6.2 Data Source Matrix

| Data | Current Source | Portal Source | Sync Direction |
|------|---------------|---------------|----------------|
| Customer accounts | QuickBooks | `portalAccounts` (Convex) | QB → Convex (manual seed, then webhook) |
| Order history | QuickBooks | `portalOrders` (Convex) | QB → Convex (manual seed initially) |
| Draft orders | Portal-native | `portalDrafts` (Convex) | Portal → Convex (real-time) |
| Product catalog | Master spreadsheet | `products` + `productGroups` (Convex) | Spreadsheet → Convex (migration scripts) |
| Product images | Sanity CDN | `heroImageUrl` on productGroups | Sanity → Convex (URL reference) |
| Product descriptions | Sanity CMS | Sanity query on PDP | Sanity → Frontend (ISR) |
| Fitment rules | Master spreadsheet | `fitments` (Convex) | Spreadsheet → Convex (migration scripts) |
| Invoices/docs | QuickBooks | TBD (file storage) | QB → Storage (manual initially) |
| Shipment tracking | UPS/USPS | `portalOrders.trackingNumber` | Carrier API → Convex (webhook) |

### 6.3 Convex Schema Status

| Table | Status | Records | Wired to Portal? |
|-------|--------|---------|-------------------|
| `portalAccounts` | Schema defined | 0 (needs seed) | No |
| `portalOrders` | Schema defined | 0 (needs seed) | No |
| `portalDrafts` | Schema defined | 0 | No |
| `graceProjects` | Schema defined | 0 | No |
| `products` | LIVE | ~2,285 | Via catalog (public) |
| `productGroups` | LIVE | ~230 | Via catalog (public) |
| `fitments` | LIVE | 63 | Via Grace tools |
| `conversations` | LIVE | Active | Via Grace (public) |
| `messages` | LIVE | Active | Via Grace (public) |

---

## 7. Integration Requirements

### 7.1 QuickBooks → Convex (Phase 1)

**Purpose:** Seed portal with existing customer data and order history.

| Integration | Method | Frequency |
|-------------|--------|-----------|
| Customer accounts | Manual CSV export → Convex seed script | One-time + quarterly refresh |
| Historical orders | Manual CSV export → Convex seed script | One-time + monthly sync |
| Invoices | PDF export → file storage | On-demand |

**Phase 1 is manual.** Automated sync is Phase 2.

### 7.2 Shopify Integration (Phase 2)

**Purpose:** Enable self-service checkout with payment processing.

| Integration | Method | Direction |
|-------------|--------|-----------|
| Product sync | Shopify Admin API | Convex → Shopify (product create/update) |
| Checkout | Shopify Storefront API | Portal → Shopify (cart → checkout) |
| Order webhooks | Shopify Webhooks | Shopify → Convex (order created/updated/fulfilled) |
| Customer sync | Shopify Admin API | Clerk user → Shopify customer (by email) |
| Inventory | Shopify Admin API | Shopify → Convex (stock levels) |

**Critical Decision:** When a portal draft is "Submitted," does it:
- (A) Create a Shopify order directly (requires payment method on file / Net terms integration)?
- (B) Create a Shopify draft order that the customer completes checkout on?
- (C) Send to Best Bottles operations for manual processing (email notification)?

**Recommendation:** Start with (C) for launch. Migrate to (B) in Phase 2. (A) requires Net terms payment integration (Bold Commerce or similar).

### 7.3 Carrier Tracking (Phase 2)

| Carrier | API | Data |
|---------|-----|------|
| UPS | UPS Tracking API | Status, location, estimated delivery |
| USPS | USPS Web Tools API | Status, delivery confirmation |

**Implementation:** Webhook or polling (every 4 hours for in-transit orders).

---

## 8. Phased Rollout Plan

### Phase 0: Foundation (Current State)
- [x] Clerk authentication
- [x] Portal layout and navigation
- [x] All 9 pages built with static data
- [x] Design system (typography, colors, components)
- [x] Convex schema defined for portal tables
- [ ] Convex queries for portal data (not yet wired)

### Phase 1: "Read-Only Portal" (Target: 4–6 weeks)
**Goal:** Customers can log in and see their real data. No self-service ordering yet.

- [ ] Seed `portalAccounts` from QuickBooks data
- [ ] Seed `portalOrders` with historical orders
- [ ] Wire dashboard KPIs to real Convex queries
- [ ] Wire order history page to `portalOrders`
- [ ] Wire account page to `portalAccounts`
- [ ] Wire Grace workspace chat to `askGrace` action with account context
- [ ] Basic document vault (manually uploaded invoices/specs)
- [ ] Onboard 5–10 pilot customers (manual Clerk invite)
- [ ] Collect feedback from pilot group

**Success Metrics:**
- 80% of pilot customers log in within first week
- 50% reduction in "where's my order?" calls from pilot group
- NPS score >50 from pilot group

### Phase 2: "Self-Service Ordering" (Target: 8–12 weeks after Phase 1)
**Goal:** Customers can build and submit orders through the portal.

- [ ] Draft order creation from catalog
- [ ] Add-to-draft from product pages and Grace
- [ ] Fitment validation on draft orders
- [ ] Volume pricing preview in draft builder
- [ ] Draft → Submitted workflow with confirmation
- [ ] Email notification to operations on submission
- [ ] Reorder from order history
- [ ] Grace account-aware recommendations
- [ ] Grace project management (save bottles, conversations)
- [ ] Team member invitations (Clerk Orgs)

**Success Metrics:**
- 30% of repeat orders placed through portal (vs. phone/email)
- Average draft-to-submission time <5 minutes for reorders
- <2% fitment error rate on portal orders (vs. ~8% on phone orders)

### Phase 3: "Full Commerce" (Target: 12–20 weeks after Phase 2)
**Goal:** End-to-end ordering with payment processing and real-time tracking.

- [ ] Shopify checkout integration
- [ ] Net terms payment support (B2B)
- [ ] Credit card payment for new/small customers
- [ ] Real-time carrier tracking (UPS/USPS API)
- [ ] Automated QuickBooks sync (orders, invoices)
- [ ] Push notifications (email/SMS) for order status
- [ ] Document vault auto-population (invoices, SDS, COAs)
- [ ] CSV/PDF export for order history
- [ ] Role-based access control (Owner, Admin, Buyer, Viewer)

**Success Metrics:**
- 60% of all orders placed through portal
- Zero manual order entry for portal-submitted orders
- Customer support ticket volume down 40%

### Phase 4: "Intelligence Layer" (Ongoing)
**Goal:** The portal becomes a strategic advantage, not just a tool.

- [ ] Grace-generated reorder reminders ("You usually order Cylinder 30ml every 6 weeks — time to restock?")
- [ ] Pricing tier progression ("Order $2K more this quarter for Tier 3 pricing")
- [ ] Cross-sell recommendations based on order patterns
- [ ] Inventory alerts ("Frosted Diva 15ml is low stock — order now")
- [ ] Custom reporting dashboards
- [ ] API access for enterprise customers
- [ ] Multi-language support
- [ ] Mobile-optimized experience / PWA

---

## 9. Non-Functional Requirements

### Performance
| Metric | Target |
|--------|--------|
| Portal page load (authenticated) | <2s (P95) |
| Dashboard data refresh | <1s (Convex real-time) |
| Grace response time | <3s first token |
| Search results | <500ms |
| Draft save (autosave) | <200ms (Convex optimistic updates) |

### Security
| Requirement | Implementation |
|-------------|----------------|
| Authentication | Clerk (SOC 2 compliant) |
| Data isolation | All queries scoped by `clerkOrgId` |
| Session management | Clerk JWT tokens, auto-refresh |
| HTTPS | Enforced (Vercel/Next.js default) |
| API security | Convex auth middleware on all portal queries |
| PII handling | No credit cards stored in Convex (Shopify handles payments) |
| Rate limiting | Convex built-in + Grace action throttle |

### Accessibility
| Requirement | Target |
|-------------|--------|
| WCAG compliance | 2.1 AA minimum |
| Keyboard navigation | Full portal navigable without mouse |
| Screen reader support | Semantic HTML + ARIA labels |
| Color contrast | 4.5:1 minimum (already met by design system) |
| Focus indicators | Visible focus rings on all interactive elements |

### Reliability
| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% (Convex + Vercel SLA) |
| Data backup | Convex automatic backups |
| Error handling | Graceful degradation (show cached data on query failure) |
| Offline support | Draft autosave to localStorage as fallback |

---

## 10. Analytics & Measurement

### Key Metrics to Track

| Category | Metric | Tool |
|----------|--------|------|
| Engagement | Portal DAU/WAU/MAU | PostHog or Vercel Analytics |
| Engagement | Pages per session | PostHog |
| Engagement | Grace conversations per user per week | Convex (conversations table) |
| Revenue | % of orders placed via portal vs. phone/email | Convex + QuickBooks |
| Revenue | Average order value (portal vs. traditional) | Convex |
| Revenue | Reorder rate (portal users vs. non-portal) | Convex |
| Efficiency | Support ticket volume (portal users) | Zendesk/Intercom |
| Efficiency | Time from draft creation to submission | Convex (timestamps) |
| Satisfaction | Portal NPS (quarterly survey) | Typeform/in-app |
| Satisfaction | Grace helpfulness rating (thumbs up/down) | Convex |
| Retention | 30/60/90 day retention of portal users | PostHog |
| Adoption | % of total customers with active portal accounts | Clerk + QuickBooks |

---

## 11. Open Questions & Decisions Needed

### Business Decisions

1. **Onboarding flow:** How do existing QuickBooks customers get portal access?
   - Option A: Bulk email invite with magic link
   - Option B: Account manager personally onboards during next call
   - Option C: Self-serve sign-up that matches to existing account by email/company name

2. **Pricing visibility:** Should portal users see all pricing tiers, or only their own?
   - Showing all tiers incentivizes volume ("order 200 more for 15% savings")
   - Showing only their tier is simpler and avoids confusion

3. **Draft submission → Order:** What happens when a customer hits "Submit Order"?
   - Phase 1: Email to operations, manual processing
   - Phase 2: Shopify draft order with checkout link
   - Phase 3: Direct order with Net terms billing

4. **Grace in portal vs. public site:** Should portal Grace be a different (more capable) experience?
   - Portal Grace has account context, can modify drafts, knows pricing
   - Public Grace is a lead-gen / product discovery tool
   - Recommendation: Same AI, different system prompt with account context injection

5. **Document generation:** Who creates invoices and spec sheets?
   - Option A: QuickBooks generates, portal just displays
   - Option B: Portal generates from order data (requires template system)
   - Recommendation: Option A for Phase 1, reassess for Phase 3

6. **Credit / Net terms display:** How much financial data do we show?
   - Full transparency: credit limit, utilization, payment history, aging
   - Minimal: just "Net 30 active" with no dollar amounts
   - Recommendation: Show credit limit + utilization bar. Don't show aging/payment history.

### Technical Decisions

7. **Real-time vs. polling for order status:** Convex supports real-time subscriptions, but carrier APIs are pull-based. Strategy?

8. **File storage for documents:** Convex file storage, Sanity assets, or external (S3/R2)?

9. **Search infrastructure:** Convex full-text search sufficient, or do we need Algolia/Typesense for the portal?

10. **Mobile strategy:** Responsive web only, or PWA with offline capabilities?

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low initial adoption ("I'll just call my rep") | High | Medium | Offer portal-exclusive benefits (faster processing, pricing visibility). Account managers actively demo during calls. |
| QuickBooks data quality issues | Medium | High | Data validation layer on seed scripts. Manual QA on pilot accounts before launch. |
| Grace gives incorrect pricing/availability | Medium | High | Grace system prompt includes disclaimer. All Grace-suggested orders require human review before processing. |
| Shopify integration complexity delays Phase 3 | Medium | Medium | Phase 1 & 2 are valuable without Shopify. Decouple commerce from portal value. |
| Multi-user org permission conflicts | Low | Medium | Start with simple model (all org members see everything). Add granular roles in Phase 3. |
| Customer data privacy concerns | Low | High | Clerk SOC 2 compliance. Clear data isolation by org. Privacy policy update. |

---

## 13. Success Criteria (6-Month Post-Launch)

| Metric | Target |
|--------|--------|
| Portal-registered customers | 40% of active B2B accounts |
| Monthly active portal users | 25% of registered customers |
| Orders placed via portal | 30% of total order volume |
| Average reorder time | <3 minutes (vs. ~20 min phone/email) |
| Support ticket reduction | 30% fewer "order status" inquiries |
| Customer satisfaction (portal NPS) | >60 |
| Grace utilization | >50% of portal sessions include Grace interaction |
| Fitment error rate | <2% on portal orders |

---

## Appendix A: Existing Technical Assets

| Asset | Status | Notes |
|-------|--------|-------|
| 9 portal pages (Next.js) | Built, static data | Ready for Convex wiring |
| Clerk auth + middleware | LIVE | Protecting `/portal/*` routes |
| Convex portal schema | Defined | `portalAccounts`, `portalOrders`, `portalDrafts`, `graceProjects` |
| Portal design system | LIVE | `PortalCard`, `PortalButton`, `PortalTag`, `StatCard`, etc. |
| Grace AI (Claude Sonnet) | LIVE | `askGrace` action with tool-use loop |
| Grace tools | LIVE | `searchCatalog`, `checkCompatibility`, `getCatalogStats` |
| Product catalog | LIVE | 2,285 SKUs, 230 groups, 63 fitment rules |
| ElevenLabs voice | LIVE | Voice conversation for Grace |
| Calculators | LIVE | Fill volume, label dimensions, volume pricing |

## Appendix B: Competitive Landscape

| Competitor Portal | Strengths | Gaps We Can Exploit |
|-------------------|-----------|---------------------|
| Uline (B2B packaging) | Massive catalog, fast shipping | No AI, generic experience, no account intelligence |
| Berlin Packaging | Custom design services | Portal is basic, no fitment validation |
| SKS Bottle | Clean catalog, good search | No B2B portal, no AI, no order management |
| Alibaba suppliers | Low prices | No quality assurance, no relationship, no US support |

**Best Bottles differentiator:** Grace AI + fitment intelligence + curated catalog + personal account relationship. No competitor offers an AI concierge that understands bottle-component compatibility.
