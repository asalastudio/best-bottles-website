# Amber, solved from a photograph — a PROPOSAL for Lane B

Lane A measured this; `materials.py` / `materials.blend` / `BottleViewer.tsx`
belong to Lane B (see OWNERSHIP.md), so nothing here has been applied. Apply it
if you agree with the method.

## Source

`IMG_5040.HEIC` — a real 9 mL amber bottle, shot on a neutral wall
(Jordan, 2026-08-30). Measured transmission through the glass, sampled by
saturation so the bone backdrop cannot contaminate it:

| | R | G | B |
|---|---|---|---|
| transmission | 0.260 | 0.143 | 0.040 |

Glass path from a ray-cast of the actual mesh: the neck wall is **3.24 mm**,
so 6.48 mm through two walls.

## The physics

Beer-Lambert, `T = exp(-sigma * L)`:

**sigma = [208, 300, 497] per metre**

That is the transferable quantity. It belongs to the GLASS, not to a renderer.
Each renderer only parameterises it differently:

| renderer | relation | values |
|---|---|---|
| Blender | `sigma = density x (1 - colour)` | density **600**, absorption colour **`#d3bb73`** (linear 0.654, 0.500, 0.172) |
| three.js | `sigma = -ln(attenColor) / attenDistance` | attenColor **`#8b6a38`**, attenDistance **0.014**, thickness **0.014** |

Both reproduce 0.260 / 0.143 / 0.040 exactly.

### Why attenDistance is set EQUAL to thickness

three.js computes `coeff = -ln(attenColor)/attenDistance`, then
`exp(-coeff * thickness)`. Setting the two equal collapses it to `attenColor`,
so **attenColor IS literally the transmitted colour** — you can hold it against
the photograph and check by eye, with no conversion to get wrong.

## The caveat that matters

`thickness: 0.014` is NOT a real wall. It is a stand-in for a cavity that is
not modelled: the bodies are SOLID, so a ray crosses ~20 mm of glass instead of
wall-air-wall. Lane B already documented this in `BottleViewer.tsx` — *"the
values are being bent to fake a cavity that is not modelled."* A ray-cast
confirms it: body 2 crossings (solid), neck 4 crossings (3.24 mm wall).

Two consequences:

1. The neck renders far paler than the body, because its path is 6x shorter.
   In the real photograph the thread and body match within **1.12x**.
2. "Light illuminating the inside" is unreachable — a solid slab has no inside.

Hollow bodies fix both, and would let one honest sigma serve the whole bottle
instead of per-region fudging.

## Also from this session

`studio.hdr` (Lane A, `scripts/make_studio_hdri.py`) is a shared environment for
both renderers. Glass renders its ENVIRONMENT, so matching the material is only
half the bridge — refract two different worlds and the renderers cannot agree.

It also fixes the white card: that artefact was the world's Gradient/ColorRamp
band refracted by the bottle, compounded by `BB_STUDIO_CYC` visible to
transmission — not the area light, which is where we looked first.

    Blender   world -> Environment Texture -> studio.hdr, strength 1.0
    browser   <Environment files="/models/studio.hdr" />

## Not yet solved

clear, cobalt, frosted. Each needs one photograph of that glass; the solve is
then a single step. Do it AFTER any hollowing decision — the path length
changes every number here.
