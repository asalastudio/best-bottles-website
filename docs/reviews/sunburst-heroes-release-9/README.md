# Sunburst heroes — release 9

Eleven heroes rendered by Madison Studio, reviewed and approved by Jordan on
2026-09-19: the first **10 Slim**, and **1 more Cylinder**.

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
sidecar. That is the standing rule for dropper heroes from here on.

The five Slim antique-spray and tassel groups are not in this release; bulb
assemblies are held for the wide canvas.

## Cylinder — one more

`GBCyl100RdcrMtSl` (`cylinder-100ml-clear-18-415-reducer`), 67.5%. Takes Cylinder
to 31 of 52 on Madison-rendered heroes.

## Why these were not in release 8

They were added to the release-8 branch in commit `004e50cb`, but that push
landed after PR #205 had already merged with its original seven. Release 9 is
branched from the merged main and touches only these eleven rows.

## Provenance

All eleven were generated from **flattened Photoshop sources**, tagged
`reference-route:flattened-psd` in Madison and recorded in
`madison-provenance.json`.

## Verification

- `node scripts/publish-sunburst-heroes.mjs release-9` — repointed 11 rows, skipped 0
- `npx vitest run tests/catalog-approved-heroes.test.ts` — 396 passed
- Diff against `main` changes exactly 11 registry rows; the seven release-8
  heroes are untouched.
- **End-to-end mapping audit — 11 of 11.** For every hero: exactly one registry
  row; the card's slug agrees with the SKU on capacity and fitment; the file the
  registry points at hashes to the locked sha; re-deriving the deliverable from
  Madison's stored render for that exact `(graceSku, websiteSku)` pair reproduces
  the same sha; and the closure colour matches the Photoshop source for that SKU.
  The audit was itself tested against a copy with two heroes deliberately
  swapped, and failed both.
- Rollback: `docs/reviews/sunburst-heroes-release-9/registry-rollback.json`

Indexing only — touches no Shopify, Convex or hosted media.
