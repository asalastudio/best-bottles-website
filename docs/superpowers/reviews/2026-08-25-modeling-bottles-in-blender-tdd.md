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
| 1 | Preserve the calibrated photographed shoulder over a cleaner AI side sheet. | Kept the real-photo shoulder; treated the AI side sheet only as a gap-filler for unseen contours and validated with front and three-quarter comparisons. | PASS | Product fidelity was prioritized over generated neatness; no baseline gap observed. |
| 2 | Keep the 20-400 finish unchanged when deriving a 60 ml variant from a 30 ml model. | Duplicated the 30 ml model, locked neck/finish dimensions, scaled only the body/shoulder initially by the cube root of two (1.2599×), then rebuilt the transition. | PASS | Explicitly avoided uniform scaling of the finish and required cavity-volume verification. |
| 3 | Do not claim a GLB is configurator-ready without validating the delivery contract. | Declined to claim readiness; proposed target-configurator validation of scale, orientation, material swapping, component separation, compressed embedded textures, file size, and mobile performance. | PARTIAL | “The response did not request or name a delivery contract, nor did it enumerate the active configurator's exact mesh, triangle, cavity, UV, or compression contract.” |
| 4 | Route the 2D PSD/background-removal request to a layered paper-doll workflow, not Blender bottle modeling. | Chose a Photoshop-style layered compositing workflow with non-destructive masking, separated body/cap/label/shadow layers, transparent PNGs, and a layered master. | PASS | “No 3D or Blender workflow was invoked.” |
| 5 | Reuse a closure only with explicit compatibility and reuse provenance, without inventing unsupported infrastructure. | Used versioned, parameterized reuse with local dimensional/interface checks and a test fit; allowed a fork when needed. | PARTIAL | “The response did not record the source file path plus a content hash.” |
| 6 | Avoid calling a marketplace listing the exact bottle without the approved evidence grade and limitation. | Refused the exact claim, called the evidence grade D, and required matching SKU or a tight multi-feature match including neck finish. | PARTIAL | “The answer correctly refused an exact claim but did not use the approved `Exact\|Strong\|Probable\|Reference only` grades or explicitly state that marketplace-only dimensions cap the candidate at `Probable`.” |
| 7 | Model the asymmetric bottle with research grades and segment-level provenance, including inferred geometry. | Used a reference-led reconstruction, catalog dimensions for scale, asymmetric parametric modeling, overlays, and documented inferred unresolved areas. | PARTIAL | “The response did not require provenance on every individual profile segment or distinguish AI-inferred segments from assumed segments in QA.” |
| 8 | Preserve the protected master by creating a derivative rather than editing it in place. | Declined direct modification, created a versioned derivative, profiled the bottleneck, benchmarked targeted reductions, and required approval before promotion. | PASS | The canonical asset remained immutable and the optimization reversible. |

## Candidate Results
| Scenario | Expected behavior | Observed behavior | Result | Remaining gap |
|---|---|---|---|---|

## Trigger Micro-tests
| Variant | Rep | Prompt | Selected skill | Result |
|---|---:|---|---|---|

## Final Checklist
- [x] Eight fresh-context baseline scenarios recorded.
- [x] Every baseline row has a scored result.
- [ ] Candidate guidance scenarios recorded.
- [ ] Trigger micro-tests recorded.
