# Bottle-bodies 3D — what is blocked and on what

State 2026-08-30: **1,143 GLBs built and dimension-validated** (671 round by
lathe, 472 boxy by extrude) from 1,345 QA-passing silhouettes.

## 202 SKUs skipped — they resolve to 5 bodies, not 202 problems

Every one has a live-published height and width, but no depth and no diameter,
so the shape cannot be classified from the catalogue.

### 159 SKUs: 4 boxy bodies, each needs ONE depth measurement

Confirmed rectangular from the product photography (sharp vertical corners,
flat faces). Depth is not published on the PDPs and a straight-on photo cannot
reveal it, so this needs a caliper or a supplier spec — recorded with its
source, never guessed.

| body | neck | height x width (mm) | SKUs unlocked | depth |
|---|---|---|---|---|
| Empire 50  | 18-415 | 88 x 37  | 47 | ? |
| Empire 100 | 18-415 | 107 x 46 | 44 | ? |
| Sleek 100  | 18-415 | 149 x 36 | 44 | ? |
| Sleek 30   | 18-415 | 98 x 28  | 24 | ? |

Once measured, add `depth_mm` to `bodies-3d-dims.csv` and re-run the build.

### 36 SKUs: Diamond 60 (2 oz) — SCULPTED, do not build here

`GBDmnd2oz*` is a faceted bottle: a diamond relief is pressed into the glass.
A silhouette describes the front outline only and says nothing about surface
relief, so this is the tier-3 case the plan defers to an outside modeler
against a supplier drawing or STEP/IGES. Mark `shape_class = sculpted`.

### 7 one-off SKUs
`GBSQSTBlue`, `GBSQSTGREEN`, `GBEternalFlameClear`, `GBTRDPClear`,
`GBTrdpBlue`, `PB1ozClearcap`, plus the two `*ClOvrCp` Elegant rows. Low value;
handle individually or leave.

## Silhouette QA residue (not blocking the built set)

Of 1,583 silhouettes checked against catalogue proportions: 1,345 OK,
121 `CAPPED?` (the layer fuses bottle and closure, so the trace is too tall),
117 `ASPECT` (off proportion for another reason). These were excluded from the
build, not silently accepted.

## Delivery-size decision, still open

Each GLB is 26,880 faces / **474 KB** at `--segments 96 --profile-points 140`.
Two levers, both one-line:
- `--segments 64 --profile-points 96` — roughly a third of the geometry
- `export_draco_mesh_compression_enable` in `export_glb()` — typically 5-10x
  smaller, but the r3f loader needs the Draco decoder wired first

## Source coverage ceiling

554 of 2,288 SKUs have no PSD in the library at all — the same gap that caps
the 2D lane. Photoshop does not help here (only 1 SKU had a PSD with no usable
layer); this is missing source art.
