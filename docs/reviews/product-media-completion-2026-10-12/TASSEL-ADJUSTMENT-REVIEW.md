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

## Black pilot correction completed locally

The native Photoshop export is successful. Jordan ran the script against the verified working copy; both PSD hashes remain unchanged. A native generated edit was tested and held because it altered geometry and reduced resolution.

The accepted local repair method for the black pilot is deterministic warm-colour neutralization on the full-resolution Photoshop export. `photoshop-native-pilot/black-tassel-closure-silver-fringe-v1.png` changes 10,331 hardware pixels only. Save/reopen verification confirms every alpha value and every pixel outside the correction mask is unchanged. Canvas size remains 2136×1925; silhouette overlap is exactly 1 and displacement is zero. Linear-light luminance changes only through 8-bit rounding. The script checks native source, master and working-copy hashes before and after correction.

Agent visual review of full-component and enlarged hardware comparisons on light and dark backgrounds confirms the gold fringe is removed. Existing source edge softness is preserved. The reproducible script, mask, validation receipt and `silver-fringe-v1-comparison.jpg` are alongside the output. Owner artwork approval remains pending. The black pilot is not integrated or published; the other three silver finishes and every affected assembly still require completion and verification. The shared issue stays open.

## Family extension after owner approval

Jordan subsequently approved the black correction and authorized the same method for red, white and ivory/silver. Those three outputs are now complete under `photoshop-native-family/`. Native Photoshop exports retained the original adjustment stack. Separate hardware/textile exports supplied protection masks for the deterministic colour correction. Changed hardware pixels: red 5,059; white 5,066; ivory/silver 5,065. All three have zero alpha changes, zero textile changes, zero changes outside the correction masks and zero registration displacement. Original resolution is preserved. All master and working-copy hashes are unchanged, including the protected ivory/gold master.

The full-component/light-background comparison and enlarged dark-background checks passed agent visual review. See `family-validation.json` and `silver-tassel-family-review.jpg` for exact evidence. Black is owner-approved; the three new finished images are ready for owner review. Source edge softness and the original red bulb/hose junction remain as photographed. No source geometry was reconstructed. Integration, exact assembly checks, browser/live verification and release approval remain open.

## Superseding approval and integration checkpoint

Jordan subsequently approved all four corrected assets. They are integrated locally for 104 register-backed PDP/Builder combinations, with source geometry and body-specific tubes preserved. Offline assembly, exact SKU and thumbnail checks are complete; browser acceptance is pending because the supported browser tool still denies access. Four Diva ring builds and four standalone component records remain separately classified. See [TASSEL-LOCAL-INTEGRATION.md](TASSEL-LOCAL-INTEGRATION.md) for results, the newly corrected Empire Builder registration issue, and release gates. No publication or live reference change occurred.
