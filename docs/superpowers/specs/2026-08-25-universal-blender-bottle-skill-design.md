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
7. Validate dimensions, topology, assembly, visual similarity, and evidence provenance.
8. Present an evidence-backed recommendation while leaving final acceptance to the operator.

## Operating Principles

- **Numeric measurements drive geometry.** Raster images, including AI-generated schematics, help interpret form but do not become dimensionally exact merely because they contain dimension labels.
- **Uncertainty is descriptive, not automatically blocking.** The operator selects the intended use and decides whether the result is acceptable.
- **Claims match evidence.** An inferred model may be approved for visual production, but it is not called manufacturer-verified without manufacturer evidence.
- **Research is federated.** There is no assumed universal bottle database. The workflow combines local evidence, visual search, manufacturer catalogs, standards, and design records.
- **One master, many variants.** Geometry is created once where practical; materials, closures, labels, cameras, lighting, and output jobs are derived layers.
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

`SKILL.md` remains a concise router containing the essential invariants, workflow selection, and reference map. Automatic discovery remains enabled for requests involving Blender bottle, vial, jar, flacon, closure, fitment, packaging, or product-render work.

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
- neck/finish, opening, closure, fitment, and seating information;
- material, color, decoration, liquid, and render requirements;
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
4. Chinese manufacturer catalogs and product pages, beginning with current drawing-rich sources such as Xuzhou Daxin, A-Best Glass, Uzone, GP Bottles, Roetell, and HCT.
5. Packaging distributors and manufacturers outside China when they expose better stock-bottle specifications or technical sheets.
6. Technical standards, especially CETIE flaconnage and perfume neck-finish documents.
7. Industrial-design registries such as WIPO Global Design Database, CNIPA design search, and EUIPO DesignView for identity and multi-view form evidence.
8. Supplier contact or sample measurement recommendations when public evidence remains insufficient.

Search results are evidence, not truth by popularity. Marketplace listings may reveal supplier codes and photographs but require corroboration before being treated as exact.

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
| Exact | Matching manufacturer/catalog identity and dimensions |
| Strong | Matching geometry, capacity, finish, and multiple measurements |
| Probable | Strong visual match with incomplete dimensional confirmation |
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

### 7. Blender modeling workflow

The skill supports rotationally symmetric, square, rectangular, oval, tapered, faceted, embossed, asymmetric, and sculptural bottle forms, plus vials and jars.

The preferred model architecture separates:

1. body exterior and interior volume;
2. neck and finish;
3. closure, fitment, pump, sprayer, roller, dropper, or overcap;
4. materials, liquid, labels, coatings, and decoration;
5. studio, camera, lighting, render settings, and output variants.

Profiles and dimensions should be parameterized when repetition or family scaling makes that valuable. Sculptural forms may use curves, subdivision, controlled deformation, retopology, or hybrid construction. The method is chosen from the evidence and intended use, not from one bottle-specific generator.

Existing validated finish and component masters are reused by fingerprint or contract. A closure is not assumed compatible merely because its marketing name resembles the bottle finish.

### 8. Quality assurance and handoff

QA is proportional to the acceptance class and reports:

- units, scale, transforms, named dimensions, tolerances, and overall envelope;
- topology, normals, manifold state where relevant, modifier state, and object organization;
- body/neck continuity and closure seating or interference;
- material and optical behavior at representative render settings;
- silhouette overlays or side-by-side comparisons against source photographs;
- evidence grades, unresolved discrepancies, and inferred geometry;
- source `.blend`, deterministic builder or procedure, renders, brief, and operator disposition.

Validation results inform approval. They become hard failures only when the requested deliverable explicitly requires the failed property or when continuing would overwrite protected work or misstate evidence.

## Best Bottles Integration

When the active project is Best Bottles, the adapter routes the agent to:

- the AIOS Bottle Production launcher and current cockpit;
- `pipeline/paper-doll-3d/RIG-MANUAL.md`;
- drawing coverage and locked manifests;
- `scripts/paper-doll-3d/build-master-scene.py` and related component/render tools;
- current geometry fingerprints, containment records, and local approval rules.

The approved 17/415 work remains protected. Existing uncommitted component work is treated as current workspace state rather than silently absorbed into the global skill.

## Error Handling

- If web or reverse-image tools are unavailable, continue with descriptive search or local evidence and report the missing route.
- If a page is inaccessible, search for the manufacturer code, cached catalog, mirrored PDF, distributor listing, or design record.
- If measurements conflict, preserve all values, identify their sources, recommend an interpretation, and record the operator's choice.
- If only one view exists, infer conservatively and request or search for orthographic views; do not pretend the unseen depth is verified.
- If an AI schematic drifts from supplied dimensions or identity, regenerate with one targeted correction or disregard it.
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

- a drawing-backed cylindrical bottle with a standard threaded finish;
- a photo-derived asymmetric perfume bottle with only envelope dimensions;
- a visually matched Chinese stock bottle found through manufacturer research;
- a bottle whose catalog and drawing measurements conflict;
- a bottle with incomplete or visually plausible but unverified closure data;
- a protected project master that must not be overwritten.

Success means the agent selects a suitable workflow, preserves provenance, does useful research, builds from numeric evidence, keeps uncertainty non-blocking, respects protected files, and reports an operator-ready decision package.

## Implementation Boundary

The first release creates the global skill and references, plus the Best Bottles routing adapter. It does not build a standalone web crawler, centralize copyrighted manufacturer catalogs, promise automatic CAD recovery, modify protected Blender masters, or convert the existing bottle scripts into a universal geometry engine. Those capabilities may be added later when repeated usage proves they are needed.
