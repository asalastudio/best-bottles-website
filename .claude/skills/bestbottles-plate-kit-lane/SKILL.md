---
name: bestbottles-plate-kit-lane
description: Reconcile and produce Best Bottles family plates and photographic component kits using the current legacy catalog as the cutover baseline, master PSDs, and exact legacy assets recovered with Firecrawl or Agent Reach. Use for any family's media processing, source recovery, or related catalog gaps before staging and release.
---

# Best Bottles — legacy-first plates and kits

Use for any requested family, across all capacities, bottle colors, neck/interface
systems, and valid assemblies. Plates are finished SKU images; kits preserve the
verified photographic parts for component changes. They are not 3D meshes.

## Catalog and source rules

Jordan's cutover rule: **every product and purchasable variant currently sold on
legacy bestbottles.com belongs in the staging cutover catalog.** Convex-only
inventories, sitemap-only crawls and exact PSD filename matches cannot define
complete family scope. Account for all legacy product images and usable views;
a plate need not display every gallery image, but source views must not disappear
from the source inventory. A missing image does not remove a valid product.

**Current exact-SKU legacy evidence is the default authority for commercial
product facts**, ahead of conflicting production/preview Convex or Shopify data:
identity, family, bottle type, capacity, neck/interface, bottle and component
attributes, descriptions, measurements, weight, pricing tiers and pack quantities.
Convex is the destination system of record after reconciliation, not proof that
an imported value is correct. Preserve existing record IDs, Shopify references,
necessary routes and active exact-SKU resolution while proposing corrections.

Approved customer-facing naming and formatting may differ from legacy when they
preserve meaning. Keep the original text and exact website SKU in the evidence.
Do not collapse Short/Regular, Shiny/Matte, Ribbed/Smooth, roller material, or
bottle color versus cap color. Prior explicit SKU-specific corrections remain
recorded exceptions; if current legacy conflicts with those or with itself,
show both sources and resolve the conflict rather than silently reversing a
confirmed decision. Missing values stay unknown, not guessed.

The complete source set is:

- Master artwork: `/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`.
- Current legacy Best Bottles product pages, category listings, option-selector
  responses, specifications, galleries and directly linked media.

Use the master for editable, high-quality layers. Recover any unmatched image,
copy or specification from legacy using Firecrawl or Agent Reach. This is part
of normal family processing and is not restricted to flip-top bottles. A failed
filename match means **source matching pending**, not missing artwork. Only call
an image absent from legacy after checking exact product and option evidence;
a timeout, failed scrape or blocked request means verification is unresolved.

Read [Legacy reconciliation and recovery](references/legacy-reconciliation.md)
when starting a family or resolving catalog/source gaps. It contains retrieval,
field-comparison and evidence rules, including pricing and physical measurements.

## Repeatable family workflow

1. Confirm the active checkout, branch, target environment and source paths.
   Keep other families, dirty changes and source originals intact. Refresh
   production and development snapshots read-only, with environment/time labels.
2. Build the family scope from live legacy listings and selectable variants, then
   compare the union with Convex, Shopify and previous crosswalks. Include exact
   legacy SKUs absent from Convex; classify Convex-only records for review without
   inventing cutover products or deleting them. Do not infer retired status from
   one missing page or omission from a sitemap.
3. Compare every in-scope SKU's commercial fields and views with current legacy.
   Record raw values, approved display transformations, conflicts and evidence.
   Refresh volatile price/availability evidence before release.
4. Search the entire master inventory, including alternate basenames, capped and
   uncapped folders, non-PSD assets and embedded layers. Compare candidate images
   with exact legacy references. Use verified crosswalks instead of SKU parsing.
5. Retrieve remaining legacy assets and information. Save original bytes,
   page/option responses, hashes and source lineage in an isolated family batch.
   Classify assembled, cap-off, component, measurement and other views visually.
6. Produce plates and extract only verified kit parts. A flat image can support
   a plate; it is not automatically a layered kit. Identify actual body, insert,
   roller, pump, collar, cap and overcap roles; exclude unused alternatives and
   retouch patches explicitly. Never reshape a regular cap into a short one.
7. Validate source-to-SKU identity, body registration, alpha edges, assembled
   reconstruction and exposed parts. Check separate component catalog identities
   and valid assemblies. Matching threads alone does not prove physical fit.
8. Report per-SKU source, catalog, plate, kit and release status separately, with
   exact remaining actions. Respect the current task's approval boundary: an
   audit does not authorize data fixes or publishing. Apply already-authorized
   corrections without asking again; unresolved factual conflicts stay isolated.
9. After authorized publishing, verify every hosted asset and exact-SKU behavior
   in the selector, specifications, cart, URL and mobile picker/drawer. Check
   Grace routing when the processed family is exposed to Grace.

Complete standalone products (for example plastic flip-top bottles) need plates;
external interchangeable kits can be not applicable. Closed systems may have
valid internal options without cross-family compatibility. Classify using
product evidence, not simply zero stored component relationships.

## Running the existing pipeline

From the verified repository, inspect current scripts and `--help` before use.
The scoped local entry points are:

```bash
python3 scripts/paperdoll/family_batch.py --family FAMILY --catalog SNAPSHOT --out BATCH --stage prepare
python3 scripts/paperdoll/family_batch.py --family FAMILY --catalog SNAPSHOT --out BATCH --stage plates
python3 scripts/paperdoll/family_batch.py --family FAMILY --catalog SNAPSHOT --out BATCH --stage audit-kits
python3 scripts/paperdoll/build_master_kits.py --batch BATCH
python3 scripts/paperdoll/family_report.py --batch BATCH
```

These commands are not proof of complete legacy coverage: `family_batch.py`
currently scopes from a Convex snapshot and selects matching master PSD names.
Keep the legacy scope and recovery ledger alongside its outputs until supported
adapters cover that scope. Source guards may still reject externally retrieved
legacy images or verified alternate filenames. Treat that as integration work;
do not falsify a master path, bypass identity checks, or mark those sources absent.

The conservative master kit extractor needs explicit, source-hash-backed physical
layer assignments for ambiguous PSDs. Layer-count hints and prototype candidates
are not published kits. Historical family builders can reference old libraries;
inspect their source roots before reuse. Never quote archived coverage totals as
current readiness. Read `scripts/paperdoll/README.md` in the active repository for
publisher options and implementation details; the source policy above supersedes
older master-only sourcing instructions, without pretending code already supports it.

Shopify studio-canvas photo composition can use the repository's
`bestbottles-paperdoll-compositor` skill when relevant; the same legacy-first
product-truth and source rules still apply.

## Publication and verification invariants

- Resolve `websiteSku` exactly against the reconciled active product. Active
  exact SKU wins over retired aliases. Look up internal/Grace identifiers from
  actual records, never derive them from strings or filenames.
- Use reconciled catalog fields for family grouping. Retain neck/interface
  distinctions where applicable; never invent a thread for a non-threaded or
  standalone product merely to satisfy a grouping key.
- Preserve source hashes and content-addressed output keys. Do not overwrite or
  delete original/master media. A new rendering produces a new asset key.
- A valid legacy SKU missing from Convex is a reconciliation item, not an asset
  to omit or an orphan to force through the publisher. Preserve existing IDs;
  create required records only within authorized reconciliation work.
- Do not publish unresolved aliases. Exact source lineage can establish a
  crosswalk; record its evidence and reviewer. Ambiguous candidates remain held.
- Keep publisher-required review metadata, including `tokens.json.reviewedAt`.
  A timestamp alone does not establish review.
- Verify public URL status, decoded format, dimensions, length, cache/CORS and
  recorded hash as applicable. A local successful render is not a hosted check.
- Existing image gates: registration residual ≤12/255; closure axis ≤2 px;
  kit composite mean error ≤6/255 over ink; ≥5% alpha transparency and no ink
  clipped on part edges. Also inspect exploded spacing and correct exposed parts.
- A kit needs a usable corresponding plate. Check switching components keeps the
  intended body fixed and loads the correct part, including cap-off behavior.
- Verify deployment targets from actual configuration. Never run `convex dev` or
  deploy an isolation worktree's whole backend against a shared environment
  unless its complete `convex/` tree is aligned with the intended backend.
- Before publishing, preserve the current indexes and SKU-scoped rollback plan.
  Report prepared, validated, committed, merged and deployed as distinct states.
