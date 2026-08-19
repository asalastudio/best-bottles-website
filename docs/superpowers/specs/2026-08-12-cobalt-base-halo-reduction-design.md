# Cobalt Base Halo Reduction Design

## Objective

Reduce the bright reflected halo around only the bottom base of the approved
9 ml cobalt bottle by approximately 15%, while preserving the grounded contact
shadow and every approved subject and studio attribute above the base.

## Locked Elements

- Bottle body and 17-415 finish geometry
- Bottle and floor position at Z = 0
- Cobalt material and absorption density
- Camera and packshot orientation
- Main curved diffusion scrim
- Left physical key and rightward cast shadow
- Top and neck fill
- Warm bone background and exposure

## Proposed Control

Add one removable object named `BB_FINAL_BASE_HALO_CONTROL_15` to the existing
final-lock studio collection. It is a low, wide neutral-gray reflection card
placed outside the camera frame and aimed only at the bottom few millimeters of
the bottle.

The card:

- is visible to glossy rays;
- is invisible to camera, diffuse, transmission, and shadow rays;
- does not illuminate the bottle or floor;
- uses a neutral value 15% below the surrounding warm-bone reflection field;
- carries metadata identifying the 15% base-halo experiment;
- can be disabled or deleted without affecting the grounded-contact candidate.

## Evaluation

Render a new non-overwriting candidate and a 200% base crop. Compare it against
the grounded-contact candidate.

Pass only when:

- the pale lower rim is approximately 15% quieter;
- the contact shadow still begins at the base and opens softly rightward;
- the base remains transparent cobalt glass rather than a black puck;
- no dark outline or gray stripe appears;
- the body, shoulder, neck, threads, camera, and background remain unchanged.

If the card creates a stripe, contaminates the cobalt, or weakens grounding,
reject the experiment and retain the current grounded-contact candidate.

## Deliverables

- New removable-card Blender scene
- New full-frame Cycles render
- Before/after 200% base diagnostics
- Geometry, camera, floor-elevation, and ray-visibility verification
