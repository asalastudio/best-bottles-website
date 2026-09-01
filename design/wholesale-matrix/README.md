# Wholesale Matrix — design canvas

Design source for the Wholesale Matrix / Bottle Configuration Workspace
(PRD 2026-08-31). Five artboards over one canvas:

| File | Artboard |
|---|---|
| `Main.dc.html` | Wholesale Matrix — customer view (family accordion, compact rows, anchored component picker, configuration drawer, sticky order bar) |
| `CatalogQA.dc.html` | Catalog QA — staff view over the SAME rows, with completeness diagnostics and family health |
| `WholesaleOnboarding.dc.html` | Wholesale account + resale-certificate flow and the staff review queue |
| `ComponentPicker.dc.html` | Component picker states, validation copy, bulk-apply |
| `MobileFlow.dc.html` | Sequential mobile fallback (same configuration engine) |
| `canvas.json` | Canvas layout + the decision/risk annotations |

Published canvas: https://claude.ai/code/artifact/80a91802-77b6-46fb-8086-8ad0a40e73cb

## Decisions baked into these mockups (Jordan, 2026-08-31)

- **No "Request Quote."** Customers buy or they don't; questions — including
  volume pricing — route to Grace. Revisit later.
- **$50 order minimum, no unit minimum.** Confirmed in `convex/gracePrompt.ts`
  ("Minimum order: $50.00 (excluding shipping)"). There is therefore **no MOQ
  column**; the minimum lives in the order bar. Note the rule currently exists
  only in Grace's prompt — nothing in cart/checkout enforces it.
- **Catalog QA scans the full catalog.**
- **Tax exemption requires employee approval** of a resale certificate.
  Unapproved buyers are charged tax but are never blocked from purchasing.

## Known blockers (do not start Phase 1 without these)

1. **Target branch.** The 3D configurator lives on `feat/bottle-bodies-3d`,
   whose `convex/` is 1,338 lines behind main and missing four modules that are
   live on dev. Convex work must target main or a reconciled branch.
2. **Shopify does not honour volume tiers.** With no quote path, the displayed
   "12+" price has nowhere to land.
3. **Tax exemption cannot work today.** Checkout builds an anonymous Shopify
   cart (no `buyerIdentity` / `customerAccessToken`); Shopify applies exemption
   to a *customer record*. Needs Shopify customer accounts, a logged-in
   checkout, and a Clerk-org ↔ Shopify-customer bridge.
4. `taxExempt` on `portalAccounts` is a bare boolean — no document, permit
   number, issuing state, expiry or approver. Certificates expire; a boolean is
   the wrong model. Authority is **CDTFA**, not the Franchise Tax Board.
5. Compatibility logic exists in four places (`fitments`, `componentUtils`,
   Grace tools, `products.getCompatibleFitments`). Pick one canonical source;
   do not write a fifth. Root cause is `fitments.components: v.any()`.

## Regenerating the canvas

These `.dc.html` files are the source. The seeded 2.6 MB `wholesale-matrix.html`
is a build artifact and is intentionally not committed — regenerate it with the
`design` skill's `seed-canvas.mjs`, passing each artboard and `canvas.json`,
then publish that file as the Artifact.

Content note: bracketed values (`[PERMIT NO.]`, `[BUSINESS NAME]`) are
deliberate placeholders for real records. Family names and counts came from the
real catalog but **must be derived from Convex at build time**, never copied
from these mockups.
