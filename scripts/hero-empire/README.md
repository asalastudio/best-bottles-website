# Empire hero — one bottle, every closure

Homepage hero prototype: an Empire 50 mL bottle standing in a lit bone-plaster niche cut into a dark
Sahara Noir wall; its closures turn over one by one. Enabled on `/` with `?hero=fitments`; the frame
set is chosen with `NEXT_PUBLIC_HERO_SET` (`frames` = v1 all-fitments set, `v4` = approved sequence).

## Approved sequence (Jordan, 2026-09-13)
antique bulb sprayers (NO tassel versions) → fine-mist sprayer* → lotion pump → bare neck (dip tube gone)
→ reducer caps → loop. No droppers, no roll-ons.
\* no fine-mist sprayer plate exists in the Empire 50 index yet — needs a catalogue reference.

## How a set is built (`pipeline.py`, env-driven)
1. `wall.png` — Sunburst generation: dark honed stone, one niche with pale plaster interior + dark sill.
2. `base.png` — Sunburst edit: the bottle placed in the niche from a plate reference
   (`BARE_BASE=1` renders a bare, open-neck bottle from the reducer plate with the cap removed).
3. Niche interior measured by plaster row/column coverage (thin bright veins never reach 30%).
4. One frame per closure: UNMASKED Sunburst edit of the base with the closure plate as second reference,
   then a DIFFERENCE composite — inside the niche take generated pixels only where they differ from the
   base (> 40/765), everything else is the base. Wall, sill and plaster are therefore pixel-identical
   across frames; the bottle interior (dip tube / nothing) follows the closure.
5. `manifest.json` (ordered), webp frames, `_review-frames.jpg` niche crops.

```
HERO_SET=v4 BASE_REF_SKU=GBEmp50RdcrShnGl BASE_REF_KEY=image BARE_BASE=1 SEQUENCE=AnSp,LB,Rdcr \
  python3 scripts/hero-empire/pipeline.py
```
Needs `OPENAI_API_KEY` and `SKETCH_SCRATCH` (reference cache). Plates come from Convex
`productPlates.byFamily("empire-50ml-clear-18-415")` (`empire-50-rows.json` is a snapshot).

## What failed, so nobody repeats it
- Masked inpainting (mask = niche minus bottle body): the model repainted the plaster dark inside the mask.
- Locking the bottle body: locks the sprayer's dip tube, so droppers (pipette) and reducers (empty) were wrong.
- A 3:2 "stage" with `min-width` in the component stretched the frames ("scrunched"); frames must use
  `object-fit: cover` with one fixed focal point.
- `gpt-image-2.5-sunburst` rejects `input_fidelity`.

PNG masters are gitignored; webp + manifest are committed per set.
