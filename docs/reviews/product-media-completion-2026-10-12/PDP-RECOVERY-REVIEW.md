# PDP recovery and Elegant Minaret diagnosis — 13 October 2026

## Confirmed and fixed locally

`BBM-PDP-RECOVERY-001`: the PDP optimized Shopify fallback handler used the register-only failure flag as its raw-retry gate. Shopify URLs therefore advanced to another image or the empty state without requesting the original. Two of three focused regressions failed before the change. The handler now gives any image it optimized one original-URL attempt, then advances on a real original failure. Failure state stays tied to the exact URL.

Local commit `d6efe647` contains the fix and tests. The targeted Builder/PDP suite passes **46 tests**; TypeScript passes. This does not prove network behavior on a real browser or iPhone.

## Elegant15 Minaret: reason for the three omissions

An offline diagnostic executes the current identity, eligibility and complete-photo fallback predicates against saved production products/groups/media. These exact included-assembly identities do not depend on loose-part matrix inference.

| SKU | Eligible identity / sellability | Reviewed body | Exact assembly plate | Legacy kit / renderable register | Saved Builder |
| --- | --- | --- | --- | --- | --- |
| GBElg15MinarCu | Pass | Present | Present | Neither | Offered |
| GBElg15MinarSl | Pass | Present | Missing | Neither | Absent |
| GBElgFrst15MinarCu | Pass | Present | Missing | Neither | Absent |
| GBElgFrst15MinarSl | Pass | Present | Missing | Neither | Absent |

The three missing options have no complete assembly media path in that snapshot. Recover an exact reviewed assembly plate or finish the approved component assembly release. Do not loosen compatibility or insert a sibling photograph. These are already represented in the image-gap backlog; they are not three additional duplicate issues.

Evidence: `evidence/elegant-minaret-diagnosis.json`. This is an offline diagnosis with saved data, not a new live UI observation.

## PR #368 integration candidate

Reviewed head `2b0710952e9e91fc09076ceba351905d3527f45b`. Source simulation against media commit `d6efe647` found one CSS conflict: the new mobile LCP rules were adjacent to the obsolete baseline override. Candidate resolution retains the LCP rules and removes the baseline override.

The first combined targeted run passed 50 tests. Additional coverage then reproduced four failures for #368's expanded optimized hosts and its legacy body layer. Its source-selection predicate allowed optimization while the raw-recovery handler only recognized register URLs (and, with our local fix, the older narrower optimization policy).

The local candidate makes raw recovery follow the same `canOptimizeProductImage` decision as rendering, for both the first body layer and flat-photo fallback. All **54 targeted tests pass** after the fix. The candidate is saved, not applied to the remote PR or the active source branch. No merge occurred.

- `evidence/pr-368-integration/candidate.json`: exact revisions and before/after hashes.
- `evidence/pr-368-integration/integration-resolution.patch`: local proposed resolution, including tests.
- `evidence/pr-368-integration/expanded-sources-before.log`: four failed / three passed.
- `evidence/pr-368-integration/expanded-sources-after.log`: 54 passed across eight files.

The patch is against the saved simulated tree, including its conflict markers. Do not apply it blindly to a different revision. The reviewed patch is also preserved in this review directory for continuation.

## Gates still open

Browser permission, source-drive access, pilot geometry correction and approval, catalogue-wide visual inspection, physical iPhone checks, source/asset publication receipts, and explicit merge/production-write approval. PR integration tests establish source behavior only; no media issue is closed by those tests.

Evidence root: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`
