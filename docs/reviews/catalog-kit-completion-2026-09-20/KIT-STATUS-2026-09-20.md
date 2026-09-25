# Best Bottles kit status — refreshed 2026-09-20

Live source: Convex **PROD** `precise-raccoon-123.convex.cloud`  
Queried via public `productPlates` + `productKits` APIs (read-only). Integrity issues on kits: **0**.

## Headline (replace Sep 8 / Sep 16 numbers)

| Metric | Old (Sep 8 ledger / Sep 16 builder) | **Now (live PROD)** |
| --- | ---: | ---: |
| Exact plates published | ~1,876 ledger rows | **2,283** |
| Kits indexed & plate-matched | 420 complete | **1,728** |
| Kit completeness — full | — | **1,582** |
| Kit completeness — capSplit | — | **146** |
| Kit completeness — bodyOnly | — | **0** |
| Plates with no served kit | 927 held + 411 candidate (ledger) | **555** |
| Sep 19 ship unique SKUs (release receipts) | — | **1,304** approved & published |

The Sep 8 `kit_complete=420` figure is obsolete. Jordan authorized shipping the prepared kits on 2026-09-19 ("ok lets ship The 621 prepared kits"); release receipts across family folders total **1,304 unique SKUs** published to PROD (and mostly DEV). Live PROD now holds **1,728** kits — the gap above 1,304 is earlier Cylinder / Boston / other publishes already on PROD before Sep 19.

## Coarse family — kits on PROD

| Family | Kits | full | capSplit | Plates w/ no kit |
| --- | ---: | ---: | ---: | ---: |
| Cylinder | 420 | 274 | 146 | 16 |
| Elegant | 232 | 232 | 0 | 22 |
| Circle | 167 | 167 | 0 | 38 |
| Diva | 152 | 152 | 0 | 20 |
| Round | 145 | 145 | 0 | 33 |
| Sleek | 124 | 124 | 0 | 60 |
| Slim | 99 | 99 | 0 | 24 |
| Boston Round | 87 | 87 | 0 | 36 |
| Empire | 85 | 85 | 0 | 6 |
| Grace | 35 | 35 | 0 | 8 |
| Diamond | 29 | 29 | 0 | 14 |
| Flair | 29 | 29 | 0 | 1 |
| Rectangle | 29 | 29 | 0 | 32 |
| Tulip | 27 | 27 | 0 | 33 |
| Royal | 26 | 26 | 0 | 4 |
| Vial | 15 | 15 | 0 | 11 |
| Cream Jar | 13 | 13 | 0 | 4 |
| Square | 10 | 10 | 0 | 19 |
| Atomizer | 2 | 2 | 0 | 21 |
| Decorative | 1 | 1 | 0 | 11 |
| Teardrop | 1 | 1 | 0 | 2 |
| **Bottle families subtotal** | **1728** | **1582** | **146** | **415** |
| Components / other plates (Sprayer, Roll-On Cap, Dropper, Cap/Closure, Bell, Pillar, …) | 0 | 0 | 0 | 140 |
| **ALL plates gap** | **1728 kits** |  |  | **555** |

Note: the 140 “no kit” on component-style plate families is expected for many loose fitments; the actionable bottle gap is closer to **415** plates.

## Build Your Bottle configurations (funnel × live PROD kits)

Funnel snapshot still dated from prior builder accounting input; kit presence is live PROD.

| Family | Configs | full | capSplit | bodyOnly | none |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cylinder | 290 | 228 | 62 | 0 | 0 |
| Elegant | 225 | 207 | 0 | 0 | 18 |
| Circle | 185 | 150 | 0 | 0 | 35 |
| Diva | 157 | 137 | 0 | 0 | 20 |
| Boston Round | 104 | 78 | 0 | 0 | 26 |
| Round | 91 | 77 | 0 | 0 | 14 |
| Empire | 55 | 49 | 0 | 0 | 6 |
| **TOTAL** | **1107** | **926** | **62** | **0** | **119** |

## What this means for next work

1. **Do not use** Sep 8 catalog-kit-completion counts (420/411/927) or Sep 16 builder-kit-status.html as current truth.
2. Live PROD is the source of truth: **1,728 kits / 2,283 plates**.
3. Remaining gap: **555 plates** still without a served kit (and builder funnel configs still showing `none` where the layered kit is missing or not registered to the current plate).
4. Sep 19 release folders under `docs/reviews/*-2026-09-19/` are the ship receipts; contact sheets at `public/reviews/kit-completion-2026-09-19/`.

## Files

- `live-kit-census.json`
- `builder-kit-accounting-prod.json`
- `coarse-family.json`
- `kit-completion-ledger.csv`
