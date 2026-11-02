# Jumbo roller: approved material inside original PSD geometry

**Body approval remains separate from component approval.** The owner rejected the first 50 ml body after approving the roller material. The subsequent `jumbo-body-reference-2026-11-02` correction restores the complete PSD glass contour and wider neck. See `OWNER_REVIEW_HOLD.md` for the rejected version and correction evidence. The 28 ml body is unchanged and remains available for the owner's reference check.

The owner approved the latest polished-metal ball and translucent-plastic material with “Thats good.” The final registered master retains the original Photoshop outline, shallow ball exposure and single bottom step. It has no projecting lower plug. The plastic-ball version retains its original PSD artwork.

Local comparison: http://localhost:3010/reviews/jumbo-roller-material-2026-11-02/index.html

The existing `jumbo-roller-psd-match-2026-11-02` comparison URL also shows the current update. At this material-only snapshot, four exact metal recipes use the refined material across the 28 ml and 50 ml / 16 mm bottles and their black/white caps. The other 105 remaining-family recipes are identical. That snapshot preserves bottle/cap images, anchors, roller bounds and canvas sizing. The later 50 ml body correction has separate preservation evidence; its updated mouth registration changes the hardware placement without changing the approved component image bytes.

## Source and registration

- `sources/metal-approved-material.png` is the owner's approved built-in image-generator result, SHA-256 `23d7d2097e9dfcd3c1b326239d3cf9dd5222bc1dd838bc43ada34e9bc03ba1de`.
- `prepare.mjs` registers that material uniformly into the original 336 × 220 PSD viewport. The original native alpha outline supplies the mask; it is not replaced by the generated contour.
- `geometry-verification.json` compares the registered alpha with the original outline rendered at the same output size. Zero alpha values differ. This proves outline preservation, not preservation of the old dark metal pixels.
- `metal-registered.png` and the embedded-source SVG are reusable transparent masters. The lossless WebP is the delivery master. Body images remain separate.
- Original PSD source identities and offsets remain in the earlier `jumbo-roller-psd-match-2026-11-02` archive. The owner's IMG_6921/IMG_6922 photos clarify the single bottom step.

## Verification and release

All 48 desktop/mobile product states pass across eight exact 16 mm recipes and three views. All 109 candidates still pass source and shared-body registration checks. Four display sizes for 17 sources pass all 68 lossless resized-pixel comparisons.

The new material is approved; its assemblies remain local review recipes. The hosted approved manifest remains unchanged at `ca21bfc3c0c3ce57`, 456 recipes. The 25 ml has no roller. Jumbo products retain their existing exclusion from the standalone Builder. No production publication is included in this follow-up.

The commands below reproduce the historical material-only snapshot after restoring its source bundle from Drive. For the current corrected 50 ml assembly, use the commands in `jumbo-body-reference-2026-11-02/README.md`; the historical material-only comparison intentionally rejects changed body recipes.

```sh
node docs/reviews/jumbo-roller-material-2026-11-02/prepare.mjs
node_modules/.bin/tsx docs/reviews/cylinder-family-completion-2026-11-02/register-rollers.mts
node_modules/.bin/tsx docs/reviews/cylinder-family-completion-2026-11-02/prepare.mts
node docs/reviews/cylinder-family-completion-2026-11-02/build-display.mjs
node_modules/.bin/tsx docs/reviews/jumbo-roller-material-2026-11-02/build-review.mts
node docs/reviews/jumbo-roller-material-2026-11-02/verify-browser.cjs
```

Drive source archive: https://drive.google.com/drive/folders/1rflghxXoh9arHzP-z1Und5qj9J4I9Co_
