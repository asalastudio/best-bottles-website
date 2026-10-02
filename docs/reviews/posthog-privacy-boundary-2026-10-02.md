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
- `src/lib/analytics/captureIdentity.ts`: local auth-context revisions reset stale persisted identity/groups on login/logout/user/organization changes, including blocked routes; bind only on public routes after auth resolves; discard queued events from older identities. Organization IDs are not transmitted.
- `src/lib/analytics/capturePrivacy.ts`: shared event-time guard, URL query/hash removal, raw text/identity-property redaction, autocapture DOM exclusions, and replay masking/blocking.
- `src/lib/analytics.ts`: apply those constraints after optional init config, check routes both before queueing and when the SDK becomes ready, and expose explicit pageviews.
- `src/components/AnalyticsProvider.tsx`: scoped SPA pageviews/replay; stop sending name, email and signup date. Existing pseudonymous user IDs remain supported on reviewed public routes.
- `src/components/grace/GraceChatDrawer.tsx`: block the entire drawer, including its order-list UI.
- `src/components/grace/GraceChatMessage.tsx`: block user/assistant messages and streaming text, including message actions/uploads.
- `src/components/grace/GraceLayoutShell.tsx`: block private route content during rendering, before navigation effects run.
- `src/components/executive/ExecutiveBoard.tsx`: “Configured” with an explicit unverified note. Generic PostHog link retained because a verified project-specific URL was not available.

No `GraceProvider.tsx` or other source file from PR #350 is changed. No dependency/version, consent, vendor setting, activation, credential, paid-order telemetry, merge, or deployment change is included.

## Deliberate capture limitations

**Temporary privacy gate, not delivered heatmap visibility:** public heatmaps/dead clicks remain an unmet part of the broader request. A safe mechanism must retain public-page points while excluding private overlays and preventing buffered points from crossing route/overlay boundaries before eventual activation. No capture re-enablement is included.

The pinned `posthog-js` 1.433.2 `Heatmaps._capture` buffers pointer data by full URL across route changes and provides no subtree ignore hook. This draft disables heatmaps and dead clicks and also rejects their outbound events. Re-enablement needs a separately reviewed overlay/buffer policy and synthetic verification. Existing public event counts remain available; raw DOM text/attributes are not analytics dimensions.

Replay masks all text and all string DOM attributes, blocks Grace/Clerk/private-route subtrees and hidden/file inputs, disables exception/console/performance/JSON-LD/font/canvas collection, and rejects network payloads. This intentionally reduces replay visual fidelity (including image/style attributes). The masking callback retains only scrubbed public metadata URLs. Local settings take precedence over remote masking in the pinned SDK, but actual deployed behavior and recorder asset versions remain unverified.

## Independent-review corrections and remaining proof limits

The initial draft dropped identity calls on private routes while remembering the user as identified. The corrected lifecycle waits for auth, resets previous identity even on private routes, retries binding on public return, and rechecks queued calls against the latest auth revision. Synthetic tests cover blocked-route login/logout, user/organization changes, delayed SDK loading, stale queued events, and actual provider dependency wiring.

A follow-up review found that unconditional first-reconciliation reset split anonymous sessions on hard reload. The first reconciliation now preserves only an explicitly anonymous UUID identity with no user/alias/group residue in persistent or session state. Ambiguous/stale identified state and subsequent auth transitions still reset. A synthetic hard reload with actual `posthog-js` instances sharing test-only browser storage proves both distinct ID and session ID continuity.

The pinned SDK's `reset()` also calls `consent.reset()`. The auth reset adapter temporarily suppresses only that synchronous method and restores it in `finally`; it does not call opt-in/out or write consent settings. Actual-SDK tests prove stale identity removal while preserving granted/denied/pending consent, and prove method restoration plus capture blocking on failure. **Compatibility constraint:** this is deliberately coupled to `posthog-js` 1.433.2's synchronous reset implementation; SDK upgrades require revalidating these tests/semantics. A supported vendor consent-preserving reset option would be preferable if one becomes available.

The pinned exception observer follows remote settings when `capture_exceptions` is omitted. It is now explicitly false; the outbound boundary rejects `$exception` and exception properties and drops arrays (none are in the adapter's explicit event schemas). A synthetic test exercises the actual pinned exception configuration resolver with remote enablement set true.

The rrweb test now inspects **all emitted events** from the exercised full-snapshot and incremental text/attribute/blocked-subtree mutation scenarios, including added style/canvas nodes. A separate test exercises the actual SDK replay URL-mask method. These are bounded synthetic proofs: they do **not** establish end-to-end privacy for compressed outbound transport, every CSSOM mutation, third-party plugins/custom rrweb events, or future/unversioned remotely served recorder assets. Canvas/media/style/script nodes are blocked, network payloads rejected, and several optional streams disabled, but complete browser/transport validation remains required before activation or relaxing these gates. No actual private replay was inspected.

Grace tool/no-match events also construct explicit payloads and admit only known catalog family vocabulary; model-supplied search, suggestions and error codes are omitted.

New routes and new private overlays need review. The URL allowlist describes known public route shapes; it is not proof that a particular dynamic product/blog slug exists.

## Validation

Tests exercise unknown/private/localized routes, SDK-readiness races, URL and event redaction, privacy-config precedence, real pinned-SDK autocapture exclusions, actual rrweb serialization of synthetic private content, rendered route/drawer boundaries, and truthful status copy. All SDK transport calls are mocked or absent; no live project token is used.

- Focused privacy/replay checks passed, including direct tests against the pinned SDK and its rrweb serializer.
- Full suite: `npx vitest run --maxWorkers=4` — 314 files passed, 2 skipped; 2,882 tests passed, 7 skipped.
- `npm run lint` — zero errors, 86 existing warnings; focused lint on changed files — zero warnings/errors.
- `npx tsc --noEmit --typeRoots ./node_modules/@types` — passed.
- On the initial head, the production build compiled successfully with CI placeholder configuration, then stalled in its TypeScript phase. The local build was stopped; complete production build validation remains unverified. Standalone checkout-local typechecking passed. The subsequent remote CI build and Vercel preview for `8d61b06` both completed successfully; that result does not certify later review-fix commits.

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
