# Paper-Doll Document-to-Asset Production Loop

**Date:** 2026-08-11

**Status:** Approved design

**Scope:** Best Bottles paper-doll bottle, neck-finish, fitment, component,
closure, assembly, studio, and catalog-asset production

## 1. Objective

Build a resumable, evidence-backed production loop that starts with the
manufacturer documents in:

`/Users/jordanrichter/Desktop/Best Bottles/Demo-Abbas/Spec Sheets`

and ends with approved, traceable paper-doll assets. The Desktop folder is the
incoming source. The repository holds the immutable, fingerprinted canonical
document library and every downstream contract, approval, protected master,
render, QA result, and asset-ledger record.

The loop must support bottles and the complete dimensional assembly around
them: neck finishes, fitments, components, closures, and verified combinations.
It must preserve the existing approved Blender geometry and replace the current
manual drawing-to-`CYL_SPECS` gap with explicit evidence, review, and promotion
stages.

## 2. Design principles

1. Drawings outrank pixels. A printed manufacturer dimension is never replaced
   by a measurement taken from an image.
2. A source and a sold identity are different records. For example, a drawing
   may say 10 ml while the approved catalog identity is the 9 ml cylinder.
3. Every production dimension retains its source document, page, callout,
   tolerance, authority, confidence, and review state.
4. Automation may draft a specification. It may not approve uncertain product
   truth or promote geometry.
5. Geometry is approved in clay before glass or catalog rendering.
6. A protected geometry master is immutable. Materials, lighting, components,
   closures, and cameras reference it without reshaping it.
7. A product is an assembly, not merely a bottle.
8. Unsupported combinations are blocked rather than inferred.
9. Every stage is idempotent and resumable from content hashes and recorded
   state.
10. Existing approved scenes and deliverables are never overwritten.

## 3. Source authority

When evidence disagrees, use this authority order:

1. Manufacturer engineering drawing and printed dimensions
2. Approved corrections documented in the repository
3. Approved protected Blender master
4. Canonical catalog/product identity data
5. Manufacturer or verified product photography
6. Generated reference imagery

Photography may solve an otherwise undocumented silhouette, count, or visual
relationship, but it cannot override a printed measurement. An extrapolated
or photo-solved value remains explicitly provisional until approved.

## 4. Domain model

### 4.1 Bottle

The bottle contract owns:

- overall height and body diameter;
- body silhouette and stations;
- outer and inner walls;
- shoulder and transition geometry;
- base and physical base thickness;
- capacity and overflow capacity where documented;
- neck-finish reference;
- geometry-cohort membership;
- source evidence and approval history.

### 4.2 Neck finish

The reusable neck-finish contract owns:

- finish standard and nominal size;
- thread pitch, lead, direction, starts, profile, and runouts;
- T, E, H, bore, and finish height dimensions;
- mouth, rim thickness, sealing surfaces, transfer/junction band, and seating
  datums;
- compatible fitment and closure interfaces;
- protected finish-master fingerprint.

A finish master is instanced without scaling. The bottle shoulder terminates at
the finish attachment datum.

### 4.3 Fitment

Fitments include roller housings, roller balls, plugs, orifice reducers,
wipers, inserts, and similar intermediate parts. Their contracts own:

- insertion and seating datums;
- interference and retention dimensions;
- exposed height;
- bore and component interfaces;
- sealing behavior;
- material options;
- compatibility evidence.

### 4.4 Component and closure

Components and closures include caps, pumps, sprayers, droppers, applicators,
dip tubes, and related replaceable parts. Their contracts own external form,
internal engagement, fitment references, materials, colors, and relevant
assembled dimensions.

### 4.5 Assembly

An assembly contract relates:

`bottle + neck finish + fitment + component/closure`

It records:

- thread engagement;
- insertion depth and interference fit;
- sealing-surface contact;
- roller-ball diameter and exposed height;
- dip-tube length where applicable;
- moving and static clearances;
- assembled height and width;
- permitted material and finish combinations;
- compatibility status and evidence.

Compatibility states are:

- `documented`
- `dimensionally_verified`
- `physically_verified`
- `provisional`
- `incompatible`
- `unknown`

Only documented, dimensionally verified, physically verified, or explicitly
approved provisional assemblies may produce catalog-ready assets.

### 4.6 Geometry cohort

Products share a protected geometry master only when the approved contracts
confirm the same body profile, shoulder, base, neck finish, thread geometry,
height, and diameter within the stated tolerance. Glass color, frosting,
decoration, roller material, or cap finish creates derivatives rather than
duplicate bottle geometry.

The swirl bottle remains its own body-geometry cohort even when it references
the same protected neck finish.

## 5. Document registry and canonical archive

Each source receives a stable document ID and records:

- SHA-256 content fingerprint;
- original filename and intake path;
- immutable canonical repository path;
- source organization;
- document type;
- drawing number, revision, and date where present;
- page count;
- related family, item number, capacity, or component;
- authority level;
- supersedes/superseded-by relationships;
- extraction, reconciliation, and review state.

Identical content under renamed filenames resolves to a single canonical source
record with multiple observed filenames. New content under an existing name is
a new revision, not an in-place replacement.

Every PDF page is rendered for visual inspection. Embedded text and OCR are
supplemental extraction aids; the rendered page is the review authority.

Documents are classified as:

- bottle drawing;
- neck-finish drawing;
- fitment drawing;
- component or closure drawing;
- assembly drawing;
- print-area-only drawing;
- photograph/reference;
- supporting note.

## 6. Dimensional contracts and provenance

Every normalized dimensional field records:

```json
{
  "value": 16.3,
  "unit": "mm",
  "tolerance": 0.3,
  "source_document": "doc_gbcyl10_blue",
  "source_page": 2,
  "source_callout": "diameter 16.3 plus or minus 0.3",
  "authority": "manufacturer_drawing",
  "confidence": "verified",
  "reviewed_by": "human",
  "status": "approved"
}
```

Machine extraction creates candidates, never approved values. Missing,
conflicting, or illegible requirements create blocking issues. Derived values
record their formula and input-field references. Extrapolated or photo-solved
values are visibly labeled and cannot masquerade as manufacturer truth.

## 7. Product identity reconciliation

The reconciliation layer maps:

`source drawing -> manufacturer family/item -> sold product -> catalog IDs ->
capacity label -> geometry cohort`

It preserves source terminology and approved commercial naming independently.
This layer also distinguishes a physical drawing from a print-area sheet and
prevents a marketing capacity or filename from silently becoming a geometry
measurement.

Catalog identity reconciliation may read canonical product truth but does not
mutate live catalog data during document or geometry processing.

## 8. Pipeline state machine

Each record moves through explicit states:

- `discovered`
- `archived`
- `extracted`
- `needs_reconciliation`
- `spec_ready`
- `spec_approved`
- `clay_ready`
- `geometry_approved`
- `master_locked`
- `variants_ready`
- `qa_passed`
- `publish_ready`
- `blocked`

Approvals are separate immutable records containing the reviewed artifact hash,
reviewer, timestamp, and notes. If an approved upstream contract changes, the
loop invalidates downstream approvals and outputs without deleting their prior
versions.

## 9. Review packets and human gates

The loop generates reviewable evidence rather than requiring direct JSON
inspection:

1. **Document packet:** rendered pages and detected callouts.
2. **Specification packet:** normalized values with page-level provenance.
3. **Conflict packet:** disagreements, missing requirements, and proposed
   resolutions.
4. **Clay packet:** front, side, three-quarter, neck macro, shoulder macro,
   base macro, and engineering section.
5. **Assembly packet:** fit, engagement, insertion, sealing, clearance, and
   complete silhouette views.
6. **Final QA packet:** material variants, components, assemblies, and
   production render comparisons.

Required human gates are separate for:

- dimensional specification;
- bottle geometry;
- neck-finish geometry;
- fitment/component geometry;
- mechanical compatibility;
- complete assembly appearance;
- final production assets.

## 10. Protected studio architecture

The current repository contains several studio generations. They are reference
work, not a single production authority. Before broad asset generation, the
studio must be consolidated into one protected architecture:

```text
BB_STUDIO_MASTER
├── BB_STUDIO_SWEEP
├── BB_CAM_MASTER
├── BB_PRODUCT_ROOT
├── BB_LIGHT_TARGET
├── BB_SCRIM_LEFT
├── BB_SCRIM_RIGHT
├── BB_LIGHT_TOP
├── BB_LIGHT_FILL
└── BB_LIGHT_BACKGROUND
```

The fixed template owns:

- collection and object naming;
- physical seamless floor/backdrop topology;
- product origin and ground plane;
- camera language and sensor assumptions;
- lighting-role architecture;
- render and color-management baseline;
- inspection workspaces;
- visibility and linking rules.

The template is fixed but not rigid. Versioned presets may adjust:

- light and scrim position, rotation, size, power, and softness;
- background color and brightness;
- world/fill level;
- material-specific reflection control;
- framing envelope derived from product height and diameter.

Initial presets are:

- `CLAY_GEOMETRY`
- `CLEAR_GLASS`
- `COLORED_GLASS`
- `FROSTED_GLASS`
- `COMPONENT_PRODUCT`
- `ASSEMBLY_QA`

All presets share the studio architecture and photographic language, but light
ratios and scrim placement may differ by material. The bottle or component is
never scaled to fit the frame. A long-lens camera is positioned from the
approved product envelope.

Saved workspaces must include:

- `SCENE OVERVIEW` for the complete set, camera, product, and lighting;
- `PRODUCT DETAIL` for geometry inspection;
- `LIGHTING PREVIEW` for camera-view rendered look development;
- `ASSEMBLY QA` for fit and section inspection.

Lighting or background experiments create new preset versions. They never
overwrite the protected template or an approved production preset.

## 11. Executable stages

One orchestrator controls specialized stages:

```bash
python3 scripts/paper-doll-3d/pipeline.py run
```

The stage commands are:

```bash
pipeline.py intake
pipeline.py inspect
pipeline.py reconcile
pipeline.py review specs
pipeline.py approve spec <contract-id>
pipeline.py build geometry <contract-id>
pipeline.py render clay <contract-id>
pipeline.py approve geometry <contract-id>
pipeline.py promote geometry <contract-id>
pipeline.py build assemblies
pipeline.py render assets
pipeline.py qa
pipeline.py publish-manifest
pipeline.py status
```

`pipeline.py run` advances every eligible record until it reaches a human
approval gate, documented conflict, missing dependency, failed audit, or
`publish_ready`. It concludes with a summary of complete, waiting, blocked,
failed, and ready records.

### 11.1 Intake

Scan the Desktop intake folder, fingerprint files, detect duplicates and
revisions, copy new content to the canonical archive, and update the registry.
Never modify or delete source files.

### 11.2 Inspect

Render PDF pages, extract embedded text and candidate measurements, create
searchable evidence, classify document types, and flag illegible or incomplete
drawings.

### 11.3 Reconcile

Match documents to products, components, and cohorts; normalize units and
tolerances; distinguish capacity labels from physical dimensions; create draft
contracts; and generate a blocking conflict report.

### 11.4 Build and clay gate

Compile only approved contracts into the existing parametric Blender builders.
Reuse compatible protected finishes. Build working bottle, fitment, closure,
and component scenes independently. Record dimensional audits and geometry
fingerprints. Render the required clay and section packet before promotion.

### 11.5 Promote

Copy the approved working scene to a versioned protected path and record object,
mesh, dimension, finish, and thread fingerprints. Derivative builders verify
those fingerprints before and after execution.

### 11.6 Assembly matrix

Combine approved protected parts only through compatible assembly contracts.
Audit insertion, engagement, clearances, datums, and complete dimensions.
Unapproved combinations remain blocked.

### 11.7 Asset generation and QA

Render approved bare parts and assemblies across permitted materials, finishes,
colors, catalog roles, and diagnostic views. Automated QA checks dimensions,
fingerprints, topology, normals, materials, camera/background consistency,
output completeness, canvas requirements, naming, and identity alignment.
Visual approval remains required for silhouette, fit, glass realism, and
luxury-photography quality.

### 11.8 Asset ledger

The first version creates a validated repository handoff rather than publishing
directly to production. Each record includes product and variant identity,
cohort, constituent part IDs, assembly ID, material configuration, asset role,
render fingerprint, approval provenance, readiness, and blockers. Madison
Studio, Convex, Shopify, or the website pipeline may later consume the same
ledger.

## 12. Repository layout

```text
pipeline/paper-doll-3d/
├── documents/
│   ├── originals/
│   ├── rendered-pages/
│   └── registry.json
├── evidence/
│   └── <document-id>/
├── contracts/
│   ├── bottles/
│   ├── finishes/
│   ├── fitments/
│   ├── components/
│   ├── closures/
│   └── assemblies/
├── reviews/
│   ├── specs/
│   ├── clay/
│   ├── assemblies/
│   └── qa/
├── studio/
│   ├── protected/
│   └── presets/
├── master/
│   ├── working/
│   └── protected/
├── renders/
└── asset-ledger.json
```

Large generated Blender and render artifacts continue to follow the existing
repository storage policy; the ledger always contains their hashes and paths.

## 13. Failure, resume, and safety behavior

- Stages write atomically and only mark success after output validation.
- Content hashes make unchanged inputs no-ops.
- A failure records its command, stage, input hashes, concise error, and
  retryability.
- A blocked record identifies the exact missing decision or dependency.
- Retrying never deletes a previous approved artifact.
- Existing locked/approved scenes are read-only inputs.
- Drafts and experiments remain under `working/`.
- No live catalog or website mutation occurs in the initial implementation.

## 14. Testing strategy

### 14.1 Unit tests

- stable document and contract IDs;
- SHA-256 duplicate/revision detection;
- unit and tolerance normalization;
- source-provenance validation;
- state-transition legality;
- approval invalidation;
- compatibility-matrix decisions;
- deterministic output naming.

### 14.2 Fixture and golden tests

- representative engineering PDFs and renamed duplicates;
- print-area-only and incomplete drawings;
- known 9 ml/10 ml commercial-name reconciliation;
- known 17-415 bottle/fitment/component assembly;
- expected review packets and conflict reports.

### 14.3 Blender integration gates

- contract-to-scene dimension audits;
- protected geometry fingerprint preservation;
- finish-master no-scale rule;
- clay-view completeness;
- assembly insertion and engagement audits;
- studio-template and preset separation;
- camera framing without product scaling;
- deterministic renders at test settings.

### 14.4 End-to-end dry run

Run the entire initial document set to the first human gate twice. The second
run must produce no new canonical sources and no unintended downstream changes.

## 15. Initial rollout

The first implementation tranche stops before new broad Blender production:

1. Create schemas, registry, state store, approval records, issue records, and
   CLI scaffolding.
2. Intake and fingerprint the 19 existing Desktop PDFs.
3. Render all pages and create document evidence packets.
4. Reconcile documents to the current drawing-coverage and product identities.
5. Create draft bottle, finish, fitment, component, and assembly contracts.
6. Migrate the already built bottle cohorts and 17-415 parts as legacy-approved
   references without modifying or rebuilding their geometry.
7. Report drawings ready for specification review, missing dimensions,
   unresolved product matches, existing masters, and missing components.
8. Consolidate and review the protected studio template before connecting new
   product contracts to catalog rendering.

After the foundation passes, implementation proceeds through geometry
compilation, clay approval, protected master promotion, assembly QA, asset
rendering, and publish-manifest generation.

## 16. Completion criteria

The loop is complete when:

- every intake document is fingerprinted, archived, classified, and traceable;
- every production dimension has provenance and approval state;
- bottles, finishes, fitments, components, closures, and assemblies have
  separate contracts and compatibility records;
- the existing approved geometry is migrated without mutation;
- one protected studio architecture supports versioned flexible presets;
- clay, assembly, and final QA gates block unapproved promotion;
- a rerun resumes cleanly and does not duplicate work;
- approved assets are registered in a validated ledger ready for publishing
  integration;
- unresolved truth, compatibility, or quality problems remain visible blockers
  rather than hidden assumptions.
