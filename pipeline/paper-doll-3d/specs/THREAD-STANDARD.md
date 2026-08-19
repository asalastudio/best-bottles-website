# Best Bottles — GCMI 415 Thread Standard (Blender rig)

**Status: ACTIVE** — Jordan directives 2026-08-10, with the drawing-verified
17/415 correction approved for review on 2026-08-11. Supersedes RIG-MANUAL
§2 law 2 and every earlier per-spec pitch table. This
document + the engineering sheets are the only thread truth; photos, PSD
measurements and prior renders are history, not authority.

## 0. FINISH MASTER ARCHITECTURE (2026-08-10 evening — supersedes §1's
## per-bottle modulator as the production construction method)

Every distinct neck finish is ONE canonical component —
`FINISH_MASTER_13_415 / _15_415 / _17_415 / _18_415` — built by
`build_finish_master()` in build-master-scene.py from the `FINISH_MASTERS`
registry (every printed sheet dimension as an explicit parameter; local
frame: attachment datum z=0, rim z=finish_h, scale locked 1.000³).

- Only the rotationally symmetric BASE NECK PROFILE is revolved (bore,
  walls, sealing land, lip, land, transfer bead where the sheet draws one).
- The THREAD is separate TRUE SWEPT HELICAL GEOMETRY: a raised-cosine lens
  section (2.5 wide per sheet) swept along a right-hand 8-TPI helix,
  height-tapered run-outs, EXACT-unioned into the base. The 17/415 master
  uses drawing-matched 20° pointed runouts (`runout_power=0.5`); the old
  generic 130° fade made its upper/lower partials stop too far apart.
  Never a lathed silhouette, never stacked rings.
- For the 17/415 sheet, 8.8 mm and 3.175 mm remain the nominal engineering
  zone/pitch datums. The current 2026-08-11 visual-review master deliberately
  uses **2.700 mm pitch × 2 turns + 2.65 mm lens = 8.05 mm**, shifted
  **0.25 mm upward** inside that nominal zone, because the product photograph requires the outer
  partials closer to the middle pass. Other finish masters retain their
  sheet-specific adjudications until their drawings are reviewed likewise.
- Bottles never rebuild or scale a finish: bodies terminate at the
  attachment datum (shoulder → subtle ledge → short land at E/2) and
  INSTANCE the master's mesh datablock. Identity within a finish family is
  structural, not procedural.
- Gate: per-finish FINISH QA SHEET (drawing | ortho | spec-ruler overlay |
  45° | section | SOURCE/BLENDER/DEVIATION/TOL table) + the 6-angle
  TRUE-HELIX SPIN TEST (run-outs must travel; identical rings at every
  angle = automatic FAIL). All four masters PASS their dimensional audits
  as of 2026-08-10 (deviations ≤ 0.162 mm, every row inside sheet
  tolerance).

The §1 `thread_modulator` machinery remains in the file for legacy builds
but is NOT the production path for finishes.

**The law in one sentence:** a 415 finish is a single-start 8-TPI helix that
reads as **~3 angled parallel lines** in front elevation — never a
screw-like grouping, never stacked rings, never a fine multi-crossing
spiral — and its form is judged **in clay**, never through glass.

## 1. Global constants — single source: `THREAD_415` in build-master-scene.py

| constant | value | provenance |
|---|---|---|
| pitch | **3.175 mm** (8 TPI) | the 415-series standard; stated on the tall-cylinder sheet ("Pitch = 415-standard 8 TPI") |
| section | symmetric raised-cosine lens, `wu = wd = 0.39`, `plateau = 0` | total width 0.78 × pitch = **2.48 mm** (tall sheet: "section 2.5 wide") |
| crest form | the bell's own curvature | computes to R0.41 at 0.75 mm depth / R0.31 at 1.0 mm — the sheets' R0.4 / R0.3 callouts |
| root form | both flanks arrive at zero slope | the sheets' R0.6-class root; molded glass, no applied ring |
| depth/side | `(neck_t − neck_e) / 2` per spec | crest peak = neck_t/2 exactly — the batch audit gate measures it |
| turns | sheet-specific; **17/415 = 2.0000** | active visual group uses 2.700 mm pitch; nominal datum remains 3.175 mm |
| top run-out | `thread_phase_deg = (360·frac(turns) − 90) mod 360` | poses the top termination at the rear (θ = 90°; camera at −Y) |

## 2. Per-finish table (GCMI nominal; each spec's drawing values override)

| Finish | T (crest OD) | E (root OD) | depth/side | cap root/crest ID | source sheet |
|---|---|---|---|---|---|
| 13-415 | 12.8 | 11.2 | 0.80 | 13.40 / 11.90 | GBCyl5mlBlue.pdf |
| 15-415 | 14.3 | 13.0 | 0.65 | (no cap modeled yet) | GBCrcl30.pdf |
| 17-415 | 16.3 | 14.8 | 0.75 | 16.90 / 15.10 | GBCyl10mlAmber.pdf + GBCyl10mBlue.pdf 5:1 |
| 18-415 | 17.5 | 15.5 | 1.00 | (no cap modeled yet) | GBCrcl50.pdf |

(The tall cylinder's 13-415 carries its own sheet values T 12.87 / E 11.34.)

## 3. Per-bottle table

| spec | finish | band (mm) | turns | phase° | fades in/out | top land (gap+lip) | notes |
|---|---|---|---|---|---|---|---|
| 005 | 13-415 | 7.8 | 2.4567 | 74.4 | 0.18/0.12 | 0.7+0.5 = 1.2 | bead 12.9/9.5/1.0; bead-assert margin 0.150 mm — never round turns up |
| 009_tall | 13-415 | 7.8 | 2.4567 | 74.4 | 0.30/0.22 | 0.5+0.4 = 0.9 | longer fades: narrow-neck run-outs lump otherwise ("chewed") |
| 009 | 17-415 | 8.8 nominal zone / 8.05 visual group | **2.0000** | front face: top-left / middle-full / bottom-right | 20° pointed master runouts | 0.55+0.35 = 0.9 | 13.76 built finish; 2.700 visual pitch, +0.25 mm group Z, 3.175 nominal datum; 2.65 lens; bead 16.1/10.75/2.0 |
| circle50 | 18-415 | 8.7 | 2.7402 | 176.5 | 0.18/0.12 | 0.4+0.5 = 0.9 | drawing 11-mark upper zone |
| circle30 | 15-415 | 8.7 | 2.7402 | 176.5 | 0.18/0.12 | 0.5+0.5 | **finish 15/415 CONFIRMED by Jordan 2026-08-10** (sheets govern) |
| circle100 | 18-415 | 8.7 | 2.7402 | 176.5 | 0.18/0.12 | 0.4+0.5 | extrapolated spec; awaits its sheet |
| circle15 | 13-415 | **7.8** | 2.4567 | 74.4 | 0.18/0.12 | 0.7+0.5 | finish 13/415 confirmed by Jordan; band changed 8.7→7.8 with the standardization (restores the 13/415 sheet's 1.2+7.8+1.0 stack) — re-verify when its sheet arrives |

## 4. Derivations & the cap

- Do not apply `turns = band / 3.175` blindly. For 17/415, `turns=2.0`
  and the active visual pitch is 2.700 mm. The complete group is shifted
  0.25 mm upward. Both physical endpoints share the
  front-center azimuth;
  the visible presentation is top partial left, full middle, bottom partial
  right. The pointed 20° fade carries both partial tips into the center.
- Front-elevation read: lead angle atan(pitch/(π·E)) ≈ 3.7–5.2°;
  floor(turns)+1 = **3 angled lines**. Through clear glass front+back
  double to ~5–6 alternating crossings — this is EXPECTED and is why form
  is judged in clay.
- **Cap** (`cap_thread_modulator`): the bottle's exact helix — pitch, turns,
  section, fades, phase all from the same spec chain — swelling inward,
  with `top = −(lip_r + thread_top_gap)` (the old literal −1.2 misplaced
  the 009 cap helix 0.65 mm) and a **+0.5-period anti-phase seat** so cap
  ridges nest in the bottle's root land (in-phase crests at these depths
  would intersect; anti-phase clears ≥ ~0.44 mm radial).

## 5. Clay gate protocol (MANDATORY before any glass)

1. Build the spec (`build-master-scene.py --bottle <key>`).
2. `render-views.py --clay` for `front`, `macro`, `threequarter`; plus
   `section` (always clay; cuts cap/roller too so engagement shows).
3. Checklist: **3 angled parallel lines** in front elevation · section
   silhouette matches the sheet's 5:1 detail (≈2.5 wide lens, rounded
   crest, zero-slope root) · run-outs clean at the rear, no lumps · capped
   section shows nested (anti-phase) engagement.
4. `batch-render.py` dimension gates green (height, body OD, crest OD =
   neck_t, ±0.15 mm).
5. `thread-proof-sheet.py` → family grid → **Jordan approves CLAY. Only
   then glass.**

Tunable inside the loop: `thread_phase_deg`, fades. **Never tunable:**
pitch, section widths, depth, band. (Per-spec `thread_wu/wd/plateau`
overrides exist as emergency knobs and must not ship in specs.)

## 6. Decision log

- 2026-08-10 — Jordan: threads are wrong family-wide ("screw-like
  grouping"); GCMI format mandated; clay-first mandated; this project
  created. Supersedes the 2026-08-10-morning "two cigar wraps" law and the
  locked-render thread doctrine (locks bind until Jordan issues a new
  directive — which this is).
- 2026-08-10 — Jordan: circle30 = **15/415** (its sheet governs), circle15 =
  **13/415**. The "Circle is 18/415" note applies to the 50 and 100.
- Open: circle15 + circle100 sheets (extrapolated); 15-415 and 18-415 caps
  not yet modeled; Phase C (family glass/gallery re-render incl. the locked
  amber/cobalt/frosted masters) awaits Jordan's clay approval + go-ahead.

## 7. Change control

Any thread change = edit `THREAD_415`/spec + THIS file's tables + a fresh
clay proof sheet for the affected bottles. No render-side overrides, no
undocumented per-spec tuning. If a new sheet arrives, its dimensions win —
update the table and re-run the clay gate.
