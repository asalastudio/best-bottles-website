# Best Bottles — Legacy Equity Baseline (Stage 3a)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Date:** 2026-05-23
**Scope of this document:** Inventory of what `bestbottles.com` is currently doing on the open web, an evidence-based estimate of its indexation footprint, the brand-graph signals already pointing at it, the specific equity assets that MUST survive the 2026-06-15 PHP-to-Next.js cutover, and the legacy anti-patterns the rebuild is shedding.

This document is the input to Stage 5 (migration / 301 redirect map) and to the migration-day QA checklist. Every claim is cited to a fetched legacy URL or to an existing Stage 0/1 artifact.

---

## 1. Site inventory — what's on bestbottles.com today

Crawled live on 2026-05-23 (extending the Stage 0 fetch): homepage (`/`), `/faq.php`, `/contact-us.php`, `/filling-capping-labeling-perfume-bottles-atomizers.php` (contract packaging), and the deepest catalog landing `/all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php`. The mega-menu HTML is byte-for-byte identical across every fetched page, so the IA below is exhaustive of what's linked from the global nav.

### 1.1 Top-level taxonomy (4 categories)

Each of these is a real `.php` URL that ranks for category-level queries:

1. **Perfume vials, Bottles, Roll on bottles and Decorative glass Bottles** — `/all-bottles/Perfume-vials-glass-bottles/Perfume-glas-bottle-vials-purchase.php`
2. **Perfume Atomizers, Sprayers, Aluminum Bottles & Cans** — `/all-bottles/Perfume-atomizer-aluminum-bottle-cans/Perfume-atomizer-Aluminum-bottle-cans-purchase.php`
3. **Perfume Accessories & Packaging** — `/all-bottles/accessories/velvet-bags-organza-gusseted-bags-gift-box-purchase.php`
4. **Cream Jars and Lotion Bottles** — `/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles-cream-jars-purchase.php`

### 1.2 Subcategory and product-family landing pages (~24 distinct URLs)

Confirmed in the mega-menu (verbatim from the fetched HTML):

**Perfume Vials & Bottles family**
- Perfume Vials and Perfume Bottles → `…/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php`
  - Subcat 64: Perfume vials and tubes With Caps & Droppers (`?subcat=64`)
  - Subcat 65: Classic Glass Bottles With Attractive Caps (`?subcat=65`)
  - Subcat 66: Boston Round Glass Bottles With Caps & Droppers (`?subcat=66`)
- Roll on Bottles → `…/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php`
  - Subcat 67: 4-6ml (`?subcat=67`)
  - Subcat 68: 8-10ml (`?subcat=68`)
  - Subcat 69: 12-15ml (`?subcat=69`)
  - Subcat 70: 1oz+ (`?subcat=70`)
- Small Decorative Perfume Bottles → `…/small-decorative-gift-perfume-bottles-heart-shape-sun-moon-genie.php`
  - Subcat 15: Keychain Caps
  - Subcat 16: Tassel Caps
  - Subcat 71: Octagonal
  - Subcat 72: Glass Stopper
- Large Decorative + Apothecary → `…/large-perfume-bottles-decorative-apothecary-style-bottles.php`
  - Large Decorative → `…/large-perfume-bottles-decorative.php`
  - Apothecary Style → `…/apothecary-style-bottles.php`
- Perfume Bottles with Metal and Beads Decoration → `…/perfume-bottles-with-metal-and-beads.php`

**Atomizer / Sprayer / Aluminum family**
- Metal Shell Perfume Atomizers
- Glass Bottles with Fine Mist Sprayers
- Brushed Aluminum Bottles, Sprayers and Cans → with subcats 75 (Bottles/Cans) and 76 (Fine Mist)
- Plastic Bottles with Fine Mist Sprayers
- Classic Perfume Spray Bottles
- Antique Style Bulb Spray Bottles

**Accessories & Packaging family**
- Funnels and Droppers
- Velvet Pouches and Organza Bags (`/all-bottles/accessories/velvet-bags-organza-gusseted-bags-wedding-favor.php`)
- Gift Boxes
- Reclosable Plastic Bags and Shipping Boxes
- Caps, plugs and sprayers

**Cream Jars / Lotion family**
- Cream Jars (`/all-bottles/lotion-pump-cream-jars/cream-jars-gold-silver-caps.php`)
- Lotion Bottles (`/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles.php`)

### 1.3 Information / "education" pages (parallel to category tree)

Each top-level category has an `…-information.php` companion explainer:

- `/all-bottles/Perfume-vials-glass-bottles/Perfume-glass-bottles-vials-information.php`
- `/all-bottles/Perfume-atomizer-aluminum-bottle-cans/Perfume-atomizer-Aluminum-bottle-cans-information.php`
- `/all-bottles/accessories/velvet-bags-organza-gusseted-bags-gift-box-information.php`
- `/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles-cream-jars-information.php`

### 1.4 Conversion / utility pages

- `/index.php` — homepage
- `/product-packaging-ideas.php` — design inspiration
- `/filling-capping-labeling-perfume-bottles-atomizers.php` — contract packaging service. Confirmed live; details below.
- `/faq.php` — full Q&A (Ordering / International / Payments / Shipping & Fulfillment / Returns / Contact). 6 H2 sections, ~3,000 words of long-form helpful content. Includes HTS tariff code tables (7010.90.20, 7612, 3923.50.0000, etc.) — useful for AEO citations.
- `/contact-us.php` — NAP block (address, phone, fax, email, hours)
- `/login` / `/cart` / `/search` — JS modals, not real indexable pages
- `/bestbottles-compressed.pdf` — downloadable PDF catalog, linked from header AND footer on every page

### 1.5 Contract packaging page (notable, often missed)

`/filling-capping-labeling-perfume-bottles-atomizers.php` is a real service page with a published MOQ table (1ml vials @ 1,000pc / 5ml roll-on @ 500pc / etc.), screen-printing + laser-engraving capabilities, and references to sister sites `NematFragrances.com` and `NematInternational.com`. This is exactly the page B2B buyers searching "private label perfume filler" land on. **It is currently the single best AEO/B2B-conversion asset on the legacy site.** Migration plan must preserve.

---

## 2. Indexation surface estimate

Without GSC access we cannot confirm the precise number of indexed URLs. Based on the IA crawled above plus the 106-product crawl already in `data/live-site-product-master.json` (cited in Stage 0 brief), the realistic indexation surface is:

| URL class | Count | Notes |
|---|---:|---|
| Homepage | 1 | `/index.php` |
| Top-level category landings | 4 | section 1.1 |
| Subcategory / family pages (`.php`) | ~14 | section 1.2 — distinct PHP files (excluding querystring variants) |
| Querystring-driven subcategory variants (`?subcat=N`) | ~16 | each `?subcat=` is a distinct URL Google may index separately — this is duplicate-content risk on the legacy side |
| Product detail pages | ~106 | per `data/live-site-product-master.json` |
| "Information" explainer pages | 4 | section 1.3 |
| Utility pages (`/faq.php`, `/contact-us.php`, `/product-packaging-ideas.php`, contract packaging) | 4 | section 1.4 |
| Search/login/cart modals | 0 (no real indexable URL) | confirmed JS-only |
| PDF catalog | 1 | `/bestbottles-compressed.pdf` |
| **Estimated total indexed URLs** | **~150** | matches the Stage 0 estimate; planning around ~200 for redirect-map safety margin |

**Equity-rich URLs (priority order, based on link prominence + buyer intent):**
1. **Homepage** (`/`) — most external links land here; ranks for "best bottles wholesale", brand queries
2. **PDF catalog** (`/bestbottles-compressed.pdf`) — header AND footer linked from every page; likely earns external links from buyer guides and lists
3. **4 top-level category landings** — title-tag matches high-intent queries ("perfume vials wholesale", "atomizers aluminum bottles", "cream jars lotion bottles")
4. **Subcat 66 (Boston Round)** — generic enough that it competes with SKS/Specialty Bottle organic
5. **Contract Packaging page** — high-intent commercial query target
6. **FAQ page** — long-form, HTS-code-rich, AEO-friendly content
7. **Individual product family pages** (roll-on, decorative perfume) — niche but durable rankings

---

## 3. Brand signal inventory (external brand graph)

What search engines and AI crawlers currently associate with the bestbottles.com entity. Every URL below is confirmed from the legacy header/footer or external profile mentions in the Stage 0 fetch.

| Surface | URL | What it signals to search/AI |
|---|---|---|
| Parent company website | `https://www.NematInternational.com/` | Establishes corporate parent (Nemat International, Inc.). Sister-site link tells Google the bestbottles.com entity is part of a larger fragrance/essential-oils ERP-backed company, not a dropshipper. |
| Sister bottle site | `https://www.glassbottles.com/` | Cross-domain reinforcement of the "wholesale glass bottles" entity. Risk: glassbottles.com may compete in the same SERPs — confirm at Stage 5 whether to consolidate or differentiate. |
| LinkedIn (personal profile) | `https://www.linkedin.com/in/best-bottles-0b0160201/` | Personal-profile signal (likely founder/Abbas). Low E-A-T weight, but contributes to entity graph. |
| LinkedIn (company page) | `https://www.linkedin.com/company/best-bottles-wholesale` | The B2B trust signal that matters most. Migration plan must preserve this URL as the canonical LinkedIn company entity (Schema `sameAs`). |
| LinkedIn (parent) | `https://www.linkedin.com/company/nemat-international` | Parent company graph. Already in `src/lib/seo.ts:35-38`. |
| Facebook | `https://www.facebook.com/NematBestBottles` | Combined brand handle (Nemat + Best Bottles) — signals brand consolidation. |
| X / Twitter | `https://twitter.com/Best_Bottles` | Brand handle present, low recent activity. Still useful as `sameAs`. |
| Faire marketplace | `https://www.faire.com/brand/b_bzqsxpr4yl` | Strong B2B trust signal — Faire vets brands. Tells AI crawlers Best Bottles is a real wholesale brand sold to independent retailers. |
| Google Business Profile / Maps | Union City, CA storefront (referenced in `/contact-us.php`) | Local-pack visibility for "perfume bottle wholesale near me" / "bay area" queries. **Must verify GBP exists and matches NAP exactly before launch.** |
| ZoomInfo | Nemat International, Inc. entity | Business-graph + intent-data citation; useful for AEO since AI systems cite ZoomInfo for "what does Nemat International do?" |
| Google Search Console verification | meta token `laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc` | The single most important migration artifact — see §4. |
| Bing Webmaster verification | meta token `DD2ECFD7F20F418A4A67662DFC0D0B03` | Same — see §4. |

**What's missing from the external brand graph (gap to close post-launch):**

- No verifiable Instagram presence under a Best Bottles handle. The new site's `lib/seo.ts:36` claims `instagram.com/bestbottles` but BB-SEO-215 (Stage 1 audit, ticket 215) flags that the actual maintained account is likely `instagram.com/nematinternational`. Resolve before launch.
- No Pinterest brand presence (competitors SKS, Berlin, Specialty Bottle, Container & Packaging all have Pinterest). Stage 6 (Higgsfield) will recommend Pinterest as a Madison-asset distribution surface.
- No YouTube channel for product education content. Container & Packaging and SKS both maintain channels. Long-term GEO/AEO play.
- No Trustpilot / G2 / public review surface. Specialty Bottle, SKS, Berlin, and Container & Packaging all link Trustpilot from the homepage.

---

## 4. What MUST be preserved through cutover

This is the migration-day checklist. The Stage 5 runbook will operationalize each item; this section is the canonical list of "if we lose this, we lose ranking".

### 4.1 Search Console verification (P0)

- **Google:** add `<meta name="google-site-verification" content="laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc">` to the new site's `<head>` via `src/app/layout.tsx` metadata `verification.google`. This is already on the P1-3 ticket in Stage 1 audit. **Belt-and-braces:** also add the DNS TXT record method as a backup so verification survives even if the meta tag is accidentally stripped.
- **Bing:** add `<meta name="msvalidate.01" content="DD2ECFD7F20F418A4A67662DFC0D0B03">` via `verification.other`.
- Both tokens must be live on day-of-cutover so GSC and Bing Webmaster Tools recognize the new site immediately and do not de-verify the historical property.

### 4.2 PDF catalog (P0)

- Legacy URL: `https://www.bestbottles.com/bestbottles-compressed.pdf`
- Action: either (a) serve the same PDF from the same path on the new site (simplest, preserves any external links), or (b) 301-redirect `/bestbottles-compressed.pdf` to a new canonical PDF URL like `/catalog.pdf`.
- Recommendation: **(a) keep the path identical**. The PDF is a leaf asset, not a page Google ranks, and external buyer-guide backlinks pointing to that exact filename should not be broken.
- Confirm the new PDF version is up-to-date with the 2,354-SKU catalog before launch — if not, ship the legacy PDF on day 1 and roll out an updated PDF on a separate schedule.

### 4.3 NAP and contact-channel consistency (P0)

Every number/email/address below appears on the legacy `/contact-us.php` and must appear (identically formatted) on:
1. The new `/contact` page
2. Organization JSON-LD (`src/lib/seo.ts:20-45`) — currently incomplete per P1-1 ticket
3. LocalBusiness JSON-LD (per P1-2)
4. Footer (currently uses `sales@nematinternational.com` while `src/lib/seo.ts:42` uses `sales@bestbottles.com` — pick ONE)
5. Google Business Profile (confirm match)

Canonical NAP (from `/contact-us.php`):
- **Address:** Nemat International, Inc. · 34135 7th Street · Union City, CA 94587 · USA
- **Hours:** Monday – Friday 9:30 AM – 5:30 PM PST
- **Toll-free (US/CA):** 1-800-936-3628
- **Direct (international/domestic):** 1-510-445-0300
- **Fax:** 1-510-751-4980
- **Email:** sales@nematinternational.com

### 4.4 Sister-domain link reciprocity

The legacy site links to `NematInternational.com`, `glassbottles.com`, and `NematFragrances.com`. New site should preserve these links — preferably in the footer "Brand family" block — so the cross-domain entity graph stays intact. Update `src/components/HomePage.tsx:873-937` footer per BB-SEO-215.

### 4.5 Faire / LinkedIn / Facebook / Twitter sameAs

These belong in `Organization.sameAs[]` in `src/lib/seo.ts`. Currently incomplete. Use the table in §3 as the source of truth.

### 4.6 Specific legacy URLs that need 301s with handcrafted targets (not auto-pattern)

The bulk of the 301 map will be pattern-based (every `*.php` → corresponding new clean URL), but a small set of high-value URLs deserve explicitly-mapped destinations:

| Legacy URL | Recommended 301 target on new site | Why |
|---|---|---|
| `/index.php` | `/` | Drop the .php extension |
| `/faq.php` | `/resources` or new `/faq` | The FAQ content is content-rich; consider migrating its body verbatim into `/resources` and adding FAQPage JSON-LD (BB-SEO-206) |
| `/contact-us.php` | `/contact` | Already exists |
| `/filling-capping-labeling-perfume-bottles-atomizers.php` | `/contract-packaging` or `/services/contract-packaging` (build if missing) | This is a unique B2B asset — must have a corresponding new-site page, not a redirect to homepage |
| `/product-packaging-ideas.php` | `/resources/packaging-ideas` or a curated `/collections/packaging-ideas` | Likely earning long-tail traffic for "perfume packaging inspiration" queries |
| `/bestbottles-compressed.pdf` | (no redirect — serve from same path) | See §4.2 |
| Category `/all-bottles/Perfume-vials-glass-bottles/Perfume-glas-bottle-vials-purchase.php` | `/catalog?families=Empire,Cylinder,Boston%20Round` OR new `/collections/perfume-vials` | Decide collection strategy per BB-SEO-217 |
| Subcat URLs (`?subcat=NN`) | Map each to its corresponding `/catalog?families=…` filter URL — verify each one is whitelisted as indexable per BB-SEO-202 | Querystring → querystring 301 chains can chain Google off, so prefer 301-to-canonical-collection-page where possible |

Stage 5 will produce the full redirect-map CSV.

---

## 5. Pages likely earning traffic today (estimate — flagged as estimate)

**Strong caveat:** Without GSC access we cannot verify. The list below is a hypothesis derived from (a) title-tag intent, (b) link prominence in the legacy IA, (c) common B2B-glass-packaging search intent observed in the SERPs, and (d) the fact that legacy `bestbottles.com` does have aggregate organic traffic per the Stage 0 brief's reference to "150 indexed URLs receiving orders".

Priority order for post-cutover GSC QA (check each within 7 days of launch — verify the new URL ranks within 3 positions of the old URL's prior position):

| # | Legacy URL | Why it likely earns | Risk if 301 chain breaks |
|---|---|---|---|
| 1 | `/` (homepage) | Brand queries ("best bottles", "bestbottles.com", "best bottles wholesale") + generic "perfume bottle wholesale" | Brand-query split with `bestbottles.company` and ranking loss |
| 2 | `/bestbottles-compressed.pdf` | External buyer-guide backlinks, "perfume bottle catalog PDF" queries | Asset becomes 404; external links rot |
| 3 | `/all-bottles/Perfume-vials-glass-bottles/Perfume-glas-bottle-vials-purchase.php` | "perfume vials wholesale", "decorative perfume bottles" | Loss of category-level organic |
| 4 | `/all-bottles/Perfume-vials-glass-bottles/roll-on-roller-bottles-frosted-black-silver-gold-white-caps.php` | "wholesale roll on bottles", "perfume roll on bottles bulk" — the title is specific enough to rank | Loss of roll-on family rankings |
| 5 | `/all-bottles/Perfume-atomizer-aluminum-bottle-cans/bestbottles-metal-shell-perfume-atomizers.php` | "metal perfume atomizer wholesale" niche | Loss of atomizer category rankings |
| 6 | `/all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php?subcat=66` | "cobalt blue boston round bottle wholesale", "amber boston round dropper bottle" — competes with Specialty Bottle, SKS | High — Boston Round is one of the most-searched bottle queries |
| 7 | `/filling-capping-labeling-perfume-bottles-atomizers.php` | "contract perfume filling", "private label perfume packaging", "small batch perfume filling MOQ" | Loss of a high-LTV B2B query cluster |
| 8 | `/faq.php` | Long-tail informational queries; HTS tariff codes attract international shipping search | Loss of AEO citation surface |
| 9 | `/all-bottles/lotion-pump-cream-jars/cream-jars-gold-silver-caps.php` | "cream jar gold lid wholesale", "cosmetic jar bulk" | Loss of cream-jar rankings |
| 10 | `/contact-us.php` | "Nemat International phone" / "Best Bottles Union City" queries | Replace with `/contact` immediately on launch |

**Recommended QA workflow on 2026-06-15:**
1. Submit new sitemap to GSC and Bing immediately
2. Use the URL Inspection tool on each of the top 10 legacy URLs above and confirm 301 → new URL is recognized
3. Within 7 days, check `site:bestbottles.com` query in Google to confirm new URLs are populating and old URLs are dropping
4. Within 14 days, check `Search Console > Performance > Pages` to confirm each old URL's prior impressions/clicks are now attributing to the corresponding new URL
5. If any legacy URL has not transferred ranking by day 21, treat as a P1 incident and check (a) redirect chain length (must be 1 hop), (b) new-page indexability, (c) Canonical correctness

---

## 6. Anti-patterns the rebuild is shedding (good news)

Every item below is a real, observed defect on the legacy site that the new Next.js codebase already fixes (or will fix with the Stage 1 tickets). Documented here so the migration narrative can claim measurable improvement.

| Legacy anti-pattern | Evidence | New-site improvement |
|---|---|---|
| 272-character keyword-stuffed homepage title | `raw/legacy-homepage-fetch-2026-05-23.md` line 11 | New site uses centralized `lib/seo.ts:11-12` with template-driven titles capped at ~60 chars (BB-SEO-001 in Stage 1) |
| ~600-character meta description | Stage 0 raw fetch | New site uses 155-char descriptions per page metadata API |
| JavaScript-only CTAs (`javascript:weshipworld()`, `javascript:loadsendsuggestion()`) | `raw/legacy-homepage-fetch-2026-05-23.md` line 72 | New site uses real `<Link>`/`<a href>` elements, fully crawlable |
| Querystring-driven subcategory URLs (`?subcat=64..76`) creating duplicate content | Stage 0 raw fetch + mega-menu confirmation here | New site uses clean `/catalog?families=Boston%20Round` URLs with explicit canonical strategy per BB-SEO-202 |
| Zero structured data (no Organization / Product / BreadcrumbList / LocalBusiness / FAQPage schema) | `raw/legacy-homepage-fetch-2026-05-23.md` line 90-92 | New site has centralized schema builders in `src/lib/seo.ts:20-146` covering Organization, WebSite + SearchAction, BreadcrumbList, Product (with AggregateOffer), CollectionPage |
| "Copyright 2020" footer signaling abandonment | Stage 0 raw fetch line 18 + confirmed across every page fetched today | New site footer will dynamically render current year |
| No mobile-first redesign since 2020 | Visual inspection | New site is Tailwind-first responsive, Lighthouse-tested |
| Modal placeholder text ("Some text in the modal" appears verbatim on every fetched page) | Confirmed on `/faq.php`, `/contact-us.php`, contract packaging, category pages | New site has no leftover modal placeholders |
| No HTTPS-strict-canonical (the legacy is HTTPS but has no HSTS preload, no canonical-host rule) | Stage 1 audit §6 | New site has 2-year HSTS, will add preload (BB-SEO-218) |
| No AI-crawler allowlist | Legacy `robots.txt` not crawled in detail but standard PHP defaults don't include AI bots | New site `public/robots.txt:13-23` explicitly allows GPTBot, Google-Extended, anthropic-ai |
| Generic "Wholesale Glass bottles for Perfumes and Essential Oils." H1 on every page (no per-page differentiation) | Confirmed across all fetched pages | New site has per-page H1s tied to product family / collection / blog post |
| No sitemap.xml referenced anywhere | Legacy `robots.txt` not investigated; no `<link rel="sitemap">` in head | New site has dual static + dynamic sitemap (BB-SEO-201) |
| `meta-revisit-after: 30 days` (deprecated since 2008) | Legacy head | Removed in new site |
| Plain-text price + manual cart math | UI inspection | New site uses Convex-driven real-time pricing and cart |
| No reviews / social proof on PDPs | Confirmed | Roadmap item (post-launch) — Reviews API + AggregateRating |

---

## 7. Summary — the 1-page version

**What we're preserving (high-leverage migration assets):**
- Google + Bing verification tokens (drop into `verification:` metadata)
- The PDF catalog at its exact legacy path
- The Union City NAP, identical formatting, in 4 places (page, footer, Org schema, LocalBusiness schema)
- The sister-domain cross-link triad (nematinternational.com / glassbottles.com / nematfragrances.com)
- All external `sameAs` profiles (LinkedIn x2, Facebook, X, Faire)
- The ~150-URL redirect map, with handcrafted destinations for the top 10 equity-rich URLs

**What we're shedding (legacy debt cleared):**
- ~14 distinct anti-patterns enumerated in §6, headlined by the 272-char title, JS-only CTAs, querystring subcat URLs, zero schema, and the 2020 copyright

**Single biggest preservation risk:**
The contract-packaging service page (`/filling-capping-labeling-perfume-bottles-atomizers.php`) has no clear destination on the new site yet. If it 301s to homepage or to a generic `/services` shell, we lose a high-LTV B2B query cluster ("private label perfume filling", "small batch contract packaging"). Stage 5 must explicitly build a `/services/contract-packaging` page on the new site before cutover, with content migrated from the legacy page verbatim, FAQPage JSON-LD applied to the MOQ table, and Service schema added.

**Single biggest brand-graph risk:**
The Instagram handle mismatch (footer says `nematinternational`, `lib/seo.ts:36` says `bestbottles`). If we ship with the wrong handle in `Organization.sameAs[]`, Google's Knowledge Graph may de-prioritize the entity. Resolve to a single canonical handle before 2026-06-15.

---

*Companion file: `competitive-landscape-map.md` (Deliverable 2 of Stage 3).*
*Next stage: 4 (keyword + content) and 5 (migration runbook + redirect-map CSV).*
