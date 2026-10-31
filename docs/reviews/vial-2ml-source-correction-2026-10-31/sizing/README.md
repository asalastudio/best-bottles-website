# Vial sizing review

Jordan approved the later vial-family sizing on October 31, 2026: "Use the later approved vial sizing." The two clear 2 ml vial SKUs now use 40.24% bare-glass height and a 91% glass-foot baseline on the local product page. This extends the September 25 catalog-family sizing decision to this local PDP review. No catalog image or production data was changed.

## Records found

- The universal S20–S200 scale card from September 16 is explicitly saved as a proposal. The exact 35 mm lookup is 30.5% of the card height, with a 91% baseline. The S40 nominal grouping is 33% at 40 mm and must not replace the exact-height lookup. Source: `docs/reviews/bottle-measurements-2026-09-16/scale-card/scale-card.json`.
- The later approved vial-family catalog release from September 25 records 35 mm bare glass, 40.24% full-glass height and 31.31% shoulder target for `GBVialClr2mlWhtCap`. Its 26.3 px/mm description applies to the 2080 × 2288 native render, before export at uniform 0.75 to 1560 × 1716. Source: `docs/hero-families/vials-2026-09-25/approval.json`.
- The current product page uses `pdpStageFrame` for this legacy-style kit. No measured-height Vial entry exists in `pdp-capacity-standards.json`; Vial receives the generic overflow factor 0.95. Register kits use their own physical px/mm datum, but this vial does not have a drawable register assembly.

## Before the approved change

Before this change, the page’s own `stageLayout` functions measured the regenerated body at 77.3206% of the 1000 × 1100 canvas in Sidecar and Cap On. White-cap glass foot is 89.8771%; black-cap glass foot is 89.5316%. Both caps share the same body dimensions, but the legacy composition-centering behavior causes a small position shift. Exploded view fits the taller composition separately.

The previous regeneration check measured the width-to-height ratio, not conformity to a display-size chart. The generated image is a 2D layer, not a dimensionally qualified Blender mesh.

## Comparison

http://localhost:3010/reviews/vial-sizing-2026-10-31/index.html

The comparison preserves the previous PDP framing beside the approved catalog-family target and the universal proposal, all on equal canvases. The current product page now uses the approved 40.24% target. The universal proposal remains unapplied.


## Applied local behavior

- The local manifest records `glassSizing: { heightPct: 40.24, baselinePct: 91 }` for `GBVialClr2mlWhtCap` and `GBVialClr2mlBlackCap`. It records Jordan's instruction and the exact approval source separately.
- The stage sizes the body from its registered bare-glass bounds, then applies one uniform transform to the whole kit. Native image files, component proportions and cap seating are unchanged.
- The glass's axis stays centered, its foot stays at 91%, and its height stays at 40.24% across both cap colors and all three views. The visible baseline follows the same 10:11 canvas.
- Kits without an explicit reviewed size retain their existing framing. The local overlay's exact-SKU, localhost and Vercel guards remain in place.

## Verification

TypeScript (`tsc --noEmit --incremental false`), lint for the changed code, and `git diff --check` passed. 48 targeted tests passed, covering reviewed sizing, export-resolution independence, cap/view invariance, existing stage geometry and modes, zoom, and local-only guards. Eleven browser checks passed: both cap colors in all views at 1440 × 1050, normal-URL reload, all views at 390 × 844, and no clear-vial override on amber. Browser measurements are 40.2398% / 90.9997% on desktop and 40.2397% / 90.9987% on mobile, within CSS rounding of the targets.

`before-white-sidecar.png` and `desktop-white-sidecar.png` are the before and after at the same 1440 × 1050 viewport and default zoom. `browser-checks.json` contains measured DOM results. `kits-before-sizing.json` preserves the previous registration; `kits-with-approved-sizing.json` and `approval-2026-10-31.json` record the applied local decision.
