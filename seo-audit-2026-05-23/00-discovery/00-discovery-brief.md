# Best Bottles — SEO/GEO/AEO Audit · Stage 0 Discovery Brief

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Audit date:** 2026-05-23
**Target launch:** 2026-06-15 (23 days from today)
**Scope:** Comprehensive SEO + GEO/AEO + Technical audit, keyword & content strategy, migration plan, and Higgsfield-driven social/visual strategy for IG/Pinterest/TikTok/LinkedIn.

---

## TL;DR — Where we stand

The new Best Bottles site (built on Next.js 15 + Convex + Sanity, currently running at `bestbottles.company`) is going to **replace the legacy `bestbottles.com` codebase** on the same domain at launch. This is the easy path: brand graph stays intact, GSC verification transfers, and the 301 map only needs to cover legacy `.php` → new clean URL paths.

The technical foundation of the new site is genuinely good — full Next.js Metadata API, centralized `lib/seo.ts`, structured-data builders for Organization/WebSite/BreadcrumbList/Product/CollectionPage, AI crawler allowlist (`GPTBot`/`Google-Extended`/`anthropic-ai`), clean OG/Twitter cards. There is real engineering muscle here.

But there are **four launch-blocking bugs** that would silently destroy SEO on June 15 if shipped as-is. They are detailed below as P0 tickets and need to be fixed this week.

There is also one **urgent issue that's losing rankings today**: the staging site at `bestbottles.company` is currently fully indexable and self-canonical, competing with `bestbottles.com` for brand queries. Fix today.

---

## Domain strategy (confirmed)

| | URL | Role | Notes |
|---|---|---|---|
| Legacy | `https://www.bestbottles.com/` | Currently live · receiving orders | Old PHP codebase, ~150 indexed URLs, has Google + Bing verification tokens, deep faceted navigation, "Copyright 2020" footer |
| Staging | `https://bestbottles.company/` | New build, currently public | Next.js 15 + Convex + Sanity. ⚠️ **Currently indexable** — see P0-2 |
| Launch (2026-06-15) | `https://www.bestbottles.com/` (replacing PHP) | New codebase deployed to legacy domain | Brand graph preserved, redirect map = path-level only |
| Post-launch | `https://bestbottles.company/` | Retired | 301 redirect everything → bestbottles.com |

---

## Master data — current sources of truth

These are the files I'll reference throughout the audit. Most-recent first.

### Product / catalog data
| File | Path | Size | Modified | Use |
|---|---|---|---|---|
| **Convex products (current)** | `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv` | 25 MB | 2026-05-20 | Source-of-truth for every SKU in production Convex |
| **Convex product groups (current)** | `data/audits/2026-05-20-image-audit/convex_product_groups_current_2026-05-20.csv` | 80 KB | 2026-05-20 | 225 product groups (parent products) |
| **Convex snapshot (JSON)** | `data/audits/2026-05-20-image-audit/convex_snapshot.json` | 34 MB | 2026-05-20 | Full Convex export for programmatic queries |
| **Convex Image Source Audit (workbook)** | `data/audits/2026-05-20-image-audit/Best_Bottles_Convex_Image_Source_Audit_2026-05-20.xlsx` | 928 KB | 2026-05-20 | Most current Excel-format master view |
| **Master Sheet v1.4** | `docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx` | 1.3 MB | 2026-02-25 | Canonical product spec from Abbas — older but authoritative on naming, fitments, weights |
| **Legacy crawl** | `data/live-site-product-master.json` | 144 KB | 2026-04-10 | 106 products extracted from live bestbottles.com crawl |
| **Product gap report** | `data/PRODUCT-GAP-REPORT.txt` | 24 KB | 2026-04-10 | 61 SKUs on legacy site missing from Convex; 207 in Convex not on legacy site |
| **Nemat product catalog** | `Nemat_Product_Catalog.csv` (root) | 1.9 MB | 2026-04-10 | Full Nemat catalog from ERP |
| **Best Bottles Catalog (PDF)** | `docs/Best Bottles Catalog.pdf` | — | — | Printable catalog distributed to customers |

### Existing strategy / launch documents (don't duplicate — extend)
| File | Path | Lines | Why it matters for this audit |
|---|---|---|---|
| **SEO Content Calendar** | `docs/SEO_CONTENT_CALENDAR.md` | 1,559 | Pre-existing 12-week, 24-post editorial calendar using Halbert/Ogilvy/Schwartz frameworks. Will extend, not replace. |
| **SOW Launch Plan** | `docs/SOW_LAUNCH_PLAN_2026-05-04.md` | 187 | Status update from 2026-05-04 showing 4/12 SOW deliverables done, 4/12 partial, 4/12 not started. Original launch was 2026-05-25; now slipped to 2026-06-15. |
| **Product Launch Gameplan** | `docs/PRODUCT_LAUNCH_GAMEPLAN.md` | 477 | 7-phase rollout: data → Convex → Shopify → Sanity → PDPs → Paper Doll → Grace |
| **UX Audit Report** | `UX-AUDIT-REPORT.md` (root) | — | Existing UX findings from 2026-03-09 |
| **User Journey Analysis** | `USER-JOURNEY-ANALYSIS.md` (root) | — | Existing user journey work from 2026-03-09 |
| **Catalog Intelligence UX Audit** | `docs/catalog-intelligence-ux-audit.md` | — | UX-focused catalog audit |

### Site infrastructure (audited in detail in Stage 1)
| File | Path | Status |
|---|---|---|
| **next-sitemap config** | `next-sitemap.config.js` | ✅ Correctly points to `https://www.bestbottles.com` (production target) |
| **SEO library** | `src/lib/seo.ts` | ⚠️ `SITE_URL` defaults to `https://bestbottles.company` — see P0-1 |
| **Root layout metadata** | `src/app/layout.tsx` | ✅ Uses Metadata API, JSON-LD injected. ⚠️ `verification: {}` is empty — see P0-3 |
| **robots.txt (built)** | `public/robots.txt` | ✅ Host directive + sitemap point to bestbottles.com; AI crawlers allowed |
| **sitemap.xml (built)** | `public/sitemap.xml` + `public/sitemap-0.xml` | ⚠️ Only 21 URLs. Missing 2,300+ PDPs — see P0-4 |

---

## Legacy site (bestbottles.com) — what we're preserving

Fetched 2026-05-23 from live site. Full evidence in `raw/legacy-homepage-fetch-2026-05-23.md`.

### What's earning today (preserve through migration)
- **Google Site Verification:** `laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc` — must move to new site's verification metadata
- **Bing Webmaster verification:** `DD2ECFD7F20F418A4A67662DFC0D0B03` — same
- **Brand graph:** `bestbottles.com` is the cross-linked hub for `NematInternational.com`, `glassbottles.com`, LinkedIn (`/in/best-bottles-0b0160201/`, `/company/best-bottles-wholesale`), Facebook (`/NematBestBottles`), Twitter (`@Best_Bottles`), Faire (`/brand/b_bzqsxpr4yl`)
- **PDF catalog:** `/bestbottles-compressed.pdf` is linked from header AND footer — high-traffic asset

### Legacy IA (becomes the input to redirect mapping)
4 top-level categories → ~24 subcategory pages → 106 indexed product pages → ~10 informational pages → 1 PDF catalog. **Conservative estimate: ~150 URL entries in the redirect map.**

### Legacy weaknesses (the rebuild already fixes)
- Title is 272 characters, keyword-stuffed
- No Product / Organization / LocalBusiness / BreadcrumbList schema
- JS-only CTAs (`javascript:weshipworld()`)
- "Copyright 2020" footer signals abandonment
- Querystring-driven subcategory pages (`?subcat=64`) create duplicate-content risk

---

## New site (bestbottles.company) — what's already strong

Fetched 2026-05-23 from staging. Source-of-truth read from `src/app/layout.tsx` and `src/lib/seo.ts`.

### Strong baseline
1. Next.js Metadata API used correctly — title template (`%s | Best Bottles`), description, OG, Twitter, robots all centralized
2. Centralized `lib/seo.ts` with structured-data builders for Organization, WebSite (with SearchAction sitelinks search box), BreadcrumbList, Product (with AggregateOffer + availability), CollectionPage
3. AI crawler allowlist in robots.txt: `GPTBot`, `Google-Extended`, `anthropic-ai` — solid GEO/AEO foundation
4. Robots.txt correctly disallows `/api/`, `/portal/`, `/studio/`, `/sign-in/`, `/_next/`
5. OG image is 1200×630 at `/og-default.png`
6. Twitter card is `summary_large_image`
7. `max-snippet: -1`, `max-image-preview: large`, `max-video-preview: -1` — Google gets full control to render rich snippets
8. 9 blog posts already published (boston round vs euro dropper, neck finish numbers, etc.) — solid content foundation aligned with B2B buyer intent
9. Server-side mega-menu rendering via Sanity — good for crawlers
10. Cmd palette + faceted catalog — UX upgrade from legacy

### URL structure (clean, but needs to scale)
| Route | Use | Indexable | SEO priority |
|---|---|---|---|
| `/` | Homepage | Yes | High |
| `/catalog` | Main catalog | Yes | Very high |
| `/products/[slug]` | PDPs | Yes | Very high (per SKU) |
| `/collections/[slug]` | Curated collections | Yes | High |
| `/blog` + `/blog/[slug]` | Editorial | Yes | High |
| `/resources` | Knowledge base | Yes | Medium-high |
| `/about` | Brand | Yes | Medium |
| `/contact` | Contact | Yes | Medium |
| `/request-quote` | Conversion | Yes | Medium |
| `/request-sample` | Conversion | Yes | Medium |
| `/tech-stack`, `/example`, `/fitment-demo` | Dev/internal | ⚠️ Sitemap excludes via next-sitemap.config.js — verify | Should be noindex |
| `/cart`, `/grace-workspace` | Dynamic / tool | ⚠️ Currently in sitemap — should be noindex | Should be noindex |
| `/portal/*` | Authenticated B2B | Excluded from sitemap ✅ | Noindex |
| `/studio/*` | Sanity CMS | Excluded ✅ | Noindex |
| `/sign-in`, `/sign-up` | Auth | Excluded ✅ | Noindex |
| `/api/*` | API routes | Excluded ✅ | Noindex |

---

## P0 launch-blocking bugs (must fix before 2026-06-15)

### P0-1 · `SITE_URL` defaults to staging domain
**Evidence:** `src/lib/seo.ts:8-10`
```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://bestbottles.company";
```
**Impact:** If `NEXT_PUBLIC_SITE_URL` env var is missing or wrong on the production Vercel deploy, every canonical, every structured-data URL, every absolute OG image URL points to the staging domain. Google's canonical signals would tell it `bestbottles.company` is the source-of-truth even though it's served from `bestbottles.com`. Total ranking loss within ~14 days.

**Fix:**
- Change default to `"https://www.bestbottles.com"` (the production URL is more important than the staging default)
- Set `NEXT_PUBLIC_SITE_URL=https://www.bestbottles.com` in Vercel production environment
- Add an env var check that throws build-time error if `NEXT_PUBLIC_SITE_URL` doesn't match `https://www.bestbottles.com` in production

### P0-2 · Staging site is fully indexable RIGHT NOW
**Evidence:** Live fetch of `https://bestbottles.company/` 2026-05-23 returned `meta-robots: index, follow` and `canonical: https://bestbottles.company`.
**Impact:** Google is currently crawling and indexing staging. Every day it stays this way, the legacy `bestbottles.com` loses ranking share to its duplicate. Brand queries ("best bottles wholesale") will split traffic.

**Fix (any one is sufficient, all three is belt-and-braces):**
1. Add `<meta name="robots" content="noindex,nofollow">` to all staging pages when host = `bestbottles.company`
2. Add Vercel-side basic auth on the staging domain
3. Add Vercel response header `X-Robots-Tag: noindex` for the staging hostname

Implementation in Next.js (recommend option 1 + 3):
```ts
// src/app/layout.tsx — in generateMetadata or inline metadata
const isStaging = process.env.VERCEL_ENV !== "production"
  || SITE_URL.includes("bestbottles.company");
robots: isStaging
  ? { index: false, follow: false }
  : { index: true, follow: true, googleBot: {...} },
```

### P0-3 · Verification tokens missing from new-site metadata
**Evidence:** `src/app/layout.tsx:84` shows `verification: {},`
**Impact:** When the new site deploys to bestbottles.com, Google Search Console and Bing Webmaster will report the verification as broken because the tokens aren't in the head. GSC could de-verify the property and we lose the historical data.

**Fix:**
```ts
verification: {
  google: "laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc",
  other: {
    "msvalidate.01": "DD2ECFD7F20F418A4A67662DFC0D0B03",
  },
},
```
Also add the DNS TXT record verification method as a backup.

### P0-4 · Sitemap is missing 2,300+ product URLs
**Evidence:** `public/sitemap-0.xml` contains 21 URLs. `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv` is 25MB with 2,354 SKUs across 225 product groups. Only `/collections/boston-round-30ml` appears in the sitemap, and zero `/products/[slug]` URLs are listed.
**Impact:** Google can only index what it can find. Without sitemap entries, the new PDPs would discover-and-index purely via internal linking — slow, partial, and at Google's pace (months, not weeks).

**Fix:**
- Create `src/app/sitemap.ts` (Next.js 15 native sitemap) that queries Convex for all published products and all product groups, returning a `MetadataRoute.Sitemap[]`
- Or extend `next-sitemap` config with a dynamic source (the `additionalPaths` callback) that pulls from Convex
- Verify the existing `src/app/server-sitemap.xml/` route is generating product entries — if not, this is where they should be added
- Target: sitemap should contain ~2,500 URLs (homepage + 4 top-level pages + ~30 collection pages + ~225 product group pages + ~2,300 SKU-level pages + 9 blog posts + ~10 resource pages)

---

## P1 high-priority fixes (within 7 days of launch)

### P1-1 · Organization JSON-LD is incomplete
`src/lib/seo.ts:20-45` — currently only has `addressCountry: "US"`, no phone, sameAs is missing Facebook/Twitter/Faire/LinkedIn-personal, contactPoint missing telephone. Fix per legacy site evidence:
```ts
address: {
  "@type": "PostalAddress",
  streetAddress: "34135 7th St",
  addressLocality: "Union City",
  addressRegion: "CA",
  postalCode: "94587",
  addressCountry: "US",
},
contactPoint: [
  {
    "@type": "ContactPoint",
    contactType: "sales",
    email: "sales@nematinternational.com",
    telephone: "+1-800-936-3628",
    areaServed: ["US", "CA"],
    availableLanguage: ["English"],
  },
  {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: "+1-510-445-0300",
  },
],
sameAs: [
  "https://www.linkedin.com/company/best-bottles-wholesale",
  "https://www.linkedin.com/company/nemat-international",
  "https://www.facebook.com/NematBestBottles",
  "https://twitter.com/Best_Bottles",
  "https://www.faire.com/brand/b_bzqsxpr4yl",
  "https://www.instagram.com/bestbottles", // verify exists first
],
```

### P1-2 · No LocalBusiness schema
With a physical Union City CA address and walk-in capability, add `LocalBusiness` (subtype `Store`) schema separately from `Organization`. Maps integration + local pack visibility.

### P1-3 · No llms.txt
For GEO/AEO, add `/llms.txt` (covered in Stage 2). This is now a quasi-standard for AI crawlers to find a structured brand summary.

### P1-4 · Email mismatch
`src/lib/seo.ts` uses `sales@bestbottles.com`. Legacy site uses `sales@nematinternational.com`. Pick one and align everywhere (footer, schema, contact page, Grace agent prompts).

### P1-5 · `/cart` and `/grace-workspace` in sitemap
These shouldn't be indexed. Add to `exclude` in `next-sitemap.config.js`:
```js
exclude: [
  "/api/*", "/portal/*", "/studio/*", "/sign-in/*",
  "/example", "/fitment-demo",
  "/cart", "/grace-workspace", "/tech-stack", // ADD THESE
],
```

---

## What I'll deliver by 2026-06-15

| Stage | Deliverable | Path | Status |
|---|---|---|---|
| 0 | Discovery brief | `00-discovery/00-discovery-brief.md` | ✅ This file |
| 0 | Legacy site fetch evidence | `raw/legacy-homepage-fetch-2026-05-23.md` | ✅ Done |
| 1 | Technical SEO audit (full) | `01-technical-seo/technical-seo-audit.md` | 🔄 In progress |
| 1 | Dev tickets (paste into Linear) | `01-technical-seo/dev-tickets.md` | 🔄 In progress |
| 2 | GEO/AEO audit + llms.txt draft | `02-geo-aeo/geo-aeo-audit.md` + `02-geo-aeo/llms.txt` | ⏳ Pending |
| 3 | Legacy equity baseline + competitor map | `03-legacy-baseline/` | ⏳ Pending |
| 4 | Persona keyword corpus + content roadmap | `04-keyword-content/` | ⏳ Pending |
| 5 | Migration plan + 301 redirect map | `05-migration-launch/redirect-map.csv` + `migration-runbook.md` | ⏳ Pending |
| 6 | Higgsfield social/visual strategy | `06-social-higgsfield/social-strategy.md` | ⏳ Pending |
| 7 | Executive summary (.docx) | `07-executive-summary/best-bottles-seo-audit-executive-summary.docx` | ⏳ Pending |

---

## Open questions for the team

1. **Is the existing `SEO_CONTENT_CALENDAR.md` (12 weeks, 24 posts) considered authoritative?** If yes, I'll extend it forward from Week 13 in Stage 4 instead of replacing it.
2. **Who owns the GSC + Bing Webmaster console accounts?** I need to verify the legacy tokens are still valid and confirm we have submit access for the new sitemap.
3. **Will the launch deploy reuse the `bestbottles.com` Vercel project or a new one?** This determines DNS cutover timing and how staging is decommissioned.
4. **What's the Shopify role at launch?** SOW status doc indicates Shopify checkout sync is ~30% — if PDPs are pure-Next.js with `/cart` and `/checkout` flows, schema and crawl plan are different than if there's a Shopify hop.
5. **Higgsfield account state — do you have an active Marketing Studio subscription with credits available?** If yes, I can prep the Stage 6 image/video batch for immediate execution after plan approval.
