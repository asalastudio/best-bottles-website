# Component register — catalogue glass bodies (Sunburst)

Jordan, 2026-09-25: after the 9 mL Cylinder pilot, generate every glass body the catalogue sells with the
same method; these become the source-of-truth bodies for the whole catalogue. Clear glass carries exactly
the product-page hero bone, and Build Your Bottle uses the same bone (PR #264).

## Pipeline (`scripts/register/bodies/`)

| step | script | output |
|---|---|---|
| inventory | `inventory.py` | `data/register/bodies/inventory.csv`: every current glass body × glass colour, its SKU-named master PSDs, its measurements |
| cut | `cut_bodies.py` | the bare body per plate: the largest layer standing on the lowest baseline, else the kit lane's body layer; decisions in `source-overrides.json` |
| inputs | `build_bodies.py inputs` | one master geometry per body (its Clear cut, else its first glass), longest side 2000 px; each other glass's own photo fitted to it, or the pilot reference glass |
| render | `render_bodies.mjs` | `gpt-image-2.5-sunburst`, quality high, transparent background, the pilot's prompts; resumable |
| qa | `build_bodies.py qa` | fit back to the master, alpha locked, Clear and Swirl baked on `#F5F3EF`, both scales recorded, review sheets |
| load | `push-bodies.ts` | `registerBodyPlates` on dev; approvable = status ok and scale gap ≤ 5% |

Pixels live in `output/register-bodies/` (gitignored). Numbers live in `data/register/bodies/bodies-measurements.json`.

## Rules carried from the pilot

- **One geometry per body.** Every glass of a body is rendered from the same master outline and fitted back
  to it, so every glass has the same size and anchors, and the components fit them all alike.
- **Bone.** Clear and Swirl are levelled so the render's paper white is 255, then multiplied onto `#F5F3EF`,
  so the see-through glass is exactly the hero bone. Draw them normally on a bone stage: never multiply again.
  Frosted keeps its white, which is the finish, and coloured glass is kept as rendered.
- **Scale is metadata.** Each plate records a height-based scale (the pilot rule: recorded bare height, plus
  the 6° camera tilt term for round bodies) and a width-based scale. Stoppered ground-glass bodies use width,
  because their top is the stopper. A gap over 5% between the two is flagged and left at "measured" until
  it is ruled on. Correcting a scale never needs a re-render.

## Exclusions (11)

| plate | why |
|---|---|
| cream-jar-60ml-58mm Frosted | plastic, not glass |
| marble-decorative-5ml, marble-decorative-10ml | metal-and-wood decorated bottles; sleeve and cap in one layer |
| lotion-bottle-30ml-18mm, lotion-bottle-30ml-no-neck, lotion-bottle-3ml-Snap-On, royal-14ml-11mm | bottle and closure are one merged layer; no bare glass |
| cylinder-30ml-18-415 Clear | the fixed 30 mL spray pair (a neck-matrix exception); one piece |
| pillar-9ml-17-415 Clear | no master PSD; the only Pillar file is the 13-415 roll-on |
| vial-3ml-13-425 Blue, Green | no master PSD under any name |

## Flags for review (kept, not approved automatically)

- Round 78 mL: only a capped photo exists, so the body has no neck (closures cover it).
- Vial 1 mL plug: the source layer carries the applicator's outline inside the vial.
- Cylinder 3.3 mL and 4 mL (12 mm): the atomizer's inner tube is part of the body layer.
- Amber vials (1 mL plug, 2 mL 8-425): a pale panel from the source photo survives two renders.
- Bell is sold as 10 mL, but the master library files it as Bell 12 mL.

## Source fixes applied (see `source-overrides.json`)

- Slender bodies (the 9 mL tall Cylinder) were dropped by the dip-tube filter; named explicitly.
- Six clear bodies (Rectangle 10, Tulip 6, Sleek 5/30/50, Diva 100) carried the retoucher's white fill patches
  beyond the glass; stripped by flood fill from the edge (clear glass only).
- Teardrop: stopper and bottle merged in one layer; cropped to the bottle.
- Where colour comes from adjustment layers (the Green Teardrop is a blue photo under a Hue/Saturation), the
  colour is taken from Photoshop's saved composite, masked by the body layer.

## Clear glass renders opaque

On a transparent canvas Sunburst often leaves clear glass part see-through with blocky partial alpha, which
reads as a grey panel once baked. Clear and Swirl therefore render on white (as the photos were shot); the
master outline is the alpha and the interior is baked to exactly `#F5F3EF`. Coloured and frosted glass render
on a transparent canvas.
