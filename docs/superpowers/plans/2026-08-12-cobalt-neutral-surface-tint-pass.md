# Cobalt Neutral Surface Tint Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render one controlled Blender derivative that removes the blue dielectric surface tint while retaining the approved luminous-polished cobalt volume.

**Architecture:** Copy the protected luminous-polished material and its node group, set only the internal Principled dielectric Base Color to neutral white, and assign the derivative to the body. Reuse the exact protected geometry, camera, lights, scrim, floor, backdrop, exposure, volume absorption, and roughness.

**Tech Stack:** Blender 5.2/Python, Cycles, Python `unittest`, Pillow comparison output.

## Global Constraints

- Source scene: `009ml-cobalt-gloss-luminous-polished.blend`.
- Surface tint changes from `(0.0002, 0.0015, 0.98)` to `(1.0, 1.0, 1.0)`.
- Volume absorption remains color `(0.002, 0.006, 0.72)` and density `1.55`.
- Surface roughness remains `0.020`; IOR remains `1.50`; transmission remains `1.0`.
- Do not alter geometry, threads, camera, lights, scrim, floor, backdrop, world, exposure, or shadow.
- Never overwrite the protected source or earlier derivatives.

---

### Task 1: Neutral-Surface Derivative

**Files:**
- Modify: `scripts/paper-doll-3d/luxury_glass_contract.py`
- Modify: `scripts/paper-doll-3d/build-9ml-cobalt-correction.py`
- Modify: `scripts/paper-doll-3d/render-9ml-cobalt-final-lock.py`
- Test: `scripts/paper-doll-3d/tests/test_luxury_glass_contract.py`
- Test: `scripts/paper-doll-3d/tests/test_cobalt_correction_blender.py`

**Interfaces:**
- Consumes: protected `luminous-polished` material and V1 studio.
- Produces: `build_neutral_surface_tint_candidate_in_memory()` and a non-overwriting render mode.

- [ ] Write literal contract and Blender tests that reject any change beyond dielectric Base Color.
- [ ] Run the focused tests and confirm failure because the derivative does not exist.
- [ ] Implement an isolated material/node-group copy with neutral-white dielectric Base Color.
- [ ] Render and save the new candidate below a dedicated `neutral-surface-tint-v1` root.
- [ ] Build a labeled before/after sheet and diagnostic body crop.
- [ ] Verify geometry, camera, studio, absorption, roughness, and output confinement.
