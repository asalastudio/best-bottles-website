# Launch read authorization: scoped fix and remaining gates

Source audit against `5abf5205`, October 2026. No live private data was queried. This change is not a complete backend security sign-off.

## Guarded in this change

The existing `BEST_BOTTLES_CONVEX_WRITE_TOKEN` authenticates trusted server calls. The Next.js server resolves customer identity and active organization from Clerk and gates staff-wide reads. Convex rejects missing, wrong, and unconfigured credentials before database access. No new secret, identity provider, auth setting, schema, or migration is required.

| Module | Protected read exports |
| --- | --- |
| `convex/graceSessions.ts` | `listByOrg`, `listForViewer`, `getForViewer` |
| `convex/portal.ts` | `getShellData`, `getAccountByOrg`, `listPortalAccounts`, `getAccountByShopifyCustomerId`, `getDashboardData`, `listOrdersByOrg`, `getOrderForOrg`, `listDraftsByOrg`, `listGraceProjectsByOrg`, `getGraceWorkspaceByOrg`, `getDraftById`, `getTeamHubQueues` |
| `convex/resaleCertificates.ts` | `listCertificatesByOrg`, `getActiveCertificateForOrg`, `listPendingCertificates`, `listAllCertificates` |

All 19 remain callable through their intended server callers. Portal/certificate reads use `serverQuery` from `convex/portalAuth.ts`, so the credential check cannot be forgotten in an individual handler. Clerk claims are not configured directly in Convex; this is authenticated server delegation, not a new Convex JWT membership system. A server with the credential is trusted to supply verified scope.

Transcript summary and detail access use the same rule: the active organization's sessions, plus the viewer's own sessions without an organization. Former/inactive organization sessions do not reappear through the by-user summary query.

The workspace's former browser account/project queries now use `/api/grace/workspace-account`. It accepts no identity or organization input, resolves Clerk scope itself, and returns only company/tier and project name/time/count. Responses are private/no-store. The client hides stale data on user/org changes, aborts old requests, and refreshes on focus and every 30 seconds while visible. No backend credential goes to the browser.

## Integration and rollback

1. Coordinate with the parent launch task after the Grace retrieval release; do not independently merge or deploy this branch.
2. Verify the existing portal credential is already consistently configured in the target frontend and backend environments without displaying its value. If it is missing or inconsistent, fail closed and obtain explicit authorization before any credential/security-setting change.
3. Deploy the protected Convex contracts and matching frontend together. The existing production build script combines Convex deployment and Next build. For separate steps, secure Convex first and then promote the frontend: old callers fail closed during the gap. New frontend callers against old Convex also fail argument validation. A frontend-only preview against old/shared Convex therefore cannot validate these private flows.
4. Validate the coordinated deployment with an authorized synthetic account/organization, including customer and staff flows. Do not use real private transcripts, permits, or customer records as test fixtures. No backfill or database migration is needed; the backfill script has only a token-argument compatibility edit and was not executed.
5. The source baseline is `5abf5205`; operational rollback must preserve intervening approved releases rather than redeploying that older tree. Reverting the security commits would reopen unauthorized reads. Prefer retaining the secured backend during a frontend rollback (private panels temporarily unavailable), or roll forward a compatibility correction. Do not restore an unauthenticated read fallback.

## Remaining launch security gates (separate coordinated hardening)

The following findings were made from source, not live invocation. They remain outside this patch by explicit parent coordination to avoid changing GraceProvider while its retrieval release is in flight.

| Surface | Source evidence | Required compatibility and recommended boundary |
| --- | --- | --- |
| Grace memory | `convex/graceMemory.ts`: `getByOwner` and `upsertNote` accept an arbitrary `ownerKey`; profile/correction/destination data can be read or overwritten. Browser callers are `src/lib/grace/useGraceMemory.ts` and `src/components/grace/GraceProvider.tsx`. | Keep anonymous memory working through reloads and optional sign-in. Establish a server-verified guest capability and Clerk-derived signed-in identity; verify ownership for both reads and writes. A string such as `user:...` or `org_...` is not proof. Define guest-to-user ownership transfer before any migration. |
| Shortlists and sharing | `convex/graceShortlists.ts`: `getByOwner` trusts the key; create/add/remove/mint operations lack ownership checks. `getByToken` intentionally shares but returns the full document, including `ownerKey`. Browser mutations live in GraceProvider. | Preserve guest shortlist creation and existing public read-only sharing. Authorize all mutations, use cryptographically strong opaque share capabilities, and return a narrow shared projection without private owner keys or unrelated metadata. Reading a shared list must never grant write authority. |
| Session traces | `convex/graceSessionTraces.ts`: `listRecentByOwner` and `record` trust `ownerKey`; rows include tool summaries, destination URLs, and telemetry. `record` also prunes prior rows for that key. Browser recording is in GraceProvider. | Preserve anonymous no-transcript telemetry and retention limits. Use the same verified guest/user boundary; prevent cross-owner reads, forged recordings, and pruning another owner's history. |
| Uploads | `convex/graceUploads.ts`: `listByOwner` trusts the owner key; `getUrl` resolves an arbitrary storage identifier. Writes already require the server credential, via `src/app/api/grace/upload/route.ts`. | Preserve anonymous reference-image/logo uploads and rendering. Bind registration and lookup to verified guest/user ownership; define which renderer/share capabilities may resolve a file. Do not treat knowledge of a database ID as membership. Do not fetch real customer files when verifying. |
| Internal audit results | `convex/graceAudit.ts`: `getRun`, `listRuns`, `latestRun` are public without a gate; start/result/finish mutations also require review. `src/components/executive/GraceAuditPanel.tsx` directly queries latestRun while `src/app/api/executive/grace-audit/route.ts` gates its route handlers. | Preserve the executive audit panel and automation callers through authenticated server endpoints; require the staff/executive gate before applying the existing server credential. Guard backend mutations as well as reads and keep audit data out of unauthenticated client queries. |

Other checked sensitive-read modules already have token guards: knowledge operations, platform health, staff product edits, and component reconciliation. No public query exports for raw conversation/message tables or form submissions were found in this read-export inventory. Catalog/product reads are intentionally public. This inventory does not certify every public mutation/action or establish whether an exposed endpoint has ever been accessed.

Separate hardening must test guest persistence, signed-in user/org isolation, owner transfer, public share projection, upload rendering, and authorized executive access. Any new credential or security-setting requirement needs separate explicit authorization. Do not roll these remaining architectural changes into the current release without coordinated caller updates.

## Review correction: credential-bearing backend errors

The first preview (`7d03327b`) added a token argument to `getGraceWorkspaceByOrg` while `GET /api/portal/grace/projects` still returned `error.message`. If that frontend called an older/shared backend, a Convex extra-field validation error could include the complete arguments and the server token. The route is present in the application and, from source, requires a signed-in Clerk caller and an active organization. Anonymous portal API requests are redirected by the proxy; Clerk-disabled workspace reads return no projects. No live identity, token, transcript, or customer record was used to probe this condition, and this source review does not establish whether any preview visitor encountered it.

The correction returns fixed safe messages from both projects GET/POST and the existing session-sync POST error path, retaining their authorization/ownership status codes. Synthetic token-bearing validation errors fail seven new assertions on the previous code and pass after the correction; successful responses are preserved.

The bounded audit traced every newly tokenized caller: workspace-account already returns a fixed 503; workspace rail catches failures; wholesale checkout returns null; draft submission returns a fixed message; account/certificate/team pages either throw to Next's production Server Component/Action error boundary or log server-side only. Portal submit-certificate actions inspect a known code but return fixed messages. Remaining `detail`/`syncDetail` catches in the portal helpers wrap Shopify-specific calls/errors, not the newly tokenized Convex reads. No second newly introduced browser echo was found. Existing server logging and broader guest endpoints are not certified by this correction.

Do not validate the vulnerable preview by invoking it with a live customer identity. Any investigation of actual access or credential/security-setting changes remains a separate explicitly authorized action; this patch does not rotate or inspect credentials.
