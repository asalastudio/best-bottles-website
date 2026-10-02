# PostHog privacy boundary — draft review

Base: `008097682467abdd665354f7c0d870c09b6aa98e` (current main fetched October 2, 2026).

## Verified source risks

- `sessionReplayScope.ts` claimed to fail closed but returned true for any path outside its denylist, including new private routes.
- `analytics.ts` enabled autocapture, heatmaps and dead clicks globally; the provider applied route exclusions only to replay.
- Grace's public-page drawer can display conversations, uploads and an order list without a capture boundary. Input masking does not cover that rendered content.
- Explicit events passed searchTerm/query/suggestedQueries and arbitrary error text. SDK URL/DOM metadata could also carry free text.
- The Executive board described a present environment token as “Collecting”, without ingestion/recording health evidence.

These are source-level exposure paths, not evidence that private user data was actually recorded. No real user recording was viewed or captured in this task.

## Change scope

- `src/lib/analytics/sessionReplayScope.ts`: reviewed public-route allowlist, also used to construct the SDK autocapture URL allowlist. Unknown, malformed, authenticated, cart, and form routes fail closed. English and `/es` storefront routes are covered.
- `src/lib/analytics/capturePrivacy.ts`: shared event-time guard, URL query/hash removal, raw text/identity-property redaction, autocapture DOM exclusions, and replay masking/blocking.
- `src/lib/analytics.ts`: apply those constraints after optional init config, check routes both before queueing and when the SDK becomes ready, and expose explicit pageviews.
- `src/components/AnalyticsProvider.tsx`: scoped SPA pageviews/replay; stop sending name, email and signup date. Existing pseudonymous user IDs remain supported on reviewed public routes.
- `src/components/grace/GraceChatDrawer.tsx`: block the entire drawer, including its order-list UI.
- `src/components/grace/GraceChatMessage.tsx`: block user/assistant messages and streaming text, including message actions/uploads.
- `src/components/grace/GraceLayoutShell.tsx`: block private route content during rendering, before navigation effects run.
- `src/components/executive/ExecutiveBoard.tsx`: “Configured” with an explicit unverified note. Generic PostHog link retained because a verified project-specific URL was not available.

No `GraceProvider.tsx` or other source file from PR #350 is changed. No dependency/version, consent, vendor setting, activation, credential, paid-order telemetry, merge, or deployment change is included.

## Deliberate capture limitations

The pinned `posthog-js` 1.433.2 `Heatmaps._capture` buffers pointer data by full URL across route changes and provides no subtree ignore hook. This draft disables heatmaps and dead clicks and also rejects their outbound events. Re-enablement needs a separately reviewed overlay/buffer policy and synthetic verification. Existing public event counts remain available; raw DOM text/attributes are not analytics dimensions.

Replay masks all text and all string DOM attributes, blocks Grace/Clerk/private-route subtrees and hidden/file inputs, disables console/performance/JSON-LD collection, and rejects network payloads. This intentionally reduces replay visual fidelity (including image/style attributes). The masking callback retains only scrubbed public metadata URLs. Local settings take precedence over remote masking in the pinned SDK, but actual deployed behavior and recorder asset versions remain unverified.

New routes and new private overlays need review. The URL allowlist describes known public route shapes; it is not proof that a particular dynamic product/blog slug exists.

## Validation

Tests exercise unknown/private/localized routes, SDK-readiness races, URL and event redaction, privacy-config precedence, real pinned-SDK autocapture exclusions, actual rrweb serialization of synthetic private content, rendered route/drawer boundaries, and truthful status copy. All SDK transport calls are mocked or absent; no live project token is used.

- Focused privacy/replay checks passed, including direct tests against the pinned SDK and its rrweb serializer.
- Full suite: `npx vitest run --maxWorkers=4` — 311 files passed, 2 skipped; 2,869 tests passed, 7 skipped.
- `npm run lint` — zero errors, 86 existing warnings; focused lint on changed files — zero warnings/errors.
- `npx tsc --noEmit --typeRoots ./node_modules/@types` — passed.
- The production build compiled successfully with CI placeholder configuration; complete build validation remains pending its TypeScript phase at PR preparation.

An unrestricted parallel suite run timed out in two unrelated existing test files; both passed in isolation (9/9) and the complete four-worker rerun passed. No test timeout/configuration change is included.

 Normal local `tsc --noEmit` encounters missing implicit type packages under `/Users/jordanrichter/Documents/node_modules/@types`, outside this checkout. A checkout-local `--typeRoots ./node_modules/@types` run is used to isolate that environment issue.

## Remaining project-setting verification

Before any deployment/activation decision, verify with authorized read access:

1. Intended PostHog project ID/region and project-specific dashboard link, deployed public config, actual ingestion evidence and environment separation.
2. Existing consent implementation, opt-in/out behavior and DNT expectations; this draft changes none of them.
3. Remote replay enablement, sampling/URL rules, masking and recorder asset version, console/network settings, retention, access permissions and billing limits.
4. Synthetic browser proof of public → private → public navigation and Grace/auth/order-list overlays, checking outbound payloads before considering heatmaps/dead clicks.
5. A real source-backed health signal before replacing “Configured / unverified” with a collecting/healthy status.

The CRO measurement plan and any new Executive dashboard are separate work.

References: [PostHog replay privacy](https://posthog.com/docs/session-replay/privacy), [JavaScript configuration](https://posthog.com/docs/libraries/js/config), plus the installed SDK source/types used by the tests.
