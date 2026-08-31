# LOCKED: 58 bodies, not 1,345 SKUs

**The unit of work in the 3D lane is the GLASS BODY, never the SKU.**

Glass colour and closure are chosen in the browser at runtime. `GBCyl9MtlRollMattSl`
and `GBCyl9SpryBlk` are the SAME piece of glass. Building one GLB per SKU produces
~23x redundant assets that must then be kept in sync forever.

## The number

| | count |
|---|---|
| dimensioned, QA-passing SKUs | 1,345 |
| **DISTINCT GLASS BODIES** | **56** |
| **built and validated** | **42** |
| sculpted - outside modeler | 4 (166 SKUs) |
| shape unknown - needs a caliper | 10 (166 SKUs) |
| round (lathe) / boxy (extrude) | 24 / 18 |

42 GLBs = **20 MB**. One per SKU would have been 1,143 files / 531 MB.
Frozen at `releases/2026-08-30-bodies-v1/` with a SHA-256 manifest.

## How the number is derived

A body is the tuple `(shape, neck_finish, height_mm, width-or-diameter_mm, depth_mm)`.
Two SKUs sharing that tuple share one piece of glass. The representative silhouette
for each body is the member SKU whose traced aspect is closest to the catalogue's
proportions.

Regenerate the grouping and the map:

```bash
python3 scripts/group_bodies.py          # -> bodies.csv + sku-to-body.csv
```

## The artifacts

- `bodies.csv` — one row per body; the build ledger
- `sku-to-body.csv` — **1,345 SKU -> body_id rows; the configurator's lookup**
- `glb/<body_id>.glb` — the assets, named for the body

`sku-to-body.csv` is what lets a product page ask for a SKU and get the right body.
Without it the 58 files are unaddressable. Do not ship the GLBs without the map.

## Do not

- Do not batch `bodies-3d-dims.csv` or `bodies-3d-ok.csv` directly into `glb/` —
  those are SKU-level and will emit 1,143 near-duplicates.
- Do not read a published `Item Width` as a diameter. Empire and Sleek publish a
  width and no depth, and are visibly rectangular; coercing it builds cylinders.
- Do not trust the numeric gates alone. Both a closure crop and a
  bottle-plus-sprayer composite can hit the right aspect by coincidence. Look at
  `renders/all-bodies.png` before shipping a batch.
- Do not name assets by SKU. `--ledger bodies.csv` carries `body_id` and the
  exporter keys on it.
