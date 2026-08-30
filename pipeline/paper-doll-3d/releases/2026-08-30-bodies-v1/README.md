# Bottle bodies — release 2026-08-30 v1

Frozen copy of the generated bottle-body GLBs. `pipeline/paper-doll-3d/glb/` is
overwritten by every build; this directory is not.

| | |
|---|---|
| `glb/*.glb` | **42 bottle bodies** — one per distinct piece of glass |
| `bodies.csv` | build ledger: 56 bodies, 42 buildable |
| `sku-to-body.csv` | **1,345 SKU -> body_id rows. Ship this with the GLBs.** |
| `build-report.csv` | per-body PASS/SKIP with measured dimensions |
| `contact-sheet.png` | all 42 rendered — the visual gate |
| `MANIFEST.sha256` | `shasum -c MANIFEST.sha256` |

## Contract

Every GLB contains:

- one mesh `BB_BTL_<body_id>` — a **closed solid** (0 non-manifold edges), built
  to the catalogue's millimetres within 0.5%
- `BB_ATTACH_NECK` — empty at the **rim** (z = bare height). Closures
  parent-and-zero here, matching `components_17415.py` ("origin IS the rim
  datum") and `build-master-scene.py` (`BB_ATTACH_NECK` at `(0,0,s["height"])`)
- `BB_REF_SHOULDER` — empty at the neck base; drives the boxy round-neck blend,
  NOT an attach point

Y-up, metres, no materials — the configurator shades by mesh name.
**Verified 42/42 closed solids, 42/42 carrying the attach datum.**

## Not in this release

| | bodies | SKUs | why |
|---|---|---|---|
| sculpted | 4 | 166 | Diva x3 (fluted, scalloped foot) + Diamond (pressed relief). Surface relief is invisible in a silhouette — outside modeler. |
| shape unknown | 10 | 166 | The PDP publishes a Width but no Depth and no Diameter. Empire 50/100 and Sleek 30/100 are visibly rectangular, so width must NOT be read as a diameter. **Four caliper readings unblock 159 SKUs.** |

## Known soft spots

- `Clr-round-na-22x33` and `dPlsBlkPls-round-na-51x59` are single-SKU JARS, not
  bottles; their silhouettes are lids/short cylinders. Low value, unverified.
- Representative silhouettes are chosen by consensus across each body group
  (median profile). Where most SKUs of a body fuse their closure into one PSD
  layer the consensus can still inherit it — the contact sheet is the gate that
  catches it, not a number.
