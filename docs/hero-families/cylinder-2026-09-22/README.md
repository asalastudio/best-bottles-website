# Cylinder staging pilot — September 22, 2026

28 preserved delivery exports cover 22 existing Cylinder catalog groups: twenty standard 9 mL assemblies and eight 28/50 mL assemblies. Six are additional exact roller variants within those groups. This is a partial family pilot, not completion of the approximately 47 glass heroes in the 5–100 mL scope. `scope.json` records the remaining registered heroes separately, including out-of-scope sizes/materials.

## Locked delivery contract

- Lossless source delivery files: **2080 × 2288**, 10:11. These are uniformly resized from approximately 1196 × 1315 generated images, not native 2080-detail renders. No new API calls were used for this integration.
- Glass contact foot target: **91%**, y = **2082.08 px**, excluding the shadow.
- Shoulder spans, measured upward from the glass foot: standard 9 mL **43.5%**; 28 mL roller **50.5%**; 50 mL roller **53%**; 50 mL 18-415 **56%**. 100 mL remains the 67.5% calibration endpoint; its new images are not part of this batch.
- One body lock across finishes/applicators of the same body. Different bodies at the same capacity retain separate locks.
- UI framing is identity: scale 1, x/y translation 0. No CSS enlargement or double application of the shoulder transform.
- `manifest.json` preserves output/source/master/material/prompt hashes, measurement and alignment records, prior registry entries, and review states. `production-contract.json` retains the larger family contract. Source paths use portable archive labels; source PSDs and material reference photographs remain in the secured source archive.
- Exact bone exposure, final geometry/shoulder measurement, and final delivery visual approval remain release gates. Staging placement does not manufacture approval for these checks.

## Staging activation and rollback

Set `NEXT_PUBLIC_CATALOG_HERO_PILOT=cylinder-2026-09-22` at **build time**. The exact-SKU pilot registry then takes precedence over Shopify group hero images only for a matching, currently filtered variant. Existing group representatives retain priority; plastic-only filters can show the additional plastic roller candidates. Uncovered groups use existing imagery. The production registry and Convex/Shopify records are unchanged.

The catalog card retains the pictured SKU in the product link. PDP gallery media is unchanged. Responsive Next Image delivery resizes the image without cropping; the original hash-addressed PNG remains available for measurement and review.

Requested shared staging alias: `https://best-bottles-website.vercel.app`. Its pre-pilot deployment is `https://best-bottles-website-2a6jz4o7t-asala.vercel.app` (dpl_HjTiZf5SFHPcCQwfYRsUmGnUFFaV). Deploy a frontend-only preview with the flag and `BB_CONVEX_PREVIEW_DEPLOY=false`, verify it, then point **only the requested alias** at the preview. Do not promote the deployment or mutate the backend. Roll back by pointing that alias at the recorded prior deployment. A later main deployment can reassign the alias; retain the immutable pilot URL for review.

## Repeatable family checkpoint

1. Reconcile exact groups, SKUs, and body identities against the current catalog. Record exclusions and held source gaps.
2. Reuse acceptable images first; retain raw files and hashes. Generate only missing or rejected exact assemblies.
3. Freeze the canvas, body-specific shoulder/foot locks, geometry source, material reference, prompt, and output hashes in a family manifest.
4. Add only exact-SKU mappings to a staging registry; preserve prior registry entries for rollback.
5. Check asset hashes/dimensions, filtered variant identity, fallback behavior, and the actual desktop/mobile catalog. Review the final delivered images and background separately from technical loading tests.
6. Commit the family assets and evidence, create a PR, deploy the staging build, and record its immutable URL and shared alias verification.
7. Only after final visual/measurement clearance promote approved hashes into the production release registry. Record remaining heroes and continue the next family without losing the prior checkpoint.

## Verification

- 423 initial hero/mapping regression checks passed; 29 focused card/purchase checks passed after the renderer/filter update; 18 targeted checks passed after fallback hardening.
- TypeScript `npx tsc --noEmit`: passed.
- Reproducible browser audit: `REVIEW_URL=http://localhost:3050 node scripts/hero-families/verify-cylinder-staging.mjs`. All 28 candidates loaded on both 1440px desktop and 390px mobile, exact group/SKU URLs and product links matched, plastic filters excluded metal rollers, and frames remained 10:11. See `local-browser-verification.json`.
- Local Webpack build encountered a Next Google-font loader error (`Cannot read properties of null (reading '1')`). Remote deployment build must pass before alias reassignment.
- Browser/source-file checks establish integration correctness, not final geometry/material approval. Final visual release gates in the manifest remain open.
- Follow-up: the same all-28 browser audit also passed on the dedicated Cylinder family finder, desktop and mobile. Family/application finder cards now use the same roller-material scope before selecting heroes and purchase rows. Seventeen focused finder/variant/pilot tests passed.
- Read-only media ledger refreshed successfully: 2,286 plate images fetched/measured without failures; catalog ledger covered 2,572 SKU rows. Global plate/kit changes are archived locally, not mixed into this family PR. Staging candidates remain separate from approved production hero counts.
