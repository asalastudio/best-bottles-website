# Catalog kit completion inventory

This inventory separates component-kit readiness from media coverage. It does not publish catalog data.

## Exact plate and kit ledger

The current exact-plate inventory contains 1,876 rows:

| Kit state | Rows | Meaning |
| --- | ---: | --- |
| Kit complete | 420 | Already indexed in Convex and verified against the current plate hash. |
| Kit candidate | 411 | Deterministic local candidate ready for visual approval. |
| Kit not applicable | 118 | Component-only or confirmed standalone product. |
| Held with reason | 927 | A named source, identity, geometry, or layer-mapping issue prevents a safe kit. |
| Pending build | 0 | Every exact-plate row has a terminal classification. |

The 411 candidates are grouped in the preserved local review collection `catalog-kit-candidates-2026-09-08-r7`:

| Family | Candidates |
| --- | ---: |
| Elegant | 83 |
| Circle | 77 |
| Sleek | 50 |
| Boston Round | 25 |
| Grace | 25 |
| Diva | 25 |
| Empire | 21 |
| Round | 21 |
| Square | 19 |
| Slim | 18 |
| Royal | 16 |
| Tulip | 14 |
| Rectangle | 9 |
| Flair | 8 |

The review collection preserves the 91% baseline, height grid, source comparison, notes, approval controls, and family filtering. Candidate approval remains a required gate before publication.

The 202 unresolved rows encountered in the current mapped-family batches are
isolated in `catalog-kit-needs-review-2026-09-08-r5`. That collection
shows the capped source plate, uncapped source plate when available, family
contact sheet, and the exact reason each row remains held. These rows are not
mixed into the approval-ready queue.

| Family | Remediation review rows |
| --- | ---: |
| Boston Round | 50 |
| Rectangle | 43 |
| Tulip | 28 |
| Circle | 19 |
| Elegant | 19 |
| Flair | 13 |
| Round | 11 |
| Empire | 6 |
| Grace | 6 |
| Royal | 5 |
| Slim | 1 |
| Square | 1 |

## Non-plated product reconciliation

All 660 website SKUs without a direct exact-plate row were matched to the live media audit. See `non-plated-media-reconciliation.md` for the summary and `non-plated-media-reconciliation.csv` for the row-level evidence.

## Files

- `kit-completion-ledger.csv`: one terminal kit state for every exact plate row.
- `data/paper-doll/catalog-master-kit-candidates-addendum-2026-09-08.json`: source-backed candidate additions from Sleek, Round, Elegant, Circle, Diva, Empire, Slim, Grace, Boston Round, Rectangle, Tulip, Flair, Royal, and Square.
- `data/paper-doll/catalog-master-kit-remediation-addendum-2026-09-08.json`: the current 202-row remediation review with exact blockers.
- `non-plated-media-reconciliation.csv`: one live media status and next action for every non-plated SKU.
- `non-plated-media-reconciliation.md`: concise reconciliation report.
