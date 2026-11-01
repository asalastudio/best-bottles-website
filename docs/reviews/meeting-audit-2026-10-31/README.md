# Product review meeting board

Open the local board at `http://localhost:3010/reviews/meeting-audit-2026-10-31/index.html`.

The list was collected read-only from the connected catalog on October 31. It contains 363 product groups and covers all 2,485 SKU records: 2,483 linked to a group and two listed separately in `unlinked-skus.csv`. There are 318 visible bottle/jar product pages. The main queue provides 90 starting points grouped by family, capacity and neck finish. These are convenient review groups, not a claim that the catalog has exactly 90 unique physical geometries. Other colors, shapes within a family, fitments and caps still need review.

Flair comes first, followed by 5 ml bottles, known issues and the remaining families. Six empty groups and other source-held, hidden or internal records remain accessible in the exception/all-group views. Existing implementation checks are shown separately from meeting decisions. No meeting approval is prefilled.

## Run the meeting

1. Start with **Main bottles**. Open the selected product page and compare the body with a physical sample or original reference.
2. Check the bottle at the approved size. Use cap off, cap on and exploded; change one cap and one fitment where available. Check a narrow/mobile viewport too.
3. Record Pass, Fix or N/A for each acceptance check. Add the exact cap, fitment or view to the notes, and assign a follow-up owner.
4. Use **Review related pages** for the other colors and fitments. Approving one page does not approve those pages or every cap SKU.
5. Finish with known issues and catalog exceptions. Export the review CSV and save a notes backup.

The online meeting register is [01 Best Bottles catalog audit - 2026-10-31](https://docs.google.com/spreadsheets/d/1tzH1wFVkTsmDBmOZCxXqeltzV34XfFQLVZ033gfbo-Q). The sheet and review backups live in the [dated Best Bottles Drive folder](https://drive.google.com/drive/folders/1YMQoNVlutIeYUVALHdNgGthBTjldwO1-). Use the sheet for durable decisions, owners and next actions. The source CSVs are retained as snapshots. The interactive board saves decisions in the current browser only. Use **Save notes backup** to retain or transfer the meeting state. **Import notes** merges matching product-page records from that backup. Browser notes are not committed automatically and do not change the storefront or backend.

## Acceptance standard

| Check | Pass means |
| --- | --- |
| Identity | The SKU, capacity, glass color, closure and product title describe the actual product. Compare measured proportions where supplied. |
| Glass | Correct body, neck, shoulder and base. Realistic highlights/refraction without cloudy cutouts, ghosts, hard masking, apparent holes or faceting. Straight-on geometry where approved. |
| Scale | Later catalog-wide curve plus approved family exceptions. Bottle centerline and baseline stay fixed as components or views change. |
| Fitment | Thin, plausible tube reaches just above the interior base without clipping; slight natural bend where appropriate. Roller ball is round and seated; insert/reducer is present and fits the neck. |
| Closure | Correct finish, proper shoulder/neck seating, no floating parts or intersections. Every detached component remains within the frame. |
| Views | Cap off, cap on and exploded show the intended assembly without duplicate patterns, exposed ghost tubes or overlapping components. Mobile labels remain readable. |
| Builder | Eligible product links open the same selected bottle/configuration in the builder. The 3.3 ml and 4 ml 12 mm sprays are intentionally product-page only. |

An unavailable view is a gap unless it is intentionally excluded for that product. Spot-check approval requires every acceptance item to be Pass or N/A. Changing a check to Fix or Unchecked clears the previous approval.

## Coverage limits and launch state

The cobalt audit is representative: 117 SKUs inventoried across 24 groups, not individual sign-off of every cap. Known Boston Round 15 ml dropper cutouts and the 4 ml blue dropper remain follow-up items. The current amber pass covers 13 local SKU variants across four groups; other amber products still need review. The full catalog is not visually approved.

This meeting board covers product imagery, fitment, interactive presentation and builder handoff. Launch checks for checkout, payment, inventory, shipping, legacy redirects, SEO and domain takeover remain separate. A visual approval does not authorize publication or domain changes.

## Restore

From the repository root:

```sh
node docs/reviews/meeting-audit-2026-10-31/restore.mjs
node docs/reviews/meeting-audit-2026-10-31/restore.mjs --apply
```

The first command verifies all package checksums. The second restores the five board/CSV files into `public/reviews/meeting-audit-2026-10-31/`, backing up any conflicting local files. The board is excluded from deployment with the existing dated-review rule. Restore the earlier catalog checkpoints as well to see the current local product candidates.

`evidence/` contains the compact catalog list, collection/build scripts and desktop/mobile browser checks. Snapshot dimensions and original reference links come from the earlier same-day catalog export; the group and SKU inventory was refreshed for this meeting board. No private source photographs or credentials are included.
