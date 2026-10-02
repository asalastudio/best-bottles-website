# Verification — FAQ policy parity, 2026-10-02

Environment: Node v22.22.3, npm 10.9.8, locked dependencies installed with `npm ci --no-audit --no-fund`. The isolated checkout was moved to `/tmp/bb-faq-parity-verify` (workspace link retained) to avoid an unrelated ancestor `Documents/node_modules/stylis/package.json` read blocking TypeScript. No dependency versions changed.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` on final source/tests | Passed, exit 0 |
| `npm run lint` | Passed, exit 0; 0 errors / 87 existing warnings |
| Scoped ESLint on changed TypeScript/TSX and prompt-channel regression | Passed, no warnings/errors |
| `npm run build -- --webpack`, with CI placeholder configuration | Passed, exit 0; 61/61 static pages; postbuild sitemap completed |
| Focused policy/page/channel/audit/resource regression run | 41/41 passed |
| Prior failing unrelated suites + policy/channel tests in isolation | 27/27 passed, including all 925 four-family records |
| Final `npx vitest run --maxWorkers=1` | Passed: 310 files / 2,851 tests; 2 files / 7 tests skipped; exit 0 (166.69s) |
| `git diff --check` | Passed |

Build variables matched `.github/workflows/ci.yml`: `NEXT_PUBLIC_SITE_URL=https://ci.example.com`, `NEXT_PUBLIC_CLERK_ENABLED=false`, public Sanity project `gh97irjh`/dataset `production`, `NEXT_PUBLIC_CONVEX_URL=https://ci-placeholder.convex.cloud`. No credentials or production deployment configuration were used. Expected warnings included missing `OPENAI_API_KEY` and transient connection attempts against the placeholder Convex URL; the build completed. Build-generated `next-env.d.ts`, robots, and sitemap changes were restored and are not included.

The first concurrent full runs hit unrelated timing failures in `focused-pdp-mobile-dom`, `four-family-reconciliation`, and once `vercel-preview-build`. A rerun of the five original failures passed after filesystem isolation. Full-suite results below use one worker after the build completed to remove resource contention; no timeouts, fixtures, or production logic were weakened to obtain a pass.

Parity coverage includes source snapshot SHA-256, critical policy values/conditions, topic routing, the actual Realtime server policy executor without live data queries, identical generated browser/text policy blocks, catalog-only fallback capabilities and API/action wiring, rendered Resources/Shipping & Returns/sample copy, and FAQ JSON-LD equality. This is deterministic code/integration coverage, not a claim that live deployed models have been evaluated.

No merge/deploy, Convex push, live LLM evaluation, checkout transaction, provider-setting change, or production mutation was performed. The PR remains a draft for coordinated integration and business review of source/configuration discrepancies.
