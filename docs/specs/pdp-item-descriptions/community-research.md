# What buyers ask about bottles and applicators

Reddit research for the PDP item-description rubric (`RUBRIC.md`) · September 2026

## Method

- **Segments.** Four, each researched by a separate agent:
  - spray perfume (r/fragrance, r/FemFragLab, r/Perfumes, r/DIYfragrance)
  - perfume oil and attar (r/Indiemakeupandmore, r/DesiFragranceAddicts, r/PerfumeOils, r/DIYfragrance)
  - essential oils and herbal preparations (r/essentialoils, r/herbalism, r/aromatherapy)
  - DIY skincare, grooming and small makers (r/DIYBeauty, r/beardoil, r/beards, r/wicked_edge, r/SkincareAddiction, r/AsianBeauty, r/smallbusiness, r/Packaging)
- **Tools.** Firecrawl search and scrape. Agent Reach is not installed in this environment.
- **Access.** Reddit refuses direct scraping, so the agents read threads through public mirrors:
  - a Redlib mirror
  - the Arctic Shift Reddit archive
  - Wayback Machine snapshots
- **Volume.** About 120 threads read with their comments.
- **Weak spot.** The essential-oil segment is the weakest: 2 threads were read in full, and the rest are verbatim search excerpts of about 150 characters. Its findings on rubber bulbs are still consistent across 8 or more threads.
- **Brand guardrails.** Beverage references and quotes naming solvents have been left out or paraphrased here, per `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md`. That includes comparisons one agent found in a homebrewing subreddit.

---

## 1. Findings that cut across segments

### 1.1 "Which parts fit this bottle?" (all four segments)

This is the most consistent gap. Buyers measure necks by hand, guess at finish codes, and find that parts from different suppliers do not match. They rarely use neck codes themselves; they say "fit", "stem", "18mm" or "diameter".

- "I have found it very difficult to find a congruent source that offers correct sizes and easily explains which parts match." (r/Packaging cpw73q)
- "EDIT: would this work? 24-410 would mean 24 mm bottle neck i believe." (r/wicked_edge c5dl14)
- "struggling to find one that can fit thread neck size of 15-415" (r/DIYfragrance 1ul6yvf). This was a Best Bottles buyer. The sprayers were on the site, but not linked from the bottle.

*Rubric response:* the neck-system line in RUBRIC.md §4.5 names only the fitments actually sold at that family, capacity and neck, and never says "universal".

### 1.2 Leaks and travel (spray, oil, EO and DIY segments)

- **Spray.** Screw-thread decants leak at the thread; buyers add PTFE tape (13 threads). Bottom-fill travel atomizers leak unless upright (11). Pressure changes on flights push liquid out (6).
- **Oil.** Rollers leak at the socket, on flights, and when stored on their side (9).
- **Quotes:**
  - "Every travel perfume atomizer I've bought leaks unless it's standing straight up, which kind of defeats the purpose" (r/fragrance otzmiz)
  - "The pressure change is probably forcing the liquid through the socket where the roller ball sits." (r/Indiemakeupandmore cap7dj)
  - "Remove the roll on and use the other cap which seals completely." (r/DesiFragranceAddicts 1g4v3iy)

*Rubric response:* carry lines (RUBRIC.md §4.6) and a ban on "leak-proof", "airtight" and "spill-proof".

### 1.3 The liquid has to match the applicator

- **Undiluted oil in a sprayer** clogs it or sprays unevenly. This comes from the oil segment (6 threads) and the EO segment (10 or more).
- **Liquids slightly thicker than water** jet from a mister instead of misting (DIY, 7).
- **Reducers** struggle with very thin and very thick oils (oil, 6; EO, 8).
- **Lotion pumps** do not take creams; creams go in jars (DIY, 7).
- **Quotes:**
  - "Most atomizers won't work with oils, especially with the consistency of most perfume oils." (r/Indiemakeupandmore ifj67c)
  - "don't do a fine even mist because they're a bit thicker than water. They shoot out in a strong stream instead." (r/AsianBeauty 6irei1)
  - "Reducer caps are nice, but are rough with really thin or really thick oils." (r/Indiemakeupandmore 3kkicg)

*Rubric response:* each dispense mode in §4.2 has an **Excluded** list, and the guard sentence states the limit.

### 1.4 Materials that the contents attack

- **Undiluted essential oils and rubber.** Undiluted essential oils turn rubber dropper bulbs gooey or sticky. Carrier-diluted blends are fine. This is the strongest single signal in the EO segment: 8 or more threads, including a post with 2.4K upvotes this month.
  - "Don't use droppers with the rubber bulbs. The essential oils will eat the rubber. Rubber is ok for carrier oils" (r/essentialoils bongwo)
  - "The vapors from the essential oils will breakdown the rubber. They are fine when essential oils are diluted in a carrier oil" (r/essentialoils f84xza)
- **Essential oils and plastics.** They swell or soften some plastics, citrus and clove especially. Threads disagree about HDPE (10 or more threads).
- **Spray perfume and seals.** The perfume solvent degrades rubber gaskets and PTFE tape over weeks to years (7 threads).

*Rubric response:* the DROP guard (§4.2), and a ban on "oil-safe" or "essential-oil safe" until the component materials are recorded.

### 1.5 Glass colour helps less than the dark does

- Amber is expected for oils, and users say it helps "to some degree". Nearly everyone adds that a cool, dark place matters more.
- Clear glass is valued for seeing the fill level.
- Nobody claims frosted glass protects anything.
- The only comparison found ranks cobalt well below amber for filtering light.
- **Quotes:**
  - "Dark amber bottles help to some degree, but… you best bet is a cool, dark place" (r/Indiemakeupandmore 438a6t)
  - "But even more effective is just keeping the bottles away from sunlight." (r/DIYfragrance t5paw5)
  - "I prefer clear glass so I know if I'm going to run out or need to refill" (r/FemFragLab 160a799)

*Rubric response:* the material lines in §4.4 are deliberately modest: "reduces the light that reaches the contents", never "UV-proof" or "preserves".

### 1.6 Hygiene is the formula's job

- Buyers worry about rollers picking up skin cells, droppers touching the face, and fingers in jars (oil, 7 threads; DIY, 7).
- The better-informed replies credit the preservative system, not the package.
  - "even regular use on relatively clean skin will still release oils and skin cells onto the ball." (r/Indiemakeupandmore s3y2xm)
  - "I expect jar products to have a relatively stronger preservative system than something in a bottle to account for all the finger dipping" (r/AsianBeauty 6g6d3m)

*Rubric response:* no hygiene, contamination or shelf-life claims for any closure.

### 1.7 Best Bottles is mentioned by name

- "No leaks, easy to refill, decent atomizers." The same thread cites the $50 minimum as a reason to buy elsewhere. (r/fragrance otzmiz)
- A buyer could not find the 15-415 sprayer for a 30 ml bottle. (r/DIYfragrance 1ul6yvf)
- The bulb-spray page was linked as where to buy bulb bottles. (r/Perfumes 10lp1kq)
- Listed as a decant source. (r/fragrance i8m4kb)

---

## 2. Which applicator for which use, as buyers describe it

| What the buyer is filling | What buyers use | Notes |
|---|---|---|
| Eau de parfum or cologne, daily use | Fine-mist or perfume spray pump | Screw-on can be refilled; crimp reads as "professional" to small brands |
| Decant for daily carry | 5–10 ml glass screw-top sprayer | 10 ml is the favourite; 3 ml is "pocket" size |
| Travel | Metal-shell atomizer, or thick glass, part-filled | Leave headspace for flights |
| Samples and swaps | 1–2 ml spray vials | Dab vials are disliked for sampling |
| Vanity display, gift | Vintage bulb sprayer | "More pretty than practical"; cannot seal |
| Perfume oil, daily | 5–10 ml steel roller | Store upright; hygiene worries |
| Attar, thick or resinous oil | Glass rod or wand dabber | Buyers ask for glass, not plastic |
| Perfume oil collection | Reducer or dropper on the main bottle, small roller to carry | |
| Diluted essential-oil blend | 10 ml glass roller | Steel glides; plastic said to leak less |
| Undiluted essential oil | Amber glass with an orifice reducer or screw cap, upright | Not a rubber-bulb dropper |
| Facial oil, serum, beard oil | Glass pipette dropper | 30 ml amber Boston round is the beard-oil default |
| Splash aftershave | Bottle with an orifice reducer and screw cap | |
| Room, linen or face mist, rosewater | Fine-mist sprayer | Water-thin liquids only |
| Lotion, cleansing oil, liquid soap | Lotion pump | Not for creams |
| Cream, balm, body butter | Jar | |

---

## 3. Buyer vocabulary

| Buyers say | Catalogue or supplier term |
|---|---|
| atomizer, sprayer, spray top, nozzle, spritz, mister | fine-mist sprayer, perfume spray pump |
| decant, sample, 2 ml sprayer, travel spray, purse spray | glass spray vial, refillable atomizer |
| puffer, squeeze bulb, "the ball thing" | vintage bulb sprayer |
| roller, rollerball, roll-on, roller top | roller ball fitment |
| dabber, wand cap, dipstick, glass stick | glass rod applicator |
| euro dropper, reducer cap, orificer | orifice reducer |
| dropper, eye dropper, bulb, dropperful | glass pipette dropper |
| pump top, serum pump | lotion pump |
| straw, tube, stem | dip tube |
| 18mm, 20mm neck, "fit" | 18-415, 20-400 and other finishes |
| screw-top vs crimped | threaded vs crimp finish |
| splash, open top | reducer, stopper |
| Boston bottle, tincture bottle | Boston round |
| FB, FS, juice | full bottle, full size, contents |

- Buyers almost never say "neck finish", "GPI", "fitment", "minaret", "tola", "flint" or "output per stroke".
- "Dram" confuses buyers; use ml.

---

## 4. Claims to avoid

These are collected across all four segments. Every one of them was contradicted, disputed or called unverifiable by buyers.

| Claim | Why buyers reject it |
|---|---|
| leak-proof, airtight, spill-proof | Contradicted in every segment. "Not leak-proof", as a stated limit, is fine. |
| universal fit, fits most | 400, 410 and 415 threads differ, and so do reducer thicknesses. |
| UV-proof, blocks all UV, preserves, extends shelf life | Users say colour helps somewhat; dark storage is what matters. |
| cobalt protects like amber | The one comparison found ranks cobalt well below amber. |
| essential-oil safe, oil-proof plastic, BPA-free means oil-safe | Unverified; rubber and some plastics degrade. |
| hygienic, antibacterial, prevents contamination | The formula's preservative decides this. |
| sterile, sanitized, ready to fill | Buyers received dusty, unbagged parts from suppliers. |
| unbreakable, cosmetic-grade, medical-grade, child-resistant | Not claimable without certification or a stated basis. |
| fine mist with any liquid | Mist quality depends on how thin the liquid is. |
| therapeutic, dosing, dilution recipes | Health claims and dosing are not the bottle supplier's to make. |
| nominal capacity as fill volume | "5 ml rollers hold closer to 4.5 ml" (r/Indiemakeupandmore 3aog5o). |

---

## 5. Gaps only the catalogue can close

Buyers asked for these facts, and Convex does not record them today (RUBRIC.md §7 item 3 and Phase 5):

- output per spray in ml
- dip-tube and pipette length
- how much a pipette draws per squeeze
- reducer bore size
- dropper bulb material
- roller housing and ball material
- closure attachment: screw or crimp
- atomizer refill method
- aluminum liner
- fill volume vs brimful volume
- whether a plain sealing cap exists for shipping

---

## Sources

All links are `https://www.reddit.com/r/<subreddit>/comments/<id>/`.

### Spray perfume

- **Full threads:**
  - r/fragrance: 1ahmvru, 1ax7pbw, v8kg4e, tco3ho, 1g64xn2, otzmiz, l2e7ak, wui4qb, hav6mu, i8m4kb, 9r4vkb, 1m3bd7n, 1ss1cda, 16zuj0i, e65o2p, r892ot, 16d4wrm, 1w1oxir, d8l3ft, p3eyjk, 1rrj8jt, oxnzph, 11ar9jz
  - r/FemFragLab: 160a799, 1uvk54s, 1uuwu6m, 1l8l03b, 1ut3pd7
  - r/Perfumes: 10lp1kq, kthpsp, 1j2uq2b
  - r/DIYfragrance: j5y613, 1ul6yvf, 1hydixf, 13n41ti, 1vs7er1, 1qjchgn, 1nw5wvf
- **Post body only:**
  - r/DIYfragrance: 18flpxh, 1oh3ya7, 1oz68xd, 1rgrou5, 1wlcc9d
  - r/FemFragLab: 1i0lkhw, 1gbgqwo
  - r/fragranceclones: 1b5hnvl
  - r/Colognes: 1ih35h3

### Perfume oil and attar

- r/Indiemakeupandmore: 3kkicg, s3y2xm, 12gysuj, tyga15, da80tk, cap7dj, 181kw0q, ifj67c, 3aog5o, hga7h0, 1u3ymwe, gw73dg, m8pxh0, wa6old, s39k2e, xiacs2
- r/DesiFragranceAddicts: 18pgjuu, 1g4v3iy, z5j0b3, 146tq7l, 177i6nb
- r/DIYfragrance: zhd1j7, 1exfqx3, t5paw5
- r/fragrance: 1qok8e2, nbpeef
- r/PerfumeOils: nbajjv

### Essential oils and herbal

- **Full threads:**
  - r/essentialoils: f84xza
  - r/Indiemakeupandmore: 8fub4x
- **Search excerpts:**
  - r/essentialoils: bongwo, 1q5lnmw, obn9tp, kc5xdx, 958895, r22mru, 1dcjmwj, bvpd61, u45mju, 78hthr, 1qflg00, 15dt3xv, 8wcog2, 1qybthh, o790ph, cdyykz, ju01di, apwtxz, 8qnit9
  - r/herbalism: mfg7fd, 12lurkm, 1jt2luy, o7dxrk, 1vfl8lp, tt26fd, 1fyjhlu, 18s7084, uyf7ar
  - r/Indiemakeupandmore: 438a6t, tay5al, 1n4xj1a, vfbb14
  - r/DIYfragrance: 1bmays4, pzp0bc, 1llvlkp
  - r/DIYBeauty: 1jf5i7e, 4xv1sr
  - r/NaturalBeauty: hab7t4
  - r/mildlyinteresting: 1wnuty4
  - r/chemistry: 1bt74xo

### DIY skincare, grooming and makers

- r/beardoil: 5otcin, 8gtfts, 8c0eoi, 5hqmoc
- r/beards: 3e5ek0
- r/wicked_edge: c5dl14, 1c5ypf6, yfxir4
- r/DIYBeauty: 6evu2r, 64w8sb, 2s880e
- r/Entrepreneur: b8p7l6
- r/smallbusiness: cdzh7j
- r/Packaging: cpw73q
- r/SkincareAddiction: 6m3p2u, 5ulpan, eedkv9
- r/AsianBeauty: 6g6d3m, 6irei1, bw6mss, 2nw7nv
- r/Indiemakeupandmore: s3y2xm, da80tk
- r/ZeroWaste: bl2nqj
- r/DIYfragrance: 1e9nx5f, 1mcygjw
- r/candlemaking: 1ggq3ev
