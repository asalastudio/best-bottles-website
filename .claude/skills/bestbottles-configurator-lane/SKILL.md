---
name: bestbottles-configurator-lane
description: Preserve and scale the live 3D bottle configurator — the lock system that keeps approved looks from drifting, the canonical glass, the body-preparation chain, the closure contract, and the exact steps to bring a NEW bottle family into the PDP configurator. Use when adding a family, changing any material or environment, diagnosing "the look changed", or extending closures.
---

# Best Bottles — configurator lane

The 3D configurator is LIVE in the native PDP for the 17-415 9 ml cylinder
family (5 glass colourways × roll-on/spray/pump closures × 7 cap finishes).
This skill preserves how it works and how to extend it WITHOUT losing
approved looks. The companion skill `bestbottles-glass-material-lab` covers
material physics and tuning; this one covers the system.

## THE LOCK — read this before changing anything

**Appearance = values × environment.** The project lost approved looks
repeatedly because environment HDRIs were regenerated in place while the
"locked" values stayed byte-identical. The fix is mechanical:

```bash
python3 pipeline/paper-doll-3d/scripts/material_lock.py verify   # before ANY ship
python3 pipeline/paper-doll-3d/scripts/material_lock.py write    # ONLY beside a Jordan approval
```

`public/models/materials.lock.json` pins sha256 of every file the renderer
loads (studios, bakes, bodies, closures) + the shipping values of closure
materials and all glass presets. `verify` exits 1 with an exact drift report.

Rules:
- An intentional change = Jordan approves → relock IN THE SAME COMMIT.
- A generator that overwrites a locked file without a relock is a bug.
- When "the look changed" is reported, run `verify` FIRST. If it passes,
  the values did not move — the CONTEXT did (stage colour, field level),
  and the fix is renormalising against the new context, not value surgery.

## THE GLASS — one canonical material

`GLASS_BASE` in `src/lib/materials/glassPresets.ts` = the measured
soda-lime from `data/materials/physicallybased-library.json` (glass.glass,
CC0). **Every colourway is this glass**:

- clear = GLASS_BASE verbatim (+ approved thickness 0.0095, thin-wall)
- swirl = clear on the FLUTED body (the flutes are geometry, never material)
- frosted = GLASS_BASE at roughness 0.45 (the library's own convention:
  no separate frosted entry exists; its glass() factory takes a roughness
  override) + frost mask so the threads stay clear glass
- amber / cobalt = vessel-scale MTM path; absorption is their identity
  (amber #8f4a16 @0.015, cobalt #060cc4 @0.013) — Jordan-approved, locked

`material_lock.py verify` ANCHORS clear to the library values. Thin-wall
glass is opaque-pipeline (`transparent: false`) — transparent:true forces
per-frame sorting across the hollow shell and flickers during rotation.

## BODY PREPARATION — the chain for any new family

```bash
# 1. hollow (exterior silhouette gated to 0.00um — flutes/sculpts survive)
blender -b --factory-startup -P pipeline/paper-doll-3d/scripts/hollow_body.py -- \
  --glb public/models/bodies-threaded/<BODY>.glb --out public/models/bodies-threaded/<BODY>.glb
# 2. bake thickness (+ frost mask at the finish base for frosted families)
blender -b --factory-startup -P pipeline/paper-doll-3d/scripts/bake_thickness.py -- \
  --glb public/models/bodies-threaded/<BODY>.glb --out public/models/bodies-thickness \
  [--frost-datum-mm <finish base height>]
```

Proven on smooth (Cyl-round-17-415-70x20) and sculpted
(CylSwrl-round-17-415-74x21) bodies. Other geometry tools if needed:
`shave_neck_top.py`, `fillet_shelf.py`, `fix_inverted_normals.py` (RUN THE
NORMALS CHECK on any component that "cannot look right" — the roller ball
shipped 100% inverted and resisted every material for a full session).

## CLOSURES — the contract that makes assemblies free

`public/models/closures/manifest.json`: every part origins at the NECK RIM;
seat by rendering at `BB_ATTACH_NECK`'s y with zero transform. Assemblies:

- roll-on METAL (MtlRoll SKUs): STEEL housing + STEEL ball; roll-on
  PLASTIC (Roll SKUs): PLASTIC housing + PLASTIC ball [+ CAP either way]
- spray (Spry17-415): SPR_COLLAR + SPR_ACTUATOR in the trim colour
  [+ SPR_OVERCAP clear]
- pump  (Ltn17-415): spray parts + PMP_SPOUT

**THE CATALOG INVENTORY (SKU-derived from Convex — never guess counts):**
- 10 caps: ShBlk, Wht, ShnGl, MattGl, ShnSl, MattSl, MattCu + the DOT caps
  (BlkDot, PnkDot, SlDot) on the BB_CAP_DOTS_17415 geometry
- 6 spray trims: Blk, Gl, MattSl, ShSl, Tur (SPRAY_TURQUOISE), Rd (SPRAY_RED)
- 3 pump trims: Gl, MtSl, Blk (the first three of the spray set)
- 2 roller variants: metal / plastic
The counts came from `products.withIndex("by_productGroupId")` per group —
when extending a family, derive the option lists from the SKUs the same way
(suffix tokens after the size segment), never from memory.
Metals mirror `studio-universal.hdr` (a REAL studio laundered to panels-only
by `clean_studio_hdri.py` — field-gain and peak caps balanced for caps AND
ball); matte plastics light from the tent; glass owns the room HDRI.

## ADDING A FAMILY to the PDP configurator

1. Body chain (above) for each distinct body/colourway mesh.
2. If the family has its own mesh per colourway, extend `BODY_FOR_GLASS`
   in `BottleConfigurator.tsx` (swirl is the template).
3. Closure fit: a new finish size (13-415, 18-415) needs its closure GLBs
   from the closures manifest family; the 17-415 set is complete.
4. PDP eligibility: extend the slug regex in `ProductDetailClient.tsx`
   (`configurator3d` block) and the colourway inference.
5. Verify in the live PDP, get Jordan's approval per colourway, add the new
   files to `material_lock.py` TRACKED_FILES, relock.

## LAYOUT PROCESS (how the PDP rework was done — repeat for new surfaces)

1. Pull real patterns from Mobbin (search "product configurator" web) —
   Revolut Business card configurator + Wise customiser set the grammar.
2. Read the brand tokens from `src/app/globals.css` (obsidian/bone/
   champagne/muted-gold/travertine, EB Garamond `font-serif`, micro-labels
   `text-[9px] uppercase tracking-[0.18em] font-bold text-muted-gold`).
3. On configurator families the 3D IS the imagery: hide BOTH the
   thumbs-only gallery AND the VariantImagePicker rail (the `is3dFamily`
   flag in ProductDetailClient) so the vitrine takes the full column.
4. Controls stay centred under the caption and must WRAP gracefully —
   compact chip padding when a row grows (Spray/Pump + toggles).
5. Verify on a FRESH load (`?v=` cache-buster): the preview pane's bfcache
   restores old React state and fakes "wrong default colourway" bugs.

## UI GRAMMAR (Mobbin: Revolut/Wise; do not regress)

Vitrine (taupe #a29383 stage, vignette, LIVE 3D badge, entrance settle-spin
into idle auto-rotate, stops at first touch) → serif caption → glass swatch
dots → Bottle/Roll-on/Spray/Pump pill + cap toggle → cap finishes only for
the roller cap. On configurator PDPs the 3D IS the imagery — no static
thumb rail beside it. Each colourway renders at its approved
`envRotationDeg`; the material without its context is half the look.

## Metal studio law (2026-08-31, gold APPROVED under it)
- Metals (and glossy black) take their envMap from `useMetalStudio()` —
  three's RoomEnvironment PMREM-baked, the threejs-materials "Studio mode".
  NEVER swap it for an HDRI with any narrow source: a cylinder smears a
  narrow source into a full-height stripe, and no material slider can move
  a reflection.
- Library color arrays in physicallybased-library.json are ALREADY sRGB
  fractions (they match Filament's sRGB F0). Map *255 straight to hex;
  re-encoding washes every metal to cream.
- ACES desaturates clipped highlights: coloured metals run LOWER
  envMapIntensity (gold 1.35, copper 1.25) than silver (2.0).
- *Dot caps composite: normal shell in the colourway + BB_CAP_DOTS studs
  (a STUDS-ONLY GLB) in PART_STUD_CHROME. Matte finishes declare
  maps:"matte" (library matte normal/roughness, cylindrical unwrap).
