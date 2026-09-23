> Historical workflow record. Final user approval and locked hashes are recorded in `../../hero-families/boston-diva-2026-09-23/approval.json`. Earlier pending-review statements below describe those earlier checkpoints. No deployment has occurred.

# Boston Round — first regeneration checkpoint

Started after locking Elegant in PR #236. Branch `codex/boston-round-heroes-2026-09-23` is based on the Elegant commit; no Boston files are added to that PR.

29 existing hero entries cover 23 catalog groups: 5 at 15 mL, 12 at 30 mL and 12 at 60 mL. All original file hashes match the intake and all 29 exact mapped PSDs exist. The existing images were visually inspected in capacity sheets. Their major inconsistencies are unequal body sizing among matching rollers/closures and an attached short cap on the clear 60 mL hero. The approved material treatment will be carried forward through Sunburst 2.5 regeneration.

Recovered Boston-specific shoulder-to-foot locks from the Madison September 20 record: 15 mL 42%, 30 mL 45%, 60 mL 52%, with 91% base and 2080 × 2288 canvas. These are family-specific targets, not linear capacity scaling. Final generated pixels must be independently checked. Clear, amber and cobalt references are the same user-provided files used for Cylinder.

Three pilot inputs prepared and hash-validated:
- GBBstnAmb15mlBlkCapSht — amber 15 mL, exact short black cap as sidecar
- GBBstn1ozBlkCapSht — clear 30 mL, exact short black cap as sidecar
- GBBstnBlu2ozBlkDropperShnGlTrim — cobalt 60 mL, complete black bulb/gold-collar dropper attached

The 60 mL guide uses its complete exact master composite because the old hero clips the bulb. The other two use existing cap-off framing with exact master composites as geometry authority. No new generation has completed. The user approved uploading the three pilot inputs to OpenAI, then requested seeing Boston Round, Diva and Sleek shoulder locks first. The user approved the displayed Boston Round, Diva and Sleek targets with “Ok”; the three Boston pilots are now authorized and in progress. No further upload permission is required for these same inputs.

Local manifest: output/imagegen/boston-round-2026-09-23/pilot-manifest.json
Source intake: output/imagegen/boston-round-2026-09-23/source-intake.json
Input guide: output/imagegen/boston-round-2026-09-23/pilot-input-guide.png

## First three completed

Three Sunburst 2.5 renders completed at native 2080 × 2288, with verified hashes and inspected material/hardware. Review sheet: `output/imagegen/boston-round-2026-09-23/review/guided-sheet.png`. Amber/clear background-patch medians equal bone with p95 channel offset 1; cobalt medians differ by 1–2 channels, with one patch p95 offset 3. Amber needs a small baseline adjustment; final landmark calibration and cobalt background finishing remain before locking. No remaining-family generation or publication has occurred. Prior TLS failures happened before a render; retry used the trusted macOS CA bundle, without disabling certificate verification.

## Local finishing completed

User requested the identified pilot corrections. Amber was translated down 13 integer pixels (measured glass foot 2069 to 2082); cobalt up 19 pixels (2101 to 2082). Measurement uncertainty is about 3 native pixels. No resizing: entire product, hardware and shadow move together. Cobalt backdrop was finished to exact bone in five empty-background patches while its protected bottle/hardware interior pixels remain unchanged. Original source shadow residual and falloff retained. Clear remains the original generated file. All native originals are preserved and no extra API calls were used.

Current review: `output/imagegen/boston-round-2026-09-23/finishing/v1/guided-sheet.png`; locked lineage for review in `pilot-finishing.json`. No new user approval lock or publication is implied. Top-center QA patch moved to y=8–64 because the tall cobalt bulb overlaps the old y=32–112 patch; no product pixels are counted as empty background.
