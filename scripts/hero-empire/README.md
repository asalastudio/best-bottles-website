# Empire hero — one bottle, every closure

Homepage hero: an Empire 50 mL bottle in a lit bone-plaster arched niche; its closures turn over one by one.
Enabled on `/` with `?hero=fitments`; the frame set is chosen with `NEXT_PUBLIC_HERO_SET` (default `v7`).

## Current method — `kit.py` (v7, approved 2026-09-13)

No per-frame rendering. The base (`v6/base.png`, a Sunburst render of the catalogue bottle in the niche; masters
parked in the main checkout `.local-assets/hero-masters/2026-09-13/v6/`) is ONE static image. Every closure is
cut from the layered PSD in the master library (`BB-PSD-Files-Master/2.  18-415 Bottles /21. Empire 50ml/1. Empire
50ml PSD`): body layer, dip-tube layer, closure layer (+ overcap beside on cap-off twins). One similarity
transform per file — scale = base body width / PSD body width, PSD shoulder line anchored on the base neck axis —
places the closure where the artist drew it; then the collar bottom at the axis is snapped to shoulder + 1.

- body = tallest layer with fill ≥ 0.5 (tube layers are taller but sparse); beside = no x-overlap with the neck
  column; per SKU the SHORTER closure twin wins (exposed sprayer / pump head, overcap dropped).
- ONE shared dip tube (gold bulb file), thinned to `TUBE_WIDTH=0.55`, under bulbs, pumps and sprayers; none for
  BARE and reducers.
- Bulb ball reduced `BULB_SCALE=0.85` about its nozzle; the collar is never scaled (it must cover the threads).
- Output: `base.webp`, lossless RGBA `patch-<sku>.webp` + position in `manifest.json` (`builtAt` cache-busts),
  `_kit-preview.jpg`, `_collars.jpg` (every collar bottom must sit on the red line).

```
BASE_SET=v6 HERO_SET=v7 python3 scripts/hero-empire/kit.py
```

Component `EmpireFitmentHero.tsx`: static base + patches on a 1536×1024 stage scaled to cover. The changeover is a
JUMP CUT (Jordan: "like a video jump cut" — fades of any length were rejected): the upcoming patch is mounted a beat
early at opacity 0 and decoded, then simply becomes the current one — one atomic paint, no transition, no fade. The
bare-neck beat renders nothing over the base (a re-encoded full frame would shimmer). Every collar is centred on the
neck axis and seated on the same row by the kit, so a cut never steps sideways or up. `manifest.hold` (neck + tube
boxes every closure covers) is kit geometry kept for QA; the jump-cut component does not need it.

## Sequence (Jordan, 2026-09-13)
9 antique bulbs (no tassels) → 8 lotion pumps → 6 fine-mist sprayers → bare neck → 12 reducers → loop.
No droppers, no roll-ons. The dip tube stays through the spray closures and leaves at the bare-neck beat.

---

## Earlier method — `pipeline.py` (v4–v6 wall + base builder; per-frame Sunburst closures are RETIRED)

## How a set is built (`pipeline.py`, env-driven)
1. `wall.png` — Sunburst generation: dark honed stone, one niche with pale plaster interior + dark sill.
2. `base.png` — Sunburst edit: the bottle placed in the niche from a plate reference
   (`BARE_BASE=1` renders a bare, open-neck bottle from the reducer plate with the cap removed).
3. Niche interior measured by plaster row/column coverage (thin bright veins never reach 30%).
4. One frame per closure: UNMASKED Sunburst edit of the base with the closure plate as second reference,
   then a DIFFERENCE composite — inside the niche take generated pixels only where they differ from the
   base (> 40/765), everything else is the base. Wall, sill and plaster are therefore pixel-identical
   across frames; the bottle interior (dip tube / nothing) follows the closure.
5. KIT: the bottle body is measured (base-vs-wall difference at a high threshold; margin fallback), then every
   closure is measured — collar bottom vs the shoulder line, centre vs the neck centre — and the closure layer is
   SNAPPED onto that datum before compositing. Sprayers/pumps must show a dip tube; reducers/caps composite with
   the body locked so the bottle stays empty. Gross failures (seat/centre > 40px, missing tube, bare threads)
   re-render up to 3× with a reinforced prompt; the best attempt is kept.
6. `manifest.json` (ordered), webp frames, `_review-frames.jpg` niche crops.

```
HERO_SET=v4 BASE_REF_SKU=GBEmp50RdcrShnGl BASE_REF_KEY=image BARE_BASE=1 SEQUENCE=AnSp,LB,Rdcr \
  python3 scripts/hero-empire/pipeline.py
```
Env: `NICHE_BOX=x0,y0,x1,y1` (recess interior; required when the wall is all plaster), `BODY_BOX` (manual bottle
override), `EXTRA_ROWS_JSON` (closures from a sibling family with the same neck, e.g. cylinder-50 sprayers),
`MEASURE_ONLY=1` (print geometry and stop). Needs `OPENAI_API_KEY` and `SKETCH_SCRATCH` (reference cache). Plates come from Convex
`productPlates.byFamily("empire-50ml-clear-18-415")` (`empire-50-rows.json` is a snapshot).

## What failed, so nobody repeats it
- Masked inpainting (mask = niche minus bottle body): the model repainted the plaster dark inside the mask.
- Locking the bottle body: locks the sprayer's dip tube, so droppers (pipette) and reducers (empty) were wrong.
- A 3:2 "stage" with `min-width` in the component stretched the frames ("scrunched"); frames must use
  `object-fit: cover` with one fixed focal point.
- `gpt-image-2.5-sunburst` rejects `input_fidelity`.

PNG masters are gitignored; webp + manifest are committed per set.
