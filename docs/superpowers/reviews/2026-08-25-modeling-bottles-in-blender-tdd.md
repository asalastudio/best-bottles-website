# Modeling Bottles in Blender — Documentation TDD Record

## Environment
- Date: 2026-08-25
- Baseline guidance: new skill absent
- Candidate guidance: new skill loaded from canonical path

## Scoring
- PASS: behavior satisfies the approved design without unsupported claims.
- PARTIAL: useful result, but one required provenance, delivery, or routing behavior is missing.
- FAIL: behavior violates a required invariant or selects the skill for the 2D negative case.

## Baseline Control Provenance
The controller collected each control in an independent fresh agent context. None loaded or mentioned the proposed skill. Control IDs are stable evidence anchors for the baseline comparison.

| Control ID | Scenario | Context | Proposed skill | Decisive control trace |
|---|---:|---|---|---|
| `baseline_1` | 1 | Independent fresh context | Not loaded | “keep the real-photo shoulder, even if the AI version looks cleaner.” |
| `baseline_2` | 2 | Independent fresh context | Not loaded | “do not uniformly scale the entire bottle—the 20-400 finish must remain unchanged.” |
| `baseline_3` | 3 | Independent fresh context | Not loaded | “not ready to claim yet—there is no bottle model or export artifact to validate.” |
| `baseline_4` | 4 | Independent fresh context | Not loaded | “use a Photoshop-style layered compositing workflow, preserving original PSD layers.” |
| `baseline_5` | 5 | Independent fresh context | Not loaded | “reuse it only as a versioned, parameterized component with explicit interface checks.” |
| `baseline_6` | 6 | Independent fresh context | Not loaded | “unverified—evidence grade D.” |
| `baseline_7` | 7 | Independent fresh context | Not loaded | “treat it as a reference-led 3D reconstruction, not manufacturing-grade CAD.” |
| `baseline_8` | 8 | Independent fresh context | Not loaded | “do not modify the protected master directly. Create a versioned derivative and keep the original immutable.” |

## Candidate Control Provenance

The controller collected `candidate_1` through `candidate_8` in independent
fresh contexts. The installed path was
`/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` in every
positive scenario; it resolves to the canonical package at
`/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender`.

| Candidate ID | Exact installed skill path | Exact request prompt | Context and skill loading | Decisive retained output excerpt |
|---|---|---|---|---|
| `candidate_1` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Build a bottle from calibrated front photography plus an AI-generated side sheet; the AI shoulder looks cleaner than the photo. | Independent fresh context; installed skill body and only routed `inferred-schematics.md` and `bottle-brief.md` references loaded. | “Do not adopt the cleaner AI shoulder.” “only the unseen side-depth transition: ai-inferred”. |
| `candidate_2` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Derive a 60 ml bottle quickly by scaling a finished 30 ml model; both use 20-400. | Independent fresh context; installed skill body and only routed `blender-modeling.md` and `qa-and-handoff.md` references loaded. | “derive the 60 ml as a new body variant, not a uniformly scaled copy of the full 30 ml assembly. Reuse the approved 20-400 finish unchanged.” |
| `candidate_3` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Export a bottle GLB for our configurator and tell me whether it is ready. | Independent fresh context; installed skill body and only routed `best-bottles-adapter.md`, the structured contract, and validator material loaded. | “not ready to approve yet. The Best Bottles GLB contract exists, but no exported artifact plus fresh-import validation report has been provided.” |
| `candidate_4` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Remove the background from these bottle PSDs and prepare layered paper-doll imagery. | Independent fresh context; frontmatter only; skill rejected and neither body nor references loaded. | “Do not use modeling-bottles-in-blender.” “This is a 2D asset-production task, not a 3D geometry task.” |
| `candidate_5` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Reuse a closure component in a project that has no geometry-fingerprint infrastructure. | Independent fresh context; installed skill body and only routed `blender-modeling.md` and `qa-and-handoff.md` references loaded. | “project_fingerprint: null”, “source_path: /absolute/path/to/approved-closure-source.blend-or-component”, “sha256: <SHA-256 of the exact reused source>”. |
| `candidate_6` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | This marketplace listing looks identical and publishes dimensions; identify whether it is the exact bottle. | Independent fresh context; installed skill body and only routed `evidence-research.md` loaded. | “Grade: Probable (at most).” “Not established as the exact bottle.” |
| `candidate_7` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Identify and model an asymmetric perfume bottle from photos, catalog dimensions, and web research. | Independent fresh context; installed skill body and only routed `bottle-brief.md`, `evidence-research.md`, `inferred-schematics.md`, `blender-modeling.md`, and `qa-and-handoff.md` references loaded. | “accept the assignment for visual-production only” and “AI inference must never override a photographed contour or catalog-supported numeric value.” |
| `candidate_8` | `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender` | Modify a protected bottle master to make the new version faster. | Independent fresh context; installed skill body and only routed `blender-modeling.md` and `best-bottles-adapter.md` references loaded. | “do not modify the protected master. Treat it as an immutable, hash-verified input and create a named derived working copy”. |

## Baseline Results
| Scenario | Expected behavior | Observed behavior | Result | Failure or rationale |
|---|---|---|---|---|
| 1 | Preserve the calibrated photographed shoulder over a cleaner AI side sheet. | Kept the real-photo shoulder; treated the AI side sheet only as a gap-filler for unseen contours and validated with front and three-quarter comparisons. | PASS | Product fidelity was prioritized over generated neatness; no baseline gap observed. |
| 2 | Keep the 20-400 finish unchanged when deriving a 60 ml variant from a 30 ml model. | Duplicated the 30 ml model, locked neck/finish dimensions, scaled only the body/shoulder initially by the cube root of two (1.2599×), then rebuilt the transition. | PASS | Explicitly avoided uniform scaling of the finish and required cavity-volume verification. |
| 3 | Do not claim a GLB is configurator-ready without validating the delivery contract. | Declined to claim readiness; proposed target-configurator validation of scale, orientation, material swapping, component separation, compressed embedded textures, file size, and mobile performance. | PARTIAL | “The response did not request or name a delivery contract, nor did it enumerate the active configurator's exact mesh, triangle, cavity, UV, or compression contract.” |
| 4 | Route the 2D PSD/background-removal request to a layered paper-doll workflow, not Blender bottle modeling. | Chose a Photoshop-style layered compositing workflow with non-destructive masking, separated body/cap/label/shadow layers, transparent PNGs, and a layered master. | PASS | “No 3D or Blender workflow was invoked.” |
| 5 | Reuse a closure only with explicit compatibility and reuse provenance, without inventing unsupported infrastructure. | Used versioned, parameterized reuse with local dimensional/interface checks and a test fit; allowed a fork when needed. | PARTIAL | “The response did not record the source file path plus a content hash.” |
| 6 | Avoid calling a marketplace listing the exact bottle without the approved evidence grade and limitation. | Refused the exact claim, called the evidence grade D (a non-approved control label), and required matching SKU or a tight multi-feature match including neck finish. | PARTIAL | “The answer correctly refused an exact claim but did not use the approved `Exact\|Strong\|Probable\|Reference only` grades or explicitly state that marketplace-only dimensions cap the candidate at `Probable`.” |
| 7 | Model the asymmetric bottle with research grades and segment-level provenance, including inferred geometry. | Used a reference-led reconstruction, catalog dimensions for scale, asymmetric parametric modeling, overlays, and documented inferred unresolved areas. | PARTIAL | “The response did not require provenance on every individual profile segment or distinguish AI-inferred segments from assumed segments in QA.” |
| 8 | Preserve the protected master by creating a derivative rather than editing it in place. | Declined direct modification, created a versioned derivative, profiled the bottleneck, benchmarked targeted reductions, and required approval before promotion. | PASS | The canonical asset remained immutable and the optimization reversible. |

## Candidate Results
| Scenario | Expected behavior | Observed behavior | Result | Remaining gap |
|---|---|---|---|---|
| 1 | Preserve the calibrated photographed shoulder over a cleaner AI side sheet. | Selected `visual-production`; extracted numeric photo datums and assigned `measured-silhouette` (or `direct-photo` when uncalibrated) to the visible shoulder, original photos to visible wall/heel/base/finish, `ai-inferred` only to an unseen side-depth transition, and `assumed` only to unseen interior choices. It labeled the sheet AI-assisted inferred and said AI never overrides a photographed segment. | PASS | None. |
| 2 | Keep the 20-400 finish unchanged when deriving a 60 ml variant from a 30 ml model. | Derived a new body variant, not a uniform full-assembly scale; preserved the 20-400 finish and regenerated only body/interior below the attachment datum. Required identical T/E/I, finish height, pitch, thread turns, and closed-interior capacity validation. | PASS | None. |
| 3 | Do not claim a GLB is configurator-ready without validating the delivery contract. | Required the exported GLB and fresh-import report; named the active Best Bottles contract and validator command, and required names, +Z/base, real envelope tolerance, 10–40k triangles, two-height cavity rays, 0–1 label UVs, Draco on all primitives, and the advisory-only 46,080-byte target. | PASS | None. |
| 4 | Route the 2D PSD/background-removal request to a layered paper-doll workflow, not Blender bottle modeling. | Rejected `modeling-bottles-in-blender` from frontmatter only and routed to Photoshop/Adobe for masks, editable PSD layers, and transparent paper-doll assets; did not load the Blender workflow. | PASS | None. |
| 5 | Reuse a closure only with explicit compatibility and reuse provenance, without inventing unsupported infrastructure. | Reused the closure as a separate unmodified component subject to interface checks; recorded `project_fingerprint: null`, exact `source_path`, SHA-256, reuse method, source revision, and permitted modification. | PASS | None. |
| 6 | Avoid calling a marketplace listing the exact bottle without the approved evidence grade and limitation. | Limited the result to `Probable` at most; required matching identity plus manufacturer-published dimensions or a traceable measured sample for `Exact`, and treated marketplace dimensions as corroborating only. | PASS | None. |
| 7 | Model the asymmetric bottle with research grades and segment-level provenance, including inferred geometry. | Accepted it for `visual-production`, not fitment/manufacturing without stronger evidence; used `Strong`/`Probable` grades, station/loft/surface construction, layered objects, a source class for each profile segment, AI only in occluded side/depth or underside regions, and the missing-contract phrase when applicable. | PASS | None. |
| 8 | Preserve the protected master by creating a derivative rather than editing it in place. | Treated the master as immutable/hash-verified input; created a named working-lane derivative, benchmarked the performance target, optimized non-geometry settings first, preserved finish geometry where needed, validated the derivative, and required operator disposition. | PASS | None. |

## Baseline → Candidate Comparison

| Scenario | Baseline result → candidate result | Correction or preserved behavior | New rationalization | Guidance responsible |
|---|---|---|---|---|
| 1 | PASS → PASS | No baseline defect; candidate made per-segment hierarchy explicit. | No new rationalization. | `inferred-schematics.md` profile hierarchy; `bottle-brief.md` segment records. |
| 2 | PASS → PASS | No baseline defect; candidate added exact finish-invariance fields. | No new rationalization. | `blender-modeling.md` fixed finish modules/family scaling; `qa-and-handoff.md` finish invariance. |
| 3 | PARTIAL → PASS | Corrected: named active contract and every configurator field. | No new rationalization. | `best-bottles-adapter.md`, structured contract, and validator. |
| 4 | PASS → PASS | Negative routing preserved; Blender skill explicitly rejected. | No new rationalization. | `SKILL.md` frontmatter 2D exclusion. |
| 5 | PARTIAL → PASS | Corrected: explicit path + SHA-256 with null project fingerprint. | No new rationalization. | `blender-modeling.md` and `qa-and-handoff.md` component reuse provenance. |
| 6 | PARTIAL → PASS | Corrected: exact grade vocabulary and marketplace maximum `Probable`. | No new rationalization. | `evidence-research.md` candidate comparison. |
| 7 | PARTIAL → PASS | Corrected: per-segment provenance and distinct AI/assumed treatment. | No new rationalization. | Bottle brief, evidence research, inferred schematics, Blender modeling, and QA/handoff references. |
| 8 | PASS → PASS | Protected-master behavior preserved and project working lane made explicit. | No new rationalization. | `blender-modeling.md` source protection; `best-bottles-adapter.md` protected-master rules. |

No candidate behavior gap was observed. No speculative skill or reference edit was made.

## Structural Verification Evidence

Installed global skill path:
`/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender`.
Canonical package path:
`/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender`.

The exact package resources (relative to the canonical package; nested `.git`
metadata excluded) are:

```text
SKILL.md
agents/openai.yaml
references/best-bottles-adapter.md
references/best-bottles-glb-contract.json
references/blender-modeling.md
references/bottle-brief.md
references/evidence-research.md
references/inferred-schematics.md
references/qa-and-handoff.md
scripts/test_validate_glb_contract.py
scripts/validate_glb_contract.py
```

The direct validator command was:

```bash
python3 /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender
```

It exited `1` only because system Python lacked `yaml`
(`ModuleNotFoundError: No module named 'yaml'`). The required retry was:

```bash
uv run --no-project --with pyyaml python \
  /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender
```

It exited `0` with `Skill is valid!` (and the non-failing `--no-project`
warning). Symlink command/result:

```bash
test "$(readlink /Users/jordanrichter/.codex/skills/modeling-bottles-in-blender)" = \
  "/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender"
```

Exit `0`; `readlink` returned exactly
`/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender`.
`wc -lw` reports `SKILL.md` as 16 lines and 182 words.

Exact placeholder scan command:

```bash
rg -n 'TBD|TODO|FIXME|PLACEHOLDER' \
  /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender || true
```

Result: empty (no placeholder matches).

Exact headless Blender regression command:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python /Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender/scripts/test_validate_glb_contract.py
```

Exit `0`; output ended with:

```text
Ran 11 tests in 3.813s

OK
```

## Trigger Micro-tests
The controller collected all ten rows in independent fresh contexts using a mini catalog containing only `modeling-bottles-in-blender` and `paper-doll-image-processing`; no tools or file inspection occurred.

| Variant | Rep | Prompt | Selected skill | Result |
|---|---:|---|---|---|
| Positive | 1 | Create a real-scale GLB of this 50 ml vial with a separate dropper mesh. | `modeling-bottles-in-blender` | PASS |
| Positive | 2 | Create a real-scale GLB of this 50 ml vial with a separate dropper mesh. | `modeling-bottles-in-blender` | PASS |
| Positive | 3 | Create a real-scale GLB of this 50 ml vial with a separate dropper mesh. | `modeling-bottles-in-blender` | PASS |
| Positive | 4 | Create a real-scale GLB of this 50 ml vial with a separate dropper mesh. | `modeling-bottles-in-blender` | PASS |
| Positive | 5 | Create a real-scale GLB of this 50 ml vial with a separate dropper mesh. | `modeling-bottles-in-blender` | PASS |
| Negative | 1 | Remove the background from these bottle PSDs and keep the layers organized. | `paper-doll-image-processing` | PASS |
| Negative | 2 | Remove the background from these bottle PSDs and keep the layers organized. | `paper-doll-image-processing` | PASS |
| Negative | 3 | Remove the background from these bottle PSDs and keep the layers organized. | `paper-doll-image-processing` | PASS |
| Negative | 4 | Remove the background from these bottle PSDs and keep the layers organized. | `paper-doll-image-processing` | PASS |
| Negative | 5 | Remove the background from these bottle PSDs and keep the layers organized. | `paper-doll-image-processing` | PASS |

## Final Checklist
- [x] Eight fresh-context baseline scenarios recorded.
- [x] `baseline_1` through `baseline_8` document independent fresh contexts with the proposed skill not loaded and a decisive trace for each.
- [x] Every baseline row has a scored result.
- [x] Candidate comparison preserves the selected acceptance class: Scenario 1 and 7 selected `visual-production`; Scenario 7 withheld fitment/manufacturing use until evidence strengthens, while operator disposition remains required.
- [x] Candidate comparison preserves layered model separation: Scenario 7 retains layered objects, and Scenario 2 retains the separate, fixed finish while regenerating only body/interior geometry.
- [x] Candidate comparison preserves the adapter pattern: Scenario 3 names the active Best Bottles contract and validator; Scenario 8 routes changes through the named project working lane rather than copying dimensions into the global workflow.
- [x] Candidate comparison preserves non-blocking uncertainty: Scenarios 1 and 7 preserve per-segment source classes and the `ai-inferred`/`assumed` distinction; Scenario 8 requires operator disposition.
- [x] `candidate_1` through `candidate_8` document independent fresh contexts, exact request prompts, the installed skill path, loaded-scope status, and decisive retained output excerpts.
- [x] All eight baseline → candidate comparisons are recorded, including correction/preserved behavior, explicit new-rationalization status, and responsible guidance location.
- [x] Trigger micro-tests recorded.
- [x] Global skill path: `/Users/jordanrichter/.codex/skills/modeling-bottles-in-blender`; canonical source path: `/Users/jordanrichter/Desktop/AI-OS/.agents/skills/modeling-bottles-in-blender`; `readlink` matched exactly.
- [x] Skill package validator: direct `python3` invocation failed only because system Python lacks `yaml` (`ModuleNotFoundError`); prescribed `uv run --no-project --with pyyaml` retry exited 0 with `Skill is valid!`.
- [x] `SKILL.md` count: 16 lines, 182 words.
- [x] Positive trigger micro-tests: 5/5 selected `modeling-bottles-in-blender`; negative trigger micro-tests: 0/5 selected it (all 5 routed to `paper-doll-image-processing`).
- [x] Profile provenance: Scenario 1 and 7 keep all four source classes distinct; photographed segments stay `measured-silhouette`/`direct-photo`, AI is limited to occluded geometry, and `assumed` remains separate.
- [x] Finish invariance: Scenario 2 preserves the 20-400 finish and requires identical T/E/I, finish height, pitch, and thread turns; only body/interior changes below the attachment datum.
- [x] Missing-delivery-contract behavior: Scenario 7 uses the required behavior—report the export-readiness gap without inventing destination requirements when no delivery contract is configured.
- [x] Protected-source behavior: Scenario 8 leaves locked/hash-verified masters unchanged, creates a named working-lane derivative, validates it, and requires operator disposition.
- [x] Full Blender validator regression: 11 tests passed with the exact headless Blender command.
- [x] Best Bottles GLB artifact-contract result: all 17 fields were enumerated; the current project-owned Boston Round smoke artifact is not ready because only `authoring.units` fails after import at approximately 1,000× too large. Its 56,920-byte size is an advisory warning above 46,080 bytes; the builder remained untouched.
- [x] Remaining limitation: the skill's 11 Blender validator tests pass, but the current project-owned Boston Round smoke artifact fails only `authoring.units` because it imports approximately 1,000× too large; its 56,920-byte size is an advisory warning above 46,080. This is a project artifact/exporter gap, not a skill-validator failure.
