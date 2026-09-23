# Catalog availability and Shopify activation audit

Verified September 22, 2026 PDT against `bestbottles-1580.myshopify.com` and
`https://precise-raccoon-123.convex.cloud`, serving the shared Best Bottles staging site.

## Result

All **2,476 current catalog variants** have exact Shopify SKU and variant-ID matches,
ACTIVE and Online Store-published parents, `availableForSale: true`, and website
`shopifySellable: true`. Their website labels are now either `In Stock` (2,392) or
`Available to order` (84). No current catalog variant is labeled Out of Stock.

**28 website labels were corrected** from Out of Stock to Available to order:
eight clear 5 mL Cylinder sprays and twenty amber 9 mL Cylinder rollers. The user's
request to make current products active/orderable authorizes this correction.
Fresh Shopify orderability is the evidence; this wording does not assert a physical
warehouse quantity. This follows the separately recorded 18 clear 5 mL roller fix.

No Shopify activation was necessary for these current variants. No inventory
quantities or policies were changed. All current catalog variants have inventory
tracking disabled; zero quantities therefore do not block their checkout.

## Exceptions remain explicit

The full store contains 366 parent products and 2,634 variants: 353 parents ACTIVE
and 13 DRAFT. All 13 drafts fail exact current-catalog identity checks. Six draft
parents (eight variants) are superseded duplicates of current active checkout
variants, including the old white-glass import names. Seven parents (45 variants)
have no current catalog SKU match. They remain draft; this is not a claim that
every historical Shopify object has been activated. See [exact exceptions](draft-exceptions.json).

Two retired Bell aliases retain Discontinued, two reference-only vial plugs have
no checkout variant, and an HMAC test row has an invalid Shopify link. The only
tracked/unavailable Shopify variant is `TEST-SVC`, a test item outside the current
catalog. None of these were changed. Existing active parents also have unmatched
legacy sibling variants; they are preserved and recorded in the complete audit,
not certified as current catalog products.

## Verification and receipts

- [Final summary](verification-summary.json) and [2,476 exact SKU checks](verified-current-catalog.json).
- [Guarded dry-run plan](stock-label-plan.json) and [applied receipt](stock-label-receipt.json).
  The existing `catalogRestore.restoreProductFields` mutation applies only if each
  stock label still equals its before-image. All 28 complete product after-images
  match the expected record, with only stockStatus changed. Reversal entries are
  included and also compare against the expected new label.
- Compressed whole-store/catalog before and after snapshots; uncompressed hashes
  appear in the final summary. No credentials or customer data are included.
- Actual shared-site PDP for `GBCylAmb9MtlRollWht` displayed Available to order.
  It entered the cart at 100 units × $0.66 and reached Shopify checkout with the
  same exact SKU, quantity and $66 total. No contact/payment fields were entered
  and no order was placed. The website cart was empty after checkout handoff.
- This is one end-to-end checkout smoke check, not 2,476 browser checkout tests.
  Component geometry, image quality and the remaining artwork backlog are separate.

## Reproduce the read-only audit

Supply `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_TOKEN` through the
approved environment; do not paste credentials into logs or reports.

```sh
node scripts/audit_shopify_catalog_state.mjs --out /tmp/bb-catalog-state
CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_shopify_sellability.mjs --out /tmp/bb-linked-sellability
```

The whole-store query was validated against Shopify Admin GraphQL 2026-07 before
execution. The read-only script deliberately requires an output directory so
historic audit snapshots cannot be overwritten by default.
