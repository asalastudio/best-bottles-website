# Tall Cylinder 9 ml, 13-415 shared hero release

Scope: 72 existing approved configurations, 36 Clear and 36 Frosted. Each glass has eight fine-mist sprayers, nine metal rollers, nine plastic rollers and ten pour caps. The catalog, product page and builder now resolve each exact SKU to the same registered body and component recipe. No new glass or component image was generated, and no catalog or Shopify record was changed.

The source is the exact 144-configuration visual approval recorded in `../cylinder9-sleek-13415-2026-11-01/visual-approval.json`. This release selects only the two tall Cylinder plate keys. Sleek remains outside this release. Jordan explicitly requested that all tall 9 ml Clear/Frosted variations appear on the hero grid in this chat on November 1.

The uploader checks the canonical approval recipe hash and scope hash, verifies every source against the approved image hash, reuses 33 previously hosted assets and copies four approved body/tube files to immutable content-addressed storage. Two existing remote ribbed-cap sources are fetched and byte-verified. All 290 earlier recipes remain unchanged; the combined shared manifest contains 362 recipes. The approved sizing, neck/shoulder alignment, roller seating and frosted tube opacity/blending remain unchanged.

Local catalog verification passed 144 selections across desktop/mobile, covering every exact configuration with unchanged body coordinates and view boxes during cap swaps. Existing catalog policy scopes cap choices to one roller material; the audit explicitly visits both `roller=metal` and `roller=plastic`. `production-before/` captures twelve same-viewport baseline cards before this release. Browser evidence is a scoped UI check, not a claim of full-family legacy reconciliation.

Publication assets and source approvals are recorded in `upload-plan.json`, `asset-receipt.json` and `release-manifest.json`. Hosted preview, CI and production verification remain release gates. The two registered body masters were already archived individually in the Cylinder Approved masters folder; this release reuses those exact bytes.

Local catalog: http://localhost:3010/catalog?families=Cylinder&search=Tall&threads=13-415

Reproduce: run the earlier review's `prepare.cjs`, then `node scripts/paperdoll/publish-tall-cylinder9-masters.mjs` for a dry run. `--apply` requires the existing Blob credential and release authorization. The script never overwrites or deletes hosted objects and never mutates Convex or Shopify. `verify-catalog.cjs` accepts `QA_ORIGIN`, `QA_OUT` and an optional private `QA_ACCESS_FILE`. `QA_NATIVE_ONLY=1` records preview-backend options that are unavailable instead of claiming those choices were tested.
