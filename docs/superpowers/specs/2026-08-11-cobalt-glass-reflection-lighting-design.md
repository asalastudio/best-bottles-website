# Cobalt glass and reflection-lighting design

Date: 2026-08-11  
Status: Approved direction; awaiting written-spec review  
Subject: 9 ml / drawing-labeled 10 ml cobalt cylinder with 17/415 finish

## Objective

Keep the accepted bottle render intact except for the cobalt material and its
controlled reflection. The revised bottle must read as luminous, smooth,
transparent cobalt glass with dark edge density and a clean curved vertical
highlight. It must not read as frosted, cloudy, matte, or purple.

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

All experimentation happens in a new working copy. The locked baseline is
never overwritten.

## Current-state diagnosis

The body, finish, and thread objects use the single material
`BB_MAT_GLASS_COBALT`. The lower haze is not a separate frosted material or a
special lower-body region. The complete body has one material slot.

The current shader uses:

- Principled transmission: `1.0`
- IOR: `1.5`
- Roughness: `0.04`
- Volume absorption color: `(0.09, 0.16, 0.88, 1.0)`
- Volume absorption density: `1.4`
- Noise texture connected through a bump node

The cloudy lower-body read is therefore a combined result of the procedural
surface bump, strong volume absorption, and broad illumination gradient.

## Chosen approach

Use a hybrid material-and-reflection pass:

1. Clean and brighten the cobalt shader.
2. Preserve the existing shadow-producing key softbox without changing its
   transform, size, emission, or gradient.
3. Add a separate narrow reflection-only softbox that shapes the curved
   vertical highlight but does not become the primary diffuse light or alter
   the accepted floor shadow.

This separates two jobs that should not be coupled: the existing key controls
the scene lighting and shadow, while the new strip controls the glass
reflection.

## Cobalt shader design

The material retains physically plausible transmitted glass:

- Keep IOR at `1.5`.
- Keep transmission at `1.0`.
- Disconnect the noise-to-bump path for the primary polished-glass candidate.
- Test roughness narrowly between `0.02` and `0.04`; do not introduce a matte
  clearcoat or diffuse blue surface layer.
- Increase blue saturation while reducing absorption density from the current
  `1.4`. Evaluate a compact density sweep of `0.65`, `0.85`, and `1.05`.
- Preserve dark edges through real wall thickness and volume travel rather
  than painted edge gradients.

The selected material must show a brighter electric-blue body center, darker
side walls and base thickness, readable transparency, and a smooth surface
from shoulder to heel. The lower 60 percent must not contain the current gray
or frosted veil.

## Reflection-only softbox design

Create one new emissive mesh card named
`BB_CARD_COBALT_REFLECTION_STRIP` in the LIGHTING collection.

- Form: tall, narrow rectangle with a soft vertical falloff.
- Initial physical range: 40–70 mm wide and 180–300 mm tall.
- Placement: left-front quadrant relative to the camera, aimed so its
  reflection bends around the bottle's left curvature.
- Color: neutral white; no blue tint is baked into the light.
- Visibility: glossy/reflection rays only. Use a Light Path–controlled shader
  that is transparent to camera and non-glossy rays.
- The card must not replace or move `BB_LIGHT_KEY_SOFTBOX`.

The target reflection is a continuous curved vertical highlight with a
controlled shoulder catch, similar to the supplied cobalt reference. It
should explain the bottle's cylindrical curvature without becoming a flat
white stripe or clipping the thread detail.

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

No website files, catalog data, bottle dimensions, thread geometry, backdrop
color, or camera framing are in scope for this pass.

## Blender workspace behavior

The working file opens with three understandable views:

- `SCENE OVERVIEW`: the complete studio with labeled cards, camera, sweep,
  and subject.
- `PRODUCT DETAIL`: the bottle framed and X-Ray disabled.
- `LIGHTING PREVIEW`: a rendered/material preview for evaluating the cobalt.

The main panel remains a 3D Viewport, not a Python Console. `Home` frames the
entire studio; `Numpad 0` opens the render camera; selecting the bottle and
pressing `Numpad .` frames the product.

## Evaluation workflow

1. Duplicate the immutable baseline into a new working file.
2. Record the locked camera, backdrop, and light transforms.
3. Render the three cobalt-density candidates with the existing lighting.
4. Select the best material candidate before adding the reflection strip.
5. Render a small position/width grid for the reflection strip.
6. Compare the finalist against the approved baseline and cobalt reference.
7. Run the 17/415 dimensional test and confirm the locked-scene assertions.
8. Deliver full-bottle, thread macro, and labeled studio-overview images.

## Acceptance criteria

A candidate passes only when all of the following are true:

- The background color and gradient match the approved baseline.
- The right-cast 2:00 floor shadow retains its direction, softness, and visual
  weight.
- The bottle is visibly luminous cobalt rather than purple, gray, or opaque.
- The lower body is smooth and clear, with no frosted veil.
- The edges and base remain darker because of glass thickness.
- The new highlight curves with the cylinder and remains controlled through
  the shoulder and finish.
- The 17/415 top-half, middle-full, and bottom-half thread presentation is
  unchanged.
- Camera framing and product placement are unchanged.
- The studio workspaces remain navigable and the bottle is immediately
  visible in `PRODUCT DETAIL`.

## Failure handling

- If the reflection card changes the floor shadow, it is not reflection-only;
  correct its ray visibility before evaluating placement.
- If the center becomes cyan or washed out, restore a deeper absorption color
  before increasing density.
- If the bottle remains cloudy, verify the noise/bump connection is removed
  before changing the lights.
- If the highlight becomes a flat white stripe, narrow or rotate the card;
  do not move the accepted key.
- If any locked transform or thread test changes, reject the candidate and
  rebuild it from the immutable baseline.

