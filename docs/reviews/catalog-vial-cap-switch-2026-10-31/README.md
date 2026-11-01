# Clear 4 ml vial catalog cap selection

Selecting Short Black on `vial-4ml-clear-13-425` changed the SKU and label but left the approved white-cap hero visible. The white SKU (`GBV1DrmWhtCapSht`) has no cap-off plate, so its hero has no calibrated full-plate swap. The black SKU (`GBV1DrmBlackCapSht`) has a cap-off plate, but that plate contains older glass artwork which does not match the approved hero.

The fix uses the black SKU's existing detached-cap photograph inside a bounded component layer. The original glass and studio shadow remain in place. Clean backdrop from the same hero covers the white cap, and the black cap is uniformly scaled to the same footprint and baseline. No image was regenerated, no source image was modified, and no Convex records were changed. The mapping applies only to this exact hero URL and black SKU; a replacement hero needs its own visual review.

Validation: 26 focused tests passed, TypeScript passed, targeted lint passed. Browser checks passed black/white/black switching for clear, amber, cobalt and green on desktop and mobile (24 states), with exact selected SKU links, loaded images and no page overflow. Clear-vial black and white screenshots were visually checked. This verifies cap switching, not full-catalog visual approval.

- `before.png`: black selected but white cap displayed.
- `black.png` and `white.png`: corrected card states.
- `browser-checks.json`: the 24 browser states.

Full working evidence remains in `outputs/catalog-model-repair-2026-10-31/catalog-vial-cap-switch/`. Localhost serves the fix. Publication still requires merge and deployment.
