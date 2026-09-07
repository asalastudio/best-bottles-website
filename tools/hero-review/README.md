# Best Bottles hero review library

A portable local review tool. It runs with Node.js alone: no Next.js, Convex, credentials, image-generation service, or dated temporary checkout is required.

## Open an existing review

From the project root:

```sh
npm run review:heroes
```

Open **http://localhost:3010**. The library lists every imported collection. You can also double-click `Open Hero Review.command` in this folder on macOS. If the port is occupied, use `npm run review:heroes -- --port 3011`.

The preserved `catalog-replacements-2026-09-07` collection includes all 200 current review images, 52 locked Cylinders, prior revisions, original-source previews and the complete feedback history at import. Its feedback is an independent snapshot: further changes on the old port-3003 page are not automatically copied here. Use the selected collection's exported feedback as the input for its next correction pass.

## Preserved features

- Family, work-stage and decision filters; filters can be bookmarked in the URL.
- Four-column desktop review and phone layout.
- Toggleable 91% baseline and height grid; click a product image to place a target.
- Numeric and slider targets for complete bottles, glass bodies and glass base-to-shoulder measurements.
- Original source and previous-draft comparisons; measured values, source notes and assembly exceptions.
- Approve, Needs changes, Reject, undo, notes and explicit saves.
- Decisions and height requests tied to SKU plus exact image SHA-256. A new image version does not inherit an older approval.
- Append-only feedback history, atomic saves, stale-tab conflict detection and unsaved-change warnings.
- Read-only locked assets, enforced by the storage API as well as the UI.
- JSON feedback export and a separate test sandbox (`&sandbox=1`).

Reviewing records requests; it does not resize images or publish products. Preserve original geometry and apply the installed hero skill during each correction pass.

## Add a future family or collection

Create a JSON array (or an object with a `rows` array). Each row needs `sku`, `family` and a local image `url`, relative to a `public` directory. Preserve all optional fields from an existing review inventory to retain advanced comparisons and measured guides.

```json
[
  {
    "sku": "EXAMPLE-30",
    "family": "Example",
    "capacityMl": 30,
    "title": "30 mL Example Bottle",
    "url": "/images/example-30.png",
    "sourcePreview": "/sources/example-30.png",
    "stage": "rework",
    "reviewNotes": [],
    "targetHeightRequest": {
      "heightPercent": 50,
      "measurement": "glass_shoulder",
      "baselinePercent": 91
    }
  }
]
```

```sh
npm run review:heroes:import -- --id example-family --title "Example family" --manifest /absolute/path/data.json --public-root /absolute/path/public
```

Optional `--feedback /absolute/path/feedback.json` carries existing decisions/history into a collection. Local PNG/JPEG/WebP files are copied and hashed. Duplicate collection IDs, duplicate SKUs, missing images, path escapes and mismatching supplied hashes are rejected. Existing collections are never overwritten. For a revised batch, use a new collection ID and import the prior exported feedback; only unchanged SKU/hash pairs retain their decisions.

## Preserve or move a review

```sh
npm run review:heroes:archive -- catalog-replacements-2026-09-07
```

The archive in `hero-reviews/archives/` contains this entire tool, the selected inventory, current and prior image assets, original-source previews, saved feedback and the original import snapshot. A SHA-256 checksum is written beside it. Archive after important feedback sessions. Stop editing during export/archive to capture one consistent snapshot.

To restore elsewhere, extract the archive into a new folder and run:

```sh
node tools/hero-review/server.cjs
```

It needs Node.js and a browser; the source checkout and original PSD folders are not required to review the archived previews. PSD references in metadata preserve lineage but PSD binaries are not included.

## Files and scope

- `tools/hero-review/`: reusable source; intended for version control.
- `hero-reviews/<id>/`: self-contained collection, image assets, editable feedback and immutable import snapshot.
- `hero-reviews/archives/`: portable backups and checksums.

Large image collections and reviewer feedback are excluded from Git. Keep their archives with project deliverables; committing the tool alone is not a backup of collection assets. The server binds to loopback and accepts same-origin writes only. It is a local tool, not a hosted mobile link or authenticated production admin. A future shared deployment requires durable server storage and authentication.

Run storage tests with `node --test tools/hero-review/store.test.cjs tools/hero-review/library.test.cjs`.

### Import without duplicating local assets

Pass `--link-assets` to the importer to hardlink immutable content-addressed assets on the same filesystem. Default imports make independent copies. Do not edit hardlinked asset bytes in place; produce a newly named revision. Feedback and manifests remain independent.
