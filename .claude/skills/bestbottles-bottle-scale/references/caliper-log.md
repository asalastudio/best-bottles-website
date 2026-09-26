# The Caliper Log

The Caliper Log holds physical caliper measurements for every bottle body and closure design. It was started on
2026-09-26 at Jordan's request: "start tracking the measurements … We're using a caliper." Later that day Jordan asked
to "lock this sheet in … and then record it in the skill so we could easily pull this back up."

- **Page:** https://claude.ai/artifact/WBbAwDiM8WKx3u2dfGzvTh ("Bottle Caliper Log"). It is pinned in Jordan's
  claude.ai sidebar.
- **Tabs:** Bodies · Closures · How to measure. A progress bar spans both lists, and "Copy as CSV" exports everything.
- **Access:** only the owner and editors can change the body and closure lists. Anyone at Contributor or above can save
  measurements. Share it from the page's Share menu.

## Data layout

Read and write it with the `ArtifactData` tool, using the page URL above.

| Collection | Key | Written by | Holds |
|---|---|---|---|
| `bodies` | register `bodyId` (`/` → `~`) | Claude (seed) | family, capacity, neck, glasses, fitments, plates, `known` site dims + source + confidence, sample SKU, priority (1 = rendered in Blender, 2 = has plates, 3 = no plate) |
| `parts` | `<neck>__<type>__<style or std>` | Claude (seed) | closure design: name, kind (cap, sprayer, pump, roller, dropper, bulb, plug), `members` (every componentId, SKU and finish), bodies it fits |
| `measurements` | same key as `bodies` | the page / Claude | `values` {code: mm}, optional `model` + `modelNote`, sampleSku, glass, samples, by, notes, updatedAt |
| `partMeasurements` | same key as `parts` | the page / Claude | same shape as `measurements` |

The lists were seeded on 2026-09-26 from dev Convex (`register:listPage` + `register:body`, read-only):

- 94 current bodies; 3 retired bodies were left out.
- 34 closure designs, covering the 142 current components.

Re-seed the lists after the register gains bodies or components.

## Field codes

All values are in mm unless noted.

**Bodies:**

| Code | Measurement |
|---|---|
| H | overall height, foot to rim top, bare glass |
| W | body width, front (round bottles: the diameter) |
| Dp | body depth, side at 90° (round bottles: an ovality check) |
| Wb | foot width, 1–2 mm above the table |
| Hs | shoulder start height (optional) |
| Hn | neck base height |
| Fh | finish height, neck base to rim top |
| T | thread OD across the crests |
| E | thread root OD |
| Bd | bead / collar ring OD (optional) |
| I | bore ID |
| Dep | inside depth, rim to floor (base thickness = H − Dep) |
| Cap | overflow capacity in ml (water to the brim, weighed) |
| Wt | glass weight in g (optional) |

**Closures:**

| Closure | Codes |
|---|---|
| Cap | OD, H, Wall, ID, Dep, Asm |
| Sprayer / pump | collar COD, CH, CID; step ring SOD, SH; actuator AOD, AH; Asm; optional TubeOD, TubeL; overcap OcOD, OcH, OcWall, OcID |
| Roller | Ball, FOD, FT, SOD, SL, Proud |
| Dropper | COD, CH, BOD, BH, POD, PL, Asm |
| Bulb sprayer | COD, CH, HOD, HH, BD, BL, Hose, Tassel, Asm |
| Plug / reducer | TD, POD, PL, Hole, Asm |

`Asm` is the closure's height on its bottle (screwed on, table to top). Asm minus the bottle's H is how far the closure
stands above the rim.

## Method

This summarises the page's "How to measure" tab.

- **Tools:** a digital caliper with 0.01 mm resolution and a depth rod, a flat surface, and a scale that reads 0.01 g.
- **Setup:** zero the caliper, and re-zero it about every 10 readings.
- **Readings:** take 3 of each and enter the median. Re-measure if they spread by more than 0.10 mm.
  - Outside diameters: take the smallest reading, because tilting the caliper only makes it read larger.
  - Inside diameters: take the largest reading, because tilting only makes it read smaller.
  - Measure at 90° to the mould seam.
  - Mark heights with the edge of a piece of tape.
  - Inside depth: use the depth rod from the rim.
  - Capacity: fill with water to the brim and weigh it.
- **Photo:** straight-on, with the lens far away and level and a ruler at the front plane. It captures curves a caliper
  can't.
- **Samples:** one clean sample per row, with its SKU and colour noted. Moulds vary by ±0.5–1 mm, so when there are 2–3
  samples, take the median.

## Readings so far

### Tall Cylinder 9 ml 13-415

Key `cylinder-9ml-13-415`, measured by Jordan on 2026-09-26.

| Code | Reading | Current 3D model |
|---|---|---|
| H | 105.60 | 106.2 |
| W | 18.325 | 18.0 |
| Wb | 18.00 | — |
| Fh | 10.11 | 11.5 |
| T | 13.40 | 12.87 |
| E | 11.22 | 11.34 |
| I | 7.04 | 7.3 |

Still needed: Dp, Hn, Dep and Cap.

**Shape:** from Jordan's photo IMG_5823, the shoulder is one smooth round from the wall into the neck. The May 2015
drawing glass had a cone plus a ledge, which read as two steps; do not rebuild it that way.

**13-415 finish rulings (Jordan, 2026-09-26)** apply to both 13-415 cylinders, this one and the Cylinder 5 ml:

- **Neck height:** Fh = 11.0, measured from the rim top to where the neck meets the shoulder. The raw 10.11 stays in
  `values`, and 11.0 is in `model`.
- **Neck Ø:** E = 11.22.

**WIP rebuild:** `outputs/tall-caliper-v36/` (v36) rebuilds this glass to the readings, with the smooth shoulder and
Fh 11.0.

### 13-415 fine-mist sprayer and overcap

Key `13-415__fine-mist-sprayer__std`, which covers all 12 finishes. Measured by Jordan on 2026-09-26.

| Part | Code | Reading |
|---|---|---|
| Collar | COD | 15.39 |
| Collar | CH | 13.94 |
| Collar | CID | 12.36 (across its internal threads) |
| Step ring | SOD | 13.12 |
| Step ring | SH | 5.00 |
| Actuator | AOD | 10.47 |
| Actuator | AH | 8.84 |
| Sprayer total | CH + SH + AH | 27.78 |
| Overcap | OcOD | 17.00 |
| Overcap | OcWall | 0.90 |
| Overcap | OcID | 15.25 |
| Overcap | OcH | 30.72 |

**Model adjustment (stored in the `model` field).** The overcap's inside measured 15.25; 17.00 − 2 × 0.90 gives 15.20.
Either way it is under the collar's 15.39, and a slip-over cap can't be smaller than the collar. The model therefore
uses:

- collar Ø15.30;
- overcap inside Ø15.30 with a 0.85 wall.

Jordan: "make any necessary logical adjustments if our caliper is off a millimeter or two."

**Shape, from Jordan's 360° photos (IMG_5813–5819):**

- Collar: its top edge is rounded where it steps in to the step ring.
- Step ring: its edges are softened.
- Actuator: a rounded top edge and a nearly flat top, with a small light-grey nozzle insert near the top, facing front.
- Overcap: a very slightly domed top with a rounded edge.
- Finish: satin-matte black with broad soft highlights, not mirror gloss.

**Not yet measured:** the dip tube. Jordan said it is "fine as it is for now".

**What the older model had wrong:** the 3D model built before these readings had an overcap of Ø17.6 × 29.6 and a
collar of Ø17. Use the readings above.

**LOCKED geometry (Jordan, 2026-09-26: "the geometry is perfect, so it needs to be locked in").** The sprayer (collar,
step ring, actuator, nozzle insert) is locked in `outputs/sprayer-13415-v38/`:

- `sprayer_13415.py`: `build()`, `seat_on()` and `verify()`;
- `sprayer-13415-locked.blend` and `LOCK.json`.

How it was proven:

- Re-rendering the approved view from the lock matches it pixel for pixel.
- A build at the Tall's seat is within 0.000007 mm of the locked parts.

How to use it:

- Colour is a material swap only. Render each finish in its approved scene: the v33 `sprayer-scenes` for eight
  finishes; red comes from the 17-415 v27 scene.
- The overcap is built to the caliper but is not locked yet.

**One sprayer for every 13-415 neck.** Jordan: the same sprayer and overcap fit every 13-415 neck that takes a
fine-mist sprayer. These numbers therefore hold for all 15 such bodies (listed in `appliesTo`). The dip tube is the
only part that changes, because it is cut to each bottle's depth.

### Cylinder 5 ml 13-415 (Clear and Cobalt Blue)

Key `cylinder-5ml-13-415`, measured by Jordan on 2026-09-26. The Clear and Cobalt glass give the same numbers.

| Code | Reading |
|---|---|
| H | 53.16 |
| Wb | 17.51 |
| Hs | 41.32 (base to shoulder) |
| E | 11.64 (neck Ø) |
| Fh | ~11.0 |
| I | 7.49 |

- The site gives 53 × 17 for this bottle, which matches.
- Still needed: W, Dp, T, Dep and Cap.
- **13-415 finish rulings (Jordan, 2026-09-26), for both 13-415 cylinders:** neck height Fh = 11.0 and neck Ø E = 11.22.
  The raw readings (Fh ~11.0 and E 11.64 here, Fh 10.11 on the Tall) stay in `values`; the rulings are in `model`.

### 13-415 roller insert (metal and plastic ball)

Key `13-415__roller-insert__std`, measured by Jordan on 2026-09-26. The metal and plastic rollers are one design, and
it fits all 13 of the 13-415 roller bodies.

| Code | Reading |
|---|---|
| L | 17.38 (loose, stem tip to ball top) |
| SL | 7.32 |
| SOD | 7.62 (mid-length) |
| STop | 7.80 (just under the flange) |
| STip | 6.51 (tip; the stem narrows, or "indents in", toward it) |
| HOD | 9.51 |
| BallUp | 1.33 (the ball stands 1.30–1.35 out of the housing) |

**Model values (derived):**

- Proud = L − SL = 10.06. This is the ball top above the rim when the roller is seated.
- The ball Ø stays at 7.79 until it is measured.

**The stem is a press fit.** Its top (7.80) is wider than both bores measured so far: 7.04 on the Tall Cylinder and
7.49 on the 5 ml. The soft plastic squeezes into the bore, so:

- a seated render narrows the stem to that bottle's bore;
- the loose view keeps the stem at 7.80 → 6.51.

**The older model is wrong.** It was the 17-415 roller scaled ×0.742:

| | Older model | Reading |
|---|---|---|
| Overall length | 15.55 | 17.38 |
| Ball above the housing | 2.76 | 1.33 |
| Housing Ø | 9.79 | 9.51 |
| Stem | 7.20 → 6.77 × 6.68 | 7.80 → 6.51 × 7.32 |

**Still needed:** the ball Ø, and the flange Ø and thickness.
