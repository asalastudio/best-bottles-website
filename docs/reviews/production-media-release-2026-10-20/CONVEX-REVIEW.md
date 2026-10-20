# Convex review for the media release

Reviewed locally against main `c0a861f85b0508304343c4202ccd2fa59c248f53`, using integration head `8312ccfc`. No production deployment or database query/mutation was performed. This is a review of the three changed Convex definitions and their immediate import/write paths, not a security audit of the entire backend.

## Verdict

The change adds `ring` to three slot unions: `convex/productKits.ts:22`, `convex/registerValidators.ts:22`, and `convex/schema.ts:23`. All 13 previous values remain valid. There are no changed indexes, required fields, auth policies, queries, migration scripts, or data writes in the diff.

The shared register validator propagates the new value to component layers, assembly build roles, and stage-return validation. A local probe checked five validator locations and the unchanged write-token checks on kit and register-assembly upserts. Incorrect tokens were rejected before database access; correct tokens with empty batches returned empty results. This does not substitute for deployed backend verification.

None of the 52 captured spray/pump assemblies contains a ring. Ring media, including the earlier ten local Diva jewelry candidates, is outside this release plan. The additive schema can accompany the eventual application deployment without publishing ring data; it is not a prerequisite for this media scope.

## Finding: ring importer is incomplete (P2, blocks future ring publication)

`scripts/register/registerRows.ts:20` still omits `ring` from `SLOTS`. `parseBuildParts` at line 139 validates against that list. The probe reproduced rejection of `ring:REVIEW-ONLY` while a sprayer role succeeded.

Effect: a standard CSV register upload cannot import ring assemblies even though the backend now accepts them. Local renderer tests synthesize ring candidates and therefore do not prove that the CSV publication path works. Keep ring writes out of the first release. Before a future ring release, update the importer enum and add a real ring-row import/validation test. No fix was applied in this review.

## Rollback constraint

Adding an enum member accepts the prior data shape. Removing it later is different: if ring-bearing rows have been written to `productKits.parts`, `registerComponents.layers`, or `registerAssemblies.build.parts`, the old schema may reject those rows. Convex validates existing documents when a schema changes. This rollback implication follows from the reviewed field definitions and [Convex schema validation](https://docs.convex.dev/database/schemas#schema-validation).

For a media rollback, keep the wider schema and restore the previous application media release and SKU mappings. Do not automatically redeploy an older backend commit. A later schema contraction would require a fresh read-only row inventory and a separately reviewed data conversion/restoration plan. Do not disable schema validation to force a rollback.

## Deployment order and boundaries

`scripts/vercel-build.sh:29` calls `npx convex deploy --cmd 'npx next build --webpack'` on main in the production environment. In the installed Convex CLI, `node_modules/convex/src/cli/lib/deploy2.ts:436` runs the build command before `runPush` at line 459. Thus a failed Next build does not reach that subsequent backend push. A successful backend push is still separate from final frontend activation by the host. Deployment and frontend rollback must account for these separate steps. See also [Convex with Vercel](https://docs.convex.dev/production/hosting/vercel).

The wrapper's preview path deploys a backend only when explicitly enabled and supplied a preview-scoped key. Otherwise it builds only the frontend. That does not prove the resulting preview reads an isolated backend; the preview URL/env configuration still needs inspection before pushing.

## Publication paths inspected

- `productKits.upsertMany` retains its write-token gate, 50-row bound, duplicate detection, and exact-SKU indexes. Reads return a kit only when its plate hash matches the published photograph. These protections are unchanged.
- Register mutations retain their shared token gate and batch limits. Shared plate/component IDs can be consumed by multiple products, so an apparently small record change can exceed a SKU release scope.
- `scripts/paperdoll/publish-kits.mjs` publishes legacy `productKits`, while the current PDP/Builder loader prefers register-composed kits. It is not a complete publisher for the new local adapters. A kit upload alone would not reliably activate the reviewed rendering.
- Multi-batch publishing is not one atomic release. The existing publisher records row errors and exits nonzero, but earlier successful rows can remain written. Any future data-writing release needs before-images, per-row outcomes, and a scoped restoration procedure.
- Body/component/assembly hash guards and plate matching must remain enforced. No wholesale register import, price/inventory update, schema migration, or ring publication is part of the proposed media activation.

## Evidence

Run `node --import tsx docs/reviews/production-media-release-2026-10-20/review-convex.mjs` to repeat the local probe. Results are in `convex-review-verification.json`. It intentionally reproduces and records the importer limitation without altering it. The full integration suite and production build passed in the preceding integration report; no application code changed during this review.
