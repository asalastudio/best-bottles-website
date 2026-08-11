# Swirl Clay Geometry Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build isolated 10-flute and 12-flute molded swirl-body candidates and render body-only clay comparisons while preserving the approved clear-glass 17-415 neck exactly.

**Architecture:** Extend the pure-Python geometry contract with two explicit photo-solved candidates and replace the long sinusoidal fade with a short smoothstep fade plus a narrow-channel power profile. Pass an explicit candidate into the existing continuous-shell builder, stamp the unchanged approved helix fingerprint into both scenes, and add a diagnostic renderer mode that assigns clay only to body polygons below the finish datum.

**Tech Stack:** Python 3 `unittest`, Blender 5.2 Python API, Cycles/Metal, ImageMagick, Git.

## Global Constraints

- Candidate A uses `10` flutes; Candidate B uses `12` flutes.
- Both candidates use `90°` body-region rotation and `0.75 mm` maximum inward depth.
- Both remain within `74 ±1 mm` height, `21 ±0.5 mm` maximum diameter, and `0.8 mm` minimum wall thickness.
- Relief uses narrow concave channels, broad rounded lands, and `2.75 mm` end fades.
- The inner cavity remains smooth and unmodulated.
- The approved neck/thread source fingerprint remains `016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f`.
- Neck geometry, neck material, band, threads, camera, backdrop, and studio are read-only for this comparison.
- Clay applies only to the swirl body below the finish datum; the locked neck remains clear glass.
- Candidate scenes and renders stay under working/diagnostic paths. Do not overwrite or promote any file under `pipeline/paper-doll-3d/master/locked`.

---

## File Structure

- `scripts/paper-doll-3d/five_variant_contract.py` — owns candidate dimensions and source-independent relief math.
- `scripts/paper-doll-3d/build-five-variant-system.py` — builds an explicit 10- or 12-flute continuous shell while reusing the approved helix source.
- `scripts/paper-doll-3d/render-views.py` — adds body-only clay assignment for diagnostic renders.
- `scripts/paper-doll-3d/tests/test_five_variant_contract.py` — proves candidate math, fade behavior, envelope, and wall gates without Blender.
- `scripts/paper-doll-3d/tests/test_five_variant_blender.py` — updates the existing family test to use an explicit candidate.
- `scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py` — proves both built candidates retain the locked neck/thread and body-only clay boundary.
- `pipeline/paper-doll-3d/master/working/swirl-clay-comparison/` — candidate `.blend` outputs.
- `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/` — four review renders and the 2×2 proof sheet.

---

### Task 1: Candidate contract and molded relief profile

**Files:**
- Modify: `scripts/paper-doll-3d/five_variant_contract.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_contract.py`

**Interfaces:**
- Produces: `SWIRL_CANDIDATES: dict[int, SwirlSpec]`
- Produces: `smoothstep01(value: float) -> float`
- Produces: `swirl_radius(radius, theta, z, outer_radius, z_min, z_max, spec) -> float`
- Consumes: supplied `74 mm × 21 mm`, `17-415`, `0.8 mm` minimum-wall contract.

- [ ] **Step 1: Replace the legacy eight-flute expectations with failing candidate tests**

Add these tests to `FiveVariantContractTests` and update existing swirl tests to pass an explicit candidate:

```python
def test_swirl_comparison_has_only_ten_and_twelve_flute_candidates(self):
    candidates = self.contract.SWIRL_CANDIDATES
    self.assertEqual(set(candidates), {10, 12})
    for flute_count, candidate in candidates.items():
        self.assertEqual(candidate.flute_count, flute_count)
        self.assertEqual(candidate.twist_deg, 90.0)
        self.assertEqual(candidate.depth_mm, 0.75)
        self.assertEqual(candidate.fade_mm, 2.75)
        self.assertEqual(candidate.channel_power, 2.5)

def test_swirl_has_short_end_fades_and_full_depth_plateau(self):
    spec = self.contract.SWIRL_CANDIDATES[10]
    z_min, z_max, outer = 2.0, 58.0, 10.5
    self.assertEqual(
        self.contract.swirl_radius(outer, 0.0, z_min, outer, z_min, z_max, spec),
        outer,
    )
    at_plateau = self.contract.swirl_radius(
        outer, math.radians(spec.twist_deg * spec.fade_mm / (z_max - z_min)),
        z_min + spec.fade_mm, outer, z_min, z_max, spec,
    )
    self.assertAlmostEqual(at_plateau, outer - spec.depth_mm, places=6)

def test_swirl_channel_is_narrower_than_legacy_sine_profile(self):
    spec = self.contract.SWIRL_CANDIDATES[12]
    z_min, z_max = 2.0, 58.0
    z = (z_min + z_max) / 2.0
    center = math.radians(spec.twist_deg * 0.5)
    shoulder = center + math.pi / (2 * spec.flute_count)
    center_radius = self.contract.swirl_radius(
        10.5, center, z, 10.5, z_min, z_max, spec
    )
    shoulder_radius = self.contract.swirl_radius(
        10.5, shoulder, z, 10.5, z_min, z_max, spec
    )
    self.assertAlmostEqual(center_radius, 9.75, places=6)
    self.assertGreater(shoulder_radius, 10.35)

def test_both_candidates_preserve_the_wall_gate(self):
    for spec in self.contract.SWIRL_CANDIDATES.values():
        self.assertGreaterEqual(1.6 - spec.depth_mm, spec.minimum_wall_mm)
```

- [ ] **Step 2: Run the pure tests and verify the new contract is absent**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
```

Expected: FAIL because `SWIRL_CANDIDATES`, `fade_mm`, and `channel_power` do not exist and the legacy contract still selects eight flutes.

- [ ] **Step 3: Implement the explicit candidates and short-fade groove law**

Change `SwirlSpec` and replace the singleton `SWIRL` with:

```python
@dataclass(frozen=True)
class SwirlSpec:
    height_mm: float = 74.0
    diameter_mm: float = 21.0
    finish: str = "17-415"
    flute_count: int = 10
    twist_deg: float = 90.0
    depth_mm: float = 0.75
    minimum_wall_mm: float = 0.8
    fade_mm: float = 2.75
    channel_power: float = 2.5


SWIRL_CANDIDATES = {
    10: SwirlSpec(flute_count=10),
    12: SwirlSpec(flute_count=12),
}


def smoothstep01(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)
```

Replace `swirl_radius` with a required explicit `spec` and this relief core:

```python
span = z_max - z_min
if span <= 0:
    raise ValueError("swirl region must have positive height")
t = (z - z_min) / span
edge_distance = min(z - z_min, z_max - z)
fade = smoothstep01(edge_distance / spec.fade_mm)
phase = spec.flute_count * (
    theta - math.radians(spec.twist_deg) * t
)
channel = ((1.0 + math.cos(phase)) * 0.5) ** spec.channel_power
return radius - spec.depth_mm * fade * channel
```

Keep the existing outer-surface eligibility and out-of-region early returns so the inner cavity is not modulated.

- [ ] **Step 4: Run the pure tests**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v
```

Expected: all contract tests PASS for both candidates; no test refers to an eight-flute canonical swirl.

- [ ] **Step 5: Commit the contract**

```bash
git add scripts/paper-doll-3d/five_variant_contract.py scripts/paper-doll-3d/tests/test_five_variant_contract.py
git commit -m "feat: define swirl clay comparison candidates"
```

---

### Task 2: Explicit candidate builder with protected finish

**Files:**
- Modify: `scripts/paper-doll-3d/build-five-variant-system.py`
- Modify: `scripts/paper-doll-3d/tests/test_five_variant_blender.py`
- Create: `scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py`

**Interfaces:**
- Consumes: `contract.SWIRL_CANDIDATES[int] -> SwirlSpec`
- Produces: `build_continuous_body(name: str, swirl_spec: Optional[SwirlSpec] = None)`
- Produces: `build_swirl_candidate(flute_count: int)`
- Produces CLI: `--variant swirl --swirl-flutes {10,12}`

- [ ] **Step 1: Write the failing Blender candidate test**

Create `test_swirl_clay_candidates_blender.py`. It must load the builder, record the immutable finish and helix signature, and exercise both candidates by reopening `builder.LOCKED_BASELINE` between builds:

```python
import importlib.util
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[3]
BUILDER_PATH = ROOT / "scripts/paper-doll-3d/build-five-variant-system.py"

spec = importlib.util.spec_from_file_location("bb_candidate_builder", BUILDER_PATH)
builder = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = builder
spec.loader.exec_module(builder)

expected_thread = "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"

for flute_count in (10, 12):
    bpy.ops.wm.open_mainfile(filepath=str(builder.LOCKED_BASELINE))
    finish_before = builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME])
    body = builder.build_swirl_candidate(flute_count)
    assert body["bb_swirl_flute_count"] == flute_count
    assert math.isclose(body["bb_swirl_twist_deg"], 90.0, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_depth_mm"], 0.75, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_fade_mm"], 2.75, abs_tol=1e-6)
    assert math.isclose(body["bb_swirl_channel_power"], 2.5, abs_tol=1e-6)
    assert body["bb_thread_source_fingerprint"] == expected_thread
    assert builder.mesh_fingerprint(bpy.data.objects[builder.FINISH_NAME]) == finish_before
    assert body["bb_min_wall_mm"] >= 0.8
    assert body.dimensions.x <= 21.5
    assert body.dimensions.y <= 21.5
    assert body.dimensions.z <= 75.0
    outer_radii = [math.hypot(vertex.co.x, vertex.co.y) for vertex in body.data.vertices]
    assert max(outer_radii) <= 10.5 + 1e-3

print("PASS 10/12 swirl candidates preserve locked finish and measured envelope")
```

Update `test_five_variant_blender.py` to replace `build_variant("swirl")` with `build_swirl_candidate(10)` and expect `10`, `90.0`, `0.75`, and the new profile metadata.

- [ ] **Step 2: Run the Blender test and verify the candidate API is missing**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py
```

Expected: FAIL because `build_swirl_candidate` does not exist.

- [ ] **Step 3: Implement explicit candidate selection**

Change the builder interfaces to:

```python
def build_continuous_body(name, swirl_spec=None):
    if name == "swirl" and swirl_spec is None:
        raise ValueError("swirl requires an explicit 10- or 12-flute candidate")
```

For the swirl branch, consume `swirl_spec.height_mm`, `diameter_mm`, and pass that same object into `contract.swirl_radius`. Set:

```python
relief_z_min = 2.0
relief_z_max = datum_z - 2.0
profile = _densify_profile(profile, max_z_step=0.35, z_max=datum_z)
```

Stamp candidate metadata from the explicit spec:

```python
replacement["bb_swirl_flute_count"] = swirl_spec.flute_count
replacement["bb_swirl_twist_deg"] = swirl_spec.twist_deg
replacement["bb_swirl_depth_mm"] = swirl_spec.depth_mm
replacement["bb_swirl_fade_mm"] = swirl_spec.fade_mm
replacement["bb_swirl_channel_power"] = swirl_spec.channel_power
replacement["bb_swirl_candidate"] = f"{swirl_spec.flute_count}-flute-clay-review"
replacement["bb_min_wall_mm"] = bottle_spec["wall"] - swirl_spec.depth_mm
```

Add:

```python
def build_swirl_candidate(flute_count):
    try:
        swirl_spec = contract.SWIRL_CANDIDATES[flute_count]
    except KeyError as exc:
        raise ValueError("swirl candidate must use 10 or 12 flutes") from exc
    return build_continuous_body("swirl", swirl_spec=swirl_spec)
```

Extend the CLI parser with `--swirl-flutes`, choices `(10, 12)`, and reject `--variant swirl` without it. Pass the selection through `build_variant(name, save, output, swirl_flutes=None)`.

```python
parser.add_argument("--swirl-flutes", type=int, choices=(10, 12))

if args.variant == "swirl" and args.swirl_flutes is None:
    parser.error("--variant swirl requires --swirl-flutes 10 or 12")
if args.variant != "swirl" and args.swirl_flutes is not None:
    parser.error("--swirl-flutes is valid only with --variant swirl")
```

- [ ] **Step 4: Run both Blender geometry suites**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py

/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_five_variant_blender.py
```

Expected: both PASS; the thread source fingerprint remains identical for the 10- and 12-flute candidates.

- [ ] **Step 5: Commit the candidate builder**

```bash
git add scripts/paper-doll-3d/build-five-variant-system.py \
  scripts/paper-doll-3d/tests/test_five_variant_blender.py \
  scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py
git commit -m "feat: build isolated swirl clay candidates"
```

---

### Task 3: Body-only clay diagnostic renderer

**Files:**
- Modify: `scripts/paper-doll-3d/render-views.py`
- Modify: `scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py`

**Interfaces:**
- Produces: `clay_material() -> bpy.types.Material`
- Produces: `apply_body_only_clay(bottle: bpy.types.Object) -> int`
- Produces CLI flag: `--clay-body-only`

- [ ] **Step 1: Extend the Blender test with a failing material-boundary gate**

Import `render-views.py` behind an `if __name__ == "__main__": main()` guard, then add:

```python
RENDERER_PATH = ROOT / "scripts/paper-doll-3d/render-views.py"
renderer_spec = importlib.util.spec_from_file_location(
    "bb_swirl_diagnostic_renderer", RENDERER_PATH
)
renderer = importlib.util.module_from_spec(renderer_spec)
sys.modules[renderer_spec.name] = renderer
renderer_spec.loader.exec_module(renderer)

renderer.apply_body_only_clay(body)
datum = body["bb_finish_datum_z_mm"]
clay_index = next(
    index for index, material in enumerate(body.data.materials)
    if material.name == "BB_MAT_CLAY_BODY_DIAGNOSTIC"
)
clay_faces = 0
for polygon in body.data.polygons:
    center_z = sum(body.data.vertices[i].co.z for i in polygon.vertices) / len(polygon.vertices)
    if center_z < datum - 1e-4:
        assert polygon.material_index == clay_index
        clay_faces += 1
    else:
        assert polygon.material_index != clay_index
assert clay_faces > 0
```

- [ ] **Step 2: Run the Blender candidate test and verify body-only clay is absent**

Run the Task 2 candidate-test command.

Expected: FAIL because `apply_body_only_clay` and `BB_MAT_CLAY_BODY_DIAGNOSTIC` do not exist.

- [ ] **Step 3: Implement the body-only material assignment**

Refactor clay creation into:

```python
def clay_material(name="BB_MAT_CLAY"):
    clay = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    clay.use_nodes = True
    pr = clay.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (0.62, 0.60, 0.57, 1.0)
    pr.inputs["Roughness"].default_value = 0.58
    return clay
```

Add:

```python
def apply_body_only_clay(bottle):
    datum = float(bottle["bb_finish_datum_z_mm"])
    clay = clay_material("BB_MAT_CLAY_BODY_DIAGNOSTIC")
    bottle.data.materials.append(clay)
    clay_index = len(bottle.data.materials) - 1
    count = 0
    for polygon in bottle.data.polygons:
        center_z = sum(
            bottle.data.vertices[index].co.z for index in polygon.vertices
        ) / len(polygon.vertices)
        if center_z < datum - 1e-4:
            polygon.material_index = clay_index
            count += 1
    return count
```

Add parser flag `--clay-body-only`. Make it mutually exclusive with `--clay`; when enabled, call only `apply_body_only_clay(bottle)`. Move the final `main()` call under the standard `if __name__ == "__main__":` guard.

```python
clay_group = p.add_mutually_exclusive_group()
clay_group.add_argument("--clay", action="store_true")
clay_group.add_argument("--clay-body-only", action="store_true")

if a.clay_body_only:
    apply_body_only_clay(bottle)
elif a.clay or a.view == "section":
    apply_clay(product_meshes())

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the Blender candidate test**

Run the Task 2 candidate-test command.

Expected: PASS with all body polygons clay and all neck/thread polygons retaining the original clear-glass material.

- [ ] **Step 5: Commit the diagnostic renderer**

```bash
git add scripts/paper-doll-3d/render-views.py \
  scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py
git commit -m "feat: render swirl body-only clay diagnostics"
```

---

### Task 4: Build and render the 10-versus-12 comparison

**Files:**
- Create: `pipeline/paper-doll-3d/master/working/swirl-clay-comparison/010ml-swirl-10-flute-CLAY-REVIEW.blend`
- Create: `pipeline/paper-doll-3d/master/working/swirl-clay-comparison/010ml-swirl-12-flute-CLAY-REVIEW.blend`
- Create: `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/10-flute-front-clay-body.png`
- Create: `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/10-flute-threequarter-clay-body.png`
- Create: `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/12-flute-front-clay-body.png`
- Create: `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/12-flute-threequarter-clay-body.png`
- Create: `pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/swirl-10-vs-12-clay-proof.png`

**Interfaces:**
- Consumes: `--variant swirl --swirl-flutes {10,12}`
- Consumes: `render-views.py --clay-body-only`
- Produces: two working scenes and four non-promoted review renders.

- [ ] **Step 1: Build both isolated working scenes**

Run:

```bash
mkdir -p pipeline/paper-doll-3d/master/working/swirl-clay-comparison \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign

for count in 10 12; do
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
    pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
    -P scripts/paper-doll-3d/build-five-variant-system.py -- \
    --variant swirl --swirl-flutes "$count" \
    --output "pipeline/paper-doll-3d/master/working/swirl-clay-comparison/010ml-swirl-${count}-flute-CLAY-REVIEW.blend"
done
```

Expected: both working files save successfully; no locked file modification time changes.

- [ ] **Step 2: Render front and three-quarter body-only clay views**

Run:

```bash
for count in 10 12; do
  scene="pipeline/paper-doll-3d/master/working/swirl-clay-comparison/010ml-swirl-${count}-flute-CLAY-REVIEW.blend"
  out="pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign"
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b "$scene" \
    -P scripts/paper-doll-3d/render-views.py -- --view front \
    --clay-body-only --samples 160 --res 800 880 \
    --out "$out/${count}-flute-front-clay-body.png"
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b "$scene" \
    -P scripts/paper-doll-3d/render-views.py -- --view threequarter \
    --clay-body-only --samples 160 --res 800 880 \
    --out "$out/${count}-flute-threequarter-clay-body.png"
done
```

Expected: the body is matte clay and the complete neck/thread finish remains clear glass in all four renders.

- [ ] **Step 3: Create the ordered 2×2 proof sheet**

Run:

```bash
magick montage \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/10-flute-front-clay-body.png \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/10-flute-threequarter-clay-body.png \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/12-flute-front-clay-body.png \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/12-flute-threequarter-clay-body.png \
  -tile 2x2 -geometry 800x880+12+12 -background '#b8b1a7' \
  pipeline/paper-doll-3d/renders/five-variant/diagnostics/swirl-redesign/swirl-10-vs-12-clay-proof.png
```

Proof-sheet order: top row 10-flute front and three-quarter; bottom row 12-flute front and three-quarter.

- [ ] **Step 4: Run final verification without promoting either candidate**

Run:

```bash
python3 -m unittest scripts/paper-doll-3d/tests/test_five_variant_contract.py -v

/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  pipeline/paper-doll-3d/master/locked/009--17-415-cobalt-APPROVED-BASELINE-2026-08-11.blend \
  -P scripts/paper-doll-3d/tests/test_swirl_clay_candidates_blender.py

shasum -a 256 \
  pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11/010ml-swirl-17-415-THREAD-LOCKED-2026-08-11.blend
```

Expected: tests PASS and the existing locked swirl remains
`b621b9adf8e890f29f359bd46ea92c3b6f888d65e161e10fa77170e08decad19`.

- [ ] **Step 5: Present the clay comparison for Jordan's selection**

Show the proof sheet and link the four source renders. State explicitly that neither candidate has been promoted and ask Jordan to select `10` or `12`, or request a defined adjustment to twist, channel width, or depth.
