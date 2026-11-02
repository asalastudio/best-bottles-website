# 28 ml / 16 mm Cylinder correction

The previous 28 ml body had an incorrect narrow neck. This candidate uses the complete glass geometry from the owner's specified archive and a built-in GPT image edit for the glass material. The four existing 28 ml combinations now share this body on normal localhost product URLs, including the glass thumbnail, component section, cap rail and roller toggle.

## Source and geometry

- Original: `/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/13. 16 mm/2. 28ml  Uncapped/4.  GBCyl28RollWht.psd`.
- The body layer alone is incomplete. Layers 1, 2 and 4 supply the complete glass neck and shoulder. The source PSD is read-only and unchanged.
- `sources/source-lineage.json` records the original SHA-256, selected layers and glass viewport.
- Source product reference: GBCyl1ozRollWht, 28 ml, 81 mm without cap, 31 mm diameter, nominal 16 mm neck. The PSD's GBCyl28RollWht name is a source alias. It does not replace the catalog SKU.
- `generation.json` records the exact prompt and references. Built-in imagegen was used; its exact model version is not exposed.
- `28ml-body-registered.png` and `sources/28ml-body-archive-geometry-studio.svg` retain the complete PSD outer contour. Disconnected cutout debris is excluded and retouch-mask holes are filled. Generated material is uniformly projected within the neck and body regions, with a four-source-pixel native edge band. This is material registration, not a new measured model.
- `body-registration.json` records zero alpha differences against that cleaned native contour. The established 50.5% glass height and 91% baseline are retained.

## Exact scope

GBMtlRoll28Wht, GBCyl1ozRollWht, GBRoll28Blk and GBMtlRoll28Blk. Both cap finishes use the clean shared cap artwork. Both rollers use the approved shared 16 mm artwork, with the single bottom step, over-rim track and no protruding lower plug.

The same layers supply the component strip and metal/plastic swap controls. The strip describes the two roller types, without advertising sprayers, droppers or pumps for this set. The 44 px swap buttons use lossless 128 px delivery copies when available.

The separate 50 ml body and the other 105 local Cylinder recipes are unchanged. No catalog, pricing, Shopify or compatibility records are mutated. Existing standalone Builder eligibility is unchanged; the component strip is corrected without adding new orderable combinations.

## Verification and release state

`preservation-verification.json` checks the four changed recipes, 105 unchanged recipes, unchanged hardware image hashes and preserved canvas scale. `browser-verification.json` records the current desktop/mobile product-page checks for both sizes and all three views, including normal 28 ml URLs and the corrected component wells.

Local review only. The hosted approved manifest is unchanged. This folder is labeled REVIEW and must not be described as a production release or final visual approval.

Run extraction, registration and review preparation with the existing PSD interpreter, Node/Sharp and tsx environment. The scripts read the original PSD and preserve source lineage; generation itself is the built-in image edit recorded in `generation.json`.
