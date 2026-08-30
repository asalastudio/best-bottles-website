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

Use it for **glass character and lighting**. Do NOT use it as a geometry
target: its flutes read at roughly 15-20% of the bottle diameter, while the
real part is **0.970 mm on O21 — about 4.6%**. That millimetre is the
catalogue's O21 swirl against the plain O20 cylinder, and it is what our mesh
is built to. The generated version is prettier and is not the product.

Never solve sigma from this file. See the AI section in
`../../pipeline/paper-doll-3d/REFERENCE-SHOOT-SPEC.md`.

## Frosted has a CLEAR neck

Visible in `frosted.jpg`: the etch stops at the shoulder and the thread finish
is clear glass. If the configurator ever applies frosted to a whole body it
will be wrong at the neck — the real part is two materials.
