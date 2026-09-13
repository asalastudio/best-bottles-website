# Boston family plate contact sheet

Open `http://localhost:3040/team/asset-ledger?preview=1&view=plates`.

The sheet contains all 123 current catalog configurations, organized by 15/30/60 mL and catalog glass color. It displays 90 unchanged cap-on plates and 52 cap-off views, with explicit placeholders for 33 missing plates. The 62 plates passing the existing source/technical checks can receive visual approval. Full-glass normalization across plate/kit presentation coordinates is not claimed; the three shared hero standards stay separate and untouched.

All 142 saved image files are original bytes copied from indexed asset URLs, verified by SHA-256 and decoded to the same 1000 × 1100 WebP canvas. No shadows, image pixels, master PSDs or original files were edited. Every preview uses the same scale; a missing/not-required secondary view does not enlarge the cap-on preview. Images can be enlarged for inspection.

## Review protocol

Scan the whole family or a size batch. Flag exceptions and add notes. Acknowledge review of the eligible plates and shown cap-off views. Approve the remaining eligible plates together, or save exceptions alone. Previously approved images, saved exceptions, technical holds and missing plates are excluded from the approval count. Switching size limits the decision to that visible batch; flags in other sizes are retained locally but not silently submitted.

The local development-only, same-origin endpoint validates the sheet token, feedback revision, explicit per-SKU bindings and all selected rows before a single atomic feedback write. Approval rechecks current Convex view URLs and served bytes for both cap states. Missing/held plates cannot be approved. Notes and decisions persist in `data/asset-ledger/boston-plate-contact-decisions.json`. The manifest is `data/asset-ledger/boston-plate-contact-sheet.json`. Originals are immutable; a changed manifest/binding requires a new review. The ledger consumes exact matching view approvals and rechecks served hashes on the next build, independently from kits and heroes.

Nothing was approved or published by the agent. Sheet preparation grants no decision. Local approval remains separate from a named release and Jordan's “ship.” Legacy scope reconciliation and product-flow checks remain open.

## Verification

- `after-check.json`: before/after ledger counts are unchanged: 90 plates present, 62 checks passed, zero strictly approved plates, 25 kit candidates, zero live kits, 23 covered hero groups.
- The measurement command followed by the ledger build passed before and after: 1,876 images measured with zero fetch/measurement failures; 49 diagnostic width outliers and 550 legacy sources globally.
- `tests/plate-contact-sheet.test.ts`: isolated-fixture tests for atomic batch approval, stale tabs, holds, cap-off byte changes, sibling preservation, exception feedback and local byte tampering. Combined targeted review tests: 22 passed.
- `browser-verification.json`: browser checks; the approval POST is intercepted and never reaches the real saving endpoint. Persistence is exercised only in temporary fixtures.
- `desktop.png`, `plates-desktop.png`, `mobile.png`, `plates-mobile.png`: actual local UI captures. No changed product imagery exists, so there is no resized-image before/after in this step.

TypeScript and the Webpack production build passed. The browser regression also checks cached-image readiness: an already-loaded preview must enable review without another network load. Test approval requests never wrote real review decisions.
