# Cylinder reducer picker follow-up

Production mobile review found all 36 18-415 reducer assemblies present (12 each for 25, 50 and 100 mL), but the 50/100 mL tall black and silver records shared capColor labels with the standard versions. This collapsed each larger bottle's picker to ten choices. The fallback component-photo matcher also reused the standard matte silver image for tall silver and returned no shiny black photograph.

Four exact records per environment now use the legacy-confirmed labels Tall Shiny Black and Tall Matte Silver. Existing IDs, Shopify links, routes and all other fields are preserved. The before/after receipt and current exact legacy URLs/hashes are in `cylinder-release-2026-09-04/reducer-label-corrections.json`.

The exact-SKU picker map adds 36 closure-only photographs from the already reviewed kit layers. These preserve all five faux-leather colors, white, shiny gold/silver, and separate standard/tall black and matte silver shapes. Source-hash allowlisting extends the repeatable crop generator to these external fitment photographs only. It does not invent or expose a hidden reducer plug or change kit geometry. All 36 new immutable assets passed public HTTP, content-type, length and SHA-256 verification and visual contact-sheet review.

Exploded-view spacing is unchanged at Jordan's request.

Validation: targeted thumbnail, catalog-write guard and selected-kit tests plus TypeScript. Deployed mobile verification is recorded separately after the preview is ready.

Rollback: revert the added thumbnail mapping/code commit to restore prior UI assets. To reverse labels, use each receipt's `set` as the compare-before-write expectation and restore `expected`, against that receipt's environment and record ID. No records were created/deleted and no asset keys were overwritten.
