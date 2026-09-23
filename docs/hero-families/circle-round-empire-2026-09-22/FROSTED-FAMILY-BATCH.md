# Frosted Circle and Round: 21-image review batch

Generated and aligned on 2026-09-22: 11 frosted Circle heroes (six 50 mL, five 100 mL) and 10 frosted Round heroes (five 78 mL, five 128 mL). This includes native-resolution replacements for both approved material pilot previews. The complete clear-and-frosted families are not yet released.

Jordan approved the material pilots, completion of this batch and use of the existing Sunburst renderer for the exact native canvas. There were 21 successful generation calls. Each native PNG and aligned export is 2080 × 2288. Inputs were the preserved framed hero, its exact canonical master PSD composite and the newer user-supplied frosted reference. Input, master, native-output and final-output SHA-256 hashes are recorded per SKU. No credentials are included.

## Locks and presentation

| Body | Glass span upward from base | Cap/glass junction from top | Glass foot |
| --- | ---: | ---: | ---: |
| Circle 50 mL | 54% | 37% | 91% |
| Circle 100 mL | 58% | 33% | 91% |
| Round 78 mL | 48% | 43% | 91% |
| Round 128 mL | 54% | 37% | 91% |

Sprayers and lotion pumps have exposed actuators and sidecar caps. Reducers, droppers, bulbs and tassels retain their assembled presentation. Actual glass feet are measured separately from shadows and tassels. Component identity and cap state were checked against each catalog record and master composite.

Native seat and foot coordinates were visually inspected in full-resolution crops. Registration uses only uniform scaling and translation of the complete image, preserving component proportions and the generated shadows. Scale changes range from −0.12% to +1.88%. The final PNG pixels were remeasured: all 21 seats and feet lie within 1 pixel of their specified targets. Landmark identification itself has approximately ±4 px visual uncertainty. Mid-body width screening showed less than 2% normalized change after resolving one false edge detection in the leather-capped Circle. This screen and visual review do not establish exact 3D dimensional equivalence.

## Deliverables

Native renders, aligned PNGs, prompts, master composites and material reference are preserved under `output/imagegen/frosted-circle-round-family/`. `manifest.json` links every SKU to its source, input hashes, prompt, render and export. `aligned-exports.json` records the complete final transforms and hashes. QA evidence includes `verified-native-landmarks.json`, `profile-screening-reviewed.json`, `final-pixel-checks.json`, detailed native crops and browser verification.

- `Circle-final-guided.jpg`: 11 Circle heroes with target guides.
- `Round-final-guided.jpg`: 10 Round heroes with target guides.
- Corresponding `*-final-clean.jpg` files omit guides.
- `material-before-after.jpg`: same-canvas comparison for both material pilot identities.
- Local review: `http://localhost:3052/frosted-family/circle.html` and `http://localhost:3052/frosted-family/round.html`.

## Reproduction and release state

`python3 scripts/hero-families/render-frosted-circle-round.py` validates the 21-record manifest without generation. `--execute --sku <exact SKU>` invokes the existing `scripts/hero-empire/sunburst.py` helper; existing outputs are preserved. Supply the existing project environment privately and retain SSL verification. The exact native renderer was explicitly authorized after the bundled CLI could not request this Sunburst size.

`node scripts/hero-families/align-frosted-circle-round.cjs` reproduces the aligned exports and sheets from the preserved native PNGs and visually checked landmarks. Reproduction should use the recorded dependency environment; any changed output hash returns to review. Supporting measurement and verification scripts are preserved in the output's `qa-scripts/` folder.

The new final bytes await user batch review. No media registry, backend, staging site or published images were changed. No commit or PR was made for this batch. Original source files and unrelated work remain untouched. The outstanding clear-glass alignment work and two held clear tassel compositions remain separate from these 21 frosted exports.

Browser checks passed for all 21 image files on 390 px mobile and 1440 px desktop: HTTP 200, native image dimensions decoded, no horizontal overflow and no page errors.

## Post-batch recount

Required plate measurement and ledger build passed. All 2,286 plate measurements completed with zero fetch or measurement failures. Backend/index counts were unchanged; the only movement is 21 new local aligned candidates awaiting review. Full state counts are in `frosted-postbatch-recount.json`.

| Measure | Circle before → after | Round before → after |
| --- | ---: | ---: |
| Catalog SKUs | 209 → 209 | 186 → 186 |
| Product groups | 27 → 27 | 21 → 21 |
| Approved complete plates | 38 → 38 | 18 → 18 |
| Groups with indexed hero | 27 → 27 | 21 → 21 |
| Complete indexed Sunburst groups | 27 → 27 | 0 → 0 |
| Live kits | 109 → 109 | 104 → 104 |
| Kit candidates / holds | 57 / 21 → 57 / 21 | 0 / 22 → 0 / 22 |
| Local aligned frosted candidates | 0 → 11 | 0 → 10 |

The old Circle indexed group count does not approve this new material revision. Round's older indexed heroes are not counted by the ledger as completed Sunburst groups. Generated snapshots were preserved under output audit; original tracked ledger files were restored.
