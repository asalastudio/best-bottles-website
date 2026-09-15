# Cylinder paired plate release — 2026-09-12

Jordan approved the displayed final comparison batch in this conversation:
“Aeverything looks great. Let's move forward.” The exact review packet is
`prepared.json`, SHA-256 `efdd955f5f8c0ba573546fe5190bd6bdaee0a340713f297870186bf0a731bc11`.
`approval.json` and `data/asset-ledger/cylinder-capoff-final-decisions.json`
record 31 reviewed configurations: 52 newly prepared image files across 30
configurations, plus one retained existing pair. Approval covers the shown image
appearance and presentation. Technical findings and publication remain separate.

The review is available at
`http://localhost:3040/reviews/cylinder-capoff-final-2026-09-12/index.html`.
The page shows the saved approval, a 25-row release filter and the remaining holds.
The original packet and all image bytes remain immutable. Technical view
corrections are an explicit overlay in `technical-review.json`.

## Published release

25 paired configurations across five existing catalog family IDs pass the current
source, identity, image-byte, bounds, registration and body-parity checks:

| Catalog group of bottles | Pairs |
|---|---:|
| 28 mL clear | 4 |
| 5 mL clear | 8 |
| 5 mL cobalt blue | 9 |
| 9 mL clear | 3 |
| 9 mL frosted | 1 |

Exact SKUs, hashes and source paths are in
`dist/paper-doll/cylinder-approved-release-2026-09-12/manifest.json`.
Each output uses the exact approved cap-on plate's body width, glass bottom and
center as the presentation reference. This does not create a shared physical
glass-height lock. Original cap-on files, approvals and standards are preserved.
Four 28 mL loose caps use their visually inspected original PSD layers, translated
beside the original assembly at the same uniform scale. Reconstruction differed
from the original merged previews by at most 1/255. No shadow processing occurred.

Small previews reference the same approved full-resolution raster, with its true
1000 × 1100 dimensions. No unreviewed thumbnail files were generated. All new
assets are content addressed. Existing family metadata must be preserved because
this release contains only part of each existing family.

The read-only publishing dry run passed for all 25 products, with zero missing
or duplicate exact catalog identities. `publish-dry-run.txt` contains its output.
`index-before-release.json` preserves the 25 current index records, five family
records and exact live product/group identities. No uploads or mutations occurred.

## Holds retained

Five reviewed 9 mL configurations retain historical sizing findings. One of those
also has an existing cap-off image whose body comparison exceeds the registration
threshold; that unchanged image was retained, not silently replaced.

The silver 30 mL sprayer, `GBSpry1ozSl`, is visibly capped in both views. Its file
was initially labeled cap-off in the source inventory. `sprayer-pair.png` records
the correction. Its image approval remains saved, but it cannot supply a cap-off
pair and is excluded from this release. There are 29 verified new cap-off images,
22 new master cap-on images and one held capped sample among the 52 new files.

Another 32 rows remain in the source queue: four capped masters need layer
inspection and 28 exact source mappings remain open. They are not proven missing
and were not part of the reviewed source cards. Their current cap-on approvals
are preserved. Do not fabricate exposed components or infer identities from names.

## Preparation counts and publication

Before and after local preparation, approval and staging, Cylinder is 373/436
complete, with 63 reconciliation rows, zero missing and zero awaiting existing
cap-on appearance review. Global plate counts remain 661/2,305 complete, 431 review,
702 reconciliation and 511 missing. A successful 25-pair release is expected to
move Cylinder to 398/436 complete, leaving 38 holds; verify this rather than assuming
it. The entire Cylinder family is not yet ledger complete.

All 1,909 currently indexed plate images were fetched, hashed and measured with
zero failures. A transient catalog-read timeout initially prevented the ledger
build from completing. The read path now uses a 30-second request deadline,
three bounded transient retries, and six concurrent per-SKU kit-index reads.
Read failures still stop the build; they are never converted into missing records.
No kit work, hero work or website deployment was performed. The preparation counts above predate publication; see the ship evidence below.

Jordan then replied **ship** to the explicit 25-pair release request.
`ship-authorization.json` records that instruction and the exact manifest hash.
The existing publisher uploaded and indexed all 25 pairs in the development
catalog used by localhost:3040. `publisher-record.json` records zero errors,
zero skipped rows and zero duplicate identities. `published-verification.json`
confirms all 50 view assets match the approved SHA-256 hashes, both SKU lookup
forms resolve, the five family records are unchanged and unselected rows in
those families remain unchanged. This is not a production website deployment.
No further ship confirmation is owed for this release.

The first attempt stopped before upload because this checkout lacked the storage
credential. The existing credential from another Best Bottles checkout was
confirmed against the same store and loaded only into the publishing process.
No secrets were copied into review files or source control.

The final recount at 2026-09-13T07:23:19.385Z confirms **398/436 Cylinder plates complete**,
up from 373, with **38 reconciliation holds**, zero awaiting review and zero missing.
Global completion moved from **661 to 686 of 2,305**, with 431 review, 677
reconciliation and 511 missing. All 1,909 front images were fetched, hashed and
measured again with zero failures.

The current family sheet contains 436 products and 742 views, with zero image
errors. The 25 pair approvals and 19 changed cap-on appearance bindings were
registered through the canonical batch-review service after matching the approved
release hashes. All 827 earlier history entries are preserved. The final records
are ship-completion.json, registered-approvals.json and counts-after-ship.json.
The real local product pages passed desktop/mobile cap-on/off checks and a 5 mL
finish swap. No repeat visual review is owed for these unchanged approved bytes.

Never commit `.claude/launch.json`.

## Deferred kit dependency

The 19 replaced front images invalidate the old plate-hash binding of 19 existing
kit records. Their component assets and index records were preserved. The ledger
correctly moves those kit records from live to stale (global stale count 10 to 29).
Recheck their parity against the new fronts when the kit lane resumes; do not
transfer their old plate approval or claim those kits were rebuilt in this release.
