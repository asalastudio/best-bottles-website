# Cylinder hero and hover UI integration

All 52 populated Cylinder groups now use their approved empty and full image pairs in the local main catalog and Cylinder finder. Jordan approved the final batch, including the corrected relative scale of the 4 oz, 8 oz, and 16 oz plastic bottles, on September 5, 2026.

- Desktop fine-pointer hover reveals the full state; touch keeps the empty default. Reduced motion removes the transition, and a failed hover image leaves the empty image visible.
- Vintage bulb, tassel, and plastic assemblies stay attached. Their interaction changes only the fill.
- The 104 content-hashed lossless WebP assets decode to exactly the approved source PNG pixels. Each state's reviewed uniform scale and registration are preserved. No source images were regenerated during UI integration.
- Hero selection requires the pictured website SKU to be present among the filtered variants. Both catalog and finder links carry that exact SKU into the product page.
- Website labels remain 25 mL for recovered sources whose PSD filenames say 30 mL.

## Verification

Against the active local Next.js checkout at `/Users/jordanrichter/.codex/worktrees/cc9c/Best-Bottles-Website-02-20-2026`, served on port 3002:

- 98 focused tests passed across six test files.
- TypeScript (`tsc --noEmit --incremental false`) and focused ESLint passed.
- 208 rendered card checks passed: all 52 pairs in the main catalog and Cylinder finder, each on desktop and touch/mobile. Checks cover image loading, source mapping, exact pictured-SKU links, hover/default behavior, reduced motion, and horizontal overflow.
- Failed-hover fallback passed; no browser page errors were recorded.
- Desktop and mobile screenshots were visually reviewed.
- The exploded viewer corrects legacy overcap/pump ordering while preserving photographed bounds and the assembled view. Six focused framing/PDP tests, TypeScript, and lint passed after this fix; the exact 100 mL copper product page was visually verified with the overcap above the mechanism.

Evidence: `output/cylinder-hover-ui/browser-results.json` and accompanying screenshots; `docs/reviews/cylinder-hover-ui-lineage-2026-09-05.json`; batch approval locks. Reproduction scripts: `scripts/assemble-cylinder-hover.cjs` and `scripts/verify-cylinder-hover-ui.cjs`.

## Delivery boundary

UI integration is complete locally at `http://localhost:3002/catalog?families=Cylinder&limit=240` and `http://localhost:3002/catalog/cylinder`. The implementation and assets are also retained in the b1f5 working checkout. This record accompanies the scoped local source commit. The work has not been merged or deployed to production, and this integration made no Convex or Shopify writes.

The separately deferred matte-silver 25 mL source identity and the development catalog's empty 5.5 mL group remain outside this approved 52-pair set. Production publication and those catalog reconciliation items are not represented as complete.
