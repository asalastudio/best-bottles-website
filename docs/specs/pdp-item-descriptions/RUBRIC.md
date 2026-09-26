# PDP item descriptions: classification rubric and plan

Status: draft for review · 2026-09-26
Scope: the "Item description" line on the redesigned PDP (`PdpProductInfo`), one per SKU, for the 2,113 bottle and jar SKUs in 317 product groups. Components, gift packaging and tools are out of scope; they keep their cleaned legacy text.

Companion files in this folder:

- `community-research.md`: what buyers ask about bottles and applicators on Reddit, with sources.
- `use-line-audit.csv`: the 99 SKUs whose current "For ..." line contradicts the fitment or is missing.

---

## 1. The brief

- **Length.** Two or three sentences, 25 to 55 words, with a hard cap of 60.
- **Job.** Tell a buyer what the item is, what they can put in it, and the one fact that decides whether it suits their use.
- **Register.** Informative, not sales copy. There are no superlatives, no "elevate", and no calls to action.
- **Source rule.** Every word traces to a Convex field, a verified legacy-page fact, or a rule in this rubric. When a field is empty, the sentence that needs it is dropped; nothing is guessed.
- **Brand rule.** The voice guardrails in `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md` apply. Customer copy never uses the word "alcohol" or any beverage comparison.
  - Spray perfume is named by its product type: eau de parfum, eau de toilette, cologne, body mist.

### What the description no longer has to carry

The PDP already shows these facts elsewhere, so the description stops repeating them:

| Fact | Where the PDP already shows it |
|---|---|
| Capacity in ml and oz | Tech sheet, "Capacity" |
| Neck finish | Tech sheet, "Neck finish"; build strip |
| Glass colour | Tech sheet, "Glass" |
| Fitment | Tech sheet, "Fitment" |
| Height with and without cap, diameter | Tech sheet rows and the dimension drawing |
| Bottle weight | Tech sheet |
| Case pack | Tech sheet, "Case pack"; buy box |
| Price and tiers | Buy box |

In today's copy (the generator from #280, `data/descriptions/pdp/report.md`), bottle descriptions run 76 words and 6 sentences at the median. **34% of those words repeat the tech sheet or the buy box.** Dropping the repeats pays for the 2-to-3-sentence target. The words that are left go to the application, which today gets one generic "For ..." list.

---

## 2. What the catalogue holds

### Sources

- The 2026-09-25 catalogue export the current generator reads: 2,383 SKUs, including 2,113 bottles and jars in 317 groups.
- Joined to the 2026-08-06 production export (`docs/reviews/audit-2026-08-06/convex-products-for-crosscheck.json`) for category, glass colour and neck. 2,313 SKUs matched.
- Production Convex could not be read directly from this session: the environment's network policy denies `precise-raccoon-123.convex.cloud`. Phase 3 of the plan re-runs the export against production before anything ships.

### The catalogue is organised by neck system

The neck finish decides which fitments a bottle can take, so it is the backbone of the rubric.

| Neck system | Bottle SKUs | Sizes | Families | Fitments sold on it |
|---|---:|---|---|---|
| **18-415** (full-size perfume) | 1,224 | 25–128 ml | Circle, Cylinder, Diamond, Diva, Elegant, Empire, Grace, Round, Sleek, Slim | Reducer 333, bulb sprayer 279, lotion pump 212, bulb sprayer with tassel 199, perfume spray pump 168, dropper 30 |
| **13-415** (purse size) | 493 | 5–30 ml | Bell, Circle, Cylinder, Elegant, Flair, Rectangle, Royal, Sleek, Square, Tulip | Roller (steel or plastic) 288, fine-mist sprayer 126, screw cap 70, atomizer 9 |
| **17-415** | 144 | 9 ml | Cylinder, Pillar | Roller 98, fine-mist sprayer 31, lotion pump 15 |
| **20-400 / 18-400** (Boston round) | 126 | 9–60 ml | Boston Round, Circle, Vial | Roller 69, dropper 44, screw cap 11, reducer 1, glass rod 1 |
| **15-415** | 21 | 30 ml | Circle, Elegant | Perfume spray pump 15, screw cap 6 |
| **Ground glass** | 17 | 4–355 ml | Apothecary, Decorative, Rectangle, Teardrop | Glass stopper 11, other 6 |
| **Vial necks** (13-425, 8-425, plug) | 24 | 1–4 ml | Vial | Cap 20, dropper 4 |
| **Wide mouth** (20–58 mm) | 17 | 3–63 ml | Cream Jar | Lid |
| **20-410** (aluminum) | 7 | 65–500 ml | Aluminum Bottle | Lotion pump 4, fine-mist sprayer 2, cap 1 |
| **Metal-shell atomizer** | 23 | 5–10 ml | Atomizer | Built in; 9 of the 23 sit on a 13-415 neck and are also counted in that row |

Glass colour across bottle SKUs:

| Colour | SKUs |
|---|---:|
| Clear | 1,424 |
| Frosted | 398 |
| Amber | 110 |
| Cobalt blue | 107 |
| Swirl | 27 |
| Green, black, blue, pink | 20 |

About 42 combinations of fitment, size band and material occur. The largest 13 cover about 90% of bottle SKUs:

| Fitment, size band, material | SKUs |
|---|---:|
| Roller, 5–15 ml, glass | 388 |
| Bulb sprayer, 25–60 ml, glass | 262 |
| Bulb sprayer, 78–128 ml, glass | 234 |
| Reducer, 25–60 ml, glass | 191 |
| Fine-mist sprayer, 5–15 ml, glass | 155 |
| Reducer, 78–128 ml, glass | 155 |
| Lotion pump, 25–60 ml, glass | 117 |
| Perfume spray pump, 25–60 ml, glass | 105 |
| Screw cap, 5–15 ml, glass | 103 |
| Lotion pump, 78–128 ml, glass | 95 |
| Perfume spray pump, 78–128 ml, glass | 78 |
| Roller, 25–60 ml, glass | 77 |
| Dropper, 25–60 ml, glass | 62 |

---

## 3. What is wrong with today's use lines

1. **99 SKUs have a use line that contradicts the fitment or is missing.** The details are in `use-line-audit.csv`:

   | Problem | SKUs |
   |---|---:|
   | Oil uses on a fine-mist sprayer | 29 |
   | Lotion or ointment uses on a roller | 23 |
   | A product label where the use belongs ("For fine mist sprayer for use with perfume and cologne.") | 18 |
   | No use line at all | 18 |
   | Roll-on or spray use lists on a lotion pump | 6 |
   | A press-fit vial described as screw-capped | 4 |
   | Oil uses on a perfume spray pump | 1 |

2. **One list per fitment, whatever the bottle.**
   - All 334 reducer SKUs carry the same five uses.
   - All 478 bulb-sprayer SKUs list "air freshener" and "room spray". Buyers describe bulb sprayers as dressing-table pieces that cannot seal (see section 4, BULB).
   - Size and glass colour never change the use line. A 1 ml vial and a 30 ml Boston round both read "For perfume or fragrance oil, essential oil and aromatherapy."

3. **The copy is missing the facts buyers ask for most** (`community-research.md`):
   - What else fits this neck.
   - Whether the bottle travels.
   - Which liquids clog or degrade the fitment.
   - Whether the closure seals.

   Today's copy spends its words on measurements instead.

4. **Data artefacts surface in prose.** The new format removes the measurement sentence, so none of these can reach the page again:
   - A 30 ml Boston round is listed as "78 mm without the cap and 78 mm with it".
   - Fine-mist SKUs have no with-cap height.
   - One neck value reads "Size: GBPillar9BlkSht Nemat In".

---

## 4. The rubric

Every bottle SKU is classified on six keys. All six come from Convex fields that already exist (`applicator`, `capacityMl`, `color`, `category`, `family`, `neckThreadSize`), plus the legacy flags the generator already parses. No new data entry is needed to start.

| Key | Decided by | What it controls |
|---|---|---|
| **A. Dispense mode** | `applicator` (and `category` for jars, vials, atomizers) | Which liquids the item handles. This is the main key. |
| **B. Liquid class** | Allowed by the mode, ranked by the size band | The words in the "For ..." sentence |
| **C. Size band** | `capacityMl` | The use context: sample, purse, full size, stock |
| **D. Glass or material** | `color`, `category` | One allowed material line, if it earns the space |
| **E. Neck system** | `neckThreadSize` plus the family profile's `fitmentsAtNeck` | "Also takes ..." line |
| **F. Carry behaviour** | Mode, plus legacy flags (travel cap, overcap, hand made) | Travel and upright guidance |

### 4.1 Liquid classes (key B)

The customer-facing words for each class. The first column is the internal code the rules use.

| Code | Class | Words allowed in copy | Never write |
|---|---|---|---|
| L1 | Spray perfume | eau de parfum, eau de toilette, cologne, body mist, perfume (in a spray context) | "alcohol", "alcohol-based" |
| L2 | Water-thin mists | room spray, linen spray, face mist, toner, rosewater, hair mist | "air freshener" (dated; use "room spray") |
| L3 | Perfume oil and attar | perfume oil, fragrance oil, attar, oud oil | "itr" (spell as attar) |
| L4 | Undiluted essential oil | essential oil (for storage or dispensing, not skin application) | Any therapeutic or health claim |
| L5 | Diluted oil blends | oil blends diluted in a carrier, roll-on blends, massage oil, body oil | Dilution ratios, drop counts |
| L6 | Oil skincare and grooming | facial oil, serum, beard oil, hair oil, cuticle oil | "treats", "heals", any effect claim |
| L7 | Splash | splash cologne, aftershave | |
| L8 | Pourable lotions and soaps | body lotion, hand lotion, liquid soap, body wash, conditioner, cleansing oil | "creams" (they go in a jar) |
| L9 | Thick | cream, balm, body butter, salve, solid perfume | |

"Tincture" is deliberately absent. It implies an ingestible, which needs food-contact assurances we have not verified, and most tinctures raise the same brand issue as L1. The team decides this (section 7).

### 4.2 Dispense-mode cards (key A)

Each card sets what the "For ..." sentence may say (**Primary**, then **Also**), what it must never say (**Excluded**), and the candidates for the third sentence (**Deciding fact**). The Evidence line gives the thread count in `community-research.md`.

#### ROLL: roller ball (steel or plastic)

- **Convex values.** `Metal Roller Ball`, `Plastic Roller Ball`.
- **Catalogue.** 463 SKUs; 13-415, 17-415 and 20-400 necks; 5–60 ml.
- **Primary.** L3 perfume oil and attar; L5 diluted oil blends.
- **Also.** L6 (facial oil, cuticle oil) at 5–15 ml.
- **Excluded.**
  - L1 spray perfume: users report it evaporates past the ball.
  - L4 undiluted essential oil: skin application without a carrier is not something we suggest.
  - L8 and L9: lotions and ointments. 23 SKUs say this today.
- **Deciding fact, in priority order.**
  1. Carry. "Carry it capped and upright; the ball alone is not a seal."
  2. Ball material. Steel, or plastic as the lower-cost option on the same bottle. Use the "lower-cost" wording only when `plasticCheaperThanMetal` is true.
  3. Glass line (4.4) for amber.
- **Evidence.**
  - Leaks at the socket, on flights and when stored on the side (9 threads).
  - Hygiene of the ball (7).
  - Steel preferred for glide, plastic called stiffer (6).
  - The 10 ml roller is the standard blend size (6).

#### MIST: fine-mist sprayer

- **Convex values.** `Fine Mist Sprayer`.
- **Catalogue.** 167 SKUs; mostly 13-415 and 17-415; 3–30 ml, plus aluminum and plastic bottles up to 250 ml.
- **Primary.** L1 spray perfume; L2 water-thin mists.
- **Also.** Decants and samples at up to 15 ml.
- **Excluded.** L3, L4, L5 and L6 (oils); L8 and L9. There are 29 oil-on-mist SKUs today.
- **Deciding fact.**
  1. Guard. "Thin liquids only: perfume oil and undiluted essential oil clog the sprayer."
  2. Carry, when the legacy travel-cap or overcap flag is set. "Keep the overcap on in a bag."
- **Evidence.**
  - Oil clogs mist nozzles (6 + 10 threads).
  - Anything thicker than water jets instead of misting (7).
  - A 10 ml glass decant sprayer is the daily-carry format (spray segment, section 4).

#### PUMP-SPRAY: perfume spray pump

- **Convex values.** `Perfume Spray Pump`.
- **Catalogue.** 183 SKUs; 18-415 and 15-415 necks; 30–128 ml.
- **Primary.** L1 spray perfume at full retail size.
- **Also.** L2 room or linen spray.
- **Excluded.** Oils and lotions.
- **Deciding fact.**
  1. Neck system line. "The 18-415 neck also takes the lotion pump, dropper, reducer and bulb sprayer sold for this bottle."
  2. Refill line, once the attachment is confirmed. "The pump unscrews, so the bottle can be refilled."
- **Evidence.**
  - A Best Bottles buyer could not find the 15-415 sprayer for a 30 ml bottle (r/DIYfragrance 1ul6yvf).
  - Screw-on vs crimp is a live refill question (7 threads).

#### BULB: vintage-style bulb sprayer, with or without tassel

- **Convex values.** `Vintage Bulb Sprayer`, `Vintage Bulb Sprayer with Tassel`, `Antique Bulb Sprayer*`.
- **Catalogue.** 478 SKUs; 18-415; 25–128 ml. This is the largest single mode.
- **Primary.** L1 eau de parfum and cologne kept on a dressing table; display; gifts.
- **Excluded.** L2 room spray and "air freshener". Remove both from all 478 SKUs. Also all oils.
- **Deciding fact.**
  1. Guard. "The bulb does not seal the bottle, so it is not a travel bottle."
- **Evidence.**
  - "More pretty than practical."
  - Bulbs cannot seal, so the contents evaporate.
  - Bulbs draw in air and dust (7 threads).
- **Needs confirmation** from Best Bottles before it ships: do our bulb sprayers seal when not in use?

#### SPLASH: orifice reducer under a cap

- **Convex values.** `Reducer`.
- **Catalogue.** 334 SKUs; 18-415; 25–128 ml.
- **Primary.** L7 splash cologne and aftershave; L3 perfume oil; L6 beard oil.
- **Also.** L4 essential oil kept for dispensing by the drop.
- **Excluded.** L1 as a spray; L8 and L9.
- **Deciding fact.**
  1. Mechanism with its limit. "The reducer turns a pour into a controlled splash or drip; very thick oils drip slowly."
- **Evidence.**
  - Reducers are chosen over droppers for tip-over safety.
  - Drip rate depends on how thick the oil is.
  - Thick oils barely come out (8 + 7 threads).

#### DROP: glass pipette dropper with rubber bulb

- **Convex values.** `Dropper`.
- **Catalogue.** 78 bottle SKUs; 20-400, 18-415, 18-400 and 13-425 necks; 4–128 ml. The default is Boston round, 30 ml, amber or cobalt.
- **Primary.** L6 facial oil, serum, beard oil, hair oil; L5 carrier-diluted blends.
- **Also.** L3 perfume oil.
- **Excluded.** L4 undiluted essential oil *storage*; L1 and L2; L8 and L9.
- **Deciding fact.**
  1. Guard. "Undiluted essential oils soften rubber, so store those under the screw cap sold for this bottle." Only say "sold for this bottle" when a cap-only SKU exists at the same neck.
  2. Carry. "Keep it upright so the oil does not sit against the bulb."
- **Evidence.**
  - Undiluted essential oil turns rubber bulbs gooey (8+ threads, including a recent post with 2.4K upvotes).
  - A 30 ml amber Boston round with a dropper is the default beard-oil package (DIY segment, section 4).

#### PUMP-LOTION: lotion pump

- **Convex values.** `Lotion Pump`.
- **Catalogue.** 231 SKUs; 18-415, 17-415 and 20-410 necks; 9–128 ml.
- **Primary.** L8 lotion, liquid soap, cleansing oil; L6 serum, body oil, hair oil.
- **Excluded.** L1, L2 and L9 (thick creams and butters); roll-on or aromatherapy lists (6 SKUs today).
- **Deciding fact.**
  1. Guard. "It pumps liquids that pour; thick creams and body butters belong in a jar."
  2. Overcap flag, when set. "Ships with a clear overcap."
- **Evidence.** Viscosity mismatch complaints (7 threads); users find creams hard to get into pumps.

#### ATOMIZER: refillable metal-shell atomizer

- **Convex values.** `Atomizer`, `Metal Atomizer`.
- **Catalogue.** 23 SKUs; 5–10 ml.
- **Primary.** L1 decants of eau de parfum or cologne carried in a bag or pocket.
- **Excluded.** Oils.
- **Deciding fact.**
  1. The engraving flag. "The shell can be laser-engraved."
  2. Refill method, once confirmed. Bottom-fill and top-fill behave differently.
- **Evidence.** Travel atomizers leak unless upright, and the refill method is the first question buyers ask (11 threads).

#### STOPPER: ground-glass stopper

- **Convex values.** `Glass Stopper`, or a ground neck.
- **Catalogue.** 13 SKUs, plus 6 ground-neck bottles listed without a fitment.
- **Primary.** L3 perfume oil and attar, kept on a dressing table or shelf; display.
- **Excluded.** Anything that travels.
- **Deciding fact.**
  1. Guard. "The stopper seats by friction and is not leak-proof, so it is not a travel bottle." This is already verified in the current copy.
  2. Hand-made flag.

#### DAB: glass rod applicator cap

- **Convex values.** `Glass Rod`, `Applicator Cap`.
- **Catalogue.** 1 SKU.
- **Primary.** L3 attar and thick perfume oil; samples.
- **Deciding fact.** "Dab straight from the glass rod; the cap seals the neck between uses."
- **Evidence.** Buyers ask for a glass stick, not plastic, and wands suit thick oils (3 threads).

#### CAP: bottle with a screw cap and no fitment

- **Convex values.** `Cap/Closure`, `N/A`, or empty, on a bottle.
- **Catalogue.** 104 SKUs, not counting vials and jars. By size:
  - At 5–15 ml: L3 perfume oil, samples and decants; a blank to fit later.
  - Boston round at 15–60 ml: L4 essential oil storage; L3; splitting a larger bottle.
  - Above 130 ml: stock and refill.
- **Deciding fact.**
  1. Neck system line. "The 13-415 neck also takes the roll-on and fine-mist sprayer sold for this bottle."
- **Evidence.** "Which parts match" is the most-asked question across all four segments.

#### VIAL: sample vial

- **Convex values.** `family = Vial`.
- **Catalogue.** 26 SKUs; 1–4 ml.
- **Primary.** Samples, testers and swaps of L1 or L3.
- **Deciding fact.** Fill method: "Fill it with a pipette or a small funnel." Name the closure exactly: plug, screw cap, or dropper.
- **Fix.** 4 SKUs call a press-fit neck screw-capped.

#### JAR: cream jar

- **Convex values.** `category = Glass Jar`, or `family = Cream Jar`.
- **Catalogue.** 19 SKUs.
- **Primary.** L9 cream, balm, body butter, salve, solid perfume.
- **Deciding fact.** "The wide mouth takes a spatula or a fingertip."
- **No hygiene or preservation claims.** Buyers credit the formula's preservative, not the jar.

### 4.3 Size bands (key C)

The size band adds one context phrase to the "For ..." sentence and ranks the uses.

| Band | ml | Context phrase | Notes from research |
|---|---|---|---|
| Sample | ≤ 4 | "samples, testers and swaps" | Spray vials beat dab vials for sampling. |
| Purse | 5–15 | "sized for a purse or pocket", "decants" | 10 ml is the standard roller and the daily-carry decant. 5 ml is a full size for perfume oil. Attar sizes are 3, 6 and 12 ml. |
| Everyday | 25–60 | none, or "a 1 oz size" when the size is 30 ml | 30 ml (1 oz) is the default for beard oil and serums. |
| Full size | 78–128 | "full retail size", "dressing table" | |
| Stock | > 130 | "stock or refill" | |

### 4.4 Glass and material lines (key D)

Use a material line only when it changes the use. It competes for sentence 3; it never adds a fourth sentence.

| Material | Allowed line | Never say |
|---|---|---|
| Amber | "Amber glass reduces the light that reaches the contents." | "blocks all UV", "UV-proof", "preserves", "extends shelf life" |
| Cobalt blue | Colour only. If asked in FAQ: "for light-sensitive oils, amber filters more." | That cobalt protects the way amber does |
| Clear | "Clear glass shows the fill level." Useful for decants and refills. | |
| Frosted | None. Frosting is a surface finish, not a light filter. | That it protects the contents |
| Swirl, green, pink, black | None. They are decorative. | |
| Aluminum | "Aluminum dents rather than shatters." | "unbreakable", "does not break" (in today's copy); compatibility with any liquid until the liner is confirmed |
| Plastic | None until the resin is recorded. | "BPA-free means oil-safe" |

### 4.5 Neck system lines (key E)

This line answers the most common question across all four research segments: "which parts fit this bottle?"

- Template: "The {neck} neck also takes the {other fitments} sold for this bottle."
- The fitment list comes from `fitmentsAtNeck` in `family-profiles.json`, which the generator already builds. Only fitments actually sold at that family, capacity and neck are named.
- Never write "universal", "fits most", or "fits all 18 mm". 18-400, 18-410 and 18-415 are different threads.
- It is sentence 3 for CAP, and for PUMP-SPRAY when no guard applies. For other modes it is the second candidate after the guard.

### 4.6 Carry behaviour (key F)

| Mode | Travel line |
|---|---|
| STOPPER, BULB | Not a travel bottle; this is the guard. |
| ROLL, ATOMIZER, DROP | Carry capped and upright. |
| MIST | Keep the overcap on in a bag, when the SKU has one. |
| CAP, SPLASH, VIAL | No line unless a legacy flag says more. |

Words we never use for carry: leak-proof, airtight, spill-proof, TSA-approved. The only exception is "not leak-proof", which is allowed.

---

## 5. The sentence formula

**Sentence 1: identity** (up to 20 words). Capacity, glass, shape noun, fitment with its finish, and cap. The current composer's first sentence already does this; keep it.

> A 9 ml (0.3 oz) amber glass cylinder with a steel roller ball and a white cap.

**Sentence 2: application** (up to 20 words). "For" followed by two to four uses from the mode card:

- Primary uses first.
- Ranked by the size band.
- The size-band context phrase last.
- Legacy "For use with" terms are kept only when they pass the mode's allowed list; the rest are dropped.

> For perfume oil, attar and oil blends diluted in a carrier, sized for a purse or pocket.

**Sentence 3: the deciding fact** (up to 20 words). Exactly one, chosen by this priority:

1. The mode's guard: a limit that prevents a wrong purchase (BULB, STOPPER, MIST, DROP, PUMP-LOTION).
2. The neck-system line (CAP, PUMP-SPRAY).
3. The mode's mechanism line (SPLASH, DAB).
4. A legacy flag: hand made, engravable, travel cap, weighted base.
5. The material line (4.4).
6. The carry line (4.6).

When two short facts fit within 20 words they may share the sentence, joined by a semicolon. There is never a fourth sentence.

### Lint rules

A test enforces these; see Phase 2.

- 2–3 sentences, 25–55 words, hard cap 60.
- No term from the mode's Excluded list.
- Brand banned list checked with word boundaries. The 2026-05-23 regex has none, so "serum" matches `rum` and "origin" matches `gin`.
- Claims list: leak-proof (except "not leak-proof"), airtight, spill-proof, UV-proof, blocks UV, preserves, extends shelf life, sterile, ready to fill, universal, fits most, unbreakable, cosmetic-grade, medical-grade, therapeutic, child-resistant.
- No measurement in mm, no case count, no price.
- No em dashes, exclamation points or superlatives. This is the existing composer voice.

---

## 6. Worked examples

Each "before" is the live generator's text; each "after" follows this rubric. Word counts are for the "after" text.

**1. `GBCylAmb9MtlRollWht`: Cylinder 9 ml, amber, steel roller, 17-415.** (ROLL, purse band)

- *Before, 76 words:* A 9 ml (0.3 oz) amber glass cylinder, fitted with a steel roller ball and a white cap. Straight sides, so a label wraps square. The steel ball lays oil down in a thin, even line and feels cool against the skin. For perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. It stands 70 mm without the cap and 83 mm with it and 20 mm across, on a 17-415 neck. Sold assembled, 724 to a case.
- *After, 48 words:* A 9 ml (0.3 oz) amber glass cylinder with a steel roller ball and a white cap. For perfume oil, attar and oil blends diluted in a carrier, sized for a purse or pocket. Amber glass reduces the light that reaches the oil; carry it capped and upright.

**2. `GBCylAmb9SpryBlk`: Cylinder 9 ml, amber, fine-mist sprayer.** (MIST; one of the 29 contradictions)

- *Before:* "... A fine-mist pump breaks a thin liquid into a light, even spray. For perfume or fragrance oil, essential oils, aromatic oils and aromatherapy. ..."
- *After, 39 words:* A 9 ml (0.3 oz) amber glass cylinder with a black fine-mist sprayer under a plastic overcap. For eau de parfum, cologne, body mist and purse-size decants. Thin liquids only: perfume oil and undiluted essential oil clog the sprayer.

**3. `GBCrcl100AnSpBlk`: Circle 100 ml, clear, bulb sprayer.** (BULB; represents 478 SKUs)

- *Before:* "... For cologne, eau de parfum, air freshener, face and body spray and room spray. ..."
- *After, 45 words:* A 100 ml (3.38 oz) clear glass Circle bottle with a black vintage-style bulb sprayer. For eau de parfum and cologne kept on a dressing table, and for display or gifts. The bulb does not seal the bottle, so it is not a travel bottle.

**4. `GBCrcl100RdcrPnkLthr`: Circle 100 ml, orifice reducer, pink faux-leather cap.** (SPLASH)

- *After, 43 words:* A 100 ml (3.38 oz) clear glass Circle bottle with an orifice reducer under a pink faux-leather cap. For splash cologne, aftershave, perfume oil and beard oil. The reducer turns a pour into a controlled splash or drip; very thick oils drip slowly.

**5. `GBCrcl50SpryMtSl`: Circle 50 ml, perfume spray pump, 18-415.** (PUMP-SPRAY)

- *After, 46 words:* A 50 ml (1.69 oz) clear glass Circle bottle with a matte silver perfume spray pump. For eau de parfum, eau de toilette and cologne at full retail size. The 18-415 neck also takes the lotion pump, dropper, reducer and bulb sprayer sold for this bottle.

**6. `LBCrclFrst100LtnClOvrCap`: Circle 100 ml, frosted, lotion pump, clear overcap.** (PUMP-LOTION)

- *After, 42 words:* A 100 ml (3.38 oz) frosted glass Circle bottle with a lotion pump under a clear overcap. For body lotion, liquid soap, serums and body or hair oil. It pumps liquids that pour; thick creams and body butters belong in a jar.

**7. `GBBstnAmb1ozBlkDrpShnGl`: Boston Round 30 ml, amber, dropper.** (DROP)

- *After, 50 words:* A 30 ml (1 oz) amber glass Boston Round with a glass pipette dropper, a black collar and a rubber bulb. For facial oil, serums, beard oil and oil blends diluted in a carrier. Undiluted essential oils soften rubber, so store those under the screw cap sold for this bottle.

**8. `GBBstnAmb1ozBlkCapSht`: Boston Round 30 ml, amber, screw cap.** (CAP)

- *After, 40 words:* A 30 ml (1 oz) amber glass Boston Round with a black screw cap. For storing essential oils, perfume oil and blends, or splitting a larger bottle. The 20-400 neck also takes the dropper and roll-on sold for this bottle.

**9. `GBAtom10Blk`: metal-shell atomizer 10 ml.** (ATOMIZER)

- *After, 38 words:* A 10 ml (0.34 oz) refillable metal-shell atomizer with a black cap. For carrying a decant of eau de parfum or cologne in a bag or pocket. The shell can be laser-engraved with a name or a logo.

**10. `GB15ApthBlue`: apothecary 15 ml, cobalt blue, ground-glass stopper.** (STOPPER)

- *After, 47 words:* A 15 ml (0.51 oz) cobalt blue glass apothecary bottle with a ground-glass stopper, made by hand. For perfume oil, attar and essential oil kept on a dressing table or shelf. The stopper seats by friction and is not leak-proof, so it is not a travel bottle.

**11. `GB1mlAmbVialWht`: vial 1 ml, amber.** (VIAL)

- *After, 29 words:* A 1 ml (0.03 oz) amber glass vial with a white cap. For perfume and oil samples, testers and swaps. Fill it with a pipette or a small funnel.
- *Needs:* confirmation of whether the closure is a plug or a screw cap.

**12. `CJClr15Pnk`: cream jar 15 ml, clear, pink lid.** (JAR)

- *After, 31 words:* A 15 ml (0.51 oz) clear glass cream jar with a pink screw lid. For creams, balms, body butter and solid perfume. The wide mouth takes a spatula or a fingertip.

---

## 7. Decisions for the team

These are the questions where the answer changes the copy. Each has a recommendation.

1. **Show a "not for" guard in customer copy?** Recommended: yes. It is the most useful sentence for five modes, and it stops the most common mis-buys the research found: oil in a sprayer, a bulb sprayer for travel, and undiluted essential oil under a rubber bulb.
2. **Drop room spray and "air freshener" from the 478 bulb-sprayer SKUs?** Recommended: yes, pending item 3.
3. **Facts only Best Bottles can confirm.** Until each is confirmed, the line that depends on it stays out.
   - Do the bulb sprayers seal when idle?
   - Do the perfume spray pumps screw on, or are they crimped?
   - What is the dropper bulb made of: natural rubber, nitrile or silicone?
   - What plastic are the roller housings and the reducer made of?
   - How are the metal atomizers refilled: bottom-fill or top-fill?
   - Is the closure on the 1 ml vials a plug or a screw cap?
   - What liner, if any, is inside the aluminum bottles?
4. **"Tincture" as a dropper use?** Recommended: no, for the food-contact and brand reasons in 4.1.
5. **Replace the legacy "Item type" line** (for example, "Clear, frosted and colored glass roll-on bottles of capacity range about 1/3oz (from 8ml to 10ml)") with a short rubric label such as "Roll-on bottle · perfume oil and blends"? README §4.6 keeps the Best Bottles text "for now", so this is a separate decision. Recommended: yes, after the descriptions ship.

---

## 8. Plan

### Phase 1: encode the rubric (code)

- Add `src/lib/products/item-description/rubric.ts`. It holds the mode cards, liquid classes, size bands, material lines and guard lines as data, and replaces `DEFAULT_USES_BY_APPLICATOR`.
- Give `compose.ts` a three-sentence path:
  - Sentence 1 stays as it is.
  - The measurement and shipping sentences are removed. They live in the tech sheet.
  - The uses sentence filters legacy "For use with" terms through the mode's allowed list, then fills from the card.
  - Sentence 3 is chosen by the priority in section 5.
- Keep the runtime resolver order (curated JSON, then composed, then legacy) unchanged, so new SKUs get the same voice at request time.

### Phase 2: lint as a test

- Add `tests/item-description-rubric.test.ts`. It runs every row of `item-descriptions.json` through the section 5 lint rules and fails on any violation.
- Keep a snapshot of the 12 worked examples.

### Phase 3: regenerate from production

- From a machine that can reach production Convex:
  ```
  CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/pdp-descriptions/export-catalog-facts.mjs
  ```
  Then run `npx tsx scripts/pdp-descriptions/generate.ts`.
- The report gains counts by mode, by guard and by lint result.

### Phase 4: review, then ship

- Review one sample per archetype (about 42 SKUs) with Jordan and Abbas, and fold in their answers to section 7.
- Regenerate all 2,113 bottle and jar SKUs, and review the report's per-mode samples.
- Ship behind the existing curated-JSON path. No schema change is needed.

### Phase 5: fix the source data

- The 99 rows in `use-line-audit.csv`.
- The neck-value artefact on `GBPillar9BlkSht`.
- Equal with-cap and without-cap heights on Boston rounds.
- Propose optional Convex fields for the facts in item 3 of section 7: `closureAttachment`, `bulbMaterial`, `pipetteLengthMm`, `rollerHousingMaterial`. With those recorded, the guard lines stop depending on this document. This is a schema proposal for review, not a change made here.

### Out of scope here

- Components (caps, sprayers, rollers sold alone) and packaging. They can reuse the mode cards later, from the fitment's side.
- The group-level collection band text.
