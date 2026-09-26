# Product copy strategy: titles, descriptions and all product wording

Status: proposed for lock · 2026-09-26

**Companion files in this folder:**

- `TEMPLATE.md`: the item description format (locked).
- `RUBRIC.md`: which uses, guards and claims each product type may carry.
- `market-research.md`: what suppliers, Amazon, Etsy, Faire and Google do and require, with sources.
- `community-research.md`: what buyers ask on Reddit.

---

## The short version

1. **One name, built once, used everywhere.** Today the same bottle carries three names: the page headline, the meta and catalogue name, and the Shopify name. One naming function replaces all three.
2. **Title formula: `{Capacity} {Glass} {Family} {Type}`.** For example, "9 ml Amber Cylinder Roll-On Bottle".
   - Capacity comes first, as it does with nearly every supplier.
   - There is no brand, no pack count and no promotional word.
   - Titles are 60 characters or less, which is Faire's hard limit. All 2,113 bottles fit: the longest is 54 characters and the median 39.
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
| Faire (live, 13 listings) | Typed by hand | "Clear Circle Glass Bottle with Metal Roller Ball - 15ml" |
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
| Ounces in titles | Only where buyers name the size in ounces: Boston rounds at 15, 30 and 60 ml, as "15 ml (0.5 oz)", "30 ml (1 oz)", "60 ml (2 oz)"; and sizes of 118 ml and up, as "118 ml (4 oz)" | "1/2oz", "3 1/2oz" |
| Ounces in the Google feed | Always: "9 ml (0.3 oz)" | |
| Drams | Vials the catalogue names in drams: "1 Dram (4 ml)", "5/8 Dram (3 ml)" | "dram" without the ml |
| Neck finish | "18-415", with a hyphen | "18/415", "18mm", "18-415mm" |
| Dimensions | In the Tech Sheet only, in mm; inches in brackets, once added | Anywhere in titles or descriptions |

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
| BULB | Bulb Spray Bottle | "Vintage-style" goes in sentence 1 of the description and in the Google title. The tassel version is "Bulb Spray Bottle with Tassel". Adding "Vintage-Style" to the title would push 176 SKUs past 60 characters. |
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
| `GBCrcl100AnSpBlk` | 100 ml Clear Circle Spray Bottle | 100 ml Clear Circle Vintage-Style Bulb Sprayer Bottle - Black | 100 ml Clear Circle Bulb Spray Bottle |
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

### 7.4 Faire (live: 13 listings, 4.8★ from 92 reviews)

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

- **Description:** the paragraph, the bullets, then a spec block: Capacity, Height, Diameter, Neck finish, Case pack, Made in. Keep it under 1,000 characters; retailers copy it into their POS.
- **"Made in: United States"** is on every listing today. Best Bottles must confirm it against U.S. Customs and Border Protection country-of-origin rules before republishing.
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

---

## 8. Governance

- **One module.** `naming.ts` and the item-description composer are the only places product wording is built. Legacy fields (`itemName`, `displayName`, `groupDescription`, `graceDescription`) are inputs only and never shown.
- **Staff overrides.** The Team Hub `customName` must pass the same lint: 60 characters or less, controlled vocabulary, claims list. The generated name remains the default.
- **Tests.** A vitest suite runs every SKU through naming and descriptions and fails on any of these:
  - A title over 60 characters.
  - A duplicate word ("Vial Vial").
  - A neck finish not written as `NN-NNN`.
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
| 5 | Faire: rename 13 listings, rewrite descriptions, verify "Made in", new bio | Faire admin | Steps 1–2; country-of-origin answer |
| 6 | Tech Sheet additions: overflow, inches, label panel, neck tooltip | Data + code | New Convex fields |
| 7 | Google Merchant feed | Script + Merchant Center | A decision to sell through Google Shopping |
| 8 | Amazon or Etsy listings | Marketplace | A business decision to list |

---

## 10. Decisions for Best Bottles

1. **Lock the title formula and vocabulary in sections 2 and 3?** Recommended: yes.
2. **Bulb sprayers titled "Bulb Spray Bottle",** with "vintage-style" in the description and the Google title? Recommended: yes. With it in the title, 176 SKUs break Faire's 60-character limit.
3. **Ounces in titles only for Boston rounds and sizes of 4 oz and up;** always in the Google title? Recommended: yes.
4. **Country of origin for the Faire "Made in" field.** Best Bottles to confirm.
5. **Add overflow capacity, label panel and inch dimensions to the catalogue?** Recommended: yes; the trade suppliers all show them.
6. **Set up a Google Merchant feed?** This is a business decision; the copy side is ready once steps 1–3 ship.
