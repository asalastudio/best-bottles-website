# Sunburst heroes — release 8

Eighteen heroes rendered by Madison Studio, reviewed and approved by Jordan on
2026-09-19, indexed into `src/lib/products/catalog-heroes.json`:
**8 Cylinder** and the first **10 Slim**.

## Slim — a new family on the shoulder lock

Slim is the second family, after Cylinder, to be sized by a locked glass
shoulder. Jordan set one target per glass body by eye, against the Sep 7
Cylinder ladder:

| Glass body | Bare glass | Shoulder lock | Heroes |
|---|---|---|---|
| `slim:30-standard` | 87 mm | 48.5% | lotion pump, perfume spray, reducer, dropper |
| `slim:50-standard` | 121 mm | 54% | lotion pump, perfume spray, reducer |
| `slim:100-standard` | 154 mm | 67.5% | lotion pump, perfume spray, reducer |

Without a lock, identical 50 ml glass rendered anywhere from 55.9% to 65.7% of
canvas — a 17.7% size difference driven only by how tall the closure was. With
it, every hero on a body lands within 0.3 points of the same line.

The Slim 30 ml dropper shows the dropper **seated in the bottle**, not as a
sidecar. That is a standing rule for dropper heroes from here on.

The five Slim antique-spray and tassel groups are not in this release; bulb
assemblies are held for the wide canvas.

## Cylinder — eight more

`LBCyl25LtnMtGl`, `GBCyl50SpryMtGl`, `LBCyl50LtnMtGl`, `GBCyl50RdcrMtSl`,
`GBCyl100SpryMtGl`, `LBCyl100LtnMtGl`, `GBCyl100RdcrMtSl`, `GBTallCyl9MtlRollBlkDot`.
Every shoulder within 0.4 points of its Sep 7 target. Takes Cylinder to 31 of 52.

## What is different about this release

All eighteen were generated from **flattened Photoshop sources** rather than
promoted reference images. For the Cylinder groups, the promoted references were
360×480 thumbnails, under the 0.4 megapixel floor, which is what had held them
on their older heroes. The Photoshop flat is the original those were derived
from. Madison tags every such image `reference-route:flattened-psd`, and
`madison-provenance.json` records the route.

## Verification

- `node scripts/publish-sunburst-heroes.mjs release-8` — repointed 18 rows, skipped 0
- `npx vitest run tests/catalog-approved-heroes.test.ts` — 396 passed
- **End-to-end mapping audit — 18 of 18.** For every hero: exactly one registry
  row; the card's slug agrees with the SKU on capacity and fitment; the file the
  registry points at hashes to the locked sha; re-deriving the deliverable from
  Madison's stored render for that exact `(graceSku, websiteSku)` pair reproduces
  the same sha; and the closure colour matches the Photoshop source for that SKU.
  The audit was itself tested against a copy with two heroes deliberately
  swapped, and failed both.
- Rollback: `docs/reviews/sunburst-heroes-release-8/registry-rollback.json`

Indexing only — touches no Shopify, Convex or hosted media.
