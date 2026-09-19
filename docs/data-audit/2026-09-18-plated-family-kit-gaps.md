# Plated-family kit gaps

18 September 2026. After the 13 Cylinder leftovers, the next wave is already-plated kitable bottles with no kit. Production still has **420 kits, all Cylinder**, and `productKits.integrity` reports **0 issues**.

## Counts

| Wave | Plated, no kit | Cap-off present |
|---|---:|---:|
| Boston Round | 90 | 52 |
| Rectangle | 60 | 58 |
| Tulip | 59 | 59 |
| Elegant | 117 | 117 |
| Circle | 103 | 103 |
| Sleek | 105 | 105 |

Twelve sampled cap-off plates (4 per first-wave family) are **exploded beside-layouts**, not registered cap-removed photographs. Pair-difference cannot reconstruct the assembled plate from those.

## Why this wave is blocked here

Sibling reuse needs at least one published kit per glass family. These families have none. Master PSDs are not on this VM. The reviewed Boston Round 25-SKU kit release from 12 September has part bytes under `dist/paper-doll/boston-kit-release-2026-09-12`, which is gitignored and absent. Approval marked that batch published; production has no Boston kit rows.

## Next sources

1. Mount `BB-PSD-Files-Master` and rebuild from reviewed layer recipes.
2. Restore the Boston kit-release dist folder and re-check current plate hashes before indexing the approved 25.

Ledger: `data/paper-doll/plated-family-kit-gaps.json`.
