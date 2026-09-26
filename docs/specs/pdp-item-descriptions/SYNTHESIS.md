# Synthesis: one direction for product information

Status: proposed · 2026-09-26

**What this brings together:**
- **The neck-thread sheets of 23 September 2026:**
  - 13-415, 15-415, 17-415 and 18-415 (the four PDFs Best Bottles sent).
  - 18-400, 20-400, the small-format necks (13-425, 8-425, 12 mm), and the 16 mm roller and 20-410 aluminum sheets.
  - Sources and remedy registers: `data/register/source/neck-thread-2026-09-23/`.
- **The component register, rebuilt 25 September** (`data/register/`): 94 bodies, 142 components and 2,016 verified assemblies, keyed by neck finish.
- **The copy standard** (`COPY-STRATEGY.md`, `TEMPLATE.md`, `RUBRIC.md`) and the print plan (`../print-collateral/PRINT-PLAN.md`).
- **A legacy-site screenshot** of the apothecary section, 26 September.

---

## The direction, in six points

1. **The component register is the single source of fit.** It is built from Convex and checked against the neck sheets, one record per body, component and sellable assembly. These all read it:
   - the Fits bullet in every item description
   - the fit charts in print
   - the "What fits what" pages
   - Grace's answers
   - the bottle builder

   The `fitmentsAtNeck` list in `family-profiles.json` is retired; it ignored glass colour and caps.
2. **Neck first for fit, family first for browsing.** Buyers browse by shape and use, but parts follow the neck finish across families; that is the sheets' organising idea. The site and the catalogue keep family pages, and add a neck-finish chapter built the way the sheets are: parts, then the neck, then the bottles.
3. **Only a verified assembly is called a fit.** A matching thread makes a candidate, never a promise. The sheets say this on every page, and the register marks each assembly `verified`, `candidate`, `exception` or `quarantine`. Copy and print show `verified` only.
4. **One vocabulary** across the sheets, Convex labels shown to customers, the site, the channels and print (section 3). The sheets, the register and the copy standard disagree in a few places today.
5. **Fix the P1 data defects before generating copy or print at scale** (section 5). Several of them would put wrong parts into Fits bullets and fit charts.
6. **One print design system.** The printed catalogue keeps the neck sheets' content model: component rail, then the neck, then the bottle cards. It is set in the brand system from DESIGN.md ("The Material Ledger"), so every printed page looks like one book.

---

## 1. What the sheets and the register establish

### 1.1 Necks where parts are shared across bottles

| Neck | Bottles (current) | Parts that screw on | Verified assemblies |
|---|---|---|---|
| **13-415** | Cylinder 5; Tall Cylinder 9; Sleek 5, 8; Tulip 5, 6; Pillar 9; Bell 10; Rectangle and Tall Rectangle 10; Royal 13; Circle, Elegant, Flair, Square 15 ml (15 formats) | 9 roll-on caps (6 solid, 3 dotted) over a plastic or steel roller insert; 8 fine-mist sprayers; 2 short ribbed caps (black, white); 6 short lined caps; 2 tall lined caps (gold, silver; 24 mm) | 498 |
| **15-415** | Circle 30; Elegant 30 clear and frosted | 5 fine-mist sprayers; 2 lined caps (shiny gold, shiny silver; phenolic); a black ribbed lined cap confirmed by the owner, SKU pending | 21 |
| **17-415** | Cylinder 9 ml in clear, amber, cobalt blue, frosted and swirl | 10 roll-on caps (7 solid, 3 dotted) over a plastic or steel insert; 6 fine-mist sprayers; 3 treatment pumps. 29 options per glass finish | 144 |
| **18-400** | Boston Round 15 ml; 9 ml vial | 6 droppers (66 mm stem); short black cap; black cap with glass rod (vial) | 17 |
| **18-415** | Circle 50, 100; Cylinder 25, 50, 100; Diamond 60; Diva 30, 46, 100; Elegant 60, 100; Empire 50, 100; Grace 55; Round 78, 128; Sleek and Slim 30, 50, 100 ml (22 formats) | 5 faux-leather caps; 6 lined caps plus a short shiny-black cap seen on assemblies; reducer insert; 6 fine-mist sprayers; 7 lotion pumps; 9 vintage bulb sprayers; 9 with tassel; 3 droppers (copper, gold, silver collar) | 1,225 |
| **20-400** | Boston Round 30, 60 ml | 6 tall roll-on caps over a plastic or steel insert; 12 droppers (6 finishes × 2 stem lengths: 76 mm for 30 ml, 90 mm for 60 ml); short black cap (a separate SKU for each size) | 107 |

**Exception:** the two 30 ml Cylinder spray products (`GBSpry1ozGl`, `GBSpry1ozSl`) are on 18-415 but have a fixed top and base. They do not take the other 18-415 parts; the register marks them `exception`.

### 1.2 Sold as complete sets (no loose parts in the catalogue)

| Neck | Bottles | Parts |
|---|---|---|
| 16 mm | Cylinder 28, 50 ml | Steel or plastic roller ball, black or white cap (8 assemblies) |
| 12 mm | Cylinder 3, 4 ml | Fine-mist sprayer, black or white top (4) |
| 13-425 | Vials 2–4 ml | Short black or white cap; black dropper on a 4 ml (16) |
| 8-425 | Vials 2 ml | 5 short and tall caps (4) |
| Plug | Vials 1 ml | Plug (4) |

### 1.3 Their own class (Jordan's rulings of 24–25 September, plus one open)

- **Plastic bottles, travel atomizers, aluminum bottles (20-410) and cream jars** are their own compatibility classes. A matching neck does not make glass-bottle parts fit them.
- **Ground-glass stopper bottles are not yet ruled.** They are Apothecary 15, 30 and 118 ml, Teardrop and Rectangle 9 ml, Genie 32 ml, Eternal Flame 35 ml and Pear 355 ml (8 bodies, 17 assemblies). The register quarantines them: "non-thread neck, classify before composing". Decision D5 proposes the same ruling for them.

### 1.4 Measurements

The register holds a height without cap and a diameter or width for every current body, taken from the published product pages the sheets checked. Examples:
- Boston Round: 68 mm (15 ml), 78 mm (30 ml), 94 mm (60 ml).
- Cylinder 9 ml on 17-415: 70 mm, or 74 mm in frosted and swirl.

This is the source for the approved Tech Sheet additions (COPY-STRATEGY decision 5): millimetres from the register, inches computed. Overflow capacity and label panel are not in it yet.

---

## 2. Where the sources disagree, and the resolution

| Topic | Neck sheets | Convex and register | Copy standard | Resolution |
|---|---|---|---|---|
| The six short 13-415 caps | Printed 13-415 sheet: "**Short metal caps**". Its own cap review says "Short liner cap" | No component records; 29 assemblies unresolved | RUBRIC 4.7: "short lined cap"; never "metal caps" (Jordan) | **"Short lined cap."** Relabel the printed sheet; create the six component records |
| 13-415 gold and silver 24 mm caps | "Tall liner caps", foam liner | Filed as Roll-On Cap | "Tall lined cap" | **"Tall lined cap."** Reclassify in Convex |
| 15-415 caps | "Liner caps", phenolic, owner-confirmed | Filed as Roll-On Cap | No liner wording until confirmed | **"Lined cap."** The owner has now confirmed; reclassify |
| 18-415 plain caps | Working label "Travel / liner caps". The site describes foam liners; "metal caps" was retired as inaccurate | `cap` | No liner wording until confirmed | **"Lined cap"** (short or tall). Avoid "travel cap": the site uses it for the protective cap shipped on vintage sprayers |
| Sprayers | "Fine-mist sprayer" on every neck, as on the old accessories page | "Perfume Spray Pump" on 15-415 (15) and most 18-415 (168); "Fine Mist Sprayer" on 13-415, 17-415, 12 mm and 9 rows on 18-415 | Part "perfume spray pump" (PUMP-SPRAY) or "fine-mist sprayer" (MIST) | **Decision D2:** one part name, "fine-mist sprayer"; the title noun follows size (below) |
| Pumps | 17-415 "treatment pumps"; 18-415 "treatment / lotion pumps" | "Lotion Pump"; the three 17-415 pumps are filed as Roll-On Cap | "Lotion Pump Bottle" | **Decision D3:** "treatment pump" on the 9 ml Cylinder, "lotion pump" on 18-415 |
| Dropper finishes | Collar in the bulb's colour, shiny gold or shiny silver (18-400, 20-400); copper, gold or silver collar (18-415) | Correct in the inventories; one Grace ID says 90 mm for a 66 mm dropper | "Glass pipette dropper, rubber bulb and {finish} collar" | Consistent. Add stem length to the Tech Sheet |
| Roll-ons | An outer cap over a separate plastic or steel insert | Caps tied to the plastic ball only; inserts not modelled as parts | "Steel Ball" / "Plastic Ball", then "{Finish} Cap" | Consistent. The register models the insert; Convex follows |
| Reducer | A separate insert under a cap, not a cap finish | Hidden inside assemblies | "Orifice reducer and {finish} cap" | Consistent |
| Bulb sprayers | "Vintage bulb sprayers", 9 colours, with or without tassel | 9 + 9 components | "Vintage Bulb Spray Bottle" (locked today) | Consistent; the sheets confirm the lock |
| Neck notation | "16 mm", "12 mm", "20-410" | `16mm`, `12mm` | Lint rule: always `NN-NNN` | **Amend the lint rule:** GPI finishes as "18-415"; other necks as "16 mm" |
| Spray and pump attachment | Sold as separate parts by thread | Separate component SKUs per thread | RUBRIC open question: screw-on or crimped? | **Screw-on.** The refill line is allowed on thread-neck sprays and pumps: "The sprayer unscrews, so the bottle can be refilled." Not on sold-complete sets or the 30 ml exception |
| 9 ml vial (18-400) | Short cap or glass-rod cap | Lists the six 66 mm Boston droppers | DAB: sample vial | **Remove the droppers from the vial's list** (the vial is 47–50 mm tall). Fits: "short screw cap or cap with glass rod" |
| Boston Round 15 ml clear | The 18-400 rail offers six droppers | Only 2 clear assemblies against 7 in amber and in cobalt blue | Open question in the print plan | The parts exist; the clear assemblies are not listed. **Decision D6** |
| Stock | — | `GB1ozApth` and `GB1ozApthBlue` "In Stock" (25 Sep export) | — | The legacy site shows both **Out of Stock** (screenshot). **Decision D7:** one stock source for site, feeds and print |
| Capacity drift | Bell 10 ml (live) vs 12 ml (archive); 12 mm sprayer 3 ml vs 3.3 ml | Convex has 3.3 ml | — | Use 10 ml and 3 ml, as the owner set on the sheets |

**Title nouns for sprays under D2:**
- "Fine-Mist Spray Bottle" up to 15 ml: samples, decants, purse sizes.
- "Perfume Spray Bottle" from 25 ml: full retail sizes.

Size decides the noun, not the Convex applicator label, which is inconsistent today. The Included bullet always says "{finish} fine-mist sprayer". The size rule is for glass bottles; aluminum and plastic spray bottles keep "Fine-Mist Spray Bottle".

---

## 3. The vocabulary, reconciled

| Part | Customer word | Retire |
|---|---|---|
| Outer cap over a roller insert | roll-on cap | — |
| The ball fitting | steel roller ball, plastic roller ball | metal roller plug, roll-on plug |
| Plain screw cap with a liner (13-415 short and tall, 15-415, 18-415) | short lined cap, tall lined cap, lined cap | metal cap, liner cap, travel cap |
| 13-415 black and white ribbed cap | short ribbed cap (with a white liner) | — |
| Faux-leather cap (18-415) | faux-leather cap | leather cap |
| Boston Round and vial plain cap | short screw cap | closure, lid |
| Screw-on spray head | fine-mist sprayer | perfume spray pump, atomizer (for this part), microsprayer |
| Lotion head, 18-415 | lotion pump | treatment/lotion pump |
| Lotion head, 9 ml Cylinder | treatment pump | — |
| Vintage bulb head | vintage bulb sprayer (with tassel) | antique sprayer |
| Pour insert | orifice reducer | reducer plug |
| Dropper | glass pipette dropper, rubber bulb, {finish} collar; stem in mm | trim cap |
| Glass-rod cap (9 ml vial) | cap with glass rod | applicator cap |
| Stopper | ground-glass stopper | — |

Finish words stay as in COPY-STRATEGY 2.5: Matte/Shiny Black, Gold, Silver, Matte Copper, White, the dotted caps and the faux-leather colours. The sheets' short forms ("Gl M", "Sl S", "Ivy/gl") are internal only.

---

## 4. What changes

### 4.1 In the copy standard

- **Fits bullet:** built from the register's verified assemblies on the same body and glass colour. For example: "20-400 neck; also takes the steel and plastic roller balls and the short screw cap sold for this bottle". It never uses thread candidates. Sold-complete sets, own-class bottles and the 30 ml exception get their own fixed lines:
  - "Sold as a complete set"
  - "Ground-glass stopper, matched to this bottle"
  - "Fixed sprayer"
- **Good to know**, new verified facts:
  - Dropper stem by size: 66, 76 or 90 mm on the Boston rounds.
  - "The sprayer unscrews, so the bottle can be refilled" on thread-neck sprays.
  - Tall lined cap height, 24 mm.
- **Liner wording** (RUBRIC 4.7) extends to the 15-415 and 18-415 lined caps. Boston Round short screw caps still carry none.
- **Lint:** accept "{n} mm" for non-GPI necks.
- **Tech Sheet:** height and diameter from `data/register/bodies.csv`, with inches.

### 4.2 In print

- **The booklet gains a two-page "What fits what" spread.** Shared parts by neck on the left; complete sets and own classes on the right. It is in the proof now as pages 6–7, and the booklet is repaginated so its spreads face.
- **The catalogue gains a neck-finish chapter,** one spread per shared neck (13-415, 15-415, 17-415, 18-400, 18-415 across two spreads, 20-400), plus one for complete sets and own classes. It keeps the sheets' layout (component rail, neck, bottle cards) in the catalogue's type and colour. The components' pictures come from the master PSD library; 128 of the 142 current components have one.
- **Family fit charts** come from the register.
- **The existing 17 × 11 sheets** stay as the internal and trade reference. Relabel their caps per section 3 before anyone outside the team sees them.

---

## 5. Data fixes before generating at scale

These are all recorded in the remedy registers and `data/register/quarantine.csv`. Nothing has been changed in Convex.

**P1: would put wrong parts into Fits bullets or fit charts**
1. Create the six 13-415 short lined cap components. 29 assemblies cannot resolve today: `BlkShSht`, `CuSht`, `GlMattSht`, `GlSht`, `SlMattSht` and `SlSht`.
2. Reclassify the 13-415 tall lined and short ribbed caps and the 15-415 lined caps; all are filed as Roll-On Cap. Reclassify the 17-415 treatment pumps; they are filed as Roll-On Cap.
3. Tie the roll-on caps to both roller inserts (13-415, 17-415), and model the inserts as parts (13-415, 17-415, 20-400, 16 mm).
4. Create or identify the 18-415 short shiny-black cap. 29 reducer assemblies cannot resolve without it.
5. Remove the six 66 mm droppers from the 9 ml vial's component list. Correct `Droppers1ozElg` to 18-400.
6. Keep the 30 ml Cylinder spray pair out of the 18-415 matrix.
7. Resolve the 250 ml aluminum identity (`Alu250SpryBl` vs `Alu250mlSprayBlack`) and remove the whole bottle from six component lists.

**P2: wording, counts and media**
- Correct the 13-425 caps' misdirected product links.
- Align the 18-415 applicator label (9 "Fine Mist Sprayer" rows vs 168 "Perfume Spray Pump").
- Use 3 ml, not 3.3 ml, on the 12 mm Cylinder.
- The Diva 46 ml "Rng" bulb codes and the Elegant, Empire, Sleek and Slim lotion rows with clear overcaps (21 rows) name no known part.
- `GBBstnAmb1ozRollonShnBlk` is named "Cylinder design".
- Several legacy pages still print the wrong neck (for example the frosted Circle 50 ml reducer page says 18-400).
- A stock-status mismatch (D7).

---

## 6. Decisions for Best Bottles

| # | Decision | Recommendation |
|---|---|---|
| D1 | One cap vocabulary: short lined cap, tall lined cap, lined cap, short ribbed cap, roll-on cap, faux-leather cap, short screw cap. Retire "metal cap", "liner cap" and "travel cap" | Yes; relabel the 13-415, 15-415 and 18-415 sheets |
| D2 | One part name for every screw-on spray head, "fine-mist sprayer". Title noun by size: "Fine-Mist Spray Bottle" to 15 ml, "Perfume Spray Bottle" from 25 ml | Yes |
| D3 | "Treatment pump" and "Treatment Pump Bottle" on the 9 ml Cylinder; "lotion pump" on 18-415 | Yes |
| D4 | Copy and print call only verified assemblies a fit; candidates are never shown as a fit | Yes |
| D5 | Ground-glass stopper bottles become their own class, like atomizers: the stopper is matched to its bottle and never swapped | Yes (a ruling like 24–25 Sep) |
| D6 | Boston Round 15 ml clear: add the five missing dropper assemblies, or leave clear as black dropper and cap only | Best Bottles to decide; the parts exist |
| D7 | One stock source for the site, the feeds and print. `GB1ozApth` and `GB1ozApthBlue` are In Stock in Convex but Out of Stock on the legacy site | Convex, once confirmed. Print shows no stock either way; featured photos use in-stock items (the proof now shows the in-stock 15 ml apothecary bottle) |
