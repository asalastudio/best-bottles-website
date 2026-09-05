# Cylinder plates and photographic kits — production release

This release follows Jordan's authorization to finish the Cylinder media, reconcile the associated catalog, and publish production. Minor photographic alignment differences are allowed; incorrect SKU identity, cap finish/profile, or roller material are not.

## Scope and release boundaries

The verified live-legacy scope is **436 assembled Cylinder SKUs**, including 37 previously missing 25 mL assemblies. All 436 front plates and thumbnails are indexed in both Convex environments. The 272 existing cap-off images and thumbnails retain their original source provenance.

The kit release targets **420 photographic kits**. Three plastic flip-top SKUs are standalone products without interchangeable kits: `PbClear4ozFlpWh`, `PbClear8ozFlpWh`, and `PbNat16ozFlpWh`. Thirteen exact-SKU plates remain available while their layered reconstruction is held: `GBSpry3mlClBlk` (merged master preview differs from the physical layers) and `GBCyl9SpryShSl` (Photoshop adjustment-layer reconstruction does not pass review). Eleven additional plastic-roller kits are held for visible white neck retouch artifacts; their exact SKUs are listed in the release ledger. Do not represent held rows as completed kits.

These are photographic layers, not 3D geometry. Some closures remain whole photographed assemblies, such as droppers, bulb/tassel mechanisms, and reducer fitments. No hidden insert or independent component is invented. Reducer assemblies do not expose an unverified independent cap-off mode. A kit does not create a separately sellable component or prove cross-family physical compatibility.

## Catalog changes

- Production: 68 existing product patches, 37 inserted products, seven group patches, four new groups in the initial guarded reconciliation.
- Development: 56 existing product patches, 61 inserted products, seven group patches, five new groups. The additional development insertions include 24 production assemblies missing there; production did not receive duplicates.
- Both environments: 48 further cap-label corrections backed by exact legacy descriptions and reviewed cap photographs. Bottle-color values such as Clear and Frosted no longer masquerade as cap colors on these records. Where descriptions omit dots or ribbing, the exact photo evidence is recorded.
- The 20 clear/cobalt 5 mL capped SKUs retain their existing production identities and now use the same ten approved choices, with Short/Regular, Shiny/Matte, and Ribbed distinctions preserved. The clear capped family is grouped as 5 mL; necessary old routes redirect.
- Corrected the three confirmed image references, the plastic flip-top classification and 114 mL legacy measurement, exact-SKU measurement discrepancies, and the verified red 25 mL tassel description conflict. Measurements were applied only to the exact SKU supported by the recorded source.
- Both environments: 38 verified 25 mL assemblies are marked “Available to order” after matching public Shopify variant IDs, website/Grace identities, and prices. No inventory quantity is inferred. This resolves the empty-status quote-only gate.
- Created five Shopify products containing 38 verified 25 mL variants (37 newly added assemblies and the previously unlinked black spray). Published to the Online Store using the existing authorized `write_products` scope. All 38 public product variants returned available with the verified unit prices before linking them to Convex.

The committed JSON plans preserve before-values, proposed values, source evidence, and insertion payloads. Existing record IDs and valid Shopify links are guarded against reassignment. No original master files or legacy assets were modified.

## Media and UI behavior

Physical PSD layer roles were reviewed by pixel hash. Exact uncapped sources supply missing pumps and plastic rollers. White Photoshop repair cards are excluded where the physical source permits it; eleven visibly affected plastic-roller reconstructions remain held. The 24 short-cap kits preserve the exact legacy cap photo and use only the verified same-bottle master neck underneath it. Two decorated 30 mL bottles use exact capped/uncapped legacy photo pairs.

Kits resolve by exact website SKU before aliases. A kit with a different plate SHA is withheld, allowing the page to use its current photograph. Kit updates include anchors and other rendering metadata, not only image hashes. The exploded viewer fits the complete part stack into the canvas. Specifications show the exact website SKU and distinguish cap profile from measured height. The selected SKU supplies the kit; a previous selection's kit is not carried into a pending selection.

The standard assembled parity threshold remains unchanged. A separately recorded visual approval permits a mean error up to 12/255 and at most 8% of foreground pixels over 40/255 for the reviewed minor source-photo alignment differences. The original strict result is retained. This allowance does not approve a wrong component or an exposed Photoshop patch.

## Validation

- Production frontend compiled and built successfully with webpack. Turbopack's local worker was blocked by the sandbox; this was a build-environment issue.
- Full unit suite: **934 passed, seven skipped** (134 passing test files, two skipped).
- Repository lint excluding ignored local `tmp/` review scripts: **zero errors**; 49 existing warnings. Unfiltered local lint sees the earlier temporary browser scripts; they are not shipped.
- Local mobile production-build pages returned 200 with no browser runtime errors. Metal-roller cap-off, 25 mL sprayer layers, held-kit photo fallbacks, standalone flip-top behavior, and desktop exploded rendering passed. Detailed post-publication selector, kit, cart, and source checks are recorded in the release verification artifacts.
- All 436 exact SKU routes passed in each environment; all existing IDs and valid Shopify links were preserved. The publisher verified 1,416 plate assets and 1,105 kit assets.
- The publisher checks the delivered public bytes against each SHA-256, along with status, content type, length, CORS, and cache headers before indexing.

Deployment and final hosted-kit results are recorded separately in `release-summary.json`; a successful local build alone does not establish a deployed release.

## Reproduction and evidence

Working batch: `dist/paper-doll/cylinder-release/`. Required upstream plate plan and retained baseline: `dist/paper-doll/cylinder-complete/` and the baseline root recorded in its `source-plan.json`.

- `backup/`: timestamped pre-release products, groups, plate rows, kit rows, media families, and Shopify product/variant snapshot.
- `all-reviewed-layer-roles.json`: explicit physical role decisions keyed to original layer pixel hashes.
- `kits/`: immutable component WebPs, per-SKU source/part receipts, and the reviewed publication manifest.
- `kit-visual-review/`: assembled and uncapped contact sheets, including every visual exception and each distinct family/part arrangement.
- `*-publication.json` / `*-payload.json`: exact hosted URLs, delivered hashes, and index outcomes.
- `*-final-verification.json`: per-SKU exact identity, route, kit/plate association, and preservation checks.

Use `build_reviewed_family_kits.py`, `supplement_reviewed_kits.py`, the two exact-legacy kit adapters, and `review_cylinder_kit_semantics.py` with the saved source inventories. Publication uses `publish-reviewed-family.mjs` and requires an explicit Convex URL, storage credential, write token, and `--apply`. All secrets remain outside Git and reports.

## Rollback

1. Revert the release frontend commit/deployment if the UI regresses. Keep the two legacy cap-family route redirects while their canonical database slugs remain changed.
2. Restore only the affected SKU plate rows from the matching environment's `backup/*-productPlates.json`. Remove this release's newly inserted kit index rows if needed (the pre-release kit tables were empty). Leave immutable storage objects in place.
3. Reverse approved catalog fields using the recorded before-values with fresh compare-before-write checks. Do not delete or rename existing product IDs.
4. Before withdrawing any new Shopify or Convex assembly, check for intervening orders and references. Unpublish/archive the new products and mark unavailable as appropriate; never blindly delete ordered variants or overwrite established Shopify links.
5. If undoing the clear 5 mL regrouping, restore both group assignments and route handling together. Do not restore only one side.

No broad Convex restore, source-file deletion, or unrelated-family rollback is needed.
