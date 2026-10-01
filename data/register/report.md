# Component register — Phase 1 reconciliation (2026-10-01)

Source: Convex prod export (2485 rows, collected 2026-09-29T09:07:45Z), PSD library inventory (393 PSDs), body-dims (146 keys), 23 Sep review files (49 items). Read-only.

## Totals

- Bodies: **93 current** (0 retired-only) across 32 neck groups
- Components: **154 current**, 0 retired, 15 quarantined; **129 current components have a library PSD** (16 via alias-map, 34 case-insensitive)
- Assemblies: **2107 verified**, **109 candidate**, **55 quarantine**, **2 retired**, **2 exception**
- Quarantine rows: 120 (see quarantine.csv)
- Register ids kept across catalogue re-keys: **24** (the layers stay attached; see below)

## Rulings applied

- **2026-09-25 · Jordan** — Atomizers, aluminium bottles and jars are each their own compatibility class, like plastic bottles: a matching neck finish does not make glass-bottle components compatible with them. _(applies: bodies.compatibilityClass = metal-atomizer | aluminum-bottle | glass-jar | cream-jar; their listed glass components are not resolved)_
- **2026-09-24 · Jordan** — Plastic bottles are their own compatibility class. A 13-415 neck on a plastic bottle does not make the 13-415 glass-bottle components compatible with it, nor it with them. _(applies: bodies.compatibilityClass = plastic-bottle; their listed glass components are not resolved)_
- **2026-09-24 · Jordan** — CMP-SPR-CLR-30ML (PB1ozSpryNat) and CMP-SPR-SLV- (PB1ozSprySl) are plastic bottles, not components; remove them from every component list. _(applies: assemblies: excluded from listed components before resolution (494 13-415 lists carried them))_
- Effect this build: pasted products removed from **583** component lists; **22** bodies in ruled own classes (aluminum-bottle 5, cream-jar 1, glass-jar 8, metal-atomizer 3, plastic-bottle 5); no body class is assumed — every non-glass category is ruled.

## Per neck

| neck | bodies | glass variants | components | verified | candidate | quarantine | exception | retired |
|---|---|---|---|---|---|---|---|---|
| (none) | 5 | 1 | 0 | 0 | 0 | 6 | 0 | 0 |
| 10mm | 1 | 1 | 0 | 0 | 0 | 3 | 0 | 0 |
| 11mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 12mm | 2 | 1 | 0 | 0 | 4 | 0 | 0 | 0 |
| 13-415 | 17 | 5 | 35 | 586 | 13 | 0 | 0 | 2 |
| 13-425 | 3 | 4 | 2 | 0 | 16 | 0 | 0 | 0 |
| 14.3mm | 2 | 1 | 1 | 0 | 2 | 0 | 0 | 0 |
| 15-415 | 2 | 2 | 7 | 21 | 0 | 0 | 0 | 0 |
| 16mm | 2 | 1 | 0 | 0 | 8 | 0 | 0 | 0 |
| 17-415 | 1 | 5 | 22 | 145 | 0 | 0 | 0 | 0 |
| 17.52mm | 2 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| 17mm | 1 | 4 | 0 | 0 | 11 | 0 | 0 | 0 |
| 18-400 | 2 | 3 | 8 | 17 | 1 | 0 | 0 | 0 |
| 18-415 | 23 | 2 | 50 | 1226 | 47 | 0 | 2 | 0 |
| 18mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 20-400 | 2 | 3 | 22 | 108 | 0 | 0 | 0 | 0 |
| 20-410 | 5 | 1 | 0 | 0 | 7 | 0 | 0 | 0 |
| 20mm | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| 22-400 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 24-400 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 27mm | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| 37mm | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| 40mm | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| 45mm | 1 | 0 | 0 | 0 | 0 | 4 | 0 | 0 |
| 48/400 | 1 | 0 | 0 | 0 | 0 | 4 | 0 | 0 |
| 58mm | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| 8-425 | 1 | 2 | 5 | 4 | 0 | 0 | 0 | 0 |
| 8mm | 1 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| Ground | 8 | 3 | 0 | 0 | 0 | 17 | 0 | 0 |
| PRESS-FIT | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Plug | 1 | 2 | 0 | 0 | 0 | 4 | 0 | 0 |
| SPECIAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| snap | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |

## Register ids kept across catalogue re-keys — 24

The catalogue gave these parts new graceSkus; each is the same part (same websiteSku and master PSD stem), so it keeps its register id and the layers approved on it.

| catalogue graceSku | register id kept |
|---|---|
| CMP-SPR-MTBK-13-415-07 | CMP-CAP-BLK-13-415-01 |
| CMP-SPR-SHBK-13-415-07 | CMP-CAP-BLK-13-415-02 |
| CMP-SPR-MTBL-13-415-07 | CMP-CAP-13-415 |
| CMP-SPR-MTGD-13-415-07 | CMP-CAP-SGLD-13-415-02 |
| CMP-SPR-SHGD-13-415-07 | CMP-CAP-SGLD-13-415-03 |
| CMP-SPR-MTSL-13-415-07 | CMP-CAP-SLV-13-415-02 |
| CMP-SPR-SHSL-13-415-07 | CMP-CAP-SLV-13-415-03 |
| CMP-LPM-MTCP-18-415-05 | CMP-LPM-CPR-18-415 |
| CMP-LPM-MTGD-18-415-07 | CMP-LPM-MGLD-18-415 |
| CMP-LPM-MTSL-18-415-06 | CMP-LPM-MSLV-18-415-01 |
| CMP-SPR-GDIV-18-415-02 | CMP-SPR-IVGD-18-415-01 |
| CMP-SPR-IVSL-18-415-04 | CMP-SPR-IVSL-18-415-01 |
| CMP-SPR-LVSL-18-415-02 | CMP-SPR-LVN-18-415-01 |
| CMP-SPR-MTSL-18-415-04 | CMP-SPR-MSLV-18-415-01 |
| CMP-SPR-RDSL-18-415-02 | CMP-SPR-RED-18-415-01 |
| CMP-SPR-SLWH-18-415-02 | CMP-SPR-WHT-18-415-01 |
| CMP-SPR-BKSLWH-18-415-02 | CMP-SPR-BLK-18-415-02 |
| CMP-SPR-GDIVSLWH-18-415-02 | CMP-SPR-IVGD-18-415-02 |
| CMP-SPR-IVSLWH-18-415-02 | CMP-SPR-IVSL-18-415-02 |
| CMP-SPR-LVSLWH-18-415-02 | CMP-SPR-LVN-18-415-02 |
| CMP-SPR-MTSLWH-18-415-02 | CMP-SPR-MSLV-18-415-02 |
| CMP-SPR-GDPKSLWH-18-415-02 | CMP-SPR-PNK-18-415 |
| CMP-SPR-RDSLWH-18-415-02 | CMP-SPR-RED-18-415-02 |
| CMP-SPR-SLWH-18-415-04 | CMP-SPR-WHT-18-415-02 |

## Reconciliation against the 23 Sep matrices

The matrices counted **Glass Bottle** records only; the register also carries atomizers, plastic and aluminium bottles and jars, so both counts are shown.

- ✅ 13-415: glass body formats 15 vs matrix 15 — plus 2 non-glass: atomizer-5ml-13-415 (Metal Atomizer), plastic-bottle-30ml-13-415 (Plastic Bottle)
- ⚠️ 13-415: glass records 589 incl. 2 retired vs matrix 538 (31 retired); 12 non-glass rows besides
- ✅ 17-415: assemblies 145 vs matrix 145 — by body: cylinder-9ml-17-415 145
- ⚠️ 18-415: glass body formats 23 vs matrix 22
- ⚠️ 18-415: current bottle rows 1275 vs matrix 1265
- ⚠️ 18-415: component records 50 vs matrix 64
  - the 23rd 18-415 body is `cylinder-30ml-18-415`: the two fixed-spray exception SKUs, which the matrix keeps in its dashed card
- ⚠️ 20-400: bottles 108 vs matrix 107; components 22 vs 20
- ✅ 16mm: assemblies 8 vs matrix 8 — by body: cylinder-28ml-16mm 4, cylinder-50ml-16mm 4
- ✅ 13-425: bottle rows 16 vs matrix 16
- ✅ 8-425: bottle rows 4 vs matrix 4
- ✅ 12mm: assemblies 4 vs matrix 4 — by body: cylinder-3.3ml-12mm 2, cylinder-4ml-12mm 2

## Component types by neck (current)

| neck | cap | cap-review | dropper | faux-leather-cap | fine-mist-sprayer | lotion-pump | plug-applicator | reducer | review | roll-on-cap | roller-insert | tassel-bulb-sprayer | vintage-bulb-sprayer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13-415 | 8 |  |  |  | 12 |  |  |  |  | 13 | 2 |  |  |
| 13-425 | 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| 14.3mm |  |  |  |  |  |  | 1 |  |  |  |  |  |  |
| 15-415 |  |  |  |  | 5 |  |  |  |  | 2 |  |  |  |
| 17-415 |  |  | 1 |  | 6 | 3 |  |  |  | 10 | 2 |  |  |
| 18-400 | 2 |  | 6 |  |  |  |  |  |  |  |  |  |  |
| 18-415 | 7 |  | 3 | 5 | 8 | 8 |  | 1 |  |  |  | 9 | 9 |
| 20-400 | 2 |  | 12 |  |  |  |  |  |  | 6 | 2 |  |  |
| 22-400 | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 24-400 | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 8-425 | 5 |  |  |  |  |  |  |  |  |  |  |  |  |

## Library gaps — 25 current components with no PSD in 20. Caps / 21. Tassels

- **13-415** (12): CP13-415BlkShShtMtl [cap], CP13-415CuSht [cap], CP13-415GlMattSht [cap], CP13-415GlSht [cap], CP13-415SlMattSht [cap], CP13-415SlSht [cap], 13-415CAP4SpryCuMt [fine-mist-sprayer], 13-415CAP4SpryGlSh [fine-mist-sprayer], 13-415CAP4SprySlMt [fine-mist-sprayer], GBATom5RedBurg [fine-mist-sprayer], LIB-13-415-MinarCu [cap], LIB-13-415-MinarSl [cap]
- **13-425** (2): CP13-425Blk [cap], CP13-425Wht [cap]
- **14.3mm** (1): LIB-14.3mm-Plug [plug-applicator]
- **17-415** (3): Droppers1ozElg [dropper], LIB-17-415-MtlRollon [roller-insert], LIB-17-415-PlsticRollon [roller-insert]
- **18-415** (3): 18-415CAP4SpryMtGl [fine-mist-sprayer], 18-415CAP4SpryShnBlk [fine-mist-sprayer], LIB-18-415-WhtPumpClOvrCp [lotion-pump]
- **20-400** (2): LIB-20-400-MtlRollon [roller-insert], LIB-20-400-PlsticRollon [roller-insert]
- **22-400** (1): CapBlackPoly22mm-400 [cap]
- **24-400** (1): CP24-400BlkPls [cap]

## Library PSDs that no component record claims — 9 stems in 20. Caps

- **21. Hearts 8-245 Caps**: CP8-425BluTslShortSilverCap, CP8-425GlChainShortShnGlCap, CP8-425SlChainShortShnSlCap, CP8-425RedTslShortShnGlCap
- **22. Vials Wand**: VialWandBlk, VialWandClr
- **28. 14.3 Cap**: CP14mmAppShnSlBlueDot, CP14mmAppShnGlRedDot
- **8. 18-415 Lotion**: Ltn18-415SqClr

## Alias candidates — 0 spelling pairs for Jordan to confirm (alias-candidates.csv)

| Convex websiteSku | library stem | folder(s) | match |
|---|---|---|---|

## Own-part builds — rules written for 13-415, 14.3mm, 17-415, 18-415, 20-400

Each sellable assembly names the parts it is physically made of (`buildParts`), matched uniquely on neck, component type, cap colour and dotted/plain. Roller balls add the neck's roller insert. A row that does not match exactly one part stays `unresolved` with the reason; nothing is guessed (Jordan 2026-09-25: wording errors wait for Convex corrections).

| body | resolved | partial | unresolved |
|---|---|---|---|
| atomizer-5ml-13-415 | 0 | 0 | 9 |
| bell-10ml-13-415 | 4 | 0 | 0 |
| boston-round-30ml-20-400 | 53 | 0 | 0 |
| boston-round-60ml-20-400 | 55 | 0 | 0 |
| circle-100ml-18-415 | 86 | 0 | 0 |
| circle-15ml-13-415 | 36 | 0 | 0 |
| circle-50ml-18-415 | 91 | 0 | 0 |
| cylinder-100ml-18-415 | 43 | 0 | 0 |
| cylinder-25ml-18-415 | 45 | 0 | 0 |
| cylinder-50ml-18-415 | 43 | 0 | 0 |
| cylinder-5ml-13-415 | 71 | 0 | 0 |
| cylinder-9ml-13-415 | 72 | 0 | 0 |
| cylinder-9ml-17-415 | 145 | 0 | 0 |
| diamond-60ml-18-415 | 43 | 0 | 0 |
| diva-100ml-18-415 | 43 | 0 | 0 |
| diva-30ml-18-415 | 34 | 0 | 0 |
| diva-46ml-18-415 | 92 | 0 | 10 |
| elegant-100ml-18-415 | 88 | 0 | 0 |
| elegant-15ml-13-415 | 74 | 0 | 0 |
| elegant-60ml-18-415 | 94 | 0 | 0 |
| empire-100ml-18-415 | 44 | 0 | 0 |
| empire-50ml-18-415 | 47 | 0 | 0 |
| flair-15ml-13-415 | 38 | 0 | 0 |
| footed-rectangle-10ml-13-415 | 38 | 0 | 0 |
| grace-55ml-18-415 | 43 | 0 | 0 |
| pillar-9ml-13-415 | 4 | 0 | 0 |
| plastic-bottle-30ml-13-415 | 0 | 0 | 3 |
| round-128ml-18-415 | 92 | 0 | 0 |
| round-78ml-18-415 | 86 | 0 | 0 |
| royal-13ml-13-415 | 37 | 0 | 0 |
| sleek-100ml-18-415 | 44 | 0 | 0 |
| sleek-30ml-18-415 | 38 | 0 | 0 |
| sleek-50ml-18-415 | 44 | 0 | 0 |
| sleek-5ml-13-415 | 36 | 0 | 0 |
| sleek-8ml-13-415 | 36 | 0 | 0 |
| slim-100ml-18-415 | 43 | 0 | 0 |
| slim-30ml-18-415 | 37 | 0 | 0 |
| slim-50ml-18-415 | 43 | 0 | 0 |
| square-15ml-13-415 | 34 | 0 | 0 |
| tall-rectangle-10ml-13-415 | 36 | 0 | 0 |
| tola-decorative-3ml-14.3mm | 1 | 0 | 0 |
| tola-decorative-6ml-14.3mm | 1 | 0 | 0 |
| tulip-5ml-13-415 | 36 | 0 | 0 |
| tulip-6ml-13-415 | 35 | 0 | 0 |

Unresolved, by reason (Convex corrections):

- **9** — own class metal-atomizer: no components ruled compatible: GBAtom5Blk, GBAtom5BlkDot, GBAtom5Blu, GBAtom5Gl, GBAtom5Red, GBAtom5Sl, GBAtom5SlDot, GBAtom5SlStars, GBAtom5PnkDot
- **3** — own class plastic-bottle: no components ruled compatible: PB1ozSpryNat, PB1ozSprySl, PB1ozClearcap
- **1** — no current 18-415 vintage-bulb-sprayer carries the SKU code 'BlkRng': GBDiva46AnSpBlkRng
- **1** — no current 18-415 vintage-bulb-sprayer carries the SKU code 'IvySlRng': GBDiva46AnSpIvySlRng
- **1** — no current 18-415 vintage-bulb-sprayer carries the SKU code 'LvnRng': GBDiva46AnSpLvnRng
- **1** — no current 18-415 vintage-bulb-sprayer carries the SKU code 'RedRng': GBDiva46AnSpRedRng
- **1** — no current 18-415 tassel-bulb-sprayer carries the SKU code 'BlkRng': GBDiva46AnSpTslBlkRng
- **1** — no current 18-415 tassel-bulb-sprayer carries the SKU code 'IvySlRng': GBDiva46AnSpTslIvySlRng
- **1** — no current 18-415 tassel-bulb-sprayer carries the SKU code 'LvnRng': GBDiva46AnSpTslLvnRng
- **1** — no current 18-415 tassel-bulb-sprayer carries the SKU code 'RedRng': GBDiva46AnSpTslRedRng
- **1** — no current 18-415 tassel-bulb-sprayer carries the SKU code 'WhtRng': GBDiva46AnSpTslWhtRng
- **1** — no current 18-415 vintage-bulb-sprayer carries the SKU code 'WhtRng': GBDiva46AnSpWhtRng

## Catalogue data defects the register surfaced (Convex, not code)

- **0 assemblies list component TYPE LABELS instead of SKUs** (e.g. `Roll-On Cap`, `Sprayer`): . Samples: 
- **0 assemblies list a component that is not a Component row**: 
- **0 assemblies list a SKU with no record at all**: 

## Assemblies with no component list — 102

| neck | count | families |
|---|---|---|
| 12mm | 4 | Cylinder |
| 13-415 | 12 | Atomizer, Elegant, Plastic Bottle |
| 13-425 | 16 | Vial |
| 14.3mm | 2 | Decorative |
| 16mm | 8 | Cylinder |
| 17mm | 11 | Atomizer |
| 18-400 | 1 | Boston Round |
| 18-415 | 47 | Circle, Cylinder |
| 20-410 | 1 | Aluminum Bottle |

## Quarantine — 120 rows

| kind | count |
|---|---|
| assembly | 55 |
| component | 15 |
| review-2026-09-23 | 49 |
| row | 1 |

## Keys

- `bodyId` = `[shape-]profile-<capacity>ml-<neck>` (profile from productGroupSlug, else family); `builderBodyId` mirrors `builderBodyIdentity()` in src/lib/bottle-builder/model.ts.
- Components and assemblies are keyed by **graceSku**; `websiteSku` is carried as the legacy alias. Parts that are not products are keyed `LIB-<neck>-<name>` (`componentId`, `sellable` false).
- Component `status`: current | retired | quarantine. Assembly `status`: verified | candidate | exception | quarantine | retired.
- Nothing in Convex, Shopify or the website was changed. Rebuild: `python3 scripts/register/build_register.py`.
