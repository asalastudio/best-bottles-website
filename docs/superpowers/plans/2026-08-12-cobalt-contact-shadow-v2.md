# Cobalt Contact Shadow V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a separate cobalt V2 candidate with a slightly darker, tighter attached contact shadow while preserving the approved grounded V1 bottle and studio.

**Architecture:** Add an opt-in grounded-contact V2 builder that starts from the unchanged final-lock scene and updates only `BB_FINAL_LEFT_SHADOW_KEY`. The default final-lock builder stays on V1, the rejected halo control remains a separate opt-in path, and the renderer selects V2 only with an explicit flag.

**Tech Stack:** Blender 5.2, Python/bpy, Cycles, unittest, ImageMagick.

## Global Constraints

- Preserve geometry, cobalt material density `1.80`, roughness `0.032`, camera, floor Z, scrim, fills, background, and exposure.
- Disable the rejected base-halo card in V2.
- Change only the left physical key to `35 × 76 mm`, location `(-88, -30, 82) mm`, and retain `89,000 W`.
- Save new V2 scene and render paths without overwriting V1.

---

### Task 1: Add the isolated V2 key preset

**Files:**
- Modify: `scripts/paper-doll-3d/luxury_glass_contract.py`
- Modify: `scripts/paper-doll-3d/build-9ml-cobalt-correction.py`
- Test: `scripts/paper-doll-3d/tests/test_cobalt_correction_blender.py`

**Interfaces:**
- Consumes: `build_final_lock_candidate_in_memory()`
- Produces: `build_grounded_contact_v2_candidate_in_memory()`

- [ ] Add a failing regression test requiring the exact V2 key values, hidden halo card, unchanged material inputs, geometry, camera, floor, scrim, and fill lights.
- [ ] Run the Blender suite and verify failure because the V2 contract/function is absent.
- [ ] Add immutable V2 key values and the minimal opt-in builder.
- [ ] Run the complete contract and Blender suites and verify green.

### Task 2: Render and inspect V2

**Files:**
- Modify: `scripts/paper-doll-3d/render-9ml-cobalt-final-lock.py`
- Create: `pipeline/paper-doll-3d/master/working/five-variant/9ml-cobalt-final-lock/009ml-cobalt-grounded-contact-v2.blend`
- Create: `pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-final-lock/grounded-contact-v2/COBALT_GROUNDED_CONTACT_V2.png`

**Interfaces:**
- Consumes: `--grounded-contact-v2`
- Produces: a 256-sample full-frame render and a 200% V1/V2 base comparison

- [ ] Add the explicit renderer flag.
- [ ] Render V2 at 900 × 990 and 256 Cycles samples.
- [ ] Create before/after base diagnostics and inspect the contact onset and rightward falloff.
- [ ] Verify tests, hashes, scene metadata, image integrity, and `git diff --check`.
