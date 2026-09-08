# Catalog kit completion inventory

This inventory separates component-kit readiness from media coverage. It does not publish catalog data.

## Exact plate and kit ledger

The current exact-plate inventory contains 1,876 rows:

| Kit state | Rows | Meaning |
| --- | ---: | --- |
| Kit complete | 420 | Already indexed in Convex and verified against the current plate hash. |
| Kit candidate | 162 | Deterministic local candidate ready for visual approval. |
| Kit not applicable | 118 | Component-only or confirmed standalone product. |
| Held with reason | 1,176 | A named source, identity, geometry, or layer-mapping issue prevents a safe kit. |
| Pending build | 0 | Every exact-plate row has a terminal classification. |

The 162 candidates are grouped in the local review collection `catalog-kit-candidates-2026-09-08`:

| Family | Candidates |
| --- | ---: |
| Round | 12 |
| Elegant | 67 |
| Circle | 40 |
| Diva | 24 |
| Empire | 19 |

The review collection preserves the 91% baseline, height grid, source comparison, notes, approval controls, and family filtering. Candidate approval remains a required gate before publication.

## Non-plated product reconciliation

All 660 website SKUs without a direct exact-plate row were matched to the live media audit. See `non-plated-media-reconciliation.md` for the summary and `non-plated-media-reconciliation.csv` for the row-level evidence.

## Files

- `kit-completion-ledger.csv`: one terminal kit state for every exact plate row.
- `non-plated-media-reconciliation.csv`: one live media status and next action for every non-plated SKU.
- `non-plated-media-reconciliation.md`: concise reconciliation report.
