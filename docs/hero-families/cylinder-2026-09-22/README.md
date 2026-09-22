# Cylinder staging pilot — September 22, 2026

33 delivery exports cover 27 existing Cylinder catalog groups: twenty standard 9 mL assemblies, eight 28/50 mL assemblies, and five new 100 mL assemblies. Six are additional exact roller variants within those groups. This is a partial family pilot, not completion of the 49 glass heroes in the 3.3–100 mL scope. `scope.json` records the remaining registered heroes separately, including out-of-scope sizes/materials.

## Locked delivery contract

- Lossless source delivery files: **2080 × 2288**, 10:11. These are uniformly resized from approximately 1196 × 1315 generated images, not native 2080-detail renders. The initial 28 assets were reused; this extension used five explicitly authorized Sunburst API edits.
- Glass contact foot target: **91%**, y = **2082.08 px**, excluding the shadow.
- Shoulder spans, measured upward from the glass foot: standard 9 mL **43.5%**; 28 mL roller **50.5%**; 50 mL roller **53%**; 50 mL 18-415 **56%**. 100 mL is the **67.5%** calibration endpoint and its five new images are included.
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

## 100 mL extension

Five clear-glass assemblies use the same approved material reference (SHA-256 fa254eb2959610df9a61e1d32ddeeadb30f67e62d1194858448b971080982899): vintage bulb sprayer, tassel bulb sprayer, capped reducer, perfume spray, and lotion pump. Exact catalog identities and master PSD hashes are recorded per output; the clear reference controls optical appearance only. Frosted, cobalt and amber retain their matching reference assignments in the existing family manifest.

- Model: gpt-image-2.5-sunburst, quality high, three inputs per edit: framed exact master, original master composite, approved clear material reference. Five calls completed without a generation retry. Prompts are preserved in [prompts](prompts/).
- Delivery measurements: shoulder y = 537–538 px (target 537.68), foot y = 2082–2085 px (target 2082.08). Manual/threshold landmark uncertainty is approximately ±7 delivery pixels. All product components and shadows move together under one uniform transform.
- Raw responses are 1196 × 1315 for four images and 1195 × 1316 for the tassel image. Delivery canvas is 2080 × 2288; this does not imply native 2080-pixel detail.
- Master proportions preserved: the two bulb-source bodies are slightly narrower than the other master composites. This variance remains documented for geometry review; no width stretching was applied.
- Final visual approval and exact bone exposure remain open. Generated backgrounds are warmer/lighter than #F5F3EF (border medians are recorded); no software shadow or background retouching was applied.
- Review: [five-image sheet](100ml-sheet.png), [shoulder/base guides](100ml-guided-sheet.png). Raw renders, input references, source composites, and before/after sheet remain preserved in local-review-archive/family100.
- Reproduce exports with `node scripts/hero-families/export-cylinder-100ml.mjs /path/to/family100`.
- Verification: 445 focused tests and TypeScript pass. All previous 28 asset hashes are preserved.
- Scope: 27 of the 49 glass catalog cards have candidates, with 33 exact assembly images including additional rollers. 22 cards plus four extra roller variants remain (26 images).
- Rollback for this extension: point only best-bottles-website.vercel.app back to best-bottles-website-854qqi02k-asala.vercel.app (the verified 28-image pilot).

The expanded all-33 browser audit passes on both `/catalog` and `/catalog/cylinder` at 1440px and 390px: decoded images, exact group/SKU assignments, matching SKU product links, plastic filters, and 10:11 card frames. `local-browser-verification.json` records the full 20-view audit.

## Small Cylinder scope correction

Jordan explicitly includes the 3.3 mL and 4 mL sample sprayers in this family. The glass scope is now **49 catalog groups**, with 27 groups covered by the 33 staging images. **22 groups plus four additional roller variants remain (26 images)**. The existing staging deployment and image bytes are unchanged by this planning update.

Current shoulder spans are **28% for 3.3 mL** (user-directed +3 percentage points) and **32.5% for 4 mL**, compared with the unchanged 5 mL target of 36.5%. Jordan rejected the earlier 33.5%/34.5% comparison because it did not read visually smaller from one size to the next. All retain a 91% glass foot and a 2080 × 2288 delivery canvas. Each small bottle has its own physical profile and exact master source; caps and pumps never set glass scale. These normalized display targets intentionally compress physical height differences for ecommerce thumbnails.

[The source sizing proof](3-4-5ml-scale-proof.png) shows the untouched master appearance under one uniform assembly transform. Jordan accepted the earlier 25%/32.5% sizing proof, then requested a 3-point increase to the 3.3 mL. The current proof applies that 28% target; it is not a new premium render. The source pairs and hashes match the earlier recovered-sprayer audit. Both will use the approved clear-glass material reference in the next generation pass. `small-cylinder-sizing-proposal.json` preserves geometry, measurements, current identities, the older 3 mL metadata discrepancy, and the draft transforms. No image API calls were made for this scope/size proof.

The current proof keeps whole-assembly height increasing from 3.3 to 4 to 5 mL. The 3.3 mL uses a 28% shoulder span, with the unchanged 32.5% and 36.5% sibling targets. Every pump, cap and bottle remains in its original proportions under a uniform transform about the fixed 91% glass foot. The 4 mL and 5 mL proof images are byte-for-byte unchanged; only the 3.3 mL is enlarged.
