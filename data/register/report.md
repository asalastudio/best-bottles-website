# Component register — Phase 1 reconciliation (2026-09-25)

Source: Convex dev export (2540 rows, collected 2026-09-25T08:44:26Z), PSD library inventory (393 PSDs), body-dims (144 keys), 23 Sep review files (49 items). Read-only.

## Totals

- Bodies: **94 current** (3 retired-only) across 34 neck groups
- Components: **142 current**, 24 retired, 16 quarantined; **128 current components have a library PSD** (16 via alias-map, 34 case-insensitive)
- Assemblies: **2016 verified**, **129 retired**, **110 candidate**, **55 quarantine**, **2 exception**
- Quarantine rows: 120 (see quarantine.csv)

## Rulings applied

- **2026-09-25 · Jordan** — Atomizers, aluminium bottles and jars are each their own compatibility class, like plastic bottles: a matching neck finish does not make glass-bottle components compatible with them. _(applies: bodies.compatibilityClass = metal-atomizer | aluminum-bottle | glass-jar | cream-jar; their listed glass components are not resolved)_
- **2026-09-24 · Jordan** — Plastic bottles are their own compatibility class. A 13-415 neck on a plastic bottle does not make the 13-415 glass-bottle components compatible with it, nor it with them. _(applies: bodies.compatibilityClass = plastic-bottle; their listed glass components are not resolved)_
- **2026-09-24 · Jordan** — CMP-SPR-CLR-30ML (PB1ozSpryNat) and CMP-SPR-SLV- (PB1ozSprySl) are plastic bottles, not components; remove them from every component list. _(applies: assemblies: excluded from listed components before resolution (494 13-415 lists carried them))_
- Effect this build: pasted products removed from **495** component lists; **23** bodies in ruled own classes (aluminum-bottle 5, cream-jar 1, glass-jar 8, metal-atomizer 4, plastic-bottle 5); 1 bodies still in classes assumed from their category, not yet ruled: Roll-On Bottle.

## Per neck

| neck | bodies | glass variants | components | verified | candidate | quarantine | exception | retired |
|---|---|---|---|---|---|---|---|---|
| (none) | 5 | 1 | 0 | 0 | 0 | 6 | 0 | 0 |
| 10mm | 1 | 1 | 0 | 0 | 0 | 3 | 0 | 0 |
| 11mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 12mm | 2 | 1 | 0 | 0 | 4 | 0 | 0 | 0 |
| 13-415 | 17 | 5 | 27 | 498 | 21 | 0 | 0 | 31 |
| 13-425 | 3 | 4 | 2 | 0 | 16 | 0 | 0 | 0 |
| 13mm | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| 14.3mm | 2 | 1 | 1 | 0 | 2 | 0 | 0 | 0 |
| 15-415 | 2 | 2 | 7 | 21 | 0 | 0 | 0 | 0 |
| 16mm | 2 | 1 | 0 | 0 | 8 | 0 | 0 | 0 |
| 17-415 | 2 | 5 | 22 | 144 | 2 | 0 | 0 | 2 |
| 17.52mm | 2 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| 17mm | 1 | 4 | 0 | 0 | 11 | 0 | 0 | 0 |
| 18-400 | 2 | 3 | 8 | 17 | 1 | 0 | 0 | 0 |
| 18-415 | 23 | 2 | 48 | 1225 | 38 | 0 | 2 | 94 |
| 18mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 20-400 | 2 | 3 | 20 | 107 | 0 | 0 | 0 | 0 |
| 20-410 | 5 | 2 | 0 | 0 | 7 | 0 | 0 | 0 |
| 20mm | 1 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| 22-400 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 24-400 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 27mm | 1 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| 37mm | 1 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| 40mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 45mm | 1 | 2 | 0 | 0 | 0 | 4 | 0 | 0 |
| 48/400 | 1 | 2 | 0 | 0 | 0 | 4 | 0 | 0 |
| 58mm | 2 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| 8-425 | 1 | 2 | 5 | 4 | 0 | 0 | 0 | 0 |
| 8mm | 1 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| Ground | 8 | 3 | 0 | 0 | 0 | 17 | 0 | 0 |
| PRESS-FIT | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Plug | 1 | 2 | 0 | 0 | 0 | 4 | 0 | 0 |
| Press-Fit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Snap-On | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Specialty | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Reconciliation against the 23 Sep matrices

The matrices counted **Glass Bottle** records only; the register also carries atomizers, plastic and aluminium bottles and jars, so both counts are shown.

- ✅ 13-415: glass body formats 15 vs matrix 15 — plus 2 non-glass: atomizer-5ml-13-415 (Metal Atomizer), plastic-bottle-30ml-13-415 (Plastic Bottle)
- ✅ 13-415: glass records 538 incl. 31 retired vs matrix 538 (31 retired); 12 non-glass rows besides
- ⚠️ 17-415: assemblies 146 vs matrix 145 — by body: cylinder-9ml-17-415 145, pillar-9ml-17-415 1
- ⚠️ 18-415: glass body formats 23 vs matrix 22
- ✅ 18-415: current bottle rows 1265 vs matrix 1265
- ⚠️ 18-415: component records 65 vs matrix 64
  - the 23rd 18-415 body is `cylinder-30ml-18-415`: the two fixed-spray exception SKUs, which the matrix keeps in its dashed card
- ✅ 20-400: bottles 107 vs matrix 107; components 20 vs 20
- ✅ 16mm: assemblies 8 vs matrix 8 — by body: cylinder-28ml-16mm 4, cylinder-50ml-16mm 4
- ✅ 13-425: bottle rows 16 vs matrix 16
- ✅ 8-425: bottle rows 4 vs matrix 4
- ✅ 12mm: assemblies 4 vs matrix 4 — by body: cylinder-3.3ml-12mm 2, cylinder-4ml-12mm 2

## Component types by neck (current)

| neck | cap | cap-review | dropper | faux-leather-cap | fine-mist-sprayer | lotion-pump | plug-applicator | reducer | review | roll-on-cap | roller-insert | tassel-bulb-sprayer | vintage-bulb-sprayer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13-415 |  |  |  |  | 12 |  |  |  |  | 13 | 2 |  |  |
| 13-425 | 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| 14.3mm |  |  |  |  |  |  | 1 |  |  |  |  |  |  |
| 15-415 |  |  |  |  | 5 |  |  |  |  | 2 |  |  |  |
| 17-415 |  |  | 1 |  | 6 | 3 |  |  |  | 10 | 2 |  |  |
| 18-400 | 2 |  | 6 |  |  |  |  |  |  |  |  |  |  |
| 18-415 | 6 |  | 3 | 5 | 8 | 7 |  | 1 |  |  |  | 9 | 9 |
| 20-400 | 2 |  | 12 |  |  |  |  |  |  | 6 |  |  |  |
| 22-400 | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 24-400 | 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| 8-425 | 5 |  |  |  |  |  |  |  |  |  |  |  |  |

## Library gaps — 14 current components with no PSD in 20. Caps / 21. Tassels

- **13-415** (4): 13-415CAP4SpryCuMt [fine-mist-sprayer], 13-415CAP4SpryGlSh [fine-mist-sprayer], 13-415CAP4SprySlMt [fine-mist-sprayer], GBATom5RedBurg [fine-mist-sprayer]
- **13-425** (2): CP13-425Blk [cap], CP13-425Wht [cap]
- **14.3mm** (1): LIB-14.3mm-Plug [plug-applicator]
- **17-415** (3): Droppers1ozElg [dropper], LIB-17-415-MtlRollon [roller-insert], LIB-17-415-PlsticRollon [roller-insert]
- **18-415** (2): 18-415CAP4SpryMtGl [fine-mist-sprayer], 18-415CAP4SpryShnBlk [fine-mist-sprayer]
- **22-400** (1): CapBlackPoly22mm-400 [cap]
- **24-400** (1): CP24-400BlkPls [cap]

## Library PSDs that no component record claims — 10 stems in 20. Caps

- **21. Hearts 8-245 Caps**: CP8-425BluTslShortSilverCap, CP8-425GlChainShortShnGlCap, CP8-425SlChainShortShnSlCap, CP8-425RedTslShortShnGlCap
- **22. Vials Wand**: VialWandBlk, VialWandClr
- **28. 14.3 Cap**: CP14mmAppShnSlBlueDot, CP14mmAppShnGlRedDot
- **6. 18-415 Caps**: CP18-415ShnBlk
- **8. 18-415 Lotion**: Ltn18-415SqClr

## Alias candidates — 0 spelling pairs for Jordan to confirm (alias-candidates.csv)

| Convex websiteSku | library stem | folder(s) | match |
|---|---|---|---|

## Own-part builds — rules written for 13-415, 14.3mm, 17-415, 18-415

Each sellable assembly names the parts it is physically made of (`buildParts`), matched uniquely on neck, component type, cap colour and dotted/plain. Roller balls add the neck's roller insert. A row that does not match exactly one part stays `unresolved` with the reason; nothing is guessed (Jordan 2026-09-25: wording errors wait for Convex corrections).

| body | resolved | partial | unresolved |
|---|---|---|---|
| atomizer-5ml-13-415 | 0 | 0 | 9 |
| bell-10ml-13-415 | 3 | 0 | 1 |
| circle-100ml-18-415 | 84 | 0 | 2 |
| circle-15ml-13-415 | 30 | 0 | 0 |
| circle-50ml-18-415 | 80 | 0 | 2 |
| cylinder-100ml-18-415 | 42 | 0 | 1 |
| cylinder-25ml-18-415 | 44 | 0 | 1 |
| cylinder-5.5ml-13-415 | 1 | 0 | 0 |
| cylinder-50ml-18-415 | 42 | 0 | 1 |
| cylinder-5ml-13-415 | 58 | 0 | 12 |
| cylinder-9ml-13-415 | 60 | 0 | 12 |
| cylinder-9ml-17-415 | 145 | 0 | 0 |
| diamond-60ml-18-415 | 42 | 0 | 1 |
| diva-100ml-18-415 | 42 | 0 | 1 |
| diva-30ml-18-415 | 33 | 0 | 1 |
| diva-46ml-18-415 | 90 | 0 | 12 |
| elegant-100ml-18-415 | 83 | 0 | 4 |
| elegant-15ml-13-415 | 57 | 0 | 2 |
| elegant-60ml-18-415 | 89 | 0 | 5 |
| empire-100ml-18-415 | 42 | 0 | 2 |
| empire-50ml-18-415 | 45 | 0 | 2 |
| flair-15ml-13-415 | 30 | 0 | 0 |
| grace-55ml-18-415 | 42 | 0 | 1 |
| pillar-9ml-13-415 | 2 | 0 | 1 |
| pillar-9ml-17-415 | 1 | 0 | 0 |
| plastic-bottle-30ml-13-415 | 0 | 0 | 3 |
| rectangle-10ml-13-415 | 60 | 0 | 0 |
| round-128ml-18-415 | 90 | 0 | 2 |
| round-78ml-18-415 | 84 | 0 | 2 |
| royal-13ml-13-415 | 29 | 0 | 0 |
| sleek-100ml-18-415 | 42 | 0 | 2 |
| sleek-30ml-18-415 | 36 | 0 | 2 |
| sleek-50ml-18-415 | 42 | 0 | 2 |
| sleek-5ml-13-415 | 30 | 0 | 0 |
| sleek-8ml-13-415 | 30 | 0 | 0 |
| slim-100ml-18-415 | 41 | 0 | 2 |
| slim-30ml-18-415 | 36 | 0 | 1 |
| slim-50ml-18-415 | 42 | 0 | 1 |
| square-15ml-13-415 | 29 | 0 | 0 |
| tola-decorative-3ml-14.3mm | 1 | 0 | 0 |
| tola-decorative-6ml-14.3mm | 1 | 0 | 0 |
| tulip-5ml-13-415 | 30 | 0 | 0 |
| tulip-6ml-13-415 | 29 | 0 | 1 |

Unresolved, by reason (Convex corrections):

- **29** — no current 18-415 cap/faux-leather-cap carries the SKU code 'ShnBlk': GBCrcl50RdcrShnBlk, GBCrclFrst50RdcrShnBlk, GBCrcl100RdcrShnBlk, GBCrclFrst100RdcrShnBlk, GBcyl25RdcrShnBlk, GBCyl50RdcrShnBlk, GBCyl100RdcrShnBlk, GBDmnd2ozRdcrShnBlk, GBDiva30RdcrShnBlk, GBDiva46RdcrShnBlk, GBDivaFrst46RdcrShnBlk, GBDiva100RdcrShnBlk, GBElg60RdcrShnBlk, GBElgFrst60RdcrShnBlk, GBElg100RdcrShnBlk, GBElgFrst100RdcrShnBlk, GBEmp50RdcrShnBlk, GBEmp100RdcrShnBlk, GBGrce55RdcrShnBlk, GBRnd78RdcrShnBlk, GBRndFrst78RdcrShnBlk, GBRnd128RdcrShnBlk, GBRndFrst128RdcrShnBlk, GBSlk30RdcrShnBlk, GBSlk50RdcrShnBlk, GBSlk100RdcrShnBlk, GBSlm30RdcrShnBlk, GBSlm50RdcrShnBlk, GBSlm100RdcrShnBlk
- **9** — own class metal-atomizer: no components ruled compatible: GBAtom5Blk, GBAtom5BlkDot, GBAtom5Blu, GBAtom5Gl, GBAtom5Red, GBAtom5Sl, GBAtom5SlDot, GBAtom5SlStars, GBAtom5PnkDot
- **8** — no current 13-415 cap carries the SKU code 'BlkShSht' (no component record and no master photo): GBBell10BlkShSht, GBCylBlu5BlkShSht, GBCyl5BlkShSht, GBTallCyl9BlkShSht, GBTallCylFrst9BlkShSht, GBElgFrst15BlkShSht, GBPillar9BlkShSht, GBTulip6BlkShSht
- **4** — no current 13-415 cap carries the SKU code 'CuSht' (no component record and no master photo): GBCylBlu5CuSht, GBCyl5CuSht, GBTallCyl9CuSht, GBTallCylFrst9CuSht
- **4** — no current 13-415 cap carries the SKU code 'GlMattSht' (no component record and no master photo): GBCylBlu5GlMattSht, GBCyl5GlMattSht, GBTallCyl9GlMattSht, GBTallCylFrst9GlMattSht
- **4** — no current 13-415 cap carries the SKU code 'SlMattSht' (no component record and no master photo): GBCylBlu5SlMattSht, GBCyl5SlMattSht, GBTallCyl9SlMattSht, GBTallCylFrst9SlMattSht
- **4** — no current 13-415 cap carries the SKU code 'GlSht' (no component record and no master photo): GBCylBlu5GlSht, GBCyl5GlSht, GBTallCyl9GlSht, GBTallCylFrst9GlSht
- **4** — no current 13-415 cap carries the SKU code 'SlSht' (no component record and no master photo): GBCylBlu5SlSht, GBCyl5SlSht, GBTallCyl9SlSht, GBTallCylFrst9SlSht
- **3** — own class plastic-bottle: no components ruled compatible: PB1ozSpryNat, PB1ozSprySl, PB1ozClearcap
- **1** — no current 13-415 cap carries the SKU code 'MinarCu' (no component record and no master photo): GBElg15MinarCu
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
- **1** — no current 18-415 lotion-pump carries the SKU code 'ClrOvrCap': LBElg60LtnClrOvrCap
- **1** — website SKU 'LBElg60WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBElg60WhtClOvrCp
- **1** — website SKU 'LBElgFrst60WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBElgFrst60WhtClOvrCp
- **1** — website SKU 'LBElg100WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBElg100WhtClOvrCp
- **1** — website SKU 'LBElgFrst100WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBElgFrst100WhtClOvrCp
- **1** — website SKU 'LBEmp50WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBEmp50WhtClOvrCp
- **1** — website SKU 'LBEmp100WhtClOvrCp' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBEmp100WhtClOvrCp
- **1** — website SKU 'LBSlk30WhtRectClOverCap' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBSlk30WhtRectClOverCap
- **1** — website SKU 'LBSlk50WhtRectClOverCap' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBSlk50WhtRectClOverCap
- **1** — website SKU 'LBSlk100WhtRectClOverCap' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBSlk100WhtRectClOverCap
- **1** — website SKU 'LBSlm100MtSlClOvrCap' names no 18-415 top (AnSpTsl, AnSp, Spry, Ltn, Drp, Rdcr): LBSlm100MtSlClOvrCap

## Catalogue data defects the register surfaced (Convex, not code)

- **4 assemblies list component TYPE LABELS instead of SKUs** (e.g. `Roll-On Cap`, `Sprayer`): 13-415 2, 17-415 2. Samples: GBCyl5WhtSht, GBTallCyl9WhtSht, GBCylSwrl9MtlRollWht, GBCylSwrl9RollWht
- **0 assemblies list a component that is not a Component row**: 
- **0 assemblies list a SKU with no record at all**: 

## Assemblies with no component list — 96

| neck | count | families |
|---|---|---|
| 12mm | 4 | Cylinder |
| 13-415 | 16 | Atomizer, Cylinder, Elegant, Pillar, Plastic Bottle, Tulip |
| 13-425 | 16 | Vial |
| 14.3mm | 2 | Decorative |
| 16mm | 8 | Cylinder |
| 17mm | 11 | Atomizer |
| 18-400 | 1 | Boston Round |
| 18-415 | 38 | Cylinder |

## Quarantine — 120 rows

| kind | count |
|---|---|
| assembly | 55 |
| component | 16 |
| review-2026-09-23 | 49 |

## Keys

- `bodyId` = `[shape-]profile-<capacity>ml-<neck>` (profile from productGroupSlug, else family); `builderBodyId` mirrors `builderBodyIdentity()` in src/lib/bottle-builder/model.ts.
- Components and assemblies are keyed by **graceSku**; `websiteSku` is carried as the legacy alias. Parts that are not products are keyed `LIB-<neck>-<name>` (`componentId`, `sellable` false).
- Component `status`: current | retired | quarantine. Assembly `status`: verified | candidate | exception | quarantine | retired.
- Nothing in Convex, Shopify or the website was changed. Rebuild: `python3 scripts/register/build_register.py`.
