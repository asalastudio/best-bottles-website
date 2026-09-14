# Sunburst sizing workflow preview

Jordan's saved review actions locked all three Boston standards at version 1: 15 mL unchanged, 30 mL +3%, and 60 mL unchanged. The assistant did not click approval buttons.

The local workbench now offers “Next: match [size] mL Sunburst” for locked standards and advances to that stage after a lock. It shows the original Sunburst file on equal canvases before and after a browser-only uniform transform. It labels this as a sizing preview, not a saved or approved final asset. Files, source shadows, registries and remote assets were not edited. Components and final production registration still require verification.

The preview verifies appearance and glass-reference file hashes, the approved packet hash/version, matching canvas and full-glass target. It always calculates from the recorded source landmarks. Stale packets and changed references fail closed; repeating a preview does not compound scale.

30 mL: 873.5014435 → 899.7064869 px glass height, scale 1.03, baseline 1561.56 px on the 1560 × 1716 frame. 15 mL remains 802.0390570 px; 60 mL remains 1070.6077183 px. Rim guides describe calibrated master glass, which is occluded by the cap in the appearance image.

Before and after this UI step: 165/2312 plates complete, 420/2309 applicable kits live, 71/380 Sunburst product groups complete. Both measurement runs measured 1876 images with no failures; 49 diagnostic width outliers and 550 legacy sources remain. All unresolved holds remain. Final ledger snapshot: 2026-09-13T00:16:45.202Z.

Verification: 16 targeted tests passed; TypeScript and the full Webpack production build passed. Browser screenshots were shown at unchanged desktop zoom and at 390 px phone width. Both desktop frames were 510 px wide; mobile frames were 143 px, page width 390 px without overflow. The local workbench returned HTTP 200. The 30 mL flow was left open for Jordan.

Next production step: prepare a final exact-SKU image against the approved standard without coded shadow editing, verify glass and components, create a fresh byte-bound review card, then check actual desktop/mobile product behavior and request release-specific ship. This preview does not authorize final-image approval, automatic whole-family normalization, indexing or publication.

Saved lock timestamps:
- 15 mL: 2026-09-13T00:10:38.367Z, image `8d965f273927d8a8dcc29073fa4c10f95fd0866355bf56e642a853c6aff66bc8`.
- 30 mL: 2026-09-13T00:10:03.292Z, image `5bf522a3373736025c7bf77cd075ca486877e2624ea58288336dd52fdc7aff77`.
- 60 mL: 2026-09-13T00:10:29.175Z, image `2ac7ac0f29be4d70c31dd133aebdb7676f74a00e06729faf9e887aa449b9462d`.
