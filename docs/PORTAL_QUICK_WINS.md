# Portal Quick Wins — Easy-to-Implement Ideas

Ideas for additional portal features that are relatively quick to build.

---

## ✅ Implemented

### Price List / Quote Builder
- **Location:** `/portal/price-list`
- **What it does:** Structured line-item builder (SKU, description, qty, unit price). Add/remove rows, running total, Save to Draft, link to catalog and Request Quote.
- **Why it matters:** Replaces free-form text on the public request-quote form with a proper table. B2B buyers can build lists, paste from spreadsheets, and save to drafts.

---

## Easy Additions (1–2 days each)

### 1. **Pricing Tier Progress Card**
- **Where:** Dashboard or Account page
- **What:** "You're $X away from Tier 2 pricing" — show YTD spend vs. next tier threshold
- **Data:** `portalAccounts` tier + `portalOrders` YTD total (already computed)
- **Effort:** Low — one new card component

### 2. **Copy Price List to Clipboard**
- **Where:** Price List page
- **What:** "Copy as CSV" or "Copy for Email" — export current line items as tab-separated or formatted text
- **Effort:** Low — `navigator.clipboard.writeText()` with formatted string

### 3. **Favorites / Saved SKUs**
- **Where:** New `/portal/favorites` or sidebar section
- **What:** Let users save frequently ordered SKUs. One-click add to draft.
- **Data:** New Convex table `portalFavorites` (clerkOrgId, sku, description, lastUsed)
- **Effort:** Medium — table + UI + add-to-draft action

### 4. **Draft Editor (Resume)**
- **Where:** Drafts page — make "Resume" actually open an editable view
- **What:** Edit draft name, add/remove/edit line items, update quantities
- **Data:** `updateDraft` mutation (patch lineItems, totalAmount)
- **Effort:** Medium — reuse Price List table component, load existing draft

### 5. **Request Quote with Pre-filled Line Items**
- **Where:** Price List page
- **What:** "Request Quote" button that navigates to `/request-quote` with line items in URL params or sessionStorage, so the form is pre-filled
- **Effort:** Low — pass data via query params or `sessionStorage`

### 6. **Catalog Link with "Add to Price List"**
- **Where:** Catalog PDP
- **What:** When logged into portal, show "Add to Price List" on product cards. Adds SKU + description + qty to a session list, then redirect to Price List with items pre-filled
- **Effort:** Medium — needs session/state bridge between catalog and portal

### 7. **Document Upload (Business License)**
- **Where:** Account page — "Update Documents" button
- **What:** Upload PDF/image for business license, resale certificate. Store in Convex file storage, link to `portalAccounts`
- **Effort:** Medium — Convex `storage`, upload UI, expiry reminder

### 8. **Order Detail Expand**
- **Where:** Orders page
- **What:** Click row to expand and see full line items, tracking link, ship-to address
- **Effort:** Low — accordion or slide-down, data already in `portalOrders`

---

## Medium Effort (3–5 days)

- **Grace Add-to-Draft:** Grace can add recommended products directly to a draft (tool + mutation)
- **Reorder from Order:** One-click "Reorder" creates draft from that order (mutation exists; wire the button)
- **Pricing Tier Visibility:** Full tier ladder with benefits (Tier 1/2/3) on Account page

---

## Reference

- Price List page: `src/app/(portal)/portal/price-list/page.tsx`
- Draft mutation: `convex/portal.ts` → `createDraftWithLineItems`
- Portal sidebar: `src/components/portal/PortalSidebar.tsx`
