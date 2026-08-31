# 9 ml Cylinder Luxury Glass Studio Design

**Date:** 2026-08-11  
**Status:** Approved design  
**Scope:** Clear, amber, cobalt, and frosted short 9 ml Cylinder bottles only  
**Commercial name:** 9 ml Cylinder  
**Engineering drawing capacity:** 10 ml +/- 0.3 ml  
**Finish:** Approved 17-415 geometry

## Objective

Upgrade the existing four-variant Blender presentation from clean CGI to
photorealistic luxury studio product photography. The work is limited to glass
shading, reflection-oriented lighting, render quality, color management, and
subtle optical fidelity. The approved bottle geometry and its composition are
immutable.

## Architecture decision

Use one protected master scene plus four derivatives.

- The master owns the approved geometry, camera, backdrop, studio rig, render
  settings, color management, master node group, and four material instances.
- Each derivative uses the same master data and differs only by the assigned
  glass material: clear, amber, cobalt, or frosted.
- Existing approved scenes remain untouched.
- New files are written beneath a dedicated `9ml-luxury-glass-studio` working
  directory. Nothing is promoted to `master/locked` without a separate user
  approval.

This is preferred to four independently authored scenes because it prevents
camera, lighting, background, and render-setting drift. A single scene with a
runtime-only material switch was considered but rejected because the user
requested four reviewable Blender derivatives.

## Immutable source contract

The source scene is:

`pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend`

Source SHA-256:

`c436ed8f8c0c363695bf2bcbbdb371a67a4e8c1fd2b6574ac8ebcd6663d22ea0`

All four current variants share these geometry locks:

- Body mesh fingerprint:
  `ed64930d7ea4e7301a2687340ea2e3235cbb5f0f4545be0313200e1d1dfba016`
- Approved finish fingerprint:
  `016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`
- Envelope: 19.7 mm diameter x 72.0 mm height
- Precision shoulder datum: 58.24 mm
- Finish height: 13.76 mm
- Minimum smooth-body wall: 1.6 mm
- Base thickness: 3.5 mm
- Bore diameter: 9.8 mm

The build must snapshot and compare the body mesh, finish fingerprint, object
transform, camera transform, and bottle envelope before and after look
development. Any mismatch is a hard failure.

## Geometry audit result

The source mesh is suitable for physical glass and requires no geometry repair.

- One connected glass component
- 123,327 vertices, 245,789 edges, and 122,464 faces
- Zero non-manifold edges
- Zero boundary edges or wire edges
- Zero zero-area faces
- Zero duplicate vertex coordinates
- Zero duplicate face signatures
- Positive signed volume and normalized face normals
- Complete smooth shading with no zero-length face normals
- Physical inner and outer walls
- Physical open mouth and inner bore
- Physical rim annulus
- Physical 3.5 mm base and molded push-up
- No Solidify modifier required or permitted
- Approved thread fingerprint is identical in all four source variants

The geometry collection and the visible bottle object will be locked against
selection and transformation in the new master. Hidden finish-reference objects
remain hidden and unchanged.

## Master glass system

Create one shader node group named `BB_GLASS_MASTER`. Its exposed inputs are:

- `IOR`
- `surface_roughness`
- `transmission`
- `absorption_color`
- `absorption_density`
- `frost_amount`
- `micro_roughness_amount`
- `micro_roughness_scale`
- `micro_normal_strength`

The group uses a neutral Principled dielectric surface with full physical
transmission. Metallic remains zero and alpha remains one. No alpha transparency
or flat opaque color is used to simulate glass. The colored variants use Volume
Absorption so density varies naturally with optical path length.

Create these materials from the group:

- `BB_GLASS_CLEAR`
- `BB_GLASS_AMBER`
- `BB_GLASS_COBALT`
- `BB_GLASS_FROSTED`

### Clear

- IOR starts at 1.50.
- Surface roughness starts within 0.015-0.030.
- Transmission is 1.0.
- Surface is neutral, not white-painted.
- Volume absorption is disabled unless an extremely subtle neutral density is
  proven necessary during comparison renders.
- Form comes from Fresnel response, refraction, wall thickness, light ribbons,
  and negative fill.

### Amber

- Surface remains neutral so studio reflections stay white.
- Amber color is produced by Volume Absorption.
- Density is tuned for a luminous center, richer edges, denser shoulder and
  threads, and a deep but transparent base.
- No part may collapse into fake opaque black.

### Cobalt

- Surface remains neutral so studio reflections stay white.
- Cobalt color is produced by Volume Absorption.
- Density is tuned for a luminous center, deep cobalt/navy edges, richer
  thread intersections, and a transparent deep base.
- Electric blue, neon blue, uniform saturation, and acrylic behavior fail QC.

### Frosted

- Derived from clear rather than from an opaque white material.
- Surface roughness starts within 0.22-0.32.
- Very high-frequency micro-roughness is used; individual procedural features
  may never become visible.
- Micro-normal strength starts within 0.01-0.03.
- Transmission remains physical and rim/base/edge thickness remains legible.
- The target is acid-etched cosmetic glass, not milk glass, plastic, or resin.

## Reflection-oriented studio

Create collection `BB_STUDIO_GLASS_LUXURY`. Its dimensions and placement derive
from bottle height `H = 72.0 mm` and diameter `D = 19.7 mm`, so the design can be
reused without arbitrary scale changes.

The existing warm-neutral seamless sweep remains the color and compositional
direction. The old broad mesh-emission objects are disabled in the new luxury
master, not deleted from the approved source.

The new rig uses rectangular Cycles Area lights aimed at the product center:

1. `BB_LUX_KEY_LEFT_STRIP`
   - Front-left, approximately 35-40 degrees from camera axis
   - Height approximately 1.35H
   - Broad enough to form one controlled vertical reflection ribbon
   - Primary source for the established right-cast shadow
2. `BB_LUX_EDGE_RIGHT_STRIP`
   - Front-right, approximately 55-65 degrees
   - Narrower and lower energy than the key
   - Produces the thin opposite-curvature highlight
3. `BB_LUX_RIM_REAR_STRIP`
   - Behind the bottle with low energy
   - Separates transparent edges, shoulder, and neck from the backdrop
4. `BB_LUX_TOP_STRIP`
   - Above and slightly forward
   - Shapes the rim, mouth, threads, shoulder, and top-facing glass
5. `BB_LUX_FILL_FRONT`
   - Very broad and deliberately low energy
   - Prevents crushed shadows without flattening the cylinder

Create matte-black reflection cards:

- `BB_LUX_NEG_LEFT`
- `BB_LUX_NEG_RIGHT`
- Optional `BB_LUX_NEG_SHOULDER` only if the shoulder/neck junction needs a
  separate dark reflection cue

The cards stay outside camera view and do not create a drawn black outline.
Their purpose is to create narrow controlled contour ribbons, especially for
clear glass.

The physical sweep provides both floor and backdrop with no visible horizon.
Lighting creates only a 5-8% background luminance gradient. There is no vignette,
dramatic spotlight, or artificial contact line.

## Camera

Preserve the approved camera exactly because it already satisfies the optical
requirement:

- Perspective camera
- 100 mm lens
- 36 mm sensor width
- Level and centered
- Location `(0.0, -305.5555, 36.0)`
- Rotation `(90 degrees, 0, 0)`
- Depth of field disabled

No composition, scale-in-frame, bottle transform, or wide-angle change is
authorized.

## Cycles and color management

Use Cycles with GPU rendering where available.

Final starting settings:

- Samples: 512
- Adaptive sampling: enabled
- Noise threshold: 0.005
- Total bounces: 12
- Transmission bounces: 12
- Glossy bounces: 8
- Diffuse bounces: 4
- Transparent bounces: 8
- Final denoising: enabled, subject to neck-crop comparison

Run a 1024-sample escalation if the neck, rim, or thread highlights remain noisy
or if denoising smears adjacent highlights. Geometry is never changed to solve
sampling artifacts.

Use AgX with a neutral look. Exposure and light energy protect highlight detail;
glass materials are not darkened to compensate for excessive lighting. Clear
glass must not acquire a yellow cast from the warm background.

Shadow caustics may be tested as an A/B comparison. They remain enabled only if
the base and floor response improve without unacceptable noise.

## Quality-control renders

Render all four variants using identical geometry, camera, lights, background,
exposure, color management, and Cycles settings. Only the assigned material may
change.

Produce:

- Four full-frame masters: clear, amber, cobalt, frosted
- A four-up comparison sheet
- 200% diagnostic crops for each variant:
  - mouth and thread region
  - shoulder transition
  - lower sidewall and base
- Raw undenoised and denoised neck crops at matching samples

The build also generates a machine-readable audit report containing geometry
hashes, material parameters, light transforms/energies/sizes, camera settings,
Cycles settings, color-management settings, and source/output paths.

## Acceptance gates

### Geometry and scene safety

- Source scene hash is unchanged.
- Body mesh and finish fingerprints match the immutable values.
- Bottle and camera transforms match the source.
- No geometry modifier, edit, rescale, normal rewrite, or smoothing change is
  introduced.
- Geometry is locked in the new master.
- All derivatives share identical non-material scene fingerprints.

### Clear

- Edges read immediately against the warm light background.
- Controlled dark and light ribbons describe curvature.
- No giant blown-out central white panel.
- Inner wall, bore, rim, shoulder, threads, and base thickness remain visible.

### Amber

- Center is lighter than edges.
- Edges, shoulder, threads, and base deepen through optical path length.
- Base remains transparent rather than opaque black.
- Specular reflections remain neutral.

### Cobalt

- Deep true cobalt, not neon or electric blue.
- Center remains luminous.
- Edges, threads, shoulder, and base deepen naturally.
- Specular reflections remain neutral.

### Frosted

- Reads as acid-etched glass.
- Soft transmission and white specular reflection coexist.
- No visible procedural grain.
- Rim, shoulder, edges, and base retain physical glass thickness.

### All variants

- Threads remain crisp and separate in raw and denoised crops.
- No faceting, highlight clipping, denoising smear, floating base, artificial
  black contact line, or inconsistent background color.
- Small concentrated contact shadow sits directly under the base.
- Larger soft shadow falls away from the left key toward the right.

## Deliverable paths

The implementation will produce new files beneath:

- `pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio/`
- `pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio/`

Expected scene names:

- `009ml-luxury-master.blend`
- `009ml-clear-luxury.blend`
- `009ml-amber-luxury.blend`
- `009ml-cobalt-luxury.blend`
- `009ml-frosted-luxury.blend`

The approved source scenes are never overwritten. Final reporting includes the
material graph, light table, camera and Cycles settings, color management,
geometry audit findings, and before/after render paths.
