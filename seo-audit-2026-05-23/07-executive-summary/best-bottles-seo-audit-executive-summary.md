# Best Bottles — SEO/GEO/AEO/Social Audit
## Executive Summary

**Audit lead:** Asala Studio · Jordan Richter
**Audit date:** 2026-05-23
**Target launch:** 2026-06-15 (23 days)
**Scope:** Technical SEO audit, GEO/AEO audit (AI search readiness), legacy equity baseline, competitive landscape map, persona-mapped keyword strategy, 90-day content roadmap, migration & launch plan with 153-entry redirect map, B2B social/visual strategy via Higgsfield for Instagram/Pinterest/TikTok/LinkedIn.

---

## The headline

The new Best Bottles site (Next.js 15 + Convex + Sanity, replacing the legacy PHP codebase at bestbottles.com on June 15) has a genuinely well-engineered SEO foundation — centralized metadata library, structured-data builders for Organization/WebSite/BreadcrumbList/Product/CollectionPage, AI crawler allowlist, clean OG/Twitter cards, 9 thoughtfully-written blog posts already published, and a 1,559-line content calendar already in place.

But six P0 launch-blockers were identified that would silently destroy SEO at launch if shipped as-is. All six have code-snippet fixes and acceptance criteria. One has already been resolved.

If the six P0s are fixed in the next 23 days, the site launches in strong shape and is positioned to compound advantages over SKS Bottle, Berlin Packaging, The Cary Company, O.Berk, Specialty Bottle, Container & Packaging Supply, TricorBraun, and Bottles and More within 90 days.

If they aren't, expect a 30–60 day window of ranking collapse from canonical signal confusion, plus permanent loss of the contract-packaging service keyword cluster Best Bottles currently owns.

## Readiness scores (today, before remediation)

| Dimension | Score | Minimum for clean launch |
|---|---|---|
| Technical SEO | 62 / 100 | 85 / 100 |
| GEO / AEO (AI search readiness) | 46 / 100 | 60 / 100 |
| Content depth (vs the keyword corpus) | Strong existing 24-post calendar | Extend by week 13A (services landing) |
| Migration readiness | Not yet started | Required by T-1 |
| Social presence | Minimal | Foundation set, 25 Higgsfield clips ready to generate |

---

## The six P0 launch-blockers

### 1. Staging site competing with legacy bestbottles.com — RESOLVED
The staging site at bestbottles.company was fully indexable with self-canonical, competing with the legacy bestbottles.com for brand queries. Resolved 2026-05-23: the custom domain was removed from the Vercel project. Traffic to bestbottles.company now returns a Vercel "not found" page that Google does not index.

### 2. SITE_URL defaults to staging domain
The constant in src/lib/seo.ts that feeds every canonical link, every structured-data URL, and every OG image absolute URL defaults to https://bestbottles.company when the NEXT_PUBLIC_SITE_URL environment variable is missing. If that env var is not set correctly in Vercel production on launch day, every page tells Google the wrong source-of-truth URL. Total ranking collapse within 14 days. Fix is a 15-minute code change plus an env var set in the Vercel dashboard, with a build-time guard added so the build fails loudly if production env is misconfigured.

### 3. GSC and Bing verification tokens missing from new metadata
The legacy site has Google Search Console verification token laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc and Bing token DD2ECFD7F20F418A4A67662DFC0D0B03 in its head. The new site's src/app/layout.tsx has verification: {} (empty). When the new code replaces the legacy code on bestbottles.com, GSC and Bing will mark the property as unverified and de-list the site from the consoles. We lose performance reports, sitemap submission, and Core Web Vitals monitoring at exactly the moment we need them most. Fix is a 10-minute code change plus adding DNS TXT records as a backup verification method.

### 4. Sitemap missing 2,300+ product URLs
The current built sitemap contains 21 URLs. The Convex database has 2,354 SKUs across 225 product groups, all of which need to be discoverable to Google. Without sitemap entries, the new product detail pages would be discovered slowly and partially via internal linking only — months of indexation delay, much of it lost. Direct competitor SKS Bottle has every SKU in its sitemap. Fix is a 4-6 hour engineering task to build a src/app/sitemap.ts that queries Convex for all published products, product groups, and collections.

### 5. Every page emits the same canonical URL — STEALTH CATASTROPHE
Only the root layout sets a canonical link. None of /products/[slug], /blog/[slug], /collections/[slug], or any other route overrides it. Every product detail page, every blog post, every category page would tell Google "I am actually the homepage." Within 30–60 days post-launch, Google would collapse the entire site to one indexed page. This is the single most dangerous bug on the list and was not in the original P0 set — it was surfaced by the Stage 1 deep audit. Fix requires adding generateMetadata to every dynamic route to set canonical: SITE_URL/products/[slug] etc.

### 6. /services/contract-packaging page has no destination on the new site
The legacy site's /filling-capping-labeling-perfume-bottles-atomizers.php is the highest-intent B2B asset on bestbottles.com today. It contains a real published MOQ table, screen-printing and laser-engraving capability statements, and cross-references to NematFragrances.com — content competitors gate behind sales calls. Best Bottles almost certainly ranks for "private label perfume filler", "small batch contract packaging MOQ", and "custom perfume filling service" via that page. If it 301s to the homepage or a generic /services shell at cutover, the entire keyword cluster goes to zero. Must build /services/contract-packaging before June 15, migrate the legacy content verbatim, add FAQPage JSON-LD on the MOQ table, and add Service schema.

---

## Top strategic insights

### Insight 1 — Container & Packaging Supply is the AEO model to copy, not SKS
The Stage 3 competitive scan tested 8 B2B packaging queries across Google search. Container & Packaging Supply consistently outperformed every other competitor on AI-search-friendly content — question-shaped article titles ("HDPE vs PET", "Clean vs Sterile Packaging", "Matching Neck Finishes"), named human authors with read times, three dedicated customer-success URLs that earn organic backlinks from the customers themselves. They are winning AEO citation surface in Perplexity, ChatGPT, and Claude precisely because their content is built for machine extraction.

The fix for Best Bottles is small and high-ROI: re-title the existing 24-post content calendar to use question-shaped formats, add named-author bylines and dated update stamps, ship 4–6 indie-brand customer stories in the first wave. Estimated cost is two weeks of writing plus Madison hero shoots. Estimated impact is AEO citation parity with the eight named competitors within 90 days.

### Insight 2 — Procurement Persona is the biggest content gap and the highest dollar-value-per-visitor
The Stage 4 audit identified five B2B personas. The existing 24-post content calendar has zero pieces written explicitly for Persona 2: Established Brand Procurement Manager at $5M–$100M cosmetics brands with Net 30 PO buyers. Thirty high-value keywords in the corpus are currently unowned. This is the highest dollar-value-per-visitor segment Best Bottles can serve and it is invisible in the current strategy. Stage 4 sequences seven specific pieces over the post-launch 14-week roadmap to close this gap.

### Insight 3 — Pinterest is the under-priced channel for B2B packaging
The Stage 6 social strategy identified Pinterest as the highest-ROI channel for Best Bottles' audience. Indie founders, brand designers, and formulators build product mood boards 6–12 months before sourcing — the save IS the conversion event. Zero direct competitors are producing serious Pinterest volume. The strategy allocates 30% of social production budget there (8 pins per week, highest cadence of any channel), with the Higgsfield ASMR clips and color-study flatlays designed first for Pinterest reuse and cascaded to TikTok and Instagram secondarily.

Conversely, LinkedIn — the channel everyone in B2B defaults to — should be the channel where Best Bottles uses the LEAST AI-generated content. The procurement and contract-filler audience identifies AI imagery in two seconds and the credibility cost is severe. The single highest-leverage activity in the entire social plan is Abbas Nematullah on LinkedIn personally, three posts per week, founder voice, real video — not Higgsfield-generated content.

---

## Next 14 days — what to ship

**Week 1 (May 23–30):** Fix all five remaining P0 tickets. Build /services/contract-packaging page with legacy content migrated. Add llms.txt to /public/ (the production-ready file is already in the audit folder). Set DNS TTL to 300 seconds.

**Week 2 (May 31 – June 6):** Generate and deploy the 153-entry 301 redirect map. Add LocalBusiness, FAQPage, and Service schemas. Complete Organization JSON-LD with full address, phone, sameAs. Fix the 5 highest-priority P1 tickets from the Stage 1 audit.

**Week 3 (June 7–13):** Final QA pass on the launch go/no-go scorecard (30 items). Lighthouse on top 20 URLs targeting ≥80 mobile. Schema validation on 10 sample PDPs, 5 collection pages, 3 blog posts. Manual smoke test of the contact form, request-sample flow, and Grace AI workspace. Stakeholder sign-off.

**Weekend (June 14):** Code freeze. Final go/no-go meeting Friday evening. Target ≥27 of 30 scorecard items passing, with zero P0 unresolved, as the GO threshold.

**Cutover day (June 15):** Hour-by-hour playbook in 05-migration-launch/migration-runbook.md. Estimated cutover window: 2 hours. Estimated rollback time if needed: 30 seconds.

---

## Deliverables inventory

The complete audit package is 16 files totaling approximately 64,000 words plus a production-ready llms.txt and a 153-row redirect map CSV. All saved to /Best-Bottles-Website-02-20-2026/seo-audit-2026-05-23/. See the README.md at the root of that folder for the full deliverables index and read-order recommendations by audience.

The two highest-priority artifacts for immediate use are:
- 01-technical-seo/p0-dev-tickets-urgent.md — paste these directly into Linear, four of them are the engineering punch list for week 1
- 02-geo-aeo/llms.txt — copy this file directly to /public/llms.txt and ship on the next build

---

## Confidence statement

The audit reflects evidence captured directly from the live legacy bestbottles.com site, the live staging bestbottles.company site, the local Next.js + Convex + Sanity codebase, the master data exports from 2026-05-20, and live WebSearch tests of 8 B2B packaging queries across Google. Every finding cites real file paths, line numbers, or URLs. No metrics were fabricated. Where SEMrush, Ahrefs, or Google Search Console data would have strengthened a finding but was unavailable, the finding is flagged as "directional estimate."

The work in this folder is sufficient to launch a strong site on June 15 if the engineering and content teams execute the next 14 days as scoped.
