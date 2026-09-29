# PDP item description template

Status: **locked** · 2026-09-26. Best Bottles approved this format. **Amended 2026-09-28 and 2026-09-29** (below).

**Amendments, 2026-09-29 (Best Bottles' answers).**
- **Nothing ships fitted.** Rollers, sprayers, pumps, reducers and droppers ship unattached. The Included bullet ends "packed unattached", never "fitted".
- **Travel caps** come in gold, silver and black. The copy names the colour when the bulb or its collar is gold, silver or black, and says "a travel cap" otherwise (the matching is an assumption to confirm).
- **Liners.** The 15-415, 18-415 and Boston Round (18-400, 20-400) screw caps have a liner, like the 13-415 caps, and so does the aluminum screw top: "The liner seals the neck when capped" in Good to know.
- **Atomizers** refill from the top.
- **Dropper bulbs:** the material is not known, so the copy says "bulb", never "rubber bulb".

**Amendments, 2026-09-28 (Best Bottles).**
- **Care note.** The warning line ("Thin liquids only: perfume oil and undiluted essential oil clog the sprayer") moves out of the description. It becomes one Care note per product, at most one line, shown beside the Tech sheet in the brand's editorial serif so it reads as a note rather than sales copy. Sentence 2 then carries how the product works or another deciding fact.
- **Sets and cases.** Quantities are "1 set", "12 sets", "144 sets" and cases ("a case of 724 sets"). "Piece", "pcs" and "each" are no longer used.
- **Measurements** (height, diameter, neck) stay in the Tech sheet, never in the description.
- **Bulb sprayers** ship with the bulb unattached and a travel cap; the carry line says so (RUBRIC.md BULB card).

This file sets how an item description is laid out. `RUBRIC.md` in the same folder sets what it may say: the dispense-mode cards, allowed and excluded uses, guard lines, material lines, caps and liners, and the claims list. The template only arranges what the rubric allows.

## The format

```
ITEM DESCRIPTION

[Sentence 1] What it is and what it's for.
[Sentence 2] The one deciding fact: how it works, or what it's not for.
[Sentence 3, optional] Care, travel or sample note.

• Included: what comes on the bottle
• Fits: neck finish; the other fitments sold for this bottle
• Glass: colour; what it does   (Material, for aluminum and metal)
• Good to know: an extra verified fact   (4th bullet, only when there is one)
```

**Why this shape.** The three sources in section 1 agree on it:

- **Shopify:** a short opening paragraph of two to three sentences, then scannable bullets; 50–100 words for simple, low-cost items.
- **Amazon:** bullets written as "Header: description", with no end punctuation and no claims that can't be verified.
- **Baymard:** buyers decide on compatibility, materials and what is included. Those are the three standard bullets.

The same text also serves places without room for a list, such as quick view, catalogue compare and Grace: those show the paragraph alone.

## 1. What each source asks for, and where the template does it

| Guideline | Source | Where the template applies it |
|---|---|---|
| Answer "why should I buy this?" in the first sentence; open with the product's use or benefit | Shopify | Sentence 1 says what the item is for |
| Opening paragraph, then scannable bullets for features and specifications; detailed specs in an expandable section | Shopify | Paragraph + bullets; dimensions, weight and case pack stay in the Tech sheet |
| Paragraphs of two to three sentences at most for mobile | Shopify | The paragraph is two or three sentences |
| Simple, low-cost items need 50 to 100 words | Shopify | About 35 to 90 words across paragraph and bullets; the Tech sheet carries the specs |
| Can a shopper scan it in 10 seconds, and does it work on a phone? | Shopify | Bullets of 110 characters or less, which is two lines on a phone |
| At least three bullets | Amazon | Three bullets as standard, up to four; two only when nothing else is verified |
| "Header with a colon followed by a description" | Amazon | `Label: text` with a fixed set of labels |
| Begin with a capital; sentence fragment; no end punctuation; semicolons to join phrases | Amazon | Bullet style rules |
| Space between digit and unit ("60 ml"); no abbreviations ("w/", "approx.", "qty"); no all caps, special characters or emojis | Amazon | Style rules and lint |
| Each bullet gives unique information; minimise duplication with the title and other attributes; keep data consistent across variants | Amazon | One fact type per label; sentence 1 does not repeat the title's capacity, glass or family; same labels on every SKU |
| Avoid subjective, performance or comparative claims unless verifiable; no "anti-bacterial" or "eco-friendly"; no guarantees | Amazon | The claims list in RUBRIC.md §5 |
| Give compatibility information, complete and in a form users understand | Baymard | **Fits**: the neck finish, plus the fitments actually sold for this bottle |
| Give materials | Baymard | **Glass** or **Material** |
| Say what is included, and make clear that optional items are extra | Baymard | **Included**, and "sold for this bottle" in Fits |
| Translate dimensions into plain language ("slides easily into your purse"); label measurements with units | Baymard | The size phrase in sentence 1; measurements with units in the Tech sheet |
| Structure by a few key highlights, with secondary features listed separately, to avoid a "feature dump" | Baymard | Three or four fixed bullets; everything else in the Tech sheet |

Shopify's article is written to sell: it recommends sensory language, a story, and addressing the reader as "you". This template takes its structure and scannability rules, not its persuasion techniques, because the brief is informative copy, not sales copy.

---

---

## 2. One record per SKU

The generator builds one record per SKU, and both the full description and the paragraph-only version come from it.

| Field | Content | Comes from (RUBRIC.md) | Required |
|---|---|---|---|
| `sentences[0]` | "A {type phrase} for {two to four uses}{, size phrase}." | Dispense mode (§4.2), liquid classes (§4.1), size band (§4.3) | Always |
| `sentences[1]` | The deciding fact: the mode's guard; otherwise its mechanism line; otherwise a legacy flag | Mode card, §5 priority | Always |
| `sentences[2]` | Care, travel or sample note | Carry behaviour (§4.6), mode card | Only when the mode has one |
| `included` | Fitment with its finish, then the cap, overcap or lid, then ", packed unattached" when there is a fitment (nothing ships fitted) | `applicator`, `capColor`, `capStyle`, caps and liners (§4.7) | Always |
| `fits` | "{neck} neck; also takes the {fitments} sold for this bottle" | Neck system (§4.5) | When other fitments are sold for the same bottle |
| `glass` | "{Colour}; {what it does}", or `Material` for aluminum and metal shells | Glass and material (§4.4) | Always |
| `goodToKnow` | One extra verified fact: a lined cap, hand made, engravable, weighted base | Legacy flags, §4.7 | Only when there is one |

**How Fits is computed.** The list covers the same family, capacity, neck and glass colour, and names a screw cap when a cap-only SKU exists at that neck. Today's family profile ignores colour and leaves caps out; the code change in section 7 fixes that.

---

## 3. Rules

### Paragraph

- **Length:** two or three sentences, 20 to 55 words.
- **Sentence 1** starts with the type phrase (table below), then "for", then two to four uses from the mode card, then the size phrase.
  - At 5 ml and under, and for every vial, samples lead: "A roll-on bottle for samples and promotional giveaways of perfume oil, attar and carrier-oil blends."
  - Beard oil is named wherever the mode card lists it: droppers, pour bottles and pour bottles with a reducer.
  - Don't repeat capacity, glass colour or family. The page title right above already says "9 ml Amber Cylinder Roll-On Bottle". The one exception is sizes buyers name in ounces or drams ("in the common 1 oz size", "A 1 dram vial").
- **Sentence 2** is exactly one deciding fact, chosen by the priority in RUBRIC.md §5:
  1. the guard
  2. the mechanism
  3. a legacy flag
- **Sentence 3** appears only when there is a care, travel or sample note that sentence 2 didn't use.
- **Style:** no measurements in mm, no case count, no price, no em dashes, no exclamation points, no superlatives.

### Bullets

- **Count:** three as standard, never more than four. Two is fine when nothing else is verified.
- **Order and labels:** always Included, Fits, Glass (or Material), Good to know. Use no other labels.
- **Text:** starts with a capital, no end punctuation, and a semicolon joins two phrases. Each bullet is 110 characters or less, counting the label (two lines on a phone).
- **No repeats:** never repeat a fact from the paragraph, the page title or the Tech Sheet (dimensions, weight, case pack, price).
- **Good to know** is only for an extra verified fact: the lined cap, hand made, engravable, weighted base. The guard lives in sentence 2, not here.

### Glass lines

| Glass | Bullet text |
|---|---|
| Amber | "Amber; reduces the light that reaches the contents" (or "the oil" on oil-only modes) |
| Clear | "Clear; shows the fill level" (jars: "Clear; shows the product inside") |
| Frosted | "Frosted; a surface finish, not a light filter" |
| Cobalt blue | "Cobalt blue" (colour only; never a protection claim) |
| Swirl | "Swirl; a spiral moulded into the glass" |
| Green, pink, black and other colours | The colour only |
| Aluminum | Material: "Aluminum; dents rather than shatters" |
| Metal atomizer | Material: "{Colour} metal shell" |

### Type phrases

| Dispense mode | Type phrase |
|---|---|
| ROLL | roll-on bottle |
| MIST | fine-mist spray bottle |
| PUMP-SPRAY | perfume spray bottle |
| BULB | vintage-style bulb-spray bottle |
| SPLASH | pour bottle with an orifice reducer |
| PUMP-LOTION | lotion-pump bottle |
| DROP | dropper bottle |
| POUR | pour bottle (any glass bottle sold with only a screw cap; the oil is poured into the hand) |
| STOPPER | stoppered bottle ("stoppered apothecary bottle" when the family is Apothecary) |
| DAB | sample vial with a glass dab-on rod (the one DAB SKU is the 9 ml glass-rod vial) |
| VIAL | "{n} dram vial" when the catalogue names the size in drams ("1 dram vial", "5/8 dram vial"), otherwise "sample vial" |
| JAR | cream jar |
| ATOMIZER | refillable travel atomizer |
| STOCK | stock bottle (cap-only bottles over 100 ml) |

### Size phrases

These follow the size bands in RUBRIC.md §4.3.

| Band | Phrase |
|---|---|
| 5 ml or less, and every vial | Samples lead: "for samples and promotional giveaways of {liquids}"; vials add "testers" |
| 6 to 9 ml | "sized for samples, promotions and travel" |
| 10 to 15 ml | "sized for decants, promotions and travel" |
| 25 to 60 ml | None, or "in the common 1 oz size" at 30 ml and "2 oz" at 60 ml |
| 78 to 128 ml | "at full retail size" |
| Over 130 ml | "for stock or refills" |

---

## 4. Where it sits on the product page

In the details column (`PdpProductInfo`):

1. Item type line
2. Paragraph
3. Bullets
4. Care note (from 2026-09-28): the one warning line, in the editorial serif

Below them come the Tech sheet (capacity, neck finish, glass, fitment, heights, diameter, weight, case pack) and the dimension drawing.

- **Markup.** Render the bullets as a real list (`<ul>`), so screen readers announce "list, 4 items". Set the label in semibold and the text in regular weight. Shopify recommends bold text and white space "to guide the customer's eye".
- **Item type line.** Once the paragraph ships, it repeats the old legacy "Item type" line. RUBRIC.md §7 item 5 covers replacing that line.
- **Later, optional.**
  - An icon per label: Baymard's "highlights" pattern.
  - Inches in brackets next to millimetres in the Tech sheet. Baymard recommends alternate units, because some users "don't really know how that would compare with inches".

---

## 5. Worked examples

There are sixteen examples: the twelve archetypes from RUBRIC.md, and four sample sizes. Each is the generator's output (`scripts/pdp-descriptions/product_copy.py`, 29 Sep production export) with the 28 and 29 Sep amendments applied; the title and option line lead, and the Care note, when the product has one, follows the bullets.

### 1. Cylinder 9 ml, amber, steel roller ball, white cap · `GBCylAmb9MtlRollWht` (ROLL)

> **9 ml Amber Cylinder Roll-On Bottle** · Steel Ball, White Cap
>
> A roll-on bottle for perfume oil, attar and carrier-oil blends, sized for samples, promotions and travel. The steel ball lays the oil on in a thin, even line.
>
> - **Included:** Steel roller ball and white cap, packed unattached
> - **Fits:** 17-415 neck; takes the plastic roller ball, fine-mist sprayer and treatment pump sold for this bottle
> - **Glass:** Amber; reduces the light that reaches the oil
>
> *Care:* Carry it capped and upright; the ball alone is not a seal.

*2 sentences, 28 words, 3 bullets, a Care note.*

### 2. Cylinder 9 ml, amber, black fine-mist sprayer · `GBCylAmb9SpryBlk` (MIST)

> **9 ml Amber Cylinder Fine-Mist Spray Bottle** · Black Sprayer
>
> A fine-mist spray bottle for eau de parfum, cologne and body mist, sized for samples, promotions and travel. The sprayer turns a thin liquid into a fine, even mist, and unscrews so the bottle can be refilled.
>
> - **Included:** Black fine-mist sprayer and plastic overcap, packed unattached
> - **Fits:** 17-415 neck; takes the steel and plastic roller balls and treatment pump sold for this bottle
> - **Glass:** Amber; reduces the light that reaches the contents
>
> *Care:* Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.

*2 sentences, 37 words, 3 bullets, a Care note.*

### 3. Circle 100 ml, clear, black vintage-style bulb sprayer · `GBCrcl100AnSpBlk` (BULB)

> **100 ml Clear Circle Vintage-Style Bulb Sprayer** · Black Bulb
>
> A vintage-style bulb-spray bottle for eau de parfum and cologne kept on a dressing table, and for display or gifts. Squeeze the bulb to spray.
>
> - **Included:** Black bulb sprayer, packed unattached, and a black travel cap
> - **Fits:** 18-415 neck; takes the fine-mist sprayer, lotion pump and reducer sold for this bottle
> - **Glass:** Clear; shows the fill level
>
> *Care:* To carry it, take off the bulb and fit the travel cap.

*2 sentences, 25 words, 3 bullets, a Care note.* The bulb ships unattached with a travel cap, so the Care note says how to carry it; the cap's colour follows the bulb, an assumption to confirm (amendments, 29 Sep).

### 4. Circle 100 ml, clear, orifice reducer, pink faux-leather cap (pour with reducer) · `GBCrcl100RdcrPnkLthr` (SPLASH)

> **100 ml Clear Circle Pour Bottle with Reducer** · Pink Cap
>
> A pour bottle with an orifice reducer for splash cologne, aftershave, perfume oil and beard oil, at full retail size. The reducer turns a pour into a controlled splash or drip.
>
> - **Included:** Orifice reducer and pink cap, packed unattached
> - **Fits:** 18-415 neck; takes the fine-mist sprayer, lotion pump and bulb sprayer sold for this bottle
> - **Glass:** Clear; shows the fill level
> - **Good to know:** The liner seals the neck when capped
>
> *Care:* Very thick oils drip slowly through the reducer.

*2 sentences, 31 words, 4 bullets, a Care note.*

### 5. Circle 50 ml, clear, matte silver perfume spray pump · `GBCrcl50SpryMtSl` (PUMP-SPRAY)

> **50 ml Clear Circle Perfume Spray Bottle** · Matte Silver Sprayer
>
> A perfume spray bottle for eau de parfum, eau de toilette and cologne. The sprayer turns a thin liquid into a fine, even mist, and unscrews so the bottle can be refilled.
>
> - **Included:** Matte silver fine-mist sprayer, packed unattached
> - **Fits:** 18-415 neck; takes the lotion pump, bulb sprayer, dropper and reducer sold for this bottle
> - **Glass:** Clear; shows the fill level
>
> *Care:* Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.

*2 sentences, 32 words, 3 bullets, a Care note.*

### 6. Circle 100 ml, frosted, lotion pump, clear overcap · `LBCrclFrst100LtnClOvrCap` (PUMP-LOTION)

> **100 ml Frosted Circle Lotion Pump Bottle** · Pump with Clear Overcap
>
> A lotion-pump bottle for body lotion, liquid soap and serums, at full retail size. Press the pump to dispense; there is no need to tip the bottle.
>
> - **Included:** Lotion pump and clear overcap, packed unattached
> - **Fits:** 18-415 neck; takes the fine-mist sprayer, bulb sprayer and reducer sold for this bottle
> - **Glass:** Frosted; a surface finish, not a light filter
>
> *Care:* For liquids that pour; thick creams and body butters belong in a jar.

*2 sentences, 27 words, 3 bullets, a Care note.*

### 7. Boston Round 30 ml, amber, dropper · `GBBstnAmb1ozBlkDrpShnGl` (DROP)

> **30 ml (1 oz) Amber Boston Round Dropper Bottle** · Black Bulb, Shiny Gold Collar
>
> A dropper bottle for essential oils, beard oil and facial serums, in the common 1 oz size. The glass pipette lets the oil out a drop at a time.
>
> - **Included:** Glass pipette dropper, black bulb and shiny gold collar, packed unattached
> - **Fits:** 20-400 neck; takes the steel and plastic roller balls and caps sold for this bottle
> - **Glass:** Amber; reduces the light that reaches the oil
>
> *Care:* Store it upright; undiluted essential oil can soften the bulb over time.

*2 sentences, 29 words, 3 bullets, a Care note.* The bulb material is not known, so the copy says "bulb", never "rubber bulb" (amendments, 29 Sep).

### 8. Boston Round 30 ml, amber, short black cap (pour) · `GBBstnAmb1ozBlkCapSht` (POUR)

> **30 ml (1 oz) Amber Boston Round Pour Bottle** · Short Black Cap
>
> A pour bottle for beard oil, hair oil and essential oils, in the common 1 oz size. It has no fitment, so the oil pours straight from the neck into the hand.
>
> - **Included:** Short black screw cap
> - **Fits:** 20-400 neck; takes the steel and plastic roller balls and dropper sold for this bottle
> - **Glass:** Amber; reduces the light that reaches the oil
> - **Good to know:** The liner seals the neck when capped

*2 sentences, 32 words, 4 bullets.* Boston Round caps have a liner (29 Sep), so the liner line is the fourth bullet (RUBRIC.md §4.7).

### 9. Apothecary 15 ml, cobalt blue, ground-glass stopper · `GB15ApthBlue` (STOPPER)

> **15 ml Cobalt Blue Apothecary Bottle with Glass Stopper** · Cobalt Blue Glass Stopper
>
> A stoppered apothecary bottle for perfume oil and attar kept on a dressing table or shelf, and for display. The glass stopper sits in a ground-glass neck.
>
> - **Included:** Cobalt blue glass stopper
> - **Glass:** Cobalt blue
> - **Good to know:** Made by hand; each stopper is ground to its own bottle
>
> *Care:* The stopper seats by friction and is not leak-proof, so it is not a travel bottle.

*2 sentences, 27 words, 3 bullets, a Care note.*

### 10. Metal-shell atomizer 10 ml, black · `GBAtom10Blk` (ATOMIZER)

> **10 ml Travel Atomizer** · Black
>
> A refillable travel atomizer for decants of eau de parfum or cologne carried in a bag or pocket, and for gifts and promotions. A metal shell covers the glass vial, which refills from the top. The shell can be laser-engraved.
>
> - **Included:** Sprayer and cap
> - **Material:** Black metal shell over a glass vial
>
> *Care:* Carry it capped and upright.

*3 sentences, 40 words, 2 bullets, a Care note.* Atomizers refill from the top (29 Sep), so sentence 2 says so.

### 11. 1 dram vial (4 ml), amber, short white cap · `GBVAmb1DrmWhtCapSht` (VIAL)

> **1 Dram (4 ml) Amber Vial** · Short White Cap
>
> A 1 dram vial for samples, testers and promotional giveaways of eau de parfum, perfume oil and essential oil. Fill it with a pipette or a small funnel.
>
> - **Included:** Short white screw cap
> - **Fits:** 13-425 neck; takes the dropper sold for this bottle
> - **Glass:** Amber; reduces the light that reaches the contents

*2 sentences, 28 words, 3 bullets.*

### 12. Cream jar 15 ml, clear, pink lid · `CJClr15Pnk` (JAR)

> **15 ml Clear Cream Jar** · Pink Lid
>
> A cream jar for cream, balm, body butter and solid perfume, sized for samples and travel. The wide mouth takes a spatula or a fingertip.
>
> - **Included:** Pink screw lid
> - **Glass:** Clear; shows the product inside

*2 sentences, 25 words, 2 bullets.*

### 13. Cylinder 5 ml, clear, steel roller ball (sample size) · `GBCyl5MtlRollBlkSh` (ROLL)

> **5 ml Clear Cylinder Roll-On Bottle** · Steel Ball, Shiny Black Cap
>
> A roll-on bottle for samples and promotional giveaways of perfume oil, attar and roll-on blends. The steel ball lays the oil on in a thin, even line.
>
> - **Included:** Steel roller ball and shiny black cap, packed unattached
> - **Fits:** 13-415 neck; takes the plastic roller ball, fine-mist sprayer and caps sold for this bottle
> - **Glass:** Clear; shows the fill level
>
> *Care:* Carry it capped and upright; the ball alone is not a seal.

*2 sentences, 27 words, 3 bullets, a Care note.*

### 14. Cylinder 3.3 ml, clear, black fine-mist sprayer (sample size) · `GBSpry3mlClBlk` (MIST)

> **3 ml Clear Cylinder Fine-Mist Spray Bottle** · Black Sprayer
>
> A fine-mist spray bottle for samples and promotional giveaways of eau de parfum, cologne and body mist. The sprayer turns a thin liquid into a fine, even mist.
>
> - **Included:** Black fine-mist sprayer, packed unattached
> - **Glass:** Clear; shows the fill level
>
> *Care:* Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.

*2 sentences, 28 words, 2 bullets, a Care note.*

### 15. Cylinder 5 ml, clear, short black ribbed cap (pour, sample size) · `GBCyl5BlkSht` (POUR)

> **5 ml Clear Cylinder Pour Bottle** · Short Ribbed Black Cap
>
> A pour bottle for samples and promotional giveaways of perfume oil, attar and beard oil. It has no fitment, so the oil pours straight from the neck into the hand.
>
> - **Included:** Short ribbed black cap with a white liner
> - **Fits:** 13-415 neck; takes the steel and plastic roller balls and fine-mist sprayer sold for this bottle
> - **Glass:** Clear; shows the fill level
> - **Good to know:** The liner seals the neck when capped

*2 sentences, 30 words, 4 bullets.* The lined cap is the extra verified fact, so this one gets the fourth bullet (RUBRIC.md §4.7).

### 16. 9 ml clear vial, black cap with glass rod (sample vial) · `GB09BlackCapApp` (VIAL)

> **9 ml Clear Sample Vial with Glass Rod** · Black Cap
>
> A sample vial with a glass dab-on rod for samples, testers and promotional giveaways of perfume oil and attar. Dab straight from the glass rod; the cap closes the neck between uses.
>
> - **Included:** Black screw cap with a glass rod
> - **Fits:** 18-400 neck; takes the caps sold for this bottle
> - **Glass:** Clear; shows the fill level

*2 sentences, 32 words, 3 bullets.* This is the one exception to the 5 ml sample cutoff.

---

## 6. Checklist before publishing

The Phase 2 test in RUBRIC.md §8 enforces this.

- **Paragraph:**
  - Two or three sentences, 20 to 55 words.
  - Sentence 1 starts with the type phrase for the SKU's mode and contains "for".
  - It does not repeat the capacity or glass colour from the page title.
- **Bullets:**
  - Two to four, with labels from the fixed list in the fixed order.
  - Each 110 characters or less, with no end punctuation.
  - No fact appears twice across the paragraph, the bullets and the Tech Sheet.
- **Both:** no millimetres, case count or price.
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

## 7. What changes in the code

- `compose.ts` returns the record in section 2 and renders the paragraph and the bullets.
- `data/descriptions/pdp/item-descriptions.json` gains `sentences` and `bullets: [{ label, text }]`. `description` holds the paragraph, so existing callers keep working.
- `PdpProductInfo` renders the paragraph, then a `<ul>` of the bullets. The label is in semibold. A SKU without bullets falls back to `description`.
- Fits is computed per family, capacity, neck and glass colour, and includes a screw cap when a cap-only SKU exists at that neck.

---

## Sources

- Baymard Institute, "Structuring Product Page Descriptions by 'Highlights' Increases User Engagement (Yet 78% of Sites Don't)", 2018. https://baymard.com/research-articles/structure-descriptions-by-highlights
- Baymard Institute, "10% of E-Commerce Sites Have Product Descriptions That Are Insufficient for Users' Needs", 2021. https://baymard.com/research-articles/product-descriptions
- Shopify, "How to Write a Product Description That Sells (2026)", updated 2026-01-30. https://www.shopify.com/blog/8211159-9-simple-ways-to-write-product-descriptions-that-sell
- Amazon Seller Central, "Product bullet point requirements". https://sellercentral.amazon.com/help/hub/reference/external/GX5L8BF8GLMML6CX
- Amazon Seller Central, "Product detail page rules": titles of 75 characters or less, and item highlights of 125 characters. https://sellercentral.amazon.com/help/hub/reference/external/G200390640
