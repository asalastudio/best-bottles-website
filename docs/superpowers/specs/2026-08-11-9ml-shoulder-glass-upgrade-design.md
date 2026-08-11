# 9 ml Cylinder Shoulder and Glass Upgrade Design

**Date:** 2026-08-11  
**Status:** Approved design; implementation requires a separate written plan  
**Product:** Best Bottles cylindrical 9 ml bottle (manufacturer drawing capacity: 10 ml ±0.3 ml)  

## Objective

Correct the shoulder of the existing 9 ml cylindrical bottle and upgrade the clear, frosted, cobalt, and amber glass materials. Preserve the established bottle family, the approved 17/415 finish, the bone studio, the current camera, and the right-cast 2:00 shadow.

The separate swirl bottle is outside this pass. Its body geometry and its clay candidates must not change.

## Engineering authority

The engineering drawing governs the bottle envelope and finish proportions:

- commercial name: 9 ml cylinder
- manufacturer drawing capacity: 10 ml ±0.3 ml
- glass: Type III soda-lime silica
- overall height: 72 ±0.8 mm
- outer diameter: 19.7 ±0.5 mm
- nominal wall: 1.6 mm
- base thickness: 3.5 mm
- finish: 17/415
- approved working finish height: 13.76 mm, within the drawing's 14.06 ±0.3 mm tolerance

The locked 17/415 thread geometry is immutable. Its approved source fingerprint is:

`016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`

The immutable source scene is:

`pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend`

Its expected SHA-256 is:

`3291d7ecf0c8a289a2e06d9fb334ae758010ad42f53a99ece1863d306d7efd0f`

## Scope and isolation

This pass produces one corrected rotational master for the four smooth variants:

1. clear
2. frosted
3. cobalt
4. amber

All four variants share exactly the same corrected geometry. Only their materials differ.

The work must not:

- edit, rebuild, rescale, re-space, or re-phase the approved thread helix;
- modify the finish lip, bore, band, or finish proportions;
- modify the base, heel, straight body diameter, or overall height;
- modify the swirl body, swirl candidates, or locked swirl scene;
- overwrite any file below `pipeline/paper-doll-3d/master/locked`;
- move the approved shadow-producing key light or camera.

New scenes belong below:

`pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade`

New renders belong below:

`pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade`

## Geometry design

### Correct the profile at its source

The shoulder will be regenerated from a numerical side profile and revolved at production resolution. Direct vertex surgery and modifier-only smoothing are rejected because they are less reproducible and cannot prove a consistent inner wall.

The current profile contains a generous two-arc shoulder followed by an additional pre-finish ledge and land. That combination makes the shoulder look soft and can create redundant horizontal highlight lines. The corrected 9 ml profile will:

- retain a true 9.85 mm-radius cylindrical body;
- remain straight until the shoulder begins;
- use a shorter, rotationally symmetric, tangent-continuous two-arc transition;
- terminate directly at the approved finish attachment radius and datum;
- remove the redundant body-side pre-finish line;
- retain the locked finish's actual 2 mm junction band as the one intentional ledge;
- leave the locked 0.3 mm shoulder-to-band separation intact.

The corrected outer shoulder uses an initial 1.75 mm convex radius and 0.80 mm concave neck radius. With the 19.7 mm body and 14.8 mm finish-root diameters, this produces an approximately 2.55 mm-high transition terminating at the finish datum of 58.24 mm. These values are part of the geometry contract, not a free visual adjustment.

The inner shoulder is the true parallel offset of the outer transition by the 1.6 mm nominal wall. It must remain smooth and monotonic, with no transverse caps, self-intersections, flat spots, or negative radii. The heavier 3.5 mm base and existing heel remain unchanged.

### Topology and shading

The corrected body and locked finish form one continuous closed glass shell. The build will:

- use the existing 512-segment revolution standard;
- union the approved swept helix exactly once;
- remove doubles within the established tolerance;
- recalculate outward face normals;
- use smooth polygon shading;
- avoid destructive remesh, displacement, or silhouette-changing normal modifiers.

No duplicate annulus may remain at the finish datum.

## Material design

All four materials use Principled BSDF transmission and an IOR of 1.52. Surface color remains neutral white. Colored glass derives its color from volume absorption rather than a flat diffuse or surface tint.

### Clear glass

- base color: neutral white
- transmission weight: 1.0
- IOR: 1.52
- roughness: 0.018
- volume absorption: none
- optional molded-glass micro-normal: extremely subtle and incapable of breaking shoulder highlights

The result must remain crisp, neutral, and visibly hollow, with thickness read at the wall and base.

### Frosted glass

- clear-glass foundation with transmission weight 1.0
- IOR: 1.52
- base roughness: 0.22
- volume absorption: none
- fine procedural surface micro-normal only
- initial micro-normal scale: 85
- initial micro-normal strength: 0.04
- initial micro-normal distance: 0.012

Frosting is a surface treatment. It must not use opaque mixing, milk-glass volume, or high-amplitude noise. The silhouette, shoulder, neck, and base remain readable.

### Cobalt glass

- neutral white surface
- transmission weight: 1.0
- IOR: 1.52
- roughness: 0.018
- volume absorption color: `(0.003, 0.012, 0.92)`
- initial volume density: 0.55
- no surface tint

The density may be calibrated only enough to keep the 1.6 mm walls luminous while making the thicker base and overlapping paths visibly deeper. Color must remain transmission-driven.

### Amber glass

- neutral white surface
- transmission weight: 1.0
- IOR: 1.52
- roughness: 0.020
- volume absorption color: `(0.55, 0.20, 0.035)`
- initial volume density: 0.60
- no surface tint

The density may be calibrated only enough to retain a warm luminous center and dark apothecary edges without becoming muddy, brown-gray, or near-black.

## Lighting and camera design

The approved bone/tan studio, camera framing, and right-cast 2:00 shadow remain the family standard.

The existing shadow-producing key light is locked in position, rotation, size, and energy. It is not moved to create refraction because that would change the approved shadow and curvature read.

Glass readability comes from controlled reflected and refracted sources:

1. Retain and fine-tune the narrow reflection-only vertical strip for a clean curved surface highlight.
2. Add one broad, low-intensity transmission card behind and slightly left of the bottle.
3. The transmission card is invisible to direct camera rays and shadows, but visible through transmission/refraction.
4. The card must create a luminous interior and brighter thin edges without washing out the silhouette.
5. All four variants use the identical studio, camera transform, exposure, and render settings.

The lighting additions are non-destructive scene elements. They do not alter geometry or the approved key-light shadow.

## Deliverables

1. One corrected 9 ml master bottle scene with the approved 17/415 finish.
2. Four working variant scenes: clear, frosted, cobalt, and amber.
3. Four consistent hero renders on the approved bone background.
4. One shoulder macro comparison proving the cleaned transition and single junction ledge.
5. A concise geometry-change summary.
6. A concise shader and lighting-change summary.

## Verification

### Geometry gates

- overall height remains within 72 ±0.8 mm;
- diameter remains within 19.7 ±0.5 mm;
- body rings below the shoulder remain cylindrical at 9.85 mm radius;
- shoulder radius decreases monotonically from body to finish;
- analytic start and end tangents are continuous;
- minimum wall thickness remains at least 1.5 mm through the smooth body and shoulder;
- base thickness remains 3.5 mm;
- no datum annulus or duplicate shoulder line remains;
- approved thread source fingerprint is unchanged;
- hidden finish-source mesh fingerprint is unchanged;
- immutable baseline and swirl hashes remain unchanged.

### Material gates

- every variant uses transmission weight 1.0 and IOR 1.52;
- clear has no volume absorption;
- frosted remains transmissive and uses only controlled surface breakup;
- cobalt and amber have neutral surface color and color-producing volume absorption;
- cobalt and amber contain no flat surface tint;
- all materials remain free of opacity or metallic shortcuts.

### Render gates

- all four renders use the same camera fingerprint;
- all four renders use the same locked key-light fingerprint;
- the right-cast contact shadow matches the approved studio direction;
- the shoulder shows an uninterrupted curved highlight with no pinching or faceting;
- the single junction band is readable without redundant lines;
- clear reads neutral, frosted reads etched, cobalt reads luminous blue, and amber reads luminous warm brown-orange;
- wall and base thickness are visible through refraction and absorption.

## Acceptance decision

The corrected shoulder and materials remain working candidates until the four consistent renders and shoulder macro are visually approved. No scene is promoted into `master/locked` automatically.
