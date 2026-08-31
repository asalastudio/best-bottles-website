# Best Bottles — Blender Master Product Rig · Operator's Manual

One parametric studio that turns Nemat engineering drawings into
photorealistic, dimension-audited bottle renders. Everything regenerates
from numbers in one script — nobody ever edits a mesh by hand.

**Requirements**: Blender 5.x at `/Applications/Blender.app`, Python 3,
Pillow (`pip install pillow`) for contact sheets. All commands run from the
repo root.

---

## 1. The three scripts

| Script | Role |
|---|---|
| `scripts/paper-doll-3d/build-master-scene.py` | THE source of truth. Bottle specs (`CYL_SPECS`), closure specs, materials, studio, camera. Builds a complete `.blend` per invocation. |
| `scripts/paper-doll-3d/batch-render.py` | Walks specs × variants → build → render → **audit gate** → `render-manifest.json` + contact sheet. |
| `scripts/paper-doll-3d/render-views.py` | View presets on a built `.blend`: `front`, `macro`, `threequarter`, `section`, `spin`. |

```bash
# build one bottle (writes a .blend, prints the cavity audit for shaped bottles)
blender -b --factory-startup -P scripts/paper-doll-3d/build-master-scene.py -- \
    --output out.blend --bottle 009 --glass amber --backdrop "#EFE9DE"

# render a view from it
blender -b --factory-startup out.blend -P scripts/paper-doll-3d/render-views.py -- \
    --view front --out render.png --samples 160

# the whole catalog with audit gates
python3 scripts/paper-doll-3d/batch-render.py --specs 009 circle50 --samples 160
```

### build-master-scene.py flags
`--bottle` 005 | 009 | 009_tall | circle50 | circle30 | circle100 | circle15
· `--glass` clear | amber | cobalt | frosted · `--roller` none | plastic | steel
(17-415 only) · `--cap` none | matte-silver | white | shiny-black | black-dot |
pink-dot | silver-dot · `--backdrop` hex (default tan `#B29878`; deliverables
use bone `#EFE9DE`) · `--lighting` standard | symmetric (see below)
· `--transparent` alpha-canvas mode (LEGACY — rejected
for deliverables, kept for compositing needs) · `--envelope` mm (shared-scale
sets) · `--dump-specs` JSON for tooling.

**`--lighting` (2026-08-10).** `standard` = the original card set (key softbox
front-left 9.0 + fill card right 1.4) — the profile that produced the locked
amber / cobalt / frosted masters; NEVER re-render those with anything else.
`symmetric` = the clear-glass profile Jordan specced after reviewing the sheet
("cut the bottle down the middle — left and right must read the same; soft and
blended like the frosted"): one big centred softbox `BB_LIGHT_KEY_CENTER`
(980×760 @ 4.1) replaces key+fill, wash 2.3 / top card 1.95 recover the
retired pair's ~4% studio spill so the backdrop matches the locked cards
(bg within 0.7%, floor within 0.3% — and finally even L/R). Every emitter
sits on the x=0 mirror plane, so symmetry is by construction. Calibration
metric: body-zone column-profile mirror-asymmetry — locked-standard clears
scored 8.9–10.8 with mismatched side streaks; symmetric scores ≈ 0.45
(approved frosted reference = 5.8). Per-product lighting is sanctioned
("we care about the product, not the lighting" — Jordan's watch-shoot
lesson): clears → symmetric, colored/frosted → standard.

---

## 2. Non-negotiable design laws (Jordan, Aug 2026)

1. **Drawings outrank everything.** Every dimension traces to a Nemat sheet
   in `pipeline/paper-doll-3d/specs/`; each spec entry's comment cites its
   sheet. AI-generated reference images drift — never measure from them.
2. **Thread design law — EVERY bottle (superseded 2026-08-10, Jordan
   directive):** the GCMI 415 standard — 8 TPI (pitch 3.175), sheet-specific
   turn adjudication, symmetric raised-cosine lens section
   ~2.5 mm wide, reading as **~3 angled parallel lines** in front
   elevation. Never a screw-like grouping, never stacked rings, never a
   fine multi-crossing spiral, never two fat wraps (the retired
   2026-08-10-morning law). Full tables, derivations and the clay-gate
   protocol: `specs/THREAD-STANDARD.md`. The 17/415 visual-review master is
   exactly two turns at 2.700 mm spacing with a 2.65 mm lens (8.05 mm group
   shifted 0.25 mm upward in the nominal 8.8 mm zone); 3.175 remains recorded as its
   engineering datum. Thread FORM is judged in CLAY
   (`render-views.py --clay`) against the sheet BEFORE any glass.
3. **Stakeholder naming:** the short cylinder is sold as **9 ml** — say 9 ml
   in everything stakeholder-facing (drawing says 10 ml; capacity_ml stays
   physical).
4. **Locked masters:** the amber / cobalt / frosted 9 ml RENDERS remain the
   approved deliverables until the GCMI-thread family re-render (Phase C)
   is approved by Jordan. Their thread GEOMETRY freeze was lifted by the
   2026-08-10 thread directive — the code now builds GCMI necks; do not
   overwrite the locked render FILES until Jordan signs off the clay gate
   and orders the re-render.
5. **Bore frost is demo-only.** Clear bottles carry a matte interior bore
   (makes clear threads read like the locked cobalt/frosted). The MAIN
   WEBSITE / GLB lane must render TRUE clear — no frost (flag to be added
   in the web-export stage; until then, strip the bore-frost nodes for
   website output).
6. **Beautification never comes from code** — geometry is immutable spec;
   look changes go through materials/lighting only.

## 3. Reading the drawings (conventions that bit us)

- The 5:1 finish details are **section views**: they show the FAR wall's
  threads. A front render shows the near wall — same right-hand helix,
  mirrored. `render-views.py --view section` reproduces the sheet's
  convention exactly (clay, near half cut away).
- "Visible thread crossings = 2 × turns" only through CLEAR glass (front +
  back both visible): multiple alternating crossings are expected —
  EXPECTED, not a defect. Judge thread form in clay, never through glass.
- Circle family: front arc is a horizontal ELLIPSE (e.g. 50 ml: 72.5 wide ×
  ~66 tall), faces are FLAT with a semicircular rim (stadium plan) and an
  R2-cornered plinth — never a ball, never domed faces.

## 4. Architecture (how a bottle exists)

- **1 BU = 1 mm**, base at Z=0, `BB_PRODUCT_ROOT` empty is the parent.
- **FINISH MASTER LIBRARY (production neck path, 2026-08-10):** every
  distinct finish is ONE component — `FINISH_MASTER_<std>` from the
  `FINISH_MASTERS` registry (`build_finish_master()`): base profile
  revolved, thread as TRUE swept helix unioned in, scale locked 1.000³,
  attachment datum at local z 0. Bottles instance the master's mesh
  datablock at `height − finish_h`; bodies own shoulder → ledge → land
  below the datum. Build/validate: `--finish-master <std> --qa-render
  <dir>` + `finish-qa-sheet.py`. Full law: `specs/THREAD-STANDARD.md` §0.
- Cylinders: closed-outline solid of revolution (`cylinder_profile*`).
  The legacy radius-modulating `thread_modulator` (GCMI parameters via
  `resolve_thread()`) remains for one-piece legacy builds only — the
  finish-master instance is the production neck. The cap's internal
  thread reads the same GCMI chain plus a half-period anti-phase seat.
- Shaped bottles (Circle): **rounded-rect loft** (`disc_stations` + `loft`)
  — cross-sections are flat-faced rounded rectangles; corner radius = half
  depth gives the stadium body, 2.0 gives the plinth, radius = a = b
  collapses to the circle that carries the same thread modulator.
- **Paper-doll closures**: `BB_ATTACH_NECK` empty sits at the rim (the
  datum). Roller and cap are separate objects whose origin IS their mating
  face — parent-and-zero seats them. Fitment radii derive from the bottle's
  bore at build time.
- Naming: `BB_BTL_*`, `BB_ROLL_*`, `BB_CAP_*`, `BB_MAT_*`, `BB_LIGHT_*`,
  `BB_CAM_MASTER`, `BB_STUDIO_SWEEP`. Collections: STUDIO, LIGHTING,
  PRODUCT_ROOT → BOTTLES/CLOSURES/CAPS, WEB_EXPORT, RENDER_HELPERS.
  Every bottle carries its spec as custom properties (`height_mm`,
  `neck_finish`, …) — tooling reads those, not filenames.

## 5. Audit gates (what "done" means)

- `batch-render.py`: bottle height / body OD / thread-crest OD measured on
  the built mesh vs the spec — **0.15 mm tolerance**, failures land in
  `render-manifest.json` as `AUDIT_FAILED`.
- Shaped bottles additionally: `CAVITY_AUDIT` — enclosed volume integrated
  from the inner shell vs the sheet's overflow capacity, ±8 %.
- Nothing ships without: audit pass + a same-zoom before/after proof in
  Jordan's hands (his standing rule).

## 6. Gotchas that cost us hours (read before debugging)

- **`--factory-startup` resets Cycles GPU prefs** → renders silently run on
  CPU (~4× slower). `render-views.py` re-enables Metal itself; any ad-hoc
  `--python-expr` render must do the same 4 lines (see its `enable_gpu`).
  Factory startup is still REQUIRED — the Substance addon intermittently
  kills headless renders.
- Never edit `build-master-scene.py` while a batch is running — builds read
  the file per job. Queue patches and apply between batches.
- `--python-expr` + JSON: `true/false` are not Python. Inject numbers only.
- Piping batch output (`| tail`) launders exit codes; run it bare.
- The interactive Blender GUI session (Blender MCP) may hold the GPU — the
  headless queue tolerates it, but don't kill that process; it's Jordan's.
- Canvas/transparent mode needs its camera-invisible bright-field twin
  (shadow catchers vanish from transmission rays → glass renders dark).
  This whole mode is legacy for deliverables — bone photoreal is the look.
- **Emitters that straddle the lens axis must be `visible_camera = False`.**
  The camera distance scales with the product envelope; a centred panel that
  clears a short bottle's camera by millimetres sits INSIDE the tall
  bottle's frustum → a pure-white frame with no error printed.
  `BB_LIGHT_KEY_CENTER` carries the flag; off-axis cards (standard rig)
  never image and don't need it.
- When wrapping renders in `grep`, the pattern must include `Traceback`
  and, ideally, `quit` — a crashed/instant-exit Blender otherwise produces
  NOTHING that matches `DONE|Error`, and silence reads as success.

## 7. Adding a new bottle (the whole workflow)

1. Drop the Nemat sheet in `pipeline/paper-doll-3d/specs/`, update
   `DRAWING-COVERAGE.md`.
2. Add a `CYL_SPECS` entry in `build-master-scene.py`: every number from the
   sheet, a comment citing sheet + date, `source="drawing"`. Cylinders need
   the standard fields; shaped bottles add `body="disc"`, `body_ellipse_v`,
   `base_w/base_d/plinth_h/flare_h`, `overflow_ml`, and a `wall` solved so
   the cavity audit lands on the overflow spec (iterate: build prints it).
3. Threads: set `thread_band` to the sheet's dimension — nominal pitch
   (3.175) and turns derive automatically (`resolve_thread`) unless an
   explicitly documented visual master such as 009 overrides them. Set `thread_phase_deg =
   (360·frac(turns) − 90) mod 360` (top run-out rear). Family fades
   .18/.12; narrow necks may need longer fades — see 009_tall. Section
   comes from `THREAD_415`; never re-tune it per spec. Full protocol:
   `specs/THREAD-STANDARD.md`.
4. Build; check `CAVITY_AUDIT`; run `batch-render.py --specs <key>` for the
   dimension gate; `--view macro` against the sheet's finish detail.
5. Renders for stakeholders: bone backdrop, 160 samples, `front` (+
   `threequarter` for shaped bottles). Same-zoom proofs to Jordan.

## 8. Where things live

- Specs/drawings: `pipeline/paper-doll-3d/specs/` (+ `DRAWING-COVERAGE.md`)
- Batch outputs: `pipeline/paper-doll-3d/master/builds/`,
  `pipeline/paper-doll-3d/renders/` (+ manifest, contact sheet)
- Stakeholder deliverables: `pipeline/paper-doll-3d/renders/nemat-progress-*/`
  (`final-*.png`, `engineering-panel-*.png`, `neck-proof-*.png`)
- Stakeholder sheet (artifact): "Drawing Coverage & Request Sheet", updated
  by republishing to the same URL (currently Rev H).
- Cap colors come from the PSD closure library:
  `Best-Bottles-Original-Photoshop-Sources/20. Closures - …` — measured,
  never invented. 17-415 has 10 finishes; ~5 ingested so far.

## 9. Known open items

- Circle 15 neck finish is ASSUMED 13-415 (needs Nemat confirmation);
  circle100/15 dimensions are extrapolations pending sheets.
- Remaining shaped families with sheets on file: Elegant, Empire, Sleek,
  Tulip, Flair — need their own profile functions.
- Web/GLB export stage (phase 2) — must implement the true-form clear
  (no bore frost) and the loader contract (`web_name` properties exist).
- Missing-drawing request list: see `DRAWING-COVERAGE.md`.
