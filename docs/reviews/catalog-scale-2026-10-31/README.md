# Catalog scale and stable stages, October 31, 2026

Jordan confirmed: “Later catalog-wide curve, with approved family exceptions.” This is local review work. It is not a production deployment or final approval of model geometry, materials or all product pages.

## Sizing rule

Use the September 25 curve `targetPct = 3.5314 * bareHeightMm ** 0.5868`. The five reference bottles are Diva 100 ml, Elegant 100 ml, Cylinder 50 ml, Cylinder 5 ml and Elegant 15 ml. Explicit family approvals take precedence. The canvas is 10:11, centerline 50%, glass foot 91%. Measure shoulder or closure seat to foot, except full-glass vial locks. The corrected 2 ml clear vial remains 40.24% full-glass height.

Authoritative source: `docs/hero-families/next-batch-2026-09-25/README.md` and its approval record, plus the exact family approval paths recorded in `outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/scale-policy.json`. The older S20–S200 proposal is not the selected policy.

## Implementation and coverage

The shared sizing metadata sets both the product page's CSS frame and the builder's SVG viewport. Changing finishes, fitments, or cap view does not choose a new glass camera. First-paint chooser data retains the sizing metadata. Detached parts are repositioned as complete mechanisms when the ordinary exploded placement exceeds the frame; approved glass targets are never reduced to fit a large component.

906 configurations are enabled locally, including the two corrected vial configurations. Numerical checks cover three PDP views and six builder states for each, with zero frame mismatches or recorded-boundary clips. 20 body families, covering 1,182 configurations, remain held because at least one component exceeds the approved frame. Another 397 records do not resolve to a register kit in this audit; they can have legacy kits or finished hero images. They are not automatically missing products or models. The target inventory covers 101 body identities, 98 current and 3 retired.

The generated readiness file is a snapshot, not an automatic approval of future component revisions. Re-run the audit after changing component records or sources. The registered builder path also skips older photographed-body substitutions so measured plates and hardware retain their shared coordinates.

## Verification

The 9 ml clear 17-415 browser check confirms the glass is stationary through Sidecar, Cap On, Exploded and a finish change. The builder check confirms the same normalized body position and size through bottle selection, glass selection, sprayer selection, black finish, cap on and sidecar. The scale review loads all 110 recovered plates, shows 72 body designs by default, and has no failed images or mobile horizontal overflow. Browser verification is sampled; numerical coverage is broader. These checks do not certify material realism, physical tube dimensions, cap geometry, or every page by eye.

The focused source suite passed 98 tests across nine files. TypeScript, changed-source ESLint and whitespace checks passed during implementation. Browser evidence and screenshots are in `outputs/catalog-model-repair-2026-10-31/reports/production-alignment/`.

## Review and reports

- `http://localhost:3010/reviews/glass-body-overview-2026-10-31/scale.html`
- `outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/body-scale-targets.csv`
- `outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/sku-scale-status.csv`
- `outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/stability-production.json`
- `outputs/catalog-model-repair-2026-10-31/reports/production-alignment/alignment.json`

The scale sheet uses production records for the 96 recovered plates returned by the active SKU audit. Fourteen additional plates remain development-library references. The two Empire clear images were switched in this review to production's approved masters; the alternative Blender images remain archived. The corrected 2 ml clear vial is an explicit local override.

## Reproduce

From this checkout, run `node_modules/.bin/tsx outputs/catalog-model-repair-2026-10-31/scripts/audit-stage-scale.ts` with `SCALE_AUDIT_TAG=production-after`, then run `check-stage-stability.ts` with `SCALE_KITS_FILE=kits-production-after.json` and `SCALE_CHECKS_FILE=stability-production.json`. These scripts read the configured public register endpoint. Run `node outputs/catalog-model-repair-2026-10-31/scripts/build-scale-review.cjs` to rebuild the local sheet. Run `check-production-alignment.cjs` and `check-builder-and-scale.cjs` while localhost is running for the browser evidence.

`calculate-stage-clearance.ts` is diagnostic only and must not be used to shrink approved glass targets. Its rejected factors are archived under the report directory and are not imported by the app.

Original edited sources are preserved under `outputs/catalog-model-repair-2026-10-31/backups/stage-scale-before/`. No live media, backend records, domains or production deployment were modified.

## Scope clarification from Jordan

Jordan clarified that approximately 90% or more of the existing product images have already been resized to the approved scale. That percentage is his estimate, not a newly measured audit result. The 906 configurations above describe coverage of the new shared interactive framing, not the number or percentage of already resized catalog products. Do not use that figure to characterize existing image sizing coverage.

Preserve approved bottle size, baseline and body geometry. The active visual review should prioritize component correctness: dip tube presence, realistic diameter, length and visibility; roller ball presence and seating; roller insert/housing presence and neck fit; and exact vial body/neck/cap matching. Change an existing approved size only when a specific measured discrepancy is recorded. A missing or oversized component is not a reason to resize the whole bottle.

Review the actual product page and builder with caps removed as well as seated. The register sometimes stores the roller ball and its housing in one combined image layer, so absence of a separately named insert layer is not proof that the insert is missing. Conversely, a named roller or tube layer does not prove its pixels are visible or seated correctly. Record those findings visually per SKU and fix shared component sources before propagating to compatible products.
