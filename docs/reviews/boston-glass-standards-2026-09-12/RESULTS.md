# Boston bare-glass standards prepared for Jordan

The three exact source PSDs listed in `registration.json` contain isolated bare-glass layers under the caps. Codex inspected those layers directly: Layer 4 for 15 mL, Layer 22 for 30 mL, and Layer 6 for 60 mL. All sources remain in BB-PSD-Files-Master and are hashed in `prepared-comparisons.json`. No product identity was derived from a filename; the selected reference SKUs, catalog records, recorded plate source paths and explicit product-group crosswalk establish the scope.

The bare-glass layer is uniformly calibrated against the approved reference image’s visible body sides, with the contact baseline fixed at 91% of the 1560 × 1716 frame. Typical side-edge residuals are 1.95–2.03 pixels; 95th-percentile residuals are 9.41, 15.16 and 12.98 pixels for 15, 30 and 60 mL respectively. This is a documented fit between original master geometry and generated appearance, not a claim of identical silhouettes. The real master rim and base establish the glass endpoint. Pixel measurements are presentation measurements, not invented physical millimeters.

| Standard | Requested change | Before glass height | Proposed glass height | Proposed frame height |
|---|---:|---:|---:|---:|
| Boston 15 mL | 0% | 802.04 px | 802.04 px | 46.738873% |
| Boston 30 mL | +3% | 873.50 px | 899.71 px | 52.430448% |
| Boston 60 mL | 0% | 1070.61 px | 1070.61 px | 62.389727% |

15 and 60 mL before/after image hashes are identical. 30 mL uses exactly 1.03 uniform scale around the same baseline; independent rendered foreground bounds increase from [597, 690, 960, 1563] to [591, 664, 966, 1563]. The one-to-two-pixel difference between the mathematical landmark and thresholded pixel extent is the antialiased edge. The full original source assemblies also fit at their proposed scale with their layer offsets preserved.

The review shows bare glass, with rim and baseline guides drawn by the UI. The original hero images, their shadows, all source PSDs, the hero registry, served plates and kits remain untouched. No shadow was extracted, modified or rendered. Locking a bare-glass standard preserves the prior appearance reference separately and does not publish or replace a hero image.

The explicit catalog mapping covers 16, 53 and 54 SKUs across 5, 9 and 9 product groups. Their family/capacity/color/neck fields agree with the standards. Existing SKU/source/size holds are preserved; this is not a declaration that every component or SKU asset is already correct.

Before preparation: 165 checked-and-approved plates, 420 live kits, 71 Sunburst-complete groups, 0 ready comparisons, 0 locked standards. After preparation: the asset counts remain 165/420/71, with 3 ready comparisons and 0 locks granted by Codex. The measurement-before-ledger sequence refreshed all 1,876 images without failure. `final-counts.json` records the final snapshot and any subsequent human locks present at verification.

Sixteen focused tests pass, including exact-byte approval, stale packet rejection, reference/source verification and prior-version preservation. TypeScript and the Webpack production build pass. The actual local workbench was checked on desktop and at 390 px phone width: images load at equal zoom, the ready count is visible, and lock buttons are enabled. Same-zoom before/after images for all three sizes were shown inline. Approval buttons were not clicked by Codex. Nothing was committed or published.
