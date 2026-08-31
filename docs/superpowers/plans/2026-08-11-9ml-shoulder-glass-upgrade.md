# 9 ml Shoulder and Glass Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one corrected 9 ml smooth-cylinder master, four physically plausible glass variants, and consistent product renders while preserving the approved 17/415 finish and studio shadow.

**Architecture:** Extend the source-independent five-variant contract with a precision 9 ml shoulder and production glass parameters. Generate a new continuous revolved shell from that contract inside the existing protected builder, splice in the immutable finish, then layer material and transmission-card changes without moving the approved camera or key. Pure tests protect numerical geometry; Blender integration tests protect mesh, finish, shader, and scene fingerprints.

**Tech Stack:** Python 3, Blender 5.2 LTS Python API, Cycles/Metal, `unittest`, ImageMagick, SHA-256 lock verification.

## Global Constraints

- Commercial product name is 9 ml; manufacturer drawing capacity remains 10 ml ±0.3 ml.
- Overall height is 72 ±0.8 mm and outer diameter is 19.7 ±0.5 mm.
- Nominal smooth-body wall is 1.6 mm and base thickness is 3.5 mm.
- Finish is 17/415 with approved source fingerprint `016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`.
- Immutable baseline SHA-256 is `3291d7ecf0c8a289a2e06d9fb334ae758010ad42f53a99ece1863d306d7efd0f`.
- Clear, frosted, cobalt, and amber share one corrected smooth geometry.
- The swirl body, swirl candidates, locked scenes, camera, and shadow-producing key must not change.
- All four materials use transmission 1.0 and IOR 1.52.
- Cobalt and amber use neutral surfaces plus volume absorption, never flat surface tint.
- Working scenes and renders must remain below the paths defined in the approved spec.

---

## File map

- `scripts/paper-doll-3d/five_variant_contract.py`: immutable shoulder, material, and transmission-card values plus pure shoulder math.
- `scripts/paper-doll-3d/build-five-variant-system.py`: corrected smooth profile, material nodes, transmission card, protected build/save flow.
- `scripts/paper-doll-3d/tests/test_five_variant_contract.py`: source-independent numerical contracts.
- `scripts/paper-doll-3d/tests/test_five_variant_blender.py`: mesh, finish, shader, camera, key, and card integration gates.
- `scripts/paper-doll-3d/render-views.py`: existing consistent view renderer; no geometry generation.
- `pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/`: generated working scenes.
- `pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/`: generated review renders and comparison sheet.

### Task 1: Precision shoulder and material contracts

**Files:**
- Modify: `scripts/paper-doll-3d/five_variant_contract.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_contract.py`

**Interfaces:**
- Produces: `PrecisionShoulderSpec`, `SHOULDER_009`, `shoulder_solution(spec)`, revised `VARIANTS`, and `TRANSMISSION_CARD_009`.
- Consumes: existing `VariantSpec`, `JUNCTION_17_415`, and source-independent test conventions.

- [ ] **Step 1: Write failing precision-profile and material tests**

Add tests equivalent to:

```python
def test_precision_shoulder_contract(self):
    s = self.contract.SHOULDER_009
    solved = self.contract.shoulder_solution(s)
    self.assertAlmostEqual(s.body_radius_mm, 9.85)
    self.assertAlmostEqual(s.finish_root_radius_mm, 7.40)
    self.assertAlmostEqual(s.datum_z_mm, 58.24)
    self.assertAlmostEqual(s.convex_radius_mm, 1.75)
    self.assertAlmostEqual(s.concave_radius_mm, 0.80)
    self.assertAlmostEqual(solved.transition_height_mm, 2.548, places=3)
    self.assertGreater(solved.start_z_mm, 55.6)
    self.assertLess(solved.start_z_mm, 55.8)

def test_production_glass_contract(self):
    for name in ("clear", "frosted", "cobalt", "amber"):
        spec = self.contract.VARIANTS[name]
        self.assertEqual(spec.ior, 1.52)
        self.assertEqual(spec.transmission, 1.0)
        self.assertEqual(spec.surface_tint, (1.0, 1.0, 1.0))
    self.assertIsNone(self.contract.VARIANTS["clear"].absorption_color)
    self.assertIsNone(self.contract.VARIANTS["frosted"].absorption_color)
    self.assertEqual(self.contract.VARIANTS["cobalt"].density, 0.55)
    self.assertEqual(self.contract.VARIANTS["amber"].density, 0.60)
```

- [ ] **Step 2: Run the pure suite and confirm RED**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
```

Expected: failure because `SHOULDER_009`, `ior`, and `transmission` are not defined.

- [ ] **Step 3: Implement the immutable contracts and analytic solve**

Add frozen dataclasses and values:

```python
@dataclass(frozen=True)
class PrecisionShoulderSpec:
    body_radius_mm: float = 9.85
    finish_root_radius_mm: float = 7.40
    datum_z_mm: float = 58.24
    convex_radius_mm: float = 1.75
    concave_radius_mm: float = 0.80
    wall_mm: float = 1.60
    base_mm: float = 3.50

@dataclass(frozen=True)
class ShoulderSolution:
    angle_rad: float
    transition_height_mm: float
    start_z_mm: float

def shoulder_solution(spec):
    span = spec.body_radius_mm - spec.finish_root_radius_mm
    radius_sum = spec.convex_radius_mm + spec.concave_radius_mm
    if radius_sum <= span:
        raise ValueError("precision shoulder radii must exceed radial span")
    angle = math.acos(1.0 - span / radius_sum)
    height = radius_sum * math.sin(angle)
    return ShoulderSolution(angle, height, spec.datum_z_mm - height)
```

Extend `VariantSpec` with `ior`, `transmission`, and frosted micro-normal values. Set the exact shader values from the approved design. Define a frozen transmission-card contract with a 140 × 220 mm face, camera/shadow invisibility, and transmission visibility.

- [ ] **Step 4: Run the pure suite and confirm GREEN**

Run the command from Step 2.

Expected: all pure contract tests pass.

- [ ] **Step 5: Commit the contract checkpoint**

```bash
git add scripts/paper-doll-3d/five_variant_contract.py scripts/paper-doll-3d/tests/test_five_variant_contract.py
git commit -m "feat: define precision 9ml shoulder and glass contracts"
```

### Task 2: Corrected smooth 9 ml shell

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Consumes: `SHOULDER_009`, `shoulder_solution()`, existing `master.revolve()`, `_continuous_profile()`, and approved helix generation.
- Produces: `_precision_009_body_profile(master, bottle_spec, finish_spec)` and corrected smooth builds for clear, frosted, cobalt, and amber.

- [ ] **Step 1: Write failing Blender geometry assertions**

Before building the clear variant, fingerprint camera, key, hidden finish source, and thread source. After the build, assert:

```python
body = bpy.data.objects[builder.BODY_NAME]
assert math.isclose(body.dimensions.x, 19.7, abs_tol=0.5)
assert math.isclose(body.dimensions.z, 72.0, abs_tol=0.8)
assert math.isclose(body["bb_shoulder_start_z_mm"], 55.692, abs_tol=0.01)
assert math.isclose(body["bb_shoulder_end_z_mm"], 58.24, abs_tol=1e-6)
assert body["bb_precision_shoulder"]
assert body["bb_min_smooth_wall_mm"] >= 1.5
assert body["bb_thread_source_fingerprint"] == APPROVED_THREAD
assert builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME]) == finish_before
```

Collect outer vertices below the shoulder and assert their radii are 9.85 mm. Collect shoulder rings and assert their maximum radius decreases monotonically as Z rises. Assert no polygon lies entirely in the finish-datum plane.

- [ ] **Step 2: Run the Blender geometry test and confirm RED**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_five_variant_blender.py
```

Expected: failure because the precision shoulder metadata and profile are absent.

- [ ] **Step 3: Implement the corrected numerical profile**

Add `_precision_009_body_profile()` to the tracked five-variant builder. Reuse the existing heel and base construction, then construct the outer shoulder from two analytic arcs:

```python
solution = contract.shoulder_solution(contract.SHOULDER_009)
for index in range(23):
    phi = solution.angle_rad * index / 22
    outer.append((
        (R - ro) + ro * math.cos(phi),
        solution.start_z_mm + ro * math.sin(phi),
    ))
for index in range(22, -1, -1):
    phi = solution.angle_rad * index / 22
    outer.append((
        (finish_r + ri) - ri * math.cos(phi),
        datum_z - ri * math.sin(phi),
    ))
```

Terminate at `(finish_r, datum_z)` without the old body-side ledge. Build the inner shoulder as the 1.6 mm parallel offset, then connect it to the 9.8 mm bore through a short monotonic interior taper below the datum. Keep the 3.5 mm base and existing heel unchanged. Route only smooth variants through this profile; the explicit swirl candidate path remains unchanged.

Write shoulder metadata onto the rebuilt body. Continue using `_continuous_profile()` to replace the datum annulus with the approved finish outline, and union the approved helix exactly once.

- [ ] **Step 4: Run geometry and family regressions**

Run the Blender command from Step 2 and the pure suite from Task 1.

Expected: both pass; approved thread and finish fingerprints remain unchanged.

- [ ] **Step 5: Commit the geometry checkpoint**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "fix: tighten 9ml shoulder without changing the finish"
```

### Task 3: Production glass shaders

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Consumes: revised `VariantSpec` values from Task 1.
- Produces: `build_glass_material(name)` with one neutral transmissive surface and optional controlled frost or absorption nodes.

- [ ] **Step 1: Replace old shader expectations with failing production assertions**

Assert all four smooth materials use IOR 1.52, transmission 1.0, neutral base color, and exact roughness values. Assert clear and frosted have no Volume Absorption. Assert cobalt and amber each have one Volume Absorption with the contract color and density. Assert only frosted contains Noise Texture and Bump nodes, with scale 85, strength 0.04, and distance 0.012.

- [ ] **Step 2: Run the Blender material test and confirm RED**

Run the Task 2 Blender command.

Expected: failure on IOR 1.50 and the old colored surface tints.

- [ ] **Step 3: Implement the minimal shader upgrade**

Update `build_glass_material()`:

```python
shader.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
shader.inputs["Transmission Weight"].default_value = spec.transmission
shader.inputs["IOR"].default_value = spec.ior
shader.inputs["Roughness"].default_value = spec.roughness
```

Create frost nodes only when `spec.frosted` is true. Create Volume Absorption only when `spec.absorption_color` exists. Record IOR, transmission, roughness, and absorption metadata on the material for scene audit.

- [ ] **Step 4: Run Blender and pure regression suites**

Expected: all shader and geometry assertions pass.

- [ ] **Step 5: Commit the material checkpoint**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: upgrade 9ml production glass materials"
```

### Task 4: Transmission card with locked key and camera

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Consumes: `TRANSMISSION_CARD_009` and existing `ensure_reflection_strip()`.
- Produces: `ensure_transmission_card()` returning `BB_CARD_GLASS_TRANSMISSION_BACK`.

- [ ] **Step 1: Write the failing studio-isolation test**

Capture full snapshots of `BB_CAM_MASTER` and `BB_LIGHT_KEY_SOFTBOX`, call `ensure_transmission_card()`, and assert the snapshots are unchanged. Assert the new card:

```python
assert not card.visible_camera
assert not card.visible_shadow
assert card.visible_transmission
assert not card.visible_glossy
assert card["bb_role"] == "transmission_only_back_card"
assert tuple(round(v, 3) for v in card.dimensions[:2]) == (140.0, 220.0)
```

- [ ] **Step 2: Run the Blender suite and confirm RED**

Expected: failure because `ensure_transmission_card()` is missing.

- [ ] **Step 3: Implement the card as an idempotent non-destructive scene element**

Create a white, low-strength emission plane behind and slightly left of the bottle. Aim it at the bottle center. Set camera, glossy, diffuse, and shadow visibility false; set transmission visibility true. Link it into `LIGHTING`, expose its role and dimensions as metadata, and call it from `build_variant()` after the existing reflection strip.

- [ ] **Step 4: Run the Blender suite and verify camera/key isolation**

Expected: all scene, geometry, material, and finish assertions pass.

- [ ] **Step 5: Commit the lighting checkpoint**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: add transmission-only glass light card"
```

### Task 5: Build four scenes and render consistent comparisons

**Files:**
- Generate: `pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/*.blend`
- Generate: `pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/*.png`

**Interfaces:**
- Consumes: `build_variant(name, save=True, output=...)` and `render-views.py`.
- Produces: four working scenes, four hero renders, one clear shoulder macro, and one labeled comparison sheet.

- [ ] **Step 1: Build the four working scenes**

Run this exact loop from the repository root:

```bash
mkdir -p pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade
for bb_variant in clear frosted cobalt amber; do
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup \
    -b pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
    -P scripts/paper-doll-3d/build-five-variant-system.py -- \
    --variant "$bb_variant" \
    --output "pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-${bb_variant}-shoulder-glass.blend"
done
```

- [ ] **Step 2: Render identical front heroes**

Run this exact loop:

```bash
mkdir -p pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade
for bb_variant in clear frosted cobalt amber; do
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup \
    -b "pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-${bb_variant}-shoulder-glass.blend" \
    -P scripts/paper-doll-3d/render-views.py -- \
    --view front \
    --out "pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-${bb_variant}-front.png" \
    --samples 192 --res 800 880
done
```

Use the same camera and scene exposure for every variant.

- [ ] **Step 3: Render the clear shoulder macro**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup \
  -b pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend \
  -P scripts/paper-doll-3d/render-views.py -- \
  --view macro \
  --out pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-macro.png \
  --samples 192 --res 800 880
```

- [ ] **Step 4: Compose and inspect the comparison sheet**

Compose the sheet with:

```bash
magick montage \
  \( pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-front.png -set label CLEAR \) \
  \( pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-frosted-front.png -set label FROSTED \) \
  \( pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-cobalt-front.png -set label COBALT \) \
  \( pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-amber-front.png -set label AMBER \) \
  -tile 2x2 -geometry 800x880+18+44 -background '#c7beb1' \
  -fill '#2f2b27' -font /System/Library/Fonts/Helvetica.ttc -pointsize 26 \
  pipeline/paper-doll-3d/renders/five-variant/9ml-shoulder-glass-upgrade/009ml-four-glass-comparison.png
```

Inspect the heroes, macro, and comparison sheet at original resolution. Reject output with pinched shoulders, duplicate ledges, opaque frost, flat colored surfaces, muddy absorption, or changed shadow direction.

- [ ] **Step 5: Record generated-scene evidence**

For each scene, print and retain the variant name, body dimensions, precision shoulder metadata, thread fingerprint, finish fingerprint, camera fingerprint, key fingerprint, IOR, transmission, roughness, and absorption metadata.

### Task 6: Full verification and handoff

**Files:**
- Verify only; modify tests solely if a discovered acceptance requirement lacks coverage.

**Interfaces:**
- Consumes: every prior task deliverable.
- Produces: final passing evidence and user-review paths; no automatic lock promotion.

- [ ] **Step 1: Run all pure contract tests**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
```

- [ ] **Step 2: Run all Blender integration tests**

Run both `test_five_variant_blender.py` and `test_swirl_clay_candidates_blender.py` from the immutable baseline. The swirl test proves the excluded body path still works and remains isolated.

- [ ] **Step 3: Verify immutable hashes**

Run SHA-256 checks for the approved baseline and the pre-existing locked swirl file. Both must match their pre-implementation values.

- [ ] **Step 4: Review git scope**

Confirm only the contract, protected builder, tests, spec/plan, and intended generated review assets changed. Preserve unrelated dirty-worktree files.

- [ ] **Step 5: Invoke completion verification and branch-finishing workflows**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Report the corrected scenes, renders, test results, immutable hashes, and the fact that no candidate was promoted to `master/locked`.
