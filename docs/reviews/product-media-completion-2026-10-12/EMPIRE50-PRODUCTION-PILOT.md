# Empire 50 ml lotion — production-matched local pilot

Updated 13 October 2026. **In progress. Local candidates; no release.**

## Completed locally

- Captured the Empire production catalogue through read-only public queries: 91 variants in 11 groups, with 127 query receipts including exact PDP compatibility lookups. No production environment switch or data writes.
- Activated a development-only, file-backed replay for Empire PDP and Builder reads. The exact Empire-family catalogue filter now uses captured production catalogue metadata and published image references; broader and mixed-family browsing remains development data. A visible banner states the boundary. Captured/uncaptured SKU mixes and missing in-scope receipts fail instead of silently mixing databases.
- Replaced the broken Empire 50 ml lotion tube locally for seven existing component finishes. Preserved bottle and hardware registration. Original PSD tube pixels are retained inside a documented crop, with one uniform scale; faint raster tails and an isolated edge fleck outside the continuous mechanism are excluded.
- Recovered the eighth finish, the white rectangular pump and clear overcap, using the preserved PR 341 source cutter. Its pump/cover pixel hashes reproduce the previous source extraction. Its tube comes from the exact Empire white-pump PSD. The detached empty cover is a preserved generated PR candidate and **still requires approval**.
- All eight use guarded exact plate and pump registration. Changes to source URLs, dimensions, scale or anchors invalidate the overrides. Production and Vercel do not activate these local candidates.
- Built 24 offline PDP view images and exercised 48 Builder stage/cover layouts using the actual shared layout functions. These are not browser screenshots. Inspected the full contact sheet, representative enlarged tube joins, and white mechanism.
- 20 focused tests pass, including real Builder server loaders using the captured production snapshot with network requests prohibited. TypeScript passes. Compatibility and catalogue snapshot replay are included in these checks.
- Local server restarted and reported Ready at localhost:3005. No page fetch was used to claim browser success.

## Exact scope

LBEmp50LtnMtGl, LBEmp50LtnShnGl, LBEmp50LtnShnBlk, LBEmp50LtnMtSl, LBEmp50LtnShnSl, LBEmp50LtnCu, LBEmp50LtnClOvrCap, LBEmp50WhtClOvrCp.

The legacy catalogue confirms the cylindrical treatment-pump appearance for the seven metal/round-clear finishes. White rectangular pump is a different component and uses its own tube. All bottles must appear empty, with no perfume, oil or liquid.

## Acceptance still open

1. Owner review of the tube's seated appearance and the white detached cover.
2. Exact eight-SKU PDP/Builder UI checks: all supported views, zoom, stable selectors, finish identity, handoff, cart imagery, loading/recovery, desktop and physical iPhone Safari. `manual-ui-checks.csv` has 80 pending surface/view/device checks; none are passed by this script.
3. Catalogue card visual review. Its exact Empire filter is now production-matched, but cards retain published images; newly repaired assemblies are currently on PDP and Builder. Decide whether any card hero also needs replacement before acceptance.
4. PR/CI review, approved merge, asset publication, reference loading and deployment; then production UI recheck. No such release step was performed.

The agent browser attempt was denied by the saved permission policy. This is an unresolved verification gate; offline evidence is not a replacement for UI acceptance.

## Review

- Local checklist: http://localhost:3005/team/media-review
- `all-eight-views.jpg`: eight finishes, columns Sidecar / Cap On / Exploded.
- `comparison.jpg`: prior broken matte-gold Expanded / source candidate Expanded / candidate Sidecar.
- `verification.json`: exact local SKU/view/layout evidence.
- `source-tube-candidate.json`, `white-tube-candidate.json`, `white-component-recovery.json`: provenance and registration.
- `family-baseline.json.initial`: preserved initial read-only snapshot, before compatibility receipts were added.

## Catalogue continuation

The parent `family-execution-queue.csv` partitions the saved 2,485 product records / 2,482 nonblank SKUs into 401 body/glass/fitment batches across 40 families, including standalone and held records. This is an execution index, **not 401 defects**. Builder membership uses dated evidence and must be refreshed per family. Existing local corrections must be reconciled before any new artwork is made.

Priorities after pilot review: confirmed identity/image gaps, Round 78 clear/frosted registration, Square 15 source pilot acceptance, Boston and remaining shared families. Each batch receives its own production capture, exact source matching, local integration, contact review, UI evidence and separate release gates.

Evidence directory: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/empire50-production-pilot`
