# Grace, Royal, Flair, and Decorative catalog images (2026-09-25)

Jordan approved 21 Sunburst heroes on 2026-09-25 after reviewing the contact sheets. This folder is the release record. The sheets were made before approval, so their headers still say "review candidates, NOT approved".

- **14** are round-1 QA passes, from `fitted/`.
- **2** are round-2 QA passes, from `fitted/round2/`: GBEternalFlameGreen and GBCB12ozPear.
- **4** are round-2 renders **approved on sight** (`status: "approved-on-sight"` in `approval.json`): GBRoyal13Gl, GBRoyal13MtlRollBlkDot, GB3TPlGl and GBGrce55AnSpTslMtSl. See below.
- **1** is a round-3 render **approved on sight**, from `fitted/round3/`: GB1ozGenieBl, the aqua Genie. See below.

## Released (21)

| Family | SKU | Production group | Glass mm | Landmark | Target % (measured) | IoU | Edge p99 (px) | Source | Status |
|---|---|---|---:|---|---|---:|---:|---|---|
| Grace | GBGrce55SpryMtGl | grace-55ml-clear-18-415-perfumespray | 113 | shoulder | 56.59 (56.599) | 0.9958 | 3.39 | r1 a2 | QA pass |
| Grace | LBGrce55LtnMtGl | grace-55ml-clear-18-415-lotionpump | 113 | shoulder | 56.59 (56.588) | 0.9952 | 2.79 | r1 a1 | QA pass |
| Grace | GBGrce55RdcrMtSl | grace-55ml-clear-18-415-reducer | 113 | shoulder | 56.59 (56.597) | 0.9972 | 3.05 | r1 a1 | QA pass |
| Grace | GBGrce55AnSpMtSl | grace-55ml-clear-18-415-antiquespray | 113 | shoulder | 56.59 (56.589) | 0.9957 | 3.38 | r1 a2 | QA pass |
| Grace | GBGrce55AnSpTslMtSl | grace-55ml-clear-18-415-antiquespray-tassel | 113 | shoulder | 56.59 (56.590) | 0.9928 | 3.63 | r2a1 | **approved on sight** |
| Royal | GBRoyal13Gl | royal-13ml-clear-13-415 | 56 | shoulder | 37.48 (37.482) | 0.9944 | 5.13 | r2a3 | **approved on sight** |
| Royal | GBRoyal13SpryGlMatt | royal-13ml-clear-13-415-finemist | 56 | shoulder | 37.48 (37.481) | 0.9955 | 3.23 | r1 a3 | QA pass |
| Royal | GBRoyal13MtlRollBlkDot | royal-13ml-clear-13-415-rollon | 56 | shoulder | 37.48 (37.486) | 0.9932 | 4.99 | r2a1 | **approved on sight** |
| Flair | GBFlair15Gl | flair-15ml-clear-13-415 | 56 | shoulder | 37.48 (37.479) | 0.9950 | 3.52 | r1 a1 | QA pass |
| Flair | GBFlair15SpryGlMatt | flair-15ml-clear-13-415-finemist | 56 | shoulder | 37.48 (37.492) | 0.9953 | 3.39 | r1 a1 | QA pass |
| Flair | GBFlair15MtlRollBlkDot | flair-15ml-clear-13-415-rollon | 56 | shoulder | 37.48 (37.482) | 0.9959 | 2.68 | r1 a2 | QA pass |
| Decorative | GB3TPlGl | tola-3ml-clear-14.3mm | 42 | closure seat | 31.66 (31.659) | 0.9938 | 4.90 | r2a1 | **approved on sight** |
| Decorative | GB6TPlGl | tola-6ml-clear-14.3mm | 48 | closure seat | 34.24 (34.228) | 0.9959 | 3.48 | r1 a2 | QA pass |
| Decorative | GBMtlMrblSmall | marble-5ml-clear-17.52mm | 66 | closure seat | 41.28 (41.266) | 0.9969 | 2.60 | r1 a1 | QA pass |
| Decorative | GBMtlMrblLarge | marble-10ml-clear-17.52mm | 80 | closure seat | 46.21 (46.213) | 0.9959 | 2.42 | r1 a2 | QA pass |
| Decorative | GBEternalFlameClear | eternal-flame-35ml-clear-Ground | 44 | closure seat | 32.54 (32.535) | 0.9966 | 3.11 | r1 a2 | QA pass |
| Decorative | GBEternalFlameBlue | eternal-flame-35ml-cobalt-blue-Ground | 44 | closure seat | 32.54 (32.531) | 0.9963 | 1.73 | r1 a3 | QA pass |
| Decorative | GBEternalFlameGreen | eternal-flame-35ml-green-Ground | 44 | closure seat | 32.54 (32.541) | 0.9969 | 2.51 | r2a1 | QA pass |
| Decorative | GB1ozGenieCl | genie-32ml-clear-Ground | 77 | closure seat | 45.18 (45.184) | 0.9955 | 2.45 | r1 a2 | QA pass |
| Decorative | GB1ozGenieBl | genie-32ml-cobalt-blue-Ground | 77 | closure seat | 45.18 (45.183) | 0.9941 | 2.60 | r3a1 | **approved on sight** |
| Decorative | GBCB12ozPear | pear-355ml-clear-Ground-glassapplicator | 151.9 | closure seat | 67.32 (67.318) | 0.9954 | 2.77 | r2a1 | QA pass |

Each SKU was checked against production Convex (`precise-raccoon-123`, `products:searchCatalog`, exact websiteSku search). In each case the SKU is a variant of exactly the group shown, with the same graceSku and Shopify variant ID as `catalog-heroes.json`. The release script repeats this read-only check every time it runs.

## Colour labels and follow-ups

The registry's `bottleColor` describes the glass that is pictured. It drives only the card spec line and the colour the guided finder shows. The guided finder's quick add also copies it into the cart drawer's detail line. It changes no production data and not the catalog colour filter. Checkout uses the Shopify variant ID.

On Jordan's instruction, two rows differ from production's colour field. Production is left unchanged for now. Both are recorded in `approval.json` under `labelFollowUps`.

| SKU | Registry `bottleColor` | Production | Note |
|---|---|---|---|
| GB1ozGenieBl | **Aqua** | Cobalt Blue (display name and colour filter) | Jordan: the glass is aqua (pale aqua / light turquoise, as in its master PSD) and must stay aqua. |
| GBCB12ozPear | **Cobalt Blue** | Clear (colour field and slug) | Jordan confirmed "Pear is cobalt". The production data fix is for later. |

`GBEternalFlameGreen` is `Green` in both production and the registry.

## Approved on sight

The four round-2 renders below miss the edge gate by about 4–6 px. Each SKU had six attempts in total (three in round 1, three in round 2), and none cleared the gate. Jordan approved the best round-2 render of each on sight on 2026-09-25. The miss is about the size of the gate's own measurement noise: a geometrically perfect copy of the input still measures up to 4.4–5.2 px max.

| SKU | Round-2 attempt | IoU | Smoothed p99 / max (px) | Per-point max (px) |
|---|---|---:|---:|---:|
| GBRoyal13Gl | r2a3 | 0.9944 | 5.13 / 5.75 | 6.18 |
| GBRoyal13MtlRollBlkDot | r2a1 | 0.9932 | 4.99 / 5.45 | 6.38 |
| GB3TPlGl | r2a1 | 0.9938 | 4.90 / 5.80 | 8.68 |
| GBGrce55AnSpTslMtSl | r2a1 | 0.9928 | 3.63 / 5.64 | 9.44 |

The by-eye check passed on all four:
- a single contact shadow with a cast to the right
- the detached caps stand with their own shadow
- on the Grace tassel, the bulb and tassel hang from the hose exactly as in the master pose

### GB1ozGenieBl (round 3)

The aqua Genie was re-rendered in round 3 from its master PSD, keeping the pale aqua glass. It had three attempts, and r3a1 is the one selected.

- **Geometry.** IoU is 0.99405, just under the 0.995 gate. The edge deviation passes: smoothed p99 2.60 px, max 2.84 px (per-point max 5.32 px).
- **Fit.** The fit error is 0.001 % of canvas height.
- **Glass colour.** The glass colour is kept. Median RGB inside the glass is (202, 226, 230) in the input and (203, 229, 233) in the output. Hue is 188.6° in and 188.0° out.
- **By eye.** The pale aqua is kept on both the body and the stopper, the stopper is seated, the ribs are kept, and there is a single contact shadow with a cast to the right.

Jordan approved it on sight on 2026-09-25.

## Sizing

- Approved by Jordan 2026-09-25.
- Every hero sits on one scale: target % = **3.5314 · mm^0.5868**. The mm value is the bare-glass height (heightWithoutCap, foot to rim). This curve is the least-squares best fit over the five approved locks: Diva 100, Elegant 100, Cylinder 50, Cylinder 5 and Elegant 15.
- The glass foot sits at **91 %** (y = 2082 of 2288).
- The target % is the span from the landmark to the foot.
  - **Shouldered bottles** (Grace, Royal, Flair) use the glass shoulder, where the neck meets the body.
  - **Shoulderless bottles** use the **closure seat**: where the fitted closure or stopper meets the glass. That is the top of the glass lip for ground stoppers (Eternal Flame, Genie Clear and Aqua, Pear), the neck base under the cap for Tola, and the top of the shell's top plate for Marble.
- The fitted 2080 × 2288 canvas already holds the approved card framing. Registry framing is therefore identity (`scale 1`, no translation), the same as the remaining-42 release.

## QA gate

- The gate is IoU ≥ 0.995 **and** a smoothed edge p99 ≤ 4 px. Both are measured against the master-PSD input silhouette. The lane's own validation shows that a stricter per-point max ≤ 4 px is below the method's resolution.
- A by-eye check was also required. It covers:
  - a single contact shadow with its cast toward 2 o'clock
  - the stopper is seated
  - glass colour and metal-shell material are kept
- 16 rows pass the gate. The five rows above were approved on sight.
- Full QA, fit, input/PSD hashes and every attempt are in `approval.json` (`rows[].laneRecord`).

## Export

- Each approved fitted PNG is resized once, uniformly, from 2080 × 2288 to 1560 × 1716 (Lanczos3).
- It is then encoded as lossless WebP and decoded again to confirm pixel equality.
- Files are content-addressed under `public/images/catalog/next-batch-approved-2026-09-25/`.
- The native PNGs total 74,552,097 bytes; the WebPs total 40,416,770 bytes.
- `scripts/hero-families/release-next-batch.cjs <lane>` rebuilds everything.
  - It refuses any fitted or raw render whose sha256 differs from the approved hash, for rounds 1, 2 and 3.
  - It refuses any lane record that no longer selects the approved attempt.
  - It refuses any production group mismatch, and any production colour other than the one recorded.
  - It refuses to overwrite an already-released WebP with different bytes.
- The generated bone background is kept; a pixel-exact background is not claimed.

## Held (not in this release)

- **GBHeartFrst4KeyGld and GBHeartFrst4TslRed.** Round 2 rebuilt the input with the keychain or tassel lying flat. The model then re-posed the heart, rotating it toward upright, so geometry changed (IoU 0.976). The catalog cards keep today's images.
- **Blocked on data, so not rendered:**
  - Lotion (LB1ozGl, LB1ozSl, LB3mlClear): glass heights are unknown.
  - GBMtlCylGl: the Royal 14 ml height is disputed.
  - Pillar: there are no exact master PSDs.
  - LBMetalSilver1oz: discontinued and hidden.

## Gate and rollback

The existing `NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22` flag turns these images on. Nothing changes Convex, Shopify, Builder layers or PDP variant photos.

To roll back, remove the `nextBatchReleaseRows` import and spread from `src/lib/products/catalog-heroes.ts`.

## Files

- `approval.json`: the evidence for each SKU. Round-2 and round-3 rows add `round`, `status`, `approvalNote` and, when approved on sight, `approvedOnSight`. Rows that differ from production's colour add `colourNote`, and those rows are also listed under `labelFollowUps`.
- `contact-grace.jpg`, `contact-royal-flair.jpg`, `contact-decorative.jpg`: the round-1 sheets Jordan reviewed.
- `contact-round2.jpg`: the round-2 sheet. Each row shows the round-1 selection, the round-2 input, the round-2 best fitted render, and the input outline over the output.
- `contact-genie-blue.jpg`: the round-3 sheet for the aqua Genie.
- `lineup-strip-wrapped.jpg`: the round-1 candidates beside six previously released heroes at one card scale.
