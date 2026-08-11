# Swirl bottle clay geometry redesign

Date: 2026-08-11
Status: Design approved by Jordan Richter; awaiting written-spec review

## Objective

Replace the inaccurate eight-flute swirl body with a controlled comparison of
10-flute and 12-flute molded-body candidates. Evaluate the geometry in neutral
clay so transparent-glass refraction cannot conceal or exaggerate the relief.

Only the swirl body is in scope. The approved 17-415 neck, band, thread mesh,
camera, backdrop, and studio remain locked and unchanged.

## Visual authority

Primary reference:

`/Users/jordanrichter/Downloads/Gemini_Generated_Image_1swl811swl811swl.png`

The reference shows approximately five to six repeating channels across the
visible front half, implying roughly 10–12 flutes around the complete
circumference. Because no factory mold drawing is available, flute count and
relief shape remain photo-solved rather than factory-verified.

Authoritative supplied dimensions remain:

- Height without cap: `74 ±1 mm`
- Maximum diameter: `21 ±0.5 mm`
- Neck finish: `17-415`

## Candidate geometry

Create two isolated working candidates:

| Candidate | Flutes | Body-region rotation | Maximum inward depth |
|---|---:|---:|---:|
| A | 10 | 90° | 0.75 mm |
| B | 12 | 90° | 0.75 mm |

Both candidates use the same envelope, twist, depth, shoulder transition, heel
transition, camera, and lighting. Flute count is the only comparison variable.

The molded cross-section must use:

- Narrow concave recessed channels
- Broad rounded outer lands
- Steeper but smoothly filleted channel shoulders
- A constant-depth plateau over most of the body
- Short `2.5–3.0 mm` fades near the shoulder and heel
- A smooth, unmodulated inner cavity
- Minimum remaining wall thickness of `0.8 mm`

The relief cuts inward from the 21 mm maximum-diameter envelope. No raised
geometry may exceed that envelope.

## Locked neck boundary

The existing approved neck and thread source fingerprint remains:

`016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`

The redesign must not alter:

- Neck or bore diameters
- Finish height
- Thread pitch, turns, phase, overlap, or runout shape
- Junction-band dimensions or position
- Shoulder-to-neck attachment datum
- Neck material or visibility

The swirl subdivision and modulation operations stop below the finish datum.

## Clay diagnostic presentation

Apply a neutral matte clay material only to the swirl body. The locked neck,
band, and threads remain in their current clear-glass material so the boundary
between new and protected geometry is explicit.

Render each candidate from:

1. Front elevation
2. Three-quarter view

Use the existing studio, camera language, and key light. Do not promote either
candidate to the locked master during this comparison.

## Selection criteria

The selected candidate must:

- Match the reference's visible five-to-six-channel front rhythm
- Maintain strong relief from near the shoulder to near the heel
- Read as molded indentations rather than painted or inflated ribbons
- Avoid pinching, sharp screw-thread edges, or a faceted outer silhouette
- Preserve the 21 mm diameter envelope and `0.8 mm` wall gate
- Preserve the locked 17-415 thread fingerprint exactly

Jordan will select either the 10-flute or 12-flute candidate after reviewing
the four clay diagnostics. Glass-material development resumes only after the
body geometry is approved.

## Verification

- Pure geometry tests confirm both candidate counts, 90° rotation, 0.75 mm
  inward-only depth, short end fades, and minimum wall thickness.
- Blender integration tests confirm the protected neck/thread fingerprint is
  unchanged and no body vertex exceeds the 21 mm diameter envelope.
- Candidate files and renders stay under working/diagnostic paths until one
  version receives explicit approval.
