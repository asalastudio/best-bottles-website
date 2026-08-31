# Catalog ↔ Configurator ↔ Grace reconciliation — 2026-08-31

Sources compared (all read live, DEV deployment):
- **Catalog truth**: Convex `productGroups` — 362 groups / 2,474 SKUs
- **Configurator model**: `src/lib/configurator/families.ts` — 9 families
- **Grace fitment truth**: Convex `fitments` — 63 rows, keyed by threadSize
  (what `checkCompatibility` and `getBottleComponents` answer from)

## Verdict

The three systems are **structurally aligned on the big platforms** —
17-415 and 18-415, which carry 1,550 of 2,474 SKUs — with **six concrete
drifts**, all small, all listed below with exact slugs. Nothing
contradicts the configurator model; the gaps are missing fitment rows and
missing neck data, not wrong ones.

## The component matrix (catalog truth, by neck)

| Neck | Groups | SKUs | Closures sold |
|---|---|---|---|
| 18-415 | 157 | 1,381 | Lotion Pump, Perfume Spray, Fine Mist (Elegant), Vintage Bulb (±Tassel), Reducer, Dropper, Caps — **no roll-ons ✓** |
| 13-415 | 65 | 562 | Rollers (metal+plastic), Fine Mist, Caps |
| 17-415 | 21 | 169 | Rollers, Fine Mist, Lotion Pump, Caps |
| 20-400 | 21 | 127 | Boston Round: Droppers, Rollers, Caps |
| (none) | 13 | 60 | packaging/gift + **3 cylinder bottles missing neck** |
| 15-415 | 8 | 28 | Perfume Spray, Caps |
| 18-400 | 10 | 27 | Droppers, Reducer (the known oddball) |
| 13-425 | 12 | 18 | Vials: caps, droppers |
| others | 55 | ~102 | jars, atomizers, ground-glass, specialty |

18-415 families by SKU weight: Diva 225 · Elegant 190 · Round 186 ·
Circle 171 · Sleek 132 · Slim 129 · Cylinder 99 · Empire 95 · Diamond 45
· Grace 45.

## Configurator ↔ catalog: ALIGNED

All 9 registry families (`cyl9`, `elegant60`, `circle50`, `circle100`,
`round128`, `round78`, `cyl50`, `cyl100`, `elegant100`) were built FROM
the live slugs this session; every base each family offers exists as a
sellable group, and known exclusions are encoded (16mm roll-on off
`cyl50`, 18-400 reducer off `circle50`, no dropper on `round78`/
`circle100`/`elegant100`). The vintage bulb is **parked deliberately**
(geometry) — catalog and fitments both still carry it, so re-enabling is
one line when the sculpt lands. Families not yet in the registry (Diva,
Sleek, Slim, Empire, Diamond, Grace, remaining sizes) are a **geometry
backlog, not data drift** — the closure sets they need already exist.

## Grace (fitments) ↔ catalog: 6 drifts

1. **`dropper-17-415`** (component group, 1 SKU): the catalog sells a
   17-415 dropper component, but no 17-415 fitments row marks Dropper ✓ —
   Grace would refuse to verify a component we sell. Fix: mark Dropper ✓
   on 17-415 rows (or retire the SKU if it is mislabeled — product call).
2. **18-400 has NO fitment rows** while the catalog sells 27 SKUs on it —
   `boston-round-15ml-{amber,cobalt-blue}-18-400-dropper` (12),
   `dropper-18-400` (6), `circle-50ml-frosted-18-400-reducer`, caps.
   Grace answers "unable to verify" for every one. Fix: add 18-400 rows.
3. **13-425 has NO fitment rows** — 4 vial-dropper SKUs
   (`vial-4ml-*-13-425-dropper`) + caps unverifiable.
4. **3 storage cylinders have no neck at all**: `cylinder-454ml-clear`,
   `cylinder-227ml-clear`, `cylinder-118ml-clear` — fitment can never
   verify them; needs a neck value or an explicit not-applicable marker.
5. **Neck-format hygiene**: `PRESS-FIT` vs `Press-Fit`, `48/400` vs the
   `nn-nnn` convention, and oddly-precise decorative necks (`17.52mm`,
   `14.3mm`) — harmless today, but string-keyed fitment lookups make
   every variant spelling a silent miss.
6. **Dev/prod drift**: this audit read DEV (2,474 SKUs / 362 groups);
   prod last measured 2,330 / 356. Production Grace answers from prod —
   re-run this reconciliation there before treating it as shipped truth.

Positive checks: 18-415 fitments allow NO roller ✓ (matches the catalog
and Jordan's rule); Bulb Sprayer ✓ on 18-415 ✓; 17-415 allows
rollers+spray+pump exactly as sold ✓.

## Recommended order

1. Add the missing fitment rows (18-400, 13-425, 17-415 dropper mark) —
   restores Grace's ability to verify 32 real SKUs.
2. Assign necks to the 3 storage cylinders.
3. Normalize neck spellings to one convention.
4. Re-run on PROD after the pricing/catalog sync.
