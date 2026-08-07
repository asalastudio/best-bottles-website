# Paper Doll 3D — Pilot Subject: Boston Round

Created: 2026-08-06
Lane: Blender 3D paper-doll assets (separate from the 2D PSD lane at pipeline/paper-doll/)
Status: PLANNING — Phase 1 complete, awaiting Phase 2 approval

## Subject intent

Build a reusable, real-world-scale Boston Round glass bottle BODY as the
first pilot asset for the Blender paper-doll lane. The body is the shared
base that swappable components (caps, droppers, roller fitments) will seat
onto in later runs, mirroring the 2D cap-on / cap-off paper-doll model
already used by the Madison pipeline.

Family code (graceSku): BSR
Catalog family label: "Boston Round"

## Planned geometry list — THIS RUN

- Bottle body (single mesh): shoulder, cylindrical wall, neck, thread land,
  base. Interior cavity modelled (glass reads correctly when refractive).
- Neck datum: empty at the neck seating plane, so future components snap
  to a known origin rather than being eyeballed.

Components (caps, droppers, roller fitments) are OUT OF SCOPE this run.

## Deliverables for this run

- boston-round_body_v001.blend  (01_body/)
- Named, transform-applied body object
- Glass + gold materials authored on the scene material library
- 1-2 check renders (05_thumbnails/)
- Phase 4 validation checklist
- Phase 6 JSON handoff block

## Known constraints / risks

1. DIMENSION DATA GAP — Nemat_Product_Catalog.csv has 123 Boston Round
   rows; only 1 carries any dimension data, and that row's fields are
   shifted/malformed. heightWithCap / heightWithoutCap / diameter are
   otherwise empty. Real-world scale cannot be sourced from the catalog
   for 30ml or 60ml.
2. The one usable data point (GB-BSR-CLR-15ML-DRP-BLK, 18-400 neck):
   height with cap 91mm, height without cap 68mm, diameter 25mm.
3. Three capacities exist in-family: 15ml (16 SKUs, 18-400 neck),
   30ml (53 SKUs, 20-400), 60ml (54 SKUs, 20-400). Capacity not yet chosen.
4. Neck thread size governs fitment. Body neck must be modelled to a real
   thread spec (18-400 or 20-400) or components will not seat correctly
   in later runs.
5. No reference photograph supplied for this run.

## Open decisions (blocking Phase 3)

- D1: Which capacity — 15ml, 30ml, or 60ml?
- D2: Where do 30ml / 60ml dimensions come from if not 15ml? (measure a
  physical sample, scrape the live PDP, or model to a published
  Boston Round industry standard)
- D3: Components were scoped out this run, but fidelity was set to
  "glass + gold". Gold has no carrier without a cap. Author gold as an
  unused library material, or pull the cap into this run?
- D4: Confirm this folder root (pipeline/paper-doll-3d/) rather than
  nesting inside the existing 2D pipeline/paper-doll/.
