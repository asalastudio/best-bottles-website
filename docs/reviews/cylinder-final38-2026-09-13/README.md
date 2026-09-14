# Cylinder final plate release — September 13, 2026

The final 38 Cylinder cap-on/cap-off pairs are released and indexed on the development catalog used by localhost:3040. Cylinder’s plate lane is **436/436 complete**, with zero holds, review items, missing plates, or pending releases. Boston Round remains 123/123. This is not a claim of production media deployment or kit/hero completion.

Jordan’s recorded instruction is: “These all need to be released and indexed. We already clearly approve them.” `ship-authorization.json` binds that instruction to the existing approval lock and exact release manifest. The earlier visual decision and immutable lock remain unchanged; their historical `publicationAuthorized: false` fields describe the earlier approval stage, not the subsequent ship instruction.

## Exact release evidence

- `prepared-v2.json`: immutable same-zoom review packet, SHA-256 `b26271bbda3fe698e4134e459b3ac6ede866843157f17de13e0f3a35ba3cc89b`.
- `approved-lock.json`: Jordan’s saved 38-pair approval and the 27 explicitly accepted original-photo source bases.
- Staged manifest SHA-256: `d582ba68ec391fc044192936d6e4ff81a0175fffa5f20151ffc275123208ccf0`. Exact staged files are preserved in `../../releases/boston-cylinder-2026-09-13/`; do not restage them.
- `ship-preflight.json`: exact product identities, original index rows, and all affected group records before publication.
- `publish-output.txt`: 38 index rows written, zero skipped, zero conflicts, zero errors. The full-size approved images are reused as thumbnails without introducing new image bytes.
- `published-verification.json`: 76 hosted views return HTTP 200, match the approved SHA-256 and byte count, and measure 1000 × 1100. Both website SKU and Grace SKU resolve the same assets. All 10 family records and every unselected row are unchanged.
- `registered-approvals.json`: registration of the existing visual decision against the indexed family-sheet bindings; all earlier decision keys and history are preserved.
- `ledger-after-release.json` and `ledger-final.json`: measured accounting after release and after registration.

## Counts

Before release, Cylinder had 398 complete and 38 approved awaiting release; the global plate plan had 686 complete, 38 awaiting release, 431 review, 639 reconcile, and 511 missing, out of 2,305 applicable catalog rows.

After release, Cylinder has 436 complete and zero remaining plate work. Global counts are 724 complete, zero awaiting release, 431 review, 639 reconcile, and 511 missing. Each recount runs `python3 scripts/asset-ledger/measure-plates.py` followed by `npm run ledger:build`.

## Source and approval boundaries

24 plain short-cap pairs keep their approved original fronts and use bare-glass layers from four master PSDs for cap-off views. Six sprayer pairs and five roller pairs use the reviewed master-source evidence. Three plastic flip-top pairs retain the exact original product-page photographs, including the original-resolution cap-off views. Source mappings come from verified catalog/product-page evidence, not inferred filenames or SKU strings.

The 27 accepted legacy source bases remain explicitly labeled `plated-approved-legacy-source`. No master path or PSD hash is fabricated. The five old sizing findings are retained in `resolvedFindings` with the final reviewed binding; this release does not create new shared glass-height locks. No rendering, component fabrication, or shadow edits occurred during publication.

Completion is restricted to this exact approved packet, immutable manifest, release authorization, verified index, and current hosted image hashes. Changed views, catalog identities, source evidence, newer rejection decisions, missing measurements, or new technical holds cannot inherit completion.

Kits and heroes remain deferred. Five older kits correctly became stale when their plate fronts changed; no kit was republished or falsely marked current.

## Verification commands

With the development environment loaded, `verify-cylinder-final38-release.mjs --after` rechecks every indexed view and catalog identity. `register-cylinder-final38-approvals.mjs` records the already-approved bytes on the current family sheet; it does not request or invent a new human review. Restore the unchanged staged manifest from the preservation archive if running these release tools in a fresh checkout. Ledger verification can also read its frozen archive copy directly.

Desktop/mobile runtime checks and the same-zoom ledger comparison are in `../cylinder-ledger-release-state-2026-09-13/`. The local review endpoint remains development-only.
