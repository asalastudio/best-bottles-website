# Local integration verification, 20 October 2026

Current main integrated cleanly into `integration/local-media-main-2026-10-20`. All local CI checks and the production build passed. No push, PR merge, deployment, external media publication, or backend mutation was performed.

## Git state

- Tested integration commit: `30973905442e24c8a4dda42fde03d9d8ec32722c`.
- Main fetched directly from GitHub: `c0a861f85b0508304343c4202ccd2fa59c248f53`.
- Checkpoint branch remains at `04591a03e58d9f309118d6c3e6d8c720436f060d`.
- A local merge commit combines main with the checkpoint. There were no conflicts and no application fixes were needed.
- Main adds the legacy image mirror, its manifest, script, and tests. Existing checkpoint source, Convex files, media guards, and dependency lockfile were unchanged by integration.
- Next.js generated a production route-types import in `next-env.d.ts` during the build. That generated-only change was restored afterward; no application source change remains.
- The repository still has no configured remote. The direct fetch only read GitHub.

## Results

| Check | Result |
| --- | --- |
| Fresh `npm ci --no-audit --no-fund` | Passed, 1,799 packages installed from the lockfile |
| TypeScript `tsc --noEmit` | Passed |
| Full `npm run lint` | Passed, 0 errors and 92 warnings |
| Full Vitest run, four workers | 347 files passed; 3,137 tests passed; 42 tests skipped by existing gates |
| Explicit offline media replay | 17 files and 81 tests passed, no skips |
| Additional copper-cap snapshot check | 1 passed; source-pixel check skipped because its original source PNG is not available in this checkout |
| Local production build, `npm run build -- --webpack` | Passed |
| Legacy image mirror | All 350 files validated by four passing tests |

The replay overlaps the full suite; the counts must not be added as distinct test totals. It exercises 33 of the default suite's skipped checks, and the copper snapshot run exercises one more. Eight checks remain unexecuted: six opt-in live Grace service tests, one copper source-pixel test, and one Madison source-CSV documentation test. See `skipped-tests.json` and the logs for the exact gates.

The validation environment used Node 22.22.3 and npm 10.9.8. CI currently pins Node 22.17.0. This run used a fresh independent dependency install and the CI compiler and placeholder public configuration. Only a small allowlist of process environment variables was inherited; no application credentials or `.env.local` were loaded. OpenAI and Sentry credential warnings are expected in this isolated run. The build ran Next.js directly, not the Vercel wrapper that deploys Convex.

## What needs attention

1. **The new media is still local-only.** Development guards and `.vercelignore` exclusions remain intact. A merge alone will not publish the 52 new catalog images or their corresponding assemblies. Production needs a reviewed hosted asset release, exact SKU mappings across catalog/PDP/Builder, and rollback to previous mappings.
2. **Approval and source-fit records need closure.** The latest Round 78 lotion report still marks twelve variants pending visual acceptance. Diva's local visuals were accepted, but its Round-derived dip tube has not received new physical-fit verification. Resolve or explicitly accept that presentation limitation before publishing it. Passing tests does not supply visual approval or physical measurements.
3. **Production build includes a backend deployment.** The inherited PR adds `ring` to the kit slot unions in `convex/schema.ts`, `convex/registerValidators.ts`, and `convex/productKits.ts`. These are additive validators, not a migration executed during this run. The main Vercel build invokes `convex deploy`, so the eventual release still needs backend review and a rollback decision.
4. **Lint warnings remain.** There are 92 warnings, with seven located in files changed by the media branch. Those seven are unused test bindings; file-level comparison does not prove when each warning was introduced. Warnings do not fail the current CI command. This pass did not change unrelated code to remove them. `lint-inventory.json` records every warning.
5. **The dependency install flags a compatibility warning.** npm reports that `next-sanity@12.4.5` is not recommended with Next.js 16. The install and production build passed, but CMS/preview behavior should be checked on the hosted candidate before release. No dependency upgrade was made during integration.
6. **Hosted and buyer-flow checks remain.** This proves local compilation and automated behavior with captured fixtures and mock services. It does not verify a hosted preview, live CMS/auth/Grace integrations, a buyer checkout, or production image delivery. Those should be checked on the exact release candidate before production approval.

## Reproduce

From this repository, run `python3 docs/reviews/local-media-integration-2026-10-20/run-check.py <check>` with `typecheck`, `lint`, `tests`, `media-replay`, `copper-snapshot`, or `build`. Re-running writes fresh logs and receipts beside the runner, so preserve these dated results first. The commands and exit codes are also saved independently in each check's JSON receipt. The portable media runner remains `node scripts/verify-local-media-checkpoint.mjs`.

The next step is to review these results and prepare the hosted media release while retaining the current local guards. Push, PR merge, and production publication remain pending.
