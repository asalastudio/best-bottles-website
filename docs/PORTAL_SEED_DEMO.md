# Portal Demo Data Seed

Seed the Customer Portal with example data for client demos.

## What Gets Seeded

- **Account:** Lumière Atelier (BB-2021-0847), Tier 2, Net 30, Tax Exempt
- **Business License:** CA-12345678, expires Dec 31, 2026
- **Resale Certificate:** Expires Jun 30, 2026 — Status: Current
- **Orders:** 3 orders (1 in transit, 2 delivered)
- **Draft:** "Q2 Roll-On Restock" with 2 line items

## How to Run

### 1. Get Your Clerk Organization ID

1. Sign in to the portal at `/portal` (or `/sign-in` first)
2. Open [Clerk Dashboard](https://dashboard.clerk.com) → Organizations
3. Copy your organization ID (e.g. `org_2abc123xyz`)

Or: Use browser DevTools → Application → Cookies → find `__clerk_db_jwt` or check the network tab when loading `/portal`.

### 2. Run the Seed

```bash
npx convex run portal:seedPortalDemoData '{"clerkOrgId": "org_YOUR_ORG_ID"}'
```

Replace `org_YOUR_ORG_ID` with your actual Clerk organization ID.

### 3. Refresh the Portal

Reload `/portal` — you should see the demo data on the dashboard, orders, account, and drafts pages.

## Business License & Compliance

The Account page now includes a **Business License & Compliance** section:

- Business license number
- License expiry date
- Resale certificate expiry
- Compliance status (Current / Expiring Soon / Expired / Not on File)
- "Update Documents" button (placeholder — upload flow TBD)

This addresses the requirement for B2B customers to keep their business license and resale certificate current for tax-exempt status.
