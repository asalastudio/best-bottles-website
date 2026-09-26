# Print plan: the catalogue, the line booklet and the family inserts

Status: proposed · 2026-09-26 · proof: `prototype/boston-round-proof.pdf` (9 pages, Boston Round)

**Companion files:** `../pdp-item-descriptions/COPY-STRATEGY.md` (names and wording; section 7.6 covers print), `../pdp-item-descriptions/TEMPLATE.md` and `RUBRIC.md` (descriptions, uses, care lines), `DESIGN.md` at the repo root (brand system).

---

## The short version

1. **Three printed pieces, one product record.** The site, Shopify, Faire, the Google feed and print all read the same Convex data and the same naming rules, so a printed page can never disagree with the product page.
   - **Family insert card** — 5 × 7 in, two sides, one card per family. It goes in the box with every order.
   - **The Line** — a 5 × 7 in, 36-page saddle-stitched booklet of the whole range. It goes in first orders, sample packs and trade-show bags, and is a PDF download.
   - **The Catalogue** — US Letter, a family spread plus a line sheet for every family, about 100 pages. It is a PDF on the site first, with short print runs for trade buyers.
2. **Generated, not typeset by hand.** The existing PDF generator (`src/lib/pdf/catalog`) gains three modes. A new family or SKU appears in print the next time the files are built.
3. **No prices in print.** Prices, stock and pack sizes change; the printed pieces point to bestbottles.com and 1-800-936-3628, and a dated price list is printed separately when needed.
4. **The proof is ready for review:** the Boston Round insert (front and back), five booklet pages and a catalogue spread, built from the August 2026 production export (123 SKUs) and the approved photography.

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
| 3–4 | Choose by use: the twelve bottle types, each with its uses and one deciding fact (RUBRIC.md §4.2) |
| 5 | Neck finishes: what fits what (13-415, 17-415, 18-400, 18-415, 20-400 …) |
| 6 | Glass colours and cap finishes |
| 7–31 | One page per family: size row, name, one-sentence description, glass, neck, case quantity, fit chart, finishes, QR |
| 32 | Samples and promotional sizes (5 ml and under, plus every vial; the 9 ml glass-rod vial) |
| 33 | Caps and closures sold separately |
| 34 | Ordering, custom work, contact |
| 35–36 | Inside back cover and back cover |

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
- Choose by use (one spread), neck finish guide (one spread), glass and finishes (one spread).
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
- **Family data builder:** generalised from `prototype/boston_data.py`. It groups SKUs by family, size, fitment and finish, with glass colours as columns. It reads fitment and finish from Convex fields (applicator, cap colour, trim), not from legacy item names, and fails if a SKU is dropped or two SKUs land in one cell.
- **Photo slots:** each family's slots (fitment row, glass row, size row) are listed in one JSON file. A missing approved photo shows the slot name on the page and is listed in the build report.
- **Build report:** pages per family, missing photos, and any text that overflows its box (Chromium measures it).
- **Tests:** vitest for the data builder, plus a page snapshot of the Boston Round family.
- **Naming:** it depends on `naming.ts` (COPY-STRATEGY rollout step 1), so print uses the same names as the site.

---

## 6. Data questions the proof raised

- **Boston Round 15 ml, clear:** only a black-bulb dropper and a black cap. Amber and cobalt blue carry six dropper finishes. Is that the real range?
- **Shiny black steel-roller cap:** listed only on 30 ml clear and amber and 60 ml clear. Confirm.
- **`GBBstnAmb1ozRollonShnBlk`:** the legacy item name says "Cylinder design". It isn't printed (names are generated), but the record should be fixed.
- **25 ml Cylinder bulb sprayers:** 18 SKUs have no glass colour in Convex, so their titles can't be built.
- **Case quantities** (15 ml: 317, 30 ml: 360, 60 ml: 240): confirm before they are printed.

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
