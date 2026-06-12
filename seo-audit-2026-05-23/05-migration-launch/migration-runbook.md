# Best Bottles — Migration Runbook (Stage 5)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Date issued:** 2026-05-23
**Target cutover:** 2026-06-15 (T-0)
**Scope:** Master playbook for the PHP-to-Next.js cutover on `https://www.bestbottles.com`. Replaces the legacy PHP codebase in-place on the same domain. Brand graph stays intact; per-URL 301 mapping is required for the ~150 legacy URLs documented in the Stage 3 baseline.
**Companion files:** `redirect-map.csv` (this folder), `launch-go-nogo-scorecard.md` (this folder).
**Source-of-truth dependencies:** Stage 0 brief, Stage 1 technical SEO audit, Stage 2 GEO/AEO audit, Stage 3 legacy equity baseline, Stage 4 content roadmap.

This document is the single executable runbook engineering uses to ship the new site on June 15 without losing rankings, sessions, or revenue. Every action item is bounded by a checkable acceptance criterion. Owners are noted as `[OWNER]` placeholders — the team should fill these in during the first sprint planning session after this runbook is accepted.

---

## 0. Naming, conventions, and ground rules

- **T-N notation** means "N days before cutover". T-23 = May 23 (today), T-0 = June 15.
- **All commands are absolute.** No `cd`, no relative paths.
- **All env checks assume `VERCEL_ENV=production`** unless otherwise stated.
- **Decision-makers:** PM `[PM_NAME]` makes go/no-go calls. Engineering lead `[ENG_LEAD]` executes deploys and rollbacks. SEO lead `[SEO_LEAD]` owns sitemap submission, GSC monitoring, and redirect verification. Customer success `[CS_LEAD]` owns customer-facing email + sales-team brief.
- **Communication primary:** Slack `#bb-launch` channel. Status updates every 30 min during the cutover window (T-2hr through T+2hr).
- **Code freeze:** T-2 (June 13, 23:59 PT). Only rollback-related commits accepted after that.

---

## 1. Pre-launch timeline — week by week (T-23 to T-0)

### Week of T-23 to T-17 (May 23 – May 30) — Foundation week

**Theme:** Resolve all P0 launch-blockers, ship the contract-packaging page, deploy `/llms.txt`. Without these, no later week succeeds.

| Ticket | Owner | Acceptance |
|---|---|---|
| **BB-SEO-002** · Fix `SITE_URL` default to `https://www.bestbottles.com` + build-time guard | `[ENG_LEAD]` | `npm run build` fails if `NEXT_PUBLIC_SITE_URL` is misconfigured in production. View-source on a preview deploy shows correct canonical. |
| **BB-SEO-001** · Staging noindex (DONE per task list — verify still holding) | `[ENG_LEAD]` | `curl -sI https://[preview-deploy].vercel.app/ \| grep -i x-robots-tag` returns `noindex,nofollow`. |
| **BB-SEO-003** · Verification tokens in metadata | `[ENG_LEAD]` | Preview deploy view-source contains both `google-site-verification` and `msvalidate.01` meta tags with the legacy values. DNS TXT record method also added in GSC + Bing as backup. |
| **BB-SEO-004** · Sitemap covers ≥2,400 URLs | `[ENG_LEAD]` | Preview deploy `/sitemap.xml` returns ≥2,400 URLs. Sample 5 PDP entries return 200. |
| **BB-SEO-208** · Per-page canonicals on every route | `[ENG_LEAD]` | View-source on `/about`, `/blog`, `/resources`, `/blog/[slug]`, `/catalog`, `/contact` shows self-referential canonical. |
| **BB-AEO-006** · Build `/services/contract-packaging` | `[ENG_LEAD]` + `[SEO_LEAD]` | Page indexable, MOQ table present, Service + FAQPage JSON-LD validates. |
| **BB-AEO-001** · `/llms.txt` deployed | `[ENG_LEAD]` | `curl https://[preview-deploy].vercel.app/llms.txt` returns 200 with markdown body. |

**Exit criteria for the week:** Every P0 ticket above resolved on `main` and visible on a preview deploy by EOD Friday May 29. Saturday May 30 reserved for soak / regression.

### Week of T-16 to T-10 (June 1 – June 7) — Redirects, schema, P1 hygiene

**Theme:** Generate and test the full 301 redirect map. Land remaining schema. Resolve P1 backlog.

| Ticket | Owner | Acceptance |
|---|---|---|
| Implement the 301 redirect map (see `redirect-map.csv`) | `[ENG_LEAD]` | All ~150 entries deployed to `next.config.ts` `redirects()` (or middleware fallback for query-string variants). 50-URL spot-check on preview returns 301 with correct `Location`. |
| **BB-SEO-203** · Convert PDP to SSR + emit Product JSON-LD server-side | `[ENG_LEAD]` | View-source on a sample PDP shows Product + BreadcrumbList JSON-LD in initial HTML. Rich Results Test passes. |
| **BB-SEO-202** · Faceted-nav canonical + noindex strategy | `[ENG_LEAD]` | `curl /catalog?families=Empire` returns noindex,follow + canonical to `/catalog`. Whitelisted filters return indexable. |
| **BB-SEO-201** · Sitemap reliability (caching, partial-fail tolerance, fallback) | `[ENG_LEAD]` | Sitemap returns ≥240 URLs even with Convex returning empty (simulated by env override). |
| **BB-SEO-101** (LocalBusiness) + **BB-SEO-102** (Organization completeness) | `[ENG_LEAD]` | Both schemas valid in Rich Results Test. Phone/address/email/sameAs match Stage 3 §4.3 NAP. |
| **BB-SEO-204** · BlogPosting schema on all 9 posts | `[ENG_LEAD]` | View-source on each blog post shows valid BlogPosting JSON-LD. |
| **BB-SEO-206** · FAQPage schema on `/resources` | `[ENG_LEAD]` | Rich Results Test confirms FAQPage validity. |
| **BB-SEO-207** · Add metadata to `/contact`, `/request-quote`, `/request-sample` | `[ENG_LEAD]` | View-source on each shows bespoke title/description/canonical. |
| **BB-SEO-212** · Vercel www/non-www redirect configured | `[ENG_LEAD]` | `curl -I https://bestbottles.com/` returns 308 with `Location: https://www.bestbottles.com/`. |
| **BB-AEO-002** · robots.txt explicit allow for PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended | `[ENG_LEAD]` | `curl /robots.txt` contains explicit allow blocks. |
| Cap-color on Empire PDPs sanity-checked against Madison hero pipeline | `[ENG_LEAD]` | Spot-check 10 Empire SKUs render correct hero image and cap color matches `productGroups.heroImageUrl`. |

**Exit criteria for the week:** Redirect map merged to `main`. Preview deploy passes 50-URL redirect spot-check, full schema validator pass on top 10 PDPs, top 3 collection pages, top 5 blog posts. Friday June 5 cutoff for P1 work.

### Week of T-9 to T-3 (June 8 – June 12) — QA hardening

**Theme:** Production-grade verification. Lighthouse, Core Web Vitals, schema, redirects, monitoring, backup.

| Task | Owner | Acceptance |
|---|---|---|
| Schema validator pass on 10 sample PDPs | `[SEO_LEAD]` | Each PDP passes Rich Results Test for Product, BreadcrumbList, FAQPage (if present). Screenshots attached to Linear. |
| Schema validator pass on 5 collection pages | `[SEO_LEAD]` | Each passes CollectionPage + ItemList validation. |
| Schema validator pass on 3 blog posts | `[SEO_LEAD]` | Each passes BlogPosting validation. |
| Lighthouse mobile on top 20 URLs | `[ENG_LEAD]` | Performance ≥80 on `/`, `/catalog`, 5 sample PDPs, 5 sample collections, 3 blog posts. Accessibility ≥90. Best Practices ≥90. SEO 100. |
| Core Web Vitals (CrUX-style local capture) | `[ENG_LEAD]` | LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile for the 4 priority page types. |
| Sitemap diff: confirm new sitemap is a superset of legacy URL inventory | `[SEO_LEAD]` | Every legacy URL has either a 301 destination or an explicit "intentionally dropped" note. |
| Database backup snapshot (Convex + Sanity) | `[ENG_LEAD]` | Convex `npx convex export` produces snapshot; Sanity dataset exported via `sanity dataset export production backup-2026-06-11.tar.gz`. Both stored in S3 + a team member's local. |
| Rollback dry-run on staging | `[ENG_LEAD]` | Promote a known-good prior deploy on the staging project via Vercel dashboard, confirm domain serves prior code, then re-promote latest. Document time-to-rollback (should be < 60 seconds). |
| GSC + Bing Webmaster access verified for ≥3 team members | `[SEO_LEAD]` | Each lists their name on the GSC users panel. |
| Sentry / Mixpanel / Vercel Analytics dashboards configured for launch monitoring | `[ENG_LEAD]` | Each opens to a saved view filtered for the production environment. |
| Customer-facing email drafted in CRM, scheduled for T-24hr send | `[CS_LEAD]` | Draft visible in the marketing automation tool, scheduled for June 14 09:00 PT. |
| Sales team brief written: top 10 customer-visible changes | `[CS_LEAD]` | One-pager Slack-posted in `#bb-sales` by June 12 EOD. |

**Exit criteria for the week:** All QA gates pass. Go/no-go scorecard scoring complete (use the companion `launch-go-nogo-scorecard.md`). PM `[PM_NAME]` reviews and gives provisional GO.

### T-2 to T-1 (June 13 – June 14) — Code freeze + final sign-off

**T-2 (Saturday June 13)**
- 23:59 PT: Code freeze. No commits to `main` except rollback-related.
- Final smoke test on production preview branch.
- Lower DNS TTL on `bestbottles.com` and `www.bestbottles.com` to 300 seconds (5 minutes). This allows DNS-level rollback within minutes if Vercel domain-attach fails. Confirm via `dig +short bestbottles.com TTL` after change propagates.

**T-1 (Sunday June 14)**
- 09:00 PT: Customer-facing maintenance-window notice email goes out (T-24hr).
- 10:00 PT: Final stakeholder sign-off meeting (15 min). PM `[PM_NAME]` confirms GO or NO-GO using the scorecard.
- 11:00 PT: All team members confirm Vercel dashboard access from their primary device.
- 14:00 PT: Rollback dry-run #2 on staging (must complete in < 60 seconds).
- 18:00 PT: Final sitemap regeneration on preview deploy to verify Convex query stays under 30s.

**Exit criteria for T-1:** Final go/no-go scorecard signed by `[PM_NAME]`. Slack `#bb-launch` post confirming GO/NO-GO by 16:00 PT June 14.

### T-0 (Monday June 15) — Cutover day

See Section 2.

### T+1 to T+7 (June 16 – June 22) — Post-launch monitoring

See Section 4 (30/60/90 monitoring runbook).

---

## 2. Cutover-day runbook (T-0, Monday June 15)

**Cutover window:** 09:00 – 12:00 PT. Window selected for low-traffic profile (B2B catalog browsing peaks 13:00-17:00 PT), engineering full-staff availability, and 8 hours of remaining business-day for incident response.

Every step below has a verification command. Do not proceed to the next step without confirming the prior step passed.

### T-2hr (07:00 PT) — Final pre-flight

1. **Slack post in `#bb-launch`:** "Cutover T-2hr. Pre-flight starting. ETA T-0 09:00 PT."
2. **Regenerate sitemap on preview branch** to catch any late content changes:
   ```bash
   git fetch origin && git checkout main && git pull
   npm run build  # confirm clean build, no env errors
   ```
3. **Smoke test on preview deploy** (URL: latest preview deploy from main):
   ```bash
   curl -sI https://[preview-url]/sitemap.xml | head -5
   curl -sI https://[preview-url]/ | grep -E "(canonical|robots)"
   curl -sI https://[preview-url]/products/empire-30ml-clear | grep -E "(canonical|robots)"
   curl -sI https://[preview-url]/llms.txt | head -3
   ```
   Expected: 200s, correct canonicals, `noindex,nofollow` on preview (because preview is non-production).
4. **Rollback dry-run #3** on a separate staging project. Promote prior deploy, confirm serves, re-promote latest. Measure rollback time (should be < 60s).
5. **Confirm `[ENG_LEAD]` has Vercel dashboard open** with the production project loaded.
6. **Confirm DNS TTL is 300s** for `bestbottles.com` and `www.bestbottles.com`:
   ```bash
   dig +short bestbottles.com SOA
   dig www.bestbottles.com  # check TTL column
   ```

### T-1hr (08:00 PT) — Deploy to production

1. **Slack post:** "Cutover T-1hr. Deploying to production."
2. **Confirm Vercel project domain attachment** in the dashboard:
   - `www.bestbottles.com` → primary production domain on the new Next.js project
   - `bestbottles.com` → 308 redirect to `www.bestbottles.com`
   - `bestbottles.company` → optional alias (decommissioned per pre-completed task #9; should now point to a Vercel preview URL only)
3. **Trigger production deploy.** Either:
   - Push a no-op commit to `main` (auto-deploys), OR
   - In the Vercel dashboard, promote the latest preview deploy to production.
4. **Wait for build to complete.** Watch the Vercel build log. Expected: < 5 minutes for the Next.js 15 build.
5. **Confirm deploy succeeded** (Vercel UI shows green checkmark on the production environment).
6. **If build fails:** Do NOT promote. Slack post, debug, fix, rebuild. If unable to fix within 30 min, declare NO-GO and reschedule.

### T-0 (09:00 PT) — Domain cutover (likely auto)

If the domain `www.bestbottles.com` is already attached to the new Vercel project (which it should be by Section 2's pre-flight), no DNS change is needed — the new code is already serving as soon as the production deploy promotes.

If domain attach is still pending:
1. In Vercel dashboard → Project → Settings → Domains, add `www.bestbottles.com` and follow Vercel's verification prompts. Vercel will issue an SSL certificate via Let's Encrypt automatically (< 2 min).
2. Update the apex `bestbottles.com` A record (or ALIAS/ANAME) to point to Vercel's IP per their docs.
3. Confirm via `dig +short www.bestbottles.com` returning a Vercel IP.

**Slack post:** "Cutover T-0. New site live on `https://www.bestbottles.com`. Beginning verification."

### T+5min (09:05 PT) — Homepage smoke test

```bash
curl -sI https://www.bestbottles.com/ | head -10
curl -s https://www.bestbottles.com/ | grep -iE "(canonical|robots|google-site-verification|msvalidate)"
curl -s https://www.bestbottles.com/ | head -100  # eyeball — should NOT see "Some text in the modal" or PHP-era boilerplate
```

Expected:
- 200 OK
- `<link rel="canonical" href="https://www.bestbottles.com">` (or `https://www.bestbottles.com/`)
- `<meta name="robots" content="index, follow, ...">`
- Google + Bing verification meta tags present
- HTML body contains Next.js-rendered new-site content, not legacy PHP boilerplate

**If homepage returns 500 or Vercel error page:** declare incident, trigger rollback (Section 5).

### T+15min (09:15 PT) — Redirect spot-check

Pick 15 representative legacy URLs from the redirect map and verify each returns 301 with the correct `Location`:

```bash
# Top-level categories (4)
curl -sI "https://www.bestbottles.com/index.php" | grep -i location
curl -sI "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/Perfume-glas-bottle-vials-purchase.php" | grep -i location
curl -sI "https://www.bestbottles.com/all-bottles/Perfume-atomizer-aluminum-bottle-cans/Perfume-atomizer-Aluminum-bottle-cans-purchase.php" | grep -i location
curl -sI "https://www.bestbottles.com/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles-cream-jars-purchase.php" | grep -i location

# Informational pages (3)
curl -sI "https://www.bestbottles.com/faq.php" | grep -i location
curl -sI "https://www.bestbottles.com/contact-us.php" | grep -i location
curl -sI "https://www.bestbottles.com/filling-capping-labeling-perfume-bottles-atomizers.php" | grep -i location

# Querystring subcategories (3)
curl -sI "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php?subcat=66" | grep -i location
curl -sI "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php?subcat=68" | grep -i location
curl -sI "https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php?subcat=15" | grep -i location

# PDF catalog (should serve 200, NOT redirect)
curl -sI "https://www.bestbottles.com/bestbottles-compressed.pdf" | head -3

# www/non-www (1)
curl -sI "https://bestbottles.com/" | grep -i location  # expect 308 to www

# Trailing slash check (1)
curl -sI "https://www.bestbottles.com/products/empire-30ml-clear/" | grep -i location  # expect 308 to no-slash

# Legacy bestbottles.company (1)
curl -sI "https://bestbottles.company/" | grep -i location  # expect 301 to https://www.bestbottles.com/
```

Every line above must show either a 200 (for PDF) or a 301/308 with the expected `Location` header. If any fail, debug the redirect rule in `next.config.ts` or middleware. Hot-fix and redeploy if material.

### T+30min (09:30 PT) — Search Console + Bing submission

1. **GSC:** Sign in at https://search.google.com/search-console
   - Confirm property `https://www.bestbottles.com/` is verified (meta tag verification should auto-pass).
   - Sitemaps → Add new sitemap → `sitemap.xml`. Wait for "Success" status (typically < 30 seconds).
   - URL Inspection → enter `https://www.bestbottles.com/` → "Request Indexing".
   - URL Inspection → repeat for 9 more priority URLs (top 4 collection pages, top 5 PDPs).
2. **Bing Webmaster Tools:** Sign in at https://www.bing.com/webmasters
   - Confirm property verification.
   - Sitemaps → Submit `https://www.bestbottles.com/sitemap.xml`.
   - URL submission API or manual: submit top 10 URLs for crawl.
3. **Slack post:** "T+30min. Sitemaps submitted. Top 10 URLs requested for indexing."

### T+1hr (10:00 PT) — Functional smoke test

`[ENG_LEAD]` runs the following end-to-end:

1. **Top 20 PDPs** (pull from sitemap, pick 20 across families): each loads in < 3s, renders product imagery, variant selector, add-to-cart button, FAQ block.
2. **Contact form**: submit a test inquiry from `[ENG_LEAD]`'s personal email. Confirm Convex log + email delivery within 60s.
3. **Request-sample flow**: complete a sample request, confirm receipt in CRM.
4. **Grace AI workspace**: open `/grace-workspace`, ask "what is a 24-410 neck finish?", confirm response within 10s.
5. **Catalog filter combinations**: load `/catalog?families=Empire`, `/catalog?applicators=spray`, `/catalog?families=Boston%20Round`. Confirm each shows the expected filtered set, robots correct per BB-SEO-202.
6. **Mobile spot-check**: on `[ENG_LEAD]`'s phone, load `/`, `/catalog`, a sample PDP, the contact form. Confirm tap targets, sticky CTA, image quality.
7. **404 behavior**: `curl -sI https://www.bestbottles.com/this-does-not-exist` returns 404 (not a 500 or infinite redirect).

**Slack post:** "T+1hr. Functional smoke test complete: [PASS/FAIL]. [Details]."

### T+2hr (11:00 PT) — Observability check

1. **Vercel logs:** Project → Logs → last 2 hours. Look for 4xx/5xx spikes. Acceptable baseline: < 1% 4xx (mostly bots), < 0.1% 5xx.
2. **Convex query latency:** Convex dashboard → Functions. Look for any function whose p95 jumped >2x baseline. Most concerning: `getProductGroup` (PDP), `getAllCatalogGroups` (catalog), `getMegaMenuPanels` (every page).
3. **Sentry:** check the error feed for any new error class introduced in the last 2 hours.
4. **Mixpanel / Vercel Analytics:** session count tracking vs. typical Monday morning baseline. Expect 80-120% of baseline (some users delayed by maintenance email).
5. **Slack post:** "T+2hr. Observability check complete. Logs clean / [issues]. Session count [%] of baseline."

If everything is clean:
- Send "we're live" announcement email to customer list (via `[CS_LEAD]`).
- Update Sales team in `#bb-sales`.
- Schedule the T+24hr GSC check.

### T+24hr (June 16 09:00 PT) — First-day GSC + indexation review

1. **GSC → Crawl stats:** Compare 24hr crawl count to the last 7-day average on bestbottles.com (which was serving the legacy code). Expect 1.5-3x increase (Google re-crawling everything).
2. **GSC → Coverage:** New "Indexed" count starts at ~10 (homepage + the 9 URLs we manually submitted). Will climb over days/weeks.
3. **GSC → Coverage → Errors:** Any 404 or "Redirect error" warnings = debug the corresponding redirect-map entry.
4. **Bing Webmaster Tools** → Sitemaps tab: confirm sitemap successfully fetched with all ~2,400 URLs counted.
5. **Manual indexing of top 10 priority URLs** (different from T+30min's set — focus on the 10 highest-equity legacy URLs from Stage 3 §5 table):
   - `/` (homepage)
   - `/bestbottles-compressed.pdf` (no indexing needed — confirm 200)
   - `/collections/perfume-vials-bottles` (or equivalent target)
   - `/collections/roll-on-bottles`
   - `/collections/metal-shell-atomizers`
   - `/collections/boston-round-amber-cobalt-blue` (top Boston Round target)
   - `/services/contract-packaging`
   - `/resources` (FAQ destination)
   - `/collections/cream-jars-lotion-bottles`
   - `/contact`

### T+72hr (June 18 09:00 PT) — Full sitemap crawl review

1. **GSC → Coverage:** Expect 30-60% of sitemap URLs to show "Discovered" or "Indexed". Slower-than-expected coverage = check sitemap accessibility, robots.txt, internal-linking density.
2. **Backlink redirect verification:** Pull the top 20 inbound backlinks from Ahrefs/Semrush/Search Console (whichever is available). For each backlink URL pointing to a legacy `.php`, confirm `curl -sI <url> | grep -i location` returns the expected redirect.
3. **AI crawler activity:** Check Vercel logs for `User-Agent` matches on `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, `anthropic-ai`. Each should appear at least once in the 72hr window. If `PerplexityBot` is absent, manually submit at https://www.perplexity.ai (limited; mostly we wait for organic discovery).

---

## 3. Pre-launch QA checklist

Every line below must be checkable. The launch-day go/no-go scorecard (separate file) consolidates these into a scored format. This list is the source-of-truth for what counts as "ready".

- [ ] **BB-SEO-001** Staging noindex confirmed (`X-Robots-Tag: noindex,nofollow` on `bestbottles.company`)
- [ ] **BB-SEO-002** `SITE_URL` defaults to `https://www.bestbottles.com`, production env var matches
- [ ] **BB-SEO-003** `verification.google` and `verification.other.msvalidate.01` present in `src/app/layout.tsx`
- [ ] **BB-SEO-004** `/sitemap.xml` returns ≥2,400 URLs in production-mode preview
- [ ] **BB-SEO-208** Per-page canonicals correct on `/`, `/catalog`, `/products/[slug]`, `/collections/[slug]`, `/blog/[slug]`, `/about`, `/contact`, `/request-quote`, `/request-sample`, `/resources`
- [ ] **BB-AEO-006** `/services/contract-packaging` page built, indexable, has Service + FAQPage JSON-LD
- [ ] **BB-AEO-001** `/llms.txt` at `public/llms.txt`, serves 200, content matches Stage 2 deliverable
- [ ] **BB-SEO-201** Sitemap reliable (caching + partial-fail fallback)
- [ ] **BB-SEO-202** Faceted-nav canonical + noindex strategy live (whitelisted filters indexable, others noindex)
- [ ] **BB-SEO-203** PDP renders Product + BreadcrumbList JSON-LD in initial HTML
- [ ] **BB-SEO-204** Blog posts render BlogPosting JSON-LD
- [ ] **BB-SEO-206** `/resources` FAQ wrapped in FAQPage JSON-LD
- [ ] **BB-SEO-207** `/contact`, `/request-quote`, `/request-sample` have bespoke metadata
- [ ] **BB-SEO-212** Vercel domain config: `www.bestbottles.com` primary, `bestbottles.com` 308 redirect to www
- [ ] **BB-SEO-101** Organization schema complete (full address, both phone numbers, full sameAs, both contactPoints)
- [ ] **BB-SEO-102** LocalBusiness schema in root layout
- [ ] **BB-AEO-002** robots.txt explicit allow for PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended
- [ ] robots.txt `Host:` directive matches `https://www.bestbottles.com`
- [ ] Sample 5 PDPs validate Product schema (paste 5 Rich Results Test result URLs in Linear)
- [ ] OG image renders at `https://www.bestbottles.com/og-default.png` (1200×630)
- [ ] Lighthouse Performance ≥80 on mobile for `/`, `/catalog`, sample PDP, sample blog post
- [ ] LCP < 2.5s, INP < 200ms, CLS < 0.1 on mobile for the 4 priority page types
- [ ] DNS TTL lowered to 300 seconds 24hr before cutover for `bestbottles.com` and `www.bestbottles.com`
- [ ] Database backup taken (Convex snapshot + Sanity dataset export, stored in two locations)
- [ ] Rollback path documented + dry-run completed in < 60 seconds
- [ ] GSC verified for ≥3 team members on `https://www.bestbottles.com/` property
- [ ] Bing Webmaster Tools verified for ≥2 team members
- [ ] Schema validators clean on top 10 URLs (linked in Linear)
- [ ] All 19 P1/P2/P3 tickets from Stage 1 reviewed (resolved or accepted-as-known-issue with owner + ETA)
- [ ] 301 redirect map deployed (150+ entries), 50-URL spot-check passes on preview
- [ ] Customer-facing maintenance email scheduled for T-24hr send
- [ ] Sales team brief (top 10 customer-visible changes) shipped to `#bb-sales`
- [ ] Slack `#bb-launch` channel created, all stakeholders invited
- [ ] Sentry / Mixpanel / Vercel Analytics dashboards saved-view configured for the cutover window
- [ ] PM `[PM_NAME]` and `[ENG_LEAD]` both confirm Vercel dashboard access from primary device

---

## 4. Post-launch monitoring runbook (30 / 60 / 90 day)

### Days 1-7 (June 16 – June 22)

**Daily checks, owned by `[SEO_LEAD]`. ~30 min/day.**

| Check | Tool | Acceptance |
|---|---|---|
| GSC crawl errors | GSC → Coverage → Errors | New errors trend down day-over-day. Any single-day spike >20 new errors = open ticket. |
| Indexation rate | GSC → Coverage → Indexed | Climbing daily. Target 200+ indexed URLs by day 7. |
| 4xx spike monitoring | Vercel Analytics | 4xx rate < 1% of requests sustained. Any 5min window >5% = page `[ENG_LEAD]`. |
| Top-50-URL canonical correctness | Manual spot-check via curl (see T+30min commands above) | Every URL still has correct canonical. |
| Sentry error feed | Sentry | No new error class. Existing errors trend down. |
| AI crawler hit logs | Vercel logs grep for crawler UAs | Each of GPTBot / Google-Extended / anthropic-ai / PerplexityBot / ClaudeBot / CCBot hits at least once per 48hr. |
| Conversion rate | Mixpanel funnel | Within ±20% of pre-launch baseline. >40% drop = incident, see Section 5. |

### Days 7-30 (June 23 – July 15)

**Weekly checks, owned by `[SEO_LEAD]`. ~2 hours/week.**

| Check | Cadence | Acceptance |
|---|---|---|
| Rankings on 8 AEO test queries from Stage 2 §3 | Weekly | Re-run each query in Google + Perplexity + ChatGPT. Compare to Stage 2 baseline (BB invisible in 7/8). By day 30: appear in ≥3/8 queries. |
| Rankings on Persona 2 keywords from Stage 4 | Weekly | Re-run the top 20 Persona 2 keyword set. Track top-10 appearances. |
| GSC Performance → Pages | Weekly | Identify any legacy URL whose impressions/clicks haven't migrated to the new URL. Each = 301 health check. |
| Backlink redirect health | Weekly | Pull top 50 inbound backlinks from Ahrefs/Semrush. Confirm each redirects correctly. |
| Top 20 PDPs Lighthouse | Weekly | Performance stays ≥80. Investigate any regression. |
| Sales team feedback | Weekly Slack post | Any reports of broken legacy bookmarks, missing features, or customer complaints = ticket. |

### Days 30-60 (July 16 – August 15)

**Bi-weekly checks plus first content sprint.**

| Task | Owner | Acceptance |
|---|---|---|
| Ship first content cluster per Stage 4 roadmap | `[SEO_LEAD]` + editorial | First cluster (5-7 articles) live by July 31. Includes question-shaped titles, named authors, Q+A blocks, BlogPosting + FAQPage schema. |
| Traffic recovery review | `[SEO_LEAD]` | Expect minor dip week 1-2, recovery by week 4 if redirects perfect. By day 60: organic sessions = 95-110% of pre-launch baseline. |
| Re-run AI search visibility test (Stage 2 §3) | `[SEO_LEAD]` | Best Bottles appears in ≥5/8 queries. AI Overviews mention Best Bottles in ≥2 queries. |
| Submit to ThomasNet, Knowde, Wonnda (BB-AEO-012) | `[SEO_LEAD]` | Confirmation emails on file. |
| Create Wikidata entry for Nemat International (BB-AEO-009) | `[SEO_LEAD]` | Q-item exists, links to bestbottles.com as official website. |
| First trade publication outreach round (Stage 2 §6.1) | `[CS_LEAD]` + founder | ≥3 outreach emails sent to BeautyMatter / Glossy / Beauty Independent. |

### Days 60-90 (August 16 – September 13)

**Backlink and entity audit.**

| Task | Owner | Acceptance |
|---|---|---|
| Backlink redirect audit, full | `[SEO_LEAD]` | Every redirect-map entry verified. Document any redirects that have been collapsed/folded (e.g., legacy subcat A and B both 301 to the same new URL). |
| Outreach to top legacy linking sites | `[SEO_LEAD]` + `[CS_LEAD]` | For top 20 sites linking to legacy `.php` URLs, send email asking to update links to new canonical URLs. ~30% will respond and update; that's expected and good. |
| Stage 4 content roadmap progress review | `[SEO_LEAD]` + editorial | At least 12 of the planned 26 articles shipped. Each with question-shaped title, FAQPage schema where relevant, BlogPosting schema, named author. |
| First post-launch SOW review | `[PM_NAME]` | Updated SOW status doc covering post-launch state. Decide Phase 2 priorities. |
| Verify GSC + Bing performance dashboards | `[SEO_LEAD]` | All 8 AEO test queries plotted. All Persona 2 keywords tracked. Rankings improving week-over-week. |

---

## 5. Rollback playbook

### When to roll back — trigger conditions

| Trigger | Threshold | Decision-maker | Detection |
|---|---|---|---|
| **A. 5xx error spike** | >5% of requests for >10 minutes | `[PM_NAME]` (with `[ENG_LEAD]` recommendation) | Vercel Analytics + Sentry |
| **B. 404 spike** | GSC reports >50 new 404s in 1 hour, OR Vercel logs show >100 unique 404 URLs in 30 min | `[PM_NAME]` | Vercel logs + GSC |
| **C. Conversion rate collapse** | >40% drop sustained for >2 hours, controlling for time-of-day | `[PM_NAME]` (with `[CS_LEAD]` recommendation) | Mixpanel + Shopify checkout completion rate |
| **D. Critical schema validation failure** | Product schema invalid on >10% of PDPs | `[SEO_LEAD]` (recommendation only — not auto-trigger) | Rich Results Test sweep |
| **E. Domain / DNS failure** | `bestbottles.com` returns NXDOMAIN or wrong server | `[ENG_LEAD]` (auto-execute) | `dig`, external uptime monitor |
| **F. Convex database corruption / outage** | Convex reports degraded availability | `[ENG_LEAD]` (auto-execute) | Convex status page + Sentry |

**Rollback decision-maker:** `[PM_NAME]`. May delegate to `[ENG_LEAD]` for triggers E and F (auto-execute allowed). Triggers A-D require explicit Slack-channel decision in `#bb-launch`.

### Rollback steps

1. **Slack post:** `[ENG_LEAD]` posts "ROLLBACK INITIATED. Trigger: [A/B/C/D/E/F]. ETA to complete: 90s."
2. **Vercel dashboard** → Project → Deployments
3. Find the last known-good deployment (typically the deploy from T-2 or T-1 dry-run, NOT the launch deploy)
4. Click the "..." menu → **"Promote to Production"**
5. Confirm in the dialog
6. Vercel re-routes traffic to the prior deploy within ~30 seconds. The domain alias resolves to the previous build.
7. **Verify rollback:** `curl -sI https://www.bestbottles.com/` returns 200 with the previous build's response headers. Eyeball the homepage HTML.
8. **Slack post:** "ROLLBACK COMPLETE. Site is on prior deploy ([deploy-id]). Investigating root cause."
9. **Notify CS team** to pause the "we're live" customer email if not already sent.
10. **Schedule post-mortem** within 24 hours.

**Estimated total rollback time:** 30-90 seconds (mostly Vercel propagation).

**What rollback does NOT solve:**
- Database corruption (Convex / Sanity) — that needs separate restore from the snapshot taken pre-launch.
- DNS changes that have propagated — if we changed nameservers, those don't auto-revert. (The 300s TTL window allows manual revert in 5-10 min.)
- External integrations — Shopify, TaxJar, FedEx integrations were not changed at launch (per SOW: those are M1 work that ships before launch). If they break post-launch, that's a separate playbook.

### Post-rollback decision tree

After rollback completes, the team has three options:

1. **Hotfix and re-deploy same day.** Acceptable if root cause is < 1 hour fix (typo, env var, redirect rule).
2. **Hotfix and re-deploy next day.** Acceptable if root cause is 2-8 hour fix; gives time for proper QA.
3. **Postpone launch to next week.** Required if root cause is structural (e.g., schema bug, sitemap generation timeout). PM `[PM_NAME]` notifies stakeholders.

---

## 6. Communication plan

### Internal team — Slack `#bb-launch`

- **T-24hr (June 14 09:00):** "Launch is GO. Cutover window 09:00-12:00 PT June 15. All-hands stand-by."
- **T-2hr (June 15 07:00):** "Cutover T-2hr. Pre-flight starting."
- **T-1hr (08:00):** "Cutover T-1hr. Deploying."
- **T-0 (09:00):** "Cutover T-0. New site live. Beginning verification."
- **T+5min, T+15min, T+30min, T+1hr, T+2hr:** Status update on each verification gate (PASS/FAIL).
- **T+2hr (11:00):** "Cutover complete. We're live. Customer email going out."
- **Every 30 min during cutover window** even if nothing changed: "Update: all systems nominal."
- **T+24hr (June 16 09:00):** Day-1 review post with GSC + Sentry + Mixpanel snapshots.
- **T+7d (June 22):** Week-1 retro post.

### Customer email — via `[CS_LEAD]`

**T-24hr (June 14 09:00 PT) — Maintenance window notice:**
- Subject: "Maintenance scheduled tomorrow 09:00-12:00 PT — possible brief slowdowns"
- Body: 80 words. Brief, factual, no promises beyond accurate description. List the 4 changes customers will notice (cleaner URLs, faster catalog, new contract-packaging page, AI assistant Grace). Apologize for any inconvenience.

**T+2hr (June 15 11:00 PT) — We're live:**
- Subject: "Best Bottles' new site is here — same products, faster experience"
- Body: 120 words. Bullet the 4 customer-visible changes. Link to `/about`, `/services/contract-packaging`, and a sample collection page. Invitation to reply with feedback.
- ONLY SEND if smoke test (T+1hr) and observability check (T+2hr) both PASS.

### Sales team brief — via `[CS_LEAD]`

Ship to `#bb-sales` Slack channel by June 12 EOD. Format: one-pager.

**Top 10 customer-visible changes:**
1. Cleaner URLs (no more `.php`).
2. Real product detail pages with photos, specs, variant selectors.
3. Mobile-first responsive design.
4. New `/services/contract-packaging` page with the same MOQ table customers know.
5. Faster catalog with filters by family, applicator, capacity, color, neck finish.
6. Grace AI assistant at `/grace-workspace` — answers compatibility, MOQ, fitment questions in seconds.
7. Same phone numbers, email, address, hours — nothing changes about how to reach us.
8. PDF catalog still at the same link.
9. Existing accounts still work; nothing requires re-creation.
10. If a customer reports a broken bookmark, ask them for the old URL — we have a redirect map that should catch it. If not, escalate to `[ENG_LEAD]`.

### Legacy bookmark holders

301 redirects handle them automatically. No proactive communication needed. Customer-success team should be ready to handle any "I tried my bookmark and it's broken" reports, but we expect < 5 such reports based on the redirect map coverage.

### Stakeholder summary (for Abbas + executive team)

Send a daily status summary at 17:00 PT for the first 3 days post-launch. Format: 5 bullets covering (1) site health, (2) sessions vs baseline, (3) conversion rate vs baseline, (4) any incidents and resolution, (5) tomorrow's priorities.

---

## 7. Appendix — quick-reference commands

### Test a single redirect
```bash
curl -sI "https://www.bestbottles.com/<legacy-path>" | grep -iE "(HTTP|location)"
```

### Confirm canonical on a page
```bash
curl -s "https://www.bestbottles.com/<path>" | grep -oE '<link rel="canonical"[^>]+>'
```

### Confirm Product schema on a PDP
```bash
curl -s "https://www.bestbottles.com/products/<slug>" | grep -oE 'application/ld\+json[^<]+' | head -3
```

### Submit a sitemap to GSC via API (alternative to UI)
```bash
# Requires OAuth — see https://developers.google.com/webmaster-tools/v1/sitemaps/submit
```

### Force a sitemap refresh on the new site
```bash
curl -s "https://www.bestbottles.com/sitemap.xml" > /tmp/sitemap.xml
xmllint --xpath "count(//*[local-name()='url'])" /tmp/sitemap.xml
```

### Promote a prior deployment (Vercel CLI alternative to dashboard)
```bash
# Requires Vercel CLI and project token
vercel rollback <deployment-url> --token=$VERCEL_TOKEN --scope=<team-slug>
```

### Compare two HTML responses for diff
```bash
diff <(curl -s "https://www.bestbottles.com/") <(curl -s "https://[preview-url]/")
```

---

*End of migration runbook. Companion files: `redirect-map.csv`, `launch-go-nogo-scorecard.md`.*
