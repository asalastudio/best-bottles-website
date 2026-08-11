# Five-variant cylinder glass and swirl implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce clear, frosted, cobalt, amber, and true molded-swirl Blender
working scenes and proof renders from the approved cobalt baseline while
preserving its finish, camera, studio, key light, and 2:00 shadow.

**Architecture:** A pure-Python contract module owns variant parameters,
dimensional calculations, and deterministic fingerprints. A Blender builder
loads the immutable approved baseline, creates one isolated working scene per
variant, replaces only permitted material/body data, adds one shared
reflection-only card, configures understandable workspaces, saves the `.blend`,
and optionally renders a proof. Blender integration tests compare every output
against the locked baseline and reject any drift in protected data.

**Tech Stack:** Python 3, Blender Python API (`bpy`), Blender Cycles/Metal,
`unittest`, SHA-256 mesh/transform fingerprints, PNG proof renders.

## Global Constraints

- Immutable baseline:
  `pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend`.
- Never overwrite the immutable baseline or approved reference render.
- Clear, frosted, cobalt, and amber retain the baseline smooth-body mesh.
- All five retain the exact locked 17/415 finish mesh: two turns, `2.70 mm`
  visual pitch, `8.05 mm` material envelope, `+0.25 mm` group offset.
- User correction from the drawing: the renderable bottle is one continuous
  glass shell through the shoulder/finish junction. The preserved source
  finish remains in the file, but the two closed meshes cannot render on top
  of each other at the datum.
- The bottom junction band is `2.0 mm` high, centered `1.3 mm` above the
  attachment datum, leaving a `0.3 mm` shoulder-to-band land. That lower gap
  is no larger than the band-to-first-thread gap.
- Camera, backdrop, key, fill, top card, and sweep wash remain numerically
  unchanged.
- Existing key remains responsible for the 2:00 right-cast shadow.
- `BB_CARD_GLASS_REFLECTION_STRIP` is glossy/reflection-only and shared by all
  five variants.
- Swirl height is `74 ±1 mm`, maximum diameter `21 ±0.5 mm`, finish `17-415`,
  and minimum wall thickness `0.8 mm`.
- Swirl relief is real outer-surface geometry; its cavity remains smooth.
- Selected after the first glass proof: `8` flutes, `85°` body-region twist,
  `0.75 mm` maximum inward indentation. The initial `8 / 70° / 0.55 mm`
  candidate read as gentle waviness rather than molded relief. Preserve the
  selected values as explicit metadata.
- Outputs go only to new working/render directories.

---

### Task 1: Pure variant and geometry contract

**Files:**
- Create: `scripts/paper-doll-3d/five_variant_contract.py`
- Create: `scripts/paper-doll-3d/tests/test_five_variant_contract.py`

**Interfaces:**
- Produces: `VARIANTS: dict[str, VariantSpec]`, `SWIRL: SwirlSpec`,
  `swirl_radius(radius, theta, z, outer_radius, z_min, z_max, spec) -> float`,
  `fingerprint_values(values, digits=6) -> str`.
- Consumes: no Blender state; the module must import in ordinary Python.

- [ ] **Step 1: Write the failing contract tests**

```python
def test_shared_variants_do_not_authorize_geometry_changes():
    for name in ("clear", "frosted", "cobalt", "amber"):
        assert not contract.VARIANTS[name].allows_body_geometry_change

def test_swirl_is_inward_and_respects_wall_gate():
    r = contract.swirl_radius(10.5, 0.0, 30.0, 10.5, 4.0, 56.0,
                              contract.SWIRL)
    assert 9.95 <= r <= 10.5
    assert 10.5 - contract.SWIRL.depth_mm - 8.9 >= 0.8

def test_swirl_fades_to_zero_at_body_region_ends():
    for z in (4.0, 56.0):
        assert contract.swirl_radius(10.5, 0.0, z, 10.5, 4.0, 56.0,
                                     contract.SWIRL) == 10.5
```

- [ ] **Step 2: Run the test and verify RED**

Run:
`python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v`

Expected: FAIL because `five_variant_contract.py` does not exist.

- [ ] **Step 3: Implement the immutable dataclasses and radius function**

```python
@dataclass(frozen=True)
class SwirlSpec:
    height_mm: float = 74.0
    diameter_mm: float = 21.0
    flute_count: int = 8
    twist_deg: float = 70.0
    depth_mm: float = 0.55
    minimum_wall_mm: float = 0.8

def swirl_radius(radius, theta, z, outer_radius, z_min, z_max, spec):
    if radius < outer_radius - 0.8 or not z_min <= z <= z_max:
        return radius
    t = (z - z_min) / (z_max - z_min)
    fade = math.sin(math.pi * t) ** 2
    phase = spec.flute_count * theta - math.radians(spec.twist_deg) * t
    groove = ((1.0 + math.cos(phase)) * 0.5) ** 2
    return radius - spec.depth_mm * fade * groove
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:
`python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v`

Expected: all contract tests PASS.

- [ ] **Step 5: Commit the contract cycle**

```bash
git add scripts/paper-doll-3d/five_variant_contract.py \
  scripts/paper-doll-3d/tests/test_five_variant_contract.py
git commit -m "test: lock five-variant bottle contract"
```

### Task 2: Baseline-preserving Blender builder

**Files:**
- Create: `scripts/paper-doll-3d/build-five-variant-system.py`
- Create: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Consumes: a Blender process with the locked baseline already open,
  `VARIANTS`, `fingerprint_values`.
- Produces: `build_variant(name: str) -> bpy.types.Scene`,
  `protected_snapshot() -> dict`, and CLI flags `--variant`, `--output`,
  `--render`, `--samples`, `--res`.

- [ ] **Step 1: Write a failing Blender integration test**

The test loads the builder and asserts that protected snapshots contain the
camera, sweep, key, fill, top card, sweep wash, and finish. It builds `clear`
in memory and compares protected transform and finish-mesh fingerprints before
and after.

- [ ] **Step 2: Run the Blender test and verify RED**

Run:
`blender -b <locked-baseline> -P scripts/paper-doll-3d/tests/test_five_variant_blender.py`

Expected: FAIL because the builder module does not exist.

- [ ] **Step 3: Implement protected snapshots and safe CLI output**

The builder must refuse an output path equal to the locked baseline, snapshot
the protected scene before changes, make changes, assert equality afterward,
save only to `pipeline/paper-doll-3d/master/working/five-variant/`, and stamp
the scene with `bb_source_baseline_sha256` and `bb_variant`.

- [ ] **Step 4: Preserve smooth geometry and finish identity**

For clear, frosted, cobalt, and amber, leave the body vertex coordinates
untouched and change only the material assignment. Leave `BB_FIN_17_415` mesh,
location, rotation, and scale untouched for those four.

- [ ] **Step 5: Run the Blender test and verify GREEN**

Run the same Blender test. Expected: protected snapshots match and PASS.

- [ ] **Step 6: Commit the builder cycle**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py \
  scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: build baseline-preserving bottle variants"
```

### Task 3: Materials and shared reflection card

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Produces: `build_glass_material(name: str) -> bpy.types.Material` and
  `ensure_reflection_strip() -> bpy.types.Object`.

- [ ] **Step 1: Add failing material/card assertions**

Assert polished materials have transmission `1.0`, IOR `1.5`, roughness in
`0.02–0.04`, and no Bump node. Assert frosted has a uniform Noise-to-Bump
micro-normal path. Assert cobalt density `0.85`, amber density `0.95`, and the
reflection card is hidden from camera, diffuse, transmission, and shadow rays
while remaining visible to glossy rays.

- [ ] **Step 2: Run Blender test and verify RED**

Expected: FAIL because the new materials/card do not exist.

- [ ] **Step 3: Implement the five material graphs**

Use one Principled transmission surface at IOR `1.5`. Clear and swirl are
colorless at roughness `0.025`; cobalt uses royal-blue Volume Absorption at
density `0.85`; amber uses dark warm-amber Volume Absorption at density
`0.95`; frosted uses roughness `0.28` plus fine uniform Noise/Bump.

- [ ] **Step 4: Implement the glossy-only card**

Create `BB_CARD_GLASS_REFLECTION_STRIP` in `LIGHTING`, dimensions
`55 × 240 mm`, left-front placement, neutral emission, camera invisibility,
and glossy-only Cycles ray visibility. Do not move the existing key.

- [ ] **Step 5: Run Blender test and verify GREEN**

Expected: all material, visibility, and protected-transform assertions PASS.

- [ ] **Step 6: Commit the material/light cycle**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py \
  scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: add calibrated glass and reflection strip"
```

### Task 4: Dedicated molded swirl geometry

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`

**Interfaces:**
- Produces: `build_swirl_body() -> bpy.types.Object`, using the existing
  master-scene profile/revolve utilities and `swirl_radius`.

- [ ] **Step 1: Add failing swirl geometry assertions**

Assert the swirl body is a new mesh, contains real varying outer radii, has no
Displace modifier, is `74 ±1 mm` overall with the finish, has maximum diameter
`21 ±0.5 mm`, reports minimum wall `>=0.8 mm`, and leaves the finish fingerprint
unchanged. Assert metadata equals `8`, `70`, and `0.55`.

- [ ] **Step 2: Run Blender test and verify RED**

Expected: FAIL because swirl still uses the smooth baseline body.

- [ ] **Step 3: Build the real helical indentation mesh**

Clone the 009 body specification only as a starting profile, set swirl body
height/diameter to `74/21`, end it at the `17-415` finish datum, and modulate
only outer-body radii between heel and shoulder. The inward maximum is
`0.55 mm`; the inner profile remains unmodulated. Instance the untouched finish
mesh at the new datum without scaling it.

- [ ] **Step 4: Run Blender test and verify GREEN**

Expected: dimensional, wall, relief, datum, and finish-fingerprint gates PASS.

- [ ] **Step 5: Commit the swirl cycle**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py \
  scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: add true molded swirl bottle geometry"
```

### Task 5: Working scenes, navigation, renders, and final audit

**Files:**
- Modify: `scripts/paper-doll-3d/prepare-interactive-scene.py`
- Create: `pipeline/paper-doll-3d/master/working/five-variant/*.blend`
- Create: `pipeline/paper-doll-3d/renders/five-variant/*.png`
- Create: `pipeline/paper-doll-3d/renders/five-variant/audit.json`

**Interfaces:**
- Consumes: the builder CLI and existing view renderer.
- Produces: five navigable working scenes, five front renders, thread macros,
  swirl three-quarter/clay proofs, and a machine-readable audit.

- [ ] **Step 1: Add the new reflection card to scene-overview presentation**

Update the interactive-preparation script so the strip is labeled, shown as a
bounded lighting object in `SCENE OVERVIEW`, and does not obstruct
`PRODUCT DETAIL`. Keep the main editor as a 3D Viewport.

- [ ] **Step 2: Generate all five working scenes**

Run the builder once per variant from the locked baseline. Save only into the
new `five-variant` working directory.

- [ ] **Step 3: Render compact proof images**

Render front proofs for all five, thread macros for all five, and swirl
three-quarter plus clay geometry proofs at review resolution before any larger
production render.

- [ ] **Step 4: Run all automated gates**

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
blender -b <locked-baseline> -P scripts/paper-doll-3d/tests/test_17_415_helix.py
blender -b <locked-baseline> -P scripts/paper-doll-3d/tests/test_five_variant_blender.py
```

Expected: every test PASS, immutable baseline SHA-256 remains
`3291d7ecf0c8a289a2e06d9fb334ae758010ad42f53a99ece1863d306d7efd0f`.

- [ ] **Step 5: Visually inspect every proof**

Confirm the bottle is immediately visible; cobalt is luminous royal blue;
amber is luminous dark amber; clear is neutral; frosting is uniform; swirl
reads as molded geometry; the bone background and right-cast shadow remain;
the shared highlight is curved and controlled; threads remain unchanged.

- [ ] **Step 6: Write the audit and commit only source/document changes**

Record hashes, dimensions, selected swirl parameters, test output, and render
paths in `audit.json`. Do not stage unrelated pre-existing work.

```bash
git add docs/superpowers/plans/2026-08-11-five-variant-cylinder-glass-swirl.md \
  scripts/paper-doll-3d/five_variant_contract.py \
  scripts/paper-doll-3d/build-five-variant-system.py \
  scripts/paper-doll-3d/prepare-interactive-scene.py \
  scripts/paper-doll-3d/tests/test_five_variant_contract.py \
  scripts/paper-doll-3d/tests/test_five_variant_blender.py
git commit -m "feat: deliver five-variant bottle lookdev system"
```
