# Build Your Bottle load time — 2026-09-26

Jordan: "the bottle builder is taking way too much time to load", after the
image plates were already compressed. Images are not the bottleneck. The time
goes to three requests the builder waits on, and to the JavaScript every page
downloads before it can hydrate.

## Where the time went (production, 2026-09-26)

| Request | What happened |
| --- | --- |
| `/api/bottle-builder/families` | Answered `public, max-age=0, must-revalidate`, so the CDN never cached it and every visitor paid a function call: 2.8 s on a cold function, 0.16–0.33 s warm. The client only asked for it after hydration plus `requestIdleCallback`. |
| `/api/bottle-builder/kits` | The one builder read with no server-side cache. Every CDN miss went to Convex (register + published kits): 0.7–1.6 s on a warm function, 2.7 s cold. `s-maxage=300, stale-while-revalidate=60` meant a bottle nobody had picked for six minutes was cold again. |
| `/api/bottle-builder/bodies` | Served from the family data cache (0.22–0.31 s on a miss); same six-minute window at the CDN. |
| Hourly warm cron | Runs and returns 200 (`CRON_SECRET` is set on Production — see below), but it called `revalidateTag("bottle-components")` before reading. Next applies a tag at the end of the request, so every entry the run wrote was born stale, and every read inside the run bypassed the cache and rebuilt every family from Convex. It never touched kits. Four families (Circle, Elegant, Round, Slim) were still cold 40 minutes after a run (1.1–2.1 s extra). |
| JavaScript | /matrix loads 37 files, 1,062 KB compressed / 3.6 MB raw (including ~220 KB of Clerk UI from Clerk's CDN). Only ~66 KB compressed is specific to /matrix; the rest is the site-wide shell. |

## What changed

1. **Family list streams into the page.** `/matrix` starts `loadBuilderFamilies()`
   before it awaits anything and hands the promise to `MatrixClient`, so the list
   arrives in the same response. The chooser still paints without it; the route
   remains as the fallback (and is now CDN-cached: `s-maxage=3600,
   stale-while-revalidate=86400`).
2. **Kit layers are data-cached.** `loadBuilderBodyKits` goes through
   `unstable_cache`, keyed by the bottle's exact SKU pairs and tagged
   `bottle-components` like the family cache. A CDN miss now costs a function
   call and a cache read instead of Convex.
3. **Stale-while-revalidate for a day** on bodies and kits (`s-maxage=300,
   stale-while-revalidate=86400`): an expiry is refreshed in the background
   and never makes a visitor wait. Vercel strips both directives before the
   browser sees them. A new deployment still starts the CDN empty; the data
   cache survives deployments.
4. **Tile prefetch.** Hovering a bottle tile for 80 ms, focusing it, or pressing
   it starts that bottle's configurations and kits. The pick reuses the same
   request (`builder-requests.ts`), so it is often already done by the click.
5. **Warm cron fixed.** Reads only (no `revalidateTag`), warms the family list,
   every family, and every bottle's kits, four families at a time;
   `maxDuration` 300; a failed family returns 500 so it shows in the cron log.
6. **Bundle.** `posthog-js` (96 KB compressed / 307 KB raw) loads when analytics
   initialises, after hydration, instead of in the shell every page downloads
   first. Calls made before it is ready are queued in order (capped at 100).
   `MobileBuilder` is loaded only on phones. The 76 KB `component-matches`
   table, which only the server-side catalogue resolver reads, no longer ships
   in the builder's page chunk.

## Measurements

Local `next build --webpack && next start` (production mode; the same builder
Vercel runs), dev Convex, Clerk on, both builds with the same dummy PostHog key
and `/ingest` stubbed, Playwright in real Chrome with an empty browser cache per
run. `main` (5ab30ada) and this branch ran side by side and were interleaved
run by run, because the machine was busy with other sessions (load average
6–15). "Cold" = fresh server process with an empty data cache; "throttled" =
10 Mbps, 40 ms RTT, 4× CPU slowdown. Medians of 5 warm rounds and 2 cold rounds.

**API routes (curl, seconds)**

| Route | main cold | main warm | branch cold | branch warm |
| --- | ---: | ---: | ---: | ---: |
| `families` | 2.06–4.60 | 0.009 | 1.84–1.97 | 0.007 |
| `kits` (9 ml 17-415) | 1.68–3.50 | **0.31** | 1.67–1.75 | **0.013** |
| `bodies` (9 ml 17-415) | 0.01 | 0.01 | 0.01 | 0.01 |

Cold `families`/`kits` are the same Convex work on both builds; the change is
that a warm `kits` request no longer goes to Convex, and the page no longer
requests `families` at all.

**Browser, /matrix (ms from navigation; pick = ms after clicking the 9 ml 17-415 tile, negative = ready before the click)**

| Metric | warm main | warm branch | throttled main | throttled branch | cold main | cold branch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tiles in the DOM | 452 | 403 | 943 | 966 | 2041 | 1861 |
| Family list ready | 1180 | **710** | 4114 | **3680** | 6087 | **2449** |
| LCP (the H1) | 884 | 752 | 1576 | 1428 | 590 | 436 |
| `load` | 1092 | 758 | 2821 | 2712 | 2297 | 2453 |
| Pick → kits ready | 453 | **−137** | 1206 | **326** | 532 | **315** |
| Pick → options ready | 60 | **−162** | 426 | **174** | 114 | **−157** |
| `/api/bottle-builder/families` requests | 1 | **0** | 1 | **0** | 1 | **0** |

**JavaScript the page needs before it can hydrate** (scripts in the HTML, gzip -6)

| Page | main | branch |
| --- | ---: | ---: |
| /matrix | 879 KB gz / 2,984 KB raw | **780 KB gz / 2,606 KB raw** |
| / | 835 KB gz / 2,739 KB raw | **742 KB gz / 2,453 KB raw** |

The /matrix page chunk itself went from 232 KB to 142 KB raw. posthog-js
(288 KB raw) still downloads when a key is configured, after hydration.
Clerk's own ~220 KB compressed from its CDN is unchanged and not counted above.

The home page's server code did not change; its throttled timings were
dominated by machine load (TTFB 0.48–2.3 s on both builds). The two clean
rounds on each side were level (FCP 0.96–0.99 s, LCP 3.44–3.55 s); warm and
unthrottled, LCP 1084 → 960 ms and `load` 1399 → 1027 ms.

On production, a CDN miss on `kits` should now cost what a miss on `bodies`
already costs — the function plus a data-cache read, 0.22–0.31 s measured
today (more on a cold start) — instead of 0.7–1.6 s of Convex, and the hover
prefetch usually hides it.

**Not changed, worth a follow-up**

- Clerk loads its full UI bundle (`ui-common`, ~120 KB compressed) on every
  storefront page, although the storefront only reads auth state. Production
  also still runs the Clerk *development* instance.
- A 153 KB compressed shared chunk holding Sentry's browser SDK and Grace code,
  and the Grace provider/drawer, are in the shell on every page.
- The families list on a cold data cache still costs ~2–4.6 s of Convex work
  (every family's components resolved one SKU at a time); it no longer blocks
  anything a visitor sees, and the warm cron keeps it filled.

## Turning on the warm cron — already done

`CRON_SECRET` is set on the **Production** environment (added 2026-09-25, per
`vercel env ls production`), and the runtime logs show
`GET /api/bottle-builder/warm 200` every hour since at least 2026-09-25 18:00 UTC.
Nothing further is needed for it to run. For reference, this is what makes it work:

1. `vercel.json` schedules `GET /api/bottle-builder/warm` at `0 * * * *`.
   Hourly crons need the Pro plan (the deploy was accepted, so the plan is fine).
2. Vercel sends `Authorization: Bearer $CRON_SECRET` with each cron call when
   the project has a `CRON_SECRET` environment variable. The route returns 401
   without it.
3. To rotate it: Vercel → Project → Settings → Environment Variables →
   `CRON_SECRET` (Production only; Preview does not need it — crons run on
   production deployments only). Use a random value of at least 16
   characters, e.g. `openssl rand -hex 32`. **Redeploy production afterwards**:
   environment changes apply to new deployments only.
4. To confirm: Vercel → Project → Logs, filter `/api/bottle-builder/warm`, and
   look for a 200 at the top of the hour. The JSON body lists each family with
   its warm time and body count, and `failed` names any family that could not
   be built (the route then answers 500).
