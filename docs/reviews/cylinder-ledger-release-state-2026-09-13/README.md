# Cylinder ledger and release verification

The final 38 Cylinder plate pairs are released on the `helpful-elephant-638` development catalog. All 76 hosted views match Jordan’s approved bytes. The dashboard now separates approved images awaiting release from actual reconciliation holds and only counts verified indexed images as complete.

The baseline was 398/436 Cylinder plates complete and 38 holds. Separating the approved batch changed the display to 398 complete, 38 awaiting release, zero holds; no image or approval bytes changed. Publication then changed Cylinder to 436/436 complete and the global total from 686 to 724 of 2,305. Boston Round remains 123/123.

`comparison.html` presents desktop (1440 × 1000) and mobile (390 × 1000) before/after captures at the same zoom. `after-*` captures the intermediate “approved awaiting release” state; `released-*` captures the final indexed state. HTTP 200 and no horizontal overflow were verified for both widths.

`runtime.json` verifies eight normal product-page visits, without asset preview flags: plain short caps, sprayers, rollers, and plastic flip tops, each at desktop and mobile widths. Each page loaded a released plate, returned HTTP 200, had no page errors or horizontal overflow. All four desktop cap toggles switched successfully in both directions and loaded the corresponding released photo. Mobile photo loading was verified; the mobile purchase layout does not expose that desktop toggle.

Validation: 1,697 tests passed and 7 skipped; the production Webpack build and TypeScript check passed. Focused lint had zero errors and three existing image-element warnings. The release projection rejects changed hosted views, mismatched identity/source, missing measurement, new technical holds, and newer rejection decisions. It preserves explicit legacy provenance and resolves only the exact reviewed historical findings.

The unchanged immutable packet and approval lock are under `../cylinder-final38-2026-09-13/`. The release receipt, original index backup, current approval registration, and final counts are stored there. No kit or hero was published, and `.claude/launch.json` is excluded.
