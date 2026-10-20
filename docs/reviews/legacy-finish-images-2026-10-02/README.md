# Legacy finish image migration — prepared, publication held

Baseline: `origin/main` at `5abf5205`. Isolated branch: `codex/legacy-finish-image-migration`.

The live builder depends on **93 legacy component image URLs across 1,345 configurations**. This change recovers their exact bytes and prepares migration to the existing Vercel Blob store. No production upload, database write, merge, deployment, DNS change or source deletion was performed.

## Evidence and source decision

- Independent public API audit at 2026-10-02 00:49 UTC: 19 families, 45 rendered bodies, 2,125 configurations, 93 unique legacy URLs, 1,345 affected configurations. The family endpoint advertised seven Cylinder groups while the streamed page listed six; the independently derived legacy counts exactly matched the parent audit.
- The parent Library manifest was readable, but its official byte-transfer helper failed twice. The complete scope here was reconstructed from fresh public builder responses, not from a guessed file URL or inaccessible cloud path.
- Metadata-only inventory of Master, Original, BBUAT exports and Adobe Cleaned: 19,013 files, no cloud-only flags and no zero-block files. No cloud staging directories were traversed. Both source archives remain intact.
- All 93 images have exact normalized filename/SKU PSD candidates in **BB-PSD-Files-Master**. Read/hash inspection was limited to 93 selected already-local Master PSDs and 22 already-local PNG export candidates. Original archive candidates are retained in the provenance inventory; no bulk hashing or hydration was performed.
- **Zero pixel-identical local final exports** were verified. PSD merged previews differ in framing, scale or view. Fourteen 18-415 lotion / 15-415 and 18-415 sprayer previews omit the detached overcap/dip-tube view shown in legacy. The 8-425 short-cap previews also differ visibly in framing/proportions. Re-exporting those PSDs would need separate layer/view review.
- Selected cutover source: **unchanged original legacy image bytes for all 93 URLs**, per the authorized fallback. Each decodes as one-frame PNG, 360×480, even though the legacy pathname ends in `.gif`. No cropping, resizing, recoloring, background removal or re-encoding was applied to publication payloads.
- 2,796,804 bytes across 93 source URLs reduce to **81 unique SHA-256 payloads / 2,641,516 bytes**. Seven pre-existing duplicate-image groups span cap/dropper SKUs; their identities stay separate. Deduplication does not infer interchangeability.

The [complete manifest](../../../data/migrations/legacy-finish-images-2026-10-02/manifest.json) contains every legacy URL, exact component SKU/Grace identity, affected configuration SKU/Grace identities and PDP group, local candidates, inspected source hashes/layers, pixel hashes, selected source, output hash, dimensions and intended Blob key. [patches.json](../../../data/migrations/legacy-finish-images-2026-10-02/patches.json) is the exact publication allowlist; `assets/` contains all 81 immutable PNG payloads.

Visual comparisons (left: legacy original; right: Master merged preview, review thumbnails only): [1](comparison-01.jpg), [2](comparison-02.jpg), [3](comparison-03.jpg), [4](comparison-04.jpg), [5](comparison-05.jpg), [6](comparison-06.jpg), [7](comparison-07.jpg), [8](comparison-08.jpg). All 93 pairs were inspected. These are provenance comparisons, not evidence of hosted publication or a new approved PSD rendering.

## Exact intended publication changes

1. Upload 81 byte-identical PNGs, write-once, to the **existing** `yzy7l20k4yt6znzz.public.blob.vercel-storage.com` store at `components/legacy-finish/<sha256>.png`. The existing Blob adapter is reused. A known deployed object must verify the store before any upload; no new credentials are created. Existing objects are checked, never overwritten.
2. Verify each hosted object: HTTP 200, PNG content type, length, cache/CORS headers, decoded dimensions and full SHA-256 equality. Until this succeeds, **do not promote the frontend**: its exact old-URL mapping points at those new objects.
3. Integrate this branch with the coordinated release and deploy the aligned backend/frontend through the normal main release. This exposes `legacyFinishImages:migrate`, adds a builder mapping guarded by exact component SKU **and** expected legacy URL, and changes the family cache key to `bottle-builder-family-chooser-v8-migrated-finish-images`. The mapping bridges the release/cache interval; a changed/approved URL always wins. A draft preview before upload is not an asset-ready preview.
4. Apply the single atomic transaction to **93 `products.imageUrl` fields only**, requiring exact website SKU, Grace SKU, category `Component`, and unchanged expected URL. It uses the existing image write token and logs each changed field. Any missing, duplicate, changed-identity or newer-image record aborts the batch. No productGroup heroes, prices, Shopify records, kit parts, register layers, material values or model geometry are written.
5. Read every component back, rerun the public builder audit, and verify zero old-host `finishComponent.imageUrl` references. Inspect fresh desktop/mobile finish selectors before cutover. Existing CDN/data caches mean a database readback alone is insufficient; the new frontend cache key and fresh deployment are part of this release.

PRs [341](https://github.com/asalastudio/best-bottles-website/pull/341), [342](https://github.com/asalastudio/best-bottles-website/pull/342), and [343](https://github.com/asalastudio/best-bottles-website/pull/343) were inspected read-only. Their white pump, Minaret and Diva register/kit artwork is preserved: this change edits none of their paths and cannot replace newer product-image values silently. The coordinator must still reconcile the complete backend tree with the Grace/pricing/auth release; do not deploy this isolation checkout's backend directly to shared production.

## Commands for the release coordinator

Run from the repository root. Credentials come from existing authorized release environment; they are never stored in this package.

```sh
# Offline validation: no network, uploads or database writes.
node scripts/migrate-legacy-finish-images.mjs

# Read-only current identity/URL preflight, writes a local before snapshot.
node scripts/migrate-legacy-finish-images.mjs --check-live --deployment prod

# ONLY when the coordinated production publishing hold is lifted:
# BLOB_READ_WRITE_TOKEN must address the existing store.
node scripts/migrate-legacy-finish-images.mjs --upload --deployment prod

# After verified hosted objects and the coordinated backend/frontend release:
# REGISTER_PROD_WRITE_TOKEN is the existing production image write token.
node scripts/migrate-legacy-finish-images.mjs --apply --deployment prod

# Public verification after caches refresh/new frontend deployment:
python3 scripts/audit-legacy-finish-images.py --expect 0 --references 0
```

The publisher saves the current 93 records before any upload/write and a final hosted/mutation receipt under `output/legacy-finish-images/<timestamp>/`. It never runs deployment or changes credentials. `--apply` verifies every hosted payload before calling the mutation, even if upload ran in a previous process. The backend defaults to dry-run when called directly.

Rollback: preserve the preflight snapshot and release commit. While the old host still serves the exact source hashes, `--rollback --apply --deployment prod` restores only values still equal to this migration's targets and records the rollback. Any later approved image aborts rollback. To restore frontend behavior as well, revert the mapping/cache-key release in the coordinated frontend. Keep the uploaded immutable objects; no deletion is necessary. After domain cutover, restoring legacy URLs may be unsafe/unavailable; prefer fixing forward with the retained payloads.

## Validation and remaining gates

- Offline asset validation: 93 mappings, 81 decoded PNG payloads, all hashes/lengths/dimensions exact; 1,345 source references accounted for.
- Read-only production preflight: **93/93 exact component identities and current URLs passed**, 2026-10-02 00:57 UTC; [receipt](production-preflight.json). No hosted uploads or mutations occurred.
- Nine focused tests pass: auth, dry-run, all-fields preservation, log count, idempotence, atomic conflict rejection, identity/alias guards, rollback protection, and old-host elimination for all 1,345 mapped references.
- Fourteen related component/chooser/image regression tests pass. TypeScript (`tsc --noEmit`) and changed TypeScript ESLint pass. Publisher syntax and offline validation pass. `git diff --check` passes.
- Material-lock verification reports **five existing baseline issues**: missing `BB_ANSP_ASSEMBLY_18415.glb`, and changed hashes for `BB_ANSP_BULB_18415.glb`, `BB_ANSP_COLLAR_18415.glb`, `BB_PMP_SPOUT_17415.glb`, `BB_SPR_ACTUATOR_17415.glb`. The four present files were SHA-256 compared to pristine `origin/main` and are identical to it; the missing file is not tracked there. This task changes none of these files and does not relock them.
- **No unresolved source retrieval or exact component identity matches for this 93-URL migration.** PSD-to-final artwork conversion remains unapproved and unused. This does not audit every legacy URL elsewhere on the site.
- Remaining release gates: coordinated publishing hold; Blob upload/hosted validation; aligned backend/frontend promotion; guarded reference apply; fresh live builder/desktop/mobile verification. Hosted readiness and domain-cutover readiness are **not yet claimed**.
