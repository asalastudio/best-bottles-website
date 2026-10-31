# Both 2 ml vial colors on localhost

The approved dark amber master is now applied to GBVAmb2BlackCap and GBVAmb2WhtCap. The two clear 2 ml kits retain the Sunburst image from the preceding update. Both colors use the approved 40.24% bare-glass height, 91% baseline and the same black/white 8-425 cap masters. All artwork is copied without resampling or pixel edits; each body is registered with uniform scale and translation.

Amber uses the existing accepted built-in GPT image, not a newly generated Sunburst image. Source: ../masters/amber.png, SHA-256 5e9de72bdf63148e685ba09eb5945374a1ffe4dfb90de718f424089acffa8e98.

The imported capColor for both amber variants was Clear, which collapsed the selector to one option. An exact-SKU correction in cap-finish-evidence.ts now returns Black and White for those two incorrect values. Evidence is preserved in src/lib/bottle-builder/component-matches.generated.json, which maps the legacy descriptions to 8-425CpShortBlack and 8-425CpShortWhite. Other SKUs and explicit valid finishes are unaffected. No database records were changed.

Original assets are intact. kits-before.json restores the preceding clear-only local overlay; kits-after.json records the four-SKU overlay. The original source and test files are saved as *.before. The user-provided before screenshot is preserved when accessible.

Validation: 26 tests passed in cap-finish-evidence, pdp-redesign-model and local-component-kits. Browser screenshots and browser-checks.json record the local visual/registration checks. The first pre-update browser capture timed out and is not counted as a passed check.

Local pages:
- http://localhost:3010/products/vial-2ml-amber-8-425?cap=black
- http://localhost:3010/products/vial-2ml-clear-8-425?cap=black

Production, catalog hero files and separate 4 ml measurements are unchanged.

Completed browser validation: 32 checks passed across both glass colors and both cap finishes in all three modes on desktop and 390 px mobile, plus shared thumbnails, the prior ?cap=clear URL, reload and cross-color navigation. Glass height stays at 40.24% and baseline at 91% within 0.04 percentage points. Screenshots were visually inspected for the amber black/white cap seating and mobile framing.
