# Clear 5 mL Cylinder roller availability repair

All 18 existing clear 5 mL / 13-415 roller configurations were hidden by stale
`Out of Stock` labels: nine metal rollers and nine plastic rollers. Fresh exact
legacy product pages showed orderable products. Shopify checkout identities and
component records already existed.

Only these 18 `stockStatus` fields were changed to `Available to order` on
`https://precise-raccoon-123.convex.cloud`. No inventory quantity, Shopify identity,
price, compatibility relationship, kit, or hero artwork was changed.

- [Publication receipt](publication-receipt.json): exact before/after, patch and rollback.
- [Source checks](source-checks.json): exact SKU, URL, ordering evidence and source hashes.
- `source-html/`: gzip archives named by SHA256 of uncompressed source bytes.
- `before-audit.json.gz`: complete input snapshot.
- [Fresh served verification](served-verification.json): all 18 Builder candidates
  visible and all 18 PDP compatibility records resolve to the matching roller cap.

The shared staging Builder at
https://best-bottles-website.vercel.app/matrix?family=Cylinder was reloaded after
its five-minute family cache expired. Metal Roller and Plastic Roller each showed
nine cap options. Both assemblies were visually inspected. The plastic roller with
Matte Gold cap reached the review step with quantity 12, unit price $0.53 and an
Add to Cart button. No cart or checkout was submitted in this check.

This resolves 18 of the prior 45 disputed stock labels. It does not clear the
remaining 27 labels or the rest of the component artwork backlog. The previous
four-family ledger remains a historical snapshot taken before this repair.
