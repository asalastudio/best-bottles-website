# Closure colour grading vs Photoshop sources — 2026-08-31

Method: psd_tools composite -> body-pixel luminance bands (dark 5-20%,
mid 40-60%, bright 70-90%). Metals: material color = light F0; the PSD
mid is the perceived tone under that photo's light, so family-match is
judged on hue + relative contrast, not literal hex equality.

## 17-415 roll-on caps (12. 17-415 Roll on) — all APPROVED/locked
| cap | PSD mid | material | verdict |
|---|---|---|---|
| ShnGl | #e0d18a | CAP_SHINY_GOLD #ffe496 | match (mirror gold) |
| ShnSl | #b1b1b1 | CAP_SHINY_SILVER #fefdfc | match (mirror contrast) |
| MattSl | #c1c1c1 | CAP_MATTE_SILVER #f5f6f6 | match |
| MattGl | #d2c37f | CAP_MATTE_GOLD #ffe496 | match |
| Cu | #93533c | CAP_COPPER #cf855a | match (penny, satin) |
| ShnBlk | #353535 | CAP_SHINY_BLACK #070707 gloss | match |
| White | #f2f2f2 | CAP_WHITE #f4f3f0 | match |
| BlkDot | #060606 + chrome studs | CAP_DOTS_BLACK + PART_STUD_CHROME | match |
| PnkDot | #e2d3d6 | CAP_DOTS_PINK #e2d3d6 (matte) | exact |
| SlDot | matte silver | = CAP_MATTE_SILVER | match |

## 18-415 caps (6. 18-415 Caps) — 3 mouldings, 12 finishes
Short (19 x O21): ShnGl #e8dc9a / ShnSl / ShnBlk #303030 / MtSl #d8d8d8 —
all family-consistent with the locked shared materials.
Tall (26.8 x O21): ShnBlkTall #2e2e2e, MtSlTall #dadada, Wh #eaeaea
(White is TALL-ONLY at this finish).
Leather (traced profile, straight O24.5 + roundover): BLACK #303030,
BROWN #a17249, LIGHT_BROWN #b79875, IVORY #cfb58f, PINK #d092a0 —
LEATHER_* materials set to the PSD mids directly.

## 18-415 sprayer trims (7. 18-415 Sprayers) — graded, SHARED mats verified
| trim | PSD collar mid | mapped material | verdict |
|---|---|---|---|
| MtGl | #ede4b0 | CAP_MATTE_GOLD | family match |
| ShnBlk | #373737 | CAP_SHINY_BLACK | match |
| MtSl | #d3d3d3 | CAP_MATTE_SILVER | match |
| Cu | #b57153 | CAP_COPPER | match |
| ShnSl | #2c2c2c/#d6d6d6 | CAP_SHINY_SILVER | match (mirror) |
| ShnGl | NO SOURCE ("12. Spry18-415ShnGl" is an empty extensionless file) | CAP_SHINY_GOLD | rides approved gold; flag for the library |

Conclusion: NO deviant trim materials needed — the shared registry
serves both finishes. 18-415 trims add MtGl + Cu and omit Tur/Rd
(family-driven palettes in src/lib/configurator/families.ts).
