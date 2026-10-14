# Drawing stack reconciliation — 13 October 2026

Source review of open PRs #341 → #342 → #343 is complete for the exact CSV deltas. **No PR was merged and no asset/data release was performed.**

| PR | Exact head | Newly resolved assembly records | New parts | Source-only integration |
| --- | --- | ---: | ---: | --- |
| #341 white pump / Empire tubes | 8323982ec37787e692ad33619ed59bd0c88f4d2f | 9 | 1 | No textual conflicts |
| #342 Minaret caps | ad23f3285f321ff006319b652a5a0324ec759d4d | 10 | 2 | No textual conflicts |
| #343 Diva rings | a12f432f34cb85c6cb7e81ea825f662d8f5a1217 | 10 | 4 | No textual conflicts |

This verifies the historical **seven parts / 29 builds** claim at the PR source level. **26** of these exact SKUs are offered in the previously saved Builder census. All 29 lack a renderable assembly in the saved production stage snapshot; this is not a fresh live UI check.

The other three are in-stock/sellable catalogue records in that snapshot:

- GBElg15MinarSl — Clear Elegant15, shiny silver Minaret.
- GBElgFrst15MinarCu — Frosted Elegant15, matte copper Minaret.
- GBElgFrst15MinarSl — Frosted Elegant15, shiny silver Minaret.

Subsequent offline diagnosis confirms identity and eligibility pass for all three, but the saved media lacks any exact assembly plate, legacy kit or renderable register path. See PDP-RECOVERY-REVIEW.md. They must not be classified as retired or deliberately outside Builder.

## Integration evidence

Git merge-tree simulated each PR against local media commit a1d7b68a. This creates temporary Git objects, not a branch merge or index/worktree change. The combined #343 tree (which includes #341/#342) was extracted into an isolated evidence fixture. **73 targeted tests passed across ten files**, covering register rows/composition, ring exploded behavior, detached overcaps, Builder loading, PDP controls/model/DOM.

The first test run had five failures caused by omitted fixture files (messages and the committed overcap image). Those files were restored from the same simulated tree; the source was not altered to make tests pass. Both logs are preserved. No full CI build, browser, or visual acceptance is claimed.

## Asset lineage and outstanding gates

All seven new components have branch measurement records with layer dimensions, anchors, and declared hashes. The exact branch records are saved in components.json. Original PSD layers have not been reopened and extracted layer hashes have not been freshly recertified. The Minaret silver record names a historical generation model; it is source-record provenance, not a newly verified model call or geometry approval.

Exact assembly CSV changes understate the full QA scope: shared renderer changes and Empire tube changes may also affect already-resolved assemblies. These need complete family/contact-sheet and browser matrices before release. The three Elegant15 scope cases remain open. The master drive is still unavailable; browser permission has not been restored.

## Evidence

- evidence/drawing-stack/prs.json — current PR metadata, bases, heads and existing CI states.
- evidence/drawing-stack/assemblies.csv — exact 29 SKU changes, before/after parts, current local and saved-production states.
- evidence/drawing-stack/components.json — exact seven new parts and measured source lineage.
- evidence/drawing-stack/integration-tests.log — 73 passing source integration tests.
- evidence/drawing-stack/validation.json — scope/identity joins.

These results reduce reconstruction work and establish a concrete release review scope. They do not authorize merging the stack or importing its data.

Evidence root: `/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12`

## Later 13 October update: four tassel ring combinations

The archive drive is accessible. Reopened all four exact tassel masters and recovered their own ring crops with hashes and measured registration. These supersede the earlier plain-bulb ring sources for this local four-SKU slice. Integrated four development-only assemblies and selectively recovered ring renderer rules; the PR stack was not merged. The other six ring builds remain separate. See [DIVA-RINGS-LOCAL.md](DIVA-RINGS-LOCAL.md) for the current evidence and pending browser/owner/release gates.
