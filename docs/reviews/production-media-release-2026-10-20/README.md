# Production media release plan, 20 October 2026

Prepared locally on `integration/local-media-main-2026-10-20`. This is a review package, not an executable publication manifest. No assets were uploaded, no release was activated, and no GitHub, hosting, or production backend state was changed.

The package pins 52 catalog images, 52 captured assembly recipes, and 73 unique local image files by SHA-256. Existing remote component URLs remain references and must be reverified before release. The capture source files were checked against the previously verified preservation archive. The full local integration checks and production build have passed; hosted release preparation is still outstanding.

## Scope and rollout

| Stage | Exact scope | Current decision |
| --- | --- | --- |
| 1 | Empire Matte Gold 50 ml `GBEmp50SpryMtGl` and 100 ml `GBEmp100SpryMtGl` | Proposed first production canary, after technical preparation and production approval |
| 2 | Remaining 12 Empire spray/white-pump SKUs | Visually accepted; expand after the canary passes |
| 3 | All 12 Round 78 ml spray SKUs | Visually accepted; expand after Empire checks pass |
| 4 | All 14 Round 78 ml lotion SKUs | Shiny Silver clear/frosted pair accepted; remaining twelve still need final visual approval |
| 5 | All 12 Diva 46 ml spray SKUs | Visuals accepted; hold for source-fit verification of the Round-derived dip tube |

The recommended first rollout is stages 1–3, covering 26 variants. The lotion family can follow once its remaining visual approval is recorded. Keep Diva out until its source/fit issue is resolved. This does not require repeating the approvals already given for Empire, Round sprays, the lotion Shiny Silver pair, or Diva's appearance.

The scope excludes jewelry/ring assemblies, vintage/tassel variants, other families, pricing, inventory, shipping, product facts, and Shopify media. The broader inherited code branch still contains shared rendering and footer/help changes. A 52-SKU media allowlist does not turn that entire branch into a media-only diff; its complete application diff and existing tests remain part of the PR review.

`sku-approval-ledger.csv` lists every exact SKU, proposed batch, approval state, and hold. `release-plan.json` includes image hashes and recipe fingerprints. Every `approvedForProduction` field is false. Hosted URLs, deployment target, release revision, and rollback snapshot are deliberately unset because they have not been prepared or verified.

## Recommended technical design

Use immutable, content-addressed hosted assets and a versioned application release manifest. Activate the rendering through a shared, server-controlled, exact-SKU adapter used by catalog, PDP, and Builder. Start disabled. Preserve the existing identity, source URL/hash, component, plate, registration, and geometry guards, with fallback to the current published rendering if a guard fails. A source mismatch is also an activation failure, even if the customer sees a usable fallback.

Do not enable the whole local review path or remove `.vercelignore` wholesale. Do not ship the captured baseline as a production data source. Do not edit shared register body/component rows to achieve a nominally limited 52-SKU release: Empire glass and closure components are used outside these exact spray/pump variants. The first media release should require no production media-record writes. The existing immutable asset store can be used for production after authorization; preview must use a verified separate non-production asset target.

The current publisher scripts are building blocks, not a ready publisher for this release. In particular, publishing `productKits` alone cannot supersede register-composed kits. Implement the scoped application adapter before seeking production approval.

When promoting local paths to hosted URLs, preserve every material/through-glass effect as well as geometry. Some rendering rules, including `sourceTubeMaterialFilter`, currently identify the exact local URL. A URL rewrite without the corresponding identity mapping could lose the approved dip-tube appearance. The manifest must carry source-to-hosted identity without broadening those effects to other products.

Version all affected Builder server cache keys and client/CDN request identities with the active media release. Current family caches last an hour, and CDN responses allow stale serving for a day. A successful deploy is not proof that all three surfaces use the same revision. The release must support invalidation/version changes on activation and rollback, including clients already open in the Builder. This cache integration is not implemented yet.

## Preparation and execution gates

| Step | Work | Owner / boundary |
| --- | --- | --- |
| Local preparation | Implement disabled exact-SKU release adapter; host-URL identity mapping; cache revision handling; assertions that out-of-scope SKUs are unchanged; non-mutating asset plan and rollback controls | Technical work I can prepare locally; no further permission needed |
| Preview preflight | Verify branch/project routing and preview-only backend/assets; ensure no production write/deploy keys or production backend fallback; document the exact target configuration | Technical prerequisite before requesting push approval; configuration not yet inspected live |
| GitHub and preview | Push the reviewed integration candidate to a new branch, open a replacement draft PR, build an isolated hosted preview, and upload assets only to the verified preview target | Requires your explicit approval; keep existing PR #369 until replacement is agreed, and do not merge both |
| Hosted QA | Check all proposed SKUs on catalog/PDP/Builder, every closure view and mobile picker, URL/SKU/cart identity, decoded asset hashes, CORS/cache behavior, cold/warm caches, and representative out-of-scope products; rerun the prior 157 selector checks | Technical evidence; no real purchase or live-service mutation implied |
| Release package | Reverify current main, exact application commit, current backend alignment, asset receipts, before-images/mappings, approval ledger, target IDs, rollback procedure, and deployment settings; address CMS compatibility warning on preview | Prepare this concrete packet before requesting production approval |
| Production | Upload immutable production assets and deploy/activate only the approved release scope, including the explicitly reviewed additive Convex schema if carried in the candidate; begin with the two Empire SKUs | Requires a separate production approval tied to the reviewed commit, targets, and manifest |
| Expansion | Verify the canary, then expand through explicitly authorized batches; stop at any failure or unresolved content gate | A single approval may cover the named stages and their pass conditions; no implicit authorization for held families |

The push approval should name the exact reviewed branch tip and preview operations. Pushing can trigger a preview automatically, so preview isolation must be verified first. The production approval should name the final commit, asset manifest, targets, canary, expansion scope, and rollback authorization. Neither request is ready for execution today: the runtime adapter, hosted target verification, preview evidence, and rollback rehearsal are still outstanding.

## What Jordan still needs to decide or approve

1. **Round lotion visual decision:** approve or request changes to the twelve non-Shiny-Silver variants, six finishes in clear and frosted: Matte Gold, Shiny Gold, Matte Silver, Shiny Black, Copper, and Clear Overcap. Review [the complete local comparison](http://127.0.0.1:3008/round78-lotion-complete/). The exact twelve SKU rows are marked pending in the ledger.
2. **Diva factual input, if available:** provide an exact source photo or confirmed fitted dip-tube measurement if that is the route needed to settle fit. This is not a request to approve an unsupported measurement. I recommend holding Diva while exact source/fit is verified; its earlier visual approval remains recorded. Source recovery and a corrected local pilot can continue without publication permission.
3. **GitHub / isolated preview approval, later:** authorize the exact branch push, new draft PR, and named non-production preview/asset operations once their preparation is reviewable. No permission to merge, change production data, or update PR #369 is implied.
4. **Production approval, later:** authorize the exact reviewed application/backend deployment and media uploads/activation for the accepted stages, with the canary, stop conditions, and rollback below. This includes acknowledging the three additive `ring` validator changes if they remain in the release commit. It does not authorize ring data, imports, catalog-fact changes, or unrelated families.

Your release decisions are distinct from engineering checks. I will prepare guards, manifests, target verification, tests, cache handling, and rollback evidence rather than asking you to approve unresolved technical failures.

## Stop conditions and rollback

Stop expansion on any wrong SKU/cart item, unexpected product-fact change, missing/undecodable/hash-mismatched asset, clipping/discontinuity, out-of-scope image change, source guard fallback, mixed release versions across surfaces, or failed smoke check. Record the affected exact SKUs and failure before proceeding.

Before activation, preserve the previously active application/media revision, actual target identity, immutable old URLs, and any affected mapping before-images. Exercise rollback in the isolated preview, including warm caches and an already-open Builder session. The proposed runtime switch/rollback mechanism still needs implementation and proof; this plan does not claim it exists today.

Rollback the scoped media/application release and restore its cache revision or invalidate affected caches. Keep previous asset objects available. Do not delete uploaded images or restore a whole database snapshot over unrelated changes. No media-record writes are planned in the recommended adapter approach; if that changes, the release plan must be amended with exact row patches and compare-before-write restoration before approval.

Keep the widened Convex slot schema during media rollback. Once ring-bearing rows exist, narrowing to the old enum can fail schema validation. Ring data is excluded here, but other writers must not be assumed absent. See [the Convex review](CONVEX-REVIEW.md) and [Convex schema validation](https://docs.convex.dev/database/schemas#schema-validation).

## Evidence and limitations

- The full integration run passed: 3,137 default tests, 81 explicit media replay checks, one additional copper snapshot check, TypeScript, and the local production build. Test sets overlap. Six live-service tests and two source-file checks remained unexecuted. Lint reported zero errors and 92 warnings.
- The inherited Convex diff is additive and retains its write-token gate. The review reproduced a separate importer gap for rings. See `convex-review-verification.json`.
- npm flagged `next-sanity@12.4.5` with Next.js 16. The build passed, but hosted CMS/preview behavior still needs verification. No dependency change is made by this plan.
- Production rows, deployment history, target environment settings, prices, stock, and asset delivery were not freshly queried in this planning pass. Captured snapshots establish historical evidence only. Refresh the target and relevant read-only evidence before any release; do not silently overwrite current facts from a snapshot.
- Reproduce the local plan validation with `python3 docs/reviews/production-media-release-2026-10-20/prepare-plan.py`. It uses the preserved assembly recipes and current catalog files, checks local image bytes, and never uploads or publishes. Reproduce the backend probe with `node --import tsx docs/reviews/production-media-release-2026-10-20/review-convex.mjs`.
