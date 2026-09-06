# Catalog empty hero integration

Prepared on `codex/catalog-empty-heroes` from main `54c2c148`, in an isolated checkout. Existing cap-option rails, glass swatches, exact-photo corrections, and exploded-view return controls are preserved. No Shopify or Convex mutations are part of this change. Production publication requires a separate merge/release decision.

325 exact-SKU hero images cover 305 product groups. Catalog and guided-finder cards link to the pictured SKU; desktop and mobile PDPs resolve the selected SKU's image. The mobile purchase thumbnail uses the committed SKU's hero. No hero is borrowed from another finish. Existing product imagery remains available when there is no registered hero or an image fails to load.

Images are static and empty, retaining original scene proportions and reviewed family framing. Filled-hover images are no longer loaded by these catalog surfaces. Atomizers use the corrected capped/uncovered/loose-cap scenes, including the corrected plain gold 10 mL and black skinny pump/band. Original generation files remain untouched. WebP delivery files are 1560 × 1716, with content-hashed filenames, totaling about 21 MB.

## Held revisions

Nine candidates retain their existing product imagery:

- Alu65mlLotionPumpBlack
- Alu65mlLotionPumpWhite
- Alu500
- GBSlm30SpryMtGl
- GBSlm30RdcrShnGl
- GBSlm50AnSpGl
- GBSlm50AnSpTslWht
- GBSlm50SpryMtGl
- GBAtom5Red

The first eight retain a Revise vote. The red 5 mL Atomizer exceeds the approved master width tolerance.

## Source records

`catalog-hero-integration.json` records every mapping, original source identifier, original and delivery hashes, framing, and held reason. A read-only configured Convex snapshot contained 380 groups and 2,540 products; all 325 website SKUs resolved uniquely to the intended group and family. Source paths are portable lineage identifiers, not URLs served by the application.

The preparation script is an offline export tool for the original image-production workspace. It requires its local review manifest, review votes, Atomizer measurements, catalog snapshot, and generated masters; these working files are intentionally excluded from the PR. Application builds and tests use only the checked-in delivery assets and registry.

## Validation

- Full TypeScript check passes in the clean checkout, with no archive exclusions.
- Repository lint passes with existing warnings and no errors.
- Full unit suite passed: 1,391 tests, seven optional tests skipped. One existing test timed out during a concurrent build/test run and passed in the final full-suite run after the build completed.
- Production Webpack build passes. Webpack is used locally because the dependency directory is symlinked; CI installs dependencies normally.
- Desktop browser checks: Atomizer catalog, corrected gold 10 mL PDP, Elegant and Sleek cards; exact pictured-SKU catalog links and loaded delivery images confirmed.
- Mobile at 390 × 844: corrected gold hero loaded, document width remained 390 px, previewing Black and confirming it selected the exact black hero.
- Cylinder 25 mL matte-gold fine mist: Photo → Exploded → Back to photo returns to the exact empty hero, with no filled image mounted.
- Browser findings corrected and rechecked: remove the duplicate swatch buttons while preserving the cap-option rail; the mobile purchase thumbnail now loads the exact gold hero.

The earlier disk-space blocker was resolved by clearing disposable package caches. The original working directory and parallel preview servers remain untouched. Local verification does not establish production publication or reapprove the nine held images.
