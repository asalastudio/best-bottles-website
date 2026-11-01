# 5 ml cobalt material, using the approved 9 ml reference

The user explicitly selected the approved 9 ml cobalt as the material model. This batch applies its deeper cobalt tone and broader studio reflections to the existing 5 ml body, without adopting the taller 9 ml shape.

## Source and registration

- Target: `public/local-kits/gpt-13-415-2026-10-31/cylinder5-cobalt-candidate-v3.c51b7b6df61f.png`.
- Material reference: `public/local-kits/cylinder9-masters-2026-11-01/body-cobalt.9499ee157608.png`.
- Method: one built-in GPT image edit. The exact model version is not exposed; this is not a claim of Sunburst or Blender output.
- Native output: `generated-cobalt.png`, 914 × 1721 with alpha. The unmodified native output is also preserved beside the runtime master.
- Before registration, silhouette IoU was 99.06%, opaque area changed by 0.237%, width by 0.181%, and height was unchanged. Native bounds shifted 1.5 px in center and 2 px vertically. The SVG envelope translates by −1.5/−2 px to keep the center, rim and base registered. It does not stretch, recolor, warp or re-mask the generated image.
- Canvas frame, body box, glass sizing, seat anchors and component positions are unchanged. This is close visual geometry preservation, not pixel-identical generation or manufacturing certification. The existing 5 ml candidates remain review artwork; older measured sources remain preserved.

## Shared source

`public/local-kits/cylinder5-masters-2026-11-01/kits.json` combines the previous 71 configurations with the verified sprayer update. All 35 cobalt configurations use one body asset: 10 pour, nine metal roller, nine plastic roller and seven sprayer combinations. All 36 clear configurations are unchanged from the sprayer checkpoint.

Normal local product pages, catalog cards, the builder and old `assetPreview=gpt13` bookmarks resolve the same current 5 ml kit. Other families keep their existing explicit pilot behavior. The source is disabled on Vercel and is not a live-store publication.

## Review

Interactive product pages and before/after comparisons: `/reviews/cylinder5-finemist-2026-11-01/index.html?glass=Cobalt+Blue&finish=Matte+Gold`.

`before-kits.json`, `prompt.txt`, `generated-cobalt.png`, `geometry-check.json`, `manifest.json`, and the reproducible `build.mjs` preserve source lineage. Browser evidence is in `evidence/`. The parent sprayer checkpoint is commit `9138130a`.

The final sprayer seating was subsequently adjusted to the user's photographs, including the thin neck exposure and proportioned overcap. See `../cylinder5-finemist-2026-11-01/shoulder-seat-v2/`.

No merge, deployment, production data change or approved Drive-master replacement was performed. This new material version is ready for visual review.

## Verification

- 210 cobalt PDP states (35 configurations, three views, desktop/mobile) passed after three automated timeouts were retried successfully. The first attempt remains in `evidence/browser-first-attempt.json`.
- All 35 cobalt builder selections passed. The builder API matched the complete 71-kit source.
- Catalog finish switching passed for 30 visible choices across clear/cobalt sprayer, pour and roller cards. Hidden overflow choices were not individually clicked in this catalog pass.
- After final seating changes, all 15 sprayer configurations passed 90 states after one automated timeout was retried; the configurations were checked in all three views and both viewport sizes, and their builder selections were rechecked separately. See the seating revision evidence.
- 54 targeted unit tests and 29 catalog-specific tests passed. TypeScript typecheck passed. No merge-readiness or new full-suite claim is made.
