# Cylinder source recovery and remaining work

Latest plate result: [436 completed local Cylinder plates](2026-09-04-cylinder-plates-complete.md). The earlier counts below are retained as batch history.

Follow-up to the September 4 batch. This corrects the interpretation of the
initial 40 `no-psd` matches. A failed exact filename match is not evidence that
a bottle image is absent. The master inventory contains 6,073 files (5,934 PSDs);
the original Cylinder pass selected 829 PSDs by scope and naming.

**Source scope clarified by Jordan:** the master folder and legacy Best Bottles
website together are the complete source set for this work. Reconcile, retrieve
and extract from those sources; do not turn a filename or layer-matching failure
into a request for replacement artwork.

No catalog, production media, master originals, or deployed code changed in this
follow-up. The local accepted-plate count remains 326 of 399; recovering a source
does not automatically qualify a plate or a kit. The CSV companion lists all
73 held plate records with the new source disposition and next action.

## Breakdown of the original 40 unmatched filenames

| Records | Finding | Remaining action |
|---|---|---|
| 3 | Exact legacy flip-top assets downloaded and visually checked | Add an explicit legacy-source exception and render complete-product plates |
| 4 | 28 mL roll-on master files found; exact live legacy pages link these alternate image basenames | Review/promote the source crosswalk, verify exposed roller layers, render |
| 8 | 25 mL assembly candidates found under 30 mL filenames, including a folder named Cylindrical 25ml | Establish identity by direct photograph/measurement comparison; do not infer an alias from the folder |
| 24 | Exact legacy short-cap assembly images recovered through SKU-specific option records | Prepare source-backed plates; inspect master layers and downloaded cap references for kit extraction |
| 1 | `GBSpry1ozGl` exact assembled gold source recovered from its legacy product page | Prepare plate and compare metal-decoration master layers against the complete assembly |

These categories total 40. **All 25 formerly unlocated assembly images have now
been recovered from legacy.** The download includes 25 exact-SKU assembly images
and six cap reference images: all 31 returned HTTP 200 and decoded successfully.
The assembled images were visually reviewed in a labeled contact sheet. The
25 assembly URLs are distinct and were obtained from exact product/option
evidence, not guessed from SKU strings. Sources and hashes are recorded in
`2026-09-04-cylinder-legacy-assembly-sources.json`.

This resolves image location, not kit readiness: a flat assembled photograph
does not establish separable body, cap or insert layers. The accepted local plate
count remains 326 until source integration, registration and verification run.

## Downloaded flip-top originals

All nine files returned HTTP 200 and decoded successfully. Original bytes,
source URLs, retrieval timestamps, dimensions and SHA-256 are recorded in
`legacy-fliptop-sources/manifest.json`. Larger views are 360 × 480; listing PNGs
are 300 × 400. All are static, single-frame images. Two 4 oz `.gif` URLs actually
contain PNG bytes; the manifest records both HTTP type and decoded format.

| SKU | Exact product page | Assembled source view |
|---|---|---|
| PbClear4ozFlpWh | https://www.bestbottles.com/product/cylinder-design-4-oz-plastic-bottle-white-flip-top-cap | images/store/capped/PbClear4ozFlpWh.gif |
| PbClear8ozFlpWh | https://www.bestbottles.com/product/cylinder-design-16-oz-plastic-bottle-white-flip-top-cap | images/store/aerial/PbClear8ozFlpWh.gif |
| PbNat16ozFlpWh | https://www.bestbottles.com/product/cylinder-design-8-oz-plastic-bottle-white-flip-top-cap | images/store/capped/PbNat16ozFlpWh.gif |

The `enlarged_pics` views show the cap beside the bottle. They must not be used
as assembled front plates. The 8 oz and 16 oz URL wording is reversed relative
to each page's exact SKU. The 4 oz page specifies 114 mL, while the batch snapshot
uses 118 mL; retain this as a catalog conflict rather than silently changing it.
These three products need plates, not interchangeable component kits.

## Verified 28 mL filename lineage

The four exact legacy product pages were freshly retrieved with Firecrawl.
Each identifies the catalog SKU and directly references the matching master
basename in both capped and uncapped image URLs:

| Catalog SKU | Master image basename |
|---|---|
| GBMtlRoll28Blk | GBCyl28MtlRollBlk |
| GBMtlRoll28Wht | GBCyl28MtlRollWht |
| GBRoll28Blk | GBCyl28RollBlk |
| GBCyl1ozRollWht | GBCyl28RollWht |

Sources are in `13. 16 mm/1. 28ml Capped` and `13. 16 mm/2. 28ml  Uncapped`.
The candidate composites were visually inspected. This establishes naming
lineage; it does not replace full layer and rendered-kit validation.

## Other source and render holds

- **22 roller-material source mismatches:** current proposed sources are named
  for metal-roller SKUs while target catalog SKUs specify plastic rollers.
  Verify each PSD's actual plastic roller/insert layers and cap-off state.
  A closed cap can conceal the wrong roller in an otherwise matching composite.
- **Three copy-suffix sources:** compare source hashes, photograph state and
  exact product identity before accepting the copies.
- **Two 4 mL spray variants:** assembled views exist in master, alongside views
  with caps beside the bottle. Visual inspection found valid assembled
  candidates; source selection and registration must be corrected and rerun.
- **Two white vintage-bulb assemblies:** `GBCyl50AnSpWht` and
  `GBCyl100AnSpWht` PSD previews show complete assemblies. Review why state
  classification rejected them; this is not missing artwork.
- **One silver decorative spray:** `GBSpry1ozSl` has source views, but its
  bottom metal base is separate in the inspected previews. Reconstruct only
  after checking actual source layers and assembled reference evidence.
- **Two registration failures:** `GBCyl100AnSpTslBlk` and
  `GBCyl100AnSpTslRed` need render alignment work, not new sources.
- **Seven known clear 5 mL capacity conflicts:** remain a separate catalog
  reconciliation dependency. They overlap the source holds; do not add counts.

## What component-layer verification actually requires

This is implementation work, not a request for Jordan to inspect Photoshop.

1. Identify the real bottle body, roller/insert, pump, collar, overcap and cap
   layers. Exclude unused alternative materials and retouch patches explicitly.
2. Verify SKU-specific material, profile, finish, texture and color against exact
   product evidence. Do not shorten a regular cap to manufacture a short cap.
3. Check masks, transparency, blending and edges at actual rendering resolution.
4. Keep body position and scale consistent when components change; verify both
   assembled reconstruction and the exposed parts in cap-off/exploded views.
5. Link each reusable part to the correct catalog component and valid assembly.
   Sharing a thread or similar photograph is not enough to establish identity.
6. Validate generated assets and exact-SKU selection on the mobile PDP before
   publishing. Photo-layer kits are not 3D geometry.

Any remaining identity conflict should be documented against exact source
evidence. Continue source matching and extraction within the confirmed source
set. Current priority: integrate recovered flip-top and short-cap assembly
sources, review the four proven filename crosswalks and available view candidates,
then resolve 25/30 mL identity and extract the verified component layers.
