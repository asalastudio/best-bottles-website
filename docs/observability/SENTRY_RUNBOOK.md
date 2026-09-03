# Sentry → Convex → Team Hub: setup and runbook

_Last updated 2026-09-02. Owner: Jordan (jordan@asala.ai)._

Sentry is the system of record for bugs. Convex mirrors the **headline** of each
issue (title, level, counts, status, deep link) so the Team Hub and Executive
Hub can show what is breaking without handing every employee a Sentry seat.
No stack traces, request bodies or customer data are ever copied out of Sentry
(`errorIssues.rawContentStored` is a schema literal `false`).

```
storefront / API / edge ──@sentry/nextjs──▶ Sentry project best-bottles-web ─┐
Convex functions ──Convex "Exception Reporting" tile──▶ Sentry project best-bottles-convex ─┤
                                                                              ▼
                        Internal Integration webhook ──▶ POST /api/sentry/webhook (signed)
                                                                              ▼
                              convex/observability.ts ▶ errorIssues / errorIssueEvents / errorSyncRuns
                                                                              ▼
                     cron every 15 min: Sentry REST API sync keeps counts + statuses truthful
                                                                              ▼
                  /executive#platform  (PlatformHealthPanel)   ·   /team  (PlatformStatusCard)
```

## 1. Create the Sentry projects (one-time, ~10 min)

1. In the Sentry org, create **two** projects:
   - `best-bottles-web` — platform **Next.js**. Copy its DSN.
   - `best-bottles-convex` — platform **Node.js** (or "Other"). Copy its DSN.
2. Optional but recommended: install the **Vercel** integration in Sentry
   (Settings → Integrations → Vercel) and link `best-bottles-web` to the Vercel
   project. It sets `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` on
   Vercel for source-map upload and tags every event with the deployment.

## 2. Web app (Vercel / .env.local)

| Variable | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel (all envs) + `.env.local` | DSN of `best-bottles-web`. Empty = SDK fully disabled. |
| `SENTRY_ORG` | Vercel | org slug |
| `SENTRY_PROJECT` | Vercel | `best-bottles-web` |
| `SENTRY_AUTH_TOKEN` | Vercel only | org auth token with `project:releases` + `org:read` (source maps). Never commit. |
| `SENTRY_WEBHOOK_CLIENT_SECRET` | Vercel (production) | from step 4 |
| `NEXT_PUBLIC_SENTRY_ORG_SLUG` | Vercel (optional) | org slug — turns on the "Open Sentry" buttons in the hubs |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | optional | `0`–`1`; default 0.05 in production, 0 elsewhere |

What the code does (nothing to configure):

- `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/sentry.edge.config.ts` initialise the SDK per runtime; every event carries `app`, `runtime`, `environment` (production / preview / development) and, in the browser, a `surface` tag (storefront, catalog, pdp, cart, customer-portal, team-hub, executive-hub, grace-workspace, api).
- `src/instrumentation.ts` exports `onRequestError`, so Server Components, Route Handlers, Server Actions and the Clerk proxy report automatically.
- `src/app/error.tsx` and `src/app/global-error.tsx` capture render errors.
- `src/lib/observability/report.ts` (`reportError`) is the one helper for errors the code deliberately swallows (fail-open rate limiter, Grace tool fallbacks, 3D viewer boundary). It keeps the `console.error("[area]", …)` convention and adds an `area` tag.
- Browser events travel through `/monitoring-tunnel` on our own origin so ad blockers cannot hide storefront errors; the route is excluded from the Clerk proxy.
- Session Replay is **off** (`replaysSessionSampleRate: 0`) until privacy masking is reviewed.

Verify: with the DSN set, run `npm run dev`, open any page, and in the browser console run `throw new Error("sentry smoke")`. The issue appears in `best-bottles-web` within a minute.

## 3. Convex functions → Sentry (dashboard only, both deployments)

Convex dashboard → deployment → **Settings → Integrations → Sentry (Exception Reporting)** → paste the `best-bottles-convex` DSN. Do it on **dev** (`helpful-elephant-638`) and **prod** (`precise-raccoon-123`). Requires the Convex Pro plan; everything else in this runbook works without it.

## 4. Sentry → Convex bridge (the part that feeds the dashboards)

Create an **Internal Integration** in Sentry: Settings → Developer Settings → **Create New Integration → Internal Integration**.

- **Name:** Best Bottles Team Hub
- **Webhook URL:** `https://best-bottles-website.vercel.app/api/sentry/webhook` (use the production domain once it is live)
- **Permissions:** Issue & Event → **Read**; Project → Read
- **Webhooks:** tick **issue** (created / resolved / assigned / archived / unresolved). Optionally tick **error** to stream every error event (heavier; the panel then counts occurrences live).
- **Alert Rule Action:** enable — then in each project add an **Issue Alert** rule whose action is "Send a notification via Best Bottles Team Hub". Alert-rule triggers arrive as `event_alert` and show in the activity feed with the rule name.
- Save, then copy the integration's **Client Secret** into Vercel as `SENTRY_WEBHOOK_CLIENT_SECRET` and redeploy.

The receiver (`src/app/api/sentry/webhook/route.ts`) verifies `Sentry-Hook-Signature` (HMAC-SHA256 of the body with that secret), is idempotent on `Request-ID`, answers 200 for resources it does not mirror, and forwards through `api.observability.recordSentryDelivery` guarded by `BEST_BOTTLES_CONVEX_WRITE_TOKEN` — the same server-only token every other internal Convex write uses.

Verify: Sentry → the integration → **Webhooks → Request Log** shows `200` responses. The Team Hub then shows the issue.

## 5. 15-minute API sync (Convex environment, both deployments)

The webhook is real time but only carries what Sentry sends. `convex/crons.ts` runs `observability.syncFromSentry` every 15 minutes to pull the last 14 days of unresolved issues and 7 days of resolved ones so counts and statuses cannot drift. It is silent until these exist in **Convex → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `SENTRY_API_TOKEN` | org auth token (Settings → Auth Tokens) with `org:read`, `project:read`, `event:read` |
| `SENTRY_ORG_SLUG` | org slug |
| `SENTRY_PROJECT_SLUGS` | optional, e.g. `best-bottles-web,best-bottles-convex` |
| `SENTRY_API_BASE_URL` | optional; `https://sentry.io` (US, default) or `https://de.sentry.io` |

Run one by hand: `npx convex run observability:syncFromSentry` (dev) or add `--prod`. The panel's "Sentry API sync" tile reads `OK · 3 min ago`, `Failed · …` (bad token — the detail is shown in a red strip), `Webhook only` (not configured) or `Pending first run`.

## 6. Where it shows up

- **Executive Hub** `/executive#platform` — Platform Health panel: open issues, open fatal/error, new and active in 24 h, resolved in 7 d, sync state, per-project chips, the open-issue list (expand a row for first-seen, priority, unhandled, "Open in Sentry"), and the activity feed. Refreshes itself every minute while the tab is visible. The "PL · Platform" lane in the left rail jumps to it.
- **Team Hub** `/team` — Platform status strip above the tool tiles: one-line health (green / amber / red), the top three open issues with links, and a button to the Executive Hub panel. Visible to everyone with Team Hub access.
- Both load server-side through `src/lib/executive/platformHealth.ts`; the token never reaches the browser and a Convex outage degrades to "not connected" instead of breaking the hub.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Panel says "not connected" | `NEXT_PUBLIC_CONVEX_URL` / `BEST_BOTTLES_CONVEX_WRITE_TOKEN` on Vercel; Convex functions deployed (`npx convex deploy` runs on main builds). |
| "Connected to Convex, but no Sentry deliveries have arrived yet" | Step 4 not finished, or the Client Secret on Vercel differs from the integration's. Sentry's Request Log shows `401` in that case. |
| Issues appear but counts look stale | Step 5 not configured (tile says "Webhook only"). |
| Red "Last Sentry API sync failed (sentry_api_401)" | Token lacks scopes or belongs to another org. |
| Browser errors missing, server errors present | Ad blocker: confirm `/monitoring-tunnel` returns 200 and is not behind Clerk. |
| Convex errors missing | Step 3 (dashboard tile) not done, or the deployment is on the free plan. |

### Testing the bridge without waiting for a real error

With `SENTRY_WEBHOOK_CLIENT_SECRET` set locally, POST a signed payload the way Sentry does, then prune it:

```bash
node -e '
const c=require("crypto"), s=process.env.SENTRY_WEBHOOK_CLIENT_SECRET;
const b=JSON.stringify({action:"created",installation:{uuid:"t"},actor:{type:"application",id:"sentry",name:"Sentry"},
 data:{issue:{id:"900001",shortId:"TEST-1",title:"Smoke test",level:"error",status:"unresolved",substatus:"new",
 project:{id:"1",name:"Web",slug:"best-bottles-web"},count:"1",userCount:1,
 firstSeen:new Date().toISOString(),lastSeen:new Date().toISOString(),tags:[["environment","development"]]}}});
fetch("http://localhost:3000/api/sentry/webhook",{method:"POST",headers:{"Content-Type":"application/json",
 "sentry-hook-resource":"issue","sentry-hook-signature":c.createHmac("sha256",s).update(b).digest("hex"),
 "request-id":"smoke-1"},body:b}).then(r=>r.text()).then(console.log)'
```

Expect `{"ok":true,...,"status":"inserted"}`; a replay with the same `request-id` returns `"duplicate"`, a wrong signature returns 401, and an unmirrored resource returns `{"ok":true,"ignored":true}`. Clean up with `pruneMirroredIssues` above.

## 8. Privacy and retention

- Convex stores: title (≤500 chars), culprit (≤500 chars), level, status, counts, timestamps, project, environment, release, up to 40 tag pairs, and the Sentry permalink. Nothing else.
- `sendDefaultPii: false` in every SDK init; no cookies, IPs or request bodies leave the app.
- Retention: `observability:pruneMirroredIssues` drops rows on demand. Sentry stays the system of record, so anything pruned returns on the next sync if it is still open there.

  ```bash
  npx convex run observability:pruneMirroredIssues '{"sentryIssueIds":["1234567890"]}'
  ```

  To age out issues resolved more than 90 days ago (`resolvedBefore` is epoch millis):

  ```bash
  npx convex run observability:pruneMirroredIssues "{\"resolvedBefore\": $(node -e 'console.log(Date.now()-90*864e5)')}"
  ```

  Volume is a few hundred issues a year, so this is housekeeping rather than a scheduled job; promote it to a cron if the table ever passes ~10k rows.
