# Component register — catalogue glass bodies (Sunburst)

Jordan, 2026-09-25: after the 9 mL Cylinder pilot, generate every glass body the catalogue sells with the
same method; these become the source-of-truth bodies for the whole catalogue. Clear glass carries exactly
the product-page hero bone, and Build Your Bottle uses the same bone (PR #264).

## Pipeline (`scripts/register/bodies/`)

| step | script | output |
|---|---|---|
| inventory | `inventory.py` | `data/register/bodies/inventory.csv`: every current glass body × glass colour, its SKU-named master PSDs, its measurements |
| cut | `cut_bodies.py` | the bare body per plate: the largest layer standing on the lowest baseline, else the kit lane's body layer; decisions in `source-overrides.json` |
| inputs | `build_bodies.py inputs --pass lit` | one master geometry per body (its Clear cut, else its first glass), longest side 2000 px, its row-filled silhouette as the master mask; the reference glass of each colour fitted to the canvas; named necks trimmed at the glass rim |
| render | `render_bodies.mjs --pass lit` | `gpt-image-2.5-sunburst`, quality high; each job carries its prompt (three numbered lines) and, for the edited necks, one extra line; resumable |
| qa | `build_bodies.py qa --pass lit` | fit back to the master, the render's own outline kept, Clear and Swirl baked on `#F5F3EF`, anchors and both scales measured on the plate, review sheets |
| load | `push-bodies.ts` | `registerBodyPlates` on dev; approvable = status ok and (scale gap ≤ 5% or accepted in `rulings.json`); held plates load as measured |

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

## Second pass (2026-09-25, `--pass lit`)

Jordan's review of the first pass: the plates read as the Photoshop cuts, not as Sunburst glass ("they look
like Photoshop images that haven't been rendered yet"); use the actual glass reference images on file; the
reducer photographed in the Grace, Empire and Diamond necks and the plug in the Tola necks come out; the 1 mL
and 2 mL vials were defective; and "we need clean edges" — as the paper-doll source of truth the plates were
unusable. Everything but the pilot body was re-rendered.

- **Every plate renders from two images**: the master geometry and the reference glass of its colour. Clear,
  frosted, cobalt blue and swirl are the pilot cylinder renders (`output/register-phase3/pilot/sunburst/renders/`);
  amber is the Boston round 30 mL amber rendered from its own photo in the first pass ("Boston round amber is
  good reference"). Prompts stay three numbered lines: geometry locked to the first image; lighting and finish
  (and, for coloured glass, colour and material) from the second; enhance. Frosted needs the word: with the
  colour prompt alone the model keeps the glass clear (Round 78 test), so frosted plates say "frosted satin
  glass" and add the body's own frosted photo as a material image where one exists. Green, blue and white have
  no reference on file: green and blue keep the own-photo material recipe; white masters take the clear
  reference for lighting and keep their own colour.
- **Neck edits** (`NECK_EDITS`, rows on the master cut): the insert above the glass rim is trimmed, the master
  mask ends at the rim (the seat moves down to the glass), and one extra prompt line asks for an empty mouth.
  Grace 55, Empire 50 and 100, Diamond 60, Slim 30 and 100, Diva 30 and 46, Circle 30 and 50 (orifice reducer); Tola 3 and 6 mL (plug); Boston round 60 (roller ball
  and housing); the 12 mm atomizer cylinders 3.3 and 4 mL (nothing to trim: the line asks for an empty bottle, and
  the pump, spring and tube photographed inside the glass are gone).
- **The plate keeps the render's own outline.** The first pass clipped every render to the photo cut's mask
  enlarged 2–4×, and the cut's soft, ragged edge and a bone fringe where the mask overhung the render came with
  it. Now the fitted render's alpha is the plate (opaque Clear renders: the row span of the ink; pieces under
  0.5% of the area dropped); the master mask is only the fit target and the gate (IoU ≥ 0.97, interior holes
  ≤ 2%); anchors and scale are measured on the plate itself.
- **Master mask = row-filled silhouette.** The PSD cuts of clear bodies carry see-through interiors (up to 73%
  of the area on the tall cylinders); a glass body's silhouette has no holes. The 1 mL vial's mask also stops at
  the ink, its cut carries white paper outside the glass (the notch Jordan flagged).
- **The Tola plug is its own part**: `LIB-14.3mm-Plug` (type plug-applicator, slot cap); the head photographed
  above the rim is the seated layer, head plus a synthesised stem the exploded layer, cut in canvas space at the
  3 mL plate's px/mm (`plug_layers`); both Tola SKUs build `cap:LIB-14.3mm-Plug`. The two Tola cuts are one
  photo (same sha256) filed under two heights, 42 and 48 mm; the 6 mL plate is that photo at the 6 mL scale.
- The pilot body (Cylinder 9 mL 17-415) renders for the gallery like every other body; `push-bodies.ts` skips it, dev
  keeps its Phase 3 plates.
- **Colour rules from Jordan's gallery review.** Clear and Swirl plates are colourless by construction: after the
  bone levelling only luminance is kept, then the bone tint (the Eternal Flame had come out green). A plate whose photo
  carries the true colour renders from that photo with the clear reference for lighting (`OWN_COLOUR`: the Genie
  "Cobalt Blue" is aqua blue). A glass the catalogue does not list but the product is sold in is added as an extra
  plate copied from another glass of the body (`EXTRA_PLATES`: the Pear decorative is cobalt and clear; its only
  photo is the cobalt one). A dark seam down the axis of a photo (the Royal 13) is erased before rendering
  (`ERASE_AXIS_SEAM`). The Slim 50's product PSDs have no neck (every body layer stops under the cap); its cut comes
  from the hidden bare-bottle layer of the sideview photo (`source-overrides.json`; `cut_bodies.py --only`).

Outputs: `jobs-lit.json`, `renders-lit/`, `final-lit/`, `review-bodies-lit-N.png`; the measurements file is the
same `bodies-measurements.json` (every entry records `render.pass` and `checks.edges`). Rulings live in
`data/register/bodies/rulings.json`: the 63 scale flags accepted from the gallery review; the ten plates Jordan
held (reducer, plug, the two vials) were re-rendered and released on dev for review; the 20 mL white cream jar is
held: its cut (CJWhite20.psd Layer 1) is a shallow white dish, not the jar body, and needs a re-cut.

## Flags for review (kept, not approved automatically)

- Round 78 mL: every Clear layer in the library stops at the shoulder under the cap, so the body had no neck. Second
  pass: its own Frosted photo is the master geometry (`MASTER_GLASS`), and Clear renders from it with the clear reference.
- Round 128 mL: the Clear cut carries a white highlight blob on the right of the disc; the mask now stops at the ink
  (`MASK_FROM_INK`), which had widened the fit and squashed the plate (Jordan: "Round has to be redone").
- Vial 1 mL plug: the source layer carries the applicator's outline inside the vial (second pass: mask stops at the ink; re-rendered clean).
- Cylinder 3.3 mL and 4 mL (12 mm): the atomizer's inner tube is part of the body layer (second pass: rendered empty by the prompt line).
- Amber vials (1 mL plug, 2 mL 8-425): a pale panel from the source photo survived two first-pass renders (the cut's see-through interior punched through the mask; gone with the row-filled mask and the render's own outline).
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
