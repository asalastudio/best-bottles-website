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
- [ ] Candidate comparison preserves the selected acceptance class: Concept, Visual production, Fitment candidate, or Manufacturing reference; weak evidence is reported, not used to block an operator-approved appropriate use.
- [ ] Candidate comparison preserves layered model separation: body exterior/interior volume; neck and finish; closure or fitment; materials/liquid/labels/coatings/decoration; and studio/camera/lighting/render/output variants.
- [ ] Candidate comparison preserves the adapter pattern: project adapters route to live project-native documents, scripts, contracts, fingerprints, and approval rules without copying product dimensions into the global workflow.
- [ ] Candidate comparison preserves non-blocking uncertainty: evidence quality, assumptions, inferred geometry, and conflicts remain visible; the operator selects intended use and decides whether the result is acceptable.
- [ ] Candidate guidance scenarios recorded.
- [x] Trigger micro-tests recorded.
