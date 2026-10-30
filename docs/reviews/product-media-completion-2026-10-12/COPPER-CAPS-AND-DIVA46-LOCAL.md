# Copper caps and Diva 46 ml source tube candidates, 14 October 2026

## Round copper cap cleanup

`LBRnd78LtnCu` and `LBRndFrst78LtnCu` now use a local alpha cleanup of the existing 419 × 648 copper overcap image. The white polygon above the cap and the white retouch scraps are excluded from alpha. All original RGB values and every non-white pixel's alpha remain unchanged. Dimensions, anchors, placement, and original copper texture are preserved. Exactly 12,612 pure white paint pixels were removed.

The original image SHA-256 is `bfba49c70defb6ddc31527dd8e74970467b87043bd83986cf1a9cd9780fcb056`; the cleaned image is `be75859d4a21` (full hash in `src/lib/register/local-copper-caps.json`). A built-in image edit supplied a cleanup reference. Its generated metal pixels were excluded from the site asset. The source cleanup script and reference image are saved with the external batch evidence. Exact SKU, component, layer and development-mode guards prevent a general cap replacement.

All fourteen Round lotion candidates were rendered again: 42 PDP and 84 Builder layouts. Of the 126 files, 116 remain byte-identical; ten changed only on the two copper variants. All 108 earlier Round spray render PNGs remain byte-identical. The earlier copper retouch hold is resolved locally; owner and browser acceptance remain pending.

## Diva 46 ml spray batch

Twelve exact combinations, six clear and six frosted, now have local tube reuse candidates. The fresh production family capture contains 21 groups, 179 variants and 224 lookup products. All twelve exact legacy product headings and 48 linked gallery images were recovered with hashes and dimensions. Reader cache age remains unavailable. This scoped batch is not a completeness claim for the whole Diva family or a new commerce audit.

All 36 recorded exact-SKU PSD candidates were hash checked and their layers inspected. They do not provide an isolated complete tube. The six registered sprayer components exactly match those in the original Round 78 ml spray source batch. The proposed local reuse therefore uses that intact native source layer, preserving its pixels, alpha and proportions. It is explicitly not exact Diva tube photography or physical fit approval.

Registration is uniform from the native visible head to each captured exposed tube endpoint. The visible head overlaps the captured sprayer solid edge by two stage pixels. The end stays above the recorded inner-floor line, 16.9 mm above the foot. Exact expected tube images, dimensions, views, component IDs, box and bounds are guarded alongside the plate and sprayer metadata; later source or registration changes invalidate the candidate. Bottle geometry and seated hardware are unchanged, and all bottles remain empty.

Local integration replay accepts all twelve exact SKUs in both captured production and current development payloads. Offline evidence covers 36 PDP and 72 Builder layouts. The custom rasterizer does not reproduce every browser blend or the Builder's shared camera. Browser, zoom, physical iPhone, source reuse, physical fit and owner appearance acceptance remain pending. Catalogue cap-colour fields were preserved, including the captured frosted rows whose stored value is Clear; finish metadata reconciliation is separate from this tube correction.

## Review and verification

- `/team/media-review/round78/lotion`: original tube comparison and copper cap cleanup.
- `/team/media-review/diva46`: before/after candidates, all 36 PDP views and twelve exact product links.
- Focused tube/cap regression checks cover 22 tests, including source pixels, unchanged hardware, visible joins, floor clearance and stale-source rejection.
- Independent code review found no important issue, including after the additional Diva tube metadata guard.
- Final full suite: 348 suites and 3,144 tests passed; two suites and seven tests skipped. All scoped snapshots were enabled, with two workers. TypeScript, changed application/test lint and whitespace checks pass.

The first full-suite attempt hit the existing five-second limit in the new copper pixel test because it asserted separately on every pixel. The test now compares the entire decoded buffer once while preserving the exact alpha-only invariant and removed-pixel count. No timeout or product code was relaxed. The complete suite was rerun after this test change.

Both review routes reject production and Vercel. The local artwork remains covered by `.vercelignore`. No hosted media, database references, backend deployment or production rollout changed. Saved browser permissions deny localhost access; no workaround was used.

## Evidence

`/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`

- `copper-cap-cleanup-2026-10-14/`: original/candidate images, cleanup receipt, image-edit reference, comparison, final fourteen-lotion renders and preparation tool.
- `diva46-spray-batch-2026-10-14/`: family capture, development comparison, source plan, 36-master inventory, legacy pages/assets, before/pilot/after renders, exact source reuse manifest, comparison and regression receipts.

These are local review candidates. Commit and PR state do not grant artwork or release approval.
