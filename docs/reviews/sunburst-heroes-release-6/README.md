# Sunburst release 6 — Cylinder heroes rendered by Madison Studio

Approved by Jordan 2026-09-18 (visual sign-off on per-body contact sheets, locked by image hash).
22 heroes approved; 3 indexed here. Staging preview only until merged.

## What this is

The first Cylinder heroes produced end to end by the Madison Studio pipeline rather than
the website-side geometry base used for release 5. Same model (`gpt-image-2.5-sunburst`),
same canvas (2080 × 2288 down to 1560 × 1716, an exact 0.75×), same sizing authority: the
glass-shoulder heights Jordan locked per physical body on 2026-09-07, foot on the 91 %
baseline. Nothing here re-derives those numbers.

## How each hero was sized

Madison's rig seats every render on its body's locked shoulder line and refuses to ship
one it cannot verify:

1. The shoulder landmark is the glass edge right before the straight wall starts: going up
   from the wall, the first sustained ~8 % narrowing of the glass, or the closure's bottom
   edge when a body-width cap or collar hides the shoulder. On tight-cornered bodies these
   are 1–3 px apart; on the sloped 5 ml body the lock sits near the bottom of the slope.
2. Each locked body also carries its foot-to-shoulder ÷ outer-width proportions, measured
   on the 52 locked Sep 7 heroes. A landmark more than 15 % off those proportions is
   rejected, so a wrong landmark blocks the render instead of scaling it confidently.
3. Checked independently of that logic: the closure edge sits 0–7 px from the lock line on
   clear collared bottles, and the same glass renders at the same size across roll-on,
   sprayer and pump.

## Why only 3 of the 22 are indexed

The registry holds one hero per product group, tied to a specific variant. Madison's run
rendered the black-closure variant of each group; for 19 groups the registered hero is a
different closure colour (for example the 9 ml clear fine-mist card is the gold sprayer,
`GBCyl9SpryGl`). Indexing a black-closure photo onto a gold-closure row would show the
wrong product, so those 19 are held in `approved-lock-all-22.json` and not indexed.
`approved-lock.json` is the 3 whose rendered SKU is the registered hero SKU:

| websiteSku | group |
|---|---|
| GBCylAmb9MtlRollBlkDot | cylinder-9ml-amber-17-415-rollon |
| GBCylBlu9MtlRollBlkDot | cylinder-9ml-cobalt-blue-17-415-rollon |
| GBCyl50MtlRollBlk | cylinder-50ml-clear-16mm-rollon |

Follow-up: render the registered hero variant for the remaining groups. Madison can do 14
today; 3 are blocked on 360 × 480 references (100 ml matte-gold sprayer, 50 ml matte-gold
sprayer, 50 ml matte-silver reducer).

## Files

- `approved-lock.json` — the 3 indexed heroes (sku → sha256 + source file).
- `approved-lock-all-22.json` — everything Jordan approved in this pass.
- `madison-provenance.json` — per hero: Madison image id and URL, grace SKU, group, hash,
  and the registry URL it replaces.
- `registry-rollback.json` — written by `scripts/publish-sunburst-heroes.mjs release-6`;
  restore each `from` to undo.

Indexed with `node scripts/publish-sunburst-heroes.mjs release-6` (repointed 3, skipped 0).
`tests/catalog-approved-heroes.test.ts`: 396 passed. Touches no Shopify, Convex or hosted
media.
