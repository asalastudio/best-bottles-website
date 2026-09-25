# Component register — Phase 1 reconciliation (2026-09-24)

Source: Convex dev export (2540 rows, collected 2026-09-25T06:24:53Z), PSD library inventory (393 PSDs), body-dims (144 keys), 23 Sep review files (49 items). Read-only.

## Totals

- Bodies: **94 current** (3 retired-only) across 34 neck groups
- Components: **136 current**, 24 retired, 16 quarantined; **109 current components have a library PSD** (0 via alias-map, 34 case-insensitive)
- Assemblies: **2022 verified**, **129 retired**, **104 candidate**, **55 quarantine**, **2 exception**
- Quarantine rows: 120 (see quarantine.csv)

## Rulings applied

- **2026-09-24 · Jordan** — Plastic bottles are their own compatibility class. A 13-415 neck on a plastic bottle does not make the 13-415 glass-bottle components compatible with it, nor it with them. _(applies: bodies.compatibilityClass = plastic-bottle; their listed glass components are not resolved)_
- **2026-09-24 · Jordan** — CMP-SPR-CLR-30ML (PB1ozSpryNat) and CMP-SPR-SLV- (PB1ozSprySl) are plastic bottles, not components; remove them from every component list. _(applies: assemblies: excluded from listed components before resolution (494 13-415 lists carried them))_
- Effect this build: pasted products removed from **495** component lists; **5** bodies in the ruled `plastic-bottle` class (cylinder-114ml-no-neck, cylinder-227ml-no-neck, cylinder-454ml-no-neck, plastic-bottle-10ml-no-neck, plastic-bottle-30ml-13-415); 19 other non-glass bodies stand in classes assumed from their category until ruled.

## Per neck

| neck | bodies | glass variants | components | verified | candidate | quarantine | exception | retired |
|---|---|---|---|---|---|---|---|---|
| (none) | 5 | 1 | 0 | 0 | 0 | 6 | 0 | 0 |
| 10mm | 1 | 1 | 0 | 0 | 0 | 3 | 0 | 0 |
| 11mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 12mm | 2 | 1 | 0 | 0 | 4 | 0 | 0 | 0 |
| 13-415 | 17 | 5 | 25 | 498 | 21 | 0 | 0 | 31 |
| 13-425 | 3 | 4 | 2 | 0 | 16 | 0 | 0 | 0 |
| 13mm | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| 14.3mm | 2 | 1 | 0 | 0 | 2 | 0 | 0 | 0 |
| 15-415 | 2 | 2 | 7 | 21 | 0 | 0 | 0 | 0 |
| 16mm | 2 | 1 | 0 | 0 | 8 | 0 | 0 | 0 |
| 17-415 | 2 | 5 | 20 | 144 | 2 | 0 | 0 | 2 |
| 17.52mm | 2 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| 17mm | 1 | 4 | 0 | 0 | 11 | 0 | 0 | 0 |
| 18-400 | 2 | 3 | 8 | 17 | 1 | 0 | 0 | 0 |
| 18-415 | 23 | 2 | 47 | 1225 | 38 | 0 | 2 | 94 |
| 18mm | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 20-400 | 2 | 3 | 20 | 107 | 0 | 0 | 0 | 0 |
| 20-410 | 5 | 2 | 0 | 6 | 1 | 0 | 0 | 0 |
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
- ✅ 18-415: component records 64 vs matrix 64
  - the 23rd 18-415 body is `cylinder-30ml-18-415`: the two fixed-spray exception SKUs, which the matrix keeps in its dashed card
- ✅ 20-400: bottles 107 vs matrix 107; components 20 vs 20
- ✅ 16mm: assemblies 8 vs matrix 8 — by body: cylinder-28ml-16mm 4, cylinder-50ml-16mm 4
- ✅ 13-425: bottle rows 16 vs matrix 16
- ✅ 8-425: bottle rows 4 vs matrix 4
- ✅ 12mm: assemblies 4 vs matrix 4 — by body: cylinder-3.3ml-12mm 2, cylinder-4ml-12mm 2

## Component types by neck (current)

| neck | cap | cap-review | dropper | faux-leather-cap | fine-mist-sprayer | lotion-pump | plug-applicator | review | roll-on-cap | tassel-bulb-sprayer | vintage-bulb-sprayer |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13-415 | 7 |  |  |  | 5 |  |  |  | 13 |  |  |
| 13-425 | 2 |  |  |  |  |  |  |  |  |  |  |
| 15-415 |  |  |  |  | 4 |  |  |  | 2 | 1 |  |
| 17-415 |  |  | 1 |  | 5 |  |  |  | 13 | 1 |  |
| 18-400 | 2 |  | 6 |  |  |  |  |  |  |  |  |
| 18-415 | 6 |  | 3 | 5 | 7 | 7 |  |  |  | 11 | 8 |
| 20-400 | 2 |  | 12 |  |  |  |  |  | 6 |  |  |
| 22-400 | 1 |  |  |  |  |  |  |  |  |  |  |
| 24-400 | 1 |  |  |  |  |  |  |  |  |  |  |
| 8-425 | 5 |  |  |  |  |  |  |  |  |  |  |

## Library gaps — 27 current components with no PSD in 20. Caps / 21. Tassels

- **13-415** (12): CP13-415SpryBlkMt [cap], CP13-415SpryBlkSh [cap], CP13-415SpryBluMt [cap], CP13-415SpryGlMt [cap], CP13-415SpryGlSh [cap], CP13-415SprySlMt [cap], CP13-415SprySlSh [cap], 13-415CAP4SpryCuMt [fine-mist-sprayer], 13-415CAP4SpryGlSh [fine-mist-sprayer], 13-415CAP4SprySlMt [fine-mist-sprayer], CP13-415SpryCuMt [fine-mist-sprayer], GBATom5RedBurg [fine-mist-sprayer]
- **13-425** (2): CP13-425Blk [cap], CP13-425Wht [cap]
- **17-415** (1): Droppers1ozElg [dropper]
- **18-400** (2): 18-400CpAppBlk [cap], 18-400CpShortBlk [cap]
- **18-415** (4): 18-415CAP4SpryMtGl [fine-mist-sprayer], 18-415CAP4SpryShnBlk [fine-mist-sprayer], CP18-415AnSpPnk [vintage-bulb-sprayer], CP18-415AnSpTslGl [tassel-bulb-sprayer]
- **20-400** (2): 20-400Cp2ozShortBlk [cap], 20-400cp1ozShortBlk [cap]
- **22-400** (1): CapBlackPoly22mm-400 [cap]
- **24-400** (1): CP24-400BlkPls [cap]
- **8-425** (2): 8-425CpShortBlack [cap], 8-425CpShortWhite [cap]

## Library PSDs that no component record claims — 29 stems in 20. Caps

- **10. 18-415 Ansp Tsl**: AnspTsl18-415Gl
- **18. 13-415 Sprayers**: Spry13-415BlkMt, Spry13-415CuMt, Spry13-415BlkSh, Spry13-415BluMt, Spry13-415GlSh, Spry13-415GlMt, Spry13-415SlMt, Spry13-415SlSh
- **2. 20-400  Cap**: CP20-4002ozShortBlk, CP20-4001ozShortBlk
- **20.  8-245 Caps**: CP8-425ShortBlack, CP8-425ShortWhite
- **21. Hearts 8-245 Caps**: CP8-425BluTslShortSilverCap, CP8-425ShortBlack, CP8-425GlChainShortShnGlCap, CP8-425SlChainShortShnSlCap, CP8-425RedTslShortShnGlCap
- **22. Vials Wand**: VialWandBlk, VialWandClr
- **23. 18-415 Reducer**: 415Reducer
- **24. 13-415 Roll on**: 13-415PlsticRollon
- **25. 13-415  Metal Roll on**: 13-415MtlRollon
- **26. 18-400 Cap**: CP18-400ShortBlk
- **27. 18-400 Cap with Wand**: CP18-400AppBlk
- **28. 14.3 Cap**: CP14mmAppShnSlBlueDot, CP14mmAppShnGlRedDot
- **5. 18-400 Cap**: CP20-4002ozShortBlk
- **6. 18-415 Caps**: CP18-415ShnBlk
- **8. 18-415 Lotion**: Ltn18-415SqClr
- **9. 18-415 Ansp**: Ansp18-415Pnk

## Alias candidates — 31 spelling pairs for Jordan to confirm (alias-candidates.csv)

| Convex websiteSku | library stem | folder(s) | match |
|---|---|---|---|
| CP13-415SpryBlkMt | Spry13-415BlkMt | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryBlkMt | Spry13-415BluMt | 18. 13-415 Sprayers | similar 0.944 |
| CP13-415SpryBlkSh | Spry13-415BlkSh | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryBlkSh | Spry13-415GlSh | 18. 13-415 Sprayers | similar 0.914 |
| CP13-415SpryBluMt | Spry13-415BluMt | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryBluMt | Spry13-415BlkMt | 18. 13-415 Sprayers | similar 0.944 |
| CP13-415SpryGlMt | Spry13-415GlMt | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryGlMt | Spry13-415BlkMt | 18. 13-415 Sprayers | similar 0.914 |
| CP13-415SpryGlSh | Spry13-415GlSh | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryGlSh | Spry13-415BlkSh | 18. 13-415 Sprayers | similar 0.914 |
| CP13-415SprySlMt | Spry13-415SlMt | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SprySlMt | Spry13-415SlSh | 18. 13-415 Sprayers | similar 0.882 |
| CP13-415SprySlSh | Spry13-415SlSh | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SprySlSh | Spry13-415SlMt | 18. 13-415 Sprayers | similar 0.882 |
| 13-415CAP4SpryCuMt | Spry13-415CuMt | 18. 13-415 Sprayers | similar 0.85 |
| 13-415CAP4SpryGlSh | Spry13-415GlSh | 18. 13-415 Sprayers | similar 0.85 |
| 13-415CAP4SprySlMt | Spry13-415SlMt | 18. 13-415 Sprayers | similar 0.85 |
| 13-415CAP4SprySlMt | Spry13-415CuMt | 18. 13-415 Sprayers | similar 0.8 |
| CP13-415SpryCuMt | Spry13-415CuMt | 18. 13-415 Sprayers | tokens-equal 1.0 |
| CP13-415SpryCuMt | Spry13-415BluMt | 18. 13-415 Sprayers | similar 0.914 |
| 18-400CpAppBlk | CP18-400AppBlk | 27. 18-400 Cap with Wand | similar 0.903 |
| 18-400CpShortBlk | CP18-400ShortBlk | 26. 18-400 Cap | similar 0.914 |
| 18-415CAP4SpryMtGl | Spry13-415GlMt | 18. 13-415 Sprayers | similar 0.8 |
| CP18-415AnSpPnk | Ansp18-415Pnk | 9. 18-415 Ansp | similar 0.839 |
| CP18-415AnSpTslGl | AnspTsl18-415Gl | 10. 18-415 Ansp Tsl | similar 0.865 |
| 20-400Cp2ozShortBlk | CP20-4002ozShortBlk | 2. 20-400  Cap | 5. 18-400 Cap | similar 0.864 |
| 20-400Cp2ozShortBlk | CP20-4001ozShortBlk | 2. 20-400  Cap | similar 0.864 |
| 20-400cp1ozShortBlk | CP20-4002ozShortBlk | 2. 20-400  Cap | 5. 18-400 Cap | similar 0.864 |
| 20-400cp1ozShortBlk | CP20-4001ozShortBlk | 2. 20-400  Cap | similar 0.864 |
| 8-425CpShortBlack | CP8-425ShortBlack | 20.  8-245 Caps | 21. Hearts 8-245 Caps | similar 0.919 |
| 8-425CpShortWhite | CP8-425ShortWhite | 20.  8-245 Caps | similar 0.919 |

## Catalogue data defects the register surfaced (Convex, not code)

- **7 assemblies list component TYPE LABELS instead of SKUs** (e.g. `Roll-On Cap`, `Sprayer`): 13-415 4, 17-415 2, 20-410 1. Samples: GBAtom5Blk, GBAtom5PnkDot, GBCyl5WhtSht, GBTallCyl9WhtSht, GBCylSwrl9MtlRollWht
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
- Components and assemblies are keyed by **graceSku**; `websiteSku` is carried as the legacy alias.
- Component `status`: current | retired | quarantine. Assembly `status`: verified | candidate | exception | quarantine | retired.
- Nothing in Convex, Shopify or the website was changed. Rebuild: `python3 scripts/register/build_register.py`.
