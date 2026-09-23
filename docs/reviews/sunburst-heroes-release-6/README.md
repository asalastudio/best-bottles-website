# Sunburst release 6 — Cylinder heroes rendered by Madison Studio

39 Madison renders across three passes on 2026-09-18; 20 indexed here, one per product group,
locked by image hash. Staging preview only until merged.

Sign-off, stated plainly: Jordan approved the first pass (22 heroes) by visual sign-off on
per-body contact sheets, and the three frosted heroes of the third pass the same way ("those
are perfect", "lock those 3"). The second pass (14 heroes, the registered variants) was
indexed on Jordan's instruction for the staging demo, with contact sheets sent alongside;
their visual review happens on this preview, before merge.

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

## Why 20 of the 39 are indexed

The registry holds one hero per product group, tied to a specific variant. Madison's first
pass rendered the black-closure variant of each group; for 19 groups the registered hero is
a different closure colour (the 9 ml clear fine-mist card is the gold sprayer,
`GBCyl9SpryGl`). Indexing a black-closure photo onto a gold-closure row would show the wrong
product, so those were not indexed. The second and third passes rendered the registered
variant itself. Indexed = 3 first-pass heroes whose SKU is the registered one + 14
second-pass heroes + 3 frosted heroes:

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
| GBCylFrst9SpryMattSl | cylinder-9ml-frosted-17-415-finemist | GB-CYL-FRS-9ML-SPR-MSLV |
| LBCylFrst9LtnMtSl | cylinder-9ml-frosted-17-415-lotionpump | LB-CYL-FRS-9ML-LPM-MSLV |
| GBCylFrst9MtlRollBlkDot | cylinder-9ml-frosted-17-415-rollon | GB-CYL-FRS-9ML-MRL-BKDT |
| GBCylSwrl9SpryMattSl | cylinder-9ml-swirl-17-415-finemist | GB-CYL-CLR-9ML-SPR-MSLV-01 |
| LBCylSwrl9LtnMtSl | cylinder-9ml-swirl-17-415-lotionpump | LB-CYL-CLR-9ML-LPM-MSLV |

Frosted: Madison's shoulder detector could not size frosted glass until 2026-09-18. Frosted
glass has no dark rim, so its only wall edge sits on the bottle's bounds line, where the wall
search never looked. With that fixed, the three standard 9 ml frosted heroes render on the
43.5 % line at glass widths within 2.2 % of each other.

Not reached, and unchanged from release 5: the three tall 9 ml frosted groups (the model
draws the slim tall vial 22-30 % too fat, so Madison's proportion check refuses the render;
one of the three also has no Madison job), three registered variants blocked on 360 x 480
references (100 ml and 50 ml matte-gold sprayers, 50 ml matte-silver reducer), and two that
did not resolve to a Madison job. `approved-lock-all-39.json` holds every render from all
passes, including the 19 black-closure heroes that have no slot here.

Naming note: Madison lists a group slugged `cylinder-9ml-white-17-415-rollon`. There is no
white glass in the catalog. Jordan confirmed 2026-09-18 that it is swirl glass with a white
cap (website SKUs `GBCylSwrl9MtlRollWht`, `GBCylSwrl9RollWht`); the slug and the Convex
colour "White" carry the cap colour by mistake. It has no registry row, so nothing here
depends on it.

## Files

- `approved-lock.json` — the 20 indexed heroes (sku → sha256 + source file).
- `approved-lock-all-39.json` — every Madison render from all three passes.
- `madison-provenance.json` — per hero: Madison image id and URL, grace SKU, group, hash,
  and the registry URL it replaces.
- `registry-rollback.json` — written by `scripts/publish-sunburst-heroes.mjs release-6`;
  restore each `from` to undo.

Indexed with `node scripts/publish-sunburst-heroes.mjs release-6` in a single run from
`origin/main`'s registry (repointed 20, skipped 0), so the rollback holds every true original.
`tests/catalog-approved-heroes.test.ts`: 396 passed. Touches no Shopify, Convex or hosted
media.
