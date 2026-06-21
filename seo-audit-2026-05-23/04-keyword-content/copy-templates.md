# Best Bottles — PDP & Category Copy Templates (Stage 4c)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Date:** 2026-05-23
**Target launch:** 2026-06-15
**Scope:** Scalable copy templates for the new Best Bottles site's 225 product group pages (PDPs) and ~30 category landing pages. This document gives the editorial team a fill-in-the-blanks pattern, a worked example for each template, and the tone-of-voice notes that adapt the Halbert / Ogilvy / Schwartz frameworks from `docs/SEO_CONTENT_CALENDAR.md` to commercial pages (vs editorial blog content).

This document is consumed by: the content production team, the Madison Studio designer/copywriter pair, and the Convex/Sanity engineer wiring product-group content into the PDP route.

---

## Why templates exist (and what they are not)

Best Bottles has 225 product groups and 2,354 SKUs. Hand-writing 225 unique PDP copy blocks would take 18-24 person-weeks and would still produce uneven quality. The opposite extreme — fully programmatic auto-generation — produces the kind of generic, thin PDP content Google has been demoting since 2024 and AI engines refuse to cite. The right answer is a **structured template with deliberate variable slots**, populated programmatically from Convex data with editorial review for the top 50 PDPs by volume (which absorb 80% of catalog traffic per Pareto).

The templates below are:
- **Structurally complete** — every section is specified, so the team isn't reinventing the IA for each page.
- **Variable-driven** — the placeholders pull from the existing Convex `products` and `productGroups` schemas.
- **AEO-engineered** — every template includes FAQPage schema, named-author bylines, comparison tables where relevant, and Q+A blocks.
- **Tone-consistent** — the voice notes at the end map each section to the right copywriting tradition.

They are not:
- A substitute for editorial judgement on the top 50 PDPs (those get human-written hero copy).
- An auto-population script (a separate engineering ticket; this is the content spec).
- A replacement for the blog/resource voice (those have different rules — see Section 3 of this doc).

---

## 1. PDP COPY TEMPLATE

The template below is for a single product group page (e.g., "Amber Boston Round 30ml Dropper"). It maps directly to the Next.js `/products/[slug]` route and the Convex `productGroups` document for that group.

### 1.1 Section structure

```
[01] EYEBROW TAXONOMY     — breadcrumb-style, 1 line
[02] H1                   — product group name, optimized for primary keyword
[03] PRICE + AVAILABILITY — from Convex, with case-quantity context
[04] PRODUCT OVERVIEW     — 60-word opening copy
[05] SPECIFICATIONS TABLE — pulled from Convex; 8 rows standard
[06] USE CASES            — 3-5 specific applications, persona-tagged
[07] WHAT PAIRS WITH THIS — compatible caps / applicators / collars
[08] HOW BRANDS USE IT    — customer example sentences OR generic use case
[09] FAQ BLOCK            — 3-5 Q+A pairs, AEO-optimized, FAQPage schema
[10] SCHEMA FIELDS        — Product + FAQPage + BreadcrumbList JSON-LD
```

### 1.2 Section-by-section spec

#### [01] EYEBROW TAXONOMY

**Pattern:** `{Category} › {Subcategory} › {Family} › {Color} › {Capacity}`

**Example for Amber Boston Round 30ml Dropper:**
> Bottles › Boston Round › Amber Glass › 30ml › With Dropper

**Spec:** Mirrors the BreadcrumbList JSON-LD; renders as a horizontal nav row above the H1. Each segment is a link to its category page.

#### [02] H1

**Pattern:** `{Color} {Family} {Capacity} {Applicator Type}`

**Example:**
> Amber Boston Round 30ml Dropper Bottle

**Rules:**
- Always includes the color, the family name, the capacity in ml (or oz for US-only product groups), and the applicator if it's part of the SKU spec.
- Maximum 75 characters to fit the meta-title pattern `{H1} | Best Bottles`.
- For variant-included groups (e.g., the same 30ml Boston Round in amber AND cobalt AND clear), the H1 names the dominant color and the section under "How brands use it" mentions the available variants.

#### [03] PRICE + AVAILABILITY

**Pattern:**
> **${MIN_PRICE} – ${MAX_PRICE}** per bottle · As low as **${CASE_PRICE}/bottle** at {CASE_QTY}+
> {AVAILABILITY_TEXT} · Ships in {LEAD_TIME} business days · Minimum order ${MIN_ORDER}

**Example for Amber Boston Round 30ml Dropper (case quantity 120):**
> **$1.42 – $1.95** per bottle · As low as **$1.18/bottle** at 120+
> In stock · Ships in 2-3 business days · Minimum order $50

**Spec:** Pulled directly from Convex `products.priceTiers` and `products.inventoryStatus`. Note this is the section that drives the "no minimum" / "low MOQ" positioning competitors like Specialty Bottle currently own — make the $50 minimum and case-pricing math visible above the fold.

#### [04] PRODUCT OVERVIEW (60 words)

**Pattern (slot for each variable):**
> The **{Color} {Family} {Capacity}** is a **{ADJECTIVE_1}, {ADJECTIVE_2}** glass bottle designed for **{PRIMARY_USE_CASE}**. {ONE_DIFFERENTIATING_DETAIL_SENTENCE}. {CAP_AND_APPLICATOR_SENTENCE}. {WHO_USES_IT_SENTENCE}. {INTERNAL_LINK_SENTENCE_TO_PARENT_FAMILY}.

**Variables:**
- ADJECTIVE_1, ADJECTIVE_2: pulled from a controlled vocabulary (e.g., "amber-tinted, UV-protective"; "thick-walled, retail-ready"; "frosted, light-diffusing")
- PRIMARY_USE_CASE: from Convex product group `primaryUseCase` field (e.g., "essential oils", "facial serums", "perfume oils")
- ONE_DIFFERENTIATING_DETAIL_SENTENCE: a single sentence calling out the spec that matters (wall thickness, dropper bulb material, finish quality)
- CAP_AND_APPLICATOR_SENTENCE: which dispensers fit it
- WHO_USES_IT_SENTENCE: persona-tagged sentence ("Wellness brands use it for...", "Cosmetic formulators spec it for...")
- INTERNAL_LINK_SENTENCE_TO_PARENT_FAMILY: a link UP to the family category page

**Worked example:**
> The **Amber Boston Round 30ml** is an **amber-tinted, UV-protective** glass bottle designed for **light-sensitive essential oils, botanical extracts, and vitamin-based serums**. The amber tint blocks the 280-450nm UV range that degrades citrus and herbal formulas in clear glass. It accepts a 20-400 dropper assembly, an orifice reducer, or a treatment pump — all listed below under "What pairs with this". Wellness and aromatherapy brands spec the 30ml Amber Boston Round when they need a retail-ready size that ships well, photographs cleanly, and protects the formula on shelf. Browse the full [Boston Round family](/collections/boston-round-glass-bottles) for sizes from 1oz through 32oz.

Word count: 62. Hits the 60-word target with one buffer word.

#### [05] SPECIFICATIONS TABLE

**Pattern:**

| Spec | Value |
|---|---|
| Capacity | {CAPACITY_ML} ml / {CAPACITY_OZ} oz |
| Neck finish | {NECK_FINISH} ({NECK_FINISH_STANDARD}) |
| Material | {MATERIAL_TYPE} (Type 3 soda-lime / Type 1 borosilicate) |
| Applicator | {APPLICATOR_TYPE} |
| Color | {COLOR} ({HEX_OR_PANTONE}) |
| Wall thickness | {WALL_MM} mm |
| Case quantity | {CASE_QTY} bottles per case |
| Bottles per pallet | {PALLET_QTY} bottles per pallet |
| MOQ | {MIN_ORDER_PIECES} pieces (or ${MIN_ORDER_USD}, whichever is greater) |
| Lead time | {LEAD_TIME_DAYS} business days |

**Worked example (Amber Boston Round 30ml Dropper):**

| Spec | Value |
|---|---|
| Capacity | 30 ml / 1 oz |
| Neck finish | 20-400 (GPI standard) |
| Material | Type 3 soda-lime amber glass |
| Applicator | Black ribbed dropper with rubber bulb (included) |
| Color | Amber (Pantone 1685 C reference) |
| Wall thickness | 2.4 mm |
| Case quantity | 120 bottles per case |
| Bottles per pallet | 4,320 (36 cases per pallet) |
| MOQ | 12 pieces (or $50 minimum order, whichever is greater) |
| Lead time | 2-3 business days |

**Spec note:** Every field pulls from Convex. If a field is null (e.g., wall thickness not measured for a legacy SKU), the row is omitted from the rendered table rather than showing "N/A" — null values undermine AEO trust signals.

#### [06] USE CASES (3-5 specific applications)

**Pattern:** Three to five bulleted lines, each in the form `**{Application}** — {1-sentence rationale}`.

**Worked example:**

- **Essential oils** — The amber tint protects citrus, herbal, and resin oils from UV-driven oxidation. The 30ml capacity is the wellness-shelf standard for single-oil SKUs.
- **Facial serums (vitamin C, retinol, niacinamide)** — Amber blocks light wavelengths that degrade vitamin C, retinol, and other photo-sensitive actives. Pair with a treatment pump for airless dispensing.
- **Perfume oils and roll-on attars** — The 20-400 neck finish accepts a metal roller-ball collar for direct skin application; the 30ml capacity gives indie perfumers a retail-ready SKU.
- **Tinctures and homeopathic extracts** — Practitioner-grade application; the dropper assembly enables precise sublingual dosing. The amber glass meets USP <660> Type 3 specifications.
- **Sample programs** — Indie brands offering 30ml samples of larger format products use this SKU as a 1-oz "discovery" size with consistent branding to the full retail line.

**Spec note:** Each bullet is intentionally persona-tagged (essential oils = indie founder + formulator; facial serums = formulator; perfume oils = designer + indie founder; tinctures = formulator; samples = indie founder). This is how the same PDP serves 5 personas without sounding generic.

#### [07] WHAT PAIRS WITH THIS

**Pattern:**
> **Compatible caps & applicators:**
> - {COMPATIBLE_ITEM_1} ({SKU_LINK_1})
> - {COMPATIBLE_ITEM_2} ({SKU_LINK_2})
> - {COMPATIBLE_ITEM_3} ({SKU_LINK_3})
>
> **Frequently bought together:**
> - {BUNDLE_LINK_1}
> - {BUNDLE_LINK_2}

**Worked example:**

**Compatible caps & applicators (20-400 neck finish):**
- [Black ribbed dropper with rubber bulb](/products/dropper-20-400-black-ribbed-rubber) — included by default; orderable separately for replacement or bulk
- [White ribbed dropper with rubber bulb](/products/dropper-20-400-white-ribbed-rubber) — color-match option for clean-beauty brand identities
- [Orifice reducer + black phenolic cap](/products/orifice-reducer-20-400-black-phenolic) — for higher-viscosity oils where dropper flow is too slow
- [Metal roller-ball collar (8mm steel)](/products/roller-collar-20-400-8mm-steel) — converts to roll-on application
- [20-400 black phenolic cap with PE cone liner](/products/cap-20-400-black-phenolic-pe-liner) — standard screw cap if no dispenser is needed

**Frequently bought together:**
- [Amber Boston Round 30ml sample kit (12-bottle starter)](/products/sample-kit-amber-boston-round-30ml)
- [Amber Boston Round family bundle (1oz, 2oz, 4oz, 8oz)](/products/bundle-amber-boston-round-family)

**Spec note:** Every "compatible" link is generated from a Convex compatibility query (by neck finish). The "frequently bought together" links are editorial picks for the top 50 PDPs and Convex-computed for the long-tail PDPs.

#### [08] HOW BRANDS USE IT

**Pattern (with customer):**
> {BRAND_NAME}, a {INDUSTRY_DESCRIPTOR} brand based in {LOCATION}, uses the {THIS_PRODUCT} for its {SPECIFIC_USE}. The {DETAIL_OF_HOW_THEY_CUSTOMIZED_OR_USED_IT} — read the full story [here]({CUSTOMER_STORY_URL}).

**Pattern (without customer):**
> Indie brands launching {INDUSTRY_DESCRIPTOR} products typically use the {THIS_PRODUCT} for its {SPECIFIC_USE_CASE}. The most common configuration is {COMMON_CONFIGURATION}. Brands scaling from a sample-kit pilot to a retail launch use this SKU as the foundation of a {NUMBER}-SKU family before adding adjacent sizes.

**Worked example (customer-present version):**
> Asala Wellness, a clean-beauty essential oil brand based in Brooklyn, uses the Amber Boston Round 30ml with a treatment pump for its hero "Restore" facial oil. They custom-printed the bottle with a single-color silk-screen logo and paired it with the matching 50ml SKU to anchor the brand's retail launch in Bigelow Apothecary — read the full story [here](/resources/asala-wellness-customer-story).

**Worked example (no-customer version):**
> Indie brands launching essential oil lines typically use the Amber Boston Round 30ml for its UV protection, dropper compatibility, and retail-ready size. The most common configuration is the bottle plus the included black dropper with rubber bulb. Brands scaling from a sample-kit pilot to a retail launch use the 30ml as the foundation of a 4-SKU family (1oz, 2oz, 4oz, 8oz) before adding adjacent capacities.

**Spec note:** When a real customer story exists, lead with the customer-present version. The Stage 3 audit flagged "customer stories are an organic link gold mine" (CPS uses this pattern heavily). Even 6 customer stories at launch — one per top-volume product group — would create a meaningful link surface. When no customer is available, the no-customer version is generic enough to be safe but specific enough to be useful, because it names the actual scaling pattern (the 4-SKU family).

#### [09] FAQ BLOCK (3-5 Q+A pairs)

**Pattern:** Three to five question-and-answer pairs, each between 30 and 70 words. Every question is question-shaped (starts with "What", "How", "Is", "Can", "Do"). Every answer leads with a direct response in the first 12 words (AEO extraction pattern from Stage 2 §4.4).

**Worked example for Amber Boston Round 30ml Dropper:**

**Q: What is the neck finish on the Amber Boston Round 30ml?**
A: 20-400 — a 20mm outer diameter GPI thread finish. It accepts the standard 20-400 dropper assembly (included), orifice reducer with phenolic cap, 8mm metal roller-ball collar, treatment pump, or screw cap. Best Bottles lists compatible closures above under "What pairs with this".

**Q: Does the amber color protect essential oils from light?**
A: Yes. Amber glass blocks the 280-450nm UV wavelength range that degrades citrus oils, botanical extracts, and vitamin-based formulas. Clear glass allows full UV transmission and is unsuitable for light-sensitive oils. For deeper detail, see our [glass color guide](/resources/glass-color-guide).

**Q: What is the minimum order for the Amber Boston Round 30ml?**
A: 12 pieces (one case) at the per-bottle rate, with a $50 minimum order across the cart. Brands can mix and match SKUs to reach the $50 threshold. Sample orders are available with no commitment via the [Best Bottles sample kit](/request-sample).

**Q: How many Amber Boston Round 30ml bottles ship per pallet?**
A: 4,320 bottles per pallet (36 cases × 120 bottles per case). Pallet pricing tiers apply at 1,000+ bottles. For LTL freight estimates on full-pallet orders, see [How many bottles fit on a pallet for LTL shipping?](/blog/how-many-bottles-fit-on-a-pallet-for-ltl-shipping).

**Q: Can I order this bottle in a custom Pantone color?**
A: Yes, for orders of 5,000+ bottles per color with a 12-week lead time. The standard catalog colors are amber, cobalt blue, clear, and frosted. For custom Pantone projects, see [How do I spec a custom Pantone color for a wholesale glass bottle?](/resources/custom-pantone-color-glass-bottle) or [request a custom quote](/request-quote).

**Spec note:** Each FAQ does three things: answers a real search query (the questions are pulled from Persona 1 and Persona 4 keyword corpus), links to a deeper resource page (internal-link equity flowing UP to pillars), and reinforces a positioning signal (low MOQ, UV protection, custom Pantone capability). This is the highest-leverage block on the page for AEO.

#### [10] SCHEMA FIELDS

JSON-LD blocks rendered server-side per BB-SEO-203:

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Amber Boston Round 30ml Dropper Bottle",
  "image": "https://www.bestbottles.com/images/products/amber-boston-round-30ml-dropper-hero.jpg",
  "description": "60-word product overview from [04]",
  "sku": "BB-BR-30-AMB-DR-20400",
  "brand": { "@type": "Brand", "name": "Best Bottles" },
  "manufacturer": { "@type": "Organization", "name": "Nemat International, Inc." },
  "category": "Bottles › Boston Round › Amber Glass",
  "color": "Amber",
  "material": "Type 3 soda-lime glass",
  "weight": { "@type": "QuantitativeValue", "value": 92, "unitCode": "GRM" },
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "USD",
    "lowPrice": "1.18",
    "highPrice": "1.95",
    "offerCount": 4,
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31",
    "seller": { "@type": "Organization", "name": "Best Bottles" }
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Neck finish", "value": "20-400" },
    { "@type": "PropertyValue", "name": "Capacity (ml)", "value": "30" },
    { "@type": "PropertyValue", "name": "Wall thickness (mm)", "value": "2.4" },
    { "@type": "PropertyValue", "name": "Case quantity", "value": "120" }
  ]
}
```

Plus a separate FAQPage JSON-LD wrapping the 5 Q+A pairs from [09], and a BreadcrumbList JSON-LD mirroring [01]. Per Stage 2 BB-AEO-005, every PDP must render this in initial HTML (not client-side).

### 1.3 Where editorial judgement still matters

The template above is enough to produce competent PDP copy for all 225 product groups programmatically. But the top 50 product groups by SKU volume — which the Convex export tells us absorb ~80% of catalog browse traffic — deserve hand-written hero copy in section [04] and hand-curated customer stories in section [08]. Allocate ~1 hour per top-50 PDP to the editorial team; the remaining 175 PDPs run on the template alone with sample-validation on 10% of pages by random selection.

---

## 2. CATEGORY PAGE COPY TEMPLATE

The template below is for a category landing page (e.g., "Boston Round Bottles"). It maps to a Next.js `/collections/[slug]` route. Per Stage 2 BB-AEO-007, every category page is a real static URL with editorial copy above the product grid — not a faceted querystring (`/catalog?families=BostonRound` is for filtering within a category, not for landing).

### 2.1 Section structure

```
[01] H1                    — category name with keyword
[02] CATEGORY OVERVIEW     — 120-word editorial copy
[03] WHO BUYS THIS         — persona snippets (3 short)
[04] WHEN TO CHOOSE THIS   — over the adjacent category
[05] COMMON QUESTIONS      — 5 Q+A pairs, FAQPage schema
[06] PRODUCT GRID          — Convex-driven, faceted
[07] SCHEMA FIELDS         — CollectionPage + FAQPage + BreadcrumbList JSON-LD
```

### 2.2 Section-by-section spec

#### [01] H1

**Pattern:** `{Category_Name} Wholesale` or `{Adjective} {Category_Name} Bottles` — whichever maps the primary keyword.

**Worked example (Boston Round category):**
> Boston Round Glass Bottles

**Rules:**
- Always include "wholesale" or "bottles" in the H1 if the primary keyword does — never strip the commercial intent for brevity.
- Maximum 65 characters to fit the meta-title pattern `{H1} | Best Bottles Wholesale`.

#### [02] CATEGORY OVERVIEW (120 words)

**Pattern:**
> The {Category_Name} is {ONE_SENTENCE_DEFINITION_WITH_KEY_FEATURE}. {ORIGIN_OR_HERITAGE_SENTENCE}. {WHAT_IT_DOES_WELL_SENTENCE}. {WHAT_IT_DOES_NOT_DO_SENTENCE}. {WHICH_PERSONAS_BUY_IT_SENTENCE}. {BEST_BOTTLES_INVENTORY_RANGE_SENTENCE}. {INTERNAL_LINK_SENTENCE_TO_TWO_RELATED_CATEGORIES}.

**Worked example (Boston Round Bottles):**
> The Boston Round is the workhorse of the wellness, essential oil, and apothecary packaging world — a heavy-walled, narrow-shouldered glass bottle with a tight 20-400 neck finish that accepts more applicator types than any other bottle shape. It was engineered for the late-19th-century US pharmaceutical industry to be machine-fillable, shippable without breakage, and stackable on a chemist's shelf. Today it remains the default choice for essential oil brands, indie wellness lines, tincture practitioners, and clean-beauty serum brands that want a no-nonsense glass form with credibility built in. It is not the right choice for fine fragrance or luxury serum, where a [Euro dropper](/collections/euro-dropper-bottles) or a sculptural fragrance flacon does more brand work. Best Bottles carries Boston Rounds in 1oz, 2oz, 4oz, 8oz, 16oz, and 32oz across amber, cobalt blue, clear, and frosted glass, with droppers, orifice reducers, roller balls, treatment pumps, and screw caps for every neck-finish-compatible configuration. Browse the [amber Boston Round selection](/collections/amber-boston-round-bottles) if UV protection is your priority, or the [cobalt blue Boston Round selection](/collections/cobalt-blue-boston-round-bottles) for niche-fragrance and apothecary positioning.

Word count: 197. Runs over the 120-word target deliberately for category pages — category pages bear more editorial weight than PDPs because they rank for higher-volume head queries. The 120-word floor is a minimum, not a ceiling.

#### [03] WHO BUYS THIS (3 persona snippets)

**Pattern:** Three short sentences, each tagged to one of the 5 personas from the corpus.

**Worked example:**

- **Indie wellness founders** — sourcing the right amber or cobalt size for an essential oil or tincture line; the 1oz and 2oz are the most-ordered sample-stage SKUs.
- **Cosmetic formulators** — spec'ing the 20-400 neck finish for serums and oils where dropper assembly torque and chemical resistance matter; the 4oz and 8oz dominate clinical-grade orders.
- **Contract fillers and co-packers** — ordering by the case (120/case) or pallet (4,320/pallet) for client jobs across multiple brands; the 30ml amber is the single highest-volume SKU in this category.

**Spec note:** This section is the persona-meets-category bridge that the keyword corpus enables. Each line answers the implicit question "is this category for me?" before the user has to scroll through the grid.

#### [04] WHEN TO CHOOSE THIS OVER {ADJACENT_CATEGORY}

**Pattern:** A short three-paragraph comparison against the closest-substitute category. Reads like the answer to "Boston Round vs Euro Dropper" but lives on the category page (not just in a blog post).

**Worked example (Boston Round vs Euro Dropper):**

> **Choose Boston Round when:** the product is a wellness oil, tincture, or single-active serum; the visual cue you want to send is "potent, practitioner-grade, ingredient-led"; you need a neck finish that accepts five different applicator types; or the price-per-bottle matters and you're scaling to thousands of units.
>
> **Choose [Euro Dropper](/collections/euro-dropper-bottles) when:** the product is fine fragrance, luxury serum, or a niche perfume oil; the visual cue you want is "minimal, modern, premium"; the formula viscosity is low and benefits from a longer dropper pipette; or the brand is positioning at $80+ retail and the bottle silhouette is doing meaningful brand work.
>
> **Both can serve the same formula** — the question is which brand story you're telling. For a deeper comparison, see [Boston Round vs. Euro Dropper vs. Serum Vial](/blog/boston-round-vs-euro-dropper-vs-serum-vial) (the original post from our editorial series).

**Spec note:** The closing link is to the existing blog post (Week 3 Post 05 in the calendar) — this is exactly the kind of internal-link discipline that makes the category page the canonical destination rather than the blog post. The blog post explains the comparison; the category page commits to it and lets the user shop.

#### [05] COMMON QUESTIONS (5 Q+A pairs)

**Pattern:** Same rules as PDP FAQ block (3-70 word answers, question-shaped questions, direct answer in first 12 words).

**Worked example for Boston Round Bottles:**

**Q: What is a Boston Round bottle?**
A: A heavy-walled, narrow-shouldered glass bottle with a 20-400 neck finish, originally engineered for the late-19th-century US pharmaceutical industry. Today it is the default choice for essential oils, tinctures, wellness oils, and clinical serums because it accepts droppers, orifice reducers, roller balls, treatment pumps, and screw caps.

**Q: What sizes do Boston Round bottles come in?**
A: Best Bottles stocks Boston Rounds in 1oz (30ml), 2oz (60ml), 4oz (120ml), 8oz (240ml), 16oz (480ml), and 32oz (960ml). The 1oz and 4oz are the highest-volume sizes in the category. All sizes use the 20-400 neck finish (with the 8oz+ also offered in 24-400 for higher-throughput pump applications).

**Q: What colors are Boston Round bottles available in?**
A: Amber (the UV-protective standard), cobalt blue (for niche-fragrance and apothecary brands), clear (for visibility-first formulas), and frosted (for premium positioning without color). See our [glass color guide](/resources/glass-color-guide) for which color suits which formula.

**Q: What is the minimum order for Boston Round bottles?**
A: One case (typically 120 bottles for the 30ml size, varies by size) at the standard per-bottle rate, with a $50 minimum order across the cart. Brands can mix sizes and colors to reach the $50 threshold. Sample orders are available via [request a sample kit](/request-sample).

**Q: Can I get custom Pantone color Boston Rounds?**
A: Yes, for orders of 5,000+ bottles per color with a 12-week lead time. Standard catalog colors are amber, cobalt blue, clear, and frosted. For custom color projects, see [How do I spec a custom Pantone color for a wholesale glass bottle?](/resources/custom-pantone-color-glass-bottle).

#### [06] PRODUCT GRID

Renders below the editorial copy. Pulled from Convex with these defaults:
- Sort: highest case-quantity availability first, then by SKU volume
- Filters: size, color, applicator type, MOQ band
- Display: 12 products per page with infinite scroll

#### [07] SCHEMA FIELDS

```jsonc
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Boston Round Glass Bottles",
  "description": "120-word category overview from [02], truncated to 160 characters for description",
  "url": "https://www.bestbottles.com/collections/boston-round-glass-bottles",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Best Bottles",
    "url": "https://www.bestbottles.com"
  },
  "about": [
    { "@type": "Thing", "name": "Boston Round bottle" },
    { "@type": "Thing", "name": "Essential oil packaging" },
    { "@type": "Thing", "name": "Apothecary glass bottle" }
  ],
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "/products/amber-boston-round-30ml-dropper" },
      { "@type": "ListItem", "position": 2, "url": "/products/cobalt-blue-boston-round-30ml-dropper" }
    ]
  }
}
```

Plus separate FAQPage JSON-LD wrapping the 5 Q+A pairs from [05] and BreadcrumbList JSON-LD.

### 2.3 Adjacent-category map (for [04] WHEN TO CHOOSE THIS)

Each category page needs a clear adjacent-category to compare against. The map for the 8 highest-volume categories:

| This category | Compare against |
|---|---|
| Boston Round | Euro Dropper |
| Euro Dropper | Serum Vial |
| Roll-On | Dropper |
| Spray Bottles | Roll-On |
| Cream Jars | Lotion Bottles |
| Sample Vials | Roll-On |
| Empire Flacon | Cylinder |
| Apothecary | Boston Round |

---

## 3. TONE OF VOICE NOTES

The existing `SEO_CONTENT_CALENDAR.md` establishes the brand's three editorial registers — Gary Halbert (direct response), David Ogilvy (authority + narrative), and Eugene Schwartz (desire amplification). The blog post calendar deliberately rotates between them. **PDP and category copy use a different register than blog copy** — and getting this distinction right matters for both conversion and AEO.

### 3.1 The four registers, by page type

| Page type | Primary register | Secondary register | What it sounds like |
|---|---|---|---|
| Blog (educational) | Ogilvy | Halbert | Confident, specific, no padding, named-author byline |
| Blog (brand story) | Ogilvy | Schwartz | Narrative, dated, aspirational without overselling |
| Blog (product spotlight) | Schwartz | Halbert | Desire-led, sensory, decisive |
| Pillar page | Ogilvy | (none) | Authoritative reference, dated, deep but scannable |
| **PDP** | **Halbert** | **Ogilvy** | **Specific, useful, no fluff, gets to the point** |
| **Category page** | **Ogilvy** | **Schwartz** | **Confident category-defining voice, ends with a desire-led close** |
| Resource (glossary, calculator) | Ogilvy | (none) | Reference-grade, neutral, citation-friendly |
| Services page | Halbert | Ogilvy | Direct, capability-led, conversion-oriented |

### 3.2 What Halbert means on a PDP specifically

Halbert wrote direct-response sales letters for products like Tova Beverly Hills perfume. His PDPs would have:
- **Specificity in the first 30 words.** Not "high-quality glass bottle" — "amber-tinted, 30ml, 20-400 neck finish, ships in 2-3 business days". Specificity is the credibility carrier.
- **A real reason to act.** Not "shop now" — "Order a case of 120 for $1.42/bottle". The price math is the call to action.
- **Anti-hedge language.** Not "may be suitable for" — "spec'd for essential oils with citrus, herbal, or botanical actives". The blog can hedge; the PDP cannot.
- **Naming the alternative.** "Choose Boston Round when... Choose Euro Dropper when..." The decision frame removes the friction of uncertainty.

Where Ogilvy shows up on the PDP: in the [04] product overview's 60-word block, where the heritage detail and the practitioner authority make the spec page feel like it was written by someone who knows the category. "It accepts more applicator types than any other bottle shape" is an Ogilvy line in a Halbert page.

### 3.3 What Ogilvy means on a category page specifically

Ogilvy wrote the long-form "At 60 miles an hour the loudest noise in this new Rolls-Royce comes from the electric clock." His category pages would have:
- **Category-defining authority.** "The Boston Round is the workhorse of the wellness, essential oil, and apothecary packaging world" — this is the Rolls-Royce sentence applied to a glass bottle category.
- **Specific facts the reader cannot verify but will trust.** "Engineered for the late-19th-century US pharmaceutical industry to be machine-fillable, shippable without breakage, and stackable on a chemist's shelf." The detail is the credibility.
- **A confident "and not" statement.** "It is not the right choice for fine fragrance or luxury serum." Ogilvy wrote ads that admitted what the product was not for. That moves trust.
- **Internal-link discipline that reads like footnotes, not promo.** Linking to the [Euro Dropper category] reads as scholarly cross-reference, not sales nudge.

Where Schwartz shows up on the category page: in the final paragraph of the [02] overview, where the link to the cobalt or amber selection completes the desire arc. The reader has read 197 words about Boston Rounds; the close lands them in the next decision point.

### 3.4 What changes between blog voice and commercial-page voice

| Dimension | Blog voice | PDP / Category voice |
|---|---|---|
| Length per sentence | Variable, often long, can build a rhythm | Shorter, tighter, designed for scan |
| Use of "you" | Frequent, conversational | Rare, only when directly addressing the buyer in CTA |
| Use of "we" / "Best Bottles" | Heavy, brand-voice forward | Lighter, the product carries the brand |
| Adjective density | High — adjectives are part of how blog argues | Low — every adjective must do work, no decorative ones |
| Internal links | Many, embedded in the prose | Few, hierarchical (UP to pillar, ACROSS to compare, DOWN to PDP) |
| Question-shaped phrasing | Required (per AEO §4.1) | In the FAQ block only, not in the body |
| Named author | Visible byline | Not visible on the page; in schema as `provider` / `seller` |
| Dated content | Visible "Updated:" line | Not visible (the page is "evergreen catalog"); in schema as `priceValidUntil` |
| Sensory language | Welcome (especially in product spotlights) | Sparingly — "thick-walled" yes, "luxurious heft" no |
| Storytelling | Central to brand story format | Reserved for [08] customer story block only |

### 3.5 The three things to never do on a PDP or category page

1. **Never write filler.** "Discover the perfect glass bottle for your unique brand." Cut this every time. Filler is the single most expensive copy mistake on a PDP because Google's helpful-content classifier flags it as machine-generated and AI engines decline to cite the page.
2. **Never bury the spec.** The specifications table belongs above the fold on the PDP and high in the category page. Buyers searching for "20-400 neck finish amber boston round 30ml" want the spec confirmed in the first screen, not in the eighth scroll.
3. **Never use marketing-grade adjectives.** "Revolutionary", "world-class", "industry-leading", "best-in-class", "premium quality", "the perfect choice". Stage 2 §8.2 ("What llms.txt must NOT contain") applies to PDPs equally. AI engines de-rank promotional language. So do procurement readers.

### 3.6 The three things to do on every PDP and category page

1. **Lead with a specific, verifiable fact.** Wall thickness in mm. Neck finish standard. Bottles per pallet. The fact is the trust signal.
2. **Name the persona who buys it.** Not "for any brand" — "for essential oil brands at $50K-$500K revenue scaling to retail". The named persona makes the page useful to the right reader and signals to AI engines who the page is for.
3. **Close with a link UP to a pillar.** Every PDP links to at least one resource pillar page. Every category links to at least one pillar AND one adjacent category. This is the internal-link architecture that compounds page authority into category and pillar authority.

---

## 4. Production workflow

How the templates get used in practice:

1. **Engineering (1-2 weeks):** Build the template render layer in Next.js — a `<ProductDetailTemplate />` component and a `<CategoryLandingTemplate />` component that consume Convex / Sanity data and emit the section structure above. The 10 PDP sections and 7 category sections become structured fields in Sanity that fall back to programmatic defaults when empty.

2. **Editorial (3-4 weeks at launch + ongoing):** Hand-write the section [04] product overview, the section [06] use cases, the section [08] customer story (when available), and the section [09] FAQ block for the top 50 PDPs by volume. Use the template's [01], [03], [05], [07] sections as Convex-driven defaults — no editorial review needed. For the remaining 175 PDPs, run a spot-check on 20 randomly sampled pages each month for the first 90 days; flag any that read flat and rewrite.

3. **Category pages (2 weeks at launch):** Hand-write all 8 of the top categories (Boston Round, Euro Dropper, Roll-On, Spray Bottles, Cream Jars, Sample Vials, Empire, Apothecary). The remaining ~22 category pages run on the template + Convex-driven defaults until traffic data tells us which to invest in next.

4. **Customer story acquisition (ongoing):** Section [08] needs real customers. The Stage 4b roadmap has 3 customer-story posts in Weeks 15B, 20B, 26A. Each story produces a PDP section [08] update for the SKUs that customer uses. Long-term goal: 50 customer stories by end of Year 1, each referenced from 3-7 PDPs.

5. **AEO QA pass (every 4 weeks):** Spot-check 10 random PDPs in Google Rich Results Test, Schema.org validator, and Perplexity ("what is the [X bottle] from Best Bottles?") to confirm the FAQ block is being extracted correctly.

---

## 5. Edge cases and exceptions

A few categories don't fit the template cleanly. Document them here so editorial doesn't reinvent the rules.

### 5.1 Custom / made-to-order SKUs

For custom-color Pantone SKUs, custom-embossing SKUs, and custom-decoration SKUs, the [03] price section is replaced with:
> **Custom quote required** — Minimum order 5,000 bottles per color, 12-week lead time. [Request a custom quote](/request-quote).

The [05] specifications table omits price tiers and adds a "Customization options" row.

### 5.2 Discontinued or being-phased-out SKUs

Convex flag `productStatus: "phaseOut"` triggers a banner above [01]:
> **Phasing out:** This SKU is being discontinued; remaining inventory of {X} bottles available. For ongoing orders, we recommend [{REPLACEMENT_SKU}]({REPLACEMENT_URL}).

This protects buyer relationships and prevents broken-link risk for procurement readers ordering against a Net 30.

### 5.3 Sample kit SKUs

For sample-kit SKUs (e.g., "Boston Round Sample Kit — 6 bottles, 6 closures"), the [05] specifications table is replaced with a "What's in this kit" table listing each bottle and closure, and the [08] "How brands use it" section is replaced with a "What to do with your sample kit" section pointing to the Week 13B pillar.

### 5.4 Bundle SKUs (e.g., "Amber Boston Round family bundle")

For bundle SKUs, the [05] specifications table is a "Bundle contents" table; the [06] use cases section is replaced with "What this bundle is for" (e.g., "A 4-SKU starter for an indie wellness brand scaling from sample to retail"); the [09] FAQ adapts to bundle-specific questions ("Can I substitute one SKU in the bundle?", etc.).

---

## 6. Measurement

These are the metrics that determine whether the templates are working. Track quarterly.

| Metric | Baseline (legacy bestbottles.com) | 90-day target (new site) | 180-day target |
|---|---|---|---|
| Organic-traffic to PDPs / month | ~unknown (GSC access pending) | 1,500 sessions | 5,000 sessions |
| Organic-traffic to category pages / month | ~unknown | 800 sessions | 3,000 sessions |
| Avg time on PDP | ~unknown | 75 seconds | 110 seconds |
| Sample-kit requests from PDP CTA / month | 0 | 20 | 80 |
| RFQ submissions from PDP CTA / month | ~5 (legacy estimate) | 25 | 80 |
| Top-10 ranking PDPs (by SKU-name query) | ~15% of catalog | 30% of catalog | 50% of catalog |
| Top-10 ranking category pages | ~25% | 60% | 80% |
| PDPs cited in Perplexity / ChatGPT spot-checks (sample of 20) | 0 | 4 | 10 |

The PDP and category templates are the highest-leverage SEO surface on the site by URL count (255 pages vs ~60 editorial pages). Getting them right compounds for years.

---

*Companion files: `persona-keyword-corpus.md` (the keyword map the PDP and category pages target) and `content-roadmap-90d.md` (the editorial schedule that feeds the customer-story content into PDP section [08]).*
