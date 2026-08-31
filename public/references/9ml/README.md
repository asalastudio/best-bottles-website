# 9 mL roll-on reference photographs

Shot by Jordan, 2026-08-30, one session, phone. Cap off, plain background
visible on both sides, soft front-side light, **0.00% clipping** — which is
what makes them usable, and what the retouched catalogue set is not (those are
100% blown to pure white on the glass).

Load these in the Material Lab (`/dev/material-lab` -> REFERENCE) and compare
side-by-side or as an overlay while tuning.

## Measured transmission (glass / background, EXIF-corrected)

| | R | G | B | note |
|---|---|---|---|---|
| amber   | 0.185 | 0.105 | 0.073 | textbook ordered falloff, sat 0.63 |
| clear   | 0.643 | 0.652 | 0.675 | neutral — clear glass is not invisible |
| frosted | 1.268 | 1.332 | 1.438 | BRIGHTER than background: it scatters forward |

## Do NOT paste these numbers straight into attenuationColor

They were tried that way and produced dark, murky glass. The ratio includes
surface reflection, refraction and the shadowed interior — it is not pure
volume absorption, which is the only thing `attenuationColor` models.

What they are good for:
- **side-by-side judgement** in the lab — the primary use
- **hue and ordering** — amber's R > G > B falloff confirms the colour balance
- **catching gross errors** — if a preset is blue-ish or inverted, this shows it

The approved preset values remain EYE-SET against these photographs.

## swirl.jpg is GENERATED — art direction only

`swirl.jpg` is not a photograph. No physical swirl bottle was available, so it
was generated to the shoot spec (bone ground, soft front-side light, contact
shadow, 0.02% clipping) specifically so it can be compared against the other
three in the lab.

Jordan confirms the flute form here is ACCURATE to the real part.

An earlier note in this file claimed the flutes were far too deep, reasoning
that the catalogue's O21 swirl against the plain O20 implied only ~1 mm of
relief. That inference was wrong: **O21 is the envelope across the flute
CRESTS** and says nothing about how deep the valleys cut. Measured edge
undulation on this image is ~1.17 mm per side, against our mesh's 0.970 mm
relief - comparable, not the 4x discrepancy first claimed.

If anything our mesh may be slightly UNDER-fluted. Worth checking against a
physical bottle or a drawing before treating swirl.py's depth as settled.

Never solve sigma from this file. See the AI section in
`../../pipeline/paper-doll-3d/REFERENCE-SHOOT-SPEC.md`.

## cobalt.jpg is GENERATED — GLASS ONLY, never geometry

Shot to the spec so it overlays against the others: bone ground, soft
front-side light, contact shadow, 0.00% clipping. No physical cobalt bottle was
available.

**Jordan's instruction: use it for the GLASS only. The threading in this image
is WRONG** — it reads as stacked rings, not a continuous helix. Our mesh
carries the drawing-exact finish (0.75 mm relief, crest rotating ~146 deg per
mm of height), and that stays authoritative.

So: judge colour, depth and how the blue behaves through thick and thin
sections. Ignore the neck entirely.

Sampled centre: RGB 20/36/143, hue 232, saturation 0.86.

## Frosted has a CLEAR neck

Visible in `frosted.jpg`: the etch stops at the shoulder and the thread finish
is clear glass. If the configurator ever applies frosted to a whole body it
will be wrong at the neck — the real part is two materials.

## amber-studio.jpg — IMG_5048 (2026-08-31) — CANONICAL AMBER REFERENCE

Real 9 mL amber roll-on, tripod-style shot on a seamless bone/sage sweep,
broad diffuse light, essentially zero clipping (1.5e-6). Supersedes amber.jpg
(the wall shot, IMG_5040) for LOOK sign-off; the wall shot keeps its role as
the source of the documented sigma solve.

Measured patches (sRGB 0-1, background beside body = 0.621/0.621/0.580):

    thread flank   #311a06   T vs bg  0.31 / 0.17 / 0.05   <- lightest glass
    shoulder glow  #271100   T vs bg  0.25 / 0.11 / 0.004
    body mid       #140500   T vs bg  0.13 / 0.035 / 0.003  <- darkest
    heel           #0d1319   (floor shadow + backdrop bounce, not glass colour)

What it certifies:
  1. The REAL bottle is much darker than the approved preset renders — the
     working range for tuning is deeper, not paler.
  2. The vertical gradient runs threads (lightest) -> shoulder -> body
     (darkest): the SAME direction the baked thicknessMap produces. The bake
     is physically confirmed by this photograph.
  3. One broad soft sheen, no hard reflection edges — the feathered room/tent
     HDRI discipline is what a real studio does.
  4. Background is a seamless sweep with a soft floor gradient — matches the
     lab's cyclorama.

Tune in the lab with reference compare (side/overlay) against THIS file.
Numbers above are advisory; the eye-set preset remains the shipping value
until Jordan approves a retune.
