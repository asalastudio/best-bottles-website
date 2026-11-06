# Family media release inventory

GitHub recorded a successful Production deployment for commit `b07972495e319306dd02331ea65779b6a0be86b3`. Merge history establishes which code reached that release. Each family still needs configuration-level image checks before we can confirm that its full localhost artwork is live.

| Family | Merged work | Release gap or coverage |
| --- | --- | --- |
| Cylinder, including Tulip and Pillar | #383, #385, #386, #388, #389, #397, #400 | This branch carries the newer 25/50/100 mL clear glass and reducer wiring. Jumbo roll-on candidates and additional Pillar configurations still use local review paths. |
| Elegant | #390 | Published 30/60/100 mL batch. Verify 15 mL and all finish/view combinations separately. |
| Circle | #391 | Local master review merged. Production parity remains open. |
| Sleek | #387, #392 | 5/8 mL published. This branch adds the 10 mL naming correction and replaces the 50/100 mL spray-family tubes in the existing approved kit path. The tall 10 mL preview kit and broader #392 work still require production parity checks. |
| Boston Round | #391 | Local master review merged. This branch carries the new clear 30 mL gold-trim pipette. Broader production parity remains open. |
| Round | #392 | Local master review merged. Production parity remains open. |
| Diva | #393, #396 | Published master batch. Full configuration parity still needs a hosted check. |
| Vial | #388, #393, #395 | Published master batch. This branch carries subsequent local recipe changes, some still gated to development. |
| Unique Shapes | #254, #269, #394 | Published catalog heroes and grouping. Rectangle, Bell, Royal, Square and Flair local preview changes require hosted parity checks. |
| Slim | #207, #248, #279, #290 | Published heroes and cap-beside plates. Full catalog, product page and Builder parity remains open. |
| Decorative | #254, #283, #394 | Published selected catalog and plate work. Full family parity remains open. |
| Empire, Diamond, Grace | #399 | Published combined master batch. Full configuration parity still needs a hosted check. |
| Apothecary | #248 | Published catalog hero batch. Full configuration parity remains open. |
| Teardrop | #269 | Published catalog hero batch. Full configuration parity remains open. |

The three revised plastic pivot-spout renders are review artwork. The catalog still serves the existing images.

This branch excludes local launch settings, review screenshots, and unused asset candidates. Preview checks should compare exact SKUs and swatches across the catalog grid, product page, and Builder before promoting any remaining development-only recipe.

## Checks

The live catalog returned HTTP 200 for Cylinder, Elegant, Circle, Sleek, Boston Round, Round, Diva, Vial, Slim, Decorative, Empire, Diamond, Grace, Apothecary, Teardrop and Bell. This checks route access only. TypeScript and 37 focused register and tube tests passed on the candidate branch.
