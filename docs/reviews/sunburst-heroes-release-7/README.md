# Sunburst heroes — release 7

Three Cylinder heroes rendered by Madison Studio, indexed into
`src/lib/products/catalog-heroes.json`.

| Product group | Website SKU | Note |
|---|---|---|
| `cylinder-28ml-clear-16mm-rollon` | `GBMtlRoll28Blk` | rendered 2026-09-19 00:08 UTC |
| `cylinder-9ml-swirl-17-415-rollon` | `GBCylSwrl9MtlRollBlkDot` | rendered 2026-09-19 00:10 UTC — swirl glass, black dotted cap |
| `cylinder-9ml-frosted-13-415-finemist` | `GBTallCylFrst9SpryGlMatt` | rendered 2026-09-19 05:16 UTC, first render on the slender-vial prompt fix |

All three: 1560×1716, Bone `#F5F3EF` corners, `shoulder-lock-2026-09-07`,
`openai-image-2.5-sunburst`, shoulder delta 0.0%, shoulder confidence 1.0,
zero QA issues.

## Why these three were held back

The first two rendered cleanly on 2026-09-19 but were reported as QA failures.
They were not. Madison's `link_best_bottles_generated_image` guard required
`framing_decision = 'pass'`, a value the shoulder-lock rig cannot produce:
`framing_decision` is derived from the pre-transform framing report and is
forced to `normalize` whenever `physicalScale.verdict` is `unverified`, which
is every Cylinder row since the shoulder lock became the scale authority. The
release-6 heroes bypassed that guard only because their jobs were already
`synced`. Fixed Madison-side.

The third bottle (9 ml tall, 5.326:1) had come back 8–10% too wide across four
earlier attempts. Cause: the edge function replaces the client's framing-profile
block with its own imposed-rig block, so the client-side proportion lock never
reached the model — what did reach it was "fill must dominate the canvas" beside
a shoulder lock that pins the height, leaving width as the only free dimension.
The rig block now states the on-canvas glass width outright (268px, 12.9% of
canvas width) and asks for vertical fill only. Measured result: 268px.

## Verification

- `node scripts/publish-sunburst-heroes.mjs release-7` — repointed 3 rows, skipped 0
- `npx vitest run tests/catalog-approved-heroes.test.ts` — 396 passed
- Rollback: `docs/reviews/sunburst-heroes-release-7/registry-rollback.json`

Indexing only — touches no Shopify, Convex or hosted media.
