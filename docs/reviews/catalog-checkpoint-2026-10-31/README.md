# October 31 catalog review checkpoint

This checkpoint preserves the current product-page and builder implementation, final local review assets, and selected evidence. It is a draft for review. It does not certify the entire catalog or publish the local candidate images to production.

## Included work

| Area | Saved state |
| --- | --- |
| Interactive framing | Shared approved scale, baseline and centerline for eligible register kits; capped, sidecar and exploded parts retain the same glass transform. The readiness gate holds unresolved families. |
| Product-to-builder links | Eligible products carry their selected SKU, glass and closure into the builder. Local review kits are reapplied after cached data loads. |
| 9 ml Cylinder | Approved shared clear overcap; deduplicated overcap preview; frosted/swirl tube corrections and swirl occlusion. |
| 5 ml Cylinder | Measured clear/cobalt candidates, shared across 71 local kit rows; measured copy and builder integration. |
| 3.3 ml and 4 ml sprays | Corrected names, glass, black/white hardware, shared clear cover and tube mechanism. These remain product-page only. |
| 60 ml Elegant reducer | Recovered clear/frosted glass, separate reducer layers and cap placement. View controls require genuine separate parts. |
| 2 ml vials | Clear/amber checkpoint with black/white caps. Held for revision: Jordan supplied new physical measurements and photos after this snapshot. |
| 4 ml vials | Clear, amber, cobalt and green Sunburst bodies; all eight black/white cap SKUs, shared placement and shorter measured neck. |

The current 2 ml artwork is not approved for release. The next revision must use 35 mm overall height, 28.19 mm shoulder-to-base, 11.64 mm body diameter, 34.17 mm cavity depth, 8.96 mm outside-thread diameter, 3.00 mm neck bore and approximately 5.90 mm neck height. The 0.91 mm difference between the vertical spans is provisionally the shoulder transition and will be checked against the supplied photos. The existing 40.24% vial scale remains the display target.

The local kit manifests contain 111 rows across five files. These are configurations, not 111 unique bottle geometries. Generated vial images are registered 2D artwork, not newly created Blender meshes. The local overrides refuse Vercel environments; uploading this checkpoint does not update live media or backend records. Shared application code and the approved 9 ml overcap are release candidates that would affect the website if this PR were later merged and deployed.

## Recover the reviewed localhost state

Run from the repository root:

```sh
node docs/reviews/catalog-checkpoint-2026-10-31/restore.mjs
node docs/reviews/catalog-checkpoint-2026-10-31/restore.mjs --apply
BUILDER_LOCAL_KITS="$PWD/public/local-kits/vial-2ml-source-2026-10-31/kits.json" npm run dev -- --port 3010
```

The first command verifies every archived checksum and previews restoration. The second restores the saved local kits and selected review pages. Existing files with different hashes are backed up under `outputs/catalog-model-repair-2026-10-31/checkpoint-restore-backups/` before replacement. No source file, environment file, database or remote media is modified. The server still needs the repository's normal local development configuration; credentials are not included here.

Review the current four-color vial family at:

`http://localhost:3010/reviews/vial-4ml-short-neck-2026-10-31/index.html`

Selected earlier family review pages are included for context. The current kit manifests and assets in `runtime/public/local-kits/` are the final local checkpoint. Earlier screenshots and candidate comparisons are historical evidence, not a new approval of every pictured asset.

## Evidence and limits

`manifest.json` lists 497 saved files with byte sizes and SHA-256 hashes. `runtime/` contains the restorable final local assets and review pages. `evidence/` preserves scripts, measurements, per-SKU findings and browser checks from the working output folder. Some historical reports link to intermediate files retained only in the original working directory.

The 4 ml vial pass records 64 product-page checks, six shared-review checks and four client-side color-switch checks. Both cap finishes and all three views were checked at desktop/mobile sizes. See `evidence/outputs/catalog-model-repair-2026-10-31/vial-4ml-measured/README.md` and its browser reports.

The broad scale audit recorded 906 eligible configurations, 1,182 configurations held for fit/framing, and 397 unresolved register records. These counts are an earlier audit snapshot, not a claim that the whole catalog has been visually approved. Current sizing implementation and policy are documented in `../catalog-scale-2026-10-31/README.md`.

About 31 GB of original Blender work, intermediate renders, backups and source references remain in the local `outputs/catalog-model-repair-2026-10-31/` folder. They were not deleted or overwritten. `local-work-inventory.json` records their paths and sizes; it is an inventory, not a remote backup of those files. Personal source photographs and full raw scene archives are outside this PR.

## Checkpoint verification

- Full Vitest suite: 342 files passed, two skipped; 3,142 tests passed and seven skipped.
- ESLint: zero errors; existing repository warnings remain.
- TypeScript and isolated build results are recorded in `verification.json` after packaging.
- The restore utility checks all archived hashes before writing and backs up changed destination files.

No merge, production deployment, domain change, live-store upload or backend mutation is part of this checkpoint.
