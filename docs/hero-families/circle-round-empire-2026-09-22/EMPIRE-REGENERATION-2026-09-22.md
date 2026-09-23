# Fresh Empire regeneration — September 22, 2026

Jordan requested Empire only be generated again through Sunburst 2.5 using the updated prompt and shoulder locks. The previously staged Empire heroes were reused and realigned existing images; this batch contains 11 fresh API renders. Circle, Round and Cylinder were not regenerated.

## Review state

All 11 native API PNGs are 2080 × 2288, high quality, from `gpt-image-2.5-sunburst`. Six are 50 mL and five are 100 mL. There were 11 successful calls and no regeneration retries. The exact master PSD composite, approved framing image and approved clear-glass material reference were included for every SKU. Inputs and prompts are SHA-256 recorded in the manifest. Jordan approved all 11 fresh Empire renders and requested commit and PR preparation. Their exact approved hashes now replace the eleven Empire entries in the family registry; unchanged Circle and Round approvals are retained. No deployment or merge is included in this commit.

The update emphasizes transparent empty glass, dimensional Empire facets, believable refraction and glass-foot depth, controlled studio highlights and grounded soft shadows. Exact product geometry and hardware are anchored to the master composite; the clear reference supplies material only. Existing presentation states are retained, including the connected gold bulb/hose/tassel assemblies, assembled dropper and reducer, sprayer sidecar caps, and the white lotion pumps with clear overcaps.

## Measured targets

| Body | Shoulder span | Shoulder Y | Glass-foot Y |
| --- | --- | --- | --- |
| Empire 50 mL | 50% | 938.08 px | 2082.08 px (91%) |
| Empire 100 mL | 55% | 823.68 px | 2082.08 px (91%) |

The datum is the flat glass shoulder, not the top of a cap. Native shoulder/contact-foot crops were inspected and recorded for each image. Registration uses a uniform transform of the whole photograph; original native bytes, components and shadows are preserved. Corrections range from 0.05% to 1.61% smaller. Landmark uncertainty is approximately ±5 px at full resolution (about 0.22% of canvas height); fractional transform coordinates do not imply subpixel measurement certainty. This is a visual geometry review, not a claim of pixel-identical generative reproduction.

All 11 final exports passed dimensions, bounds and transform-target checks. The review page passed at 390 px and 1440 px: HTTP 200, eleven decoded native-size images, no horizontal overflow or page errors, functioning guide toggle. All 119 existing staged assets retain their prior hashes.

## Review artifacts

- Local page: http://localhost:3052/empire-regenerated/
- Batch: `output/imagegen/empire-premium-2026-09-22/`
- `manifest.json`: exact catalog membership, input lineage, prompts, master hashes.
- `verified-native-landmarks.json`: per-SKU measured landmarks and evidence crops.
- `aligned-exports.json`: final output hashes and complete transforms.
- `review/Empire-50ml-guided.jpg`, `review/Empire-100ml-guided.jpg`: mobile-friendly family sheets; corresponding `clean` sheets have no guides.
- `review/before-after-{1,2,3}.jpg`: same-zoom comparisons against current staging.
- `technical-review.json` and this directory's `empire-regeneration-review.json`: native output hashes, final hashes and review checks.
- `audit/`: read-only recount snapshots and staged asset preservation evidence.

The active approval is `complete-family-approval.json`; its earlier version is preserved under `approval-history/`. New native hashes, prompts and measured transforms are saved under `generation-provenance/empire-regeneration/`. No additional resizing is required. The family selection remains controlled by `NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22`; merging code alone does not enable that flag in another deployment environment.

The final read-only recount completed at 2026-09-22T23:00:11.595Z. Empire remains 95 catalog SKUs across 11 groups, 65 complete plates, 86 live kits, 4 kit candidates, 1 kit hold and 0 complete Sunburst groups under the legacy ledger definition. All family backend counts are unchanged; these 11 local hero candidates have not been indexed or published. The existing tracked ledger snapshots were restored byte-for-byte after preserving before/after evidence. All 119 staged image hashes remain unchanged. See `empire-regeneration-recount.json`.
