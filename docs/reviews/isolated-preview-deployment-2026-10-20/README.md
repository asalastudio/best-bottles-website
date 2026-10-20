# Isolated Empire and Round preview, 20 October 2026

Verified in the isolated preview. Ready for Jordan's review.

[Catalog](https://best-bottles-media-review-asala.vercel.app/catalog?category=Glass+Bottle) · [Empire Builder](https://best-bottles-media-review-asala.vercel.app/matrix?family=Empire) · [Round Builder](https://best-bottles-media-review-asala.vercel.app/matrix?family=Round)

The hosted preview requires your Vercel sign-in. The [local review page](http://127.0.0.1:3010/) remains available with the 26 catalog images and this report.

The integration branch is pushed: [`integration/local-media-main-2026-10-20`](https://github.com/asalastudio/best-bottles-website/tree/integration/local-media-main-2026-10-20). The deployed application package is from `2198126bf89e7a7961ac7ef1187eff8cac22e8db`; later evidence and review-script commits do not change the deployed app. No merge or deployment to the existing production project was performed.

The scope is 14 Empire variants, including the two white pumps, and 12 Round 78 ml spray variants. Diva and Round lotion remain on hold.

| Resource | Isolated target |
| --- | --- |
| Vercel | `asala/best-bottles-media-review`, `prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt` |
| Convex | `asala-team:best-bottles-media-review:dev/media-review` |
| Backend URL | `https://beloved-wildcat-265.convex.cloud` |
| Release | `empire-round26-03baed749353` |

The backend exposes 39 read-only queries through `preview-backend/convex`. It has no deployed mutation, action, HTTP handler, cron job or analytics/AI component. All 157 seeded records across nine tables still match the seed exactly, including IDs. Only the 26 bottle variants and six supporting sprayer products are present. No customer or order data was imported.

The frontend package retains the 57 immutable release images, the eight previous tube images needed for both rollback views, the previous catalog heroes, shared interface assets and runtime helper dependencies. The package excludes local review archives and PSD/3D source libraries. Its Vercel cron configuration is omitted. Production source configuration is preserved.

| Mode | Active release variants | Deployment | HTTP acceptance |
| --- | ---: | --- | --- |
| off | 0 | [dpl_B5Wm8yc1RtFHtRTJPCbKkJPno5ch](https://best-bottles-media-review-d2cjq6sql-asala.vercel.app) | HTTP passed |
| canary | 2 | [dpl_CsJiwZLpTPwttS7Zi9L3b5FHVGtu](https://best-bottles-media-review-db3iap83l-asala.vercel.app) | HTTP passed |
| empire | 14 | [dpl_Dn1V3gye44tUZau7Yy6MZHANP7kd](https://best-bottles-media-review-ae199i9sk-asala.vercel.app) | HTTP passed |
| all | 26 | [dpl_H2DazCqcMZdA6S22hQB9STRUn73Z](https://best-bottles-media-review-c2u7ho0v8-asala.vercel.app) | HTTP passed |

Every passed mode checks all 26 exact SKU/variant identities using the read-only validation endpoint, verifies the expected active-media count, warms the Builder cache, checks kit-image hashes, and rejects mixed revisions with HTTP 409 and `Cache-Control: no-store`. The all-26 mode additionally hashes all 57 immutable files over hosted HTTP.

Browser verification selected all 26 catalog finishes, changed all 26 product-page finishes, and assembled all 26 Builder variants. Desktop and mobile screenshots are saved in this folder. Page errors: 0. Failed page/media responses: 0. Framework prefetch requests for the XML sitemap are recorded separately; the direct sitemap request is checked for HTTP 200 and valid XML. See [the browser receipt](hosted-browser.json).

Review images: [catalog overview](catalog-overview.png), [Empire 100 ml exploded](pdp-GBEmp100SpryMtGl.png), [100 ml white pump](pdp-LBEmp100WhtClOvrCp.png), [Round frosted Builder](builder-GBRndFrst78SpryShnSl.png), and [mobile Round Builder](mobile-builder-GBRndFrst78SpryCu.png). Representative screenshots were visually inspected in addition to the automated URL, decoding and hash checks.

Local checks: 3,149 tests passed, 42 skipped; TypeScript and focused lint passed. The first unrestricted test run timed out in one mobile test file. That file passed in isolation, and the full suite then passed with two workers and a 15-second per-test limit. The final full run includes the POST-header regression test.

The isolated alias was switched from all 26 variants to the retained off build, then restored to all 26. An existing Builder tab showed the refresh prompt after rollback; refreshing recovered the previous version. See [rollback.json](rollback.json), [the off-mode checks](hosted-rollback-off.json), and [the old-tab screenshot](rollback-old-tab-refresh.png).

To repeat rollback after approval, the fixed-target rehearsal script is `scripts/media-release/rehearse-preview-rollback.cjs`. It verifies both deployments belong to the isolated project and are Ready previews, changes only `best-bottles-media-review-asala.vercel.app`, checks the old-tab refresh, and restores the active preview even if a check fails. Both versions retain the old and new assets. No database restoration is required.

The existing production deployment remained `dpl_FZdQy7vDFtxNDCTqgZxMTWQTmk2G` and remote main remained `c0a861f85b0508304343c4202ccd2fa59c248f53` at the final check.

This is a catalog/media test environment. Checkout, customer accounts and AI services are not configured or accepted. Production rollout still requires separate approval of the release scope, any production Convex changes, and activation. The production media build guard remains in place. The review project has no Git connection, and the integration branch remains excluded from automatic deployments on the existing project.

The corrected setup issues are recorded in [setup-corrections.json](setup-corrections.json): first-deployment target behavior, omitted runtime helpers and rollback images, and POST headers when Clerk is disabled. No failed or incomplete build is claimed as the retained rollback version.
