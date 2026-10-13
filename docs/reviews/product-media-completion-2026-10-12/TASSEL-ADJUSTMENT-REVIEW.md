# Tassel hardware extraction — 13 October 2026

## Confirmed cause

The photograph extractor composites selected pixel layers independently and omits the original Photoshop adjustment stack. The black, red, white and ivory/silver Circle100 reference PSDs use masked Black & White and brightness adjustments over gold source pixels. Their embedded Photoshop previews show silver hardware. The separate component masters also show silver; ivory/gold is a separate source and must remain gold.

The old extraction was reproduced locally from the recorded layers. Red, ivory/silver and the gold control match their recorded pixel hashes directly. Black and white match after the recorded `drop_specks` operation (1,084 and 180 pixels removed respectively). Thus all four affected silver-finish exports are reproduced exactly. This is a source extraction defect, not a colour inference from a SKU name.

The installed psd-tools compositor has no Black & White adjustment implementation. Simply switching to its full composite is insufficient. Exporting individual raw layers also loses the adjustment masks.

## Scope from saved evidence

The saved Builder census was collected on 13 October at 07:20 UTC; this is not a fresh live or browser check.

| Component | Intended hardware | Registered SKUs / served configurations |
| --- | --- | --- |
| CMP-SPR-BLK-18-415-02 | Silver, black textile | 26 |
| CMP-SPR-RED-18-415-02 | Silver, red textile | 26 |
| CMP-SPR-WHT-18-415-02 | Silver, white textile | 26 |
| CMP-SPR-IVSL-18-415-02 | Silver, ivory textile | 26 |
| Total | Four shared components | 104 |

Four additional Diva ring SKUs remain in the earlier drawing queue: `GBDiva46AnSpTslBlkRng`, `GBDiva46AnSpTslIvySlRng`, `GBDiva46AnSpTslRedRng`, `GBDiva46AnSpTslWhtRng`. These four are already served through older/fallback imagery while their register drawings are pending. They are not included in the 104 register-backed configurations above, and their fallback images have not been established as the same defect. The issue register retains all 108 offered scope identities, with these two states separated.

## Local prevention and proposed repair

`photo_canvas_of` now holds photo cuts with visible nonzero-opacity adjustment layers instead of exporting them as approvable. Three Python regressions cover active adjustments, hidden/zero-opacity adjustments and unadjusted sources. This prevents silent repetition; it does not repair existing hosted assets.

For the four silver components, preserve the complete masked Photoshop adjustment stack in a source export. Keep the existing registration, body geometry, hose and bulb shape, textile colour and body-specific tubes. Compare against both embedded previews and the component masters. Some embedded previews retain thin gold fringes at hardware edges; those need correction and visual clearance before publication. Do not substitute the standalone library hose geometry into the photographed assembly.

Create new content-addressed assets only after geometry and artwork review. Keep the ivory/gold component unchanged. Refresh production immediately before any approved reference write, compare exact before values and retain the old component records for rollback. No replacement assets, data writes, publication, merge or deployment were performed here.

## Evidence

Under the programme output directory, `source-recovery-2026-10-13/tassel-source-review/` contains:

- `hardware-comparison.jpg`: old unadjusted extraction beside the original embedded Photoshop preview. Its raw-cut hash labels precede the separately recorded speck-cleanup comparison.
- `reference-inspection.json`: source hashes, layer kinds, visibility and original embedded previews.
- `extraction-regression-receipt.json`: five original/reproduced pixel hashes, cleanup counts and guard results.
- `affected-register-skus.csv`: exact 104 registered SKUs, Builder inclusion and catalogue trim fields.
- `proposed-correction.json`: exact affected components, saved before records, protected gold component and release gates.

The existing issue `BBM-TASSEL-METAL-001` / Linear reference `ASA-206` is updated locally. No Linear message or external issue change was sent.
