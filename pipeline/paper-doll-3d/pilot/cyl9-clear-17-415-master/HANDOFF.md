# Cylinder 9 ml · CLEAR · 17-415 — clear master plate: handoff to local

Cloud session 2026-09-24 → Jordan's Mac. Branch `claude/clear-cylinder-9ml-master-gbpdj7`.
Nothing is published: not `public/models/`, not Blob.

## Where it stands

- Two scripts are on this branch:
  - `scripts/render_clear_master.py`: Cycles, locked `GLASS_CLEAR`, Filmic, soft dome + one large dim key + black side flags, and an orthographic camera registered to the kit canvas. It renders two passes that differ only in the backdrop: black, and bone calibrated to exactly #F5F3EF after Filmic.
  - `scripts/matte_master.py`: solves the RGBA layer so it composites back onto bone exactly, and writes 1000×1100 + 2080×2288 layer/plate/clay files, a QA sheet and `qa.json` with the gates.
- A test render of the **shipped** GLB (`bodies-thickness/Cyl-round-17-415-70x20.glb`) passed foot, body axis, closure axis, width (208 px vs live 208–210), alpha and bone reconstruction. **It failed the rim seat.**
- No final render exists yet. It was stopped when Jordan redirected (below).

## Registration targets (all from the repo)

Kit canvas is 1000×1100. The 2080×2288 PDP canvas is exactly 2.08× the same frame.

| target | value | source |
|---|---|---|
| glass width | 208–210 px (median 209) | `src/lib/asset-ledger/plate-geometry.json`, 29 CLEAR 17-415 plates |
| foot | y 1052–1053 (ruler), baselineY 1054–1055 | same + `data/paper-doll/cylinder-leftover-kits/GBCyl9Roll*.kit.json` |
| axis | axisX 500 | kit anchors |
| rim / seat | seatY 278–279 | kit anchors (= body.bounds.top) |
| roller insert bottom / cap skirt bottom | y 288–290 / 429–433 | same kit manifests |

The builder seats hardware on a canonical body by **glass width + baseline** (`src/lib/bottle-builder/preview-registration.ts`, `registerVintagePreview`). So a master registers only if its rim lands on seatY at that width and foot.

## The one real finding: body proportions

| geometry | H × Ø (mm) | rim y at 209 px width | vs seatY 278 |
|---|---|---|---|
| shipped GLB (catalogue 70×20 lane) | 69.2 × 19.98 | 328.5 | **+48 px: caps float ~4.6 mm** |
| Nemat engineering sheet `specs/GBCyl10mlAmber.pdf` | 72 ±0.8 × 19.7 ±0.5 | ~288 | ~+10 px (inside ±0.8 mm) |

The photographs agree with the engineering sheet, not with the 70×20 marketing sheet (`specs/10ml Bottle dimensions and print area.pdf`). The repo already encodes this: `scripts/paper-doll-3d/build-master-scene.py` `CYL_SPECS["009"]` says "the engineering sheet governs".

## Jordan's direction (2026-09-24)

1. **Geometry:** use the master PSD plus the 9 ml spec sheets. The PSD is `BB-PSD-Files-Master/3.  17-415 Bottles/9. Clear  (Uncapped)/22. GBCyl9SpryMattSl.psd`, body layer 1 ("Layer 17", bbox 120,603–367,1517 per `data/paper-doll/builder-bodies-source-review.json`). Not the Tall 9 ml; those are the only PSDs on Drive and they're a different body (13-415).
2. **Look:** match Jordan's clear-glass reference: warm cream studio, broad dark wall bands, soft vertical highlights, thick bright base with a visible base ellipse, rim opening readable.

## Do this locally

```bash
cd pipeline/paper-doll-3d
BL=/Applications/Blender.app/Contents/MacOS/Blender      # or /opt/homebrew/bin/blender

# 1. drawing-exact body (5 s): 72 x 19.7, 13.76 finish, R0.8/R0.3 cone shoulder, heel R2.2,
#    wall 1.6, base 3.5, push-up 1.0. Verified in the cloud: 80,063 verts, 72.00 mm, r 9.85.
$BL -b --factory-startup -P scripts/export_web_body.py -- \
    --spec 009 --body-id Cyl-round-17-415-72x19.7 --out /tmp/cyl9-009

# 2. check the PSD silhouette against it (PSD body layer = truth for the outline, sheet = truth for mm)
python3 scripts/extract_psd_silhouette.py --help        # extract from the file above, layer 1
$BL -b -P scripts/verify_glb.py -- --glb /tmp/cyl9-009/Cyl-round-17-415-72x19.7.glb --out /tmp/cyl9-009/verify

# 3. render + matte
$BL -b -P scripts/render_clear_master.py -- \
    --glb /tmp/cyl9-009/Cyl-round-17-415-72x19.7.glb \
    --out pilot/cyl9-clear-17-415-master --label CLR
python3 -m pip install numpy pillow scipy pypng
python3 scripts/matte_master.py pilot/cyl9-clear-17-415-master
```

## Still to do in `render_clear_master.py` for the reference look

- **Camera tilt ~3° down.** Kit photos show a 2–3 px foot sag, which is what lets the base ellipse and rim opening read. With an orthographic camera, the lowest projected point is the front of the foot, `z=0` lowered by `r·sinθ`. Register that point to baselineY, keep the glass width at 209 px, and keep the axis at 500.
- **Wider dark wall bands.** Bring the side flags closer or make them larger, and darken the dome's front hemisphere. The current flags give thin lines, and the reference has broad bands.
- Keep the plate background at bone #F5F3EF (the site stage). Take the warmth into the dome colour, not the plate.

## Other defects found (not fixed here)

- `scripts/hollow_body.py` has a broken cavity profile. The dead `* 0` dome term makes the base profile fold back on itself, and the axis vertices aren't welded. Result: a 2 mm conical "tent" floor. That tent is baked into the shipped `bodies-thickness/Cyl-round-17-415-70x20.glb` and shows as a star in the base. Re-running the script in Blender 5.0 leaves cutter debris at z=73.2 and 1,434 non-manifold edges, and its exterior gate misses both. The spec-009 body above does not use this script.
- `scripts/straighten_barrel.py` prints the draft ×1000: "2.861 mm/mm" is really 0.0029 mm/mm.
- Blender loads 16-bit PNGs as linearised floats. Tag them Non-Color before reading pixels (fixed in `render_clear_master.py`).
