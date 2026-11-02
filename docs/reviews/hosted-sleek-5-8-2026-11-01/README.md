# Sleek 5/8 ml approved master release

Publishes 72 approved 13-415 configurations: 36 per Clear body, with eight fine-mist sprayers, nine metal rollers, nine plastic rollers and ten pour caps. Every exact SKU uses the same registered image recipe in the catalog, product page and builder. Geometry, sizing targets and source pixels match the 144-configuration visual approval in `../cylinder9-sleek-13415-2026-11-01/visual-approval.json`.

Four approved body/tube assets were copied unchanged to content-addressed hosted storage; 33 previously hosted assets were reused and two existing remote cap sources were byte-verified. `asset-receipt.json` records all 39 public hashes. The combined manifest contains 434 configurations. Its earlier 362 recipes are preserved after the separately authorized eight Tulip Amber sprayer corrections documented in `../tulip-amber-seating-2026-11-01/`.

Local catalog verification covers all 72 selections on desktop and mobile, including separate metal and plastic roller scopes. `production-before/` captures twelve baseline cards. This release does not mutate Convex, Shopify, pricing, inventory or product identity. The 25 ml pilot remains outside this release.

Run the approved review's `prepare.cjs` before reproducing `scripts/paperdoll/publish-sleek-5-8-masters.mjs`. Without `--apply` the publisher only writes the upload plan. Hosted verification helpers accept `QA_ORIGIN`, `QA_OUT` and an optional private `QA_ACCESS_FILE`. `QA_NATIVE_ONLY=1` records unavailable preview-backend options as coverage gaps. Production verification requires all 72 native configurations.

CI, a hosted preview and production readback remain separate release gates. Approved body masters are already individually archived in the Sleek Approved folder in the Best Bottles Bottle Master Library.
