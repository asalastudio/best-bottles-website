# Boston reuse and gap queue — September 12, 2026

Implemented in the local asset workbench immediately below the family selector. The default batch is 15 mL. Size buttons share the existing workbench size selection; family changes reset the queue filters. Each exact catalog SKU retains separate plate, kit and hero evidence, source holds, current/candidate hashes, and a recommended next action. Catalog names and cap colors now pass through from the existing read-only catalog query; missing component attributes remain unknown.

## Before and after

123 configurations → 123. Existing plates 90 → 90. Plate checks passed 62 → 62. Strictly approved complete plates 0 → 0. Kit candidates 25 → 25; live kits 0 → 0. Group Sunburst coverage 23/23 → 23/23. The three shared standards remain locked. The approved resized 30 mL file remains accessible from its exact SKU row.

The measurement command followed by the ledger build succeeded before and after. Both measured 1,876 plates with zero fetch/measurement failures, 49 diagnostic width outliers and 550 legacy sources globally. The 123 Boston rows retained identical plate, kit and hero evidence, including approvals and fingerprints. Only catalog display fields were added to the row output.

## Boundaries

The queue derives recommendations from the ledger and current local standard review state; it does not write approvals, alter images, resolve source holds, change release indexes or publish. Green is reserved for existing complete/live or recorded non-applicable artifacts. An approved group hero still receives a glass-target/configuration check; group coverage never fabricates per-component approval. Kits whose candidate plate hash differs from the current plate are held. The family CSV always exports the entire selected family regardless of visible filters and includes snapshot time, identity, hashes, collections, raw evidence and next actions.

Scope is the current development catalog. Full legacy variant reconciliation and actual customer product-flow checks remain open. Kit holds are dated evidence to investigate, not declarations that components or photography are absent. Original image sizing and generation work is outside this queue change.

## Evidence

- `baseline.json` and `after-check.json`: family counts and exact asset-evidence preservation.
- `inventory.csv`: full Boston inventory exported through the browser control.
- `browser-verification.json`: desktop/mobile filters, pagination, export and preserved final-image review.
- `comparison.html`: equal-zoom before/after screenshots and queue detail.
- `tests/reuse-queue.test.ts`: approval, group coverage, stale kit dependency, identity and export safeguards.

Validation: 16 targeted tests passed; TypeScript and the full Webpack production build passed. The local workbench returned HTTP 200 with no browser page errors. Mobile at 390 × 844 had no horizontal overflow. Color, component, size, review-state filters, pagination, complete-family CSV export and the preserved final 30 mL approval view were exercised. Customer catalog/configurator release checks were not part of this UI change.
