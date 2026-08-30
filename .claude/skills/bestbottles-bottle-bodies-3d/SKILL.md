---
name: bestbottles-bottle-bodies-3d
description: Build Best Bottles 3D bottle bodies (GLB) from PSD silhouettes plus live-site millimetres — lathe for round, extrude for boxy — then graft the drawing-exact threaded finish, flute swirl bodies, and export geometry-only closures that seat on the rim datum. Use when generating, fixing, threading, or batching bottle geometry for the web configurator.
---

# Bottle bodies → GLB

One photo outline + real millimetres is enough to rebuild a bottle in 3D. No
sculpting, no artistry. Blender is the geometry engine only, headless — the
configurator draws glass/frost/metal in the browser, assigned by mesh name.
That is why the wall that stopped the manual Blender effort (materials,
lighting, render setup) does not exist in this lane.

| shape | operation | source of the second axis |
|---|---|---|
| **round** (cylinder, tapered, bulb) | **lathe** — spin the outline 360° | diameter |
| **boxy** (square, rectangular) | **extrude** — sweep the footprint upward | width **and** depth |
| **sculpted** (Diva, faceted, embossed) | **neither** — deferred to an outside modeler | a silhouette shows the front only |

## LOCKED: one GLB per BODY, never per SKU

**58 distinct bodies**, not 1,345 SKUs (40 round / 18 boxy; 47 built, 11 blocked).
Glass colour and closure are chosen in the browser, so `GBCyl9MtlRollMattSl` and
`GBCyl9SpryBlk` are the SAME piece of glass. Batching the SKU-level CSV emits
1,143 near-duplicates at 531 MB instead of 47 files at 22 MB.

A body is `(shape, neck_finish, height, width-or-diameter, depth)`. Always run
`group_bodies.py` before building, and always ship `sku-to-body.csv` with the
GLBs - without that lookup the assets are unaddressable from a product page.
Full rationale: `pipeline/paper-doll-3d/BODY-COUNT-LOCK.md`.

## The loop

```bash
cd pipeline/paper-doll-3d

# 1. dimensions — from the live catalogue, never from pixels
python3 scripts/harvest_live_dims.py --all --out bodies-3d-dims.csv

# 2. silhouettes — from the PSD body layer (system Python; Blender has no psd_tools)
python3 scripts/extract_psd_silhouette.py --from-csv bodies-3d-dims.csv

# 3. collapse SKUs -> BODIES (never skip this)
python3 scripts/group_bodies.py

# 4. build - one GLB per body. --splice-finish REPLACES the traced neck with
#    the drawing's threaded finish master. Ship with it; without it the neck
#    is whatever the photograph happened to show.
blender --background --python scripts/bottle_bodies.py -- \
    --ledger bodies.csv --cutouts silhouettes --out glb --splice-finish

# 5. verify — mesh integrity + a render to actually look at
blender --background --python scripts/verify_glb.py -- \
    --glb glb/SKU.glb --out renders/verify

# 6. does a closure actually FIT? (radial interference, not just heights)
blender --background --python scripts/seat_check.py -- \
    --body glb/BODY.glb --closure glb-closures/BB_CAP_17415.glb

# macro clay of the finish — the only view thread form can be judged in
blender --background --python scripts/thread_macro.py -- \
    --glb glb/BODY.glb --finish-h 13.76
```

Add `--sku X` to any step for one body.

## The finish is the DRAWING's, never the photograph's

A photo gets the neck wrong. The 9 ml cylinder traced 11.5 mm of finish where
GBCyl10mlAmber.pdf draws 13.76, so a correct 17-415 cap buried **4.12 mm** of
skirt in the shoulder. THREAD-STANDARD.md settles it: "truth = drawings +
specs; photos, PSD measurements and prior renders are history, not authority."

`--splice-finish` does two things:

1. **`finish_splice.py`** pins the finish datum at `rim - finish_h`, discards
   the traced neck above it, and eases the shoulder below it. Catalogue height
   is untouched and `BB_ATTACH_NECK` does not move, so every closure that
   parents to the rim keeps working.
2. **`graft_finish_master()`** EXACT-unions the canonical
   `FINISH_MASTER_<std>` on top. Per THREAD-STANDARD §0 bodies **instance** the
   master, they never rebuild or scale a finish. All four masters
   (13/15/17/18-415) already pass their dimensional audits.

Result: cap clears by 0.97 mm where it previously cut 1.51 mm into glass.

**Do the boolean in the master's own units.** Both meshes are watertight alone;
scaling the master to metres first asks EXACT to resolve a 0.75 mm thread at
0.00075 units. Same family as the 10 mm merge-threshold trap.

**Taper the body's land inward ~0.25 mm** where the master lands. Held straight
at E/2 it is exactly the master's base radius, and two coincident cylindrical
walls leave an interior shell — 172 edges with THREE faces at r = E/2.

**The shoulder blend is NOT settled.** It is currently `0.06 x body width`,
calibrated on two live photos (9 ml: 1.21 mm on Ø20; Elegant 60: 3.03 mm on
Ø54). The 5 ml breaks it — it measures ~2.0 mm on Ø17, a fraction of 0.118.
The drawings' `shoulder_r_out` (005 = R2.5, 009 = R2.2) is the better source
where a sheet exists. Do not treat the current constant as truth.

## Swirl bodies: an angular modulator, never a material

Fluting is GEOMETRY. The catalogue publishes the swirl at Ø21.0 against the
plain cylinder's Ø20.0 and that millimetre IS the relief; no material or normal
map can move a silhouette.

`swirl.py` mirrors `thread_modulator()` exactly — guard, phase, signed offset,
raised-cosine crest, fades, single return — because a swirl is the same object
as a thread: a rounded section swept along a helix. It carves **inward** from
the traced crest envelope so the bottle cannot grow past its catalogue Ø.

**`_revolve()` cannot do this.** It drives Blender's SCREW modifier, which
sweeps one profile and cannot vary radius with theta. Fluted bodies reuse
`build-master-scene.revolve()` — the same lathe the thread uses — via
`build_body_swirled()`. One lathe in the project, not two.

**Flutes must stop clear of the shoulder** (`shoulder_clear_mm`). Running them
to the datum leaves the body non-cylindrical exactly where the master is
unioned on: 379 boundary edges, all at z = datum, r = E/2.

## Closures

`closures.py` exports to the SAME contract as bodies: one mesh, **no materials**,
metres, Y-up, and the origin on the **mating face** so a closure parent-and-zeros
onto `BB_ATTACH_NECK`. The measured records already use z = 0 at the rim, so
there is no offset maths to get wrong.

Build only what is MEASURED. 17-415 is measured; 13-415 derives its skirt and
is flagged provisional; **18-415 — 694 SKUs, 69% of coverage — has no cap spec
at all** and must be photo-solved from `20. Closures .../6. 18-415 Caps` before
anything is built for it. Inventing a height for the largest finish is the one
mistake this lane cannot afford.

Closures collapse moulding-vs-colourway exactly as bodies collapse to glass:
12 cap PSDs are ~3 mouldings. Read the SKU token — `Tall` and `Lthr` are
geometry, colour names are not.

## Measure the measurement before you fix the model

Five times in one session the bug was in a CHECK, not the geometry — and four
of the five returned confident wrong numbers rather than an error. Before
changing geometry, prove the instrument.

- **glTF splits vertices at sharp edges.** A threaded finish measures 0
  non-manifold in Blender, **7138** straight after a GLB round-trip, and 0
  again after a weld. `verify_glb.py` now welds before counting. Unfixed, it
  condemns exactly the geometry you just got right — and 6000 phantom edges
  hid 187 real ones, so two correct fixes looked like failures.
- **The Y-up rule INVERTS inside Blender.** Files are Y-up on disk, but the
  glTF importer restores Blender's Z-up. Reading `.y` in a Blender script
  reports a bottle's DIAMETER as its height. Browser = `.y`; Blender = `.z`.
- **A seat check must be ANGULAR.** §4 seats the cap a half-period anti-phase
  so its ridges nest in the bottle's root land. Comparing max-body-radius to
  min-cap-radius around a whole ring reports a phantom 0.60 mm collision. Bin
  by (z, theta).
- **`audit_finish_master()` prints and returns None.** Testing its return value
  grades nothing; the gate reads green while checking literally nothing.
  Capture stdout and parse its `FINISH_QA_JSON` line.
- **A global dark-threshold mask fails on glass.** A blown specular highlight
  is as bright as the background and punches holes in the mask — it measured a
  10.5 mm body as 7.73 mm. Scan inward from each edge for an outline.
- **Locate before patching.** Report the bad edges' (z, r, faces-per-edge)
  first. Every wrong guess this session came from patching before diagnosing;
  the one right fix came from a histogram.

## Rules that cost real time to find

**Set `screw.merge_threshold`.** Blender 5.2 defaults it to 0.01 m = **10 mm**.
A 9 ml bottle has a ~10 mm radius, so `use_merge_vertices = True` with the
default welds the whole body into its own axis. Set it to 1 micron.

**Dimensions come from the live site, not the silhouette.** The PDPs publish
*Item Height without Cap*, *Item Width*, *Item Depth*, *Item Diameter* and the
neck thread size. 1,840 of 2,288 SKUs are dimensionally complete this way. A
photo cannot reveal depth — the live site can, so boxy bodies are not blocked
on caliper measurement.

**The live site also states the shape.** A PDP that prints a Diameter is a body
of revolution; one that prints Width and Depth is a box. No hand-filled
`shape_class` column, and no guessing from the family name.

**Take the outline from the PSD body layer**, not a cutout of a composite. The
layered sources carry true per-layer alpha, so the silhouette is exact — no
keying, no background, and no "cap sitting beside the bottle" to solve. (Note
`scripts/paper-doll-3d/extract-silhouette.py` does something different: it
thresholds white out of a *flattened* photo and deliberately ignores alpha,
because in the flattened reference sets the alpha is a rectangular tile.)

**Smooth the profile with edge padding.** `np.convolve(..., mode="same")`
zero-pads, dragging the foot and mouth radii toward nothing — the two places
the silhouette must stay honest.

**The attach datum is the RIM, and it is not negotiable.** `components_17415.py`
parents every closure to the neck datum at `location (0,0,0)` - "origin IS the
rim datum" - and `build-master-scene.py` places `BB_ATTACH_NECK` at
`(0, 0, s["height"])`, commented "closure seating plane". Emit `BB_ATTACH_NECK`
at the top of the profile. Putting it on the shoulder instead sinks every cap a
full neck-height into the glass.

The shoulder height is still real, and still needed - it is what makes a boxy
neck round - so emit it separately as `BB_REF_SHOULDER` (widest point, walk up,
first height below ~72% of max half-width). Two heights, two jobs; do not
conflate them.

**Boxy necks are round.** A threaded finish is always circular. Sweeping the
rounded rectangle all the way up leaves a square neck no cap can seat on, so
force the section circular at and above the seat, blended over the shoulder.

**Free the mesh datablock,** not just the object — otherwise a 2,000-row batch
leaks unboundedly.

## Gates

A body ships only if all of these hold:

- dimensions within `--tolerance-pct` (default 0.5%) of the catalogue
- `non-manifold == 0` — a closed solid (weld before counting; see above)
- `thread-audit PASS` — every finish row inside its sheet tolerance
- `seat_check.py` says SEATS for the closure that finish takes
- the render looks like the source silhouette — and for thread form, the
  MACRO CLAY view (`thread_macro.py`), never through glass. §5: the front
  elevation must read as ~3 angled parallel lines.

Bounding-box agreement alone is **not** sufficient: a collapsed or
self-intersecting mesh can still measure 70 × 20 mm. That is what
`verify_glb.py` is for.

Reference numbers from the two validated bodies: traced wall ripple is
~0.17 mm peak-to-peak (std 0.046 mm) against a ±0.5 mm drawing tolerance —
one pixel of quantisation, not a defect, though Workbench cavity shading
exaggerates it.

## Validated bodies

| SKU | shape | catalogue | built |
|---|---|---|---|
| `GBCyl9MtlRollMattSl` | round, 17-415 | 70 × Ø20 | 70.0 × Ø20.0, closed, mount z=57.9 |
| `GBSqr15BlkSht` | boxy, 13-415 | 52 × 26 × 26 | 52.0 × 26.0 × 26.0, closed, mount z=41.2 |

## Triaging what the build skips

A skip is almost never one SKU's problem - group them by BODY first.
202 skips collapsed into 5 bodies: 4 boxy ones needing one depth measurement
each (159 SKUs), and one faceted body (36 SKUs) that belongs to an outside
modeler. See `pipeline/paper-doll-3d/OPEN-ITEMS.md`.

Faceted bodies are invisible to this lane by construction: a silhouette carries
the front outline and nothing about surface relief. `GBDmnd2oz*` has a diamond
pattern pressed into the glass and must be `shape_class = sculpted`.

## Consuming the GLBs in React (r3f)

Proven 2026-08-30 at `src/app/lab/bottle-3d/` — three 0.185, @react-three/fiber 9,
@react-three/drei 10 on React 19 / Next 16. Models are served from
`public/models/bodies/` with a `manifest.json`.

Verified in-browser: measured dimensions match the catalogue to **0.00 mm**,
`materials in file 0`, and `BB_ATTACH_NECK` lands exactly on the bare height.

Five traps, each of which looks like a different bug than it is:

- **Never use drei `<AccumulativeShadows>` with transmissive glass.** It
  re-renders the scene into an offscreen buffer and that pass draws the body
  **opaque white**. The material stays correct (`transmission: 1`), so it reads
  as a material bug and is not one.
- **`thickness` and `attenuationDistance` are WORLD UNITS — here, metres.**
  `thickness: 1.6` means 1.6 m of glass across a 70 mm bottle; it absorbs
  everything and the body renders solid. Real container glass is ~0.0025.
- **Y-up.** `export_yup` rotates Blender's Z-up, so a datum's height is
  `.position.y` in three.js. Reading `.z` reports 0.00 mm for every body and
  makes a correct attach point look broken.
- **three.js assigns a DEFAULT material to any primitive that has none**, so
  counting materials on the loaded mesh always returns >= 1. To check what the
  FILE declares, read `gltf.parser.json.materials?.length ?? 0`.
- **`Box3.setFromObject` walks children.** Anything parented to a datum (a
  marker ring, later a closure) is measured as part of the bottle. Measure
  `mesh.geometry.boundingBox` instead.

Colour comes from `attenuationDistance` + `attenuationColor`, not `color` —
that is how real amber and cobalt behave: thin walls pale, thick bases deep.

## Photoshop

Not needed for the sweep — `psd_tools` reads the body layer's true alpha
headless and in bulk. Reach for Photoshop only where a PSD is a single
flattened layer with bottle and closure fused (e.g. the apothecary bottles:
one `Layer 1`, everything baked together). `psd_tools` cannot split what was
never separate; subject-aware selection can.
