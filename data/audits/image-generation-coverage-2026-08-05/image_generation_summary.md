# Best Bottles Image Generation Coverage Audit

Generated: 2026-08-05T02:24:26.865Z

## Headline Counts

- Catalog SKU rows audited: 2474
- Rows with trusted existing media: 2052
- Rows with Madison/generated evidence not necessarily synced to Convex: 0
- Rows still needing generation: 422
- Ready from local repo reference images: 385
- Ready from legacy bestbottles.com image URLs: 12
- Need legacy product-page lookup/scrape: 25
- Need manual reference sourcing: 0
- Prompt-incomplete rows: 372

## Output Files

- Full JSON: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-08-05/image_generation_coverage.json
- Full CSV: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-08-05/image_generation_coverage.csv
- Madison local-reference manifest: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-08-05/madison_manifest_local_reference.json
- Madison legacy-reference manifest: /Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/image-generation-coverage-2026-08-05/madison_manifest_legacy_reference.json

## Largest Family Gaps

| Family | Total | Covered | Needs Generation | Local Ref | Legacy Ref | Lookup | Manual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sleek | 192 | 75 | 117 | 117 | 0 | 0 | 0 |
| Slim | 129 | 33 | 96 | 96 | 0 | 0 | 0 |
| Roll-On Cap | 35 | 0 | 35 | 34 | 0 | 1 | 0 |
| Cap/Closure | 39 | 9 | 30 | 18 | 0 | 12 | 0 |
| Sprayer | 64 | 38 | 26 | 20 | 0 | 6 | 0 |
| Rectangle | 63 | 37 | 26 | 25 | 1 | 0 | 0 |
| Dropper | 22 | 0 | 22 | 21 | 0 | 1 | 0 |
| Tulip | 60 | 49 | 11 | 11 | 0 | 0 | 0 |
| Cylinder | 382 | 372 | 10 | 2 | 8 | 0 | 0 |
| Royal | 30 | 20 | 10 | 10 | 0 | 0 | 0 |
| Decorative | 12 | 4 | 8 | 8 | 0 | 0 | 0 |
| Square | 29 | 22 | 7 | 7 | 0 | 0 | 0 |
| Lotion Pump | 10 | 6 | 4 | 4 | 0 | 0 | 0 |
| Vial | 26 | 23 | 3 | 3 | 0 | 0 | 0 |
| Teardrop | 3 | 0 | 3 | 3 | 0 | 0 | 0 |
| Elegant | 290 | 288 | 2 | 0 | 2 | 0 | 0 |
| Circle | 209 | 207 | 2 | 2 | 0 | 0 | 0 |
| Flair | 30 | 28 | 2 | 2 | 0 | 0 | 0 |
| Plastic Bottle | 4 | 2 | 2 | 2 | 0 | 0 | 0 |
| Cap/Component | 2 | 0 | 2 | 0 | 0 | 2 | 0 |

## Classification Rule

Shopify CDN or Madison/Supabase generated evidence counts as image coverage; legacy bestbottles.com media counts only as reference evidence.

Legacy bestbottles.com images are treated as reference inputs, not completed new-site media.

