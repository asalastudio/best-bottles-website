# Mobile bottle builder visual QA

final result: passed

This is local **visual and automated interaction QA**, not native iOS/VoiceOver release signoff. Those remaining device checks are documented in the handoff.

## Compared artifacts

- Source: five supplied approved concept JPEGs (592 × 1280 pixels), normalized to 390 px wide without distortion.
- Render: local `/matrix?family=Cylinder`, Chrome 390 × 844 CSS px, deviceScaleFactor 1; actual returned product data and approved fitment drawings.
- Combined inputs: `docs/reviews/mobile-builder/comparison-{bottle,glass,fitment,finish,review}.png`. Each board places source and rendered screen together at equivalent widths. The concept density is about 1.518 image pixels per CSS pixel. No device bezel is included.
- Additional focused evidence: `after-fitment-options.png`, `after-review-200-percent.png`, `after-landscape.png`, `after-desktop-matched.png`, and recorded browser/a11y/parity results.

## Findings corrected during comparison

1. **P2 — excessive vertical spacing:** first comparison showed extra header/progress/summary space pushing glass and fitment choices down. Reduced mobile header/progress padding, selected-bottle spacing, preview to 220 px, and thumbnail height. Re-captured the five screens. Full first bottle row is visible by ~497 px at 390 × 844; the four fitment labels fit above the normal action bar.
2. **P1 — enlarged text overflow:** 200% text at 320 px widened the page and crowded progress/summary labels. Reflowed progress into two rows, summary values onto their own row, moved the large-text action into document flow, and constrained the shared footer's grid children only on this builder surface. Revised screenshot and measured scroll width confirm 320 px with no overflow.
3. **P2 — drawing frame sizing:** tightening the thumbnail initially clipped the original SVG sprite framing; a wide SVG viewport also exposed neighboring artwork. Restored each approved drawing's intrinsic aspect ratio (`width:auto`, bounded height), retaining the existing source viewBoxes. Final fitment capture shows each mechanism alone with the smooth roller plugs fully visible.
4. **P1 — review semantics:** axe identified a button directly inside a definition-list group. Moved edit controls inside definition entries. All five changed screens then returned zero tagged WCAG violations.
5. **P1 — immediate repeated add taps:** isolated cart testing exposed a race before the pending render. Added a mobile-only synchronous ref guard around the existing callback. Regression test and browser check confirm one preflight request for repeated taps.

## Final fidelity review

- **Typography:** existing serif brand/heading fonts and sans-serif controls retained. Text and labels remain readable, full names wrap, and selected state uses border/check/text instead of gold alone. Action and Edit targets are at least 44 px.
- **Layout rhythm:** compact header, four-stage progress, one active choice group, selected-bottle summary and preview. Single vertical page and measured action clearance. Compact normal portrait; relative preview in short/landscape/enlarged text.
- **Colors:** existing bone/ink visual direction preserved; darker gold used for readable text and focus. No decorative gradients or unrelated imagery added.
- **Image quality:** exact existing bottle assets and fitment source drawings retained. Product geometry is uniformly scaled; no new product render or asset mapping was created. Existing raster softness is source quality, not invented geometry. Finish uses real cap/component photos.
- **Copy/content:** Bottle → Glass → Fitment → Finish → Review, explicit current-decision actions, contextual roller cap/pump/sprayer labels, matching-overcap message, exact cart total and cart-wide minimum. Actual sizes/counts/prices differ intentionally from mock examples.
- **States/access:** loading/disabled, dependency reselection message, cart error recovery, success/reset, native radio keyboard operation, dialogs and focus return verified. No horizontal overflow at 320/375/390/430, enlarged text, or landscape. Nine vintage finishes remain reachable; three are disabled.
- **Desktop:** matched 5 ml/Metal Roller/Matte Gold preview preserves original desktop composition; four representative branches have equal SKU/quantity/unit price/total/cart request across desktop and mobile.

## Accepted differences and limitations

- The user's later instruction explicitly replaces the mockup's mechanism photos with the previously approved pencil drawings.
- Three columns of full finish labels at 390 px take additional rows compared with the mockup's five tiny columns. Every returned choice remains present. At 430/640 px, the grid expands to four/five columns.
- Review retains case quantity and readable 44 px Edit controls, so price/quantity details can require scrolling. The current total remains in the action. Nothing is removed to force a single viewport.
- The menu remains accessible beside the compact brand/cart controls. No hero image work, pricing logic, APIs, schemas or catalog records changed.
- Physical iOS Safari toolbar/keyboard and VoiceOver are **pending manual device verification**. Axe and Chrome emulation do not certify WCAG conformance or native Safari behavior.

No remaining actionable P0/P1/P2 visual differences within the requested local presentation scope. Full handoff and evidence: `docs/reviews/mobile-builder/README.md`.
