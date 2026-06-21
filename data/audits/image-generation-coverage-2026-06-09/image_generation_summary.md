# Best Bottles Image Generation Coverage Audit

Generated: 2026-06-10T02:34:23.212Z

## Headline Counts

- Catalog SKU rows audited: 2474
- Rows with trusted existing media: 747
- Rows with Madison/generated evidence not necessarily synced to Convex: 1347
- Rows still needing generation: 380
- Ready from local repo reference images: 346
- Ready from legacy bestbottles.com image URLs: 9
- Need legacy product-page lookup/scrape: 25
- Need manual reference sourcing: 0
- Prompt-incomplete rows: 372

## Output Files

- Full JSON: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-06-09/image_generation_coverage.json
- Full CSV: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-06-09/image_generation_coverage.csv
- Madison local-reference manifest: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-06-09/madison_manifest_local_reference.json
- Madison legacy-reference manifest: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-06-09/madison_manifest_legacy_reference.json

## Largest Family Gaps

| Family | Total | Covered | Needs Generation | Local Ref | Legacy Ref | Lookup | Manual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sleek | 192 | 83 | 109 | 109 | 0 | 0 | 0 |
| Slim | 129 | 45 | 84 | 84 | 0 | 0 | 0 |
| Roll-On Cap | 35 | 0 | 35 | 34 | 0 | 1 | 0 |
| Cap/Closure | 39 | 9 | 30 | 18 | 0 | 12 | 0 |
| Sprayer | 64 | 38 | 26 | 20 | 0 | 6 | 0 |
| Rectangle | 63 | 40 | 23 | 22 | 1 | 0 | 0 |
| Dropper | 22 | 0 | 22 | 21 | 0 | 1 | 0 |
| Tulip | 60 | 49 | 11 | 11 | 0 | 0 | 0 |
| Cylinder | 382 | 374 | 8 | 2 | 6 | 0 | 0 |
| Royal | 30 | 22 | 8 | 8 | 0 | 0 | 0 |
| Square | 29 | 23 | 6 | 6 | 0 | 0 | 0 |
| Lotion Pump | 10 | 6 | 4 | 4 | 0 | 0 | 0 |
| Vial | 26 | 23 | 3 | 3 | 0 | 0 | 0 |
| Plastic Bottle | 4 | 2 | 2 | 2 | 0 | 0 | 0 |
| Cap/Component | 2 | 0 | 2 | 0 | 0 | 2 | 0 |
| Elegant | 290 | 289 | 1 | 0 | 1 | 0 | 0 |
| Circle | 209 | 208 | 1 | 1 | 0 | 0 | 0 |
| Flair | 30 | 29 | 1 | 1 | 0 | 0 | 0 |
| Gift Bag | 21 | 20 | 1 | 0 | 1 | 0 | 0 |
| Gift Box | 15 | 14 | 1 | 0 | 0 | 1 | 0 |

## Classification Rule

Shopify CDN or Madison/Supabase generated evidence counts as image coverage; legacy bestbottles.com media counts only as reference evidence.

Legacy bestbottles.com images are treated as reference inputs, not completed new-site media.

