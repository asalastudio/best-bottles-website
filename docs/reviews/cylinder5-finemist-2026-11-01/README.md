# 5 ml Cylinder fine-mist sprayer checkpoint

Local review, November 1, 2026. Fifteen existing configurations: eight clear and seven cobalt. No cobalt matte-black SKU was invented.

## Changes

- Preserved the existing 13-415 Photoshop sprayer and overcap artwork at its original uniform scale. Source URLs, bytes and hashes are retained in `source-inventory.json` and `sources/`.
- Registered the visible silhouette of each finish to a shared center and shoulder seat. SVG display clips exclude disconnected alpha specks; embedded source PNG pixels are unchanged.
- Reused the approved GPT mechanism/tube, shortening the shaft while preserving its width. The 1.1 mm shaft is a visual sizing assumption, not a newly measured pump specification. The tip sits 0.9 mm above the inner floor inferred from the user's 53.23 mm height and 48.80 mm depth.
- Clear glass shows one tube at reduced opacity. Cobalt hides the tube until exploded. Tube and sprayer move as one assembly.
- Preserved both current body candidates, every body box, glass sizing and anchor. The old 71-SKU library and older measured masters remain intact. This does not change the approval status of the existing body candidates.
- Both PDP and builder consume the shared local source. The builder request includes a media revision to avoid stale cached kits. Hosted production is excluded by the existing local-review guard.

## Verification

- 90 PDP states: 15 SKUs × three views × desktop/mobile. No crop, horizontal overflow, body movement, missing image or detached tube was detected.
- 15 exact-SKU builder selections and 15 API layer/anchor comparisons passed.
- 45 focused tests passed; a subsequent cache-test rerun passed after correcting its mock type. TypeScript typecheck passed.
- Clear/cobalt matte-gold sidecar, capped and exploded captures were inspected visually. Every finish has desktop/mobile stage captures in `evidence/screenshots/`.
- Before/after images and actual interactive pages: `/reviews/cylinder5-finemist-2026-11-01/index.html`.

## Files and limits

`before-kits.json` and the six before captures preserve the prior state. `build.mjs`, `prepare-hardware.py` and `tube-reference-layer.mjs` reproduce the review outputs from their saved sources. Runtime assets live in `public/local-kits/cylinder5-finemist-2026-11-01/`.

The clear tube is a 2D overlay, not physically ray-traced refraction. Its visual diameter and mechanism still require comparison with a physical 13-415 sprayer. No database, production asset, live store or deployment was changed.
