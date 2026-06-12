# Legacy site fetch — bestbottles.com homepage

**Fetched:** 2026-05-23
**URL:** https://www.bestbottles.com/
**Status:** 200 OK
**Content-Type:** text/html; charset=UTF-8

## Head signals captured

- **Canonical:** `https://www.bestbottles.com/`
- **Title:** "Glass Bottles and containers for Perfumes Wholesale, Perfume atomizer, Sprayer, Mister, Roll on bottles, Roller bottles, perfume vials, Lotion bottles, treatment pumps and cream jars, velveteen gift bags and boxes, Aluminum bottles." (272 chars — way over the ~60 char recommendation, keyword-stuffed)
- **Meta-description:** Long (~600 chars) but reads like a list, not a value prop. Mentions every product type. Will be truncated in SERPs.
- **Meta-keywords:** Present and stuffed (~400 chars). Deprecated for Google but signals editorial intent.
- **Google Site Verification token:** `laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc` — **MUST be transferred to GSC for the new site at launch**
- **Bing Webmaster verification token:** `DD2ECFD7F20F418A4A67662DFC0D0B03` — same
- **Meta-revisit-after:** 30 days (deprecated, Google ignores)
- **Viewport:** width=device-width (good — mobile-ready meta)
- **Copyright footer:** "Nemat International®, Inc. Copyright 2020" — site hasn't been visually refreshed since 2020

## URL structure (legacy → indicates redirect-map complexity)

All product URLs use `.php` extension under deep folder structure:
- `/all-bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php`
- `/all-bottles/Perfume-atomizer-aluminum-bottle-cans/bestbottles-metal-shell-perfume-atomizers.php`
- `/all-bottles/accessories/velvet-bags-organza-gusseted-bags-wedding-favor.php`
- `/all-bottles/lotion-pump-cream-jars/lotion-pumps-bottles.php`
- Subcategory pages use querystrings: `?subcat=64`, `?subcat=65`, etc.

**Implication:** Every legacy `.php` URL needs a redirect map entry. Querystring-driven subcat pages are a Google indexation problem.

## Information architecture (the legacy taxonomy that's currently ranking)

1. **Perfume vials, Bottles, Roll on bottles and Decorative glass Bottles**
   - Perfume Vials and Perfume Bottles → Vials/Tubes With Caps & Droppers, Classic Glass Bottles, Boston Round
   - Roll on Bottles → 4 capacity bands (4-6ml, 8-10ml, 12-15ml, 1oz+)
   - Small Decorative Perfume Bottles → Keychain Caps, Tassel Caps, Octagonal, Glass Stopper
   - Large Decorative + Apothecary Style
   - Metal & Beads Decoration
2. **Perfume Atomizers, Sprayers, Aluminum Bottles & Cans**
   - Metal Shell Atomizers, Fine Mist Sprayers (glass), Brushed Aluminum, Plastic Spray, Classic Spray, Antique Bulb Spray
3. **Perfume Accessories & Packaging**
   - Funnels & Droppers, Velveteen/Organza Bags, Gift Boxes, Reclosable Plastic Bags & Shipping Boxes, Caps/Plugs/Sprayers
4. **Cream Jars and Lotion Bottles**

## Faceted nav — 8 filter dimensions on the catalog

- Capacity (ml + oz, multiple bands)
- Material (Glass, Plastic, Aluminum, Paper, Fabric)
- Color (Glass: Clear/Blue/Black/Green/Amber/Frosted; Plastic; Aluminum)
- Shape (Rectangular, Round, Heart, Boston Round, Leaf, Decorative, Circle, Octagonal, Cylinder, Square, Pear, Fancy, Special, Triangular)
- Applicator (Dab/Splash, Plastic Roller, Metal Roller, Glass Stopper, Spray/Atomizer, Vintage Bulb, Dropper-Rubber, Treatment Pump, Lotion Pump, Rod, Reducer, Lotion/Ointment)
- Lid Color (~32 options)
- Recommended by Use (Cologne, Perfume, Essential Oil, Cream Jar, Lotion, Sample, Travel, Gift, Valentine, Party Favor, After Shave, Air Freshener)
- Accessories (Bags, Boxes, Droppers, Caps, Sprayers, Funnel + 13 color options)

**Implication:** This is a faceted-nav SEO indexation problem on the new site. Without strict canonical + noindex rules on filter combinations, the new site will have massive crawl waste (potentially millions of filter URL combinations).

## Cross-domain ecosystem

Legacy site explicitly links to:
- `www.NematInternational.com` — parent company / wholesale fragrances/essential oils
- `glassbottles.com` — sister site for bottles
- LinkedIn: `linkedin.com/in/best-bottles-0b0160201/`, `linkedin.com/company/best-bottles-wholesale`
- Facebook: `facebook.com/NematBestBottles`
- Twitter/X: `twitter.com/Best_Bottles`
- Faire wholesale marketplace: `faire.com/brand/b_bzqsxpr4yl`

**Implication:** External brand graph and backlink profile likely concentrates around `bestbottles.com` as the brand domain. Moving to `bestbottles.company` would mean retraining the brand graph.

## Anti-patterns found (will be fixed by the rebuild)

- JavaScript-driven CTAs: `javascript:weshipworld()`, `javascript:loadsendsuggestion()` — bad accessibility, won't be indexed
- Multiple modal popups with placeholder text ("Some text in the modal")
- "Copyright 2020" in footer — looks abandoned
- Title stuffed with 14+ product categories — Google will rewrite it
- Subcat-driven querystring URLs likely creating duplicate content

## Conversion / contact signals (good — preserve these)

- Phone: 1-800-936-3628 (toll-free), 1-510-445-0300 (direct)
- Fax: 1-510-751-4980
- Email: sales@nematinternational.com
- Address: 34135 7th St, Union City, CA 94587, USA
- Hours: M-F 9:30 AM to 5:30 PM PST
- $50 minimum purchase
- Worldwide shipping (Canada, UK, Australia, Japan, Singapore)
- 128-bit secure checkout
- Downloadable PDF catalog at `/bestbottles-compressed.pdf`

## Schema / structured data presence

**None detected in the head** — no Organization, no LocalBusiness, no Product schema, no BreadcrumbList. This is a major opportunity for the new site to leapfrog.

## What this fetch tells us about the redirect map

Domain change scenario: every URL above needs an entry. Conservative estimate:
- 4 top-level category landing pages
- ~30 subcategory pages with `?subcat=` querystrings
- 106 product pages (from MASTER-PRODUCT-LIST-README.md)
- ~10 informational pages (FAQ, Contact, Filling/Capping, Personalize, etc.)
- 1 PDF catalog download

= **~150 URL entries minimum** for the redirect map, before accounting for legacy SKU codes or deep-product permalinks.
