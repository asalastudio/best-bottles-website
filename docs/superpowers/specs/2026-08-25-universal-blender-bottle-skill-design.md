# Universal Blender Bottle Skill Design

**Date:** 2026-08-25

**Status:** Approved in conversation by Jordan Richter

**Skill name:** `modeling-bottles-in-blender`

## Purpose

Create one globally discoverable Codex skill for researching, reconstructing, modeling, validating, and rendering bottles in Blender. The skill must support any bottle form or component system rather than encoding one Best Bottles family, capacity, or neck finish.

The skill should help an operator reach the strongest defensible result from the evidence that exists. Missing manufacturer drawings must not prevent visual-production work. Evidence quality, assumptions, and uncertainty remain visible so an inferred model is not misrepresented as verified manufacturing geometry.

## Outcomes

The skill guides an agent to:

1. Discover the project's existing bottle assets, product data, scripts, and source-of-truth rules.
2. Convert measurements and visual evidence into a reusable bottle brief.
3. Search the web, manufacturer catalogs, standards, and design registries for a likely source bottle or stronger technical evidence.
4. Generate an inferred multi-view schematic when an authoritative drawing cannot be recovered.
5. Build deterministic Blender geometry from numeric measurements and interpreted profiles.
6. Keep the bottle body, neck finish, closure/fitment, material, studio, and output variants separable.
7. Validate dimensions, topology, assembly, visual similarity, profile provenance, and the exported artifact's delivery contract.
8. Present an evidence-backed recommendation while leaving final acceptance to the operator.

## Operating Principles

- **Numeric measurements drive geometry.** Raster images, including AI-generated schematics, help interpret form but do not become dimensionally exact merely because they contain dimension labels.
- **Original photographs outrank generated profiles.** Measured silhouettes and direct interpretation of source photographs govern every visible profile segment. AI schematics fill only regions not shown by original photography.
- **Uncertainty is descriptive, not automatically blocking.** The operator selects the intended use and decides whether the result is acceptable.
- **Claims match evidence.** An inferred model may be approved for visual production, but it is not called manufacturer-verified without manufacturer evidence.
- **Research is federated.** There is no assumed universal bottle database. The workflow combines local evidence, visual search, manufacturer catalogs, standards, and design records.
- **One master, many variants.** Geometry is created once where practical; materials, closures, labels, cameras, lighting, and output jobs are derived layers.
- **The neck finish is a fixed dimensional module.** Scaling or deriving a body within a family never scales its finish. Sizes sharing a finish reuse dimensionally identical T/E/I, finish height, pitch, and thread-turn geometry.
- **Delivery requirements are explicit.** QA validates the exported artifact against the consuming application's delivery contract rather than passing an abstract model with no destination requirements.
- **Locked work stays locked.** Existing approved meshes, fingerprints, manifests, and masters are copied or referenced, never casually overwritten.
- **Project rules outrank generic defaults.** The global skill discovers and follows the current repository's `AGENTS.md`, local manuals, naming, source hierarchy, and approval conventions.

## Acceptance Classes

The operator chooses or confirms an intended result class:

| Class | Intended use | Typical evidence |
|---|---|---|
| Concept | Shape exploration and internal discussion | Partial dimensions and visual references |
| Visual production | Ecommerce, catalog, animation, and marketing renders | Reliable envelope dimensions plus calibrated imagery |
| Fitment candidate | Closure and component visualization requiring plausible interfaces | Neck standard, closure data, or measured sample |
| Manufacturing reference | Tooling, procurement, or dimension-critical exchange | Manufacturer drawing, CAD, or measured physical sample |

Agents may recommend a class or warn that evidence is weak. They do not prevent an operator from accepting a lower-confidence result for an appropriate use. If the requested label exceeds the available evidence, the agent records the operator's decision and reports the discrepancy plainly.

## System Architecture

### 1. Global skill entrypoint

Install the skill at:

`~/.codex/skills/modeling-bottles-in-blender/`

`SKILL.md` remains a concise router under 500 lines containing the essential invariants, workflow selection, and reference map. Large references include a table of contents. Automatic discovery remains enabled through this frontmatter description, which contains the complete invocation boundary:

> Use when a task involves creating or editing bottle, vial, jar, flacon, closure, or fitment geometry in Blender; 3D models or meshes; dimensional 3D reconstruction; closure fitment in 3D; or GLB/glTF export, even when the user does not name the skill. Not for 2D image work such as PSD preparation, background removal, compositing, or layered paper-doll imagery.

`SKILL.md` does not repeat a separate "when to use" section. General packaging and product-render language alone does not trigger the skill without a 3D or Blender context.

Proposed resources:

```text
modeling-bottles-in-blender/
|-- SKILL.md
|-- agents/openai.yaml
`-- references/
    |-- bottle-brief.md
    |-- evidence-research.md
    |-- inferred-schematics.md
    |-- blender-modeling.md
    |-- qa-and-handoff.md
    `-- best-bottles-adapter.md
```

The Best Bottles adapter routes to live project documents and scripts; it does not copy product dimensions into the global workflow.

### 2. Project discovery

Before modeling, the agent inspects the current workspace for:

- repository instructions and current branch state;
- source images, PSDs, drawings, PDFs, catalogs, CAD, and existing `.blend` files;
- structured product data such as Convex exports, PIM records, spreadsheets, or JSON;
- existing geometry builders, component libraries, tests, manifests, and locked outputs;
- the destination and intended use of the model.

The agent preserves unrelated work and chooses a safe working copy when a locked or approved Blender file exists.

### 3. Bottle brief

Each bottle receives a small, portable brief. It records:

- project identifier, bottle name, family, capacity, and known SKU or catalog codes;
- intended acceptance class and operator priorities;
- units and numeric dimensions, including tolerances when known;
- body shape descriptors and available front, side, top, base, and detail references;
- profile segments such as lip, finish, neck land, shoulder, body wall, heel, base, and push-up, with a source class recorded independently for each segment;
- neck/finish, opening, closure, fitment, and seating information;
- material, color, decoration, liquid, and render requirements;
- `delivery_contract`, containing the consuming application's mesh/component naming and separation, up-axis behavior, origin and floor convention, unit scale, triangle budget, interior-cavity requirement, UV conventions, file format, compression, and file-size budget;
- each evidence item's source, date accessed, confidence, and whether it is direct or inferred;
- unresolved conflicts, chosen interpretations, and operator decisions;
- Blender source, derived artifacts, validation results, and approval status.

The brief may be Markdown, JSON, or an existing project-native contract. The skill adapts to the repository instead of forcing a new database.

### 4. Embedded evidence-research workflow

Research may run in the main session or through a focused research agent when delegation is available and appropriate.

The search ladder is:

1. Local drawings, product records, PSDs, photographs, filenames, watermarks, and prior decisions.
2. Exact identifiers: SKU, mold number, supplier code, capacity, neck code, and quoted filename searches.
3. Visual and multimodal sourcing: Alibaba image search or Alibaba Lens, Made-in-China Sourcing Lens, and other available reverse-image tools.
4. Manufacturer catalogs and product pages, including Chinese perfume and cosmetic packaging manufacturers.
5. Packaging distributors and manufacturers outside China when they expose better stock-bottle specifications or technical sheets.
6. Technical standards, especially CETIE flaconnage and perfume neck-finish documents.
7. Industrial-design registries such as WIPO Global Design Database, CNIPA design search, and EUIPO DesignView for identity and multi-view form evidence.
8. Supplier contact or sample measurement recommendations when public evidence remains insufficient.

Search results are evidence, not truth by popularity. Marketplace listings may reveal supplier codes and photographs but require corroboration before being treated as exact.

### Current example source registry (2026-08)

This dated list is maintained as examples rather than permanent workflow logic:

- visual sourcing: Alibaba image search and Alibaba Lens; Made-in-China Sourcing Lens;
- Chinese manufacturer catalogs: Xuzhou Daxin, A-Best Glass, Uzone, GP Bottles, Roetell, and HCT;
- standards: CETIE flaconnage and perfume neck-finish documents; applicable SPI/GPI finish references;
- design registries: WIPO Global Design Database, CNIPA design search, and EUIPO DesignView.

The reference list is re-verified before a current-availability claim. Adding, removing, or replacing a vendor requires one edit to the dated registry, not a workflow rewrite.

### 5. Candidate matching

OpenAI visual reasoning derives a searchable fingerprint from the supplied images:

- silhouette and cross-section class;
- capacity and height-to-width/depth ratios;
- shoulder, heel, base, push-up, and panel transitions;
- neck finish and closure appearance;
- glass color, decoration, embossing, seams, and distinctive features;
- visible text, codes, watermarks, or packaging context.

Candidates receive an informational grade:

| Grade | Meaning |
|---|---|
| Exact | Matching identity plus manufacturer-published dimensions, or a measured physical sample |
| Strong | Matching geometry, capacity, finish, and multiple measurements |
| Probable | Strong visual match with incomplete dimensional confirmation; this is the maximum grade for marketplace-listed dimensions without manufacturer or physical-sample confirmation |
| Reference only | Related construction or silhouette useful for interpretation |

The agent keeps multiple candidates when ambiguity remains and explains why it recommends one. Grades guide the operator and do not create automatic stop conditions.

### 6. Inferred schematic generation

When source drawings are missing or incomplete, the agent may use the installed image-generation workflow and `gpt-image-2` to create a clean multi-view reference sheet.

Inputs include:

- the best original photographs from multiple angles;
- the verified numeric dimension table;
- selected manufacturer or design-registry references;
- explicit front, side, top, bottom, neck-detail, and section-view requests as appropriate;
- invariants identifying which visible bottle traits must remain unchanged.

The output is labeled **AI-assisted inferred schematic**. It may organize known dimensions and propose missing profiles, but it does not invent verified measurements. Every newly inferred dimension is separately marked as inferred. Numeric values in the bottle brief—not pixel measurements from the generated sheet—drive the Blender builder.

Every profile segment uses the following evidence hierarchy:

1. measured silhouette extraction from calibrated original photographs;
2. direct visual interpretation of original photographs;
3. AI-generated inferred schematic;
4. assumed geometry based on symmetry, convention, or analogy to a reference bottle.

An AI schematic may supply a segment only when no original photograph shows that region. It never overrides a measured silhouette or direct interpretation of a visible source region. For example, front-photo silhouette data governs a visible shoulder and heel, while an AI sheet may propose an occluded side-depth transition. The bottle brief records the source class for each segment, not only for each dimension.

### 7. Blender modeling workflow

The skill supports rotationally symmetric, square, rectangular, oval, tapered, faceted, embossed, asymmetric, and sculptural bottle forms, plus vials and jars.

The preferred model architecture separates:

1. body exterior and interior volume;
2. neck and finish;
3. closure, fitment, pump, sprayer, roller, dropper, or overcap;
4. materials, liquid, labels, coatings, and decoration;
5. studio, camera, lighting, render settings, and output variants.

Profiles and dimensions should be parameterized when repetition or family scaling makes that valuable. Sculptural forms may use curves, subdivision, controlled deformation, retopology, or hybrid construction. The method is chosen from the evidence and intended use, not from one bottle-specific generator.

Profile construction follows the segment hierarchy defined above. Measured silhouettes govern all photographed contours. Direct photographic interpretation governs visible regions that cannot be calibrated reliably. AI-generated profiles are limited to regions not shown in the originals, and assumptions are the last resort. Modeling code or handoff notes preserve the segment boundaries so QA can identify where the governing source changes.

When deriving another body size in a family, scale or rebuild only the body profile below the finish attachment datum. The finish remains an unscaled fixed module. Two bodies that share a finish must produce identical finish T/E/I dimensions, finish height, pitch, and thread turns. Validation compares the finish module directly with the applicable SPI/GPI/CETIE or project-native finish contract, independently of body dimensions and scale.

Existing validated finish and component masters are reused by project-native fingerprint or contract when available. If a project has no geometry-fingerprint system, the brief records the reused source's explicit file path and content hash. The skill does not invent a new project fingerprint scheme. A closure is not assumed compatible merely because its marketing name resembles the bottle finish.

### 8. Quality assurance and handoff

QA is proportional to the acceptance class and reports:

- units, scale, transforms, named dimensions, tolerances, and overall envelope;
- topology, normals, manifold state where relevant, modifier state, and object organization;
- body/neck continuity and closure seating or interference;
- finish T/E/I, finish height, pitch, and thread turns independently from body scale;
- material and optical behavior at representative render settings;
- silhouette overlays or side-by-side comparisons against source photographs;
- per-segment profile provenance, with AI-inferred and assumed segments listed distinctly;
- evidence grades, unresolved discrepancies, and inferred dimensions;
- reused component provenance, using the project-native fingerprint or, when none exists, the explicit source path and content hash;
- every field in the active `delivery_contract`, checked against the exported artifact rather than only the Blender scene;
- source `.blend`, deterministic builder or procedure, renders, brief, and operator disposition.

If no delivery contract is on file, QA reports **no delivery contract on file** rather than silently passing export readiness. Validation results inform approval. They become hard failures only when the requested deliverable explicitly requires the failed property or when continuing would overwrite protected work or misstate evidence.

## Best Bottles Integration

When the active project is Best Bottles, the adapter routes the agent to:

- the AIOS Bottle Production launcher and current cockpit;
- `pipeline/paper-doll-3d/RIG-MANUAL.md`;
- drawing coverage and locked manifests;
- `scripts/paper-doll-3d/build-master-scene.py` and related component/render tools;
- current geometry fingerprints, containment records, and local approval rules.

The approved 17/415 work remains protected. Existing uncommitted component work is treated as current workspace state rather than silently absorbed into the global skill.

The Best Bottles adapter supplies this configurator GLB delivery contract:

| Field | Requirement |
|---|---|
| Format | Binary glTF (`.glb`) |
| Mesh matching | Case-insensitive substring matching for `body`, `liquid`, `cap`/`sprayer`/`pump`/`roller`/`dropper`, `collar`, `label_front`, and `label_back` |
| Authoring orientation | Blender +Z up, base centered on and seated at Z=0; the imported GLB must remain upright after standard glTF axis conversion |
| Scale | Real dimensions authored in millimeters and verified after import |
| Triangle budget | Approximately 10,000–40,000 triangles per assembly |
| Glass construction | Interior cavity modeled |
| Label UVs | Flat 0–1 UVs on label meshes |
| Compression | Draco-compressed GLB |
| Size target | Approximately 45 KB per bottle; recorded as a target, with variance reported rather than hidden |

A Best Bottles run exports a GLB and runs an automated artifact check against every contract field. The checker evaluates consumer-visible orientation and scale after importing the GLB, so Blender's standard glTF axis conversion does not create a false failure. A non-Best-Bottles run with no configured contract reports the missing contract explicitly.

## Error Handling

- If web or reverse-image tools are unavailable, continue with descriptive search or local evidence and report the missing route.
- If a page is inaccessible, search for the manufacturer code, cached catalog, mirrored PDF, distributor listing, or design record.
- If measurements conflict, preserve all values, identify their sources, recommend an interpretation, and record the operator's choice.
- If only one view exists, infer conservatively and request or search for orthographic views; do not pretend the unseen depth is verified.
- If an AI schematic drifts from supplied dimensions or identity, regenerate with one targeted correction or disregard it.
- If an AI schematic conflicts with a photographed profile segment, the original photograph governs and the conflict is recorded.
- If no delivery contract exists, complete model-level QA and report the export-readiness gap without inventing project requirements.
- If a Blender build fails validation, keep the failure artifacts separate and do not overwrite the last accepted source.

## Rights and Provenance

The research workflow records source links and identifiers. Manufacturer drawings and registered-design images are used as evidence according to their access terms; the skill does not claim ownership, licensing, or permission to manufacture a protected design. When a likely proprietary or registered design is identified, that fact is included in the handoff for operator review.

## Skill Verification Strategy

Skill development follows documentation TDD:

1. Run baseline scenarios without the new skill and record failures.
2. Write the minimum skill guidance that corrects observed failures.
3. Re-run equivalent scenarios with the skill and close demonstrated gaps.
4. Validate the skill package with the bundled skill validator.

Forward tests cover at least:

- a drawing-backed cylindrical bottle with a standard threaded finish, including a 30 ml to 60 ml family derivation whose shared finish remains unchanged and whose exported Best Bottles GLB passes its delivery contract;
- a photo-derived asymmetric perfume bottle with only envelope dimensions;
- a visually matched Chinese stock bottle found through manufacturer research;
- a bottle whose catalog and drawing measurements conflict;
- a bottle with incomplete or visually plausible but unverified closure data;
- a protected project master that must not be overwritten.
- a bottle with original photographs and an AI sheet, demonstrating that photographed segments use measured silhouettes or direct photo interpretation, AI supplies only occluded regions, and the brief records provenance per segment;
- a 2D PSD preparation, background-removal, compositing, or layered paper-doll task that must not trigger the skill, while 3D bottle requests that never mention the word "skill" must trigger it.

Success means the agent selects a suitable workflow, preserves dimension and profile-segment provenance, does useful research, builds photographed profiles from photographic evidence, keeps uncertainty non-blocking, preserves finish invariance, respects protected files, validates against a delivery contract when present, reports when one is absent, and produces an operator-ready decision package.

## Implementation Boundary

The first release creates the global skill and references, plus the Best Bottles routing adapter. It does not build a standalone web crawler, centralize copyrighted manufacturer catalogs, promise automatic CAD recovery, modify protected Blender masters, or convert the existing bottle scripts into a universal geometry engine. Those capabilities may be added later when repeated usage proves they are needed.
