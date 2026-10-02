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
| Final `npx vitest run --maxWorkers=1` | Passed: 311 files / 2,853 tests; 2 files / 7 tests skipped; exit 0 (168.12s) |
| `git diff --check` | Passed |

Build variables matched `.github/workflows/ci.yml`: `NEXT_PUBLIC_SITE_URL=https://ci.example.com`, `NEXT_PUBLIC_CLERK_ENABLED=false`, public Sanity project `gh97irjh`/dataset `production`, `NEXT_PUBLIC_CONVEX_URL=https://ci-placeholder.convex.cloud`. No credentials or production deployment configuration were used. Expected warnings included missing `OPENAI_API_KEY` and transient connection attempts against the placeholder Convex URL; the build completed. Build-generated `next-env.d.ts`, robots, and sitemap changes were restored and are not included.

The first concurrent full runs hit unrelated timing failures in `focused-pdp-mobile-dom`, `four-family-reconciliation`, and once `vercel-preview-build`. A rerun of the five original failures passed after filesystem isolation. Full-suite results below use one worker after the build completed to remove resource contention; no timeouts, fixtures, or production logic were weakened to obtain a pass.

Parity coverage includes source snapshot SHA-256, critical policy values/conditions, topic routing, the actual Realtime server policy executor without live data queries, identical generated browser/text policy blocks, catalog-only fallback capabilities and API/action wiring, rendered Resources/Shipping & Returns/sample copy, and FAQ JSON-LD equality. This is deterministic code/integration coverage, not a claim that live deployed models have been evaluated.

No merge/deploy, Convex push, live LLM evaluation, checkout transaction, provider-setting change, or production mutation was performed. The PR remains a draft for coordinated integration and business review of source/configuration discrepancies.

## Independent-review follow-up

Removed the remaining system-fit guarantee and static tolerance claim, changed absolute-fit sales examples to verified catalog compatibility, removed unverified screen/digital-printing minimums, and added a shared exception permitting customer-requested sample-email item codes only from verified `websiteSku` data (otherwise ask the team). The actual FormPage sample success branch now acknowledges receipt without a response-time promise.

`tests/faq-sample-success.test.tsx` mounts RequestSamplePage and the real FormPage, submits the form with a mocked persistence boundary, and asserts the actual success branch contains only the neutral receipt acknowledgement. It does not mock FormPage. Browser/text/voice prompt regressions reject the removed commercial guarantees and printing quantities and assert the narrow sample-code exception.

Fresh focused follow-up tests passed (21/21). The final full serial run passed 2,853 tests with 7 skips. An intermediate run cached the prompt before the last wording edit and failed the new absolute-fit regression; a fresh focused run and the final full run above verified the finished source. Typecheck and lint were rerun; lint remains 0 errors / 87 pre-existing warnings, and scoped follow-up lint is clean.

The follow-up production webpack build also passed on the finished source (exit 0): compilation in 117s, TypeScript in 35.8s, all 61 static pages generated, and postbuild sitemap completed. Generated environment/sitemap files were restored again. No runtime source changed during this final full-suite/build sequence.
