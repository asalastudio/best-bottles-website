# PDP item description template

Status: draft for review · 2026-09-26

This file sets how an item description is laid out. `RUBRIC.md` in the same folder sets what it may say: the dispense-mode cards, allowed and excluded uses, guard lines, material lines and claims list. The template only arranges what the rubric allows.

## Recommendation

Use **a one-sentence summary followed by three to five labelled bullets** on the product page. The summary says what the item is for. The bullets always come in the same order:

1. Included
2. Fits
3. Glass
4. Good to know

Keep a **three-sentence version** for places with no room for a list: quick view, catalogue compare, the cart drawer, and Grace's answers. Both versions are built from the same record, so they never disagree.

Why this layout:

- **Shopify** recommends "a compelling opening paragraph with scannable bullet points for features and specifications", paragraphs of "two to three sentences max for comfortable mobile reading", and "only 50 to 100 words" for simple, low-cost items.
- **Amazon** asks for at least three bullets, each written as "a header with a colon followed by a description". Bullets are sentence fragments with no end punctuation, carry no claims that can't be verified, and avoid repeating the title or other fields.
- **Baymard's** usability testing found that "every single user" relied on the product description to decide whether a product suited them. Compatibility is the attribute that decides purchases of parts that must work together, and users' willingness to "fill in the blanks" is "virtually nonexistent". Overly brief descriptions sent users to other products or other sites.
  - The first two points make the Fits and Included bullets required.
  - The last point is why the three-sentence version is the fallback, not the product-page default.

---

## 1. What each source asks for, and where the template does it

| Guideline | Source | Where the template applies it |
|---|---|---|
| Answer "why should I buy this?" in the first sentence; open with the product's use or benefit | Shopify | The summary says what the item is for |
| Opening paragraph, then scannable bullets for features and specifications; detailed specs in an expandable section | Shopify | Summary + bullets; dimensions, weight and case pack stay in the Tech sheet |
| Paragraphs of two to three sentences at most for mobile | Shopify | Layout A is three sentences; the summary is one |
| Simple, low-cost items need 50 to 100 words | Shopify | 30 to 75 words; the Tech sheet carries the specs |
| Can a shopper scan it in 10 seconds, and does it work on a phone? | Shopify | Bullets of 110 characters or less, which is two lines on a phone |
| At least three bullets | Amazon | Three to five bullets |
| "Header with a colon followed by a description" | Amazon | `Label: text` with a fixed set of labels |
| Begin with a capital; sentence fragment; no end punctuation; semicolons to join phrases | Amazon | Bullet style rules |
| Space between digit and unit ("60 ml"); no abbreviations ("w/", "approx.", "qty"); no all caps, special characters or emojis | Amazon | Style rules and lint |
| Each bullet gives unique information; minimise duplication with the title and other attributes; keep data consistent across variants | Amazon | One fact type per label; the summary does not repeat the title's capacity, glass or family; same labels on every SKU |
| Avoid subjective, performance or comparative claims unless verifiable; no "anti-bacterial" or "eco-friendly"; no guarantees | Amazon | The claims list in RUBRIC.md §5 |
| Give compatibility information, complete and in a form users understand | Baymard | **Fits**: the neck finish, plus the fitments actually sold for this bottle |
| Give materials | Baymard | **Glass** or **Material** |
| Say what is included, and make clear that optional items are extra | Baymard | **Included**, and "sold for this bottle" in Fits |
| Translate dimensions into plain language ("slides easily into your purse"); label measurements with units | Baymard | The size phrase in the summary; measurements with units in the Tech sheet |
| Structure by a few key highlights, with secondary features listed separately, to avoid a "feature dump" | Baymard | Three to five fixed bullets; everything else in the Tech sheet |

Shopify's article is written to sell: it recommends sensory language, a story, and addressing the reader as "you". This template takes its structure and scannability rules, not its persuasion techniques, because the brief is informative copy, not sales copy.

---

## 2. One record, two layouts

The generator builds one record per SKU. Both layouts are rendered from it.

| Field | Content | Comes from (RUBRIC.md) | Required |
|---|---|---|---|
| `summary` | "A {type phrase} for {two to four uses}{, size phrase}." | Dispense mode (§4.2), liquid classes (§4.1), size band (§4.3) | Always |
| `included` | Fitment with its finish, then the cap or overcap, then ", fitted" when assembled | `applicator`, `capColor`, `capStyle`, legacy flags | Always |
| `fits` | "{neck} neck; also takes the {fitments} sold for this bottle" | Neck system (§4.5), catalogue | When other fitments are sold for the same bottle |
| `glass` | The material line: colour, then what it does | Glass and material (§4.4) | When the line earns its place |
| `goodToKnow` | The mode's guard; otherwise a carry, refill or legacy-flag line | Dispense-mode card, carry behaviour (§4.6) | Whenever the mode has a guard |

**How Fits is computed.**

- The fitment list covers the same family, capacity, neck **and glass colour**, and names a screw cap when a cap-only SKU exists at that neck.
- Today's family profile ignores colour and leaves caps out. Phase 1 changes that.
- Without the colour check, a frosted bottle could list a fitment that is only sold on the clear one.

---

## 3. Layout B: summary and bullets (product-page default)

```
{Summary sentence.}
• Included: {what comes on the bottle}
• Fits: {neck} neck; also takes the {fitments} sold for this bottle
• Glass: {colour}; {what it does}
• Good to know: {limit, care or carry}
```

### Summary

- One sentence, 10 to 25 words, 160 characters or less.
- Start with the type phrase for the dispense mode (table below), then "for", then two to four uses from the mode card, then the size phrase.
- Do not repeat capacity, glass colour or family. The page title right above already says "9 ml Amber Cylinder Roll-On Bottle".
  - Exception: sizes buyers name in ounces or drams ("in the common 1 oz size", "A 1 dram vial").
- **At 5 ml and under, samples lead:** "A roll-on bottle for samples and promotional giveaways of perfume oil, attar and carrier-oil blends." Best Bottles' buyers use drams, 5 ml bottles, roll-ons and sprays as samples and promotional items.
- **Beard oil** is named wherever the mode card lists it: droppers, pour bottles and splash bottles (RUBRIC.md §4.1).

### Bullets

- **Count and order.** Three to five bullets, always in the order Included, Fits, Glass (or Material), Good to know. Leave a label out when there is nothing verified to say; never pad.
- **Labels.** Use only these: `Included`, `Fits`, `Glass`, `Material`, `Good to know`. Use `Material` for aluminum, plastic and metal-shell items.
- **Text.**
  - Starts with a capital and has no end punctuation.
  - A semicolon joins two phrases.
  - 110 characters or less, counting the label.
- **One kind of fact per bullet.** Never repeat a fact from the summary, the title or the Tech sheet: no millimetres, weight, case pack or price.
- **Good to know** is written as a full clause with its own subject ("It pumps liquids that pour; ...", not "Pumps liquids that pour"). That way the same text works as sentence 3 of layout A.

### Total length

30 to 75 words across the summary and the bullets.

### Type phrases

| Dispense mode | Type phrase |
|---|---|
| ROLL | roll-on bottle |
| MIST | fine-mist spray bottle |
| PUMP-SPRAY | perfume spray bottle |
| BULB | vintage-style bulb-spray bottle |
| SPLASH | splash bottle with an orifice reducer |
| PUMP-LOTION | lotion-pump bottle |
| DROP | dropper bottle |
| POUR | pour bottle (only a short screw cap; the oil is poured into the hand) |
| STOPPER | stoppered bottle ("stoppered apothecary bottle" when the family is Apothecary) |
| DAB | dab-on bottle with a glass rod |
| VIAL | "{n} dram vial" when the catalogue names the size in drams ("1 dram vial", "5/8 dram vial"), otherwise "sample vial" |
| JAR | cream jar |
| ATOMIZER | refillable travel atomizer |
| STOCK | stock bottle (cap-only bottles over 100 ml) |

### Size phrases

These follow the size bands in RUBRIC.md §4.3.

| Band | Phrase |
|---|---|
| 5 ml or less | Samples lead: "for samples and promotional giveaways of {liquids}"; vials add "testers" |
| 6 to 9 ml | "sized for samples, promotions and travel" |
| 10 to 15 ml | "sized for decants, promotions and travel" |
| 25 to 60 ml | None, or "in the common 1 oz size" at 30 ml and "2 oz" at 60 ml |
| 78 to 128 ml | "at full retail size" |
| Over 130 ml | "for stock or refills" |

---

## 4. Layout A: three sentences (compact)

```
{Summary sentence.} It comes with {included}; the {neck} neck also takes the {fitments} sold for this bottle. {Good to know, or the glass line.}
```

- **Sentence 1** is the summary, word for word.
- **Sentence 2** is "It comes with" plus the Included text, joined by a semicolon to the Fits text. When there is no Fits text, it is the Included text alone.
- **Sentence 3** is the Good to know text.
  - When there is none, the glass line as a sentence ("Amber glass reduces the light that reaches the contents.").
  - When there is neither, stop at two sentences.
- 25 to 60 words.
- Use it where a list does not fit. It is not the product-page default, because Baymard found overly brief descriptions lose buyers and the product page has room for the list.

---

## 5. Where it sits on the product page

In the details column (`PdpProductInfo`):

1. Item type line
2. Summary
3. Bullets

Below them come the Tech sheet (capacity, neck finish, glass, fitment, heights, diameter, weight, case pack) and the dimension drawing.

- **Markup.** Render the bullets as a real list (`<ul>`), so screen readers announce "list, 4 items". Set the label in semibold and the text in regular weight. Shopify recommends bold text and white space "to guide the customer's eye".
- **Item type line.** Once the summary ships, it repeats the old legacy "Item type" line. RUBRIC.md §7 item 5 covers replacing that line.
- **Later, optional.**
  - An icon per label: Baymard's "highlights" pattern.
  - Inches in brackets next to millimetres in the Tech sheet. Baymard recommends alternate units, because some users "don't really know how that would compare with inches".

---

## 6. Worked examples

There are fifteen examples:

- the twelve archetypes from RUBRIC.md, with the pour bottle and the 1 dram vial updated
- three sample sizes: a 5 ml roll-on, a 3.3 ml sprayer and a 5 ml pour bottle

Each Fits line was checked against the catalogue for the same family, capacity, neck and glass colour. Word counts cover everything shown.

### 1. Cylinder 9 ml, amber, steel roller ball, white cap · `GBCylAmb9MtlRollWht` (ROLL)

**Layout B, summary and bullets** (66 words)

A roll-on bottle for perfume oil, attar and carrier-oil blends, sized for samples, promotions and travel.

- **Included:** Steel roller ball and white screw cap, fitted
- **Fits:** 17-415 neck; also takes the plastic roller, fine-mist sprayer and lotion pump sold for this bottle
- **Glass:** Amber; reduces the light that reaches the oil
- **Good to know:** Carry it capped and upright; the ball alone is not a seal

**Layout A, three sentences** (56 words)

> A roll-on bottle for perfume oil, attar and carrier-oil blends, sized for samples, promotions and travel. It comes with a steel roller ball and white screw cap; the 17-415 neck also takes the plastic roller, fine-mist sprayer and lotion pump sold for this bottle. Carry it capped and upright; the ball alone is not a seal.

### 2. Cylinder 9 ml, amber, black fine-mist sprayer · `GBCylAmb9SpryBlk` (MIST)

**Layout B, summary and bullets** (60 words)

A fine-mist spray bottle for eau de parfum, cologne and body mist, sized for samples, promotions and travel.

- **Included:** Black fine-mist sprayer and plastic overcap, fitted
- **Fits:** 17-415 neck; also takes the steel and plastic rollers and the lotion pump sold for this bottle
- **Good to know:** It sprays thin liquids only; perfume oil and undiluted essential oil clog it

**Layout A, three sentences** (59 words)

> A fine-mist spray bottle for eau de parfum, cologne and body mist, sized for samples, promotions and travel. It comes with a black fine-mist sprayer and plastic overcap; the 17-415 neck also takes the steel and plastic rollers and the lotion pump sold for this bottle. It sprays thin liquids only; perfume oil and undiluted essential oil clog it.

### 3. Circle 100 ml, clear, black vintage-style bulb sprayer · `GBCrcl100AnSpBlk` (BULB)

**Layout B, summary and bullets** (59 words)

A vintage-style bulb-spray bottle for eau de parfum and cologne kept on a dressing table, and for display or gifts.

- **Included:** Black bulb sprayer, fitted
- **Fits:** 18-415 neck; also takes the perfume spray pump, lotion pump and reducer sold for this bottle
- **Good to know:** The bulb does not seal the bottle, so it is not a travel bottle

**Layout A, three sentences** (58 words)

> A vintage-style bulb-spray bottle for eau de parfum and cologne kept on a dressing table, and for display or gifts. It comes with a black bulb sprayer; the 18-415 neck also takes the perfume spray pump, lotion pump and reducer sold for this bottle. The bulb does not seal the bottle, so it is not a travel bottle.

*Note:* The guard is pending the confirmation in RUBRIC.md §7, item 3.

### 4. Circle 100 ml, clear, orifice reducer, pink faux-leather cap · `GBCrcl100RdcrPnkLthr` (SPLASH)

**Layout B, summary and bullets** (61 words)

A splash bottle with an orifice reducer, for splash cologne, aftershave, perfume oil and beard oil.

- **Included:** Orifice reducer and pink faux-leather cap, fitted
- **Fits:** 18-415 neck; also takes the perfume spray pump, lotion pump and bulb sprayer sold for this bottle
- **Good to know:** The reducer turns a pour into a controlled splash or drip; very thick oils drip slowly

**Layout A, three sentences** (60 words)

> A splash bottle with an orifice reducer, for splash cologne, aftershave, perfume oil and beard oil. It comes with an orifice reducer and pink faux-leather cap; the 18-415 neck also takes the perfume spray pump, lotion pump and bulb sprayer sold for this bottle. The reducer turns a pour into a controlled splash or drip; very thick oils drip slowly.

### 5. Circle 50 ml, clear, matte silver perfume spray pump · `GBCrcl50SpryMtSl` (PUMP-SPRAY)

**Layout B, summary and bullets** (47 words)

A perfume spray bottle for eau de parfum, eau de toilette and cologne at full retail size.

- **Included:** Matte silver perfume spray pump, fitted
- **Fits:** 18-415 neck; also takes the lotion pump, dropper, reducer and bulb sprayer sold for this bottle
- **Glass:** Clear; shows the fill level

**Layout A, three sentences** (49 words)

> A perfume spray bottle for eau de parfum, eau de toilette and cologne at full retail size. It comes with a matte silver perfume spray pump; the 18-415 neck also takes the lotion pump, dropper, reducer and bulb sprayer sold for this bottle. Clear glass shows the fill level.

*Note:* No guard applies, so layout A ends on the glass line. A refill line replaces it once the pump attachment is confirmed.

### 6. Circle 100 ml, frosted, lotion pump, clear overcap · `LBCrclFrst100LtnClOvrCap` (PUMP-LOTION)

**Layout B, summary and bullets** (55 words)

A lotion-pump bottle for body lotion, liquid soap, serums and body or hair oil.

- **Included:** Lotion pump and clear overcap, fitted
- **Fits:** 18-415 neck; also takes the perfume spray pump, reducer and bulb sprayer sold for this bottle
- **Good to know:** It pumps liquids that pour; thick creams and body butters belong in a jar

**Layout A, three sentences** (54 words)

> A lotion-pump bottle for body lotion, liquid soap, serums and body or hair oil. It comes with a lotion pump and clear overcap; the 18-415 neck also takes the perfume spray pump, reducer and bulb sprayer sold for this bottle. It pumps liquids that pour; thick creams and body butters belong in a jar.

### 7. Boston Round 30 ml, amber, dropper · `GBBstnAmb1ozBlkDrpShnGl` (DROP)

**Layout B, summary and bullets** (69 words)

A dropper bottle for essential oils, beard oil and facial serums, in the common 1 oz size.

- **Included:** Glass pipette dropper, rubber bulb and black collar, fitted
- **Fits:** 20-400 neck; also takes the steel and plastic rollers and the screw cap sold for this bottle
- **Glass:** Amber; reduces the light that reaches the contents
- **Good to know:** Store it upright; undiluted essential oil softens the rubber bulb over time

**Layout A, three sentences** (59 words)

> A dropper bottle for essential oils, beard oil and facial serums, in the common 1 oz size. It comes with a glass pipette dropper, rubber bulb and black collar; the 20-400 neck also takes the steel and plastic rollers and the screw cap sold for this bottle. Store it upright; undiluted essential oil softens the rubber bulb over time.

*Note:* Essential oils lead the uses at Best Bottles' direction. The care line stays because undiluted essential oil softens rubber bulbs (community-research.md §1.4).

### 8. Boston Round 30 ml, amber, short black cap (pour) · `GBBstnAmb1ozBlkCapSht` (POUR)

**Layout B, summary and bullets** (68 words)

A pour bottle for beard oil, hair oil, body oil and essential oils, in the common 1 oz size.

- **Included:** Short black screw cap
- **Fits:** 20-400 neck; also takes the dropper and the steel and plastic rollers sold for this bottle
- **Glass:** Amber; reduces the light that reaches the contents
- **Good to know:** It has no fitment, so the oil pours straight from the neck into the hand

**Layout A, three sentences** (59 words)

> A pour bottle for beard oil, hair oil, body oil and essential oils, in the common 1 oz size. It comes with a short black screw cap; the 20-400 neck also takes the dropper and the steel and plastic rollers sold for this bottle. It has no fitment, so the oil pours straight from the neck into the hand.

*Note:* Included says "lined" once Best Bottles confirms which short caps have a liner (RUBRIC.md §7, item 6).

### 9. Apothecary 15 ml, cobalt blue, ground-glass stopper · `GB15ApthBlue` (STOPPER)

**Layout B, summary and bullets** (52 words)

A stoppered apothecary bottle for perfume oil, attar and essential oil kept on a dressing table or shelf.

- **Included:** Ground-glass stopper, ground to fit this bottle
- **Glass:** Cobalt blue glass, made by hand
- **Good to know:** The stopper seats by friction and is not leak-proof, so it is not a travel bottle

**Layout A, three sentences** (45 words)

> A stoppered apothecary bottle for perfume oil, attar and essential oil kept on a dressing table or shelf. It comes with a ground-glass stopper, ground to fit this bottle. The stopper seats by friction and is not leak-proof, so it is not a travel bottle.

### 10. Metal-shell atomizer 10 ml, black · `GBAtom10Blk` (ATOMIZER)

**Layout B, summary and bullets** (42 words)

A refillable travel atomizer for eau de parfum or cologne on the go, and for gifts and promotions.

- **Included:** Built-in sprayer and black cap
- **Material:** Black metal shell
- **Good to know:** The shell can be laser-engraved with a name or a logo

**Layout A, three sentences** (38 words)

> A refillable travel atomizer for eau de parfum or cologne on the go, and for gifts and promotions. It comes with a built-in sprayer and black cap. The shell can be laser-engraved with a name or a logo.

*Note:* The refill method goes in Good to know once it is confirmed.

### 11. 1 dram vial (4 ml), amber, short white cap · `GBVAmb1DrmWhtCapSht` (VIAL)

**Layout B, summary and bullets** (54 words)

A 1 dram vial for samples, testers and promotional giveaways of perfume, perfume oil and essential oil.

- **Included:** Short white screw cap
- **Fits:** 13-425 neck; also takes the dropper sold for this bottle
- **Glass:** Amber; reduces the light that reaches the contents
- **Good to know:** Fill it with a pipette or a small funnel

**Layout A, three sentences** (45 words)

> A 1 dram vial for samples, testers and promotional giveaways of perfume, perfume oil and essential oil. It comes with a short white screw cap; the 13-425 neck also takes the dropper sold for this bottle. Fill it with a pipette or a small funnel.

### 12. Cream jar 15 ml, clear, pink lid · `CJClr15Pnk` (JAR)

**Layout B, summary and bullets** (33 words)

A cream jar for creams, balms, body butter and solid perfume.

- **Included:** Pink screw lid
- **Glass:** Clear; shows the product inside
- **Good to know:** The wide mouth takes a spatula or a fingertip

**Layout A, three sentences** (27 words)

> A cream jar for creams, balms, body butter and solid perfume. It comes with a pink screw lid. The wide mouth takes a spatula or a fingertip.

### 13. Cylinder 5 ml, clear, steel roller ball (sample size) · `GBCyl5MtlRollBlkSh` (ROLL)

**Layout B, summary and bullets** (57 words)

A roll-on bottle for samples and promotional giveaways of perfume oil, attar and carrier-oil blends.

- **Included:** Steel roller ball and shiny black screw cap, fitted
- **Fits:** 13-415 neck; also takes the plastic roller, fine-mist sprayer and screw cap sold for this bottle
- **Good to know:** Carry it capped and upright; the ball alone is not a seal

**Layout A, three sentences** (56 words)

> A roll-on bottle for samples and promotional giveaways of perfume oil, attar and carrier-oil blends. It comes with a steel roller ball and shiny black screw cap; the 13-415 neck also takes the plastic roller, fine-mist sprayer and screw cap sold for this bottle. Carry it capped and upright; the ball alone is not a seal.

### 14. Cylinder 3.3 ml, clear, black fine-mist sprayer (sample size) · `GBSpry3mlClBlk` (MIST)

**Layout B, summary and bullets** (47 words)

A fine-mist spray bottle for samples and promotional giveaways of eau de parfum, cologne and body mist.

- **Included:** Black fine-mist sprayer and clear cap, fitted
- **Glass:** Clear; shows the fill level
- **Good to know:** It sprays thin liquids only; perfume oil and undiluted essential oil clog it

**Layout A, three sentences** (40 words)

> A fine-mist spray bottle for samples and promotional giveaways of eau de parfum, cologne and body mist. It comes with a black fine-mist sprayer and clear cap. It sprays thin liquids only; perfume oil and undiluted essential oil clog it.

### 15. Cylinder 5 ml, clear, short black cap (pour, sample size) · `GBCyl5BlkSht` (POUR)

**Layout B, summary and bullets** (53 words)

A pour bottle for samples and promotional giveaways of perfume oil, attar and beard oil.

- **Included:** Short black screw cap
- **Fits:** 13-415 neck; also takes the steel and plastic rollers and the fine-mist sprayer sold for this bottle
- **Good to know:** It has no fitment, so the oil pours straight from the neck

**Layout A, three sentences** (53 words)

> A pour bottle for samples and promotional giveaways of perfume oil, attar and beard oil. It comes with a short black screw cap; the 13-415 neck also takes the steel and plastic rollers and the fine-mist sprayer sold for this bottle. It has no fitment, so the oil pours straight from the neck.

*Note:* The "into the hand" ending is dropped at sample size, where the bottle is filled and handed out rather than used from.

---

## 7. Checklist before publishing

The Phase 2 test in RUBRIC.md §8 enforces this.

- **Summary:**
  - One sentence, 10 to 25 words, 160 characters or less.
  - Starts with the type phrase for the SKU's dispense mode and contains "for".
  - Does not repeat the capacity or glass colour from the page title.
- **Bullets:**
  - Three to five, with labels from the fixed list in the fixed order.
  - Each 110 characters or less, with no end punctuation.
  - No fact appears twice.
- **Layout A:** two or three sentences, 25 to 60 words.
- **Both layouts:** no millimetres, case count or price.
- **Rubric lint** (RUBRIC.md §5):
  - No excluded uses for the mode.
  - The brand banned list, checked with word boundaries.
  - The claims list.
- **Amazon style:**
  - A space between number and unit.
  - No "w/", "approx." or "qty".
  - No all caps.
  - No ™, ®, ± or emojis.

---

## 8. What changes in the code, once approved

- `compose.ts` returns the record (`summary`, `included`, `fits`, `glass`, `goodToKnow`) and both renderings.
- `data/descriptions/pdp/item-descriptions.json` gains `summary` and `bullets: [{ label, text }]`. `description` holds layout A, so existing callers keep working.
- `PdpProductInfo` renders the summary and a `<ul>`. When a SKU has no bullets, it falls back to `description`.
- Fits is computed per family, capacity, neck and glass colour, and includes a screw cap when a cap-only SKU exists (see section 2).

---

## Sources

- Baymard Institute, "Structuring Product Page Descriptions by 'Highlights' Increases User Engagement (Yet 78% of Sites Don't)", 2018. https://baymard.com/research-articles/structure-descriptions-by-highlights
- Baymard Institute, "10% of E-Commerce Sites Have Product Descriptions That Are Insufficient for Users' Needs", 2021. https://baymard.com/research-articles/product-descriptions
- Shopify, "How to Write a Product Description That Sells (2026)", updated 2026-01-30. https://www.shopify.com/blog/8211159-9-simple-ways-to-write-product-descriptions-that-sell
- Amazon Seller Central, "Product bullet point requirements". https://sellercentral.amazon.com/help/hub/reference/external/GX5L8BF8GLMML6CX
- Amazon Seller Central, "Product detail page rules": titles of 75 characters or less, and item highlights of 125 characters. https://sellercentral.amazon.com/help/hub/reference/external/G200390640
