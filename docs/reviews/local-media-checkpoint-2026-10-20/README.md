# Local media Git checkpoint, 20 October 2026

This checkpoint preserves the local Empire, Round 78 ml, and Diva 46 ml work. It is not a production release. No push, merge, deployment, media publication, or backend mutation was performed.

## Recovery locations

The self-contained repository is beside the verified preservation archive, under:

`/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/git-checkpoint-20261020/`

The branch is `checkpoint/local-media-2026-10-20`. Its base is `a892d9b0016a164918a373829490b255bf0fba62`, the previously inspected head of draft PR #369. The checkpoint has no configured remote. The original running checkout at `/private/tmp/best-bottles-empire-alpha-20261019` is unchanged.

`local-work-preservation.tar.gz` contains 4,993 files, representing 1,943,288,717 source bytes. Its SHA-256 is `dd81bd7a24e76e0aecf92784deb973ef729e673f3302af94d666216b9d995345`. Every archived member was read back and checked against its source hash. The archive contains the original modified/untracked working files, ignored output evidence including the local replay baseline, complete review pages and bundles, and external helper scripts. See `preservation-manifest.json` for every path and hash.

The archive has `working/`, `review/`, and `external-tools/` prefixes. Restore into a new directory, never over a running checkout. `working/` is an overlay on the recorded base commit, not a complete repository. Git history and the base tree are retained in the independent repository. The original review site remains at the sibling `empire-pilot/` directory.

Credentials were not copied or committed. `.env.local` remains in the original checkout. Dependencies, build caches, and TypeScript caches are regenerable and excluded. Native PSD masters remain at their original source locations, including Achive; their provenance is preserved. This checkpoint is a local recovery copy on the same computer, not an off-device backup.

## Commit inventory

| Commit group | Scope | Status |
| --- | --- | --- |
| Selector fixes | Distinguish ivory gold/silver collars and explicitly described short/tall caps; regression tests | Committed locally |
| Media consistency | Empire geometry/tubes/pumps, Round and Diva assemblies, 52 catalog mappings, source receipts, regression tests; all 81 newly created media files retained including intermediate candidates | Committed locally |
| Replay and evidence tooling | 24 captured snapshot/before-kit fixtures, Empire replay fixture, original capture scripts, external helpers, documented offline runner | Committed locally with this inventory |
| Historical visual evidence | Screenshots, intermediate renders, complete review pages, prior bundles and logs | Preserved in verified archive; indexed in Git |

The first two commits are `a4b2ad0a` and `fcdb76d8`. Use `git log --oneline a892d9b0..HEAD` for the complete checkpoint sequence.

`implementation-files.json` records the 144 original modified/new implementation files and their preserved hashes. `media-files.json` lists all 119 local-media files. A direct source reference is a mechanical string match, not proof of approval, active runtime use, or release readiness. No intermediate asset was deleted.

## Family readiness

| Batch | Catalog variants | Local visual status | Remaining release gate |
| --- | ---: | --- | --- |
| Empire 50 / 100 ml sprays and white pumps | 14 | Accepted in conversation | Hosted comparison, current-main integration, production routing |
| Round 78 ml sprays | 12 | Accepted in conversation | Hosted comparison, current-main integration, production routing |
| Diva 46 ml sprays | 12 | Accepted in conversation | Clarify source reuse / physical fit for the Round-derived dip tube; hosted release checks |
| Round 78 ml lotion | 14 | Shiny Silver pair accepted; latest report still marks the other 12 pending | Record final visual acceptance and complete hosted release checks |

52 catalog variants are included. Previous functional review covered 157 selectors across the broader three-family scope; this is not a claim that every product in the store has completed its media review. No new physical measurements or visual approvals were inferred during checkpointing.

## Verification

Run `npm ci`, then `node scripts/verify-local-media-checkpoint.mjs`. The runner explicitly activates all required fixtures, supplies the ignored Empire replay file temporarily, and removes that file afterward. It refuses to overwrite a different existing replay file. The captured product snapshots are historical test inputs, not a production database import.

Fresh checkpoint verification: 17 test files, 81 tests passed, with no skipped tests in this selected suite. TypeScript `--noEmit` passed. Targeted ESLint exited zero with 19 warnings, including scripts ignored by the repository configuration and unused test bindings. The full suite, full lint, production build, fresh dependency install, hosted browser comparison, checkout, and live production checks have not been performed for this checkpoint.

Validation reused the original checkout's installed dependencies through a temporary ignored symlink; this is removed after verification. Reinstall from the lockfile for independent integration validation. External helper scripts retain original absolute paths for fidelity and are historical evidence, not portable release commands. `dump-kit.mts` is preserved byte-for-byte as `dump-kit.mts.txt` so its ad hoc imports do not enter the application's TypeScript build. The original filename is retained in the archive.

## Before push or merge

1. Review the staged commit scope and the latest lotion acceptance. Do not rewrite approval history from passing tests.
2. Reconcile with current `main` in a separate integration branch. At the planning check, PR #369 was 13 commits ahead and one behind; the missing main commit preserves 350 legacy image URLs. Refresh that comparison before integration.
3. Review the inherited PR changes, including Convex schema/validator/kit changes. The main production build deploys Convex as well as the frontend.
4. Keep development guards and `.vercelignore` exclusions intact. A production media release requires explicit hosted assets and exact SKU mappings across catalog, PDP, and Builder. Merely merging this checkpoint will not publish the new local media.
5. Run full CI and review a hosted preview with verified backend isolation. Preserve previous mappings and prove rollback before requesting production approval.

No remote is configured intentionally. Adding a remote, pushing, updating PR #369, merging, or publishing is outside this checkpoint action.
