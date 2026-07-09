# Best Bottles Catalog Imagery System Design

**Date:** 2026-07-09

**Status:** Approved for implementation

**Calibration family:** Diva

**First calibration cohort:** Diva 30 ml Clear, 18-415 neck

## 1. Executive summary

Best Bottles needs a catalog-imagery system that produces premium product photography without allowing a generative model to invent product identity, physical scale, baseline, crop, or publication destination.

The governing rule is:

> The model paints; code places.

GPT Image 2 may improve material realism, lighting, glass, closure finish, and photographic polish. Deterministic code owns product identity, body geometry, assembled height, width, baseline, centerline, canvas placement, QA, approval, and publication.

Each SKU produces two required outputs from the same approved product master:

1. **PDP hero** — a premium, forward-facing product-detail image. Every variant in a geometry cohort shares one cohort-level scale, calculated from the tallest/widest valid variant in the cohort.
2. **Catalog-grid image** — a shared-baseline image whose scale is derived from physical measurements so products retain truthful relative height.

The first rollout uses Diva because its 30 ml, 46 ml, and 100 ml sizes provide a distinct non-Cylinder geometry, strong cap-height variation, and high measurement coverage without overlapping the active Cylinder effort.

## 2. Goals

- Preserve exact SKU identity across generation, approval, Shopify, Convex, and the storefront.
- Keep the bottle body pixel-consistent across every cap or applicator variant in the same geometry cohort.
- Preserve real assembled-height differences from Convex, including cap-specific height differences.
- Produce both premium PDP heroes and physically comparable catalog-grid images.
- Make every asset reproducible from versioned references, prompts, measurements, and rig contracts.
- Give Madison operators one clear next action at each workflow stage.
- Publish an approved image to Shopify, sync its role-specific URL to Convex, and verify it in the Best Bottles UI without manual file handling.
- Make publication idempotent and safely resumable after partial failure.

## 3. Non-goals

- Sanity will not be the source of primary SKU commerce media.
- ElevenLabs will not own image truth, approval, or publication state. It may later act as an operator interface over approved actions.
- The legacy BestBottles.com site will not automatically overwrite Convex.
- Capacity alone will not determine product height.
- A separate Codex-only production pipeline will not bypass Madison's reference, QA, approval, and publish gates.
- The calibration rollout will not regenerate the active Cylinder family.

## 4. System ownership

| System | Responsibility |
| --- | --- |
| Convex | Canonical SKU identity, physical measurements, product/group relationships, and storefront image-role URLs |
| BestBottles.com legacy site | Historical product evidence, legacy SKU evidence, measurements, and reference-image roles |
| Firecrawl | Structured extraction and conflict detection from exact legacy product URLs |
| Madison Studio | Generation control plane, reference reconciliation, geometry cohorts, deterministic rigging, QA, approval, asset ledger, and publish orchestration |
| GPT Image 2 | Material and photographic enhancement only |
| Shopify Plus | Production commerce media storage and Shopify CDN delivery |
| Best Bottles storefront | PDP and catalog presentation from role-specific Convex URLs |
| Sanity | Editorial, homepage, category, family, blog, and merchandising imagery |
| Codex | Cross-repository engineering, audits, regression tests, and controlled operations |

## 5. Evidence hierarchy

Evidence is evaluated in this order:

1. **Convex canonical product record** — primary generation input after reconciliation.
2. **Exact BestBottles.com product page** — historical evidence matched by `websiteSku`, then `graceSku`, then exact product URL.
3. **Legacy page assets** — enlarged, capped, measured, and depth-view images, each stored with an explicit reference role.
4. **Human-approved Madison product master** — visual production truth after identity and geometry approval.
5. **Shopify media result** — published delivery asset, never a replacement for the underlying product specification.

Firecrawl results are candidates, not automatic mutations. Every scraped candidate stores:

- source URL;
- crawl timestamp;
- source content hash;
- matched SKU evidence;
- extracted field and raw value;
- normalized value and tolerance;
- confidence and conflict status.

An exact match verifies the field. A mismatch creates a blocking reconciliation issue. Missing or ambiguous SKU evidence is rejected.

The existing Madison Firecrawl intake must be extended from body height and diameter to include:

- height with cap;
- height without cap;
- diameter or front-facing width;
- depth when present;
- neck finish;
- capacity;
- reference image URLs by role.

## 6. Product and geometry model

### 6.1 Geometry cohort

A geometry cohort represents one physical bottle mold/body and neck relationship. Its identity excludes closure finish and closure color.

The cohort key is derived from:

- family;
- capacity;
- neck finish;
- body geometry/mold;
- body material/color only when it changes the source body asset.

Example:

```text
diva-30ml-clear-18-415
```

Every SKU in this cohort shares:

- body-master asset;
- body bounding box;
- base position;
- shoulder position;
- neck anchor;
- centerline;
- physical body height and width;
- camera angle;
- canvas and background contract.

The closure or applicator is variant-specific and attaches to the cohort's fixed neck anchor.

### 6.2 Measurement contract

The minimum generation-ready measurement set is:

- `heightWithCap` for the SKU;
- `heightWithoutCap` for the cohort/body;
- `diameter` or front-facing `widthMm`;
- `neckThreadSize`;
- measurement tolerance when published by the source.

The first Diva 30 ml cohort uses:

```text
Body height: 81 +/- 1 mm
Diameter: 43 +/- 0.5 mm
Neck: 18-415
Observed assembled heights: 85, 92, 95, 104, 107, and 109 mm bands
```

If siblings in a geometry cohort disagree about body dimensions beyond tolerance, the cohort is blocked for product-truth review. The image model never resolves measurement conflicts.

### 6.3 Variant-height preservation

The bottle body is reused at the same scale for every cohort variant. Total assembled height may differ only because the physical closure/applicator height differs.

For a variant:

```text
closure contribution = heightWithCap - heightWithoutCap
```

This arithmetic is used only after the measurement semantics for the applicator class are verified. For sprayers, pumps, and detached overcaps, the pipeline records which components are included in each measurement.

## 7. Image outputs and scale contracts

### 7.1 Approved product master

The model receives the strongest available identity reference and may improve only photographic treatment. The output is generated on an opaque background. Downstream masking and matting produce a controlled foreground asset and contact shadow.

The approved master stores:

- body and closure lineage;
- source-reference hashes;
- canonical prompt version;
- model/provider version;
- render-contract version;
- geometry-cohort ID;
- generated asset checksum.

Variants are not independently normalized. Where practical, one approved body layer is reused with approved closure/applicator layers. If a full assembled edit is required, deterministic body-lock validation must prove that the body matches the cohort master.

### 7.2 PDP hero

The PDP scale is computed once per geometry cohort:

```text
pdpScale = min(
  availableVerticalPixels / tallestValidAssembledHeightMm,
  availableHorizontalPixels / widestValidAssemblyMm
)
```

The same `pdpScale` is applied to every variant in the cohort. The tallest/widest valid variant determines safe framing. Shorter closures end lower on the canvas; the bottle body never grows to fill the missing space.

### 7.3 Catalog-grid image

Catalog-grid scale uses one versioned `pixelsPerMm` constant for all in-scope bottle families:

```text
pixelsPerMm = availableVerticalPixels / maxSupportedBottleHeightMm
```

`maxSupportedBottleHeightMm` is calculated from the reconciled bottle catalog for the render-contract version. Accessories, shipping materials, and exceptional oversize products use explicit display classes and do not silently alter bottle scale.

Every grid image uses:

- one fixed canvas;
- one fixed baseline;
- one global bottle `pixelsPerMm` value;
- a centered primary bottle body;
- a right-sidecar lane for detached caps when required.

This guarantees that a 100 mm assembly renders taller than an 85 mm assembly by the same physical ratio.

## 8. Madison asset ledger

The existing `best_bottles_pipeline_sku_jobs` table remains the per-SKU identity and workflow rollup. It currently assumes one generated/approved/published image per SKU, so a child asset table is required.

### 8.1 Parent SKU job

The parent record stores:

- organization and product-group relationship;
- website, Grace, and Shopify SKUs;
- Shopify product and variant IDs;
- family, capacity, color, applicator;
- geometry-cohort ID;
- canonical measurement snapshot and evidence status;
- current reference source;
- required asset roles;
- rollup counts and last blocking error.

### 8.2 Child image asset

`best_bottles_pipeline_image_assets` stores one row per SKU, asset role, and render-contract version.

Required fields:

- `sku_job_id`;
- `asset_role` (`pdp-hero`, `catalog-grid`, with future `cap-off` and `detail` roles);
- `render_contract_version`;
- `geometry_cohort_id`;
- source generation/asset ID and URL;
- approved asset ID and URL;
- source-reference manifest/hash;
- prompt and model versions;
- expected measurement targets;
- measured pixel bounds and QA report;
- quality status, approver, and approval timestamp;
- Shopify product, variant, media ID, and CDN URL;
- Convex destination field and sync timestamp;
- UI verification URL, result, and timestamp;
- retry count and last error;
- superseded asset relationship.

The active uniqueness contract is:

```text
(sku_job_id, asset_role, render_contract_version)
```

### 8.3 Three independent status axes

The UI and data model must not collapse these meanings:

1. **Reference status:** verified, conflict, missing, or exception.
2. **Quality status:** unreviewed, approved-keep, needs-regen, or rejected.
3. **Delivery status:** not-published, publishing, shopify-pushed, convex-synced, ui-verified, or failed.

An approval is not equivalent to being live. An asset is delivery-complete only after public UI verification.

## 9. Workflow and state transitions

Each required asset follows:

```text
reference-verified
  -> ready-to-generate
  -> queued
  -> generating
  -> generated
  -> qa-pending
  -> approved
  -> publishing
  -> shopify-pushed
  -> convex-synced
  -> ui-verified
```

Alternate states are `reference-conflict`, `rejected`, `needs-regen`, and `publish-failed`.

Every transition records actor, timestamp, source state, destination state, and structured context. Transitions are idempotent. Repeating a successful publish request returns the known Shopify media result instead of duplicating media.

## 10. Approval and publication

### 10.1 Operator action

The primary Madison action is **Approve & Publish**. It is enabled only when:

- reference truth is verified;
- geometry QA passes;
- visual identity QA passes;
- required source and version metadata are present;
- the operator has approval/publish permission.

Approval is recorded before publication begins. A publication failure never erases the approval.

### 10.2 Shopify roles

- **PDP hero:** uploaded to Shopify product media and associated as the variant's primary/featured product image.
- **Catalog-grid image:** uploaded to Shopify product media for CDN delivery but tracked as a separate role so it does not replace the PDP hero's variant association.

Both media IDs and CDN URLs are stored in Madison.

### 10.3 Convex roles

Backward-compatible field behavior:

- `products.imageUrl` remains the PDP hero URL.
- `products.imageUrlCapOff` remains the optional cap-off/detail URL.
- add `products.catalogGridImageUrl` for the physically scaled grid derivative.
- `productGroups.heroImageUrl` receives the designated primary variant's catalog-grid URL.

Best Bottles storefront behavior:

- PDP gallery prefers `imageUrl` for the main image.
- Catalog cards and variant previews prefer `catalogGridImageUrl`, then fall back to `imageUrl`.
- Cap-off/detail views continue using `imageUrlCapOff`.

### 10.4 UI verification

After Convex sync, the publisher:

1. queries Convex for the expected role-specific URL;
2. requests the public PDP and catalog route;
3. verifies that the expected Shopify CDN asset is rendered for the SKU/variant;
4. records the public URL, timestamp, and verification evidence;
5. marks delivery `ui-verified` only after both required views pass.

## 11. Madison operator UI

### 11.1 Navigation

```text
Diva
  -> 30 ml / 46 ml / 100 ml
  -> Clear / Frosted
  -> geometry cohort
  -> SKU variants
```

### 11.2 Cohort summary

The header shows:

- reference ready;
- generated;
- needs review;
- approved;
- Shopify pushed;
- Convex synced;
- UI verified;
- blocked conflicts.

### 11.3 Variant row

Each row presents:

- SKU and plain-language closure identity;
- legacy reference;
- PDP hero;
- catalog-grid image;
- expected and measured heights;
- reference, quality, and delivery statuses;
- one next-action button.

The next-action button is one of:

- Verify Reference;
- Generate;
- Review;
- Approve & Publish;
- Retry Publish;
- View Live.

### 11.4 Consistency review board

The cohort review board shows all selected variants:

- on one shared baseline;
- at the same body scale;
- with height guides;
- with an optional body-master silhouette overlay;
- ordered by assembled height or closure class.

Technical details such as raw prompts, source hashes, Firecrawl evidence, QA JSON, and destination IDs remain available in an expandable inspector.

## 12. Failure handling and recovery

- **Reference conflict:** block generation and show the conflicting fields and sources.
- **Identity mismatch:** reject the generated asset; do not publish.
- **Geometry drift:** normalize only when within the approved correction envelope; otherwise reject.
- **Shopify success, Convex failure:** retain Shopify media ID/URL and retry Convex only.
- **Convex success, UI verification failure:** retain both upstream successes, invalidate/revalidate the affected route, and retry verification.
- **Duplicate publish request:** return the existing active media mapping.
- **Superseded approved asset:** retain history and point the active mapping to the new version.
- **Missing Firecrawl credential:** use exact-page direct fetch for reference imagery and mark structured Firecrawl enrichment as pending; do not guess scraped measurements.

## 13. QA contract

### 13.1 Product truth

- exact website SKU match;
- Grace SKU crosswalk match;
- Shopify SKU/variant match;
- family, capacity, color, and closure match;
- measurements reconciled within source tolerance.

### 13.2 Geometry

- exact canvas dimensions;
- baseline within the contract tolerance;
- primary-body centerline within tolerance;
- body bounding box identical to the approved cohort body when composited from layers;
- assembled height within the Convex tolerance converted to pixels;
- width/diameter within tolerance;
- fixed neck anchor;
- detached component remains in its sidecar lane and does not shift the bottle.

### 13.3 Visual identity

- glass color/material preserved;
- cap/applicator class and finish preserved;
- no added, removed, duplicated, or merged components;
- clear glass remains empty and colorless;
- no label, text, prop, horizon, or background artifact;
- approved background and contact-shadow contract.

### 13.4 Publication

- Shopify media reaches ready state;
- Shopify media is mapped to the exact intended SKU and role;
- Convex stores the returned Shopify CDN URL in the correct field;
- public PDP and catalog views render the expected media.

## 14. Testing strategy

### Unit tests

- SKU normalization and exact matching;
- Firecrawl measurement extraction and conflict handling;
- geometry-cohort resolution;
- physical mm-to-pixel scale calculations;
- PDP cohort-scale calculations;
- height and baseline QA;
- asset-status transitions;
- role-to-Shopify/Convex routing;
- idempotent retries.

### Integration tests

- generate -> QA -> approval asset creation;
- approved PDP upload -> Shopify media -> Convex `imageUrl`;
- approved grid upload -> Shopify media -> Convex `catalogGridImageUrl`;
- primary grid asset -> product-group `heroImageUrl`;
- partial publish recovery;
- rejection of Sanity CDN URLs for commerce fields;
- rejection of mismatched SKU/cap identities.

### End-to-end calibration test

The initial 12 Diva 30 ml Clear variants must demonstrate:

- one pixel-identical body master across the cohort;
- assembled-height bands matching Convex within tolerance;
- at least reducer, perfume spray, lotion pump, and vintage bulb closure classes;
- both required output roles;
- manual approval history;
- Shopify media IDs and CDN URLs;
- Convex role-specific URLs;
- verified public PDP and catalog rendering.

## 15. Rollout

### Phase 0 — preflight

- reconcile Diva product truth from Convex and exact legacy URLs;
- create geometry cohorts;
- add child asset ledger and role-specific Convex fields;
- implement QA and publish-state transitions;
- verify Shopify connection and Firecrawl credential availability.

### Phase 1 — Diva 30 ml Clear calibration

- select 12 representative variants across closure classes and height bands;
- generate and review every asset manually;
- publish only after both product-truth and image QA pass;
- review PDP and grid views in the live UI.

### Phase 2 — complete Diva 30 ml

- generate remaining Clear variants;
- add Frosted cohorts after the Clear body/closure contract passes;
- retain manual approval for the full 30 ml phase.

### Phase 3 — Diva 46 ml

- reconcile 46 ml body measurement anomalies before generation;
- validate cross-size scale against 30 ml;
- expand closure coverage.

### Phase 4 — Diva 100 ml

- validate cross-size scale against 30 ml and 46 ml;
- verify width constraints and tallest closure assemblies.

### Phase 5 — family sign-off

- create 30/46/100 ml cross-size contact sheets;
- verify relative scale and all cap-height bands;
- approve the Diva render-contract version for broader catalog use.

## 16. Repository boundaries

### Madison Studio

- Firecrawl/reference intake;
- geometry-cohort and measurement snapshots;
- child asset ledger and status history;
- generation orchestration;
- deterministic rig and QA;
- approval UI and consistency board;
- role-aware Shopify publisher;
- destination verification state.

### Best Bottles

- Convex schema and role-specific mutations;
- catalog/PDP query shapes;
- `catalogGridImageUrl` storefront behavior;
- product-group primary grid propagation;
- route revalidation and public verification support;
- regression tests for catalog and PDP rendering.

Changes in the two repositories use the same versioned render contract and are committed separately. Active Cylinder work is isolated from Diva implementation through separate Git worktrees/branches.

## 17. Success criteria

The Diva calibration succeeds when:

- all 12 selected SKUs have exact product-truth matches;
- all bodies reuse or validate against the same approved cohort body;
- assembled heights and widths pass Convex-derived tolerances;
- PDP and grid assets are independently approved and tracked;
- no image is published before approval;
- one operator action publishes an approved asset through Shopify and Convex;
- repeated publication does not create duplicate active media;
- every required asset reaches `ui-verified` on the correct public route;
- the Madison UI clearly distinguishes Reference, Quality, and Delivery state;
- Diva 30 ml, 46 ml, and 100 ml contact sheets preserve truthful cross-size relationships.

## 18. Required credential and operational readiness

The current environment has local access to both repositories, installed dependencies, Madison's linked Supabase project, OpenAI generation configuration, Convex write configuration, and an encrypted Shopify organization connection.

Before the first live Firecrawl enrichment run, `FIRECRAWL_API_KEY` must be added to Madison's Supabase secrets. The key must be entered through Supabase or local secret management and never placed in source control or conversation text.
