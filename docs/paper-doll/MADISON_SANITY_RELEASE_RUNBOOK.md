# Madison → Sanity Paper Doll release runbook

This runbook moves an approved Madison Paper Doll release into Sanity without publishing it to the storefront.

## System ownership

- Madison owns plate files, visual approval, placement locks, release manifests, and QA evidence.
- Sanity owns versioned visual releases and the family release selected for storefront use.
- Convex owns SKU identity, compatibility, price, inventory, and catalog/refine state.
- The storefront renders only a Sanity family that independently passes `storefrontReady` validation.

## Import prerequisites

The Madison manifest must:

- use release schema version 1;
- have status `ready` or `published`;
- have no release blockers;
- contain only approved 2080×2288 RGBA layers;
- have passing blocking QA evidence;
- use unique `slot:variantKey` layer identities.

`CYL-9ML` has additional hard gates:

- exactly 145 assembly mappings;
- metal roller with white cap `GB-CYL-WHT-9ML-MRL-WHT`;
- plastic roller with white cap `GB-CYL-WHT-9ML-ROL-WHT`;
- no 13-415 identity anywhere in the release.

## Dry run

Dry run is the default and performs zero Sanity writes:

```bash
npm run paper-doll:import-madison-release -- \
  --manifest /absolute/path/to/CYL-9ML/release/manifest.json \
  --assets-root /absolute/path/to/CYL-9ML/release \
  --display-name "Cylinder 9 mL — 17-415"
```

It verifies manifest eligibility, asset containment, exact file SHA-256, dimensions, RGBA transparency, mapping count, and draft document IDs.

## Draft import

Draft import requires an explicit flag and a configured Sanity write token:

```bash
npm run paper-doll:import-madison-release -- \
  --manifest /absolute/path/to/CYL-9ML/release/manifest.json \
  --assets-root /absolute/path/to/CYL-9ML/release \
  --display-name "Cylinder 9 mL — 17-415" \
  --family-document-id d5291f24-f02b-4fb7-aa99-78c5f63d8c9d \
  --write-draft
```

The importer:

1. validates the complete manifest before contacting Sanity;
2. verifies every local image against its release hash;
3. refuses to reuse a release version for a different manifest;
4. reuses existing Sanity image assets by Madison SHA-256;
5. uploads only missing image assets;
6. creates or replaces an immutable versioned `paperDollRelease` draft;
7. preserves the existing `paperDollFamily` document while updating its draft release fields;
8. leaves `storefrontReady=false` on both drafts;
9. performs no public publication.

Private Madison `imagePath` and `geometryMaskPath` values are never copied into Sanity documents.

## Storefront activation

Activation is a separate reviewed action after draft preview, Convex parity, Grace state, cart, mobile, and desktop acceptance tests pass.

Activate in this order:

1. approve the versioned `paperDollRelease` draft;
2. set that release draft to `storefrontReady=true` and publish it;
3. confirm the family draft references that exact published release and set the family draft to `storefrontReady=true`;
4. run the storefront family audit against the reviewed draft perspective;
5. publish the `paperDollFamily` draft;
6. deploy and repeat the complete refine → build → Grace → cart journey.

Do not publish the family before its referenced release exists publicly. Preserve the preceding release so rollback requires only selecting the previous release and republishing the family.
