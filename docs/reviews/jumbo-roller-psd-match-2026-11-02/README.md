# PSD-matched jumbo roller balls

The 28 ml and 50 ml / 16 mm metal and plastic rollers now reuse the original Photoshop ball artwork. Ball shape, exposed height and photographic reflections come from the original layers. No new sphere was generated or relit. This correction replaces only the two earlier generated roller candidates, which remain preserved.

Review: http://localhost:3010/reviews/jumbo-roller-psd-match-2026-11-02/index.html

The source metal ball is darker than the generated version. Its appearance is retained to match the PSD reference. The plastic ball retains the original softer dome. Both materials use uniform component scaling across the two bottle sizes. The housing rests over the rim with an internal seating track and no projecting lower plug.

`source-registration.json` records the PSD layer hashes and native offsets. The source PNGs are embedded unchanged in SVG layer compositions. A display clip hides detached cutout debris and source glass below the flange. It does not repaint or recolor the ball. The original PSD files and exported layers remain untouched.

Validation:

- 13,268 fully opaque native ball pixels compared with zero changed values in the source composition.
- Eight exact roller recipes updated. Every body, cap, anchor, canvas scale and painted body position is unchanged. The other 101 remaining-set recipes are identical to the preceding snapshot.
- All 109 registration/source checks pass. Desktop and mobile checks pass for all 48 jumbo PDP states across cap on, cap off and exploded.
- The two roller delivery masters are lossless WebP files of 21,776 and 22,232 bytes. All 68 family display encodes preserve alpha and visible colors against their resized references.
- Typecheck and scoped review-tool lint pass. No application rendering logic changed in this correction.

The original PSDs identify the ball artwork. Flange width and cap height registration remain estimates from those source images and the existing bottle dimensions, not new hardware caliper measurements.

The existing catalog-only policy for these jumbo products remains intact. No 25 ml roller is introduced. This set is local review artwork, not a production release or a new appearance approval. The approved hosted manifest is unchanged. The separate whole-ledger build still stops at the pre-existing `GBCyl5BlkShSht` catalog-identity guard; that guard was not bypassed.

Rebuild with the existing dependencies:

```sh
node docs/reviews/jumbo-roller-psd-match-2026-11-02/prepare-native.mjs
node --import tsx docs/reviews/cylinder-family-completion-2026-11-02/register-rollers.mts
node --import tsx docs/reviews/cylinder-family-completion-2026-11-02/prepare.mts
node docs/reviews/cylinder-family-completion-2026-11-02/build-display.mjs
node --import tsx docs/reviews/jumbo-roller-psd-match-2026-11-02/verify-and-review.mts
node docs/reviews/jumbo-roller-psd-match-2026-11-02/verify-browser.cjs
```

The Drive archive holds the source PNGs, native SVGs, reusable PNG/WebP masters, before/current recipes, verification reports, scripts and screenshots. Earlier assets are retained as superseded candidates. Only required development and runtime copies remain local; no image binaries are added to Git.
