# Cylinder plates — completed local batch

September 4, 2026 (Pacific). **436 exact-SKU front plates are prepared and validated locally.** This is completion of the assembled front-plate batch, not a catalog migration, kit release, or production deployment.

## Results

| Deliverable | Count |
|---|---:|
| Existing production Cylinder records covered | 399 |
| Additional exact live legacy SKUs covered | 37 |
| Completed assembled front plates | 436 |
| Front thumbnails | 436 |
| Previously validated cap-off plates retained | 272 |
| Cap-off thumbnails retained | 272 |
| Output assets decoded and hash-checked | 1,416 |
| Master-derived front plates | 385 |
| Exact legacy-raster front plates | 51 |
| Front plates still waiting for a source or rendering | 0 |
| Records or hosted assets changed | 0 |

326 previously validated master plates were retained. The remaining 110 were rendered from 59 visually matched master composites and 51 exact legacy images. All original source files remain untouched. The 51 raster sources retain their native-resolution limitation; a 1000 × 1100 canvas does not create additional photographic detail.

## How scope was established

Production and development catalog projections were refreshed read-only. All 399 production Cylinder SKUs were matched to fresh exact legacy product or option responses. Firecrawl retrieved both the full Cylinder search and Jordan's 25 mL search; 313 additional listing/product/option responses were checked, with no retrieval errors. Options were parsed from the response's explicit SKU, never inferred from the image filename.

- [Cylinder search](https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=cylinder)
- [25 mL search supplied by Jordan](https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=25ml)

The live search includes adjacent families. Existing family assignments and direct descriptions were used to record exclusions rather than importing everything containing the word Cylinder. The resulting union contains 436 unique exact SKUs. All 436 chosen legacy reference images downloaded successfully and decoded. The source inventory preserves all linked gallery views, including alternate and measurement views; it does not mistake each view for an assembled front plate.

The **37 extra SKUs are all 25 mL assemblies**: four sprays, three droppers, nine bulb sprayers, nine tassel sprayers, and twelve reducer/cap assemblies. They are absent from both refreshed environments by exact and case-insensitive website SKU. There are no production `Cyl30` website-SKU records to reassign automatically. Their master counterparts were found under historical `30ml` filenames in the 25 mL artwork tree and matched visually against exact 25 mL legacy evidence. This establishes media lineage; it does not authorize creating duplicate or guessed catalog records.

`GBcyl25SpryCu`, shown in Jordan's screenshot, is included as the 25 mL clear Cylinder with matte copper spray pump.

## Rendering and verification

The local completion adapter accepts either a validated earlier plate or a reviewed source plan. It verifies exact SKU evidence, source-page hashes, physical source-root containment, source hashes, and direct source links for recovered legacy images. Alternate master filenames require explicit match evidence. It preserves the Photoshop merged composite rather than inventing a layer combination.

New fronts use proportional scaling and translation on a 1000 × 1100 canvas. Framing is shared within the reviewed bottle/application group. Hanging bulb assemblies use reviewed bottle regions so a tassel cannot be mistaken for the bottle base or width. The previously rejected black and red 100 mL tassels now have complete, unclipped renders. This reviewed anchor method is distinct from the earlier automated registration residual check; no claim is made that the rejected sources passed that earlier algorithm unchanged.

Validation completed:

- 436 unique SKUs, each with exact source-page evidence and a front plate/thumbnail.
- 1,416 outputs decoded with expected dimensions, byte lengths, and SHA-256 values.
- All 110 newly rendered fronts passed the body-axis and safe-margin checks.
- All 28 family contact sheets inspected; all 110 recovered-source references inspected, plus master/legacy comparisons for all 59 selected alternate or recovered master sources.
- 21 Python tests passed, including identity/link/hash guards, source containment, hanging-tassel body framing, clipping, and existing kit checks.
- Nine Node source-lineage tests passed.
- The local gallery opened successfully in the Codex browser. This is not a deployed PDP, cart, Grace, or mobile-device acceptance test.

No new cap-off views were fabricated. Retained cap-off assets preserve their prior provenance. Kits and exposed-part extraction remain a separate stage.

## Catalog and release items kept separate

45 rows carry known catalog release blockers; counts overlap where stated:

1. **37 legacy-only 25 mL SKUs:** reconcile/create their exact catalog records through the catalog approval workflow, preserving existing identities and checking related records before insertion.
2. **Seven clear capped 5 mL SKUs:** production still carries 5.5 mL. Their plates use the approved 5 mL identity while retaining record IDs and documenting the unmodified catalog value.
3. **`PbClear4ozFlpWh`:** legacy says 114 mL while production/group naming says 118 mL. The existing grouping key was retained and the conflict remains explicit.
4. **`GBCyl25AnSpTslRed` (already among the 37):** its exact SKU, red photograph, and master source conflict with “white” in the option description. The plate uses the verified red photograph; the text conflict remains a reconciliation item.

These are media-related findings, not a claim that all other commercial fields across the catalog are clean. Refresh pricing, availability, catalog associations, and hosted-source readiness before release. No production IDs, Shopify references, routes, source files, or backend modules were changed.

## Files and repeatability

The complete local batch is `dist/paper-doll/cylinder-complete/`:

- `plates/manifest.json`: all SKU, source, framing, asset hashes, and release receipts.
- `review/index.html`: searchable plate/legacy-reference gallery.
- `review/plate-status.csv`: one row per SKU.
- `review/validation.json` and `review/visual-review.json`: asset and visual-review receipts.
- `source-plan.json`: reviewed inputs and reusable baseline references.
- `evidence/`: refreshed projections, exact HTML responses, listing scope, linked-view inventory, and download receipts.

A durable copy and downloadable ZIP are also placed in this task's visualization folder. Generated images and raw evidence remain outside Git; the per-SKU status, compact source/output receipt, renderer, tests, and instructions are committed for review.

```bash
python3 scripts/paperdoll/complete_family_plates.py \
  --plan dist/paper-doll/cylinder-complete/source-plan.json \
  --batch dist/paper-doll/cylinder-complete
python3 -m unittest discover -s scripts/paperdoll/tests
node --test tests/paper-doll-source-lineage.test.mjs
```

The source plan and preserved baseline are required inputs. This command performs no network requests or publication. Its outputs deliberately remain `publishable: false` until the source adapter and catalog release are approved and integrated.

## Next stage and rollback

Review the plate gallery, reconcile the isolated catalog blockers, then connect the reviewed source adapter to the publication lane. After authorized publication, validate hosted URLs and exact-SKU selector/specification/cart/Grace behavior on the intended deployment. Proceed with kits separately using verified component layers; matching assembled photographs does not prove exposed-part identity or physical compatibility.

Rollback is local: discard the new batch or revert this completion commit. The previous `cylinder-master` batch and all original master assets are intact. No production rollback is required. Before a future publish, snapshot the current media index and retain a SKU-scoped index restoration plan.
