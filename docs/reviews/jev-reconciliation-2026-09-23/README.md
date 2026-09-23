# Jev reconciliation pilot

Jev reviews whether the exact public catalog descriptions support the bottle and proposed hardware shown by the builder. The model audit is advisory and cannot change records. The staff Components Library provides a separate, authenticated review and explicit catalog-submission workflow.

## Scope and evidence

The initial fixture contains 12 real configurations from the four-family reconciliation replay (Cylinder, Circle, Round, Empire) and 10 deliberately incorrect or insufficient controls. The selected cases cover spray, roller, short cap, dropper, reducer, and bulb/tassel assemblies. This is a pilot, not all 904 eligible builder configurations.

`data/reconciliation/jev-pilot.json` contains only public product identity and source descriptions. Builder fitment/finish labels come from `server-replay.json` recorded in the parent reconciliation review; raw `capColor` is deliberately not substituted for the resolved hardware finish. Evidence comes from exact bestbottles.com product pages. Source receipts record URL, capture time and SHA-256; compressed original HTML is retained here. Missing source fields remain missing and require review. The 5 mL / legacy 5.5 mL descriptions are preserved as a discrepancy, not silently normalized.

Controls are explicitly tagged `kind: control`; some intentionally alter fields or descriptions. They are never catalog records, and their synthetic source text is not represented as a verbatim extraction. Benchmark labels and control tags are withheld from the model.

## Decision contract

- Code checks exact source SKU, neck agreement, component category and required evidence.
- Pinned `jev-1.13.0` judges identity, mechanism and finish against supplied descriptions in one request per case.
- Missing, contradictory or uncertain evidence produces `review_required`. A service failure produces `not_evaluated`, and the runner exits nonzero.
- `evidence_aligned` means only that these textual checks agree. It is not physical-fit, visual-alignment, purchase or publication approval. Confidence thresholds are provisional, not measured probabilities of correctness.
- A shared roller cap cannot establish whether the roller ball is metal or plastic. Exact assembly evidence remains necessary.

## Running and extending

Dry-run with no API call:

```sh
node --import tsx scripts/audit-jev-reconciliation.mts
```

Live advisory review using an existing `TYPESAFE_API_KEY`:

```sh
node --import tsx scripts/audit-jev-reconciliation.mts --run
```

The existing Grace Jev GitHub workflow also runs this as a separate job using its already configured TypeSafe secret. It receives no Convex or media write credentials. Reports and raw validated judgments are uploaded as the `jev-reconciliation-report` artifact. A successful job means the service responded, not that every catalog case passed; read `report.json` and the review findings.

Additional reviewed fixtures use `--input=path.json`. Calls default to at most 32 cases; larger runs need an explicit `--limit=N`. Each result is cached by the complete evidence, rubric and pinned model hash; `--fresh` bypasses the cache. Every audit input must retain source provenance and use the exported schema.

Resolve flags against exact Convex records and bestbottles.com evidence before proposing corrections. Keep rendered geometry, cap sidecars, dip tubes, scale and layer placement in the separate artwork/visual checks. Expand coverage after examining this pilot's false alignments and false holds.

## Observed pilot results

The live [GitHub audit run](https://github.com/asalastudio/best-bottles-website/actions/runs/35883302124) completed 22 requests: 12 catalog associations and 10 negative controls, with no service failures. Raw responses are retained in `pilot-live-report.json`.

All 10 controls were held by the combined system, but all 12 real cases were also held. This is **not a claim of 100% detection accuracy**. Several clearly matching finishes had low model confidence, and Jev mistakenly supported the intentionally wrong Round/Circle family claim. Literal family, capacity and glass checks were therefore added in code; the exported queue recomputes those checks against the original responses without spending additional API calls. Confidence-only flags need human review, not automatic catalog changes.

Actual source questions include 5 mL versus legacy 5.5 mL naming, a legacy component SKU alias, a missing short-cap component page, and descriptions that identify the roller cap without establishing the ball material. The CSV distinguishes those from model uncertainty. Do not treat every row as a confirmed defect.

## Stakeholder workflow

`/team/components` is linked as **Components Library** in Team Hub. Staff can search/filter the pilot, inspect exact source text, download CSV, and save a shared decision with supporting evidence. Review history records actor, time and revision. Changed audit evidence resets the review; concurrent saves are rejected rather than overwritten. Local `?preview=1` is read-only and never works as an authentication bypass in production.

For a correction, load the current component list filtered by the bottle's exact neck, search by SKU or familiar terms, select a component, add evidence, and save the proposal. **Submit saved correction to catalog** is a separate deliberate action. It checks the current bottle identity, exact active component SKU, neck, mechanism and revision before writing a SKU-scoped correction in Convex. A complete-assembly witness is not treated as a loose component. Mechanism changes remain proposals requiring catalog clarification. A previous correction can be restored by proposing and submitting its original component again.

Corrections run after legacy/sibling/source supplementation, preventing stale links from being reintroduced. Matrix, PDP and Grace's `getBottleComponents` use the same corrected pool. Builder finish selection also honors the explicit correction. Submissions invalidate the builder cache; Grace reads live tool data, so no retraining or per-correction code redeploy is required after this feature is deployed. This does not update arbitrary narrative knowledge documents, regenerate artwork, create a new sellable assembly, or change Shopify inventory.

The shared synonym list powers the component picker and Grace's Jev intent instructions. Synonyms aid discovery; they do not establish physical fit. Neck equality is necessary but not sufficient, particularly for occupied roller mouths and bulb/tassel versus fine-mist mechanisms.

CSV export is a review handoff, not an unvalidated bulk import. Apply corrections through the authenticated Team Hub controls. `stakeholder-findings.csv` contains the 12 real pilot rows; synthetic controls are excluded.

To prepare the next queue snapshot from a completed audit, with hash checks against its exact input:

```sh
node --import tsx scripts/export-component-review.mts \
  --input=data/reconciliation/jev-pilot.json \
  --report=output/jev-reconciliation/report.json \
  --snapshot=convex/component-reconciliation-snapshot.json
```

The initial queue is a versioned snapshot, not a scheduled full-catalog scanner. Publishing a new audit snapshot is a release; ordinary review decisions and submitted corrections are live Convex data. The feature still needs frontend/Convex deployment and a signed-in staging check. No live catalog correction was applied during development.

## Validation for this implementation

235 test files / 2,158 tests passed; 7 tests skipped. This includes all 925 Matrix/PDP parity checks and the new shared-review/submission tests. TypeScript, targeted lint and production Webpack build passed. The local Components Library returned HTTP 200 and its evidence/review layout was inspected in the browser. Authenticated shared saves and submissions were exercised in the isolated Convex test database, not the live backend.
