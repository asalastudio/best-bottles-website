# Cylinder 5 ml roller and pour review

Local review: http://localhost:3010/reviews/cylinder5-rollers-pour-2026-11-01/index.html

This batch updates 56 existing configurations: 18 steel rollers, 18 plastic rollers and 20 pour bottles. All 71 current glass masters, their registration, sizing and anchors are unchanged. All 15 fine-mist kits are unchanged.

## Component fit

The 36 roll-ons reuse the corrected straight-on steel/plastic insert artwork from the 9 ml review. Uniform scale preserves each image's shape while matching the existing 5 ml flange width, 128.3976 canvas pixels. The flange underside, source row 760, sits at the existing neck datum, canvas row 501. The lower plug renders behind the glass. One complete insert replaces the older view-specific duplicate layers. It moves as one piece above the bottle mouth in exploded view.

Roll-on and metal pour caps now meet the visible shoulder at row 623.146978. Original 13-415 cap pixels, designs and widths are preserved. Each is registered by its actual alpha bounds with a single uniform scale. Black/white short ribbed pour caps retain their original thread-covering fit at row 586.47. They are too shallow to meet the shoulder while covering the mouth, so they were not stretched or silently replaced with a deeper cap.

The PDP, builder and catalog use the same canonical kits, with the media revision updated for cached builder requests. The existing source guard keeps these master overrides development-only.

## Preservation

- `before-kits.json` and `before-index.json`: all previous 5 ml registrations.
- `9ml-reference-kits.json`: unchanged source registration of the corrected roller assets.
- `sources/`: exact original cap PNGs and the user's supplied seating references.
- `source-inventory.json`, `cap-metrics.json`: source URLs, hashes and measured alpha bounds.
- `before/`: six representative old assemblies, all three views. The first verifier attempt misread optimized PNG URLs; corrected before captures passed all 18 states.
- `pilot/`: initial candidate captures, retained as superseded. Material assignment and cap contact were corrected before the final pass.
- `final-pilot/`: representative final captures.
- `evidence/`: exhaustive current browser checks and builder comparisons.

Rebuild from the saved snapshots with `node docs/reviews/cylinder5-rollers-pour-2026-11-01/build.cjs`. Do not rerun earlier material builders over this newer component checkpoint.

## Limits

Roller imagery is reused GPT-generated artwork, not a new Blender render. Plug dimensions remain visual representations, not manufacturer-certified fit. Existing bottle geometry/material approval status is unchanged. No production database writes, live-store asset upload, merge or deployment was performed. New review candidates are preserved in Git; they are not marked as approved Drive masters.

## Verification

TypeScript and 62 targeted tests in 11 files passed. Browser checks passed for all 336 desktop/mobile PDP states (56 configurations, three views, two viewport sizes), 56 exact builder selections, 71 API kit comparisons, 30 visible catalog choices and 18 review control combinations. Source hashes, all 71 bodies and all 15 sprayer kits were also checked.

Eight initial PDP failures passed individual retries. The first builder pass reported one development HMR chunk error; a fresh pass then exposed a verifier wait on hidden lazy-loaded images. The verifier was corrected to wait for visible decoded preview images. The final resumed report contains 56 unique passing selections and zero errors. Original attempt reports are retained. These browser checks establish rendering and selection behavior, not manufacturer certification or user approval.

Use `contact-sheet.html` to inspect all 56 configurations across three presentation states. `defects-and-changes.csv` records the per-SKU changes and short-cap exceptions. `verification-summary.json` gives machine-readable counts; `checksums.json` hashes every batch artifact except itself.
