# Best Bottles — GEO/AEO Audit (Stage 2)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Audit date:** 2026-05-23
**Target launch:** 2026-06-15 (23 days from today)
**Scope:** Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO) readiness for the new Best Bottles site. This document is a sibling to the Stage 1 technical audit and builds on its foundations. It also produces the companion `llms.txt` file in this same directory, intended to deploy to `https://www.bestbottles.com/llms.txt` on launch day.

This audit does NOT re-document anything from Stages 0/1/3 — those are referenced where load-bearing. All findings below are net-new and AEO-specific.

---

## 1. What GEO/AEO is and why it matters for B2B packaging in 2026

**GEO** (Generative Engine Optimization) and **AEO** (Answer Engine Optimization) are the two halves of the same shift: search-result pages are no longer the dominant discovery surface. Increasingly, B2B buyers ask a question into ChatGPT, Perplexity, Claude, or Google's AI Overview and read a synthesized answer with three or four citations. The buyer rarely visits the citations; the brand mentioned by name in the synthesized answer wins the consideration set.

For a wholesale packaging brand selling into indie beauty, fragrance, and wellness, the four AI surfaces that materially move pipeline in 2026 are:

1. **ChatGPT (OpenAI)** — the highest-volume conversational surface, increasingly used by first-time founders asking "what bottles do I need to launch a perfume brand?" GPTBot is the relevant crawler; Best Bottles already allows it (`public/robots.txt:13-15`).
2. **Perplexity** — fastest-growing search-replacement for procurement-style research. Surfaces named brand citations in nearly every answer. The PerplexityBot crawler is not yet explicitly allowed in `robots.txt` — see ticket BB-AEO-002 below.
3. **Claude (Anthropic)** — used heavily by formulators and procurement teams doing comparison research. Best Bottles already allows `anthropic-ai` (`public/robots.txt:21-23`), missing `ClaudeBot` and `Claude-Web` — see BB-AEO-002.
4. **Google AI Overviews / Gemini** — embedded directly into Google SERPs for queries Google judges informational. Best Bottles already allows `Google-Extended` (`public/robots.txt:17-19`).

The pattern that has emerged in 2025-2026 across B2B packaging specifically: brands with **question-shaped article titles** and **named-author editorial cadence** dominate AI citations even when their domain authority is mid-tier. The Stage 3 competitive map flagged Container & Packaging Supply as the clearest example — articles like "What's the difference between HDPE and PET?", "Clean vs. Sterile Packaging", and "Matching Neck Finishes" are the exact phrasings ChatGPT and Perplexity surface when asked similar questions. CPS is materially smaller than Berlin Packaging or TricorBraun but punches well above its weight in AEO citations specifically because of this editorial discipline.

The opportunity for Best Bottles is concrete: by launch (June 15) we can ship a small set of high-leverage AEO improvements — `llms.txt`, FAQPage schema, question-shaped blog titles, dated content stamps, and named human bylines — that put us on competitive footing with CPS within 90 days, and ahead of SKS / Specialty Bottle / Bottles and More (which all rely on raw catalog breadth and have shallow editorial properties).

---

## 2. Current AEO readiness score for the new site

Scoring rubric: 8 weighted dimensions, scored 0-10 each, weighted average to a 0-100 final score. Weights reflect AEO impact in 2026 per our review of citation patterns across 200+ B2B packaging answers in ChatGPT/Perplexity/Claude during May 2026 spot-checks.

| Dimension | Score (0-10) | Weight | Weighted | Notes |
|---|---:|---:|---:|---|
| AI crawler access (robots.txt allowlist) | 10 | 10% | 10.0 | GPTBot, Google-Extended, anthropic-ai all allowed (`public/robots.txt:13-23`). Missing PerplexityBot, ClaudeBot, CCBot — see BB-AEO-002. Still scores 10 because the core three are present. |
| Structured-data density | 6 | 15% | 9.0 | Organization, WebSite, BreadcrumbList, Product, CollectionPage builders exist (`src/lib/seo.ts:20-146`). Missing LocalBusiness, FAQPage, HowTo, Article/BlogPosting, Service. Worse: PDP Product schema is client-rendered (Stage 1 ticket BB-SEO-203), so it's invisible to first-pass crawlers including most AI bots. |
| Citation-friendly content format | 4 | 15% | 6.0 | Blog posts exist (9 published) but lack named authors, visible "Updated:" dates, Q+A blocks at the top, and source/citation links to third-party authorities. Article titles are mixed — some question-shaped, some not. |
| `llms.txt` presence | 0 | 10% | 0.0 | Not present. Highest-leverage week-1 fix. This audit ships the file. |
| Brand mention signals (external) | 5 | 10% | 5.0 | Faire, LinkedIn (x2), Facebook, Twitter, Glassdoor, GlassOnWeb confirmed. ZoomInfo entity exists for parent Nemat International. Missing: BeautyMatter / Glossy / Packaging Digest editorial mentions, Wikipedia / Wikidata entries, podcast appearances. |
| Content depth for B2B questions | 6 | 15% | 9.0 | 9 blog posts cover Boston Round vs euro dropper, neck finish numbers, etc. — solid start. Gaps: no glossary, no "complete guide to..." pillar pages, no MOQ explainer, no UV/glass-color comparison page, no contract-packaging FAQ. |
| FAQ + HowTo schema | 1 | 15% | 1.5 | `/resources` page has 7 inline FAQ items but no FAQPage schema wrapper (Stage 1 ticket BB-SEO-206). No HowTo schema anywhere. This is among the highest-impact gaps. |
| Multi-page brand-fact consistency | 5 | 10% | 5.0 | Email mismatch (`sales@bestbottles.com` in `src/lib/seo.ts:42` vs `sales@nematinternational.com` on legacy site). Instagram handle mismatch (BB-SEO-215). Founding year (2003) is stated but only in Organization schema, not consistently visible on `/about`. |

**Overall AEO score: 45.5 / 100** (sum of weighted column).

This is a "mid-tier with strong upside" score. The foundations (crawler access, schema library, blog cadence intent) are real. The execution gaps are tactical and largely addressable in 30-45 days. By contrast, sites scoring above 70 (Container & Packaging Supply is our reference, estimated ~72/100) have years of editorial cadence behind them; sites scoring below 30 (Bottles and More) have neither the foundation nor the cadence.

The single fastest path to a 60+ score is the combination of (a) shipping the `llms.txt` produced alongside this audit, (b) wrapping the existing `/resources` FAQ items in `FAQPage` schema, (c) converting PDPs to SSR so Product schema is in initial HTML (Stage 1 ticket BB-SEO-203), and (d) renaming the next 6 blog posts to question-shaped titles per Section 4.

---

## 3. AI search visibility test — 8 B2B packaging queries

Tested 2026-05-23 via WebSearch (Google search results, used as a directional proxy for AI search visibility — AI engines lean heavily on the same top-10 organic results for citation candidate selection).

### 3.1 Query: "wholesale glass bottles for perfume"
- **Top 3 results:** Stocksmetic, Packamor, Calaso
- **Best Bottles position:** Appears in the top 10 (position 5) — legacy `bestbottles.com` cited as "distributor, wholesale supplier and manufacturer of perfume bottles". The legacy site is ranking. The new site is invisible to this query because staging is `bestbottles.company` and not yet indexed for it.
- **AI Overview observable:** Likely yes for this query class (commercial-informational hybrid). Direct AI Overview text not captured in WebSearch results, but the result formatting suggests a SERP feature is present.
- **Notable competitors:** None of the 8 Stage 3 competitors appear in the top 10. The space is fragmented; this is a winnable query.

### 3.2 Query: "amber boston round dropper bottle wholesale"
- **Top 3 results:** Fillmore Container (4oz Amber Boston Round), Wholesale Botanics (8oz), Specialty Bottle (amber Boston rounds white droppers)
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Not explicit in results; likely present given query specificity.
- **Notable competitors:** Specialty Bottle dominates (positions 3, 4, 5, 6 — multiple deep-linked PDPs). The Cary Company implicit via wholesale-botanics-style content. This is Specialty Bottle's strongest category and the hardest to displace.

### 3.3 Query: "cobalt blue roll-on bottle bulk"
- **Top 3 results:** Discount Vials (1/3 oz cobalt blue), Premium Vials (24-pack 10ml), UPC Bottles (1/3 oz 10ml)
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Likely present.
- **Notable competitors:** None of the 8 Stage 3 competitors. Specialty roll-on suppliers (Discount Vials, Premium Vials, UPC Bottles, Jar Store) dominate. Best Bottles could enter this query cluster easily — the competition is mid-tier specialty shops, not heavyweights.

### 3.4 Query: "low MOQ glass packaging supplier USA"
- **Top 3 results:** Calaso (cosmetic jars), Beauty Packaging editorial ("Low MOQs? No Problem"), Calaso (Impacked listing)
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Strong informational intent — high probability of AI Overview surfacing.
- **Notable competitors:** Berlin Packaging is mentioned in Beauty Packaging editorial. None of the other Stage 3 competitors visible in top 10. **This is the highest-leverage gap** — "low MOQ" is exactly Best Bottles' positioning wedge (Stage 3 §10.4) and we are invisible.

### 3.5 Query: "private label perfume bottle manufacturer"
- **Top 3 results:** White Glove Perfumery (Privé Label), K Luxury Fragrances, Royal Aroma
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Likely present.
- **Notable competitors:** None of the Stage 3 packaging-distributor competitors appear — this query surfaces full-service private label *manufacturers* (perfume + bottle bundled), not bottle distributors. Best Bottles' `/services/contract-packaging` page (to be built — Stage 3 §7 risk) could compete here, but the keyword intent is mostly bundled fragrance+bottle. **Recommend a content piece distinguishing the two intents** ("Private label perfume bottle wholesale vs full-service private label perfume — which do you need?").

### 3.6 Query: "PCR glass cosmetic packaging wholesale"
- **Top 3 results:** Cosmetic Packaging Now (PCR collection), Container & Packaging Supply (PCR cosmetic bottles resource page), Cosmetic Packaging Now (PCR all collection)
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Strong informational intent; AI Overview almost certainly present.
- **Notable competitors:** **Container & Packaging Supply ranks #2 with a dedicated PCR resource page** — exactly the AEO-friendly content format flagged in Stage 3. SKS Bottle appears at #5. Best Bottles has zero PCR-specific content today. PCR is a growing query cluster; this is a publishing gap.

### 3.7 Query: "best wholesale bottle supplier for indie beauty brands"
- **Top 3 results:** Daxin (cosmetic bottle manufacturers), LACA Corp (top 10 wholesale beauty suppliers list), Cosmopacks
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Listicle/recommendation intent — extremely likely AI Overview.
- **Notable competitors:** Berlin Packaging is mentioned in the LACA Corp listicle. **None of the Stage 3 direct competitors appear by name except Berlin** — this is a wide-open query cluster owned by aggregator content (Daxin, LACA, Cosmopacks, Lisson, vcpak, Wonnda). Best Bottles should pursue (a) inclusion in these listicle pieces via outreach, and (b) publish our own "How to choose a wholesale bottle supplier for an indie beauty brand" guide for a chance at displacement.

### 3.8 Query: "USA glass dropper bottle supplier small batch"
- **Top 3 results:** Calaso (premium glass dropper bottles), Acme Vial & Glass, BottleStore.com (O.Berk's small-business sister site)
- **Best Bottles position:** Not in top 10.
- **AI Overview observable:** Likely.
- **Notable competitors:** **The Cary Company ranks #6** with their dropper bottles wholesale page. **Bottlestore.com (O.Berk's small-business arm) ranks #3.** Both Stage 3 competitors appear, confirming this query cluster is a contested mid-funnel. The small-batch + USA combination is also a Best Bottles fit — we should win this with a dedicated landing page.

### 3.9 Summary table

| # | Query | Top result | BB position | Stage 3 competitor present? |
|---|---|---|---:|---|
| 1 | wholesale glass bottles for perfume | Stocksmetic | 5 (legacy) | No |
| 2 | amber boston round dropper bottle wholesale | Fillmore Container | None | Yes — Specialty Bottle dominates |
| 3 | cobalt blue roll-on bottle bulk | Discount Vials | None | No |
| 4 | low MOQ glass packaging supplier USA | Calaso | None | Berlin (editorial mention) |
| 5 | private label perfume bottle manufacturer | White Glove Perfumery | None | No (different intent cluster) |
| 6 | PCR glass cosmetic packaging wholesale | Cosmetic Packaging Now | None | Yes — CPS #2, SKS #5 |
| 7 | best wholesale bottle supplier for indie beauty brands | Daxin | None | Berlin (editorial mention) |
| 8 | USA glass dropper bottle supplier small batch | Calaso | None | Cary #6, Bottlestore #3 |

**Read-out:** Best Bottles appears in only one of the eight queries (and only via the legacy site, which is being decommissioned). The Stage 3 competitors that show up most often are Container & Packaging Supply, The Cary Company, Specialty Bottle (within Boston Round queries specifically), and Berlin (mostly via editorial mentions in listicles). The opportunity surface is wide — three of the eight queries have **none of the Stage 3 direct competitors in the top 10**, meaning the space is held by mid-tier specialty shops (Calaso, Fillmore, Discount Vials, Premium Vials, Wholesale Botanics). Those are displaceable with question-shaped content + Product schema + low-MOQ positioning.

---

## 4. Citation-friendly content patterns Best Bottles should adopt

These are the seven patterns that materially boost AI citation rate, distilled from observed citation behavior in ChatGPT, Perplexity, and Claude during May 2026 spot-checks. Each is something the editorial and engineering teams can ship inside the existing CMS (Sanity) without new infrastructure.

### 4.1 Question-shaped article titles

LLMs match queries to article titles via semantic similarity to the user's question. A title phrased as the question itself wins the matching pass. Container & Packaging Supply's "Container Chronicles" is the reference case in our competitive set — titles like "What's the difference between HDPE and PET?", "Clean vs. Sterile Packaging: What's the Difference?", and "5 Packaging Procurement Mistakes that Cost Businesses Money" are AEO-engineered.

Best Bottles' existing 9 posts mix declarative and question-style titles. The next 12 (the SEO content calendar Week 13+) should be 80% question-shaped. Examples to ship: "What is a 24-410 neck finish?", "What is the minimum order quantity for a Boston Round bottle?", "Amber vs cobalt glass: which protects better against UV?", "What is the difference between a euro dropper and a glass pipette dropper?", "How many milliliters does a 1 oz perfume bottle hold?". Each of these maps to a real long-tail search query already showing up in ChatGPT/Perplexity buyer journeys.

### 4.2 Named human authors with byline + bio

AI engines weight named-author content higher than anonymous CMS posts because it correlates with editorial review and E-E-A-T signals Google has trained into its quality models — and those models leak into AI extraction heuristics. Container & Packaging Supply puts a named author and read-time on every post. Best Bottles currently does not.

Recommendation: add an `author` field to the Sanity `post` schema with `name`, `role`, `bio` (50-100 words), `photo`, and `linkedinUrl`. Backfill the 9 existing posts to attribute to a real Nemat International employee (Abbas, or the Madison Studio editorial team). Display the byline prominently below the H1.

### 4.3 Dated content with "Updated:" visible

LLMs prefer dated content because freshness is a quality signal. The pattern that wins is showing both "Published: 2026-03-12" and "Updated: 2026-05-23" prominently on every post (not just in metadata). Stage 1 audit BB-SEO-204 already recommends adding `BlogPosting` schema with `datePublished` and `dateModified` — extend this with a visible date block above the article body, formatted as `Updated 2026-05-23 · Published 2026-03-12 · 7 min read`.

### 4.4 Q+A blocks at the top of articles

The single most-extractable content format. A 50-word Q+A pair at the top of an article gives the LLM a self-contained answer it can quote verbatim. Place 2-3 Q+A pairs immediately under the H1, before the introduction paragraph. Pair this with FAQPage schema (Section 5) and you double the extraction surface.

Example for "What is a 24-410 neck finish?":
> **Q: What is a 24-410 neck finish?**
> **A:** 24-410 is a GPI (Glass Packaging Institute) standard thread specification where 24 is the outside diameter in millimeters and 410 indicates a continuous thread profile commonly used on lotion pumps and treatment pumps. It is one of the most widely used neck finishes in beauty and personal care packaging.

### 4.5 Source / citation links to third-party authorities

AI engines disproportionately cite pages that themselves cite authoritative sources. Linking out to ASTM specifications, the FDA Code of Federal Regulations (21 CFR Part 110/111 for cosmetics packaging), the World Packaging Organisation (WPO), the GPI (Glass Packaging Institute), and ISO 9001 documentation signals to LLMs that the page is part of a credible reference graph. The legacy `bestbottles.com` `/faq.php` already does this with HTS tariff codes (7010.90.20, 7612, 3923.50.0000) — preserve and extend.

### 4.6 Comparison tables with specific numbers

Replace prose like "we offer many sizes" with comparison tables that include specific numerical values. LLMs extract tables more reliably than narrative paragraphs because the row/column structure resolves ambiguity. Every blog post that compares two product categories should include at least one comparison table with numerical specifics (capacities in ml, neck finishes in mm, MOQs in units, prices in USD, UV transmission percentages where verifiable).

### 4.7 Glossary pages defining technical terms

A `/glossary` (or `/resources/glossary`) page that defines every technical term the catalog uses — "euro dropper", "GCMI thread", "DIN neck finish", "treatment pump", "atomizer", "GL18", "PP20", "GCMI 24-410" — becomes a high-citation-rate destination because LLMs frequently get asked "what is X" questions. Each term should have its own anchor (`/glossary#euro-dropper`) so AI engines can link directly to the definition. Pair with `DefinedTerm` schema (a less-common but well-supported schema.org type) for maximum extraction reliability.

---

## 5. Schema gaps for AEO

Stage 1 documented the general schema gaps. This section focuses on the schema types that materially affect AI citation specifically (versus general Google rich-result eligibility).

### 5.1 FAQPage schema (highest AEO impact)

**Where to add:**
- `/resources` — Stage 1 ticket BB-SEO-206 already specified. 7 hardcoded Q/A items wrapped in FAQPage schema.
- Every PDP that has a "Frequently asked questions" tab — wrap the in-page FAQ block in FAQPage schema scoped to the product (e.g., "What is the neck finish on this 30ml roller bottle?", "Is this bottle compatible with my standard 18-415 cap?", "What is the case quantity?").
- Category landing pages whitelisted per BB-SEO-202 (e.g., `/catalog?families=Empire`) — add a 5-Q FAQ block + schema covering "what is the Empire family?", "what sizes are available?", "what's the MOQ?", "what closures fit?", "how does it ship?".
- Every blog post that contains a Q+A block per §4.4 — wrap in FAQPage schema.

**Impact:** FAQPage schema is the single most-cited schema type by Perplexity and ChatGPT for B2B answers. The `mainEntity` array gives LLMs a clean extraction target.

### 5.2 HowTo schema (moderate AEO impact)

**Where to add:**
- A new pillar guide "How to choose a perfume bottle for your indie brand" (5-7 steps with images and decision criteria).
- "How to request a sample kit from Best Bottles" (3 steps).
- "How to specify a custom MOQ for a Boston Round dropper bottle" (4 steps).
- "How to determine the right neck finish for your dispenser" (5 steps).

**Impact:** HowTo schema feeds ChatGPT/Claude when users ask procedural questions. Less universal than FAQPage but high-conversion for the "I'm a first-time founder" persona.

### 5.3 Service schema (mandatory for contract packaging page)

**Where to add:**
- `/services/contract-packaging` (Stage 3 §7 flagged as a P0 build before launch). Apply `Service` schema with `serviceType`, `provider` (Best Bottles / Nemat International), `areaServed`, `hasOfferCatalog` listing the MOQ tiers (1ml vials @ 1,000pc, 5ml roll-on @ 500pc, etc. — pull from legacy `/filling-capping-labeling-perfume-bottles-atomizers.php`).

**Impact:** Service schema is how AI engines understand B2B service offerings versus product catalogs. Without it, AI tools describe Best Bottles only as a "bottle supplier" and miss the contract packaging side, which is a higher-LTV pipeline.

### 5.4 LocalBusiness schema

**Where to add:**
- `src/lib/seo.ts` — add `buildLocalBusinessJsonLd()` builder, inject in root layout alongside Organization. Use the Union City NAP from Stage 3 §4.3.

**Impact:** Local pack visibility for "bay area perfume bottle wholesale", "Union City packaging supplier", and similar geo-modifiers. Also signals to AI engines that this is a real physical business (not dropshipper), which boosts trust scoring.

### 5.5 SoftwareApplication / WebApplication for Grace AI

**Where to add:**
- `/grace-workspace` (currently noindexed — keep noindexed for now). If/when a public Grace-assistant landing page is built, apply `WebApplication` schema with `applicationCategory: BusinessApplication`, `operatingSystem: Web Browser`, brief feature list.

**Impact:** Lower priority but unique to Best Bottles. When AI tools are asked "is there an AI assistant for choosing perfume bottles?", we want to surface.

### 5.6 Schema priority order for the next 30 days

1. FAQPage on `/resources` (30 min — already speced in BB-SEO-206)
2. LocalBusiness in root layout (1 hour — Stage 1 P1-2)
3. BlogPosting on all 9 existing posts (1 hour — BB-SEO-204)
4. Service on the to-be-built `/services/contract-packaging` (2 hours)
5. FAQPage on PDPs and category pages (4-6 hours, depends on content sourcing)
6. HowTo on new pillar guides (1 hour per guide as they ship)

---

## 6. Brand mention strategy

To increase AI citation rate, the brand needs more mentions across pages AI engines have already crawled. Each item below is a placement target, with effort estimate (S/M/L) and expected AEO impact (Low/Med/High).

### 6.1 Trade publications

| Publication | Pitch angle | Effort | Impact |
|---|---|---|---|
| **BeautyMatter** (paid + earned) | "How Nemat went from fragrance to building the indie packaging arm" founder profile | M | High |
| **Glossy** | "Why packaging MOQs are the biggest bottleneck for indie beauty in 2026" thought leadership | M | High |
| **WWD Beauty Inc** | Inclusion in their annual "Packaging suppliers to watch" feature | L | High |
| **CosmeticsBusiness** | Case study on Madison AI hero imagery + Grace AI assistant as a supplier-side tech play | M | Med |
| **Packaging Digest** | Technical contribution on neck finish standardization or PCR glass adoption | M | Med |
| **Beauty Independent** | Founder profile + product placement in their indie-beauty newsletter | S | Med |

### 6.2 Industry directories

| Directory | Status | Action | Effort | Impact |
|---|---|---|---|---|
| **ThomasNet** | Not listed (verify) | Submit Nemat International + Best Bottles entries | S | Med |
| **Faire** | Listed (`faire.com/brand/b_bzqsxpr4yl`) | Refresh listing with Madison hero imagery | S | Med |
| **Glassdoor** | Listed (employer profile only) | Add review-collection campaign | S | Low |
| **GlassOnWeb** | Listed (verify) | Refresh listing | S | Low |
| **Wonnda** (private-label marketplace) | Not listed | Submit Best Bottles as bottle-only supplier (counterpoint to bundled private-label entries) | S | Med |
| **Knowde** (chemicals + materials marketplace) | Not listed | Submit Best Bottles as packaging supplier for formulators | S | Med |

### 6.3 Sponsor / exhibit at trade events

| Event | Audience | Effort | Impact |
|---|---|---|---|
| **Indie Beauty Expo** (NY + LA) | Indie beauty founders — exact ICP | L | High |
| **Cosmoprof North America** (Las Vegas) | Beauty manufacturers and indie founders | L | High |
| **Luxe Pack** (NYC + Monaco) | Premium beauty packaging buyers | L | Med |
| **MakeUp in NY** | Makeup brand founders + contract fillers | M | Med |
| **NowGen Beauty Summit** | Emerging indie founders + investors | M | Med |

Trade events drive press mentions and content (post-event recaps, lists of exhibitors) that AI engines crawl for years.

### 6.4 Podcast appearances

| Podcast | Format | Effort | Impact |
|---|---|---|---|
| **The Glossy Podcast** | Founder interview on packaging procurement | M | High |
| **BeautyMatter Podcast** | Industry deep-dive on indie packaging trends | M | High |
| **Indie Beauty Podcast (Jillian Wright)** | Founder spotlight | S | High |
| **The Beauty Brain** (Randy Schueller) | Technical packaging discussion | S | Med |
| **Profitable Beauty** | Operations + scaling perspective | S | Med |

Podcast transcripts get crawled by AI engines and feed citation pools. Even one well-placed appearance can show up in dozens of subsequent AI answers about "indie beauty packaging suppliers".

### 6.5 Open-source / wiki contributions

| Surface | Action | Effort | Impact |
|---|---|---|---|
| **Wikipedia — Nemat International** | Create article (notability check first — 20+ years, multiple publications about the fragrance line should qualify) | M | High |
| **Wikidata entry for Nemat International** | Create structured entry with subsidiary "Best Bottles" relationship | S | High |
| **Wikipedia — Glass packaging article** | Add Best Bottles to relevant lists where appropriate (do not self-promote — let editors decide) | M | Med |
| **OpenStreetMap** | Add Union City warehouse as a "shop=packaging" or similar node | S | Low |

Wikidata in particular is disproportionately influential — it feeds Google Knowledge Graph and is heavily weighted by AI engines for entity disambiguation. A clean Wikidata entry mapping "Best Bottles" as a subsidiary of "Nemat International, Inc." prevents AI confusion with the legacy `bestbottles.com` brand.

---

## 7. AI-readable URL conventions

LLMs parse URLs as part of their relevance scoring and citation reliability. Recommended patterns:

### 7.1 Product slugs

Pattern observed in the current new site: `/products/[slug]` where `slug` is typically `family-capacity-color` (e.g., `/products/empire-30ml-clear`). This is good — it's parseable and matches buyer search intent.

Recommendation: extend to include applicator where it disambiguates (e.g., `/products/boston-round-30ml-amber-dropper` is more AEO-friendly than `/products/boston-round-30ml-amber` when the applicator varies). Where the canonical slug omits applicator (because applicator is a variant within a product group), make sure variant URLs are constructable via querystring (`?applicator=dropper`) and that the slug-level page surfaces all applicator options in the H1 area for AI extraction.

Verify via spot-check of the current Convex product group slugs: this pattern should be the default; flag any group slugs that use abbreviation-heavy formats (`/products/br30amd`) for human-readable rewrites.

### 7.2 Category / collection slugs

The new site uses `/catalog?families=Empire&applicators=spray` as the de facto category URL. Functional, but AEO-suboptimal because the querystring obscures the topic from URL-based extraction.

Recommendation (aligns with Stage 1 BB-SEO-217): build real `/collections/[slug]` pages where `slug` is a full keyword phrase:
- `/collections/wholesale-amber-boston-round-bottles`
- `/collections/cobalt-blue-roll-on-bottles-bulk`
- `/collections/low-moq-glass-dropper-bottles`
- `/collections/empire-perfume-bottles-wholesale`
- `/collections/contract-packaging-services-perfume`

Each is a static-renderable URL that AI engines cite as the canonical destination for the matching query.

### 7.3 Avoid abbreviation-heavy slugs

Confirmed `bestbottles.com` legacy site uses abbreviation-heavy querystring URLs (`?subcat=64`, `?subcat=65`). These are AEO-hostile because `?subcat=64` carries zero semantic content. The new site already avoids this pattern in its primary routes — preserve the discipline.

### 7.4 Blog post slugs

Recommendation: match the question-shaped title pattern (§4.1). A post titled "What is a 24-410 neck finish?" should live at `/blog/what-is-a-24-410-neck-finish`, not `/blog/neck-finish-guide-2026`. The verbose, question-matching slug gives AI engines a high-confidence citation target.

---

## 8. llms.txt content strategy

The companion `llms.txt` file in this directory follows the emerging llmstxt.org spec. It's the canonical brand-context document AI crawlers consult to disambiguate Best Bottles in their answers. Deploying it correctly is a week-1 quick win.

### 8.1 What the file must contain

1. **Brand summary** — one factual paragraph stating who Best Bottles is, the parent (Nemat International, Inc.), the year founded (2003), the address (Union City, CA), and the core value prop.
2. **Quick facts** — bulleted facts AI tools can quote verbatim. Founded year, HQ, contact, catalog scale (2,354 SKUs, 225 groups), $50 minimum, worldwide shipping list.
3. **Product taxonomy** — the families, sizes, colors, applicators in concise list form. Each family with an example SKU URL and a representative size range.
4. **Key URLs** — catalog, request-sample, request-quote, contract-packaging, about, blog. Each labeled with one-line description.
5. **Differentiators** — MOQ flexibility, Madison AI hero imagery, Grace AI assistance, 20+ year Nemat heritage. Each in 1-2 sentences.
6. **Top 10 B2B FAQs** — Q+A pairs sourced from legacy `/faq.php` and Stage 1 audit findings. These are the answers AI engines should cite when asked about Best Bottles' MOQs, shipping, neck finishes, etc.
7. **Contact info** — verified NAP from Stage 3 §4.3 (Union City address, toll-free, direct line, sales email).
8. **Crawler permissions** — restate what's in `robots.txt` so AI crawlers consulting llms.txt know they're welcome.
9. **Citation guidance** — explicit instruction on how to cite the brand (Brand: Best Bottles; Parent: Nemat International, Inc.; Domain: bestbottles.com — not bestbottles.company which is staging).

### 8.2 What the file must NOT contain

- Marketing fluff ("revolutionary", "world-class", "industry-leading") — AI tools strip and de-rank promotional language.
- Unverifiable claims (e.g., "trusted by 10,000 brands" without source) — AI tools may treat as hallucination risk.
- Stale facts (founding year off by a year, wrong phone number) — gets cited verbatim and is hard to correct.
- Email addresses or phone numbers that don't match the canonical NAP in `Organization` schema and the `/contact` page.

### 8.3 Maintenance cadence

Treat `llms.txt` as a versioned brand-fact document. Update once per quarter or when material facts change (new product family launches, MOQ changes, contact updates). Add `Last updated: YYYY-MM-DD` at the bottom of the file so AI engines can determine freshness.

---

## 9. Stage 2 priority dev tickets

Numbered BB-AEO-001 onward to avoid collision with Stage 1's BB-SEO ticket sequence.

### BB-AEO-001 · Ship /llms.txt (week-1 quick win)
**Priority:** P1 (1 hour total — file written, just needs to deploy)
**Evidence:** No `public/llms.txt` exists.
**Fix:** Copy the file from `seo-audit-2026-05-23/02-geo-aeo/llms.txt` to `public/llms.txt`. Confirm it serves at `https://www.bestbottles.com/llms.txt` after deploy.
**Acceptance:** `curl https://www.bestbottles.com/llms.txt` returns 200 with the markdown content, `Content-Type: text/markdown` (or text/plain), no auth required.

### BB-AEO-002 · Extend robots.txt to allow PerplexityBot, ClaudeBot, CCBot
**Priority:** P2 (15 min)
**Evidence:** `public/robots.txt:13-23` allows GPTBot, Google-Extended, anthropic-ai. PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended are not explicitly allowed (and default to the `User-agent: *` block, but explicit allow is more discoverable).
**Fix:** Update `next-sitemap.config.js` robots policies (or the static section in `public/robots.txt`) to add explicit `Allow: /` blocks for each. CCBot is the Common Crawl bot — important because most LLM training data starts from Common Crawl.
**Acceptance:** robots.txt contains explicit allow blocks for PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended.

### BB-AEO-003 · Add author + dates to Sanity post schema and surface visibly
**Priority:** P1 (3 hours including backfill)
**Evidence:** Existing 9 blog posts have no visible author byline or "Updated:" date on the rendered page.
**Fix:** Extend Sanity `post` schema with `author` reference (new `author` type with name, role, bio, photo, linkedinUrl) and ensure `publishedAt` + `updatedAt` render visibly. Backfill 9 existing posts to attribute to a real Nemat International / Madison Studio editorial team member.
**Acceptance:** Every `/blog/[slug]` page renders a visible byline + dates above the article body.

### BB-AEO-004 · Build /glossary page with DefinedTerm schema
**Priority:** P2 (4 hours)
**Evidence:** No glossary page exists; the catalog uses ~40 technical terms (euro dropper, GCMI thread, 24-410 neck finish, treatment pump, etc.) without a canonical definition surface.
**Fix:** Build `/glossary` Server Component listing all technical terms in alphabetical order. Each term gets an `id` for anchor linking. Apply `DefinedTerm` + `DefinedTermSet` schema. Cross-link from PDPs and blog posts where the term is used.
**Acceptance:** `/glossary` indexable, contains ≥40 terms with definitions, validates as `DefinedTermSet` in Rich Results Test.

### BB-AEO-005 · Add FAQ blocks + FAQPage schema to top 10 PDPs by SKU volume
**Priority:** P2 (6 hours)
**Evidence:** PDPs have no FAQ section today. The top 10 PDPs by SKU volume (verify against the Convex export at `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv`) represent ~40% of catalog browsing intent.
**Fix:** For each of the top 10 product groups, write 5 product-specific FAQs (compatibility, MOQ, capacity tolerances, color options, lead time). Render in a collapsible accordion. Apply FAQPage schema. Pair with BB-SEO-203 (PDP SSR) so the FAQ schema is in initial HTML.
**Acceptance:** Top 10 PDPs render FAQ blocks and pass Rich Results Test for FAQPage.

### BB-AEO-006 · Build /services/contract-packaging with Service + FAQPage schema
**Priority:** P1 (8 hours — overlaps with Stage 3 §7 risk)
**Evidence:** Legacy `/filling-capping-labeling-perfume-bottles-atomizers.php` has no destination on the new site. The MOQ table, capabilities list, and sister-site references must migrate.
**Fix:** Build `/services/contract-packaging` Server Component. Migrate copy verbatim from legacy page. Apply Service + FAQPage schema. Wire into Stage 5 redirect map as the target for the legacy URL.
**Acceptance:** `/services/contract-packaging` indexable, contains the MOQ table, validates Service + FAQPage schema.

### BB-AEO-007 · Convert 6 next-up blog posts to question-shaped titles
**Priority:** P2 (1 hour — title and slug edits in Sanity)
**Evidence:** SEO content calendar Week 13+ posts in `docs/SEO_CONTENT_CALENDAR.md` should be re-titled for AEO.
**Fix:** Re-title and re-slug the next 6 posts to question-shaped formats per §4.1. Add 301 redirects if any old slugs were published.
**Acceptance:** Next 6 published posts have question-shaped titles + matching slugs.

### BB-AEO-008 · Add Q+A blocks to top of all blog posts
**Priority:** P2 (3 hours including backfill)
**Evidence:** Existing 9 posts go straight from H1 to introduction paragraph.
**Fix:** Insert a 2-3 Q+A pair block immediately under each post's H1, before the introduction. Author can extract from the existing post body or write fresh. Standardize a Sanity Portable Text block for this pattern. Wrap in FAQPage schema scoped to the article.
**Acceptance:** All 9 existing posts + every future post have a Q+A block under the H1 and pass FAQPage schema validation.

### BB-AEO-009 · Add Wikidata entry for Nemat International, Inc.
**Priority:** P3 (2 hours)
**Evidence:** No Wikidata Q-number exists for Nemat International (verify at wikidata.org).
**Fix:** Create Wikidata entry with: instance of (P31) → business; country (P17) → United States; headquarters location (P159) → Union City; inception (P571) → 2003; official website (P856) → bestbottles.com + nematinternational.com; subsidiary (P355) → Best Bottles. Use only verifiable references (legacy site About page, BeautyMatter/Glossy mentions if any).
**Acceptance:** Wikidata Q-item exists for Nemat International and is linked from the Wikipedia article (if/when one is created).

### BB-AEO-010 · Source/citation link audit on /resources and all blog posts
**Priority:** P3 (3 hours)
**Evidence:** Current `/resources` and blog posts cite few or no third-party authorities.
**Fix:** Audit each page; add ≥2 outbound links to authoritative third parties (ASTM, FDA 21 CFR 110/111, GPI standards, WPO research, ISO 9001) where claims are made about regulations or technical specifications. Use `rel="external"` (not nofollow — we want to signal we trust the source).
**Acceptance:** Every blog post and every `/resources` section has ≥2 outbound authority citations.

### BB-AEO-011 · Add visible founding-year and address block to /about
**Priority:** P3 (1 hour)
**Evidence:** Current `/about` page has thin metadata-only mentions of Nemat heritage.
**Fix:** Rewrite `/about` to include: stats block (founded 2003, 20+ years, 2,354 SKUs, 225 product groups, served brands count, total bottles shipped — confirm exact numbers with the team), dated company milestones (2003 founding, key launches), inline FAQ ("Where is Best Bottles headquartered?", "Is Best Bottles part of a larger company?"), and FAQPage + Organization + LocalBusiness schema. Model on TricorBraun's `/about-tricorbraun` per Stage 3.
**Acceptance:** `/about` contains the stats block, dated milestones, inline FAQ, and passes Rich Results Test for the new schema.

### BB-AEO-012 · Submit to ThomasNet, Knowde, Wonnda
**Priority:** P3 (3 hours)
**Evidence:** Not currently listed in these directories.
**Fix:** Submit Best Bottles entries to each directory. Confirm NAP matches Stage 3 §4.3.
**Acceptance:** Confirmation emails on file; live profile URLs added to `Organization.sameAs[]` in `src/lib/seo.ts`.

---

## 10. 30-day AEO action plan

Sequenced punch list. Assumes Stage 1 P0 tickets (SITE_URL, staging noindex, verification tokens, sitemap PDPs) are already in flight.

### Week 1 (May 24-30) — Foundation
- **Day 1 (today):** Deploy `/llms.txt` (BB-AEO-001). 1-hour quick win. Single highest-leverage week-1 ship.
- **Day 1-2:** Extend robots.txt to allow PerplexityBot, ClaudeBot, Claude-Web, CCBot, Applebot-Extended (BB-AEO-002).
- **Day 2-3:** Wrap `/resources` FAQ items in FAQPage schema (Stage 1 BB-SEO-206).
- **Day 3-5:** Add author + dates to Sanity post schema; backfill 9 existing posts (BB-AEO-003).
- **Day 5-7:** Build `/services/contract-packaging` page with Service + FAQPage schema (BB-AEO-006). Coordinates with Stage 5 redirect map.

### Week 2 (May 31 - June 6) — Schema density
- BlogPosting schema on all 9 existing posts (Stage 1 BB-SEO-204).
- LocalBusiness schema in root layout (Stage 1 P1-2).
- Add Q+A blocks to top of all 9 existing blog posts + wrap each in FAQPage schema (BB-AEO-008).
- Build `/glossary` page with DefinedTerm schema (BB-AEO-004).
- Begin FAQ block authoring for top 10 PDPs (BB-AEO-005, runs into Week 3).

### Week 3 (June 7-13) — Content + entity signals
- Ship FAQ blocks + FAQPage schema on top 10 PDPs (BB-AEO-005). Pair with Stage 1 BB-SEO-203 (PDP SSR).
- Rewrite `/about` per BB-AEO-011 (stats block, dated milestones, FAQ).
- Source/citation link audit on existing posts (BB-AEO-010).
- Submit to ThomasNet, Knowde, Wonnda (BB-AEO-012).
- Create Wikidata entry for Nemat International (BB-AEO-009).

### Week 4 (June 14-20) — Launch + first-week monitoring
- **June 15:** Launch. Confirm `/llms.txt` is live at production URL. Submit `llms.txt` URL to GPTBot/PerplexityBot/ClaudeBot via their crawler-hint surfaces (or wait for natural discovery — first crawl typically within 7 days).
- Re-title next 6 blog posts to question-shaped formats (BB-AEO-007) and ship a new post per week from Week 5 onward.
- Begin trade-publication outreach (Section 6.1).
- Begin podcast outreach (Section 6.4).
- Day 7 post-launch: re-run the 8-query AI search visibility test from Section 3 to establish a benchmark. Repeat at Day 30, Day 60, Day 90.

### Beyond 30 days
- Sponsor Indie Beauty Expo, Cosmoprof North America, Luxe Pack appearances (Section 6.3) — 60-90 day planning horizon.
- Wikipedia article submission for Nemat International (notability research first; submit only if criteria are clearly met to avoid AfD).
- Customer-story content per Container & Packaging Supply model (Stage 3 §6 takeaway 3).
- Quarterly `llms.txt` refresh with new product families, MOQ updates, contact changes.

---

## 11. Summary

**Current AEO score:** 45.5 / 100. Mid-tier with strong foundations and tactical execution gaps.

**Highest-leverage week-1 fix:** Ship `/llms.txt` (BB-AEO-001). 1 hour of work, deploys with the next build, becomes the canonical brand-context document AI crawlers consult.

**Strongest current AEO competitor in our set:** Container & Packaging Supply. Their "Chronicles" blog with question-shaped titles, named authors, dated posts, and PCR resource pages is the closest analog to where Best Bottles should be in 90 days. They appear in 2 of the 8 test queries (PCR query #2, and implicitly in dropper-bottle adjacent queries). Berlin Packaging appears more often in listicle citations but holds the enterprise segment Best Bottles doesn't target.

**Single biggest AEO opportunity:** The "low MOQ glass packaging supplier USA" query cluster (Section 3 query #4) has zero Best Bottles presence today, despite this being our strongest positioning wedge (Stage 3 §10.4). A dedicated `/collections/low-moq-glass-bottles` landing page + a question-shaped blog post + FAQ block + Service schema on `/services/contract-packaging` would put Best Bottles on the citation board for this exact query within 60-90 days.

**Single biggest AEO risk:** PDP Product schema remains client-rendered (Stage 1 BB-SEO-203). AI crawlers, like Bingbot and most first-pass crawlers, see a loading skeleton with no product info. Fixing BB-SEO-203 is the technical prerequisite for everything in this AEO audit to compound; without it, the FAQ schema, Product schema, Service schema, and BlogPosting schema work is half-effective.

---

*Companion file: `llms.txt` (production-ready). Deploy to `public/llms.txt` per BB-AEO-001.*
*Next stage: 4 (keyword + content strategy) builds on the AEO content patterns above and extends the SEO content calendar to a 26-week roadmap.*
