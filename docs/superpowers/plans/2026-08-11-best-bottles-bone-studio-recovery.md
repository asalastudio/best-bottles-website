# Best Bottles Bone Studio Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine the newly locked 17-415 bottle geometry and camera with the earlier approved bright bone-studio product-photography look, without carrying forward the darker luxury branch or creating a second source of truth.

**Architecture:** The locked five-variant Blender scenes remain immutable geometry authorities. A separate recovery contract and calibration script may change only studio, world, color-management, and glass-material parameters on working copies; geometry, finish/thread meshes, object transforms, and the master camera are snapshot-gated before and after every calibration. One cobalt bottle is verdict-gated first, then the approved studio is propagated to clear, amber, frosted, and swirl.

**Tech Stack:** Blender 5.2, Cycles, Python 3, existing `scripts/paper-doll-3d` builders and tests, ImageMagick contact sheets, SHA-256 geometry/thread contracts.

## Global Constraints

- Use the locked scenes under `pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/` as the only geometry source.
- Never source geometry from `9ml-luxury-glass-studio`; its audited body fingerprint differs from the locked family.
- Preserve the locked 17-415 helix fingerprint `016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`.
- Preserve the locked shared clear/frosted/cobalt/amber family fingerprint `e9be8d2ddada1a3a2ca926b25a44ae067d9d5ae2f27f25ab55ed62712592f5b6`.
- Do not edit the locked `.blend` files in place; all experiments use isolated working copies.
- The visual target is the bright bone studio represented by `pipeline/paper-doll-3d/renders/nemat-progress-2026-08-09/final-9ml-cobalt.png`, not its obsolete era-2 thread geometry.
- Keep the house backdrop at `#EFE9DE` unless a measured color-management conversion is required to render that visible value.
- Keep the protected master camera at 100 mm, 36 mm sensor, location `(0.0, -305.5555, 36.0)`, rotation `(90.0, 0.0, 0.0)`, with depth of field disabled.
- Geometry is judged in clay first; glass/material changes may not conceal or alter geometry.
- Change one lighting or material variable per bracket and stop for Jordan's verdict on the cobalt recovery frame before propagation.
- Do not overwrite the approved August 9 renders, the locked August 11 renders, or luxury audit outputs.

---

### Task 1: Establish the recovery contract and protected source

**Files:**
- Create: `scripts/paper-doll-3d/bone_studio_recovery_contract.py`
- Create: `scripts/paper-doll-3d/tests/test_bone_studio_recovery_contract.py`
- Read: `pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/LOCK-MANIFEST.md`
- Read: `scripts/paper-doll-3d/five_variant_contract.py`

**Interfaces:**
- Consumes: locked scene hashes, `five_variant_contract.object_snapshot`, and the existing camera/thread names.
- Produces: `LOCKED_SOURCES`, `TARGET_STUDIO`, `PERMITTED_MUTATION_TYPES`, `assert_protected_state(before, after)`, and deterministic output paths used by later tasks.

- [ ] **Step 1: Write the failing pure-Python contract test**

```python
def test_recovery_uses_locked_family_not_luxury_source():
    assert all("master/locked/five-variant-2026-08-11" in str(path)
               for path in recovery.LOCKED_SOURCES.values())
    assert "9ml-luxury-glass-studio" not in " ".join(
        str(path) for path in recovery.LOCKED_SOURCES.values()
    )
    assert recovery.THREAD_SHA256 == (
        "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"
    )
    assert recovery.SHARED_BODY_SHA256 == (
        "e9be8d2ddada1a3a2ca926b25a44ae067d9d5ae2f27f25ab55ed62712592f5b6"
    )
    assert recovery.TARGET_STUDIO.backdrop_hex == "#EFE9DE"
    assert recovery.TARGET_STUDIO.camera_lens_mm == 100.0
    assert recovery.TARGET_STUDIO.use_dof is False
```

- [ ] **Step 2: Run the test and verify the missing contract fails**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_bone_studio_recovery_contract.py -v
```

Expected: import failure for `bone_studio_recovery_contract`.

- [ ] **Step 3: Implement the immutable recovery contract**

Define exact locked paths for cobalt, clear, amber, frosted, and swirl; the approved visual-reference PNG; camera constants; backdrop; render dimensions; Cycles/AgX settings; and working/render roots named `9ml-bone-studio-recovery`. Implement `assert_protected_state` so only scene objects tagged as studio/light/world/material may differ; any camera transform, bottle mesh, finish mesh, or object transform difference raises `AssertionError` with the changed object name.

- [ ] **Step 4: Run the contract test and the existing five-variant contract tests**

```bash
python3 -m unittest \
  scripts/paper-doll-3d/tests/test_bone_studio_recovery_contract.py \
  scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit the contract independently**

```bash
git add scripts/paper-doll-3d/bone_studio_recovery_contract.py \
  scripts/paper-doll-3d/tests/test_bone_studio_recovery_contract.py
git commit -m "test: lock bone studio recovery contract"
```

### Task 2: Create an isolated cobalt recovery scene without geometry drift

**Files:**
- Create: `scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py`
- Create: `scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py`
- Read: `scripts/paper-doll-3d/build-five-variant-system.py`
- Read: `scripts/paper-doll-3d/build-master-scene.py:1826`

**Interfaces:**
- Consumes: `bone_studio_recovery_contract.LOCKED_SOURCES["cobalt"]` and protected snapshots.
- Produces: `prepare_recovery_scene()`, `studio_snapshot()`, and `pipeline/paper-doll-3d/master/working/five-variant/9ml-bone-studio-recovery/009ml-cobalt-bone-recovery.blend`.

- [ ] **Step 1: Write Blender integration tests for immutability**

The test must snapshot the bottle body, `BB_FIN_17_415`, and `BB_CAM_MASTER`; call `prepare_recovery_scene()`; then assert identical geometry hashes, locations, rotations, scales, camera lens/sensor/DOF, and thread fingerprint. It must also assert that no object named `BB_LUX_*` is render-enabled and that the backdrop material resolves to the visible bone target.

- [ ] **Step 2: Run the Blender test and verify it fails before the builder exists**

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/010ml-cobalt-17-415-THREAD-LOCKED-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py
```

Expected: builder import failure.

- [ ] **Step 3: Implement the recovery builder**

The builder must open or start from the locked cobalt scene, capture protected snapshots, disable any luxury-only collection, restore the existing `BB_STUDIO_SWEEP`, and configure only the original bone-studio lights/material/world. It must call `assert_protected_state` before saving the working copy. Do not rebuild the bottle, finish, or camera.

- [ ] **Step 4: Build the working copy and rerun immutability tests**

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/010ml-cobalt-17-415-THREAD-LOCKED-2026-08-11.blend \
  -P scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py -- \
  --variant cobalt --mode baseline

/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/working/five-variant/9ml-bone-studio-recovery/009ml-cobalt-bone-recovery.blend \
  -P scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py
```

Expected: protected-state tests pass and the working file is created outside the locked directory.

- [ ] **Step 5: Commit the isolated builder and tests**

```bash
git add scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py \
  scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py
git commit -m "feat: add geometry-safe bone studio recovery builder"
```

### Task 3: Render a one-variable cobalt calibration bracket

**Files:**
- Create: `scripts/paper-doll-3d/render-9ml-bone-studio-recovery.py`
- Modify: `scripts/paper-doll-3d/bone_studio_recovery_contract.py`
- Create: `pipeline/paper-doll-3d/renders/five-variant/9ml-bone-studio-recovery/README.md`

**Interfaces:**
- Consumes: the protected cobalt working scene and named studio presets.
- Produces: four full-resolution renders, matching neck/base crops, a labeled comparison sheet, and `bone-studio-recovery-audit.json` containing source hashes and studio settings.

- [ ] **Step 1: Add a pure-Python test for the exact calibration plan**

```python
def test_calibration_plan_changes_one_variable_per_frame():
    plan = recovery.calibration_plan()
    assert [item.name for item in plan] == [
        "A_LOCKED_BASELINE",
        "B_BRIGHT_BONE",
        "C_SOFT_REFLECTIONS",
        "D_ORIGINAL_COMPOSITION",
    ]
    for previous, current in zip(plan, plan[1:]):
        changed = recovery.changed_fields(previous, current)
        assert len(changed) == 1, changed
```

- [ ] **Step 2: Implement the exact four-frame bracket**

Frame A reproduces the locked cobalt scene. Frame B changes only the visible backdrop/world brightness to the August target. Frame C changes only the reflection rig from hard rectangular strips to the approved broad softbox/card arrangement. Frame D changes only product framing/subject coverage while preserving the protected camera transform; implement framing through render crop/border or output composition, not by moving or changing the camera.

- [ ] **Step 3: Render the bracket at full stakeholder dimensions**

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/working/five-variant/9ml-bone-studio-recovery/009ml-cobalt-bone-recovery.blend \
  -P scripts/paper-doll-3d/render-9ml-bone-studio-recovery.py -- \
  --bracket --samples 512 --width 2080 --height 2288
```

Expected outputs include `A_LOCKED_BASELINE.png`, `B_BRIGHT_BONE.png`, `C_SOFT_REFLECTIONS.png`, `D_ORIGINAL_COMPOSITION.png`, same-zoom crops, and `009ml-cobalt-bone-recovery-comparison.png`.

- [ ] **Step 4: Verify the audit and visual gates**

Run the recovery contract tests and confirm the audit JSON reports the locked body/thread hashes and unchanged camera snapshot for every frame. Inspect the comparison sheet for brighter bone separation, broad curved reflections, a soft grounded shadow, readable cobalt transmission, and no boxy highlight strip.

- [ ] **Step 5: Stop for Jordan's verdict**

Present only the labeled cobalt comparison. Do not propagate a studio preset until Jordan selects or rejects a frame. Record his exact verdict and any marked-up visual feedback in the recovery README.

- [ ] **Step 6: Commit only after the verdict is recorded**

```bash
git add scripts/paper-doll-3d/render-9ml-bone-studio-recovery.py \
  scripts/paper-doll-3d/bone_studio_recovery_contract.py \
  pipeline/paper-doll-3d/renders/five-variant/9ml-bone-studio-recovery/README.md
git commit -m "feat: calibrate cobalt bone studio recovery"
```

### Task 4: Promote the approved studio preset across the five variants

**Files:**
- Modify: `scripts/paper-doll-3d/bone_studio_recovery_contract.py`
- Modify: `scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py`
- Modify: `scripts/paper-doll-3d/render-9ml-bone-studio-recovery.py`
- Modify: `scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py`

**Interfaces:**
- Consumes: Jordan's approved cobalt preset name and locked source scene per variant.
- Produces: geometry-safe working scenes and full-resolution renders for clear, frosted, cobalt, amber, and swirl.

- [ ] **Step 1: Encode the approved studio as a named immutable preset**

Copy the exact selected values into `APPROVED_BONE_STUDIO`; do not reference mutable scene state or the luxury contract.

- [ ] **Step 2: Add cross-variant geometry and camera tests**

For clear/frosted/cobalt/amber, assert the shared family fingerprint and identical camera/studio snapshots. For swirl, assert its locked independent body fingerprint plus the shared thread fingerprint and identical camera/studio snapshots.

- [ ] **Step 3: Build and render all five variants**

```bash
for variant in clear frosted cobalt amber swirl; do
  /Applications/Blender.app/Contents/MacOS/Blender \
    -b "pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/010ml-${variant}-17-415-THREAD-LOCKED-2026-08-11.blend" \
    -P scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py -- \
    --variant "$variant" --mode approved
done
```

Run the render script for the generated working scenes at 2080×2288 and 512 samples.

- [ ] **Step 4: Generate paper-doll registration proof**

Render an opaque neutral-clay silhouette from each shared-body scene and assert pixel-identical masks for clear/frosted/cobalt/amber. Generate an overlay/contact sheet that demonstrates common base, shoulder, neck, and thread registration. Report any nonzero silhouette delta as a failure; material transparency is not used for this gate.

- [ ] **Step 5: Run the full relevant test suite**

```bash
python3 -m unittest \
  scripts/paper-doll-3d/tests/test_five_variant_contract.py \
  scripts/paper-doll-3d/tests/test_bone_studio_recovery_contract.py -v

/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/working/five-variant/9ml-bone-studio-recovery/009ml-cobalt-bone-recovery.blend \
  -P scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py

/Applications/Blender.app/Contents/MacOS/Blender \
  -b pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/010ml-cobalt-17-415-THREAD-LOCKED-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/audit_locked_five_variant_scenes.py
```

Expected: all contracts pass, locked inputs remain unchanged, and the registration proof is pixel-identical for the shared-body variants.

- [ ] **Step 6: Commit the approved five-variant recovery**

```bash
git add scripts/paper-doll-3d/bone_studio_recovery_contract.py \
  scripts/paper-doll-3d/build-9ml-bone-studio-recovery.py \
  scripts/paper-doll-3d/render-9ml-bone-studio-recovery.py \
  scripts/paper-doll-3d/tests/test_bone_studio_recovery_blender.py \
  pipeline/paper-doll-3d/renders/five-variant/9ml-bone-studio-recovery
git commit -m "feat: lock five-variant bone studio recovery"
```

### Task 5: Retire ambiguity without deleting the luxury experiment

**Files:**
- Modify: `pipeline/paper-doll-3d/RIG-MANUAL.md`
- Modify: `pipeline/paper-doll-3d/HANDOVER-2026-08-10.md`
- Modify: `scripts/paper-doll-3d/luxury_glass_contract.py`
- Test: `scripts/paper-doll-3d/tests/test_luxury_glass_contract.py`

**Interfaces:**
- Consumes: the approved recovery preset and its audit manifest.
- Produces: one documented production source of truth while retaining the luxury branch as historical look-development evidence.

- [ ] **Step 1: Mark the luxury contract as non-production**

Add `STATUS = "experimental-retired-from-production"` and a `PRODUCTION_SUCCESSOR` path pointing to the bone studio recovery contract. Add a test that production builders reject the luxury source while its existing audit tests continue to pass.

- [ ] **Step 2: Update operator documentation**

Document the hierarchy: locked five-variant geometry → approved bone studio recovery → per-variant materials → outputs. State that the luxury files must not be used as geometry or production studio sources.

- [ ] **Step 3: Verify no production path imports the retired luxury contract**

```bash
rg -n "import luxury_glass_contract|from luxury_glass_contract" \
  scripts/paper-doll-3d | rg -v "tests|9ml-luxury|9ml-cobalt-correction"
```

Expected: no production recovery or batch-render path imports the luxury contract.

- [ ] **Step 4: Commit the source-of-truth documentation**

```bash
git add pipeline/paper-doll-3d/RIG-MANUAL.md \
  pipeline/paper-doll-3d/HANDOVER-2026-08-10.md \
  scripts/paper-doll-3d/luxury_glass_contract.py \
  scripts/paper-doll-3d/tests/test_luxury_glass_contract.py
git commit -m "docs: make bone studio the production source of truth"
```

## Completion Gate

The recovery is complete only when the locked geometry/thread audits pass unchanged, Jordan approves one cobalt bone-studio comparison frame, that exact studio preset renders all five variants without camera/studio drift, shared-body clay masks are pixel-identical, and the documentation names the bone-studio recovery path—not the luxury branch—as production authority.
