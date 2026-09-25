# Grace, Royal, Flair, and Decorative catalog images (2026-09-25)

Jordan approved 14 Sunburst heroes on 2026-09-25 after reviewing the contact sheets. This folder is the release record. The sheets were made before approval, so their headers still say "review candidates, NOT approved". The approval covers only the SKUs listed below, as round-1 fitted files.

## Released (14)

| Family | SKU | Production group | Glass mm | Landmark | Target % (measured) | IoU | Edge p99 (px) |
|---|---|---|---:|---|---|---:|---:|
| Grace | GBGrce55SpryMtGl | grace-55ml-clear-18-415-perfumespray | 113 | shoulder | 56.59 (56.599) | 0.9958 | 3.39 |
| Grace | LBGrce55LtnMtGl | grace-55ml-clear-18-415-lotionpump | 113 | shoulder | 56.59 (56.588) | 0.9952 | 2.79 |
| Grace | GBGrce55RdcrMtSl | grace-55ml-clear-18-415-reducer | 113 | shoulder | 56.59 (56.597) | 0.9972 | 3.05 |
| Grace | GBGrce55AnSpMtSl | grace-55ml-clear-18-415-antiquespray | 113 | shoulder | 56.59 (56.589) | 0.9957 | 3.38 |
| Royal | GBRoyal13SpryGlMatt | royal-13ml-clear-13-415-finemist | 56 | shoulder | 37.48 (37.481) | 0.9955 | 3.23 |
| Flair | GBFlair15Gl | flair-15ml-clear-13-415 | 56 | shoulder | 37.48 (37.479) | 0.9950 | 3.52 |
| Flair | GBFlair15SpryGlMatt | flair-15ml-clear-13-415-finemist | 56 | shoulder | 37.48 (37.492) | 0.9953 | 3.39 |
| Flair | GBFlair15MtlRollBlkDot | flair-15ml-clear-13-415-rollon | 56 | shoulder | 37.48 (37.482) | 0.9959 | 2.68 |
| Decorative | GB6TPlGl | tola-6ml-clear-14.3mm | 48 | closure seat | 34.24 (34.228) | 0.9959 | 3.48 |
| Decorative | GBMtlMrblSmall | marble-5ml-clear-17.52mm | 66 | closure seat | 41.28 (41.266) | 0.9969 | 2.60 |
| Decorative | GBMtlMrblLarge | marble-10ml-clear-17.52mm | 80 | closure seat | 46.21 (46.213) | 0.9959 | 2.42 |
| Decorative | GBEternalFlameClear | eternal-flame-35ml-clear-Ground | 44 | closure seat | 32.54 (32.535) | 0.9966 | 3.11 |
| Decorative | GBEternalFlameBlue | eternal-flame-35ml-cobalt-blue-Ground | 44 | closure seat | 32.54 (32.531) | 0.9963 | 1.73 |
| Decorative | GB1ozGenieCl | genie-32ml-clear-Ground | 77 | closure seat | 45.18 (45.184) | 0.9955 | 2.45 |

Each SKU was checked against production Convex (`precise-raccoon-123`, `products:searchCatalog`, exact websiteSku search). In each case the SKU is a variant of exactly the group shown, with the same graceSku and Shopify variant ID as `catalog-heroes.json`. The release script repeats this read-only check every time it runs.

## Sizing

- Approved by Jordan 2026-09-25.
- Every hero sits on one scale: target % = **3.5314 · mm^0.5868**. The mm value is the bare-glass height (heightWithoutCap, foot to rim). This curve is the least-squares best fit over the five approved locks: Diva 100, Elegant 100, Cylinder 50, Cylinder 5 and Elegant 15.
- The glass foot sits at **91 %** (y = 2082 of 2288).
- The target % is the span from the landmark to the foot.
  - **Shouldered bottles** (Grace, Royal, Flair) use the glass shoulder, where the neck meets the body.
  - **Shoulderless bottles** use the **closure seat**: where the fitted closure or stopper meets the glass. That is the top of the glass lip for ground stoppers (Eternal Flame, Genie), the neck base under the cap for Tola, and the top of the shell's top plate for Marble.
- The fitted 2080 × 2288 canvas already holds the approved card framing. Registry framing is therefore identity (`scale 1`, no translation), the same as the remaining-42 release.

## QA gate

- The gate is IoU ≥ 0.995 **and** a smoothed edge p99 ≤ 4 px. Both are measured against the master-PSD input silhouette. The lane's own validation shows that a stricter per-point max ≤ 4 px is below the method's resolution.
- A by-eye check was also required. It covers:
  - a single contact shadow with its cast toward 2 o'clock
  - the stopper is seated
  - glass colour and metal-shell material are kept
- Every released SKU passes the gate. Full QA, fit, input/PSD hashes and every attempt are in `approval.json` (`rows[].laneRecord`).

## Export

- Each approved fitted PNG is resized once, uniformly, from 2080 × 2288 to 1560 × 1716 (Lanczos3).
- It is then encoded as lossless WebP and decoded again to confirm pixel equality.
- Files are content-addressed under `public/images/catalog/next-batch-approved-2026-09-25/`.
- The native PNGs total 49,462,531 bytes; the WebPs total 26,890,102 bytes.
- `scripts/hero-families/release-next-batch.cjs <lane>` rebuilds everything. It refuses any fitted or raw render whose sha256 differs from the approved hash. It also refuses any lane record that no longer selects the approved attempt, and any production group mismatch.
- The generated bone background is kept; a pixel-exact background is not claimed.

## Held (not in this release)

- **Six QA near-misses, being re-rendered:**
  - GBGrce55AnSpTslMtSl: the tassel strands are redrawn.
  - GBRoyal13Gl and GBRoyal13MtlRollBlkDot: the right side of the square body is 5–8 px off.
  - GB3TPlGl: the cap outline, partly caused by a sliver in the PSD alpha.
  - GBEternalFlameGreen: one detector point at the corner where the dome meets the foot.
  - GBCB12ozPear: the foot flare and stopper rim are 4–8 px off.
- **GBHeartFrst4KeyGld and GBHeartFrst4TslRed:** being re-posed. The master assembly holds the keychain and tassel in mid-air, and the frosted renders have no contact shadow.
- **Blocked on data, so not rendered:**
  - Lotion (LB1ozGl, LB1ozSl, LB3mlClear): glass heights are unknown.
  - GBMtlCylGl: the Royal 14 ml height is disputed.
  - GB1ozGenieBl: the cobalt and aqua master PSDs conflict.
  - Pillar: there are no exact master PSDs.
  - LBMetalSilver1oz: discontinued and hidden.

## Gate and rollback

The existing `NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22` flag turns these images on. Nothing changes Convex, Shopify, Builder layers or PDP variant photos.

To roll back, remove the `nextBatchReleaseRows` import and spread from `src/lib/products/catalog-heroes.ts`.

## Files

- `approval.json`: the evidence for each SKU.
- `contact-grace.jpg`, `contact-royal-flair.jpg`, `contact-decorative.jpg`: the sheets Jordan reviewed. They include the held SKUs.
- `lineup-strip-wrapped.jpg`: all candidates beside six previously released heroes at one card scale.
