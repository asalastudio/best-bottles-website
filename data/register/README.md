# Component register

One source of truth for bottle bodies, components and sellable assemblies, keyed by
**neck finish** and **graceSku**. Built read-only from Convex; nothing here writes to
Convex, Shopify or the website. Rebuild with:

```bash
python3 scripts/register/build_register.py                      # from the committed snapshot
python3 scripts/register/build_register.py --export <fresh.json>  # from a new Convex export
```

A fresh export is the same call the 23 Sep neck matrices used —
`products:getProductExportPage` on the dev deployment — and the script trims each row's
nested component dicts to graceSku lists before saving `source/convex-products-<date>.json.gz`.

## Files

| file | one row per | key | status values |
|---|---|---|---|
| `bodies.csv` | physical body: family × capacity × neck (× distinct shape) | `bodyId` = `[shape-]profile-<capacity>ml-<neck>` | current · retired |
| `components.csv` | component product | `graceSku` (`websiteSku` kept as the legacy alias) | current · retired · quarantine |
| `assemblies.csv` | sellable bottle product | `graceSku` | verified · candidate · exception · quarantine · retired |

`components.csv` also holds parts that are not products (`sellable` False), keyed `LIB-<neck>-<name>`.
`assemblies.csv` carries each SKU's own parts in `buildParts` (`role:componentId; …`), with `buildStatus` resolved · partial · unresolved and the reason.
| `rules.json` | neck finish | neck | — |
| `quarantine.csv` | anything that must be resolved before it is composed | — | — |
| `report.md` | the reconciliation this build produced | — | — |

`builderBodyId` on a body mirrors `builderBodyIdentity()` in `src/lib/bottle-builder/model.ts`,
so the register and the Build Your Bottle kits name the same physical bottle the same way.

## How a row earns its status

- **Assembly `verified`** — the Convex record lists its components and every one resolves to a
  component record on the same neck. **`candidate`** — thread match only (no component list, or a
  listed component has no record). **`exception`** — a fixed product the matrices exclude from the
  interchangeable set (the 30 mL Cylinder spray pair). **`quarantine`** — no neck, a non-thread neck,
  or a component on a different neck.
- **Component `quarantine`** — its Convex family is not a component family, or its neck is not a
  thread. `psdStem` / `psdPath` point at the master COMPONENT library PSD
  (`BB-PSD-Files-Master/20. Caps`, `21. Tassels`) when the stem matches exactly, through
  `data/paper-doll/alias-map.json`, or case-insensitively (`psdMatch` says which).
- Every row carries `source` and `confidence`. The 23 Sep review evidence (remedy registers, cap
  identity reviews, review issues) is carried verbatim under `source/neck-thread-2026-09-23/` and
  surfaced in `quarantine.csv` as `review-2026-09-23` rows.

## Next phase

Phase 2 is built: the register loads into the Convex tables `registerBodies`, `registerBodyPlates`,
`registerComponents` and `registerAssemblies` (dev only so far). See
`docs/COMPONENT_REGISTER_PHASE_2_SCHEMA.md`. After a rebuild, push with:

```bash
npx tsx scripts/register/push-register.ts            # dry run: shape, validate, diff
npx tsx scripts/register/push-register.ts --apply    # write what changed
```

## What the register does not decide

Thread equality identifies a candidate, not a fit: roller-insert seating, liner, dip-tube and
stem length, and exact SKU identity still govern a purchasable assembly. Those checks are the
next phases (schema, anchor tooling, renderer); this register is their input.
