# How the market writes product information

Research for the product copy strategy (`COPY-STRATEGY.md`) · 2026-09-26

## Method

Four research agents read live pages with Firecrawl on 2026-09-26. Everything was read-only: no accounts were created and no forms were submitted.

| Channel | What was read |
|---|---|
| Supplier websites | 28 product pages across 14 glass-packaging and perfume-bottle suppliers |
| Amazon | 8 search-result pages (298 titles), 19 product pages, 7 Seller Central rule pages |
| Etsy | 24 listings, 3 market pages, 5 official Etsy seller pages |
| Faire and Google | 6 Faire help articles, 11 Faire product and brand pages, 8 Merchant Center pages, 4 Search Central pages |

Quotes are verbatim. Beverage-related uses some listings mention have been left out under the brand voice guardrails.

---

## 1. What every channel agrees on

These points hold on suppliers' own sites, Amazon, Etsy, Faire and Google alike:

1. **Lead with what the item is and its size.**
   - Etsy: "Include the most important traits upfront, like your item's color, material, and size."
   - Google: put the most important details first, because users "usually notice only the first 70 or fewer" characters.
   - Suppliers: nearly every title starts with capacity.
2. **Keep titles short and plain.**
   - Amazon: 75 characters (from July 27, 2026).
   - Faire: 60 characters hard limit, 35–50 recommended.
   - Etsy: "Consider using less than 15 words."
   - Google: 150 characters maximum.
   - All four ban promotional or subjective words in titles.
3. **Separate the facts from the pitch.**
   - Amazon's bullets are "Header: description" fragments.
   - Etsy: "Put essential information at the top, such as sizes, dimensions, colors… and end on… your product's story."
   - Faire: 3–10 bullets covering "materials, dimensions, weight, where the product is made… and how the product is packaged", because retailers copy the description into their POS.
4. **Keep price, shipping and promotions out of titles and descriptions.** Google, Faire, Amazon and Etsy all prohibit or discourage it.
5. **Only make claims you can verify.** The riskiest claims in this category are leak-proof, "TSA approved", "FDA approved", unqualified UV protection, BPA-free on glass, shatterproof, and "premium" or "luxury".

**Where Best Bottles can stand out.** Almost nobody publishes fit. On Amazon, only 1 of 19 top listings names a neck finish. No Etsy seller publishes a matching-components list; they write "message us". Only the trade suppliers (O.Berk, Berlin, Bottlestore) list "Closures that match this Container". Best Bottles' Fits bullet and neck-finish data already do this.

---

## 2. Supplier websites

### Titles

**Dominant formula:** `[Capacity + unit (second unit)] [Colour] [Material] [Shape or family] [Bottle/Vial/Jar] [with fitment + closure colour] [- neck finish] [(pack)]`. Titles run 37–90 characters, most 55–65.

| Supplier | Title | Characters |
|---|---|---|
| Specialty Bottle | "10 ml Roll-on Top Amber Glass Bottle with Ball & White Cap" | 58 |
| Specialty Bottle | "2 oz Clear Boston Round Glass Bottle with White Atomizer" | 55 |
| Bottlestore | "1oz (30ml) Amber Boston Round Glass Bottle - 20-400 Neck" | 56 |
| Fillmore | "1 oz Amber Boston Round 20-400 Finish" | 37 |
| Burch | "1 oz Glass Amber Boston Round Bottle - 20/400 Finish (Case of 24)" | 65 |
| Berlin | "2.7 Dram (10 ml) Amber Glass Vials with Stainless Steel Roller Ball & Black PP Cap" | 82 |
| Bulk Perfume Bottles | "1.7 oz (50ml) Deluxe Flint Square Clear Glass Bottle (Heavy Base Bottom)" | 72 |

**Closures follow their own pattern and lead with the neck finish:** Berlin "20-400 Black PP Plastic Fine Mist Sprayers", Burch "20-400 2oz White Glass Dropper".

**What goes wrong:**
- Keyword stuffing: SKS "10 ml Glass Bottles, Clear Glass 10 ml Roll on Containers w/ Ball & Caps".
- Dimension-only names: SKS "41 mm x 8 mm, Black Cap w/ Applicator Clear Glass Perfume Sampler Vials".
- All caps: O.Berk "GLASS BOTTLE: 1OZ Amber GLASS BOSTON ROUND WITH 20-400 NECK FINISH".
- A disclaimer inside the title: Container & Packaging "(test for product compatibility)".

### Descriptions

A typical description is 60–150 words:

1. What it is.
2. What the glass colour does.
3. A compatibility sentence naming the neck finish.
4. Uses.
5. What is included or sold separately.

Most add 3–6 feature bullets. The good "what's included" lines are specific:
- Specialty Bottle: "include all four components: 10ml amber glass bottle, plastic housing, roller ball and glossy white cap."
- Berlin: "Vials come complete with stainless steel roller ball, PP plastic housing and black PP screw top cap. Assembly required."
- Fillmore: "Closures are sold separately. Bottles are sold by case quantity."

### Spec fields

- Capacity
- **Overflow (brimful) capacity** (O.Berk "36.20 ml", Bottlestore "126.8cc")
- Neck finish
- Height and diameter, in mm and inches, with tolerances
- Material ("Type III")
- Colour and shape
- Weight in grams
- Case pack and pallet quantity
- Label panel
- A drawing or spec PDF

Berlin adds a one-line definition on each field. For Neck Finish: "used to determine the type of cap or closure that is compatible".

### Claims, and how the careful suppliers word them

- **Berlin:** "Provides varying degrees of protection from UV light. Test to ensure packaging meets product protection requirements."
- **Berlin:** "Must be used with cap provided to ensure leakproof performance."
- **Berlin:** "BPA NI: Bisphenol A was not intentionally used in the manufacture of this item."
- **Risky:** SKS's "FDA Approved" badge. The FDA does not approve packaging.

### Data errors to design against

Every one of these appeared on a competitor page:
- SKS lists neck finish 20/400 but cap size 20/410 on the same page.
- O.Berk says "Fit most 18-400… caps" on a 20-400 bottle.
- Cary lists the same bottle as "1/2 oz." and "0.45 oz.".
- Container & Packaging shows a 10 ml bottle weighing "626.72 oz".
- A Bulk Apothecary reviewer received rollers without balls, although the description said they were included.

Sources are listed in §7.

---

## 3. Amazon

### Rules

Sources: Seller Central GYTR6SYGFA5E3EQC, GX5L8BF8GLMML6CX, GLG4RQK2Y2RJADU4, G200390640, G202024200.

- **Title:** 75 characters maximum from July 27, 2026. Titles still over the limit are being rewritten by Amazon's AI, with 14 days for the brand owner to review.
  - No promotional words, no ALL CAPS, and no word repeated more than twice.
  - Banned characters: `! $ ? _ { } ^ ¬ ¦`.
  - Size and colour go in the child titles.
- **Item highlights:** a new 125-character, comma-separated line shown under the title.
- **Bullets:**
  - At least three, written "Header: description".
  - Fragments, with no end punctuation.
  - A space between number and unit ("60 ml").
  - No guarantees, "eco-friendly", "anti-bacterial", "w/", "approx.", or claims that can't be verified.
- **Description:** about 2,000 characters, with no URLs or prices.
- **A+ content:** paragraphs of three sentences or fewer, and no guarantees or comparisons.

### What the top listings do

- **Title format:** 134 of 298 search results already show a short bold title with a highlights line under it. The dominant 75-character title is `[Brand] [pack] [capacity] [colour] Glass [noun] [with closure / for use]`. Examples:
  - U-Pack (Amazon's Choice, 4.8★): "U-Pack 4 oz Amber Glass Boston Round Bottles With Black Ribbed Cap - 12 Pack"
  - DropperStop (4.7★, 13.1K ratings): "DropperStop 1oz Amber Glass Dropper Bottles (30mL) with Tapered Glass Droppers - Pack of 2"
  - Mavogel (4.6★, 10.3K ratings): "Mavogel 24 Pack 10ml Roller Bottles for Essential Oils", with the highlights line "Amber Glass with Stainless Steel Roller Balls, …"
- **Word frequency across the 298 titles:**
  - perfume 79%, refillable 68%, travel 62%, empty 53%, essential oil 52%
  - leak-proof 22%, sample 19%, dropper 19%
- **Bullets:** five is typical, each 150–250 characters. The usual order:
  1. What's included
  2. Material or UV
  3. Seal
  4. Size or travel
  5. Uses
- **Specs are rare.** Dimensions appear in 7 of 17 listings with bullets, and a neck finish in only 1: DropperStop, "Neck: 20-400".

### What reviews complain about

Amazon's "Customers say" summaries show:
- **Leakage is the most disputed aspect.** Vivaplex has 267 positive vs 252 negative mentions, Mavogel 141 vs 154, Yamadura 156 vs 612.
- **Rollers:** balls fall out or stick.
- **Caps:** they don't screw down.
- **Droppers:** pipettes break.
- **Sprays:** sprayers don't work, or their tops break.

### Claims to avoid, from the evidence

| Claim | Why |
|---|---|
| "100% leak-proof" | The reviews dispute it. |
| "TSA approved" | TSA does not approve products. Say "under 100 ml". |
| "UV protection" on clear or frosted glass | Misleading; only amber filters meaningfully. |
| Shatterproof, "thick" | Contradicted by breakage reviews. |
| BPA-free on glass | Doesn't apply to glass. |
| Guarantees | Prohibited. |
| Designer comparisons | One listing was summarised as "replicas of" a designer line. |

---

## 4. Etsy

### Rules

- **Titles** (Seller Handbook 1399426136697, "New Guidance for Listing Titles", April 2026):
  - "Clearly state the item for sale."
  - "Include the most important traits upfront, like your item's color, material, and size."
  - "Consider using less than 15 words."
  - "Move subjective words, like 'perfect' or 'beautiful,' to the description."
  - "Try not to repeat words."
- **Keywords 101** (382774281517): "Where a phrase is used in your title doesn't affect a listing's ranking." Use all 13 tags, as multi-word phrases. "Attributes act like tags."
- **Help Center SEO article:** "A person should be able to read the first sentence and know exactly what you're selling."
- **Classification:** bottle suppliers are "Sourced by a seller" (craft supplies).

### What the top listings do

- **Short, compliant titles.** Examples:
  - "Amber Glass Sample Vials: 1 Dram Travel Bottles with Orifice Reducer" (CountryFolkSoap, about 9.5K reviews)
  - "6ml Glass Attar Bottle with Gold Cap – Perfume Oil Container"
  - "Clear Glass Roller Bottle, Black Cap - 10ml Essential Oil, Perfume"
- **Older keyword stacks are now discouraged.** Example: "PERFUME SPRAY ATOMIZER, Diamond Shape 2 oz.(60 ml) Refillable Cologne Bottle, Leak Proof Bottle, Luxury Perfume Bottle, Travel (Qty 1,2,3)".
- **The best description** (AvalonSomerset):
  - Opening: "These 10ml amber glass roll-on bottles are ideal for filling with your own essential oil blends…"
  - What's included: "Each bottle is supplied empty and includes a smooth steel roller ball… plus a smart black urea screw cap."
  - Then Approximate Dimensions (capacity, neck size, height with cap in mm and inches, diameter), Suggested Uses, and a Please Note block: "Bottles are supplied empty… Please test your chosen product or formulation for compatibility before filling in larger quantities."
- **Variations are attribute-first:** "Cap: Matte Gold, Matte Rose Gold, Shiny Black…", "Choose your ROLLERBALL INSERTS: Plastic/Resin, Stainless Steel", "Pack of 1/3/5/10/25".
- **Search vocabulary:** empty perfume bottle, refillable fragrance bottle, attar bottle with stick, 1ml sample bottles, fragrance decants, vintage perfume bulb atomizer.

---

## 5. Faire

### Best Bottles is already live on Faire

- **Shop:** https://www.faire.com/brand/b_bzqsxpr4yl. Best Bottles, Union City, CA, rated 4.8 from 92 reviews, with 20 live listings (rechecked 2026-09-26; the first pass counted 13). The page also shows ten "Purchased product" entries from reviews, which are past listings.
- **The current names are inconsistent:**
  - "Tall Clear Cylinder Glass Bottle with Metal Roller Ball-9ml"
  - "Tulip Amber Glass Bottle with Sprayer - 5ml(Multiple Colors)"
  - "Boston Round Amber Bottle - 30ml (Multiple Dropper Colors)"
- **Descriptions** reuse the legacy text, about 200 characters, with no dimensions, neck finish or case pack.
- **"Made in: United States"** appears on every listing. Public import records for Nemat International point to China (177 of 221 sea shipments); see COPY-STRATEGY.md 7.4.

### Rules

Sources: Faire Help Center 360006829831, 4406014305307, 53978316217755, 35169424923291.

- **Product name:**
  - The name is the title, with a hard limit of 60 characters. 35–50 is recommended.
  - Title case, no SKU.
  - No promotional or subjective words ("bestseller"), no special characters.
  - Faire adds "Wholesale" itself, so never put it in the name.
- **Description:**
  - 1,000 characters maximum, ideally 150–300 plus 3–10 bullets.
  - Include materials, dimensions, weight, origin and packaging.
- **Options and ordering:**
  - Up to three options (Color, Material, Size…), kept inside one listing.
  - Sold by the item or by the case; there are no per-option minimums.
- **"Made in"** must follow U.S. Customs and Border Protection country-of-origin rules.

### The strongest competitor model

The Bottle Shoppe's spec block: "Total Height: 3" • Material: Glass • Color: Amber • Base Diameter: 1.25" • Style: Boston Round • Capacity: 1 oz. • Neck Finish: 20-400".

---

## 6. Google

- **Merchant Center title** (6324415):
  - Up to 150 characters, with the important details in the first 70.
  - It must distinguish variants.
  - No price, promotion, shipping, company name, ALL CAPS or symbols. A brand is allowed only when it differentiates.
  - Titles written by generative AI must be sent as `structured_title` with the AI flag.
- **Merchant Center description** (6324468):
  - Up to 5,000 characters, with the key details in the first 160–500.
  - Product only: no policies, links or price.
- **Variants in the feed** (6324507, 17085214):
  - `item_group_id` plus a shared `item_group_title`.
  - `variant_option` name:value pairs, plus the standard color, size and material attributes.
  - Each variant needs its own URL.
  - Differences no attribute covers, such as thread fit, go in the title and description (6231538).
- **Structured data** (Search Central, product-variants):
  - `ProductGroup` with `productGroupID`, `variesBy` and `hasVariant`.
  - `variesBy` supports only color, size, material, pattern, suggestedAge and suggestedGender.
  - Each variant needs a unique `sku` and a more specific name.
  - The markup must be in the initial HTML.
- **Title link:** descriptive and concise, with the site name at the start or end after a delimiter.

The site has no Google Shopping feed today. Its structured data is a single `Product` per page, with no colour, material or variant grouping.

---

## 7. Sources

**Supplier websites**
- sks-bottle.com/product/305329.html, /360.html, /536.html, /301034.html
- specialtybottle.com: /glass-bottles/roll-on/10ml-rola10w, /glass-bottles/vials/perfume-sampler-perf, /glass-bottles/clear-boston-rounds/2oz-atomizer-brf2aw
- berlinpackaging.com: /2-7-dram-10-ml-amber-glass-vials-with-stainless-steel-roller-ball-black-pp-cap-3123b69/, /1-oz-amber-glass-boston-round-bottles-value-pack-4699b03valabr/
- shop.qorpak.com/products/GLC-02004/
- oberk.com/containers/glass/glass-bottle/55220013--1oz-amber-boston-round-glass-bottle---20-400-neck
- bottlestore.com: /4oz-flint-rio-round-glass-bottle-20-415-neck.html, /1oz-amber-boston-round-glass-bottle-20-400-neck.html
- fillmorecontainer.com/1-oz-amber-boston-round-20mm.html
- burchbottle.com: /20-400-2oz-Glass-Dropper-White, /1Oz-Amber-Boston-Round-20-400
- thecarycompany.com/1-2-oz-amber-boston-round-glass-bottle-18mm-18-400
- containerandpackaging.com/products/glass-roller-ball-bottle/g802am/
- bulkapothecary.com/10ml-glass-roll-on-bottles-with-caps/
- packamor.com/products/perfume-bottles-50ml-cube-gold
- bulkperfumebottles.com/1.7-oz-50ml-bottles/

**Amazon**
- Search pages (amazon.com/s?k=): 10ml glass roller bottles; amber glass dropper bottles 1 oz; glass perfume spray bottle 30ml refillable; perfume atomizer travel refillable; 2ml glass perfume sample vials; 4 oz amber boston round bottles; glass perfume bottles empty 50ml; essential oil roller bottles with stainless steel balls
- Product pages (amazon.com/dp/): B0B9GHVLDK, B08NPTZ554, B079FNHY4B, B013SJWE2G, B0BGH3VNXB, B07ZNK3ZDJ, B073SHXGT5, B07S3HF688, B07PYG4HSZ, B099D9PCR2, B09195K34L, B019RPN1N6, B07DX3TNRP, B01M2AX8MR, B07794BDKD, B08YYHHXQ9, B0BX2YB1SH, B08CXGR6L3, B0BWQKJ27N
- Seller Central (sellercentral.amazon.com/help/hub/reference/external/): GYTR6SYGFA5E3EQC, GX5L8BF8GLMML6CX, GLG4RQK2Y2RJADU4, G200390640, G202024200, GNYWHX2TP7C8GXHK

**Etsy**
- Official: etsy.com/seller-handbook/article/1399426136697; etsy.com/seller-handbook/article/keywords-101-everything-you-need-to-know/382774281517; etsy.com/seller-handbook/article/1347574487014; help.etsy.com/hc/en-us/articles/115015663987
- Listings (etsy.com/listing/): 1872315233, 4530242262, 1542948545, 1754401042, 1841920825, 4388744846, 1704072845, 1652851333, 1809714142, 1354295645, 666160525, 1323724076, 882705426, 725983294, and 11 more in the agent's notes
- Market pages (etsy.com/market/): empty_perfume_bottle, attar_bottle, vintage_perfume_bulb_atomizer

**Faire**
- Help Center (faire.com/support/articles/): 360006829831, 53978316217755, 4406014305307, 35169424923291, 360016568092, 49078266410779
- Brand page: faire.com/brand/b_bzqsxpr4yl
- Product pages (faire.com/product/): p_4tep4846yu, p_4vmy5rdxnx, p_w3ysvy23x2, p_fvzsnuyc7b, p_pbgnfqjhrx, p_3hktb82445, p_mhezxxv9xr, p_wd5f432a3a

**Google**
- Merchant Center (support.google.com/merchants/answer/): 6324415, 6324468, 6324507, 17085214, 7348545, 6323982, 6231538
- Search Central (developers.google.com/search/docs/): appearance/structured-data/product-variants, appearance/structured-data/merchant-listing, appearance/title-link, specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites
