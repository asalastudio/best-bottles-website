# Best Bottles — bottle geometry audit

Minimum set of unique bottle **body** geometries requiring a master 3D model, separating true container geometry from SKU-level variation.

**Analysis and inventory only — no modeling performed or started.**

Generated from `data/audits/2026-03-06/convex_snapshot.json` (2,318 SKUs) joined to `data/bestbottles_raw_website_data.json` (2,285 dimension records) on `websiteSku`; 2,278 SKUs joined (98.3%). Reproduce with `scripts/paper-doll/geometry_audit.py`.

## Executive summary

```
TOTAL SKUs ANALYZED:                     2318
  bottle bodies                          2118
  closures / accessories (components)    148
  non-product (gift box, bags, tools)    52
TOTAL BOTTLE FAMILIES:                   27
TOTAL UNIQUE BOTTLE BODY GEOMETRIES:     109
TOTAL UNIQUE CLOSURE / ACCESSORY COMPS:  31
HIGH-CONFIDENCE BODY GROUPS:             50
MEDIUM-CONFIDENCE BODY GROUPS:           34
HUMAN-REVIEW BODY GROUPS (LOW):          25
EXISTING 3D MODELS WE CAN REUSE:         0 bodies, 1 partial closure lathe
NEW 3D MODELS WE ACTUALLY NEED TO BUILD: 109 bodies + 31 components
```

### The number that actually matters

- **14 bodies cover 50% of all body SKUs** (1,102 of 2,118)
- **30 bodies cover 80% of all body SKUs** (1,714 of 2,118)
- **37 bodies cover 90% of all body SKUs** (1,907 of 2,118)
- The remaining tail is **48 bodies serving ≤2 SKUs each**

The catalog is far more concentrated than the SKU count suggests. A build that stops at 30 bodies already renders four fifths of the catalog.

## What already exists

Inspected before proposing anything new:

| Asset | Found | Notes |
|---|---|---|
| Bottle body 3D models | **none** | no `.blend`, `.glb`, `.gltf`, `.obj`, `.fbx`, or `.usdz` anywhere in either repo |
| Closure 3D | **1, partial** | `workers/paper-doll-renderer/blender/cyl9_rollon_overcap.py` — `build_lathed_cap(profile, segments)` is a revolve driven by `config.geometry.profileMmEquivalent` |
| Materials | yes | `workers/paper-doll-renderer/blender/materials.py` — surface, stone, mask |
| 2D body plates | 5, off-repo | CYL-9ML clear/amber/cobalt/frosted/swirl, SHA-frozen; `body-plate-registry.json` referenced by the closure handoff but not committed here |
| Placement recipe | yes | 17-415 closure seat frozen: body width 363 px, seat y=1002, canvas 2080×2288 |
| Family/body IDs | **none** | no pre-existing body-geometry ID scheme; `BB-BODY-*` introduced here |

**The existing closure script is the single most important precedent in the audit.** It is already profile-driven parametric geometry — a JSON profile lathed at N radial segments. The same mechanism extends to bottle bodies for every EASY family below.

## How bodies were separated from SKU variation

Excluded from the body key (these never create a new geometry): glass colour/tint, frosted vs clear, cap colour, cap material, trim, applicator, roller ball material, sprayer/pump/dropper colour, closure, overcap, dip tube, surface finish, decoration, labels, printing, price, stock.

Included: family, capacity, neck finish, body diameter, bare body height.

**Two data rules were derived from ground truth rather than assumed:**

1. **`heightWithoutCap` is the body dimension; `heightWithCap` is not.** All 27 Swirl Cylinder 9 mL SKUs report `bare=74, dia=21` across every applicator and cap colour, while capped height moves 87→98 with the applicator. Keying on capped height would have split one bottle into three.
2. **Published dimensions carry a ±1 mm diameter / ±4 mm height noise floor.** The CYL-9ML pilot proves clear/amber/cobalt/frosted/swirl are one geometry (necks agree within 4 px, one closure recipe seats on all five), yet the raw catalog splits them into `dia=20/bare=70`, `dia=21/bare=74` and `dia=20/bare=74` — with **Frosted appearing in two clusters at once**. Bodies within family+neck are therefore merged below ±2 mm / ±5 mm. That merge alone collapsed 143 SKUs into the single correct CYL-9ML body.

## Bottle bodies

Full table: `bottle-bodies.csv` (109 rows). Top 25 by SKU count:

| Body ID | Family | Description | Capacity | Dia | Body H | Neck | SKUs | Colours | Applicators | Complexity | Status | Conf |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BB-BODY-001 | Cylinder | 9 ml Cylinder (70 mm body) | 9 ml | 20 mm | 70 mm | 17-415 | 143 | 5 | 4 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-002 | Diva | 46 ml Diva (89 mm body) | 46 ml | 49 mm | 89 mm | 18-415 | 99 | 2 | 6 | MODERATE | UNIQUE GEOMETRY | HIGH |
| BB-BODY-003 | Elegant | 60 ml Elegant (86 mm body) | 60 ml | — | 86 mm | 18-415 | 94 | 2 | 6 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-004 | Round | 128 ml Round (83 mm body) | 128 ml | 69 mm | 83 mm | 18-415 | 92 | 2 | 6 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-005 | Elegant | 100 ml Elegant (109 mm body) | 100 ml | — | 109 mm | 18-415 | 87 | 2 | 5 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-006 | Circle | 100 ml Circle (105 mm body) | 100 ml | — | 105 mm | 18-415 | 86 | 2 | 5 | EASY | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-007 | Round | 78 ml Round (73 mm body) | 78 ml | 59 mm | 73 mm | 18-415 | 86 | 2 | 5 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-008 | Circle | 50 ml Circle (87 mm body) | 50 ml | — | 87 mm | 18-415 | 76 | 2 | 5 | EASY | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-009 | Cylinder | 9 ml Cylinder (106 mm body) | 9 ml | 18 mm | 106 mm | 13-415 | 59 | 2 | 3 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-010 | Tulip | 5 ml Tulip (45 mm body) | 5 ml | 23 mm | 45 mm | 13-415 | 59 | 2 | 3 | MODERATE | UNIQUE GEOMETRY | HIGH |
| BB-BODY-011 | Cylinder | 5 ml Cylinder (53 mm body) | 5 ml | 17 mm | 53 mm | 13-415 | 58 | 2 | 3 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-012 | Elegant | 15 ml Elegant (61 mm body) | 15 ml | — | 61 mm | 13-415 | 57 | 2 | 3 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-013 | Boston Round | 60 ml Boston Round (94 mm body) | 60 ml | 39 mm | 94 mm | 20-400 | 54 | 3 | 3 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-014 | Boston Round | 30 ml Boston Round (78 mm body) | 30 ml | 33 mm | 78 mm | 20-400 | 52 | 3 | 3 | EASY | PARAMETRIC VARIANT | HIGH |
| BB-BODY-015 | Empire | 50 ml Empire (88 mm body) | 50 ml | — | 88 mm | 18-415 | 47 | 1 | 6 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-016 | Empire | 100 ml Empire (107 mm body) | 100 ml | — | 107 mm | 18-415 | 44 | 1 | 5 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-017 | Sleek | 100 ml Sleek (149 mm body) | 100 ml | — | 149 mm | 18-415 | 44 | 1 | 5 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-018 | Cylinder | 100 ml Cylinder (154 mm body) | 100 ml | 35 mm | 154 mm | 18-415 | 43 | 1 | 5 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-019 | Cylinder | 50 ml Cylinder (117 mm body) | 50 ml | 32 mm | 117 mm | 18-415 | 43 | 1 | 5 | EASY | PARAMETRIC VARIANT | HIGH |
| BB-BODY-020 | Diamond | 60 ml Diamond (88 mm body) | 60 ml | — | 88 mm | 18-415 | 43 | 1 | 5 | COMPLEX | UNIQUE GEOMETRY | MEDIUM |
| BB-BODY-021 | Diva | 100 ml Diva (113 mm body) | 100 ml | 64 mm | 113 mm | 18-415 | 43 | 1 | 5 | MODERATE | UNIQUE GEOMETRY | HIGH |
| BB-BODY-022 | Grace | 55 ml Grace (113 mm body) | 55 ml | — | 113 mm | 18-415 | 43 | 1 | 5 | MODERATE | UNIQUE GEOMETRY | MEDIUM |
| BB-BODY-023 | Sleek | 50 ml Sleek (139 mm body) | 50 ml | — | 139 mm | 18-415 | 36 | 1 | 4 | MODERATE | PARAMETRIC CANDIDATE | MEDIUM |
| BB-BODY-024 | Slim | 100 ml Slim (154 mm body) | 100 ml | 37 mm | 154 mm | 18-415 | 36 | 1 | 4 | EASY | UNIQUE GEOMETRY | HIGH |
| BB-BODY-025 | Slim | 50 ml Slim (121 mm body) | 50 ml | 31 mm | 121 mm | 18-415 | 36 | 1 | 4 | EASY | UNIQUE GEOMETRY | HIGH |

## Closures and accessories (separate component library)

31 components, 148 SKUs. Colourways are finish variations on one mesh and are **not** counted as separate components. Full table: `bottle-components.csv`.

| Component ID | Type | Style | Neck | SKUs | Colourways | Existing model |
|---|---|---|---|---|---|---|
| BB-SPRAYER-001 | Sprayer | ? | 18-415 | 24 | 0 | NO |
| BB-ROLLER-001 | Roll-On Cap | ? | 13-415 | 13 | 0 | PARTIAL (cyl9_rollon_overcap.py lathe) |
| BB-ROLLER-002 | Roll-On Cap | ? | 17-415 | 13 | 0 | PARTIAL (cyl9_rollon_overcap.py lathe) |
| BB-DROPPER-001 | Dropper | ? | 20-400 | 12 | 0 | NO |
| BB-CAP-001 | Cap/Closure | ? | 18-415 | 11 | 0 | NO |
| BB-SPRAYER-002 | Sprayer | ? | 13-415 | 8 | 0 | NO |
| BB-PUMP-001 | Lotion Pump | ? | 18-415 | 7 | 0 | NO |
| BB-DROPPER-002 | Dropper | ? | 18-400 | 6 | 0 | NO |
| BB-SPRAYER-003 | Sprayer | ? | 17-415 | 6 | 0 | NO |
| BB-ROLLER-003 | Roll-On Cap | ? | 20-400 | 6 | 0 | PARTIAL (cyl9_rollon_overcap.py lathe) |
| BB-CAP-002 | Cap/Closure | Cap/Closure | PRESS-FIT | 6 | 2 | NO |
| BB-CAP-003 | Cap/Closure | ? | 8-425 | 5 | 0 | NO |
| BB-SPRAYER-004 | Sprayer | ? | 15-415 | 5 | 0 | NO |
| BB-DROPPER-003 | Dropper | ? | 18-415 | 3 | 0 | NO |
| BB-ROLLER-004 | Roll-On Cap | ? | 15-415 | 2 | 0 | PARTIAL (cyl9_rollon_overcap.py lathe) |
| BB-COMP-001 | Plastic Bottle | ? | 13-415 | 2 | 0 | NO |
| BB-CAP-004 | Cap/Closure | ? | 18-400 | 2 | 0 | NO |
| BB-CAP-005 | Cap/Closure | ? | 20-400 | 2 | 0 | NO |

## SAME GEOMETRY / PARAMETRIC VARIANT / UNIQUE GEOMETRY

- **SAME GEOMETRY** — 2,209 SKUs collapse into 109 bodies. Every glass colour, cap colour, applicator and finish combination reuses one body mesh. This is the bulk of the reduction and it is already proven by the CYL-9ML pilot (26 layers → 145 configurations).
- **PARAMETRIC VARIANT** — 10 bodies in 5 groups with a *verified* shared diameter. These can be driven from one profile.
- **PARAMETRIC CANDIDATE** — 29 bodies in 13 groups that share family and neck but whose diameter is unpublished. Likely parametric, **not yet provable**.
- **UNIQUE GEOMETRY** — 70 bodies with no sibling.

Largest parametric groups (height is the driving parameter):

| Group | Status | Family | Neck | Dia | Bodies | SKUs | Heights (mm) | Span |
|---|---|---|---|---|---|---|---|---|
| `CAND-ELEGANT-18-415` | CANDIDATE | Elegant | 18-415 | — | 2 | 181 | 86, 109 | 23 mm |
| `CAND-CIRCLE-18-415` | CANDIDATE | Circle | 18-415 | — | 2 | 162 | 87, 105 | 18 mm |
| `CAND-SLEEK-18-415` | CANDIDATE | Sleek | 18-415 | — | 3 | 110 | 98, 139, 149 | 51 mm |
| `CAND-EMPIRE-18-415` | CANDIDATE | Empire | 18-415 | — | 2 | 91 | 88, 107 | 19 mm |
| `CAND-RECTANGLE-13-415` | CANDIDATE | Rectangle | 13-415 | — | 2 | 60 | 50, 101 | 51 mm |
| `CAND-SLEEK-13-415` | CANDIDATE | Sleek | 13-415 | — | 2 | 60 | 45, 66 | 21 mm |
| `CAND-ELEGANT-13-415` | CANDIDATE | Elegant | 13-415 | — | 2 | 59 | 61 | 0 mm |
| `PARAM-BOSTONROUND-20-400-33` | VARIANT | Boston Round | 20-400 | 33 | 2 | 53 | 68, 78 | 10 mm |
| `PARAM-CYLINDER-18-415-32` | VARIANT | Cylinder | 18-415 | 32 | 2 | 50 | 83, 117 | 34 mm |
| `CAND-SLIM-18-415` | CANDIDATE | Slim | 18-415 | — | 3 | 21 | 87, 121, 154 | 67 mm |
| `PARAM-SLEEK-18-415-28` | VARIANT | Sleek | 18-415 | 28 | 2 | 16 | 98, 139 | 41 mm |
| `CAND-ELEGANT-15-415` | CANDIDATE | Elegant | 15-415 | — | 2 | 14 | 75 | 0 mm |

## Models we need to build, ranked

Ranked by SKUs served, then by modeling speed.

| Rank | Body ID | Description | SKUs | Complexity | Conf |
|---|---|---|---|---|---|
| 1 | BB-BODY-001 | 9 ml Cylinder (70 mm body) | 143 | EASY | HIGH |
| 2 | BB-BODY-002 | 46 ml Diva (89 mm body) | 99 | MODERATE | HIGH |
| 3 | BB-BODY-003 | 60 ml Elegant (86 mm body) | 94 | MODERATE | MEDIUM |
| 4 | BB-BODY-004 | 128 ml Round (83 mm body) | 92 | EASY | HIGH |
| 5 | BB-BODY-005 | 100 ml Elegant (109 mm body) | 87 | MODERATE | MEDIUM |
| 6 | BB-BODY-006 | 100 ml Circle (105 mm body) | 86 | EASY | MEDIUM |
| 7 | BB-BODY-007 | 78 ml Round (73 mm body) | 86 | EASY | HIGH |
| 8 | BB-BODY-008 | 50 ml Circle (87 mm body) | 76 | EASY | MEDIUM |
| 9 | BB-BODY-009 | 9 ml Cylinder (106 mm body) | 59 | EASY | HIGH |
| 10 | BB-BODY-010 | 5 ml Tulip (45 mm body) | 59 | MODERATE | HIGH |
| 11 | BB-BODY-011 | 5 ml Cylinder (53 mm body) | 58 | EASY | HIGH |
| 12 | BB-BODY-012 | 15 ml Elegant (61 mm body) | 57 | MODERATE | MEDIUM |
| 13 | BB-BODY-013 | 60 ml Boston Round (94 mm body) | 54 | EASY | HIGH |
| 14 | BB-BODY-014 | 30 ml Boston Round (78 mm body) | 52 | EASY | HIGH |
| 15 | BB-BODY-015 | 50 ml Empire (88 mm body) | 47 | MODERATE | MEDIUM |
| 16 | BB-BODY-016 | 100 ml Empire (107 mm body) | 44 | MODERATE | MEDIUM |
| 17 | BB-BODY-017 | 100 ml Sleek (149 mm body) | 44 | MODERATE | MEDIUM |
| 18 | BB-BODY-018 | 100 ml Cylinder (154 mm body) | 43 | EASY | HIGH |
| 19 | BB-BODY-019 | 50 ml Cylinder (117 mm body) | 43 | EASY | HIGH |
| 20 | BB-BODY-021 | 100 ml Diva (113 mm body) | 43 | MODERATE | HIGH |

Complexity against catalog weight — the hardest geometry earns the least:

| Complexity | Bodies | SKUs served |
|---|---|---|
| EASY | 68 | 1,118 |
| MODERATE | 26 | 932 |
| COMPLEX | 15 | 68 |

**15 COMPLEX bodies serve only 68 SKUs between them.** They should be last, and several are candidates for retirement rather than modeling.

## Human review queue

25 bodies (45 SKUs) lack the published dimensions needed to confirm grouping — missing bare height, missing neck finish, or both. They are **not** counted as confirmed masters.

| Body ID | Family | Description | SKUs | Missing |
|---|---|---|---|---|
| BB-BODY-041 | Elegant | 30 ml Elegant | 10 | body height, diameter |
| BB-BODY-050 | Bell | 10 ml Bell | 6 | body height, diameter |
| BB-BODY-058 | Apothecary | 30 ml Apothecary | 3 | body height |
| BB-BODY-066 | Cylinder | 30 ml Cylinder | 2 | body height, diameter |
| BB-BODY-071 | Elegant | 15 ml Elegant | 2 | body height, diameter |
| BB-BODY-072 | Lotion Bottle | 30 ml Lotion Bottle | 2 | body height, diameter, neck finish |
| BB-BODY-073 | Pillar | 9 ml Pillar | 2 | body height, diameter |
| BB-BODY-075 | Aluminum Bottle | 100 ml Aluminum Bottle | 1 | body height |
| BB-BODY-077 | Apothecary | 118 ml Apothecary | 1 | body height, diameter |
| BB-BODY-079 | Boston Round | 15 ml Boston Round | 1 | body height, diameter |
| BB-BODY-084 | Cream Jar | 20 ml Cream Jar | 1 | body height |
| BB-BODY-088 | Cream Jar | 63 ml Cream Jar | 1 | body height |
| BB-BODY-089 | Cylinder | 118 ml Cylinder | 1 | body height, diameter, neck finish |
| BB-BODY-090 | Cylinder | 227 ml Cylinder | 1 | body height, diameter, neck finish |
| BB-BODY-091 | Cylinder | 454 ml Cylinder | 1 | body height, diameter, neck finish |

## Data defects found

1. **Diameter is published on only 55% of SKUs** (1,275 / 2,285). This is the single largest blocker to proving parametric families — 29 bodies sit in PARAMETRIC CANDIDATE purely for want of a diameter. Measuring one diameter per candidate group would move them to confirmed.
2. **The Convex snapshot is missing dimensions almost entirely** — diameter on 5/2,318, heights on 19/2,318, `shape` on 22/2,318. All usable dimensions come from the scraped website data. Convex is product truth but not dimensional truth.
3. **`cylinder-white-cap-repair.ts` conflicts with the catalog.** It declares the plastic-roller Swirl row at `heightWithoutCap: 63`, but all 27 other Swirl Cylinder 9 mL SKUs — including every other plastic roller — publish 74. One of the two is wrong; the repair file is the outlier.
4. **Frosted CYL-9ML is published under two different dimension sets** (`dia=20/bare=74` and `dia=21/bare=74`) for what the pilot proves is one bottle.

## Conclusion

> **Based on the current catalog, we need to create approximately 109 unique bottle body models to support 2,118 SKUs.**

> **If we use parametric geometry, that number can potentially be reduced to approximately 88 master Blender models** (70 unique + 18 parametric families).

Two caveats on the second number, stated plainly:

- 13 of the 18 parametric families are unconfirmed because diameter is unpublished. Measure one diameter per group and the reduction becomes provable.
- The reduction from 109 → 88 is modest because the catalog is genuinely diverse across families. The large win is not parametric collapse — it is the 2,118 → 109 SAME-GEOMETRY collapse already achieved, a 19.4× reduction.

**Practical build target: 30 bodies covers 80% of the catalog.** Sequenced by the ranking above, and every one of the top bodies is EASY or MODERATE.

