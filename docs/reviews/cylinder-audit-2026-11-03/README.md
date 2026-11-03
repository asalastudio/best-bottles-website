# Cylinder product page audit, 2026-11-03

Environment: local development server at localhost:3010, branch `codex/cylinder50-roller-and-25ml-spray-tubes`. These results do not establish production behavior or production performance.

The Cylinder catalog listed 54 product entries. A browser pass visited every listed route and captured available component views. Separate swatch checks selected 384 finish controls; their active state changed successfully. The 3.3 ml, 4 ml and 5 ml amber Tulip routes needed a manual retry after browser navigation or protocol timeouts; the retry confirmed their canvases, controls and three view buttons, but did not repeat every swatch selection. Cobalt and swirl 9 ml lotion routes timed out initially and loaded on the later swatch pass. The 28 ml roller was also captured on the later pass after an initial detached-element error. Visual inspection of the default canvases was performed using contact sheets and selected full-size views; it is not a visual sign-off of every finish in every view.

## Findings

- The `30 ml Clear Cylinder Bottle with Cap` catalog entry (`GBSpry1ozGl`) renders a gold sprayer and a gold-colored base on its product canvas. The displayed assembly conflicts with the bottle-with-cap title and needs SKU and artwork reconciliation.
- Before the framing change, the 25 ml tassel was clipped in the catalog and on its product page. The 50 ml and 100 ml catalog tassels were clipped on the left. The revised desktop catalog shows all three assemblies, and the 25 ml product-page tassel is visible end to end. The catalog was also checked at 390 px width.
- In one concurrent local development pass, the time to the initial product canvas exceeded two seconds on 16 of 49 completed checks. Two initial navigation requests timed out and later loaded. This is not a production benchmark: compilation, concurrent requests, network dependencies and browser caching affect these results. Measure hosted production or a production build under defined mobile network conditions before asserting a two-second target.
- The offline media-gap inventory was based on saved snapshots and was not used to claim current coverage or broken assets.

The dip-tube appearance and exact mechanical seating still need individual full-size review for each relevant finish and view. Swatch selection confirms the control state, not that every selected image and SKU association is correct. No checkout or production changes were made during this audit.
