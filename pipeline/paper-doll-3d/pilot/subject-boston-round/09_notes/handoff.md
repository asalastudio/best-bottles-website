# HANDOFF - Boston Round paper-doll 3D pilot

Written: 2026-08-06
From: chat session (research + planning phase)
To: Claude Code (build phase)

## Status  (updated 2026-08-07)

Phase 1 (project setup)      COMPLETE
Phase 2 (asset design plan)  COMPLETE - specified below
Phase 3 (build pass)         COMPLETE for the 30 ml BODY
Phase 4 (validation)         COMPLETE - 19 automated checks, all passing
Phase 5 (components)         NOT STARTED - references identified, see below
Phase 6 (handoff)            PARTIAL - metadata rides on the mesh as custom props

All four OPEN items are resolved. See "RESOLUTIONS" below.

What exists now:
  scripts/paper-doll-3d/build-boston-round.py    parametric body builder
  scripts/paper-doll-3d/extract-silhouette.py    photo -> (r,z) profile in mm

The body carries: glass shell with interior cavity, true helical thread on the
neck, a liquid solid, front/back label shells with flat 0-1 UVs, and a neck
datum empty. It satisfies the packaging studio's GLB contract
(packaging-saas/public/models/MODELS.md) and exports at ~45 KB with Draco.

## What this lane is

A repeatable Blender workflow for building Best Bottles bottle bodies and
swappable components ("paper dolls") at real-world scale. Test mode: one
subject only (Boston Round) before generalising.

This is the 3D sibling of the existing 2D PSD lane at pipeline/paper-doll/.
They are deliberately separate roots. See OPEN-3.

## Verified dimensions (source: www.bestbottles.com live product pages)

CORRECTED 2026-08-07. The table below originally recorded the 30 ml bare height
as 68 mm. That was wrong - it came from the single outlier row out of 53. Bare
height is the only closure-independent figure and is what the body is built to.

| Size | Neck | H bare | Diameter | H capped (varies by closure) |
|---|---|---|---|---|
| 15 ml | 18-400 | 68 +/-1 | 25 +/-0.5 | 72 short cap / 91 dropper |
| 30 ml | 20-400 | **78 +/-1** | 33 +/-0.5 | 97 roller / 102 dropper |
| 60 ml | 20-400 | 94 +/-1 | 39 +/-0.5 | 110-111 roller / 117 dropper |

Full derivation math and the volume sanity checks are in dimensions.md
(same folder). Read it before cutting geometry.

## Build target this run

30 ml body ONLY. No components. Fidelity: basic glass + gold materials.

## Derivation strategy - one base model covers all three sizes

Base = 30 ml (68 mm bare, 33 mm dia, 20-400 neck).

  -> 60 ml:  Z x 1.3824,  XY x 1.1818,  neck UNCHANGED
  -> 15 ml:  Z x 1.0000,  XY x 0.7576,  neck SWAP to 18-400

CRITICAL: never apply the body scale to the neck. 30 ml and 60 ml share the
20-400 finish, so the neck must remain dimensionally identical between them.
A uniformly scaled 60 ml would have a ~23.6 mm thread instead of 20 mm and no
real cap would fit. Scale the body profile below the shoulder only.

The 60 ml derive is trustworthy (volume check 3.5% off). The 15 ml derive is
looser (14% off) - check it against the product photo before trusting it.

## Phase 2 plan (approved shape, not yet executed)

Naming
  Objects    bb_bsr_body_v001, bb_bsr_neckdatum_v001
  Files      bsr-30ml_body_v001.blend, exports bb_bsr_body_v001.glb
  Materials  bb_mat_glass_clear, bb_mat_gold_shiny
  "bsr" matches the graceSku family segment (GB-BSR-*) so 3D names join
  back to catalog rows.

Scene
  Collection BSR_BODY holds the asset. Camera + 3-point lighting in a
  separate _STAGE collection, excluded from export.
  Metric units, scale 0.001 (mm precision at meter scale). +Z up.
  Bottle stands on the world XY plane.

Hierarchy
  BSR_BODY
   |- bb_bsr_body_v001       mesh, origin at base centre (0,0,0)
   |- bb_bsr_neckdatum_v001  empty at the neck seating plane; the parent
                             socket every future component snaps to

Pivots / scale / UV
  Body origin at base centre so the bottle sits on Z=0. Every future
  component origins at ITS mating face, so seating is a zeroed parent-to-
  datum snap rather than a manual offset. All transforms applied, scale
  1,1,1. Smart UV unwrap on the body before topology is locked.
  64-segment radial lathe profile, no n-gons on the wall, interior cavity
  modelled so refraction reads correctly.

Assumptions
  Clear glass, no label, no embossing. Neck modelled as a smooth thread
  land, not cut helical threads - the datum handles fitment, so helical
  threads would cost topology for nothing.

## OPEN ITEMS - resolve before/during Phase 3

OPEN-1 (BLOCKING) - 30 ml bare height, 68 vs 78 mm
  The live page reads: height with cap 78, height without cap 68.
  A spec block pasted in chat read 78 for BOTH, which is self-
  contradictory (a cap must add height). Everything else in that block
  matched the page exactly.
  Physical reasoning supports 68: at 33 mm OD the interior bore is ~30 mm,
  so a 30 ml fill needs ~42 mm of straight cylinder; plus a ~15 mm neck and
  ~10 mm shoulder lands at 68. At 78 mm bare the implied capacity is ~37 ml.
  68 is also what makes 15 ml and 30 ml identical in height, which is the
  whole basis of the one-base-model strategy above.
  ACTION: confirm the page reads 68 for "without cap". If it genuinely
  reads 78, the page contradicts itself - measure a physical sample before
  cutting geometry. A 10 mm error on a 68 mm object is far too large to
  absorb.

OPEN-2 - gold material has no carrier
  Components were scoped out of this run, but the requested fidelity was
  "basic glass + gold". Gold has nothing to sit on without a cap.
  DECIDE: author gold as an unused library material, or pull the cap into
  this run.

OPEN-3 - confirm folder root
  This lane was rooted at pipeline/paper-doll-3d/ rather than nested inside
  the existing 2D pipeline/paper-doll/ (which holds source-psds, scripts,
  reference-images for the PSD flow). Confirm or relocate.

OPEN-4 - "Item Depth" field meaning
  Listed for 30 ml (73) and 60 ml (88), absent for 15 ml. Matches neither
  height nor diameter, and its relation to the other figures is inconsistent
  between sizes. DO NOT model to it. Ask Nemat what the field means.

## Data-quality finding for the catalog lane (not blocking 3D)

Nemat_Product_Catalog.csv lists the 15 ml Boston Round at 91 mm capped; the
live site says 72 mm. That row's fields are also shifted across columns
(height text bleeding into adjacent fields). Of 123 Boston Round rows, only
that one carries ANY dimension data, and it is wrong.
Consequence: bottle dimensions cannot be sourced from the CSV for this
family. Live product pages are authoritative. Worth queueing for the
catalog cleanup / Convex drift work.

## How to build it (important)

Do NOT model interactively via ad-hoc socket calls - that is how the chat
session worked and none of it is reproducible.

Write a parameterised script, committed to the repo, matching the pattern
of the existing 2D lane (scripts/madison-pipeline/01-inventory-psds.py etc):

  scripts/paper-doll-3d/build-boston-round.py
    --capacity 30|15|60
    --output <path>.blend

It should take height, diameter, neck spec as parameters and generate the
body deterministically, so 60 ml and 15 ml are nearly free once 30 ml is
right, and so any dimension correction is a re-run rather than a remodel.

## Environment

Blender MCP addon serves on localhost:9876. Confirm Claude Code can reach it
before starting. Repo root:
  ~/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/

Nothing in pipeline/paper-doll-3d/ is git-tracked yet.
