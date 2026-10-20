# Empire and Round release preparation, 20 October 2026

> Update: the isolated resources are now provisioned and seeded. See [current setup](../isolated-preview-setup-2026-10-20/README.md). The provisioning approval below has been fulfilled; push and code deployment remain unapproved. Historical observations and checks below remain evidence from before setup.

Local implementation is prepared on `integration/local-media-main-2026-10-20`. No push, merge, hosted upload, backend mutation or deployment has been performed. Production activation is blocked in code. Diva and Round lotion remain outside this release.

## Exact release

`empire-round26-03baed749353` covers 14 Empire variants (12 sprays and two white pumps) and 12 Round 78 ml sprays. The first canary is `GBEmp50SpryMtGl` and `GBEmp100SpryMtGl`. Later modes include all 14 Empire variants, then all 26. The default is `off`.

The adapter uses the accepted assembly recipes for both PDP and Builder. It requires the current exact assembly, plate, body dimensions and full component definitions to match the captured source. A mismatch retains the previous rendering; strict cache loaders reject it rather than caching a partial release. Any mismatch blocks acceptance, even if the fallback looks usable. Catalog routing also requires the exact SKU and product group. No pricing, inventory, product facts, shared register components or Shopify images are patched.

The 100 ml Empire geometry is unchanged from the accepted 107 × 46 mm pilot. Dip-tube material rules, through-glass opacity, clipping and detached overcaps survive URL changes. The first inventory omitted a detached white-pump overcap dependency; the recursive dependency check now includes it.

All 60 source image references resolve to 57 immutable files under `public/media-releases/empire-round26-03baed749353/`. This includes the 14 previously hosted component/body images. Those 14 files match the actual byte hashes recorded during visual approval. Their filename hashes differ from their file hashes, so verification uses the preserved approval receipts. No source pixels were edited. A fresh verification receipt is in `remote-asset-verification.json`.

Serving the complete image bundle with the application replaces the earlier proposal to upload it into a Blob store. The isolated preview needs no shared storage write token or production image-store dependency. Existing `public/local-media/` and `output/` exclusions remain intact. Every shipped image belongs to this release scope.

## Preview setup

The local contact sheet is available with:

```sh
node scripts/media-release/review-server.mjs
```

Open `http://127.0.0.1:3010/`. It shows all 26 prepared catalog images and this plan. It is a local technical contact sheet, not a hosted storefront acceptance test. Existing review servers on ports 3007 and 3008 are unchanged.

The read-only hosting inspection found:

| Setting | Observed value |
| --- | --- |
| Existing project | `asala/best-bottles-website`, `prj_GHwEFaEB2YYcMKetaompX9fGC4mR` |
| Git repository / production branch | `asalastudio/best-bottles-website`, `main` |
| Production Convex URL | `https://precise-raccoon-123.convex.cloud` |
| Default preview Convex URL | `https://helpful-elephant-638.convex.cloud` |
| Preview credentials | Inherits `SHOPIFY_ADMIN_TOKEN`, `BEST_BOTTLES_CONVEX_WRITE_TOKEN` and `CLERK_SECRET_KEY`, among other shared settings |
| Vercel Node version | `24.x`; existing CI pins `22.17.0`; local checks use `22.22.3` and the available `24.19.0` runtime |
| Project build setting | `npm run build`; repository `vercel.json` supplies `bash scripts/vercel-build.sh` |

A fresh public read-only `registerStage.forSkus` query accepted all 26 production sources with no mismatches. The existing preview accepted only the 12 Round variants: all 14 Empire rows have different plates, and the spray rows also have different components. See `live-source-check.json`. Neither backend was changed.

The two backend URLs differ, but that alone does not establish isolation. Shared write credentials make the existing preview unsuitable for this release as configured. Vercel's connector denied detailed access; the authorized read-only CLI inspection succeeded. Only non-secret metadata and the two public URLs were saved in `hosting-inspection.json`.

Prepare a **separate preview project**, proposed name `best-bottles-media-review`, with an isolated Convex backend and reviewed test catalog. Neither resource has been created. Use no production write/deploy credentials, live Clerk secret, Shopify admin/webhook token, production checkout integration or Blob token. Seed the isolated backend separately after approval; do not restore an entire production database or customer/order data. Do not use the captured commerce baseline as live storefront data.

`preview.env.example` records the public settings. `src/lib/media-release/preview-target.json` deliberately remains `verified: false`, with target IDs unset. Record the actual project ID, branch, isolated backend URL, production URL and verification evidence before enabling a hosted preview. The disabled-auth preview path now skips Clerk middleware before it checks credentials. Enabled authentication still enters the existing Clerk middleware and remains covered by the portal authorization tests.

The build fails if any of these do not match, if disallowed write credentials are present, if the register stage is disabled, or if activation is attempted in production. The check runs before any optional Convex deploy command and again in Next configuration.

The integration branch is explicitly excluded from automatic Git deployments in `vercel.json`. This is a local configuration change only; it has not been pushed. Vercel documents that exact branch exclusions prevent Git-triggered deployments while unspecified branches retain their existing behavior: [Git configuration](https://vercel.com/docs/project-configuration/git-configuration). After push approval, use a separately approved manual preview deployment to the verified project. If the branch is renamed, update and recheck that exact exclusion before pushing.

A local production-mode build can exercise the enabled adapter without credentials or a real backend:

```sh
python3 docs/reviews/empire-round-release-prep-2026-10-20/run-check.py active-build
```

This uses a placeholder Convex URL and cannot establish live storefront readiness. Local development pilots remain separate; this release flag is intentionally rejected by `next dev`.

## Cache and rollback behavior

The public build setting has four choices:

| Setting | Visible new media |
| --- | --- |
| unset or `off` | None; previous media behavior |
| `empire-round26-03baed749353:canary` | Two Empire Matte Gold sizes |
| `empire-round26-03baed749353:empire` | All 14 Empire variants |
| `empire-round26-03baed749353:all` | All 26 variants |

The setting is compiled into both server and browser bundles. Changing a dashboard variable alone does not activate or roll back an existing build. Rebuild and deploy the chosen mode, or restore a previously verified deployment containing that mode.

All three Builder data-cache keys and the PDP framing cache include the mode/revision. Families, bodies and kits requests include the same revision in the URL, so browser/CDN request caches cannot reuse another mode's URL. Responses identify their revision. A mismatched request receives an uncached 409. The new client rejects mismatched responses and asks an already-open Builder loaded from this revision-aware code to refresh. Tabs running older, pre-protocol JavaScript may require a manual reload; include those tabs in hosted acceptance and deploy the off-mode baseline before activating media. Existing clients may finish using their already-cached old images; keep all old assets available. A rollback to code predating this revision protocol requires a full browser reload and separate hosted testing.

Before a hosted canary:

1. Build, deploy and record an **off-mode rollback deployment using this code**, with its commit, environment, backend identity and deployment ID. Warm it and test it. This avoids relying on pre-protocol code for ordinary rollback.
2. Build the two-SKU canary separately. Verify every intended source guard, asset hash, exact SKU and cart identity, desktop/mobile picker, PDP cap-on/sidecar/exploded view and Builder stage. Compare all three surfaces with the accepted local reviews.
3. Exercise `off → canary → empire → all → off` on the isolated preview. Include warm server/CDN caches and a Builder tab opened before each change. Verify rejected mixed revisions and the refresh flow. Confirm held and unrelated variants are unchanged.
4. Capture the actual deployment IDs and results in `rollback-receipt.template.json`. The local unit rehearsal is not a substitute for this hosted exercise.

If acceptance fails, stop expansion. Return the preview/application alias to the recorded off-mode deployment, or rebuild this code with `off`. Verify its response revision and representative products. Keep all immutable image objects. No media-record rollback or database restore is needed because this release writes no product records. Preserve the widened Convex `ring` validators during any later application rollback; this media release contains no ring data and does not authorize a schema narrowing.

Stop on wrong product/cart identity, an unavailable or changed asset, source-guard rejection, mixed revisions, visual discontinuity, any held-family change, or failed acceptance check.

## Approval and remaining engineering work

The local preparation and checks are authorized and do not require another approval. The following external actions remain unapproved:

1. Create/configure the dedicated preview project and isolated backend, seed only the approved test catalog, and verify the target record. Do not modify the existing production project settings.
2. Push the reviewed integration commit and open the replacement draft PR, retaining PR #369 until its disposition is agreed. The exact branch auto-deployment exclusion must be present. No merge is included.
3. Deploy the prepared bundle manually to the verified preview and complete hosted acceptance plus rollback rehearsal. The preview project must use a checked Node version. Node 24.19.0 is available locally for verification against the production Node 24 setting; the existing CI remains pinned to Node 22.17.0. Record the actual hosted runtime in the preview evidence.
4. Only after that evidence exists: separately authorize the exact production commit, deployment targets, additive Convex changes if still included, two-SKU canary, expansion stages and rollback. The current build gate intentionally blocks that activation until the production packet is approved and the gate is deliberately updated.

The full branch contains inherited renderer, Builder, footer/help and additive Convex changes beyond these 26 media recipes. The [previous Convex review](../production-media-release-2026-10-20/CONVEX-REVIEW.md) still applies; this technical preparation makes no further Convex changes. The exact-SKU allowlist limits this media activation, not the scope of the entire application diff. Review the complete PR before merge.

Diva is held for source/fit verification. Round lotion is also excluded from this release. No further visual decision on those families is needed to prepare the 26-SKU preview.

## Reproduction and evidence

- `python3 scripts/media-release/prepare.py`: deterministic package generation from preserved approvals. It verifies copied bytes and does no remote writes. A clean clone can recover source inputs from the committed immutable bundle.
- `node scripts/media-release/verify-assets.mjs`: verify all bundled bytes and decodability locally.
- `node scripts/media-release/verify-assets.mjs --remote`: optionally recheck the 14 existing public URLs against their approval hashes; reads only and saves a local receipt/cache.
- `run-check.py`: sanitized typecheck, lint, full tests, explicit historical media replay, enabled build and off build. The `node24-` prefix selects the installed Node 24 runtime. No deploy commands or credentials are loaded.
- `python3 scripts/media-release/exercise-built.py active` (or `off`, after the corresponding build): temporary loopback Next server; version-conflict and asset-delivery checks without backend requests. An optional second argument selects the Node binary.
- `tests/media-release.test.ts`: scope, all 26 accepted recipes, catalog routing, material identity, asset hashes, source mismatch, out-of-scope preservation, rollback and build gates.
- `node --import tsx scripts/media-release/audit-sources.ts`: bounded public media-source queries against the two verified existing backend URLs; no writes. It intentionally exits nonzero when either source set mismatches.
- `tests/media-release-client.test.tsx`: already-open client rejects the wrong revision and enters the refresh state.

Check receipts and logs in this folder distinguish completed local checks from outstanding hosted validation. No hosted preview, real checkout, live-backend mutation, production acceptance or rollback is claimed.

## Completed local verification

| Check | Result |
| --- | --- |
| Final full suite on Node 24.19.0 | 3,147 passed, 42 skipped; 350 passing test files |
| Explicit historical media replay on Node 24 | 81 passed across 17 files, no skips |
| Enabled build on Node 24 | Passed, including TypeScript and 63 generated pages |
| Disabled rollback build on Node 24 | Passed, including TypeScript and 63 generated pages |
| Compiled app, enabled and off modes | All three Builder routes reject the wrong revision with uncached 409 responses; all 57 files retain their hashes in both modes |
| Browser contact sheet | 26 images loaded; desktop and 390 px mobile checked; no page errors, overflow or external image requests |
| Public source compatibility | Production 26/26; existing preview 12/26, with all 14 Empire variants rejected for source drift |
| Asset provenance | All 57 files checked; all 14 reused hosted files match preserved approval hashes |
| Lint | Full run: zero errors, 92 existing warnings; final changed-source check: zero errors or warnings |

The full suite and media replay overlap; their counts must not be added. Skipped live/service/source-dependent checks are not claimed as complete. The first Node 24 full run hit a five-second dynamic-import timeout in one mobile suite while a build ran concurrently. The isolated rerun and the final full run both passed without changing test timeouts. The built-app probe caught and then verified the disabled-Clerk fix.

The final local build is **off**. Temporary compiled-app servers have been stopped; the separate contact sheet on port 3010 remains available. Hosted CDN behavior, real storefront navigation and checkout, and the actual hosted rollback remain outstanding. The earlier Next/Sanity compatibility warning still calls for CMS smoke testing on the isolated preview.

`verification-summary.json` links the individual receipts. No external approval is inferred from these passing local checks.
