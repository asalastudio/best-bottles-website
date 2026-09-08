# Catalog kit completion inventory

This inventory separates component-kit readiness from media coverage. It does not publish catalog data.

## Exact plate and kit ledger

The current exact-plate inventory contains 1,876 rows:

| Kit state | Rows | Meaning |
| --- | ---: | --- |
| Kit complete | 420 | Already indexed in Convex and verified against the current plate hash. |
| Kit candidate | 320 | Deterministic local candidate ready for visual approval. |
| Kit not applicable | 118 | Component-only or confirmed standalone product. |
| Held with reason | 1,018 | A named source, identity, geometry, or layer-mapping issue prevents a safe kit. |
| Pending build | 0 | Every exact-plate row has a terminal classification. |

The 320 candidates are grouped in the preserved local review collection `catalog-kit-candidates-2026-09-08-r5`:

| Family | Candidates |
| --- | ---: |
| Round | 21 |
| Elegant | 83 |
| Circle | 77 |
| Diva | 25 |
| Empire | 21 |
| Sleek | 50 |
| Slim | 18 |
| Grace | 25 |

The review collection preserves the 91% baseline, height grid, source comparison, notes, approval controls, and family filtering. Candidate approval remains a required gate before publication.

The 62 unresolved rows encountered in the current mapped-family batches are
isolated in `catalog-kit-needs-review-2026-09-08-r3`. That collection
shows the capped source plate, uncapped source plate when available, family
contact sheet, and the exact reason each row remains held. These rows are not
mixed into the approval-ready queue.

| Family | Remediation review rows |
| --- | ---: |
| Round | 11 |
| Elegant | 19 |
| Circle | 19 |
| Empire | 6 |
| Grace | 6 |
| Slim | 1 |

## Non-plated product reconciliation

All 660 website SKUs without a direct exact-plate row were matched to the live media audit. See `non-plated-media-reconciliation.md` for the summary and `non-plated-media-reconciliation.csv` for the row-level evidence.

## Files

- `kit-completion-ledger.csv`: one terminal kit state for every exact plate row.
- `data/paper-doll/catalog-master-kit-candidates-addendum-2026-09-08.json`: source-backed candidate additions from Sleek, Round, Elegant, Circle, Diva, Empire, Slim, and Grace.
- `data/paper-doll/catalog-master-kit-remediation-addendum-2026-09-08.json`: the current 62-row remediation review with exact blockers.
- `non-plated-media-reconciliation.csv`: one live media status and next action for every non-plated SKU.
- `non-plated-media-reconciliation.md`: concise reconciliation report.
