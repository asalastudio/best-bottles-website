# 9 ml Cylinder Luxury Glass Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one protected photorealistic 9 ml Cylinder luxury-studio master and four material-only derivatives without changing a single approved geometry coordinate, object transform, or camera-composition value.

**Architecture:** A pure-Python contract owns immutable fingerprints, master-glass parameters, parametric light definitions, render settings, crop rectangles, and output paths. A new Blender builder operates on the approved clear working scene, audits and locks its geometry, creates one `BB_GLASS_MASTER` node group and four materials, replaces the old look-development emitters with a new `BB_STUDIO_GLASS_LUXURY` collection, then saves one master and four derivatives. A dedicated QC renderer produces identical full frames, 200% crops, raw/denoised neck comparisons, a four-up sheet, and a JSON audit.

**Tech Stack:** Python 3, Blender 5.2 LTS Python API, Cycles/Metal, `unittest`, ImageMagick, SHA-256 geometry and source locks.

## Global Constraints

- Never overwrite any existing `.blend` file.
- Source scene: `pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend`.
- Source SHA-256: `c436ed8f8c0c363695bf2bcbbdb371a67a4e8c1fd2b6574ac8ebcd6663d22ea0`.
- Body mesh SHA-256: `ed64930d7ea4e7301a2687340ea2e3235cbb5f0f4545be0313200e1d1dfba016`.
- Finish SHA-256: `016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`.
- Preserve the 19.7 x 19.7 x 72.0 mm envelope and every vertex, polygon, material index, smoothing flag, object transform, and modifier list.
- Preserve `BB_CAM_MASTER`: 100 mm lens, 36 mm sensor, location `(0, -305.5555, 36)`, rotation `(90 degrees, 0, 0)`, depth of field off.
- Only clear, amber, cobalt, and frosted are in scope. Swirl and both 9 ml tall-cylinder assets are excluded.
- Use one master scene and four derivative scenes. Derivatives may differ only by assigned `BB_GLASS_*` material and variant metadata.
- Use Cycles GPU, AgX, 512 final samples, adaptive sampling at 0.005, 12 total/transmission bounces, 8 glossy/transparent bounces, and 4 diffuse bounces.
- Do not promote anything into `pipeline/paper-doll-3d/master/locked`.

---

## File map

- Create `scripts/paper-doll-3d/luxury_glass_contract.py`: immutable source values, material presets, rig formulas, render settings, crop rectangles, fingerprint helpers.
- Create `scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py`: read-only geometry audit, node group/material creation, studio creation, protection, master/derivative saving, JSON manifest.
- Create `scripts/paper-doll-3d/render-9ml-luxury-qc.py`: GPU setup, full-frame and raw/denoised rendering, deterministic crop/export orchestration.
- Create `scripts/paper-doll-3d/tests/test_luxury_glass_contract.py`: source-independent numerical and naming gates.
- Create `scripts/paper-doll-3d/tests/test_luxury_glass_blender.py`: geometry, node, light, camera, render, derivative, and collection gates.
- Create generated review assets beneath `pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio/` and `pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio/`.

---

### Task 1: Immutable contract and parametric rig specification

**Files:**
- Create: `scripts/paper-doll-3d/luxury_glass_contract.py`
- Create: `scripts/paper-doll-3d/tests/test_luxury_glass_contract.py`

**Interfaces:**
- Consumes: the immutable values in the approved design spec.
- Produces: `SOURCE_SCENE`, `SOURCE_SHA256`, `BODY_GEOMETRY_SHA256`, `THREAD_SHA256`, `GeometryContract`, `GlassPreset`, `LightSpec`, `RenderContract`, `VARIANTS`, `LIGHTS`, `NEGATIVE_CARDS`, `geometry_fingerprint(mesh)`, `object_snapshot(obj)`, and `crop_boxes(width, height)`.

- [ ] **Step 1: Write failing pure-contract tests**

Test exact source hashes, the 19.7 x 72.0 envelope, four variant names, material bounds, five named lights, two named negative cards, 100 mm camera values, 512 samples, AgX, bounce limits, and normalized crop boxes. Include these assertions:

```python
self.assertEqual(set(contract.VARIANTS), {"clear", "amber", "cobalt", "frosted"})
self.assertEqual(contract.GEOMETRY.body_sha256, "ed64930d...")
self.assertEqual(contract.RENDER.samples, 512)
self.assertEqual(contract.RENDER.view_transform, "AgX")
self.assertEqual(contract.VARIANTS["clear"].absorption_density, 0.0)
self.assertGreater(contract.VARIANTS["amber"].absorption_density, 0.0)
self.assertGreater(contract.VARIANTS["cobalt"].absorption_density, 0.0)
self.assertTrue(0.22 <= contract.VARIANTS["frosted"].surface_roughness <= 0.32)
self.assertTrue(0.01 <= contract.VARIANTS["frosted"].micro_normal_strength <= 0.03)
```

- [ ] **Step 2: Run the pure suite and verify RED**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_luxury_glass_contract.py -v
```

Expected: import failure because `luxury_glass_contract.py` does not exist.

- [ ] **Step 3: Implement the contract**

Use frozen dataclasses. Initial material values are:

```python
VARIANTS = {
    "clear": GlassPreset(1.50, 0.020, 1.0, (1, 1, 1), 0.0, 0.0, 0.0, 420.0, 0.0),
    "amber": GlassPreset(1.50, 0.022, 1.0, (0.72, 0.32, 0.045), 0.75, 0.0, 0.006, 420.0, 0.0),
    "cobalt": GlassPreset(1.50, 0.020, 1.0, (0.003, 0.012, 0.92), 0.55, 0.0, 0.006, 420.0, 0.0),
    "frosted": GlassPreset(1.50, 0.260, 1.0, (1, 1, 1), 0.0, 1.0, 0.035, 420.0, 0.018),
}
```

Define five Area lights from `H=72.0` and `D=19.7`. Store angular placement, radial distance, Z, width, height, and initial energy rather than hard-coded Blender coordinates. Resolve angles using `x = radius * sin(angle)` and `y = -radius * cos(angle)` for the two front lights.

- [ ] **Step 4: Run pure tests and verify GREEN**

Run the Task 1 command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/paper-doll-3d/luxury_glass_contract.py scripts/paper-doll-3d/tests/test_luxury_glass_contract.py
git commit -m "feat: define 9ml luxury glass contracts"
```

---

### Task 2: Geometry audit and master glass node group

**Files:**
- Create: `scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py`
- Create: `scripts/paper-doll-3d/tests/test_luxury_glass_blender.py`

**Interfaces:**
- Consumes: Task 1 contracts and an already-loaded approved source scene.
- Produces: `audit_geometry() -> dict`, `protected_snapshot() -> dict`, `ensure_master_group() -> bpy.types.ShaderNodeTree`, `ensure_glass_material(name) -> bpy.types.Material`, and `assign_variant(name) -> bpy.types.Material`.

- [ ] **Step 1: Write failing Blender audit and material assertions**

Load the approved clear source. Assert that `audit_geometry()` reports one component, zero non-manifold/boundary/wire edges, zero duplicate coordinates/faces, zero zero-area faces, positive signed volume, normalized face normals, open bore, real rim, 3.5 mm base, and the immutable body/thread hashes.

Assert `BB_GLASS_MASTER` exposes exactly these sockets:

```python
{
    "IOR", "surface_roughness", "transmission", "absorption_color",
    "absorption_density", "frost_amount", "micro_roughness_amount",
    "micro_roughness_scale", "micro_normal_strength",
}
```

Assert all four materials contain the node group, use alpha 1, metallic 0, physical transmission 1, and no Solidify modifier or geometry mutation.

- [ ] **Step 2: Run Blender test and verify RED**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend \
  -P scripts/paper-doll-3d/tests/test_luxury_glass_blender.py
```

Expected: import failure because the luxury builder is absent.

- [ ] **Step 3: Implement geometry audit and protection**

Audit a copied `bmesh` so the source mesh is never edited. Use exact coordinate/face hashing, manifold checks, connected-component traversal, signed volume, mouth cap-face detection, rim annulus detection, and source metadata for wall/base dimensions. Capture object transform, vertex/polygon counts, smoothing flags, and modifier tuples before any scene work. Set `hide_select=True` on `BB_BTL_CYL_009ML_001`, `BB_FIN_17_415`, and `FINISH_MASTER_17_415` only in the new output master.

- [ ] **Step 4: Implement `BB_GLASS_MASTER`**

Build one node group with a Principled surface, Geometry/Noise/ColorRamp/Bump micro-surface branch, Volume Absorption, and group outputs for `Surface` and `Volume`. The group controls roughness without changing alpha. Use the exposed `frost_amount` to blend uniform polished roughness with microscopic roughness and to scale the bump below 0.03.

Create `BB_GLASS_CLEAR`, `BB_GLASS_AMBER`, `BB_GLASS_COBALT`, and `BB_GLASS_FROSTED`. The materials contain only Group Input/Output wiring around `BB_GLASS_MASTER`; colored materials keep neutral surface color and pass absorption through the volume output.

- [ ] **Step 5: Re-run Blender and pure tests**

Run the Task 1 and Task 2 commands. Expected: both pass and the geometry fingerprints remain exact.

- [ ] **Step 6: Commit**

```bash
git add scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py scripts/paper-doll-3d/tests/test_luxury_glass_blender.py
git commit -m "feat: add protected 9ml master glass system"
```

---

### Task 3: Luxury Area-light studio and render controls

**Files:**
- Modify: `scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py`
- Modify: `scripts/paper-doll-3d/tests/test_luxury_glass_blender.py`

**Interfaces:**
- Consumes: `LIGHTS`, `NEGATIVE_CARDS`, and protected source snapshots.
- Produces: `ensure_luxury_studio() -> bpy.types.Collection`, `configure_camera()`, `configure_cycles()`, and `configure_color_management()`.

- [ ] **Step 1: Add failing studio assertions**

Assert collection `BB_STUDIO_GLASS_LUXURY` contains exactly five Area lights and at least two matte-black cards. Check names, rectangle shapes, dimensions derived from `H`/`D`, energy values from the contract, light aim at `(0, 0, 38)`, and that all cards are outside the 100 mm camera frame.

Assert old look-development emitters are retained but disabled in the new master. Assert the physical sweep remains visible, the key remains left/front, and the cast-shadow direction remains toward screen right.

Assert camera transform/lens are byte-for-byte unchanged. Assert Cycles/AgX settings match the global contract.

- [ ] **Step 2: Run Blender test and verify RED**

Run the Task 2 Blender command. Expected: failure because `BB_STUDIO_GLASS_LUXURY` is missing.

- [ ] **Step 3: Implement the studio**

Create Area lights with `shape='RECTANGLE'`, use quaternion tracking so local `-Z` points at the product target, and store each contract value as object metadata. Create negative cards as non-emissive Principled materials with base color near `(0.003, 0.003, 0.003)`, roughness 1.0, and camera visibility disabled while glossy visibility remains enabled.

Disable the old mesh emitters by setting `hide_render=True` in the new master only. Preserve `BB_STUDIO_SWEEP` and its warm-neutral material. Use lights rather than a material-color change to create the 5-8% background gradient.

- [ ] **Step 4: Implement render and color management**

Set Cycles GPU/Metal, samples 512, adaptive threshold 0.005, bounce values from the contract, denoising on, AgX, neutral look, exposure 0, gamma 1, and no bloom or depth of field. Preserve resolution and camera framing unless the QC renderer explicitly overrides output resolution.

- [ ] **Step 5: Run Blender and pure regressions**

Run the Task 1 and Task 2 commands. Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py scripts/paper-doll-3d/tests/test_luxury_glass_blender.py
git commit -m "feat: build 9ml luxury reflection studio"
```

---

### Task 4: Save protected master, four derivatives, and audit manifest

**Files:**
- Modify: `scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py`
- Modify: `scripts/paper-doll-3d/tests/test_luxury_glass_blender.py`

**Interfaces:**
- Consumes: completed glass/studio builder.
- Produces: `build_master(output_path) -> Path`, `save_derivatives(output_dir) -> dict[str, Path]`, and `write_audit_manifest(path) -> Path`.

- [ ] **Step 1: Add failing derivative assertions**

Build in memory and assert the master contains all four materials. Save four temporary derivatives and reopen each. Compare geometry, camera, studio, backdrop, render settings, and color-management snapshots. The only permitted differences are `scene['bb_variant']`, the visible bottle material, file path, and output path.

- [ ] **Step 2: Run Blender test and verify RED**

Run the Task 2 Blender command. Expected: failure because save functions are missing.

- [ ] **Step 3: Implement deterministic saving**

The CLI accepts:

```text
--output-dir pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio
--audit-json pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio/009ml-luxury-audit.json
```

Refuse to overwrite any pre-existing output unless `--replace-generated` is passed and the target lies inside the exact luxury output directory. Save `009ml-luxury-master.blend`, then assign each material and save the four named derivatives. Restore the master material after derivative generation.

- [ ] **Step 4: Implement JSON audit**

Record source SHA, geometry/thread fingerprints, topology audit, material inputs, light transforms/sizes/energies, negative-card transforms, camera, Cycles, AgX, disabled legacy emitters, and every output path.

- [ ] **Step 5: Run all contract and Blender tests**

Run Task 1 and Task 2 commands. Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py scripts/paper-doll-3d/tests/test_luxury_glass_blender.py
git commit -m "feat: generate protected 9ml luxury variants"
```

---

### Task 5: QC renderer, diagnostic crops, and denoise comparison

**Files:**
- Create: `scripts/paper-doll-3d/render-9ml-luxury-qc.py`
- Modify: `scripts/paper-doll-3d/tests/test_luxury_glass_contract.py`

**Interfaces:**
- Consumes: four derivative scenes and `crop_boxes(width, height)`.
- Produces: full renders, three 200% crops per variant, matching raw/denoised neck crops, and `009ml-four-luxury-comparison.png`.

- [ ] **Step 1: Add failing crop/render contract tests**

At 1200 x 1320, require non-overflowing pixel boxes for `neck`, `shoulder`, and `base`, with each box centered on the bottle axis. Require output names to contain variant, region, sample count, and denoise status.

- [ ] **Step 2: Run pure tests and verify RED**

Run Task 1 pure suite. Expected: failure because QC name helpers are absent.

- [ ] **Step 3: Implement QC renderer**

The Blender script supports:

```text
--out-dir <dir> --samples 512 --res 1200 1320 --variant <name>
--denoise on|off --region full|neck|shoulder|base
```

It may change only render output settings and denoise state. It verifies geometry/camera fingerprints immediately before rendering. It writes 16-bit PNG full frames and uses the contract crop boxes for deterministic 200% diagnostics.

- [ ] **Step 4: Implement comparison sheet composition**

After all four full frames exist, call ImageMagick with a fixed 2x2 layout, bone-neutral gutters, and labels `CLEAR`, `FROSTED`, `COBALT`, `AMBER`. Do not apply sharpening, saturation, vignetting, glare, or color correction.

- [ ] **Step 5: Run pure and Blender regressions**

Run Task 1 and Task 2 commands. Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/paper-doll-3d/render-9ml-luxury-qc.py scripts/paper-doll-3d/tests/test_luxury_glass_contract.py
git commit -m "feat: add 9ml luxury glass QC renders"
```

---

### Task 6: Generate, tune, render, and verify final review set

**Files:**
- Generated: `pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio/*.blend`
- Generated: `pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio/*`

**Interfaces:**
- Consumes: all committed implementation files.
- Produces: protected master, four derivatives, audit JSON, four final renders, twelve 200% region crops, eight raw/denoised neck crops, and one comparison sheet.

- [ ] **Step 1: Build the master and derivatives**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend \
  -P scripts/paper-doll-3d/build-9ml-luxury-glass-studio.py -- \
  --output-dir pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio \
  --audit-json pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio/009ml-luxury-audit.json
```

- [ ] **Step 2: Produce 96-sample calibration renders**

Render all four at 800 x 880, inspect reflection width, edge separation,
background gradient, contact shadow, amber/cobalt optical-depth behavior, and
frost scale. Tune only contract material/light values. Rebuild and repeat until
the pass conditions are met.

- [ ] **Step 3: Produce 512-sample masters and diagnostics**

Run the QC renderer for all four derivatives at 1200 x 1320 and 512 samples.
Generate three 200% crops per variant plus raw and denoised neck crops.

- [ ] **Step 4: Escalate only if the denoise gate fails**

Compare raw and denoised crops. If denoising joins, melts, or softens thread
highlights, render matching 1024-sample raw and denoised neck crops. Keep the
geometry and materials unchanged during this test.

- [ ] **Step 5: Run final automated verification**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_luxury_glass_contract.py -v
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio/009ml-luxury-master.blend \
  -P scripts/paper-doll-3d/tests/test_luxury_glass_blender.py
shasum -a 256 \
  pipeline/paper-doll-3d/master/working/five-variant/9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend
```

Require zero failures and the original source SHA `c436ed8f...`.

- [ ] **Step 6: Review git scope and invoke completion verification**

Confirm that unrelated dirty-worktree files remain untouched. Use
`superpowers:verification-before-completion`, then
`superpowers:finishing-a-development-branch`. Report the exact materials,
lights, camera, Cycles, AgX, geometry audit, and before/after paths. Do not
promote outputs into `master/locked`.
