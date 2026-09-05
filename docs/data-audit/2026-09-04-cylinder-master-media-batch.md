# Cylinder master-source plate and kit batch

September 4, 2026. Local preparation only; **the complete Cylinder release is not finished**.

## Scope and result

The production `products:getAllForPlates` and `products:getAllGroupsForPlates`
snapshot taken at `2026-09-05T00:34:36.437Z` contains 399 Cylinder records.
Scope includes a product when either its own family or its product group's
family is Cylinder, so disagreements cannot silently drop a product.
The projection does not expose sellability, retired status, or exact assembly
component foreign keys. These counts describe media preparation, not launch
readiness or independently verified physical compatibility.

| Result | Count |
|---|---:|
| Cylinder catalog records accounted for | 399 |
| Scoped master PSD files inventoried and hashed | 829 |
| Records passing source qualification after visual holds | 328 |
| Local front plates passing existing registration checks | 326 |
| Held plates, including two registration failures | 73 |
| Conservative, local two-part kit candidates | 2 |
| Plastic flip-top products explicitly exempt from kits | 3 |
| Local plate/thumbnail/cap-off assets decoded and hash-checked | 1,196 |
| Assets or records published by this batch | 0 |

The kit candidates are `GBCyl5BlkSht` and `GBCylBlu5BlkSht`. Each has a body
and short ribbed black cap, with the same cap pixels independently present in
its uncapped master source. Encoded WebP reconstruction passes the parity
and alpha gates. Both assembled and exploded views were inspected; candidates
remain marked `publishable: false`. Their parts are photographic, not 3D meshes.

The earlier layer-count audit covered 329 source-qualified rows before the
4 mL visual hold: 209 full extraction hints, 90 partial cap-split hints, 27
review cases, and 3 unreadable cases. **Those hints are not finished kits.**
For example, the `GBCyl9RollBlkDot` PSD contains metal and plastic roller
imagery beneath the cap, and `GBCyl9SpryBlk` contains several pump/cap layers.
Correct assembled parity alone cannot establish which exposed parts belong
to a SKU. Layer roles and source retouching still need resolution before
claiming full-family kits or shared component assets.

## Source and identity exceptions

The row-level list is `2026-09-04-cylinder-master-media-status.csv`.
Counts below overlap; do not add them to derive the 73 held products.

- 40 records initially had no exact or already-approved matching PSD filename.
  **This is not a count of missing artwork.** Follow-up recovered legacy images
  for three flip-tops, verified master filename lineage for four 28 mL roll-ons,
  and located alternate-name candidates for eight 25 mL assemblies. See
  `2026-09-04-cylinder-source-recovery.md` and its row-level CSV for current
  evidence and outstanding work. No aliases have been silently promoted.
- 29 records fail source preflight: 22 different-SKU/alias filenames, three
  filenames with a `copy` suffix, three without an approved capped source,
  and one visual source hold. These are review items, not permission to
  substitute one roller material or assembly for another.
- Seven clear capped 5 mL assemblies still have `capacityMl: 5.5` in the
  snapshot. The supplied September 4 twenty-SKU crosswalk and exact
  specifications establish 5 mL. The media pipeline flags the conflict;
  it does not rewrite the catalog or produce a misleading 5.5 mL family.
- `GBSpry4mlClBlk` has a same-stem/different-photograph selection conflict.
- `GBSpry4mlClWh` depicts its overcap beside the bottle. A hash-specific hold
  prevents that image from being presented as a capped front plate.
- `GBCyl100AnSpTslBlk` and `GBCyl100AnSpTslRed` fail registration. They have
  sources but are not accepted renders.

The seven capacity conflicts are `GBCyl5BlkShSht`, `GBCyl5CuSht`,
`GBCyl5GlMattSht`, `GBCyl5GlSht`, `GBCyl5SlMattSht`, `GBCyl5SlSht`, and
`GBCyl5WhtSht`. All twenty confirmed 5 mL capped SKUs are explicitly listed
in `data/paper-doll/family-policies/Cylinder.json`; none are derived by parsing.

## Plastic flip-top clarification

`PbClear4ozFlpWh`, `PbClear8ozFlpWh`, and `PbNat16ozFlpWh` are complete
plastic Cylinder products, confirmed by Jordan and the legacy listings:

- <https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/large-dropper-bottles.php>
- <https://www.bestbottles.com/all-bottles/Perfume-vials-glass-bottles/Perfume-glas-bottle-vials-purchase.php>

They require finished plates, not interchangeable component kits or invented
thread sizes. Their established group routes are preserved as media grouping
keys. Their legacy source images have now been downloaded and inspected under
the user-approved exception; plate integration is still outstanding. The 8 oz item's
legacy URL contains “16-oz,” despite its exact SKU/content identifying the
8 oz product; route wording must not override exact product evidence.

## Repeatable local workflow

The existing `.claude/skills/bestbottles-plate-kit-lane/SKILL.md` is the
applicable workflow. This batch uses its master-only inventory, crosswalk,
registration and image gates. Its archived 9 mL kit extraction command is not
used because that reads an older source library.

```bash
python3 scripts/paperdoll/family_batch.py --family Cylinder \
  --catalog dist/paper-doll/cylinder-master/catalog.json \
  --out dist/paper-doll/cylinder-master --stage prepare
python3 scripts/paperdoll/family_batch.py --family Cylinder \
  --catalog dist/paper-doll/cylinder-master/catalog.json \
  --out dist/paper-doll/cylinder-master --stage plates
python3 scripts/paperdoll/family_batch.py --family Cylinder \
  --catalog dist/paper-doll/cylinder-master/catalog.json \
  --out dist/paper-doll/cylinder-master --stage audit-kits
python3 scripts/paperdoll/build_master_kits.py --batch dist/paper-doll/cylinder-master
python3 scripts/paperdoll/family_report.py --batch dist/paper-doll/cylinder-master
```

The catalog snapshot is a prerequisite, not a network fetch hidden in these
commands. Inputs and outputs remain under the isolated batch directory.
The shared inventory, PSD originals, Convex, Shopify, and deployments are
untouched. The local visual review is `review/index.html`, with a searchable
row for every SKU, CSV downloads, and `review/verification.json` containing
input hashes and individual asset checks.

The master kit extractor is deliberately conservative. An explicit part map
must name a source hash, reviewer, evidence, and complete physical-layer
assignments. Hidden/blended/ambiguous source layers are held. Exploded parts
must clear the bottle and remain within the canvas. A sampled `--sku` run
writes `sample-manifest.json`, not the complete batch manifest. No publisher
is wired to these candidates.

## Verification and limits

- Python regression tests cover physical master containment, scope selection,
  standalone flip-top policy, capacity holds, part-map integrity, composite
  parity, and exploded-part spacing/clipping.
- Node source-lineage tests cover exact SKU matching, master containment,
  and mixed `Capped & Uncapped` parent folders with explicit child state.
- All 1,196 accepted local plate derivatives decode as WebP with the recorded
  dimensions, byte length, and SHA-256. This is local asset validation, not a
  claim about a new hosted deployment.
- Contact sheets were visually inspected across every rendered family.
  This caught the 4 mL white-spray source defect that blob-count classification
  missed. A contact sheet does not prove every under-cap part is correct.
- Browser/PDP/cart/Grace integration, live URL delivery, component foreign
  keys, and a universal shared-body kit lane have not been validated for this
  batch. Do not merge or publish it as completion of the full Cylinder scope.

## Completion sequence and rollback

1. Complete the broader master source/layer reconciliation before requesting
   new artwork. Integrate recovered flip-top sources through an explicit source
   exception; verify proposed alias/copy sources against exact product records,
   including roller material. Follow the source-recovery report rather than
   treating failed filename matching as missing artwork.
2. Approve and reconcile the seven known catalog capacity conflicts separately,
   preserving record IDs, routes, and Shopify references; then refresh the snapshot.
3. Resolve the photo conflict, uncapped-front source and two failed registrations.
4. Review component layers family by family and extract only supported kits.
   Establish component identities and reusable body/part mappings before Grace
   or React Three Fiber consumes them.
5. Review the final batch, publish through the guarded existing lane, and verify
   all hosted assets plus exact-SKU behavior on mobile before release.

Current rollback is local: retain or discard the isolated `dist` batch and
revert this branch's pipeline changes. No production rollback is necessary
because this batch performed no external mutations. A future publish needs an
index snapshot and a SKU-scoped restoration plan; do not prune shared assets.
