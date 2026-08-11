# Five-variant cylinder glass and swirl design

Date: 2026-08-11
Status: Five-variant scope awaiting final written-spec review
Subject: Cylinder bottle family in clear, frosted, cobalt, amber, and molded
swirl; shared 17/415 finish

## Objective

Build a consistent five-variant product family while preserving the accepted
render's photographic quality. Clear, frosted, cobalt, and amber share the
exact approved smooth body geometry. Swirl is a dedicated molded-helical body
with its own measured overall envelope. All five instance the exact same
locked 17/415 finish and thread master.

Material and reflection changes must not alter the accepted background,
camera, composition, or 2:00 right-cast shadow. The accidental cloudy lower
body is removed from clear, cobalt, amber, and swirl. Frosted remains
intentionally and uniformly satin because frosting is its product truth.

The cobalt target is an electric royal blue with a luminous center and dark
blue edges. The amber target is a rich dark amber with a warm luminous center,
not pale orange and not nearly black.

Clear is polished, colorless, and optically clean. Frosted is evenly diffused
without a patchy lower veil. Swirl is polished clear glass whose real molded
indentations create the spiral highlights and refraction.

The accepted background, camera, composition, 17/415 thread geometry, and
2:00 right-cast shadow are locked and must remain visually and numerically
unchanged.

## Source of truth and rollback

- Approved reference render:
  `pipeline/paper-doll-3d/renders/approved/009-cobalt-approved-baseline-2026-08-11.png`
- Immutable Blender baseline:
  `pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend`
- Cobalt appearance reference:
  `/Users/jordanrichter/Downloads/IMG_4779.jpg`
- Amber direction: the same polished, luminous treatment as cobalt while
  retaining a beautiful dark-amber identity.
- Amber surface reference:
  `/Users/jordanrichter/Downloads/ChatGPT Image Jul 20, 2026, 11_01_15 PM.png`
- Swirl geometry references:
  `/Users/jordanrichter/Downloads/Gemini_Generated_Image_1swl811swl811swl.png`
  and
  `/Users/jordanrichter/Downloads/Gemini_Generated_Image_tpwaqbtpwaqbtpwa (1).png`
- Swirl authoritative measurements supplied by Jordan:
  height without cap `74 ±1 mm`, diameter `21 ±0.5 mm`, finish `17-415`.

All experimentation happens in a new working copy. The locked baseline is
never overwritten.

## Geometry contract

| Variant | Body geometry | Finish and threads | Material behavior |
|---|---|---|---|
| Clear | Approved smooth cylinder | Exact locked 17/415 master | Polished colorless glass |
| Frosted | Approved smooth cylinder | Exact locked 17/415 master | Uniform satin frosting |
| Cobalt | Approved smooth cylinder | Exact locked 17/415 master | Luminous royal-blue absorption |
| Amber | Approved smooth cylinder | Exact locked 17/415 master | Luminous dark-amber absorption |
| Swirl | Dedicated indented helical mold | Exact locked 17/415 master | Polished colorless glass |

The finish is instanced, never rebuilt, scaled, twisted, or deformed per
variant. Swirl geometry ends below the shoulder and cannot propagate into the
finish or its attachment datum.

## Swirl dimensional and visual authority

The measured overall constraints are authoritative:

- Height without cap: `74 ±1 mm`
- Maximum outside diameter: `21 ±0.5 mm`
- Neck finish: `17-415`

No dimensioned swirl mold drawing is currently available. Flute count, total
twist, and indentation depth are therefore visually calibrated from the
supplied references and must be labeled as photo-solved, not factory-verified.

The swirl is modeled as real multi-start helical indentation geometry, not a
normal map, bump texture, painted ribbon, or displacement used only at render
time. Its maximum radius stays within the measured diameter envelope; the
pattern cuts inward from that envelope. The inner cavity remains smooth, as
expected from molded/blown glass, while the outer mold carries the relief.
Minimum wall thickness must remain at least `0.8 mm` everywhere.

Use a compact visual calibration grid rather than an unconstrained search:

- Flute count candidates: `8`, `10`, and `12`
- Body-region twist candidates: `55°`, `70°`, and `85°`
- Maximum indentation-depth candidates: `0.35`, `0.55`, and `0.75 mm`

First match the broad diagonal rhythm and negative-space shape in front
elevation, then verify it in three-quarter and spin views. The selected body
must remain inside the height and diameter tolerances and attach to the
unmodified finish master.

## Current-state diagnosis

Each smooth body, finish, and thread set uses one glass material. The lower
haze seen in the current cobalt and amber is not a separate frosted material
or special lower-body region. The complete body has one material slot.

The current colored-glass shaders share:

- Principled transmission: `1.0`
- IOR: `1.5`
- Roughness: `0.04`
- Volume absorption density: `1.4`
- Noise texture connected through a bump node

Their current absorption colors are:

- Cobalt: `(0.09, 0.16, 0.88, 1.0)`
- Amber: `(0.578, 0.390, 0.155, 1.0)`

The cloudy lower-body read is therefore a combined result of the procedural
surface bump, strong volume absorption, and broad illumination gradient.

## Shared material and lighting approach

Use one shared hybrid material-and-reflection implementation with separately
calibrated material variants:

1. Clean and brighten the polished-glass shaders.
2. Preserve the existing shadow-producing key softbox without changing its
   transform, size, emission, or gradient.
3. Add one separate narrow reflection-only softbox that shapes the curved
   vertical highlight but does not become the primary diffuse light or alter
   the accepted floor shadow.

This separates two jobs that should not be coupled: the existing key controls
the scene lighting and shadow, while the new strip controls the glass
reflection. Its grazing angle also reveals the swirl's real ridge tops and
troughs without changing the floor shadow.

## Glass shader designs

The material retains physically plausible transmitted glass:

- Keep IOR at `1.5`.
- Keep transmission at `1.0`.
- Disconnect the noise-to-bump path for the primary polished-glass candidate.
- Test roughness narrowly between `0.02` and `0.04`; do not introduce a matte
  clearcoat or diffuse blue surface layer.
- Calibrate absorption color and density independently for cobalt and amber.
  Do not use one shared density simply because both use the same node graph.
- Preserve dark edges through real wall thickness and volume travel rather
  than painted edge gradients.

Variant rules:

- Clear: no colored volume absorption; polished roughness `0.02–0.04`; no
  procedural frosting bump.
- Frosted: colorless glass with uniform micro-roughness and micro-normal
  treatment over the complete bottle. The intentional frosting cannot fade
  into a random lower-body patch.
- Cobalt: calibrated royal-blue volume absorption.
- Amber: independently calibrated dark-amber volume absorption.
- Swirl: the polished clear shader on true relief geometry. The spiral read
  comes from modeled refraction and reflections, not a texture imitation.

Evaluate these compact starting sweeps:

- Cobalt density: `0.65`, `0.85`, and `1.05`, with a more saturated royal-blue
  absorption color than the current material.
- Amber density: `0.75`, `0.95`, and `1.15`, retaining a dark brown-amber edge
  while allowing warm honey light through the center.

The selected cobalt material must show a brighter electric-blue center with
dark blue side walls and base thickness. The selected amber material must show
a warm luminous center with rich dark-amber side walls and base thickness.
Both colored variants need readable transparency and a smooth surface from
shoulder to heel. Clear and swirl need clean colorless transmission. The lower
60 percent of every polished variant must not contain the current gray or
frosted veil.

## Reflection-only softbox design

Create one new emissive mesh card named
`BB_CARD_GLASS_REFLECTION_STRIP` in the LIGHTING collection.

- Form: tall, narrow rectangle with a soft vertical falloff.
- Initial physical range: 40–70 mm wide and 180–300 mm tall.
- Placement: left-front quadrant relative to the camera, aimed so its
  reflection bends around the bottle's left curvature.
- Color: neutral white; no blue tint is baked into the light.
- Visibility: glossy/reflection rays only. Use a Light Path–controlled shader
  that is transparent to camera and non-glossy rays.
- The card must not replace or move `BB_LIGHT_KEY_SOFTBOX`.
- Its transform, dimensions, color, and ray behavior are shared by all five
  variants so the product family retains one consistent photographic
  language.

The target reflection is a continuous curved vertical highlight with a
controlled shoulder catch, similar to the supplied cobalt reference. It
should explain the smooth cylinders' curvature and rake across the swirl
indentations without becoming a flat white stripe or clipping thread detail.

## Locked scene elements

The following values are copied from the immutable baseline and asserted
before accepting a result:

- `BB_CAM_MASTER` transform and lens
- `BB_STUDIO_SWEEP` geometry, transform, and material
- `BB_LIGHT_KEY_SOFTBOX` transform, dimensions, material, and emission
- `BB_CARD_FILL_RIGHT` transform and emission for the first pass
- `BB_CARD_TOP` transform and emission for the first pass
- `BB_LIGHT_SWEEP_WASH` transform and emission
- Product transform and 17/415 geometry
- Smooth body geometry for clear, frosted, cobalt, and amber
- Swirl overall height, maximum diameter, and finish attachment datum

No website files, catalog data, thread geometry, backdrop color, or camera
framing are in scope for this pass. Only the swirl body relief is new geometry.

## Blender workspace behavior

The working file opens with three understandable views:

- `SCENE OVERVIEW`: the complete studio with labeled cards, camera, sweep,
  subject, and shared reflection strip.
- `PRODUCT DETAIL`: the bottle framed and X-Ray disabled.
- `LIGHTING PREVIEW`: rendered/material previews for evaluating all five
  variants.

The main panel remains a 3D Viewport, not a Python Console. `Home` frames the
entire studio; `Numpad 0` opens the render camera; selecting the bottle and
pressing `Numpad .` frames the product.

## Evaluation workflow

1. Duplicate the immutable baseline into a new working file.
2. Record the locked camera, backdrop, and light transforms.
3. Render the clear and frosted shader proofs.
4. Render the three cobalt-density candidates with the existing lighting.
5. Render the three amber-density candidates with the existing lighting.
6. Select one material candidate per color before adding the reflection strip.
7. Render a small position/width grid for the shared reflection strip.
8. Build and compare the constrained swirl calibration grid against its
   references and measured envelope.
9. Render the selected swirl body in front, three-quarter, macro, and spin
   views.
10. Compare all five finalists against the approved photographic baseline and
    their variant-specific material/geometry direction.
11. Run the 17/415 dimensional test and locked-scene assertions for all five;
    run height, diameter, attachment, and wall-thickness checks for swirl.
12. Deliver full-bottle, thread macro, and labeled studio-overview images for
    every variant, plus the swirl geometry proof views.

## Acceptance criteria

A candidate passes only when all of the following are true:

- The background color and gradient match the approved baseline.
- The right-cast 2:00 floor shadow retains its direction, softness, and visual
  weight.
- The cobalt bottle is visibly luminous royal blue rather than purple, gray,
  or opaque.
- The amber bottle is visibly luminous dark amber rather than pale orange,
  muddy gray, or nearly black.
- The cobalt and amber lower bodies are smooth and clear, with no frosted veil.
- Clear is neutral and polished without gray absorption.
- Frosted is intentionally uniform from shoulder to heel, never patchy.
- Swirl is real indented helical geometry, not a surface texture.
- Swirl height is within `74 ±1 mm` and maximum diameter within
  `21 ±0.5 mm`.
- Swirl minimum wall thickness is at least `0.8 mm`.
- The edges and base remain darker because of glass thickness.
- The shared highlight curves with each cylinder and remains controlled
  through the shoulder and finish.
- The 17/415 top-half, middle-full, and bottom-half thread presentation is
  unchanged across all five variants.
- Camera framing and product placement are unchanged.
- The studio workspaces remain navigable and the bottle is immediately
  visible in `PRODUCT DETAIL`.

## Failure handling

- If the reflection card changes the floor shadow, it is not reflection-only;
  correct its ray visibility before evaluating placement.
- If cobalt becomes cyan or washed out, restore a deeper royal-blue absorption
  color before increasing density.
- If amber becomes yellow-orange, deepen the brown-red absorption balance
  before increasing density.
- If cobalt or amber remains cloudy, verify the noise/bump connection is
  removed before changing the lights.
- If clear or swirl appears gray, inspect absorption and world/reflection
  contamination before changing geometry.
- If frosted develops a clear-to-cloudy vertical gradient, correct material
  uniformity before changing the studio.
- If swirl reads as painted, increase real relief evidence through geometry
  and grazing reflection; do not add a fake stripe texture.
- If swirl exceeds its envelope or violates wall thickness, reject that relief
  candidate even if its render looks attractive.
- If the highlight becomes a flat white stripe, narrow or rotate the card;
  do not move the accepted key.
- If any locked transform or thread test changes, reject the candidate and
  rebuild it from the immutable baseline.
