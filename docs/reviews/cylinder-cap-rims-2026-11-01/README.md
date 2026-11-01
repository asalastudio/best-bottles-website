# Approved Cylinder cap masters

Owner approved the new 5 ml shiny caps and the ten 9 ml roll-on finishes on November 1, 2026. The 9 ml cap uses measured height 26.94 mm and diameter 19.19 mm, a shallow visible lid, and shared studio lighting. Both black finishes receive an sRGB gamma adjustment of 1.35 to deepen middle tones while preserving white highlights and alpha.

The 5 ml set covers sixteen pour and roll-on variants with short and tall shiny gold and silver. Matte, dotted and ribbed 5 ml caps retain their earlier artwork. The 9 ml set covers one hundred roll-on variants: five glass colors, two rollers and ten cap finishes. Original body images, glass scale and roller placement are unchanged. Caps center on the median visible barrel silhouette across all five glass colors.

Validation: typecheck passed; 60 desktop/mobile product states passed across ten finishes; 12 additional black-tone states passed; builder API matched all 145 shared 9 ml kits and two representative builder pages loaded the exact shared layers. Final centering checks and full suite results are recorded in the evidence files.

The cap PNG exports and generated sources are archived in the existing Best Bottles Bottle Master Library / Cylinder / Approved masters folder:
https://drive.google.com/drive/folders/1AiLytqR5PiNrQxOAL4MBAzu_yPBg4l8E

Generated originals and earlier kit backups are retained locally and in the archive as applicable. Only current runtime assets and compact validation records belong in this commit. No Blender source files are removed.

These local-review overlays remain development-only, following existing environment guards. Committing and pushing them does not activate the review overlays on production. Nothing is merged or deployed by this change.

Next visual queue: 3.3 ml and 4 ml clear sprayer ghost rims; Tulip metal/plastic roller fit; Tulip regrouping under Cylinder; separate lotion pump tube geometry. Hover zoom is deferred.

## Cross-surface image rule

Owner confirmed one approved bottle body per size and glass color for the catalog hero/grid, product-page layers and bottle builder. Line items and customer portal should consume that product group's default catalog-grid hero, retaining selected SKU details. PDP and builder layer sharing is verified here; catalog, line-item and portal consumption require a separate audit. Do not claim those paths are already aligned.

Final save checks: all 20 Drive image files were read back in the correct archive folder; full suite passed 3,188 tests, with seven skipped. Final black-cap alignment rerun passed all twelve desktop/mobile states. An earlier concurrent full-suite/browser run had one page timeout; its successful rerun is retained separately.
