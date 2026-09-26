# Print: family compatibility guides and the complete catalogue

One build produces every printed and downloadable product document from the same data and the same page design:

| Output | Use |
|---|---|
| `out/print/family-guides/<family>.pdf` | The "Compatibility guide (PDF)" link on each family page (`/catalog/<family>`) |
| `out/print/best-bottles-catalogue.pdf` | The house edition: the range, fit systems (the neck-sheet matrices), every family, parts and packaging, and "Working with the range" for the team |
| `out/print/best-bottles-catalogue-web.pdf` | The web edition: the same book without "Working with the range"; this is the one published for download |
| `out/print/manifest.json` | Pages, size and checksum of each file, and the export it was built from |
| `out/print/build-report.md` | Items, sizes, fitment types and photographed items per family |

Each family guide contains:
- the family's sizes with neck, height, diameter, glass and case quantity
- what fits each size
- the finishes of every part
- use and care lines
- glass and size photographs
- the families that share each neck
- a line sheet with every item number

The catalogue is the same family sections in merchandising order, so the two never disagree.

Two more modules feed the catalogue:
- `neck_sheets.py` reads the neck-thread sheets in `data/register/source/neck-thread-2026-09-23/`. It finds each part and bottle picture, the label printed under it and the card it sits in. Run it on its own for a contact sheet per neck (`out/print/work/neck/`).
- `operations.py` holds the words of "Working with the range". Every line restates RUBRIC, COPY-STRATEGY or SYNTHESIS, so change the source document first.

## Build

```bash
pip install pillow segno playwright pymupdf
python3 scripts/print/family_guides.py                                 # all families + catalogue
python3 scripts/print/family_guides.py --family "Boston Round"         # one family, for review
python3 scripts/print/family_guides.py --export <prod-export.json.gz>  # from a fresh production export
python3 scripts/print/family_guides.py --no-guides --edition house     # the house edition only, for review
```

The default export is the 25 September 2026 **development** snapshot in `data/register/source/`. Build published guides from a production export: it has the same shape as `products:getProductExportPage`, which `scripts/register/build_register.py --export` also reads. Rebuild the register first when the catalogue has changed.

## Publish

```bash
BLOB_READ_WRITE_TOKEN=... node scripts/print/upload_family_guides.mjs
git add src/lib/products/family-guides.json   # the family pages read this file
```

PDFs go to Vercel Blob under content-addressed keys, so a rebuilt guide gets a new URL and older links keep working. A family page shows the download link only when `family-guides.json` lists its guide.

## Rules the pages follow

- **Wording:** the copy standard in `docs/specs/pdp-item-descriptions/` (COPY-STRATEGY, RUBRIC, SYNTHESIS): customer part names, care lines word for word, and no prices or claims.
- **Fit:** a dot means Best Bottles sells that size with that part (a current register assembly), never a thread-only match. Bodies sold as complete sets or in their own class are labelled.
- **Brand:**
  - The site's current wordmark lockup and Montserrat; IBM Plex Mono for item numbers.
  - Bone pages, with photography matched to the page colour.
  - Gold only for emphasis.
- **Photography:** approved catalogue photographs only (`public/images/catalog/*-approved-*`, then the pilots, then bone-review). Each row of photos shares one crop and scale.
- **Shape descriptions:** the one hand-written line per family, in `FAMILY_SHAPES`, is a draft for Best Bottles to confirm. Families without one open with the family name.
