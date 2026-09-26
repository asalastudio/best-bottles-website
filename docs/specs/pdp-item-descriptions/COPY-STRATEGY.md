# Product copy strategy: titles, descriptions and all product wording

Status: **locked 2026-09-26** (Best Bottles approved sections 1–9 and decisions 1, 2, 4 and 5). The ounce rule in 2.1 is a recommendation still awaiting sign-off; the Faire "Made in" value is under investigation (7.4).

**Companion files in this folder:**

- `TEMPLATE.md`: the item description format (locked).
- `RUBRIC.md`: which uses, guards and claims each product type may carry.
- `market-research.md`: what suppliers, Amazon, Etsy, Faire and Google do and require, with sources.
- `community-research.md`: what buyers ask on Reddit.
- `../print-collateral/PRINT-PLAN.md`: the printed catalogue, line booklet and family inserts, built from the same record.
- `SYNTHESIS.md`: the 23 September neck-thread sheets and the component register reconciled with this standard; decisions D1–D7.

---

## The short version

1. **One name, built once, used everywhere.** Today the same bottle carries three names: the page headline, the meta and catalogue name, and the Shopify name. One naming function replaces all three.
2. **Title formula: `{Capacity} {Glass} {Family} {Type}`.** For example, "9 ml Amber Cylinder Roll-On Bottle".
   - Capacity comes first, as it does with nearly every supplier.
   - There is no brand, no pack count and no promotional word.
   - Titles are 60 characters or less, which is Faire's hard limit. All 2,113 bottles fit. The longest, "100 ml Frosted Elegant Vintage Bulb Spray Bottle with Tassel", is exactly 60.
3. **Variant name: `{Title} - {Variant label}`.** For example, "9 ml Amber Cylinder Roll-On Bottle - Steel Ball, White Cap".
4. **Item description: the locked format.** Two or three sentences, then Included, Fits and Glass, plus Good to know when there is an extra verified fact. See `TEMPLATE.md`.
5. **The Tech Sheet carries the specs; the buy box carries commercial facts.** Price tiers, case pack, minimums and lead times never appear in titles, descriptions or meta text. Google, Faire, Amazon and Etsy all require this.
6. **A controlled vocabulary and a claims policy.** The same word always means the same part. No claim is made that can't be verified.
7. **Every channel is derived from the same record:**
   - the product page, meta tags and structured data
   - Shopify
   - the live Faire shop
   - a Google feed
   - Amazon and Etsy, if Best Bottles ever lists there
   - print: the catalogue, the line booklet and the family inserts (`../print-collateral/PRINT-PLAN.md`)

---

## 1. What exists today

| Surface | Built by | What it says for one reducer bottle |
|---|---|---|
| Page headline (H1) | `pageTitle()`, `src/lib/products/pdp-redesign/model.ts` | "100 ml Clear Circle Splash-On Bottle" |
| Browser title, Open Graph, breadcrumb, structured-data name, catalogue cards, cart lines, Grace tiles, image alt text | `getCustomerFacingProductName()`, `src/lib/products/customer-facing-names.ts` | "100 ml Clear Circle Reducer Bottle - Pink Leather Cap" |
| Meta description, structured-data description | `chooseCanonicalProductDescription()`: legacy group text, else legacy item text | Old bestbottles.com wording |
| Item type line | Legacy category text | "Classic Glass Bottles With Attractive Caps" |
| Item description | `data/descriptions/pdp/item-descriptions.json` | 76 words; being replaced by the locked format |
| Shopify title and body | `scripts/push_convex_to_shopify.mjs`: `displayName`, `groupDescription` | "Circle 100ml Clear" |
| Faire (live, 20 listings) | Typed by hand | "Clear Circle Glass Bottle with Metal Roller Ball - 15ml" |
| Structured data | `buildProductJsonLd()`, `src/lib/seo.ts` | One `Product`; no colour, material or variant grouping |

**What goes wrong:**
- **Fine-mist sprayers and perfume spray pumps get the same meta name,** "Perfume Spray Bottle".
- **Bulb sprayers read differently in different places:** "Spray Bottle" in the headline, "Vintage-Style Bulb Sprayer Bottle" in the meta.
- **The meta description uses legacy text** that is often truncated.

---

## 2. Controlled vocabulary

The same word always means the same thing, on every surface.

### 2.1 Numbers and units

| Item | Write | Never |
|---|---|---|
| Capacity | "9 ml" (space, lowercase) | "9ml", "9 mL", "9 ML" |
| Ounces in titles | Millilitres first, always. Ounces in brackets only on sizes buyers name in ounces: Boston rounds at 15, 30 and 60 ml ("15 ml (0.5 oz)", "30 ml (1 oz)", "60 ml (2 oz)") and the standard ounce sizes 118 and 120 ml "(4 oz)", 227 ml "(8 oz)", 355 ml "(12 oz)" and 454 ml "(16 oz)". Not 128, 250 or 500 ml, which are metric sizes. *Recommendation; see 2.1.1.* | "1/2oz", "3 1/2oz", "1 oz (30 ml)" |
| Ounces in the Google feed | Always, from a rounding table ("9 ml (0.3 oz)", "50 ml (1.7 oz)"), never from the computed Convex value "1.01 oz" | |
| Overlong titles | If a title passes 60 characters, drop the ounce bracket first | |
| Drams | Vials the catalogue names in drams: "1 Dram (4 ml)", "5/8 Dram (3 ml)" | "dram" without the ml |
| Neck finish | "18-415", with a hyphen | "18/415", "18mm", "18-415mm" |
| Dimensions | In the Tech Sheet only, in mm; inches in brackets, once added | Anywhere in titles or descriptions |

#### 2.1.1 Why this ounce rule (research, 2026-09-26)

**What Best Bottles does today:**

| Surface | Pattern | Example |
|---|---|---|
| Legacy site names (2,285) | Both units, ml first, on 1,962; ml only on 106 | "Boston round design 30ml, 1oz…" |
| Legacy URLs | ml, except Boston Round and Diamond in oz | `diamond-design-2-oz-…` |
| Convex capacity field | ml, then computed oz | "30 ml (1.01 oz)" |
| New site headline | ml only | "25 ml Clear Cylinder Fine Mist Spray Bottle" |
| Faire (20 listings) | ml only, no space, at the end | "Boston Round Amber Bottle - 30ml (Multiple Dropper Colors)" |
| 2020 print catalogue | ml, with oz for Boston rounds and 4 oz | "Capacity: 15ml - 2oz", "Capacity: 4oz" |

**What the trade does:** the unit follows the mould. Boston rounds are sold in ounces (SKS "1/2 oz Amber Glass Boston Round Bottles", Specialty Bottle "1 oz Amber Boston Round Glass Bottle with Dropper", Premium Vials "1/2 oz (15ml) AMBER Glass Boston Round Bottle"); roll-ons, perfume bottles and vials in millilitres (SKS "10 ml Glass Bottles…", Specialty Bottle "10 ml Roll-on Top Amber Glass Bottle"). Uline writes ounces on everything. On Amazon, 62% of 298 competitor titles are ml only, 30% give both and 7% oz only; "1 oz amber dropper bottle" results lead with oz (13 of 14), "10 ml roll on bottle" results with ml (27 of 28). Google and Amazon set no unit preference; Amazon asks for a space ("60 ml").

**So:** ml first keeps one pattern across 2,113 bottles and matches Best Bottles' own legacy names; the ounce bracket on Boston rounds and standard ounce sizes carries the words those buyers search. Putting ounces on every title would push 18 names past Faire's 60 characters.

### 2.2 Glass and material

**Write:** Clear, Frosted, Amber, Cobalt Blue, Swirl, Green, Pink, Black, Aluminum, Plastic.

**Never:** "Flint" (a trade word for clear), "Blue" on its own (always "Cobalt Blue"), "Crystal", "Luxury".

### 2.3 Family names

These are the catalogue's own family names:

Cylinder, Tall Cylinder, Circle, Round, Elegant, Boston Round, Diva, Empire, Slim, Sleek, Diamond, Grace, Tulip, Bell, Rectangle, Square, Royal, Flair, Pillar, Teardrop, Apothecary.

- "Tall Cylinder" is the 9 ml Cylinder on the 13-415 neck. "Cylinder" alone covers the 17-415 family.
- Vials, cream jars and atomizers carry no family word.

### 2.4 Type nouns (the end of every title)

| Mode (RUBRIC.md) | Title noun | Notes |
|---|---|---|
| ROLL | Roll-On Bottle | |
| MIST | Fine-Mist Spray Bottle | |
| PUMP-SPRAY | Perfume Spray Bottle | |
| BULB | Vintage Bulb Spray Bottle | Locked 2026-09-26. The tassel version is "Vintage Bulb Spray Bottle with Tassel" (tassel groups are separate pages, so the tassel stays in the title). All 478 fit in 60 characters; the longest is exactly 60. "Vintage-Style" would push 194 past the limit, so the description's sentence 1 says "vintage-style" instead. |
| SPLASH | Pour Bottle with Reducer | Best Bottles' naming |
| POUR | Pour Bottle | Every glass bottle sold with only a screw cap |
| DROP | Dropper Bottle | |
| PUMP-LOTION | Lotion Pump Bottle | |
| STOPPER | Bottle with Glass Stopper | Apothecary family: "Apothecary Bottle with Glass Stopper" |
| DAB | Sample Vial with Glass Rod | The 9 ml glass-rod vial |
| VIAL | Vial | Never with a family word ("Vial Vial") |
| JAR | Cream Jar | |
| ATOMIZER | Travel Atomizer | |
| STOCK | Stock Bottle | Cap-only plastic and aluminum over 100 ml |

### 2.5 Part and finish names

These are used in variant labels and in the Included bullet.

| Part | Variant label | Included bullet |
|---|---|---|
| Roller | "Steel Ball" or "Plastic Ball" | "Steel roller ball", "Plastic roller ball" |
| Fine-mist sprayer | "{Finish} Sprayer" | "{Finish} fine-mist sprayer" |
| Perfume spray pump | "{Finish} Pump" | "{Finish} perfume spray pump" |
| Bulb sprayer | "{Finish} Bulb", adding "and Tassel" for tassel versions | "{Finish} bulb sprayer" |
| Dropper | "{Finish} Collar" | "Glass pipette dropper, rubber bulb and {finish} collar" |
| Lotion pump | "{Finish} Pump" | "{Finish} lotion pump" |
| Screw cap | "{Finish} Cap"; "Short" or "Tall" when both heights are sold | "Short {finish} lined cap" (13-415); "Short {finish} ribbed cap with a white liner"; "{Finish} screw cap" elsewhere |
| Reducer | "{Finish} Cap" | "Orifice reducer and {finish} cap" |
| Overcap | "with Overcap" | "{Finish} overcap" |
| Jar lid | "{Finish} Lid" | "{Finish} screw lid" |

- **Finish words** come from the paper-doll finish tokens: Shiny Black, Matte Black, Shiny Gold, Matte Gold, Shiny Silver, Matte Silver, Matte Copper, White, Black with Dots, Pink with Dots, Silver with Dots, Pink Faux-Leather, and so on.
- **Never write:** "metal cap" for the six short lined caps (Jordan's ruling), "Leather" without "Faux-", or "Regular".

### 2.6 Words never used in product copy

- **Brand guardrails:** no beverage or alcohol words (see `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md`).
- **Promotional words:** wholesale (Faire adds it itself), premium, luxury, high quality, best, perfect, bestseller, new, sale.
- **Claims:** see section 6.
- **Formatting:** ALL CAPS, emojis, ™ ®, 【】 ★ ▶, "w/", "approx.", "qty", "pcs".

---

## 3. The naming system

A single module, `src/lib/products/naming.ts`, builds every name from the Convex fields. `pageTitle()` and `getCustomerFacingProductName()` both call it, and so do the Shopify and feed scripts. No surface builds a name any other way.

### 3.1 Formulas by surface

| Surface | Formula | Limit | Why (source) |
|---|---|---|---|
| **Core title**: page H1, catalogue card, Faire name, Shopify title, Google `item_group_title`, structured-data `ProductGroup.name` | `{Capacity} {Glass} {Family} {Type}` | 60 characters | Faire hard cap 60; Etsy "less than 15 words"; suppliers lead with capacity |
| **Variant label**: the picker, Faire and Shopify option values | Mode-specific (2.5), e.g. "Steel Ball, White Cap" | 30 characters | Faire options; Google `variant_option` |
| **Variant title**: cart line, order email, Grace tile, structured-data variant name | `{Core title} - {Variant label}` | 90 characters | Google: a variant name must be more specific than the group name |
| **Browser title** | `{Variant title} \| Best Bottles` | About 75 characters | Google title link: site name after a delimiter |
| **Meta description** | Sentence 1 of the item description, then "{Included} on a {neck} neck." | 155 characters | Google: the key details early; never legacy text |
| **Image alt text** | `{capacity} {glass} glass {family} {type} with {included}`, in lower case | 125 characters | Baymard and Etsy: descriptive alt text |
| **Google feed `title`** | `{Capacity} ({oz}) {Glass} Glass {Family} {Type}, {Variant label}, {Neck} Neck` | 150 characters; key words in the first 70 | Merchant Center title rules |
| **Amazon title** (only if listed) | `Best Bottles {Capacity} {Glass} Glass {Type}, {Variant label}, {n}-Pack` | 75 characters | Amazon 75-character rule; brand first |
| **Amazon item highlights** | Uses, then neck finish, then key part, comma-separated | 125 characters | New Amazon field |
| **Etsy title** (only if listed) | `{Capacity} {Glass} Glass {Type} with {parts}` | Under 15 words | Etsy 2026 guidance |

### 3.2 Worked example: `GBCylAmb9MtlRollWht`

| Surface | Text |
|---|---|
| Core title | 9 ml Amber Cylinder Roll-On Bottle |
| Variant label | Steel Ball, White Cap |
| Variant title | 9 ml Amber Cylinder Roll-On Bottle - Steel Ball, White Cap |
| Browser title | 9 ml Amber Cylinder Roll-On Bottle - Steel Ball, White Cap \| Best Bottles |
| Meta description | A roll-on bottle for perfume oil, attar and carrier-oil blends, sized for samples, promotions and travel. Steel roller ball and white cap on a 17-415 neck. |
| Alt text | 9 ml amber glass cylinder roll-on bottle with steel roller ball and white screw cap |
| Google feed title | 9 ml (0.3 oz) Amber Glass Cylinder Roll-On Bottle, Steel Ball, White Cap, 17-415 Neck |
| Faire name | 9 ml Amber Cylinder Roll-On Bottle, with options Color (cap) and Material (ball) |

### 3.3 More titles, before and after

| SKU | Headline today | Meta name today | New core title |
|---|---|---|---|
| `GBCrcl100AnSpBlk` | 100 ml Clear Circle Spray Bottle | 100 ml Clear Circle Vintage-Style Bulb Sprayer Bottle - Black | 100 ml Clear Circle Vintage Bulb Spray Bottle |
| `GBCrcl100RdcrPnkLthr` | 100 ml Clear Circle Splash-On Bottle | 100 ml Clear Circle Reducer Bottle - Pink Leather Cap | 100 ml Clear Circle Pour Bottle with Reducer |
| `GBCylAmb9SpryBlk` | 9 ml Amber Cylinder Spray Bottle | 9 ml Amber Cylinder Perfume Spray Bottle - Black | 9 ml Amber Cylinder Fine-Mist Spray Bottle |
| `GBBstnAmb1ozBlkCapSht` | 30 ml Amber Boston Round Bottle | (varies) | 30 ml (1 oz) Amber Boston Round Pour Bottle |
| `GBVAmb1DrmWhtCapSht` | 4 ml Amber Vial Bottle | (varies) | 1 Dram (4 ml) Amber Vial |

---

## 4. Item description, Tech Sheet and Fits

- **Item description:** the locked format in `TEMPLATE.md`. It also feeds the meta description (3.1), the Shopify body and the Faire description (section 7).
- **Item type line:** replace the legacy category sentence with the type noun and neck, e.g. "Roll-on bottle · 17-415 neck". This is RUBRIC.md §7, item 5.
- **Tech Sheet:** keep the current labels (Capacity, Neck finish, Glass, Fitment, Height with cap, Height without cap, Diameter, Bottle weight, Case pack). Add these fields when the data exists; every serious trade supplier shows them:
  - **Overflow capacity** (brimful volume). Buyers find a 5 ml roller holds about 4.5 ml.
  - **Inches in brackets** after millimetres.
  - **Label panel height.**
  - **A one-line definition of "Neck finish"** on hover, as Berlin does: "The thread size; it decides which caps and fitments fit."
- **Fits:** the Fits bullet and the page's build strip must list the same parts, computed per family, capacity, neck and glass colour. Neither Amazon nor Etsy sellers publish fit lists, so this is where Best Bottles stands apart from marketplace sellers.

---

## 5. Commercial and trust wording (buy box only)

Keep these out of titles, descriptions and meta text. Google bans them there and Faire discourages them.

| Fact | Where | Wording |
|---|---|---|
| Price tiers | Buy box | Unit price per tier |
| Case pack | Buy box and Tech Sheet | "724 per case" |
| Stock and dispatch | Buy box | "In stock, ships in 1–3 business days" (current) |
| Minimum order | Buy box, cart | One sentence, the same on every page |
| Samples | Buy box link | "Request a sample" |
| What ships | Item description Included bullet | "…, fitted"; "Ships empty" where useful |

---

## 6. Claims policy

**Allowed, and only in these words:**
- "Amber; reduces the light that reaches the contents"
- "The liner seals the neck when capped" (13-415 lined caps only)
- "not leak-proof" (as a warning)
- "Made by hand; each stopper is ground to its own bottle"
- "Clean before filling" (if Best Bottles adopts it)
- "Test your formula with the bottle before filling a full run" (Etsy and Berlin both use this)

**Never:**

| Claim | Why |
|---|---|
| Leak-proof, airtight, spill-proof | Amazon reviews dispute it on nearly every listing |
| TSA approved | TSA approves no products |
| FDA approved | FDA does not approve packaging |
| Food-grade, medical-grade, cosmetic-grade | No documentation |
| BPA-free | Meaningless for glass |
| UV protection on clear, frosted or cobalt glass | Only amber filters meaningfully |
| Shatterproof, unbreakable, thick | Contradicted by breakage reviews |
| Eco-friendly, recyclable claims beyond the FTC Green Guides | Amazon prohibits eco wording |
| Therapeutic or health effects | Not a bottle supplier's claim to make |
| Designer comparisons | Lookalike risk |
| Guarantees and satisfaction promises | Prohibited in Amazon bullets and A+ |
| Unverified statistics | Unverifiable |

The claims list in RUBRIC.md §5 is the machine-checked version.

---

## 7. Channels

### 7.1 The product page and Google Search

- **H1, browser title, meta description and alt text** follow 3.1.
- **Structured data** becomes a `ProductGroup`:
  - `name` = core title, `productGroupID` = group slug.
  - `variesBy`: `color` (cap or fitment finish) and `material` (roller ball).
  - `hasVariant`: one `Product` per SKU, with `sku`, variant title, `color`, `material`, `offers` and the variant URL (`?sku=`).
  - Render it in the initial HTML.
- **Glass colour and capacity stay group-level.** They already have separate pages, which matches Google's rule that only colour, size, material and pattern may vary within a group.

### 7.2 Google Merchant feed (not live today)

If Best Bottles starts selling through Google Shopping, the feed is built from the same record:

| Feed field | Value |
|---|---|
| `id` | website SKU |
| `item_group_id` | group slug |
| `item_group_title` | core title |
| `title` | Google feed title (3.1) |
| `description` | Paragraph, then the bullets as plain lines (under 1,000 characters) |
| `color`, `material`, `size` | From Convex |
| `brand` | Best Bottles (in this field only; not in the title) |
| `link` | Variant URL |

The copy is written by fixed rules from catalogue data, not by generative AI, so the AI-content flags do not apply. If any copy is ever LLM-written, send it as `structured_title` and `structured_description`.

### 7.3 Shopify

`push_convex_to_shopify.mjs` sends:
- `title` = core title, not `displayName`.
- `descriptionHtml` = the paragraph plus a `<ul>` of bullets, not `groupDescription`.
- The same variant option names as the site: "Cap", "Ball", "Sprayer", "Collar".
- SEO title and description = the browser title and meta description.

### 7.4 Faire (live: 20 listings, 4.8★ from 92 reviews)

**Edit the existing listings in place so their reviews and order history stay attached.**

| Current Faire name | New name | Faire options |
|---|---|---|
| Tall Clear Cylinder Glass Bottle with Metal Roller Ball-9ml | 9 ml Clear Tall Cylinder Roll-On Bottle | Color (cap) |
| Clear Cylinder Glass Bottle with Metal Roller Ball - 9ml | 9 ml Clear Cylinder Roll-On Bottle | Color (cap) |
| Cylinder Swirl Glass Bottle with Metal Roller Ball - 9ml | 9 ml Swirl Cylinder Roll-On Bottle | Color (cap) |
| Clear Circle Glass Bottle with Metal Roller Ball - 15ml | 15 ml Clear Circle Roll-On Bottle | Color (cap) |
| Tulip Amber Glass Bottle with Sprayer - 5ml(Multiple Colors) | 5 ml Amber Tulip Fine-Mist Spray Bottle | Color (sprayer) |
| Elegant Clear Glass Bottle Sprayer - 30ml(Multiple Colors) | 30 ml Clear Elegant Perfume Spray Bottle | Color (pump) |
| Elegant Clear Glass Bottle with Sprayer - 60ml | 60 ml Clear Elegant Perfume Spray Bottle | Color (pump) |
| Diva Clear Glass Bottle White Dropper - 46ml(Multiple Caps) | 46 ml Clear Diva Dropper Bottle | Color (collar) |
| Clear Circle Bottle with Dropper-50ml (Multiple Cap Colors) | 50 ml Clear Circle Dropper Bottle | Color (collar) |
| Boston Round Amber Bottle - 30ml (Multiple Dropper Colors) | 30 ml (1 oz) Amber Boston Round Dropper Bottle | Color (collar) |
| Boston Round Amber Bottle - 60ml (Multiple Dropper Colors) | 60 ml (2 oz) Amber Boston Round Dropper Bottle | Color (collar) |
| Boston Round Clear Bottle - 60ml (Multiple Dropper Colors) | 60 ml (2 oz) Clear Boston Round Dropper Bottle | Color (collar) |
| Frosted Glass Cream Jar - 40ml (Multiple Cap Colors) | 40 ml Frosted Cream Jar | Color (lid) |
| Boston Round Amber Bottle-30ml (Multiple Caps & Rollerballs) | 30 ml (1 oz) Amber Boston Round Roll-On Bottle | Material (ball), Color (cap) |
| Boston Round Clear Bottle - 15ml (Multiple Dropper Colors) | 15 ml (0.5 oz) Clear Boston Round Dropper Bottle | Color (collar) |
| Cylinder Amber Glass Bottle with Metal Roller Ball - 9ml | 9 ml Amber Cylinder Roll-On Bottle | Color (cap) |
| Cylinder Clear Glass Bottle with Plastic Roller Ball - 9ml | 9 ml Clear Cylinder Roll-On Bottle - Plastic Ball | Color (cap). Same core title as the steel-ball listing, so it carries the variant label until the two are merged under a Material (ball) option; keep the listing with more reviews |
| Cylinder Clear Bottle with Spray Pump-100ml(Multiple Caps) | 100 ml Clear Cylinder Perfume Spray Bottle | Color (pump) |
| Amber Glass Cream Jar - 5ml (Multiple Cap Colors) | 5 ml Amber Cream Jar | Color (lid) |
| Amber Glass Cream Jar - 40ml (Multiple Cap Colors) | 40 ml Amber Cream Jar | Color (lid) |

The shop page also lists ten "Purchased product" entries from reviews (for example "Diva Glass Bottle with Tassel Sprayer-100ml Multiple Colors"). They are past listings; if any is reactivated, it takes a name from the same formula.

- **Description:** the paragraph, the bullets, then a spec block: Capacity, Height, Diameter, Neck finish, Case pack, Made in. Keep it under 1,000 characters; retailers copy it into their POS.
- **"Made in" needs correcting before anything is republished.**
  - Every listing checked says "Made in: United States" (for example https://www.faire.com/product/p_y3sme8maxz, 2026-09-26).
  - Public U.S. import records for Nemat International, Union City, the company behind bestbottles.com, show 221 sea shipments: 177 from China, 26 from Taiwan (older), 4 from Singapore. Recent rows include "Glass Bottle Sprayer Microsprayer Glass Bottle Plastic Cap" (Zhejiang JM Industrial, China, 2026-03-08) and "Steel Balls" (Taian Xinxin, China, 2026-07-16). Sources: https://www.importyeti.com/company/nemat-international and https://www.importgenius.com/importers/nemat-international-inc.
  - Fitting a roller or cap onto an imported bottle is not usually a "substantial transformation" under CBP rules, so the origin follows the glass.
  - Best Bottles confirms each listed SKU from the supplier invoice or the CBP entry (Form 7501) and checks the carton markings. The expected answer for current stock is China.
- **Brand bio:** rewrite it. It currently reads "BestBottles.com is an online beauty packaging wholesale store… great gifts, party and wedding favors."

### 7.5 Amazon and Etsy (not live; only if Best Bottles lists there)

- **Amazon:**
  - Title and item highlights per 3.1.
  - Five bullets, reusing our labels in Amazon's "Header: description" form: Included, Glass, Fits, Uses, Care. Our Fits bullet answers the neck-finish question almost no Amazon listing answers.
  - A+ content: the "how to seat the roller or sprayer" steps, which target the top review complaints.
- **Etsy:**
  - Title per 3.1.
  - Classify as "Sourced by a seller" (craft supplies).
  - Use all 13 tags, as multi-word phrases: e.g. "empty perfume bottle", "attar bottle", "roller bottle 10ml", "fragrance decants".
  - Variations are attribute-first: "Cap: Matte Gold".
  - Description: the paragraph, the bullets, the specs, then a Please Note block: "Ships empty; test your formula before filling a full run."

### 7.6 Print: catalogue, line booklet and family inserts

The printed pieces are one more channel built from the same record; the plan and a Boston Round proof are in `../print-collateral/PRINT-PLAN.md`.

- **Names:** the family name as the page heading; the core title (3.1) wherever a single product is named; variant labels (2.5) in the line sheet.
- **Descriptions:** the family paragraph uses sentence 1 of the item description at family level; care lines come from RUBRIC.md, word for word.
- **Item numbers** are the website SKUs, so a buyer can type them into the site search.
- **No prices** in anything printed in volume. Prices, stock and pack sizes point to the site and the phone line; a dated price list is printed separately, on demand.
- **The claims policy (section 6) applies unchanged.**

---

## 8. Governance

- **One module.** `naming.ts` and the item-description composer are the only places product wording is built. Legacy fields (`itemName`, `displayName`, `groupDescription`, `graceDescription`) are inputs only and never shown.
- **Staff overrides.** The Team Hub `customName` must pass the same lint: 60 characters or less, controlled vocabulary, claims list. The generated name remains the default.
- **Tests.** A vitest suite runs every SKU through naming and descriptions and fails on any of these:
  - A title over 60 characters.
  - A duplicate word ("Vial Vial").
  - A neck finish not written as `NN-NNN` (GPI finishes) or "{n} mm" (16 mm, 12 mm and other non-GPI necks).
  - A unit without a space.
  - A banned word or claim.
  - A title and a spec that disagree, e.g. capacity in the title ≠ `capacityMl`.
- **Data checks** catch the errors that competitors ship:
  - neck ≠ closure neck
  - two different ounce values for one bottle
  - impossible weights
  - Included naming a part the SKU doesn't ship with

---

## 9. Rollout

| Step | What | Where | Depends on |
|---|---|---|---|
| 1 | `naming.ts`; H1, meta, cards, cart and alt text switch to it | Code | Approval of sections 2 and 3 |
| 2 | Item descriptions in the locked format | Code + regenerate from production | RUBRIC.md Phases 1–3 |
| 3 | Meta description from the description; `ProductGroup` structured data | Code | Steps 1–2 |
| 4 | Shopify sync sends the new title, body and options | Script | Steps 1–2 |
| 5 | Faire: rename 20 listings, rewrite descriptions, correct "Made in", new bio | Faire admin | Steps 1–2; country-of-origin confirmation (7.4) |
| 6 | Tech Sheet additions: overflow capacity, inches, label panel, neck tooltip (approved) | Data + code | New Convex fields; measurements from the supplier drawings |
| 7 | Google Merchant feed (approved) | Script + Merchant Center | Steps 1–3; a Merchant Center account |
| 8a | Print: catalogue, line booklet, family inserts | `src/lib/pdf/catalog` + printer | Steps 1–2; PRINT-PLAN.md decisions |
| 8 | Amazon or Etsy listings | Marketplace | A business decision to list |

---

## 10. Decisions (updated 2026-09-26)

| # | Decision | Status |
|---|---|---|
| 1 | Title formula and vocabulary (sections 2 and 3) | **Locked** |
| 2 | Bulb sprayers | **Locked:** "Vintage Bulb Spray Bottle" and "Vintage Bulb Spray Bottle with Tassel"; all fit in 60 characters |
| 3 | Ounces in titles | **Recommendation revised with evidence (2.1.1); awaiting Best Bottles' OK.** ml first; ounces in brackets on Boston rounds and standard ounce sizes only; always in the Google title |
| 4 | Country of origin for Faire "Made in" | **Under confirmation.** Import records point to China (7.4); the "United States" value on Faire today looks wrong. Best Bottles confirms from invoices before the Faire edit |
| 5 | Overflow capacity, label panel and inch dimensions | **Locked: yes** (rollout step 6) |
| 6 | Google Merchant feed | **Locked: yes** (rollout step 7) |
| 7 | Printed catalogue, line booklet and family inserts | **New.** See `../print-collateral/PRINT-PLAN.md` for the formats and the proof |
| 8 | Neck sheets and component register: cap, sprayer and pump words; what counts as a fit; stopper bottles; stock source | **New.** See `SYNTHESIS.md`, decisions D1–D7 |
