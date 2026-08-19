# Cobalt Base Halo Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test a removable 15% lower-base reflection-control card without altering the approved cobalt bottle or grounded studio.

**Architecture:** Extend the existing final-lock contract with one explicitly named experimental reflection card. The builder creates it in the final studio collection with glossy-only ray visibility, while the render script produces a new scene and comparison image without overwriting the current candidate.

**Tech Stack:** Blender 5.2, Python/bpy, Cycles, unittest, ImageMagick.

## Global Constraints

- Do not alter bottle or finish mesh data.
- Do not alter the cobalt material, camera, floor height, scrim, or lights.
- The new card must be removable and invisible to camera, diffuse, transmission, and shadow rays.
- Save every output under a new `base-halo-control-v1` path.

---

### Task 1: Add and verify the removable base reflection card

**Files:**
- Modify: `scripts/paper-doll-3d/luxury_glass_contract.py`
- Modify: `scripts/paper-doll-3d/build-9ml-cobalt-correction.py`
- Test: `scripts/paper-doll-3d/tests/test_cobalt_correction_blender.py`

**Interfaces:**
- Consumes: `build_final_lock_candidate_in_memory()` and `COBALT_FINAL_LOCK`
- Produces: `BB_FINAL_BASE_HALO_CONTROL_15` with `bb_base_halo_reduction_percent = 15`

- [ ] Write a Blender regression test that requires the named card, 15% metadata, glossy-only ray visibility, unchanged geometry/camera/floor, and unchanged light transforms and energies.
- [ ] Run the Blender test and confirm it fails because the control card does not exist.
- [ ] Add immutable card parameters to `CobaltFinalLockContract`.
- [ ] Add the minimal builder helper that creates the neutral-gray card and links it to the final collection.
- [ ] Run the full contract and Blender suites and confirm all tests pass.

### Task 2: Render and inspect the experiment

**Files:**
- Use: `scripts/paper-doll-3d/render-9ml-cobalt-final-lock.py`
- Create: `pipeline/paper-doll-3d/master/working/five-variant/9ml-cobalt-final-lock/009ml-cobalt-base-halo-control-15-v1.blend`
- Create: `pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-final-lock/base-halo-control-v1/COBALT_BASE_HALO_CONTROL_15_V1.png`

**Interfaces:**
- Consumes: the verified builder state from Task 1
- Produces: full-frame render and 200% before/after base crops

- [ ] Render at 900 × 990, 256 Cycles samples, AgX Medium High Contrast.
- [ ] Create 200% before/after base crops using ImageMagick.
- [ ] Reject the experiment if it adds a stripe, a black outline, or weakens contact grounding.
- [ ] Verify hashes, file integrity, tests, and `git diff --check` before reporting.
