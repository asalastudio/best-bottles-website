# Launch Go/No-Go Scorecard — Best Bottles Website Cutover 2026-06-15

**Decision meeting:** Sunday June 14, 10:00 PT
**Decision-makers:** `[PM_NAME]` (final), `[ENG_LEAD]`, `[SEO_LEAD]`, `[CS_LEAD]`
**Scoring window:** Complete this scorecard between June 12 EOD and June 14 09:30 PT.
**Companion runbook:** `migration-runbook.md`. Companion redirect map: `redirect-map.csv`.

## How to use this scorecard

1. Each item below is scored binary unless a partial credit column is shown.
2. Total possible: **30 points**.
3. **GO threshold:** ≥27/30 **AND zero P0 unresolved**.
4. **NO-GO triggers (any one is sufficient):**
   - Any P0 SEO ticket (BB-SEO-001 through BB-SEO-004) unresolved
   - Rollback path not tested (or last test >7 days old)
   - Fewer than 2 team members with verified Vercel production-dashboard access
   - Database backup not taken within the last 48 hours
   - DNS TTL not lowered to 300s on `bestbottles.com` + `www.bestbottles.com`
5. **Marginal GO (25-26/30 with no NO-GO trigger):** Discussion required. PM may approve with a documented punch list to ship within 7 days post-launch.

---

## Scorecard

| # | Category | Item | Status | Score | Notes |
|---|---|---|---|---|---|
| 1 | P0 Bugs | BB-SEO-001 staging noindex confirmed | ☐ | __/1 | `curl -sI https://bestbottles.company/ \| grep x-robots-tag` |
| 2 | P0 Bugs | BB-SEO-002 `SITE_URL` defaults to production + build-time guard | ☐ | __/1 | View-source on preview shows correct canonical |
| 3 | P0 Bugs | BB-SEO-003 verification tokens in metadata | ☐ | __/1 | Both Google + Bing meta tags present |
| 4 | P0 Bugs | BB-SEO-004 sitemap contains ≥2,400 URLs | ☐ | __/1 | `xmllint --xpath "count(//*[local-name()='url'])"` on `/sitemap.xml` |
| 5 | P0 Bugs | BB-SEO-208 per-page canonicals correct on every route type | ☐ | __/1 | Spot-check 6 route types (`/`, `/catalog`, `/products/X`, `/collections/X`, `/blog/X`, `/contact`) |
| 6 | Content | `/services/contract-packaging` page built + linked | ☐ | __/1 | Indexable, MOQ table present, Service + FAQPage JSON-LD validates |
| 7 | AEO | `/llms.txt` at `/public/llms.txt`, serves 200 | ☐ | __/1 | `curl https://[preview]/llms.txt` returns 200 + markdown body |
| 8 | Schema | Organization schema complete (full address, both phones, full sameAs) | ☐ | __/1 | Rich Results Test pass |
| 9 | Schema | LocalBusiness schema added | ☐ | __/1 | Rich Results Test pass with Union City NAP |
| 10 | Schema | FAQPage schema on `/resources` + ≥10 other pages | ☐ | __/1 | At least 10 pages render FAQPage JSON-LD |
| 11 | Schema | BlogPosting schema on all 9 blog posts | ☐ | __/1 | View-source on each post |
| 12 | Schema | PDP renders Product + BreadcrumbList JSON-LD in initial HTML (BB-SEO-203) | ☐ | __/1 | View-source on 3 sample PDPs, no JS execution required |
| 13 | Schema | Schema validators clean on top 10 URLs | ☐ | __/1 | Linear ticket has 10 Rich Results Test result URLs attached |
| 14 | Sitemap | Sitemap contains ≥2,400 URLs in production-mode preview | ☐ | __/1 | Counts match Convex product count + collections + blog + static |
| 15 | Sitemap | Sitemap reliability: ≥240 URLs returned even with simulated Convex failure (BB-SEO-201) | ☐ | __/1 | Test with env override to break Convex query |
| 16 | Redirects | Redirect map deployed (150+ entries) | ☐ | __/1 | `next.config.ts` redirects() pulls from `src/lib/redirects.ts` |
| 17 | Redirects | 50-URL spot-check passes on preview | ☐ | __/1 | Use the T+15min curl commands from migration runbook against preview deploy |
| 18 | Redirects | Vercel www config: `bestbottles.com` 308s to `www.bestbottles.com` (BB-SEO-212) | ☐ | __/1 | `curl -I https://bestbottles.com/` returns 308 |
| 19 | Redirects | `bestbottles.company` → `bestbottles.com` redirect verified | ☐ | __/1 | Per pre-completed task #9. Confirm still working. |
| 20 | QA | Top 20 URLs Lighthouse mobile Performance ≥80 | ☐ | __/1 | Reports stored in shared drive |
| 21 | QA | LCP <2.5s, INP <200ms, CLS <0.1 on 4 priority page types | ☐ | __/1 | CrUX-style local capture |
| 22 | Robots | robots.txt allows GPTBot, Google-Extended, anthropic-ai, PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended (BB-AEO-002) | ☐ | __/1 | `curl /robots.txt` shows explicit allows |
| 23 | OG | OG image renders at `/og-default.png` (1200x630) | ☐ | __/1 | Open Graph Debugger pass |
| 24 | Infra | DNS TTL lowered to 300 seconds for `bestbottles.com` + `www.bestbottles.com` | ☐ | __/1 | Set ≥24hr before cutover. `dig` confirms. |
| 25 | Infra | Database backup taken: Convex snapshot + Sanity dataset export, stored in two locations | ☐ | __/1 | Within last 48 hours. S3 + local. |
| 26 | Infra | Rollback path tested in dry-run within last 7 days, completes in <60s | ☐ | __/1 | Promote prior staging deploy, measure time, re-promote latest |
| 27 | Access | GSC + Bing Webmaster verified for ≥3 team members | ☐ | __/1 | Each visible on respective Users panels |
| 28 | Access | Vercel production-dashboard access verified for ≥2 team members | ☐ | __/1 | Each opens dashboard from primary device, confirms domain visible |
| 29 | Triage | All 19 P1/P2/P3 tickets from Stage 1 audit reviewed | ☐ | __/1 | Each is either resolved OR has an "accepted as known issue" decision with owner + ETA |
| 30 | Comms | Customer maintenance email scheduled for T-24hr + Sales team brief shipped to `#bb-sales` | ☐ | __/1 | Both confirmed by `[CS_LEAD]` |

**TOTAL: __ / 30**

---

## Decision

- [ ] **GO** — score ≥27/30, zero P0 unresolved, no NO-GO triggers. Cutover proceeds June 15 09:00 PT.
- [ ] **GO (marginal)** — score 25-26/30, no NO-GO triggers, documented punch list for week-1 post-launch. PM signature required.
- [ ] **NO-GO** — any single NO-GO trigger fired OR score <25/30. Reschedule to the next viable Monday (June 22). Document blockers + remediation plan.

**Signature (PM):** _____________________  **Date:** _________
**Signature (Eng Lead):** _____________________  **Date:** _________
**Signature (SEO Lead):** _____________________  **Date:** _________

---

## Notes on under-rated items

The team-meeting discussion should explicitly cover items **24, 26, and 29** — these are the most commonly skipped pre-launch checks across migration projects we have audited:

- **Item 24 (DNS TTL 300s):** Many teams skip this because Vercel handles routing internally. But if Vercel itself has a region outage or the domain attach fails mid-cutover, a 300s TTL is the difference between a 5-minute fix and a 48-hour propagation wait. This single setting is the cheapest insurance available — set it at T-25hr without exception.
- **Item 26 (Rollback dry-run):** Teams over-trust "we can just promote a prior deploy in Vercel". Yes, that works — but the first time you do it under stress, you discover Vercel UI quirks, deploy-list pagination, or that the "Promote" button is actually labeled "Activate" on the current Vercel UI version. Do it once in calm conditions so you do it in 30 seconds under pressure.
- **Item 29 (P1/P2/P3 review):** It is tempting to mark all non-P0 tickets as "post-launch". The discipline that matters is making the deferral explicit — owner, ETA, why it is acceptable to defer. Items 8 (Organization schema), 12 (PDP SSR), and 13 (schema validator pass) are the ones most often deferred when teams should NOT defer them, because they compound the SEO impact of every other item on this scorecard.

## Items that are NOT on this scorecard (and why)

- **Shopify checkout / TaxJar / FedEx integrations (SOW M1):** out of scope for the SEO audit. The Stage 0 brief notes these are SOW launch-critical and tracked separately in Linear (BB-1, BB-71, BB-151, BB-152). If any are not green, that's a separate go/no-go input, not part of this scorecard.
- **Madison hero image completeness:** Empire is in M3 scope. Other families use placeholder fallbacks per SOW. SEO-wise this is fine — alt text and structured data still validate; visual completeness is a separate product-quality lens.
- **Customer portal / Grace v3 expansion:** Phase 2. Not blocking launch.
- **Wikipedia / Wikidata entries:** post-launch (BB-AEO-009). Helpful for AEO but not gating June 15.

---

*Print this page. Tape it to the wall in the war room. Fill it out in pen on June 14.*
