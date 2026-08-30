# Handoff — Best Bottles 3D, material tuning

**Repo:** `~/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`
**Branch:** `feat/bottle-bodies-3d` (pushed; ~20 commits from 2026-08-30)
**Blender:** `/opt/homebrew/bin/blender` (5.2.0 LTS)

## Read this first

**Geometry is DONE and must not change.** 28 threaded bottle bodies, 13 closure
parts, all watertight, all dimension-gated against the catalogue. Jordan has
signed off on shape. Every remaining task is materials and lighting.

The open problem is **glass realism — roughly 60% of the way there**, per
Jordan. Swatching and responsiveness are good; colour and quality are not.

## The one loop that matters

```bash
cd pipeline/paper-doll-3d

# 1. tune — opens on ONE bottle, already in Rendered view through the camera
open materials.blend

#    or edit the TUNE table and run it inside Blender's Scripting tab
#    scripts/tune_glass.py

# 2. push what you tuned to the browser
blender --background --python scripts/materials.py -- extract
#    -> public/models/materials.json

# 3. look
#    http://localhost:3000/lab/configurator     (npm run dev)
```

Renders can also be dropped in `public/renders/` and viewed at
`http://localhost:3000/renders/<name>.png` — Jordan cannot reliably open files
via Finder or Preview, so **serve images over the dev server** rather than
telling him to find them on disk.

## Where the amber stands

Sampled from the live product photo (`GBCylAmb9MtlRollMattSl`), the real
transmitted colour through the glass is:

| path | colour |
|---|---|
| thin centre | `#823110` |
| mid | `#58280b` |
| near edge | `#1a1403` |

Even the brightest point is a burnt brown. Solving Blender's absorption
(`sigma = density * (1 - colour)`, `T = exp(-sigma * path)`) for a 20 mm path
at density 150 gives **`#e4b34e`**, which is what is committed.

**The material now matches the measurement. The render still looks too light**,
and the cause is the SET, not the material: the bone studio is bright and warm
and adds reflected light on top of the transmission, while the reference
photograph is backlit on white and shows almost pure transmission. Fixing this
means changing the lighting, not the absorption values.

## What is genuinely unresolved

1. **Bodies are SOLID, not hollow.** Light crosses a 20 mm slab instead of
   wall-air-wall, so there is no bright/dark edge band and amber cannot be
   both deep and translucent. This is the ceiling on glass realism. Hollowing
   would fix it and would also give a capacity-vs-catalogue check, but the wall
   thickness is only known for the two bodies with drawings.
2. **17-415 closures are ~13% oversized.** Published sprayer is 31 x O19; the
   built parts stack to 35.15. `components_17415.py` is photo-solved and marked
   provisional; the ratio 35.15/31.00 = 1.134 matches O19.7/O17.4 = 1.132, so
   the likely cause is a wrong scale reference in that original photo-solve.
   Needs a caliper or Jordan's call.
3. **18-415 cap fails its seat check** by 0.65 mm in the thread band. Published
   dimensions are not in doubt; the DERIVED `thread_crest_d` is.
4. **Bulb sprayers (274 SKUs) are not lathe parts.** The bulb sits off-axis,
   the tassel version reaches it through a curved braided hose, and the tassel
   is fabric. Different construction entirely.

## Hard-won rules — do not rediscover these

They are all written into `.claude/skills/bestbottles-bottle-bodies-3d/SKILL.md`
(364 lines). The materials section is the newest. The short version:

- **Blender's Base Color is LINEAR.** Feeding it measured sRGB double-gammas.
- **AgX washes colour out.** Blender 4+ defaults to it; use Filmic. Standard
  has no rolloff and clips.
- **Glass colour is a VOLUME property**, and **"Thin Wall" must be OFF** or the
  volume is ignored and coloured glass renders clear.
- **Absorption colour is what SURVIVES**, so it is bright; density makes it
  deep. Dark colours double-darken into opaque plastic.
- **Density is per metre**; a O20 bottle is 0.02 m of path.
- **Hard area lights put fake panel reflections INSIDE the glass** — a bottle
  is a lens. Soft dome, not panels. This was Jordan's catch and it mattered.
- **Caps are phenolic composite, not metal.** Pigmented ones are dielectrics
  with a clearcoat, metalness 0.
- **Cycles is not three.js.** Values transfer; the look does not.

## How to work with Jordan on this

- He judges by eye against real product photos. **Measure from the photo rather
  than proposing values** — three guesses at the amber all missed, one
  measurement landed it.
- He cannot easily navigate Blender's UI. Do the Blender work yourself in
  background mode and show him renders over the dev server.
- Do not claim something is fixed without showing it. Several times this
  session a value was changed but never reached the browser because the JSON
  bridge was not connected.
