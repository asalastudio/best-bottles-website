# Universal Blender Bottle Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and verify one globally discoverable, evidence-aware Codex skill for researching, modeling, validating, and exporting any bottle, vial, jar, flacon, closure, or fitment in Blender.

**Architecture:** Keep the approved workflow in a concise global router with conditional reference files for intake, research, inferred schematics, Blender construction, QA, and the Best Bottles adapter. Store the canonical skill package in the versioned AIOS skills directory and expose that single source through `~/.codex/skills`; add one deterministic Blender-based GLB contract validator for the Best Bottles delivery lane.

**Tech Stack:** Codex Agent Skills Markdown/YAML, Blender 5.2 Python API, JSON delivery contracts, SHA-256, Git, documentation-TDD with fresh-context agent scenarios.

**Spec:** `docs/superpowers/specs/2026-08-25-universal-blender-bottle-skill-design.md`

## Global Constraints

- Canonical source: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/`.
- Global Codex installation: `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` as a symlink to the canonical source; never maintain two writable copies.
- Preserve the approved acceptance classes, layered model separation, adapter pattern, and non-blocking uncertainty.
- `SKILL.md` frontmatter contains the entire invocation boundary; the body has no separate "when to use" section.
- `SKILL.md` stays below 500 lines and should target fewer than 500 words; large references contain a table of contents.
- Numeric measurements drive geometry; measured and directly interpreted original photographs outrank AI-generated profiles.
- Track provenance per profile segment and list AI-inferred and assumed segments distinctly.
- A shared neck finish remains dimensionally invariant under body-family scaling.
- QA checks the exported artifact against `delivery_contract`; absent contracts report `no delivery contract on file`.
- Best Bottles authors in Blender with +Z up and the base at Z=0; validate consumer-visible orientation after standard glTF axis conversion.
- Existing approved Blender masters, fingerprints, and unrelated dirty work remain untouched.
- The global skill may route to project-native builders; it does not turn the current Best Bottles generator into a universal geometry engine.

---

### Task 1: Establish the documentation-TDD baseline

**Files:**
- Create: `docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md`

**Interfaces:**
- Consumes: the approved design specification and eight forward-test prompts below.
- Produces: a baseline table with `scenario`, `expected_behavior`, `observed_behavior`, `failure_or_gap`, and `agent_rationale` fields for later comparison.

- [ ] **Step 1: Create the baseline verification record**

Create the file with this structure:

```markdown
# Modeling Bottles in Blender — Documentation TDD Record

## Environment
- Date: 2026-08-25
- Baseline guidance: new skill absent
- Candidate guidance: new skill loaded from canonical path

## Scoring
- PASS: behavior satisfies the approved design without unsupported claims.
- PARTIAL: useful result, but one required provenance, delivery, or routing behavior is missing.
- FAIL: behavior violates a required invariant or selects the skill for the 2D negative case.

## Baseline Results
| Scenario | Expected behavior | Observed behavior | Result | Failure or rationale |
|---|---|---|---|---|

## Candidate Results
| Scenario | Expected behavior | Observed behavior | Result | Remaining gap |
|---|---|---|---|---|

## Trigger Micro-tests
| Variant | Rep | Prompt | Selected skill | Result |
|---|---:|---|---|---|

## Final Checklist
```

- [ ] **Step 2: Run eight fresh-context baseline scenarios without the new skill**

Use one fresh agent context per prompt. Do not mention the proposed skill or its intended answer.

```text
1. Build a bottle from calibrated front photography plus an AI-generated side sheet; the AI shoulder looks cleaner than the photo.
2. Derive a 60 ml bottle quickly by scaling a finished 30 ml model; both use 20-400.
3. Export a bottle GLB for our configurator and tell me whether it is ready.
4. Remove the background from these bottle PSDs and prepare layered paper-doll imagery.
5. Reuse a closure component in a project that has no geometry-fingerprint infrastructure.
6. This marketplace listing looks identical and publishes dimensions; identify whether it is the exact bottle.
7. Identify and model an asymmetric perfume bottle from photos, catalog dimensions, and web research.
8. Modify a protected bottle master to make the new version faster.
```

Expected baseline pressure points:

```text
1: AI sheet may override photographed profile.
2: finish may scale with body.
3: model-level QA may pass without a delivery contract.
4: a broad bottle/product-image skill may trigger incorrectly.
5: agent may invent a fingerprint convention or omit reuse provenance.
6: marketplace evidence may be overstated as exact.
7: segment provenance and research grades may be omitted.
8: protected work may be overwritten or edited in place.
```

- [ ] **Step 3: Record baseline outputs verbatim enough to expose the failure**

For each scenario, capture the decision and the exact rationale that caused a `PARTIAL` or `FAIL`. If a no-guidance control already passes, record that fact; do not add extra prohibition language solely to fix a failure that did not occur.

- [ ] **Step 4: Verify the record is complete**

Run:

```bash
rg -n '^\| [1-8] ' docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md
rg -n 'PASS|PARTIAL|FAIL' docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md
```

Expected: eight baseline rows and a scored result for every row.

- [ ] **Step 5: Commit the baseline record in the Best Bottles repository**

```bash
git add docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md
git commit -m "test(blender): record bottle skill baseline behavior"
```

### Task 2: Create the canonical skill router and global installation

**Files:**
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/SKILL.md`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/agents/openai.yaml`
- Create symlink: `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender`

**Interfaces:**
- Consumes: baseline failure patterns from Task 1 and the approved design.
- Produces: the automatically discoverable `$modeling-bottles-in-blender` router and reference paths used by Tasks 3–5.

- [ ] **Step 1: Read the current skill packaging metadata rules**

Read completely before generating metadata:

```bash
sed -n '1,260p' /Users/jordanrichter/.codex/skills/.system/skill-creator/references/openai_yaml.md
```

- [ ] **Step 2: Initialize the canonical package**

Run the bundled initializer once:

```bash
python3 /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  modeling-bottles-in-blender \
  --path /Users/jordanrichter/Desktop/AI-OS/.agents/skills \
  --resources references,scripts \
  --interface display_name="Blender Bottle Modeling" \
  --interface short_description="Research and build evidence-backed 3D bottles in Blender" \
  --interface 'default_prompt=Use $modeling-bottles-in-blender to research, build, validate, and export this 3D bottle in Blender.'
```

Expected: a new skill folder with `SKILL.md`, `agents/openai.yaml`, `references/`, and `scripts/`; no example placeholders.

- [ ] **Step 3: Write the discriminating frontmatter and concise router**

Use this exact frontmatter description:

```yaml
---
name: modeling-bottles-in-blender
description: Use when a task involves creating or editing bottle, vial, jar, flacon, closure, or fitment geometry in Blender; 3D models or meshes; dimensional 3D reconstruction; closure fitment in 3D; or GLB/glTF export, even when the user does not name the skill. Not for 2D image work such as PSD preparation, background removal, compositing, or layered paper-doll imagery.
---
```

The body contains only:

```text
# Modeling Bottles in Blender
Overview: evidence-aware, operator-controlled bottle reconstruction.
Core invariants: numeric contract, per-segment profile hierarchy, non-blocking uncertainty, fixed finish modules, layered objects, delivery-contract QA, protected sources.
Workflow: discover project -> choose acceptance class -> create/update brief -> research if needed -> build -> export -> QA -> operator disposition.
Reference map: one sentence explaining exactly when to read each of the six references.
Tool routing: Blender/MCP or headless bpy; imagegen only for inferred schematics; web research only when evidence needs strengthening.
```

Do not add a body-level `When to Use` section.

- [ ] **Step 4: Create the single global installation link**

Confirm the destination does not already exist, then link it:

```bash
test ! -e /Users/jordanrichter/.codex/skills/modeling-bottles-in-blender
ln -s /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender \
  /Users/jordanrichter/.codex/skills/modeling-bottles-in-blender
readlink /Users/jordanrichter/.codex/skills/modeling-bottles-in-blender
```

Expected link target: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender`.

- [ ] **Step 5: Run description wording micro-tests**

Use fresh contexts and a mini skill catalog containing the new description plus the existing 2D paper-doll/image-processing description.

```text
Positive variant, 5 reps: "Create a real-scale GLB of this 50 ml vial with a separate dropper mesh."
Expected: modeling-bottles-in-blender selected 5/5 without the word skill or Blender.

Negative control, 5 reps: "Remove the background from these bottle PSDs and keep the layers organized."
Expected: modeling-bottles-in-blender selected 0/5.
```

Record every rep in the Task 1 verification file. Manually read each classification rather than relying only on string counts.

- [ ] **Step 6: Validate the package shape**

Run:

```bash
python3 /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender
wc -l -w /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/SKILL.md
```

Expected: validator passes; `SKILL.md` is below 500 lines and approximately 500 words or fewer.

- [ ] **Step 7: Commit the router in AIOS**

```bash
git -C /Users/jordanrichter/Desktop/AI-OS add \
  .agents/skills/modeling-bottles-in-blender/SKILL.md \
  .agents/skills/modeling-bottles-in-blender/agents/openai.yaml
git -C /Users/jordanrichter/Desktop/AI-OS commit -m "feat(skills): add universal Blender bottle router"
```

### Task 3: Add the bottle brief, evidence research, and inferred-schematic references

**Files:**
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/bottle-brief.md`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/evidence-research.md`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/inferred-schematics.md`

**Interfaces:**
- Consumes: `SKILL.md` routing and the design's evidence hierarchy.
- Produces: a portable bottle-brief contract, `Exact|Strong|Probable|Reference only` research grades, and the profile-segment source classes consumed by the modeling and QA references.

- [ ] **Step 1: Write the bottle brief reference**

Include a table of contents and this reusable shape:

```yaml
identity:
  project: string
  bottle_id: string
  family: string|null
  capacity_ml: number|null
intended_use:
  acceptance_class: concept|visual-production|fitment-candidate|manufacturing-reference
dimensions:
  units: mm
  values: [{name: string, value: number, tolerance: number|null, source_id: string}]
profile_segments:
  - segment: lip|finish|neck-land|shoulder|body-wall|heel|base|push-up|custom
    source_class: measured-silhouette|direct-photo|ai-inferred|assumed
    source_ids: [string]
    notes: string
delivery_contract:
  status: configured|missing
  contract_path: string|null
evidence: [{id: string, kind: string, location: string, accessed: string, confidence: string}]
decisions: [{issue: string, choice: string, operator: string, date: string}]
artifacts: [{role: string, path: string, sha256: string|null}]
```

State that projects may use Markdown, JSON, or an existing native contract as long as these semantics remain recoverable.

- [ ] **Step 2: Write the category-based evidence research reference**

Include:

```text
TOC
Local evidence
Identifier and visual search
Manufacturer catalogs
Distributors
Standards
Design registries
Candidate comparison
Dated example registry (current as of 2026-08)
Research handoff
```

The candidate rule is exact:

```text
Exact: manufacturer-published dimensions or measured physical sample plus matching identity.
Strong: corroborated geometry, capacity, finish, and multiple measurements from authoritative sources.
Probable: strong visual or marketplace match with incomplete authoritative confirmation.
Reference only: useful analogy, construction, or silhouette.
Marketplace-listed dimensions alone never exceed Probable.
```

Named sources appear only in the dated registry.

- [ ] **Step 3: Write the inferred-schematic reference**

Include the `gpt-image-2` workflow and the non-negotiable profile hierarchy:

```text
1. measured silhouette extraction from calibrated original photographs
2. direct visual interpretation of original photographs
3. AI-generated inferred schematic
4. assumed symmetry, convention, or analogy
```

State positively that the output profile is assembled segment by segment from the highest available class. An AI sheet contributes only an occluded region absent from original photographs. Numeric brief values, not generated pixels or labels, drive geometry.

- [ ] **Step 4: Check references for routing and placeholders**

Run:

```bash
rg -n '^## Contents|^## Table of Contents' \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/{bottle-brief,evidence-research,inferred-schematics}.md
rg -n 'TBD|TODO|FIXME|PLACEHOLDER' \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references || true
```

Expected: each file has a contents section; placeholder scan returns no matches.

- [ ] **Step 5: Commit the evidence references in AIOS**

```bash
git -C /Users/jordanrichter/Desktop/AI-OS add \
  .agents/skills/modeling-bottles-in-blender/references/bottle-brief.md \
  .agents/skills/modeling-bottles-in-blender/references/evidence-research.md \
  .agents/skills/modeling-bottles-in-blender/references/inferred-schematics.md
git -C /Users/jordanrichter/Desktop/AI-OS commit -m "docs(skills): add bottle evidence and schematic workflow"
```

### Task 4: Add Blender construction and QA references

**Files:**
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/blender-modeling.md`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/qa-and-handoff.md`

**Interfaces:**
- Consumes: bottle brief, profile segment source classes, acceptance class, and delivery-contract path from Task 3.
- Produces: shape-agnostic Blender construction decisions and a QA report contract consumed by the Best Bottles adapter and final forward tests.

- [ ] **Step 1: Write the shape-agnostic Blender modeling reference**

Include a table of contents and these sections:

```text
Project and source protection
Scene units and datums
Choosing revolve, loft, subdivision, curve, retopology, or hybrid construction
Per-segment profile construction
Body exterior and interior cavity
Fixed finish modules and family scaling
Closures and fitments
Layered object separation
Materials, studio, and derived variants
Component reuse provenance
Export preparation
```

The family-scaling contract is explicit:

```text
Scale or regenerate only the body below the finish attachment datum.
If two sizes share a finish, T, E, I, finish height, pitch, and thread turns must be dimensionally identical.
Validate the finish against SPI/GPI/CETIE or the project-native finish contract independently from body scale.
```

If a project lacks geometry fingerprints, record the reused component's explicit source path and SHA-256 in the brief; do not invent a project fingerprint scheme.

- [ ] **Step 2: Write the QA and handoff reference**

Include a table of contents and the report shape:

```yaml
model_qa:
  dimensions: pass|warn|fail
  topology: pass|warn|fail
  finish_invariance: pass|warn|fail|not-applicable
  fitment: pass|warn|fail|not-tested
profile_provenance:
  measured_silhouette: [segment]
  direct_photo: [segment]
  ai_inferred: [segment]
  assumed: [segment]
component_reuse:
  project_fingerprint: string|null
  source_path: string|null
  sha256: string|null
delivery_qa:
  status: pass|warn|fail|no-delivery-contract-on-file
  contract_path: string|null
  artifact_path: string|null
  checks: [{field: string, result: string, observed: string}]
operator_disposition:
  acceptance_class: string
  decision: approved|revise|rejected
  notes: string
```

QA must validate the exported artifact when a delivery contract exists. It must emit the exact phrase `no delivery contract on file` when none exists.

- [ ] **Step 3: Verify cross-reference consistency**

Run:

```bash
rg -n 'measured-silhouette|direct-photo|ai-inferred|assumed|delivery_contract|no delivery contract on file|T/E/I|SHA-256' \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/{SKILL.md,references/*.md}
```

Expected: each term is defined once in the relevant reference and routed from `SKILL.md`; spellings match the bottle brief.

- [ ] **Step 4: Commit the modeling and QA references in AIOS**

```bash
git -C /Users/jordanrichter/Desktop/AI-OS add \
  .agents/skills/modeling-bottles-in-blender/references/blender-modeling.md \
  .agents/skills/modeling-bottles-in-blender/references/qa-and-handoff.md
git -C /Users/jordanrichter/Desktop/AI-OS commit -m "docs(skills): add bottle modeling and delivery QA"
```

### Task 5: Add the Best Bottles adapter and exported-GLB validator

**Files:**
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/best-bottles-adapter.md`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/best-bottles-glb-contract.json`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/validate_glb_contract.py`
- Create: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/test_validate_glb_contract.py`

**Interfaces:**
- Consumes: a `.glb`, the structured Best Bottles contract, and expected envelope dimensions supplied for the current bottle.
- Produces: `validate_glb(glb_path: Path, contract: dict, expected_envelope_mm: dict[str, float]) -> dict` and a JSON report with `overall`, `checks`, `warnings`, and `observed`.

- [ ] **Step 1: Write failing validator unit tests**

Write Blender-Python tests for these behaviors:

```python
class ContractValidationTests(unittest.TestCase):
    def test_valid_fixture_checks_every_contract_field(self): ...
    def test_missing_required_mesh_name_fails(self): ...
    def test_label_uv_outside_zero_one_fails(self): ...
    def test_triangle_budget_violation_fails(self): ...
    def test_base_above_zero_fails_floor_contract(self): ...
    def test_scaled_envelope_fails_real_dimension_check(self): ...
    def test_solid_body_without_inner_cavity_fails(self): ...
    def test_uncompressed_glb_fails_draco_requirement(self): ...
```

The test helper creates small valid and invalid Blender scenes in a temporary directory, exports GLBs, and imports the exported artifact before assertions. For the cavity check, cast horizontal rays through two mid-body heights; a hollow glass wall must expose outer and inner surface crossings on both sides rather than the two crossings of a solid volume.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/test_validate_glb_contract.py
```

Expected: FAIL because `validate_glb_contract.py` and `validate_glb()` do not yet exist.

- [ ] **Step 3: Write the structured Best Bottles contract**

Use this schema and values:

```json
{
  "contract_id": "best-bottles-configurator-glb-v1",
  "format": "GLB",
  "mesh_categories": {
    "required": ["body", "liquid", "label_front", "label_back"],
    "optional_component_aliases": ["cap", "sprayer", "pump", "roller", "dropper"],
    "optional": ["collar"],
    "matching": "case-insensitive-substring"
  },
  "authoring": {"up_axis": "+Z", "base_z_mm": 0.0, "units": "mm"},
  "triangle_budget": {"minimum": 10000, "maximum": 40000},
  "interior_cavity_required": true,
  "label_uv": {"minimum": 0.0, "maximum": 1.0},
  "compression": "draco",
  "target_bytes": 46080,
  "target_is_hard_limit": false
}
```

- [ ] **Step 4: Implement the minimal exported-artifact validator**

Implement these functions:

```python
def load_contract(path: Path) -> dict: ...
def read_glb_json_chunk(path: Path) -> dict: ...
def import_glb(path: Path) -> list[bpy.types.Object]: ...
def categorize_mesh(name: str, contract: dict) -> str | None: ...
def inspect_label_uvs(obj: bpy.types.Object, uv_min: float, uv_max: float) -> dict: ...
def inspect_cavity(obj: bpy.types.Object) -> dict: ...
def validate_glb(glb_path: Path, contract: dict, expected_envelope_mm: dict[str, float]) -> dict: ...
def main(argv: list[str]) -> int: ...
```

CLI:

```bash
blender --background --factory-startup --python scripts/validate_glb_contract.py -- \
  --glb /absolute/model.glb \
  --contract /absolute/best-bottles-glb-contract.json \
  --expected-height-mm 78 \
  --expected-width-mm 33 \
  --expected-depth-mm 33 \
  --report /absolute/model-contract-report.json
```

Exit `0` only when all hard requirements pass. Report the 45 KB target separately because it is a target, not a hard maximum.

- [ ] **Step 5: Run tests and verify GREEN**

Run the Task 5 Step 2 command again.

Expected: all eight validator tests pass with no unhandled Blender exceptions.

- [ ] **Step 6: Write the Best Bottles routing adapter**

Include a table of contents, current absolute project and AIOS launcher paths, protected-master rules, current builder/render/contract paths, the exact validator command, and the structured GLB requirements. State that project-native geometry fingerprints remain authoritative; uncommitted closure work is current workspace state, not reusable global truth.

- [ ] **Step 7: Smoke-test the current Boston Round exporter through the new artifact validator**

Build into a temporary directory, then validate the exported file:

```bash
BB_SKILL_SMOKE_DIR="$(mktemp -d /tmp/bb-skill-glb.XXXXXX)"
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/paper-doll-3d/build-boston-round.py -- \
  --capacity 30 \
  --output "$BB_SKILL_SMOKE_DIR/boston-round-30ml.blend" \
  --glb "$BB_SKILL_SMOKE_DIR/boston-round-30ml.glb"
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/validate_glb_contract.py -- \
  --glb "$BB_SKILL_SMOKE_DIR/boston-round-30ml.glb" \
  --contract /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/best-bottles-glb-contract.json \
  --expected-height-mm 78 --expected-width-mm 33 --expected-depth-mm 33 \
  --report "$BB_SKILL_SMOKE_DIR/contract-report.json"
```

Expected: contract report enumerates every field. If the current exporter cannot meet a hard field, record the observed gap without modifying the existing builder in this skill task.

- [ ] **Step 8: Commit the adapter and validator in AIOS**

```bash
git -C /Users/jordanrichter/Desktop/AI-OS add \
  .agents/skills/modeling-bottles-in-blender/references/best-bottles-adapter.md \
  .agents/skills/modeling-bottles-in-blender/references/best-bottles-glb-contract.json \
  .agents/skills/modeling-bottles-in-blender/scripts/validate_glb_contract.py \
  .agents/skills/modeling-bottles-in-blender/scripts/test_validate_glb_contract.py
git -C /Users/jordanrichter/Desktop/AI-OS commit -m "feat(skills): add Best Bottles GLB contract validation"
```

### Task 6: Run forward tests, refactor guidance, and lock the installed skill

**Files:**
- Modify: `docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md`
- Modify only if testing demonstrates a gap: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/SKILL.md`
- Modify only if testing demonstrates a gap: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/references/*.md`

**Interfaces:**
- Consumes: installed skill, all six references, GLB validator, baseline results, and eight approved forward scenarios.
- Produces: a validated global installation and a final checklist with paths, observed behaviors, validator output, and remaining limitations.

- [ ] **Step 1: Run the same eight scenarios with the candidate skill loaded**

Use one fresh context per scenario and provide the exact skill path. Score with the same rubric. The per-segment scenario passes only when photographed shoulder/heel segments use measured silhouette or direct-photo provenance and AI contributes only an occluded segment. The negative trigger scenario passes only when the Blender skill is not selected for 2D work.

- [ ] **Step 2: Compare candidate behavior with the baseline**

Record:

```text
baseline result -> candidate result
corrected failure
new rationalization, if any
guidance location responsible for the correction
```

If the candidate exposes a real gap, make the smallest targeted edit to the router or one reference, then rerun only the affected scenario plus one adjacent control. Do not accumulate hypothetical rules.

- [ ] **Step 3: Run structural validation**

```bash
python3 /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender
test "$(readlink /Users/jordanrichter/.codex/skills/modeling-bottles-in-blender)" = \
  "/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender"
find /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender -type f -print | sort
rg -n 'TBD|TODO|FIXME|PLACEHOLDER' \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender || true
```

Expected: validator passes, symlink points to the canonical package, expected files are present, and placeholder scan is empty.

- [ ] **Step 4: Run behavior and validator regression checks**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/test_validate_glb_contract.py
```

Expected: all validator tests pass. Trigger micro-tests remain positive 5/5 and negative 0/5. All eight candidate scenarios are recorded, with any accepted limitation explicit.

- [ ] **Step 5: Complete the final checklist**

The verification record must report:

```markdown
- [ ] Global skill path and canonical source path
- [ ] Skill package validator result
- [ ] SKILL.md line and word counts
- [ ] Positive and negative trigger micro-test results
- [ ] Eight baseline/candidate scenario comparisons
- [ ] Per-segment provenance result
- [ ] Finish-invariance result
- [ ] Best Bottles GLB artifact-contract result
- [ ] Missing-delivery-contract behavior
- [ ] Protected-source behavior
- [ ] Remaining limitations
```

- [ ] **Step 6: Commit any test-driven skill refinements in AIOS**

If Task 6 changed the skill package:

```bash
git -C /Users/jordanrichter/Desktop/AI-OS add .agents/skills/modeling-bottles-in-blender
git -C /Users/jordanrichter/Desktop/AI-OS commit -m "test(skills): harden Blender bottle workflow"
```

- [ ] **Step 7: Commit the completed verification record in the Best Bottles repository**

```bash
git add docs/superpowers/reviews/2026-08-25-modeling-bottles-in-blender-tdd.md
git commit -m "test(blender): verify universal bottle modeling skill"
```
