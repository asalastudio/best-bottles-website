# Boston15 assembly placement, 13 October 2026

Rebuilt 21 source-backed Boston15 combinations offline using the storefront's `kitFromRegister` placement code. These include 16 identities in the saved catalogue and five legacy-only source candidates. Their catalogue states remain separate; no products or compatibility rules were added.

## Placement defect and fix

The six clear-glass dropper candidates lost their heads because `shoulderLiftMm` treated the front pipette tip as the closure's bottom. The regression fixture measured a false 54 mm lift. Front pipette layers are used to show glass through the opaque clear bottle artwork; their draw order does not make the pipette tip part of the cap's seating surface.

The calculation now ignores pipettes when measuring closure reach. They still follow the attached front closure when an explicit seating correction moves it. The regression test failed before the change and passes after it.

The rebuilt contact sheet retains all six dropper heads. All 21 body placements are identical before and after; the 15 remaining assemblies are unchanged. The three body images match the approved register pixel hashes. Original masters and approved silhouettes remain intact.

## Verification

- 46 tests passed in four register suites.
- TypeScript check passed.
- Before/after contact sheets and placement JSON retained.
- `BBM-PIPETTE-SEATING-001` added to the dated backlog, now 63 issue/queue records. It covers six local source candidates, one of which matches the saved catalogue. No served production configuration is claimed broken by these unreleased layers.
- Local and production browser requests both failed because saved permission settings block the sites. No browser acceptance is claimed.

The fix is local and unmerged. Artwork approval, exact supported-view checks, publication and live verification remain pending. The generated black/silver component edit remains held for contour and edge review.

## Review evidence

Programme output directory: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`

- `source-recovery-2026-10-13/source-assemblies/before-contact-sheet.jpg`
- `source-recovery-2026-10-13/source-assemblies/contact-sheet.jpg`
- `source-recovery-2026-10-13/source-assemblies/placement-regression-receipt.json`
- `source-recovery-2026-10-13/approved-bodies/receipt.json`
- `source-recovery-2026-10-13/pipette-before.log`
- `source-recovery-2026-10-13/pipette-after.log`
