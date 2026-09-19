# Sunburst release 6 — Cylinder heroes rendered by Madison Studio

36 Madison renders across two passes on 2026-09-18; 17 indexed here, one per product group,
locked by image hash. Staging preview only until merged.

Sign-off, stated plainly: Jordan approved the first pass (22 heroes) by visual sign-off on
per-body contact sheets. The second pass (14 heroes, the registered variants) was indexed on
Jordan's instruction for the staging demo, with contact sheets sent alongside; their visual
review happens on this preview, before merge.

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

## Why 17 of the 36 are indexed

The registry holds one hero per product group, tied to a specific variant. Madison's first
pass rendered the black-closure variant of each group; for 19 groups the registered hero is
a different closure colour (the 9 ml clear fine-mist card is the gold sprayer,
`GBCyl9SpryGl`). Indexing a black-closure photo onto a gold-closure row would show the wrong
product, so those were not indexed. The second pass rendered the registered variant itself
for the 14 groups Madison could reach. Indexed = 3 first-pass heroes whose SKU is the
registered one + 14 second-pass heroes:

| websiteSku | group | graceSku |
|---|---|---|
| GBCyl50MtlRollBlk | cylinder-50ml-clear-16mm-rollon | GB-CYL-BLK-50ML-MRL-BLK |
| GBCyl5SprySlMatt | cylinder-5ml-clear-13-415-finemist | GB-CYL-CLR-5ML-SPR-MSLV |
| GBCyl5MtlRollBlkDot | cylinder-5ml-clear-13-415-rollon | GB-CYL-CLR-5ML-MRL-BKDT |
| GBCylBlu5SpryGlMatt | cylinder-5ml-cobalt-blue-13-415-finemist | GB-CYL-BLU-5ML-SPR-MGLD |
| GBCylBlu5MtlRollBlkDot | cylinder-5ml-cobalt-blue-13-415-rollon | GB-CYL-BLU-5ML-MRL-BKDT |
| GBCylAmb9SpryMattSl | cylinder-9ml-amber-17-415-finemist | GB-CYL-AMB-9ML-SPR-MSLV |
| LBCylAmb9LtnMtSl | cylinder-9ml-amber-17-415-lotionpump | LB-CYL-AMB-9ML-LPM-MSLV |
| GBCylAmb9MtlRollBlkDot | cylinder-9ml-amber-17-415-rollon | GB-CYL-AMB-9ML-MRL-BKDT |
| GBTallCyl9SpryGlMatt | cylinder-9ml-clear-13-415-finemist | GB-CYL-CLR-9ML-SPR-MGLD |
| GBCyl9SpryGl | cylinder-9ml-clear-17-415-finemist | GB-CYL-CLR-9ML-T-22 |
| LBCyl9LtnGl | cylinder-9ml-clear-17-415-lotionpump | LB-CYL-CLR-9ML-T-02 |
| GBCyl9MtlRollBlkDot | cylinder-9ml-clear-17-415-rollon | GB-CYL-CLR-9ML-T-02 |
| GBCylBlu9SpryMattSl | cylinder-9ml-cobalt-blue-17-415-finemist | GB-CYL-BLU-9ML-SPR-MSLV |
| LBCylBlu9LtnMattSl | cylinder-9ml-cobalt-blue-17-415-lotionpump | LB-CYL-BLU-9ML-LPM-MSLV |
| GBCylBlu9MtlRollBlkDot | cylinder-9ml-cobalt-blue-17-415-rollon | GB-CYL-BLU-9ML-MRL-BKDT |
| GBCylSwrl9SpryMattSl | cylinder-9ml-swirl-17-415-finemist | GB-CYL-CLR-9ML-SPR-MSLV-01 |
| LBCylSwrl9LtnMtSl | cylinder-9ml-swirl-17-415-lotionpump | LB-CYL-CLR-9ML-LPM-MSLV |

Not reached: 100 ml matte-gold sprayer, 50 ml matte-gold sprayer and 50 ml matte-silver
reducer are blocked in Madison on 360 x 480 references; two more registered variants did
not resolve to a Madison job. The six frosted groups and the white 9 ml roll-on were left
out of both passes: Madison's shoulder detector cannot yet find frosted glass on bone, so
those renders would block rather than ship. All of these keep their release-5 heroes.
`approved-lock-all-36.json` holds every render from both passes, including the 19
black-closure heroes that have no slot here.

## Files

- `approved-lock.json` — the 17 indexed heroes (sku → sha256 + source file).
- `approved-lock-all-36.json` — every Madison render from both passes.
- `madison-provenance.json` — per hero: Madison image id and URL, grace SKU, group, hash,
  and the registry URL it replaces.
- `registry-rollback.json` — written by `scripts/publish-sunburst-heroes.mjs release-6`;
  restore each `from` to undo.

Indexed with `node scripts/publish-sunburst-heroes.mjs release-6` in a single run from
`origin/main`'s registry (repointed 17, skipped 0), so the rollback holds every true original.
`tests/catalog-approved-heroes.test.ts`: 396 passed. Touches no Shopify, Convex or hosted
media.
