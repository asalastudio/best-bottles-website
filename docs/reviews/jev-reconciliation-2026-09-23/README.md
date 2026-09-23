# Jev reconciliation pilot

Jev reviews whether the exact public catalog descriptions support the bottle and proposed hardware shown by the builder. This is an advisory, offline evidence audit shared with PDP reconciliation; it does not run during customer requests and cannot change catalog, inventory, media, or checkout records.

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
