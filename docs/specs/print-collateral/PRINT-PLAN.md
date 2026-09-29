# Print plan: the catalogue, the line booklet and the family inserts

Status: proposed · 2026-09-26 · proof: `prototype/boston-round-proof.pdf` (11 pages, Boston Round) · fit data: `../pdp-item-descriptions/SYNTHESIS.md`

**Companion files:** `../pdp-item-descriptions/COPY-STRATEGY.md` (names and wording; section 7.6 covers print), `../pdp-item-descriptions/TEMPLATE.md` and `RUBRIC.md` (descriptions, uses, care lines), `DESIGN.md` at the repo root (brand system).

---

## The short version

1. **Three printed pieces, one product record.** The site, Shopify, Faire, the Google feed and print all read the same Convex data and the same naming rules, so a printed page can never disagree with the product page.
   - **Family insert card** — 5 × 7 in, two sides, one card per family. It goes in the box with every order.
   - **The Line** — a 5 × 7 in, 36-page saddle-stitched booklet of the whole range. It goes in first orders, sample packs and trade-show bags, and is a PDF download.
   - **The Catalogue** — US Letter, a family spread plus a line sheet for every family, about 100 pages. It is a PDF on the site first, with short print runs for trade buyers.
2. **Generated, not typeset by hand.** The existing PDF generator (`src/lib/pdf/catalog`) gains three modes. A new family or SKU appears in print the next time the files are built.
3. **No prices in print.** Prices, stock and pack sizes change; the printed pieces point to bestbottles.com and 1-800-936-3628, and a dated price list is printed separately when needed.
4. **The proof is ready for review:** the Boston Round insert (front and back), seven booklet pages (including the "What fits what" spread) and a catalogue spread. It is built from the production catalogue (123 SKUs), the component register and the approved photography.

---

## Update, 26 September 2026 (evening): the catalogue is also the house reference

Best Bottles asked for three changes to the catalogue:
- "vintage-style bulb" and "vintage-style bulb with tassel" in place of "vintage bulb";
- the neck-sheet component matrices built in, laid out the way the sheets are;
- enough working information that the book serves the team and stakeholders as an operations manual, while still being a catalogue fit for a front or coffee table.

**Two editions from one build.**

| Edition | File | Pages | Use |
|---|---|---|---|
| House | `out/print/best-bottles-catalogue.pdf` | 152 | Print and hand over. Parts 1-5, index, back cover |
| Web | `out/print/best-bottles-catalogue-web.pdf` | 139 | The one `upload_family_guides.mjs` publishes. Parts 1-4, without the team reference |

**The book, part by part:**
1. **The range.** Contents; the range at a glance (key numbers, items by fitment and by neck, a table of every family); how to use this book; choose by use.
2. **Fit systems.**
   - What fits what, with a page reference for each neck.
   - One matrix page per shared neck (13-415, 15-415, 17-415, 18-400, 20-400) and two for 18-415, as on its sheet. Each page has:
     - part cards ("Roll-on caps / 9") with every finish photographed
     - connector lines to the "{neck} finish" rail
     - a card for each bottle, with its example item number, height and family page
     - the sheet's thread rule
   - Photographs come from the 23 September neck-sheet PDFs (`scripts/print/neck_sheets.py` reads them). 18-400 and 20-400 have no sheet PDF in the repository yet, so those two pages use the catalogue photography and say so.
3. **The families.** The 27 compatibility guides as before, each now naming the page of its neck's fit system.
4. **Parts and packaging.**
5. **Working with the range** (house edition only), for the team:
   - reading an item number (website SKU and structured code)
   - confirming a fit (seven rules and a checklist)
   - answering common customer questions
   - samples and small sizes
   - naming products, and describing products
   - every bottle measured (with case quantities and the quantity-break structure, no prices)
   - where product information lives, and how the book is rebuilt
   - a glossary

   Every line restates a rule already written in RUBRIC, COPY-STRATEGY or SYNTHESIS (`scripts/print/operations.py` lists the sources). There are no prices and no country of origin, and the book never says it is a gift.

**Held back:** the register gives the 9 ml vial (18-400) a height of 79.4 mm, but the legacy product pages give 47-50 mm with a cap, so the book prints a dash until the register is corrected.

---

## Update, 26 September 2026: family guides are built

Best Bottles asked for a downloadable compatibility guide on every family page, and for the Boston Round page design across the whole catalogue.

**The answer: one generator, two outputs, from the same pages.**

- **A guide per family** (`out/print/family-guides/<family>.pdf`, 2–14 pages each, 0.4–1.5 MB).
  - It is linked from each family page as "Compatibility guide (PDF)".
  - Each guide covers: sizes and measurements, what fits each size, finishes, use and care, glass and size photographs, the families sharing each neck, and a line sheet with every item number.
- **The complete catalogue** (`out/print/best-bottles-catalogue.pdf`, 127 pages, about 15 MB). It contains the same family sections in merchandising order, plus:
  - a cover and contents with page numbers
  - choose by use, and what fits what
  - parts sold separately, grouped by neck
  - packaging and accessories
  - an index of all 2,368 item numbers with their pages
  - a back cover

  It is one document for download and for print.
- **No page per SKU.** Every SKU is already a row in its family's line sheet, and the product page covers the single item. 2,000 near-identical pages would bury the fit information the guides exist to show.
- **Pre-built, not generated on request.** The guides are built when the catalogue changes, uploaded to Vercel Blob and listed in `src/lib/products/family-guides.json`. Rendering 100 pages with photographs on each click would be slow and fragile.
- **Brand:** the site's current wordmark lockup and Montserrat; the proof in `prototype/` has been updated to match.

The generator is `scripts/print/family_guides.py`; how to build and publish is in `scripts/print/README.md`. The family-page link is `src/components/catalog/FamilyGuideDownload.tsx`; it shows nothing until a family's guide is published.

---

## 1. What exists today

| Piece | State | Notes |
|---|---|---|
| Print catalogue, 2020 (`docs/Best Bottles Catalog.pdf`) | 48 landscape pages, 14 × 8.5 in | Organised by applicator. Legacy names ("Classic Glass Spray Bottles, Capacity: 2ml - 15ml"), "Industry use" lists, blue frames, "Click here to get started". Out of date on range and wording. |
| PDF generator (`src/lib/pdf/catalog`, `docs/PDF_CATALOG_SYSTEM.md`) | Working: lookbook, line-sheet and spec-book modes | Solid plumbing (Convex loader, Puppeteer, page presets, image waits). The layout is a grid of product cards, not family pages, and it uses the legacy names. |
| Order inserts | None | |

---

## 2. The three pieces

### 2.1 Family insert card

**Job:** tell the buyer what they bought, what else screws onto it, how to look after it, and how to reorder.

| | |
|---|---|
| Trim | 5 × 7 in, portrait; 0.125 in bleed; 0.25 in safe area |
| Sides | Two, full colour |
| Stock | 16 pt silk or 130 lb uncoated cover (see 4.3 on the bone field) |
| Quantity | One card per family per order. 27 families; print the top sellers first (needs order data) |
| Front | Three sizes photographed side by side, family name, sizes and glass colours, neck finishes, a two-sentence description |
| Back | "What fits each size" chart, finish options, use-and-care lines, glass colours, QR code and phone number to reorder, imprint |

**Rules:**
- The fit chart only shows the fitment columns the family actually has; a dash marks a size that doesn't take one.
- Care lines are RUBRIC.md's wording, one per fitment type in the family, plus the glass line.
- The QR code goes to the family page with `utm_source=print&utm_medium=insert&utm_campaign={family}`, so reorders from inserts can be measured.
- "Item numbers are on your packing slip" — the insert never lists SKUs.

### 2.2 The Line (booklet)

**Job:** the whole range in the hand: what each bottle type is for, what fits what, and one page per family.

| | |
|---|---|
| Trim | 5 × 7 in, portrait, saddle-stitched |
| Pages | 36 (a multiple of 4) |
| Stock | 100 lb silk text, 130 lb cover |
| Where it goes | First orders, sample requests, trade shows; PDF on the site |

**Page plan:**

| Pages | Content |
|---|---|
| 1 | Cover |
| 2 | Contents and how to read the book |
| 3 | Glass colours and cap finishes |
| 4–5 | Choose by use (spread): the twelve bottle types, each with its uses and one deciding fact (RUBRIC.md §4.2) |
| 6–7 | What fits what (spread): shared parts by neck finish; complete sets and own-class bottles (SYNTHESIS.md §1) |
| 8–32 | One page per family: size row, name, one-sentence description, glass, neck, case quantity, fit chart, finishes, QR |
| 33 | Samples and promotional sizes (5 ml and under, plus every vial; the 9 ml glass-rod vial) |
| 34 | Caps and closures sold separately |
| 35 | Ordering, custom work, contact |
| 36 | Back cover |

Spreads face: even pages on the left, odd on the right.

The proof's contents page lists 25 family pages. The data has 27 families, including Decorative and Lotion Bottle; the final list comes from Convex when the booklet is built, and small families share a page.

### 2.3 The Catalogue

**Job:** the complete trade reference: every SKU, every fitment, every item number.

| | |
|---|---|
| Trim | US Letter, 8.5 × 11 in, portrait |
| Pages | About 100 (see the estimate below); perfect-bound when printed |
| Format | PDF first (downloadable, searchable); print on demand in short runs |

**Structure:**
- Cover, contents, how to read the catalogue.
- Choose by use (one spread), glass and finishes (one spread).
- **What fits what, by neck finish:** one spread per shared neck (13-415, 15-415, 17-415, 18-400, 18-415 across two spreads, 20-400), plus one for complete sets and own-class bottles. It follows the 23 September neck sheets' layout (component rail, the neck, the bottle cards) in the catalogue's type and colour, and is built from the component register (`data/register/`). See `../pdp-item-descriptions/SYNTHESIS.md`.
- **Each family:** a family page, then its line sheet.
  - **Family page:** the fitment row (one size in one glass colour, with every fitment sold for that neck), family name, description, a spec row per size (neck, case quantity), the fit chart, finish options, use and care, a glass-colour row and a size row.
  - **Line sheet:** one row per fitment and finish, one column per glass colour, and the item number in each cell. About 44 rows fit on a page. Boston Round's 123 SKUs fill exactly one.
- Components sold separately (150 SKUs), packaging (49).
- Index by item number: every SKU with its page.
- Ordering and contact.

**Page estimate (August 2026 export):**
- The 27 families produce about 1,500 line-sheet rows, which is 78 family and line-sheet pages.
- The largest families are Cylinder (372 SKUs, 6 pages), Sleek (6), Elegant (5), Circle, Round, Diva and Slim (4 each).
- Front matter adds about 9 pages, components and packaging about 6, and the index about 6.

---

## 3. Copy rules for print

Everything in COPY-STRATEGY.md applies. Print adds:

| Element | Rule | Source |
|---|---|---|
| Family heading | The catalogue family name ("Boston Round") | COPY-STRATEGY 2.3 |
| A single product, named | The core title, e.g. "30 ml (1 oz) Amber Boston Round Dropper Bottle" | COPY-STRATEGY 3.1 |
| Line-sheet rows | Fitment + finish in the part vocabulary: "Steel roller ball · Matte Gold cap", "Dropper · White bulb, gold trim" | COPY-STRATEGY 2.5 |
| Family description | Sentence 1: the shape, then the uses from RUBRIC for the family's fitment types. Sentence 2: which sizes take which fitments on which neck, built from data | RUBRIC 4.1–4.2 |
| Care lines | Word for word from RUBRIC: DROP care line, ROLL carry line, POUR mechanism, glass line | RUBRIC 4.2, 4.6; TEMPLATE 3 |
| Sizes | ml first; ounces per COPY-STRATEGY 2.1 | |
| Facts | Neck from `neckThreadSize`; case quantity from `caseQuantity`; glass from `color` | Convex |
| Item numbers | Website SKUs, in IBM Plex Mono | |
| Never printed | Prices, "wholesale", promotional words, claims outside section 6, "Made in" until confirmed | COPY-STRATEGY 2.6, 6, 7.4 |
| Contact and imprint | bestbottles.com · 1-800-936-3628 · "Best Bottles · Nemat International, Inc. · Union City, California" | Site footer; bestbottles.com FAQ |

The only hand-written copy is the shape half of sentence 1 for each family ("A round bottle with sloped shoulders and a short neck"): 27 lines, physical description only, reviewed once.

---

## 4. Design

### 4.1 System

The print pieces follow DESIGN.md, "The Material Ledger":
- **Colour:** bone paper (#F5F3EF), obsidian ink (#1D1D1F), gold-dim (#8B6F42) for the small-caps labels, gold (#C5A065) for the fit-chart dots, champagne hairlines.
- **Type:** Cormorant for names and headings, Inter for text, IBM Plex Mono for neck finishes and item numbers.
- **Surfaces:** flat and ruled; no boxes, frames or drop shadows.

### 4.2 Photography

- **Source:** the approved catalogue photographs (`public/images/catalog/*-approved-*`), already shot on the bone background at the 10:11 card size.
- **Background:** at build time each photo's background is matched to the exact page colour, so bottles sit on the page with no visible panel.
- **Scale:** every row uses one crop height and one scale, so a 15 ml bottle stays smaller than a 60 ml one.
- **Resolution:** 1,100 to 1,500 px per card width, which is 300 ppi or better at the placed sizes in the proof.

### 4.3 Production

- **Bleed and safe area:** 0.125 in bleed and a 0.25 in safe area.
- **Fonts** are embedded by Chromium.
- **Colour conversion:** Chromium writes RGB PDFs. The printer converts to CMYK, or we convert to PDF/X-4 in preflight.
- **Minimum type size:** 6 pt, and 6.3 pt for item numbers.
- **The bone field is the one print risk.** A full-page tint on coated stock can print uneven or drift from the photos' background.
  - Option A: print the tint on silk stock, from a hard proof.
  - Option B: choose a paper close to bone, drop the tint, and match the photo backgrounds to the paper at build time. It is one colour value in the build.
  - Either way, get a hard proof on the chosen stock before the first run.

---

## 5. How it is generated

- **Modes:** `src/lib/pdf/catalog` gains `mode=insert`, `mode=booklet` and `mode=catalogue`, with a `card5x7` page preset. They reuse the Convex loader, the Puppeteer renderer and the existing `/api/pdf/catalog` route.
- **Fit source:** the component register (`data/register/assemblies.csv`, or its Convex tables once pushed). Only `verified` assemblies appear in a fit chart; `candidate`, `exception` and `quarantine` rows never do.
- **Family data builder:** generalised from `prototype/boston_data.py`. It groups SKUs by family, size, fitment and finish, with glass colours as columns. It reads fitment and finish from Convex fields (applicator, cap colour, trim), not from legacy item names, and fails if a SKU is dropped or two SKUs land in one cell.
- **Photo slots:** each family's slots (fitment row, glass row, size row) are listed in one JSON file. A missing approved photo shows the slot name on the page and is listed in the build report.
- **Build report:** pages per family, missing photos, and any text that overflows its box (Chromium measures it).
- **Tests:** vitest for the data builder, plus a page snapshot of the Boston Round family.
- **Naming:** it depends on `naming.ts` (COPY-STRATEGY rollout step 1), so print uses the same names as the site.

---

## 6. Data questions the proof raised

- **Boston Round 15 ml, clear:** only a black-bulb dropper and a black cap, while amber and cobalt blue carry six dropper finishes. The 18-400 neck sheet shows all six droppers exist as parts, so this is an assembly gap, not a parts gap (SYNTHESIS decision D6).
- **Shiny black steel-roller cap:** listed only on 30 ml clear and amber and 60 ml clear. Confirm.
- **`GBBstnAmb1ozRollonShnBlk`:** the legacy item name says "Cylinder design". It isn't printed (names are generated), but the record should be fixed.
- **25 ml Cylinder bulb sprayers:** 18 SKUs had no glass colour in the August export; fixed in the 25 September export.
- **Case quantities** (15 ml: 317, 30 ml: 360, 60 ml: 240): unchanged in the 25 September export; confirm before they are printed.
- **Stock:** the proof no longer features `GB1ozApthBlue`, which the legacy site shows as out of stock (Convex says in stock; SYNTHESIS decision D7).

---

## 7. Decisions for Best Bottles

| # | Decision | Recommendation |
|---|---|---|
| 1 | Formats: 5 × 7 insert, 5 × 7 booklet, Letter catalogue | Yes |
| 2 | Insert on every order, one card per family in the box | Yes; start with the top-selling families (share order volumes by family) |
| 3 | No prices in print; a separate dated price list | Yes |
| 4 | Stock and colour: bone tint on silk, or a bone-like paper with no tint | Hard-proof both on the Boston Round insert |
| 5 | Print method and quantities | Digital short runs (250–500 per insert, 500–1,000 booklets) until volumes are known |
| 6 | Catalogue: PDF first, printed on demand | Yes |

---

## 8. Rollout

| Step | What | Depends on |
|---|---|---|
| 1 | Review this plan and the Boston Round proof | — |
| 2 | Build the three generator modes; run every family; review the PDFs | COPY-STRATEGY rollout steps 1–2 (naming and descriptions) |
| 3 | Hard proof from the printer on the chosen stock | Decision 4 |
| 4 | Print the inserts (top families first) and the booklet; publish the catalogue PDF | Steps 2–3 |
| 5 | Rebuild when the range or the photography changes | — |

## Rebuilding the proof

```bash
pip install pillow segno playwright pymupdf
python3 docs/specs/print-collateral/prototype/build_proof.py
```

The script reads `docs/reviews/audit-2026-08-06/convex-products-for-crosscheck.json` and `public/images/catalog/`. It writes `prototype/boston-round-proof.pdf`, plus working files and PNG previews in `prototype/build/` (git-ignored).
