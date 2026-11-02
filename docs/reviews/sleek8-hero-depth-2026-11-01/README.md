# Sleek 8 ml shared hero dip-tube depth

The screenshot showed the seated mechanism and tube as an overlay over the glass. The approved hosted recipes still used z-order 2 and 62% opacity over body z-order 1, while the separate localhost glass-material review already placed the tube below the glass.

Eight exact Sleek 8 ml fine-mist recipes now share the same treatment in catalog heroes, product pages and builder: the body blends with multiply, and the seated mechanism/tube is below it at 40% opacity with multiply blending. This keeps the glass reflections above the internal parts. Natural plastic appearance remains unchanged in exploded view.

The approved body, tube, sprayer and overcap image pixels are unchanged. All image URLs and hashes, shape, scale targets, shoulder seating, tube width, bend and endpoint remain unchanged. The other 430 approved recipes are unchanged. The shared manifest is versioned 16625b508a08fa33 to invalidate the prior recipe cache. No new images were uploaded to the hosted image store and no database, Shopify, pricing or inventory records changed.

The regenerated Sleek glass candidate is a separate local review and still awaits visual approval. This correction updates the existing hosted recipes without promoting that glass candidate. The comparison uses the same existing approved body on both sides, isolating the tube-depth correction.

Reproduce the scoped metadata update with `node scripts/paperdoll/correct-sleek8-internal-depth.mjs` for a dry run, or add `--apply` to write the manifest and index. The script verifies all eight pre-correction recipes and the 430 preserved hashes before writing. `before-kits.json` supplies an exact-SKU rollback snapshot.

Review locally at `/reviews/sleek8-hero-depth-2026-11-01/index.html`. The source comparison is in comparison.ts. Browser verification checks all eight hosted API recipes, desktop/mobile catalog finish selectors, all three PDP views and builder depth. The patch is prepared in PR #388 and has not been merged or deployed.

Validation passed: 3,252 tests with 7 skipped, typecheck, scoped lint and syntax checks. Browser checks covered eight hosted API recipes, 48 desktop/mobile PDP states, 16 catalog finish selections, eight builder API recipes and two actual builder pages. An initial concurrent test run timed out in an unrelated DOM test file; that file passed independently and the full suite then passed with four workers.
