# Isolated preview setup, 20 October 2026

The preview project and test database are provisioned. The database is seeded and verified. No Git push, application/backend code deployment, merge, production mutation or media activation has occurred. Diva and Round lotion remain held.

| Resource | Verified setup |
| --- | --- |
| Vercel project | [asala / best-bottles-media-review](https://vercel.com/asala/best-bottles-media-review), `prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt` |
| Vercel isolation | No Git connection, zero deployments, no assigned deployment targets, all deployment URLs protected by Vercel authentication |
| Build settings | Next.js, Node 24.x, `npm ci`, `npx next build --webpack` |
| Convex project | [asala-team / best-bottles-media-review](https://dashboard.convex.dev/t/asala-team/best-bottles-media-review/beloved-wildcat-265) |
| Test backend | `asala-team:best-bottles-media-review:dev/media-review`, `https://beloved-wildcat-265.convex.cloud`, US East |
| Backend status | 157 rows in nine catalog/media/fitment tables, zero application functions, zero environment variables |
| Media status | `off`; production activation remains blocked |

Convex calls an allocated database instance a deployment. Only that empty infrastructure was provisioned and then seeded. No schema, functions, cron jobs, actions or HTTP handlers have been deployed. Consequently this is not yet a working hosted storefront. The existing production and shared preview projects were not changed.

## Configuration

Only these four public values are present in the new Vercel project's **Preview** environment:

```text
NEXT_PUBLIC_BB_MEDIA_RELEASE=off
NEXT_PUBLIC_REGISTER_STAGE=on
NEXT_PUBLIC_CONVEX_URL=https://beloved-wildcat-265.convex.cloud
NEXT_PUBLIC_CLERK_ENABLED=false
```

There are no application credentials, Shopify store domain, Storefront token, live Clerk secret, backend deploy key, storage token or production write token. No environment settings were copied from the existing project. The independent checkout was not linked to Vercel or switched to a different default Convex backend.

`src/lib/media-release/preview-target.json` now records the actual IDs and evidence. `isolationVerified` is true, while `verified` deliberately remains false because backend functions and hosted acceptance are pending. Enabling the media release still fails the readiness gate. The review project has no Git connection, so pushing a branch cannot trigger this project's deployment. The existing integration-branch Git deployment exclusion remains in the local source.

## Test data and checks

The seed contains exactly 26 approved bottle variants: 14 Empire variants, including two white pumps, and 12 Round 78 ml sprays. Six supporting sprayer product records are necessary for the Builder's component lookup. These are dependencies, not additional bottle releases. Six bottle groups contain only the selected variants.

| Table | Rows |
| --- | ---: |
| products | 32: 26 bottles and six sprayer components |
| productGroups | 6 |
| registerAssemblies | 26 |
| registerBodies | 3 |
| registerBodyPlates | 4 |
| registerComponents | 6 |
| productKits | 26 |
| productPlates | 26 |
| fitments | 28 |

Only bounded, indexed, sandboxed read-only source queries were used. No full production export or customer, order, user, auth or secret tables were copied. QuickBooks prices and Shopify inventory item IDs were removed. Group counts and ranges reflect the scoped catalog. Supporting component group references were omitted so unrelated groups are not introduced.

Public product identities and Shopify variant IDs are retained for exact-SKU matching. Price and stock fields are captured display data for this test, not live commerce. No store domain or checkout credentials are configured. Shared component layer definitions and generic fitment rules are retained as media dependencies; they do not introduce Diva or Round lotion product records.

The local Convex test loads the seed against the real schema and verifies all 26 source guards, all 26 Builder configurations, both bottle families and all six product-page group queries. Every imported row was read back from the isolated backend and matched against the seed, including IDs and references. `isolation-verification.json` records table hashes, resource metadata, public environment values and the absence of application functions.

- `test-catalog.json`: reviewed scoped seed, with the limited sanitization above.
- `test-catalog.zip`: imported file, with IDs preserved for group references.
- `seed-manifest.json`: exact counts, exclusions and file hashes.
- `tests/media-isolated-seed.test.ts`: local schema and query rehearsal.
- `scripts/media-release/verify-isolated-setup.py`: repeatable read-only checks, fixed to these isolated targets. Run from the repository root before code deployment. It intentionally expects zero deployed functions at this stage.

The import used the fully qualified new development selector, with no replace/delete flags. [Convex documents seed imports and preservation of IDs](https://docs.convex.dev/database/import-export/import). Vercel authentication is configured for all deployment URLs; its hosted behavior still needs a first deployment to test. [Vercel protection documentation](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

## Review boundary and rollback

Next approval must cover the exact branch push/draft PR and code deployment to these two isolated targets. Before the first backend deployment, review the backend function, cron and integration scope; the current full branch includes more than media work. Do not supply production credentials to make a preview function pass. No live checkout or ordering test is authorized here.

After that approval, deploy backend code to the exact development selector, verify all 26 source queries remotely, and record readiness before enabling media. Deploy and retain an **off-mode** application first, then rehearse the two-SKU canary, 14 Empire, all 26, and back to off. Keep the project disconnected from Git unless a later explicit decision changes that setup. The original [cache and rollback plan](../empire-round-release-prep-2026-10-20/README.md#cache-and-rollback-behavior) remains in force.

There is currently no hosted app to roll back. Leave media off and stop if setup review fails. Preserve the seed and immutable images; no production restoration is needed. Any later seed replacement is limited to this test backend and requires a reviewed operation. Do not narrow the additive Convex ring schema during an application rollback.

Local verification passed: eight scoped tests, TypeScript, changed-test lint, and desktop/mobile contact-sheet checks. All 26 images loaded and all 57 served asset hashes matched; there were no page errors, external requests or mobile overflow. See `local-checks.json` and `local-review-browser.json`.

Hosted catalog/PDP/Builder navigation, CDN behavior, stale browser tabs and the deployment rollback rehearsal remain pending. The local test is evidence that the scoped dataset works with the current code, not proof of a hosted release.
