# Cylinder 9 ml / 17-415 lotion pumps and rollers

Local candidate library: **73cfb8f1df29**. New component artwork awaits Jordan's visual approval. The five previously approved body masters and all 30 fine-mist kits remain unchanged.

Review: http://localhost:3010/reviews/cylinder9-pumps-rollers-2026-11-01/index.html

## Changes

- **15 lotion combinations:** one regenerated white treatment-pump head, used with the existing Black, Gold and Matte Silver collars across Clear, Amber, Cobalt Blue, Frosted and Swirl. The original Photoshop layer and manufacturer photo guide the straight-sided head and larger dispensing aperture. The approved clear overcap and thin bent tube are reused. The lower tube remains hidden behind colored glass in assembled views and appears with the mechanism when exploded.
- **100 roller combinations:** two regenerated inserts, one steel ball and one plastic ball, sharing the same housing contour, flange and full press-fit plug. Each assembly now uses one complete insert. The older duplicate, elongated roller layer was removed from these local kits. The flange is registered to the bottle rim; the lower plug sits behind the glass when assembled. Existing ten cap finishes are preserved.
- **Motion:** the fixed-frame layout places the roller above the mouth and the cap beside it when exploded. The body never changes frame or position. Stable physical-layer React keys let the existing CSS transform transition run without remounting the body when a view-specific tube appears. Existing reduced-motion behavior remains in effect.
- **Delivery:** local SVG component envelopes bypass Next's image optimizer, which rejected them with HTTP 400. Raster optimization is unchanged.

Every product page, catalog preview and builder configuration resolves the same exact-SKU local kit. This remains development-only and disabled on Vercel. There were no database changes, storefront uploads, merges or deployments.

## Provenance and limits

The built-in GPT image editor created the white pump head, metal insert and plastic insert from existing component sources. Its exact model version is not exposed. No claim is made that these are verified Sunburst API outputs or Blender renders.

Raw PNG generations are preserved in `sources/`. SVG envelopes embed those pixels unchanged and use a smooth clip contour to suppress stray exterior alpha. This is display-layer cleanup, not a claim that the raw generation is free of fringe pixels. The two roller envelopes share one geometry contour and uniform registration scale.

A fourth generated lotion mechanism/tube was rejected for its glowing appearance and unsuitable chamber proportions. It is preserved but is not selected. The reused approved tube has a nominal visual outside diameter of 1.4 mm, approximately 52.3 mm visible length, and about 5.5 mm clearance above the outside base. These are visual targets, not measured manufacturer specifications. The lotion pump's internal chamber and the generated roller plug details still need comparison with physical samples; they are not certified manufacturing drawings.

Source references:
- https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-lotion-pump-black-trim-and-cap
- https://www.bestbottles.com/product/cylinder-design-9-ml-clear-glass-bottle-metal-roller-ball-white-cap
- Original 9 ml / 17-415 Photoshop files, paths recorded in `source-manifest.json`.

## Preservation and recovery

`before-kits.json` and `before-index.json` preserve the previous 145-SKU library and registry. `generation-and-reference-log.json` records prompts and source evidence. `sources/` preserves extracted source layers, original manufacturer photos, old registered inserts and all four raw generations.

From the repository root, run:

```
node docs/reviews/cylinder9-pumps-rollers-2026-11-01/build-components.cjs
```

This reconstructs the three immutable SVG assets, updates only the 115 lotion/roller kits, and restores the compact review model. It starts from the before snapshots. Do not run `prepare-sources.py` again after integration; that script captured the original snapshots.

`defects-and-changes.csv` lists all 115 affected SKUs. Before/after screenshots show the actual product stage. `browser-verification.json` records rendered desktop/mobile interactions and builder checks. Tests verify all 345 SKU/view layouts, unchanged body geometry, stable physical-layer identity, no cropped ink bounds, seated inserts, clear exploded separation and rigid pump motion.

This batch is saved as review candidates, separate from the previously approved Cylinder family Drive archive. It has not been represented as a new approved Drive master set.

## Initial batch checks (before the later seating revisions)

Typecheck passed. The full unit suite passed 3,169 tests, with seven skipped. Lint passed with zero errors. Actual browser verification covered 25 SKUs in all three views at 1440 px and 390 px widths (150 states), seven builder selections and 20 catalog selections. All passed. The remaining finish combinations are covered by the exhaustive 115-SKU registration checks, not a claim of individual visual approval.

The prior CI failure was a stale builder cache-version expectation, not a type error. That assertion now checks the current master version and passes locally. Production build status remains a separate CI check.

Shoulder-seating revision 2 lifts the lotion head, collar and fitted overcap together by 0.7 mm across all 15 lotion combinations. See `shoulder-seating-v02/` for the previous registry, close-ups and focused verification.

Roller perspective revision 2 replaces the tilted inserts with straight-on metal and plastic candidates. Both share a horizontal flange seated at the rim, with the previous uniform image scale preserved. Only the 100 roller configurations change. All 145 bodies, 15 lotion kits and 30 fine-mist kits are unchanged. Current verification and original snapshots are in `roller-level-v02/`.

Metal seating revision 3 lowers the complete metal insert by 4.49 canvas pixels (about 0.43 mm at the registered scale), to the existing neck seating datum. This closes the visible gap under the flange. The plastic insert and all bottle bodies are unchanged. See `metal-rim-seat-v03/` for the pre-edit registry, close-up and current checks.

Cap and plastic seating revision 4 lowers all 100 roll-on caps to the approved fine-mist collar contact line and aligns all 50 plastic inserts with the metal insert seating datum. Artwork and uniform scale are unchanged. See `caps-plastic-seat-v04/` for snapshots and checks.
