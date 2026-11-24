# Parts placement, dip tubes and droppers — offline findings

Date: 2026-11-24 · repo @ `17c74fba` · read-only, nothing in the app or data changed.

## What was checked, and what was not

- **Checked:** the recorded geometry of all 1,257 kits the storefront resolves from the repo (`approvedComponentKits()`, i.e. the seven kit files after the app's own merging and patching). For any SKU in this set the product page draws this kit and skips the database (`src/app/products/[slug]/page.tsx:267-281`).
- **Not checked:** pixels. Every finding below is a measurement of recorded positions, not a screenshot. The image hosts and the staging site are blocked from this session, so nothing here is visually confirmed.
- **Not covered:** SKUs whose kits live only in Convex (`productKits`, `registerAssemblies`), and the catalog grid's flat photos.

Reproduce:

```
npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/parts-placement/dump-kits.ts /tmp/kits.json
python3 scripts/audit/parts-placement/analyse.py /tmp/kits.json --out audit
```

Rows: `audit/parts-placement.csv` (676 flags on 581 SKUs; severities are the script's first guess).

## Findings worth acting on

| # | Finding | SKUs | Evidence (canvas is 1000 × 1100) | Likely cause |
|---|---|---|---|---|
| 1 | **Dip tube drawn as a stub** on Sleek 50 ml and 100 ml with tassel sprayers | 18 (`GBSlk50AnSpTsl*`, `GBSlk100AnSpTsl*`) | Tube box is 33 px wide and 30–117 px tall (5–22 mm) for a 1482 px source image; the non-tassel twin on the same bottle is 593–599 px tall | Data: tube top looks derived from the sprayer's bounding box, which on these includes the hanging tassel (`sleek-large-tubes.generated.json`) |
| 2 | **No dip tube inside clear glass when assembled** | 220 (Diva 30/46/100, Empire 50/100, Diamond 60, Grace 55, all 18-415 Clear) | Each kit has a tube part, but only for the exploded view. `register/stage-kit.ts:290-292` says the tube should be drawn assembled too | Data: the approved snapshot predates or bypasses that rule. Needs your ruling: intended or not |
| 3 | **No pipette inside clear glass when assembled** | 6 droppers (Diva 46, Empire 50) | Only the bulb and collar are drawn capped; Elegant 60 and Cylinder 25 droppers do show the pipette | Data, same pattern as #2 |
| 4 | **Elegant 30 ml kits have broken anchors** | 14 (clear and frosted, 15-415) | Seat recorded at y = 1012 on the clear spray kits (the glass top is at 344, the foot at 1061); body sits 3 px below baseline and 6 px off axis; tube is drawn in front of the glass with no transparency (5 SKUs); no scale recorded | Data: legacy kits never re-registered. The neck callout and the builder's re-seating both read the seat anchor |
| 5 | **Pipette placement differs between clear and frosted** Elegant 60 droppers | 6 | Clear: pipette stretched 6% taller than its source to reach the collar. Frosted: undistorted but starts 8–10 px below the collar | Code: clear-only patch at `register/stage-kit.ts:273-282` |
| 6 | **Cylinder 25 ml dropper: pipette starts 39–42 px (about 4.4 mm) below the collar** | 3 | Pipette top y ≈ 451, collar bottom y ≈ 408. `dropper-compositing.ts` records the glass starting at 416–418 on the published layers | Data (`cylinder25-dropper.generated.json`). The body is in front, so it may be hidden by the neck; needs a look |
| 7 | **Caps and pumps off the neck axis** | 72 over 8 px, 50 at 4–8 px | Leather and tall caps on Diva 46 / Elegant 60 / Elegant 100 sit 9–14 px right of the axis; Empire 100 lotion pumps 12–17 px left; 1 ml vial plug 28 px left | Mixed. Pumps and plugs may be off-centre by shape; the caps are symmetric, so those are the stronger candidates |
| 8 | **Tube or pipette drawn at the wrong proportions** | 68 | Sleek 50/100 sprayer tubes 1.5× wide for their length (55, includes #1); Pillar 9 ml 1.13 (7); Cylinder 9 ml 17-415 0.73 (3) | Mixed: some may be deliberate stretch-to-fit |

## Smaller items

- 34 sprayer/pump SKUs on amber, cobalt and swirl glass have no tube when assembled (Cylinder 9 ml 17-415, Cylinder 5 ml cobalt). Possibly intended for dark glass.
- 4 ml vial dropper: pipette is in front of the glass with no transparency, and the bulb extends 27 px above the canvas.
- Pillar 9 ml short black cap shares the body's layer order (tie), so its order depends on list position.
- Sleek 30/50 lotion pump: 4 px gap between the pump and the tube top, visible only with the overcap off (2 SKUs).
- Vial and 12 mm Cylinder kits (11 SKUs) record the seat 63–193 px below the glass top; may be a different convention for plug closures.

## Not real (filtered out)

- 316 antique bulb and tassel sprayers were skipped for centring: the hose and tassel hang to one side by design.
- Closures on the Cylinder 9 ml 17-415 that looked like they float above the rim are bridged by a separate collar part.

## Visual check on staging (2026-11-24, desktop 1440, product page only)

Screenshots and the per-layer log are in `audit/screenshots/pdp/` (`<websiteSku>_<view>.png`, `log.json`). One SKU per finding; the builder and mobile were not checked.

| # | Result | Evidence |
|---|---|---|
| 1 | **Confirmed.** Tassel sprayer's tube is drawn 16 × 15 px; the non-tassel twin on the same bottle is 16 × 291 px | `GBSlk50AnSpTslBlk_default.png` vs `GBSlk50AnSpLvn_default.png`, layer sizes in `log.json` |
| 2 | **Confirmed.** Capped Diva 46 sprayer draws three layers, none a tube; the exploded view shows the tube | `GBDiva46SpryMtGl_capon.png`, `_exploded.png` |
| 3 | **Confirmed.** Diva 46 dropper shows bulb and collar with an empty clear bottle | `GBDiva46DrpCu_capon.png` |
| 4 | **Not visible.** Elegant 30 sprayer, tube and overcap look correctly placed; the bad anchors are latent data | `GBElg30SpryMattSl_capon.png`, `_sidecar.png` |
| 5 | **Not visible.** Elegant 60 clear pipette looks right; frosted hides it | `GBElg60DrpSl_capon.png`, `GBElgFrst60DrpSl_capon.png` |
| 6 | **Not visible.** Cylinder 25 dropper pipette meets the collar on screen | `GBCyl25DrpCu_default.png` |
| 7 | **Not visible** on the one cap checked (Diva 46 brown leather reducer looks centred) | `GBDiva46RdcrBrwnLthr_capon.png` |
| 8 | Not checked separately (overlaps #1) | |

No console errors or failed image requests on any of the ten pages. Side note: `GBCyl25DrpCu` has its website SKU stored as its graceSku in production.

## Next step that needs access

Screenshot one SKU per finding on the product page and in the builder (capped, cap-off and exploded) to confirm or dismiss each row. That needs the staging site and image hosts allowed for this session, or a run on your machine.
