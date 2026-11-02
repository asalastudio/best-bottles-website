# 25 ml Clear Cylinder, 18-415 pilot

Current scope: 45 catalog configurations across six fitment types. Thirty-six recipes are prepared for local review. Nine tassel assemblies remain held because their current registered layer exceeds the fixed frame; the inspected black tassel layer also has a gold collar while its exact legacy product shows silver. No bottle was resized to conceal those issues.

The pilot preserves the recovered body pixels, source registration and native 18-415 top geometry. One 598,595-byte body master, SHA256 `def2dd2a9a634b65fda6e6733b2756b49cbe456fadbaaf090cbbfa666780b054`, serves all prepared variations. Its shoulder span is 46.5%, with a 91% baseline. Fresh legacy evidence confirms 83 ±1 mm bare height, 32 ±0.5 mm diameter and 18-415 neck. This pilot is a reuse and registration pass, not new image generation.

The sprayer and lotion-pump tubes reuse the previously approved materials with separate shaft widths and mechanisms. The sprayer shaft is visually registered at 1.1 mm and lotion shaft at 1.5 mm; these are presentation estimates, not newly certified physical measurements. Tubes stop above the source-image inner floor and remain attached in exploded view. Reducers remain assembled-only because the kits do not contain a separate exposed insert. Native dropper and plain bulb assemblies retain their supported views.

Verified: 65 current source assets captured and hashed; 18 capped/uncapped native master PSD files rehashed; 30 desktop/mobile representative product states passed, with zero browser errors. Tests cover the shared body/sizing, connected spray and lotion mechanisms, reducer view limits and local-only loading. The current catalog snapshot is not a claim of exhaustive live-legacy commercial reconciliation. Direct legacy evidence is saved for all six fitment categories; prices and catalog records were not changed.

The global ledger refresh measured 2,283 plates successfully, then its build stopped at an old 5 ml group-ID mismatch. `ledger-recount-status.json` records that historical guard failure. It remains unchanged; family-wide completion is not claimed.

Review: http://localhost:3010/reviews/cylinder25-18415-2026-11-01/index.html

Reproduce from the repository root:

```sh
node docs/reviews/cylinder25-18415-2026-11-01/prepare.cjs
REVIEW_DIR=docs/reviews/cylinder25-18415-2026-11-01 KIT_FILE=public/local-kits/cylinder25-18415-2026-11-01/kits.json CATALOG_FILE=docs/reviews/cylinder25-18415-2026-11-01/current-catalog.json REVIEW_TITLE='25 ml Clear Cylinder 18-415 Pilot' node --import tsx docs/reviews/cylinder25-18415-2026-11-01/build-review.mts
```

The source-media archive must be present to reproduce the hash checks. Body and tube files needed for local runtime are versioned separately. Vercel excludes the local pilot assets and localhost loader. Publication and visual approval remain pending.
