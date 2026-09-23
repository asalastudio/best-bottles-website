# Sunburst heroes — release 8

Seven Cylinder heroes rendered by Madison Studio, reviewed and approved by Jordan
on 2026-09-19, indexed into `src/lib/products/catalog-heroes.json`.

| Product group | Website SKU | Shoulder lock |
|---|---|---|
| `cylinder-25ml-clear-18-415-lotionpump` | `LBCyl25LtnMtGl` | 46.5% |
| `cylinder-50ml-clear-18-415-perfumespray` | `GBCyl50SpryMtGl` | 56% |
| `cylinder-50ml-clear-18-415-lotionpump` | `LBCyl50LtnMtGl` | 56% |
| `cylinder-50ml-clear-18-415-reducer` | `GBCyl50RdcrMtSl` | 56% |
| `cylinder-100ml-clear-18-415-perfumespray` | `GBCyl100SpryMtGl` | 67.5% |
| `cylinder-100ml-clear-18-415-lotionpump` | `LBCyl100LtnMtGl` | 67.5% |
| `cylinder-9ml-clear-13-415-rollon` | `GBTallCyl9MtlRollBlkDot` | 62.5% |

All seven: 1560×1716, Bone `#F5F3EF` corners, `shoulder-lock-2026-09-07`,
`openai-image-2.5-sunburst`, zero QA issues. Independently re-measured after
generation, every shoulder sits within 0.4 points of its locked target.

## What is different about this release

These are the first Cylinder heroes generated from **flattened Photoshop
sources** rather than from promoted reference images. Their promoted references
were 360×480 thumbnails, below the 0.4 megapixel floor, which is what had kept
these groups on their older heroes. The Photoshop flat is the original the
thumbnail was derived from, at 1400 px wide.

Madison tags every such image `reference-route:flattened-psd`, and
`madison-provenance.json` records the route, so the provenance of these seven is
never confused with a promoted reference.

## Verification

- `node scripts/publish-sunburst-heroes.mjs release-8` — repointed 7 rows, skipped 0
- `npx vitest run tests/catalog-approved-heroes.test.ts` — 396 passed
- Rollback: `docs/reviews/sunburst-heroes-release-8/registry-rollback.json`

Indexing only — touches no Shopify, Convex or hosted media.
