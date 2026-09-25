# 18-400 neck-thread mini catalog

Print at **17 × 11 inches, landscape** using the two-page PDF. The `18-400-print-1.png` and `18-400-print-2.png` files are 300 dpi previews. Page 1 shows the six 66 mm dropper finishes, the short closure, glass-rod applicator, three 15 mL Boston Round colors, and the 9 mL clear vial. Page 2 records the corrected Circle thread and the remaining reconciliation queue.

## Read-only evidence

- `convex-18-400.json`: current Convex `products:getProductExportPage` read-only export, 2026-09-23. 2,540 catalog rows; 26 rows labeled 18-400: 18 bottle rows and 8 standalone component rows.
- `component-inventory.csv`: exact standalone component SKUs and source descriptions.
- `body-component-coverage.csv`: exact bottle SKUs and row counts by body/color.
- `component-remedy-register.csv`: four remaining identity/association checks before changing selectors.
- `source-manifest.json`: local master PSD path and SHA-256 for each extracted visual. Source images retain the master geometry; no generative bottle reconstruction.

## Legacy source checks

- [15 mL clear Boston Round, 18-400](https://www.bestbottles.com/product/boston-round-design-15-ml-clear-glass-bottle-black-dropper-shiny-silver-trim-cap) — 68 mm without cap, 91 mm assembled with dropper.
- [9 mL clear vial with glass-rod applicator, 18-400](https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-cap-with-glass-rod-applicator) — 50 mm with cap.
- [9 mL clear vial with short black cap, 18-400](https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-short-cap) — 47 mm with cap.
- [50 mL frosted Circle reducer + ivory faux-leather cap](https://www.bestbottles.com/product/circle-design-50-ml-frosted-glass-bottle-reducer-ivory-faux-leather-cap) — this legacy page still prints 18-400, but the owner confirmed 18-415 and the Convex development record was corrected; see `outputs/circle-50ml-thread-correction-2026-09-23/`.
- [Black 18-400 dropper](https://www.bestbottles.com/product/Dropper-black-rubber-bulb-black-trim-glass-Pipette-15ml) — source says 66 mm glass stem.
- [Black glass-rod cap, 18-400](https://www.bestbottles.com/product/Caps-lid-with-applicator-top-black-Color-8-425) — source says 18-400 despite its legacy URL slug.

The 18-400 thread identifies candidate closures. It does not, by itself, verify stem length, seated reducer, component identity, or an exact sellable assembly. The one exact Circle record was corrected in Convex development; the other 18-400 records were not changed.
