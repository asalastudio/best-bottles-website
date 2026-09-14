# Best Bottles plate-lane handoff — 2026-09-13

This handoff is for the next agent continuing the Best Bottles plate lane. It
records verified state only. It does not authorize a Convex mutation, upload,
indexing, publication, merge, or deployment.

## Skill to use

Use the exact skill:

`bestbottles-plate-kit-lane`

Source:

`/Users/jordanrichter/.codex/skills/bestbottles-plate-kit-lane/SKILL.md`

The project map is:

`docs/CODEX_HANDOFF_PLATES_KITS_HEROES.md`

Read both files in full before changing anything. The plate skill is the
authority for family scope, exact SKU identity, master PSD lineage, cap-off
handling, review gates, and publication invariants.

## Checkout

- Worktree: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/threejs-blender-render-location-96d90c`
- Branch: `claude/ledger-plate-states-2026-09-12`
- Current HEAD: `ed76959a` (`feat: add Best Bottles header wordmark`)
- The worktree is already dirty from the ongoing project. Preserve unrelated
  changes. Never commit `.claude/launch.json`.

## Current ledger snapshot

The last successful ledger build is timestamped `2026-09-13T23:15:55.481Z`.
The required refresh has not completed because the configured Convex host is
currently unresolvable (`ENOTFOUND helpful-elephant-638.convex.cloud`). Do not
claim that a refresh happened until the two required commands finish.

The plate plan in that snapshot is:

- 2,183 active plate-applicable rows
- 1,350 complete
- 316 ready for visual review
- 294 needing technical/source reconciliation
- 223 needing a new plate
- 833 active rows still outstanding (316 + 294 + 223)

The other 224 catalog rows are not plate-applicable. Retired and review-only
records remain preserved for audit and are not active plate work.

Raw all-row plate states in the snapshot are:

- `plated`: 1,001
- `plated-no-capoff-by-design`: 671
- `plated-approved-legacy-source`: 27
- `plated-legacy-source`: 210
- `plated-wrong-size`: 28
- `plated-cap-on-only`: 23
- `none`: 388
- `not-applicable`: 224

These raw states are not a publication receipt. A row is complete only when
the ledger's plate plan says it is complete and the relevant hosted/indexed
verification has passed.

## Tulip approval just recorded

Jordan explicitly approved the Tulip plates after reviewing the amber and clear
same-zoom cap-on/cap-off packets. The exact-byte approval lock is:

`docs/reviews/tulip-plate-release-2026-09-13/approved-lock.json`

Approval record:

`docs/reviews/tulip-plate-release-2026-09-13/approval.json`

It covers 59 pairs (30 amber 5 mL and 29 clear 6 mL), with 177 hash-bound
views. All 118 PSD source files resolve under `BB-PSD-Files-Master`.

The one clear SKU below remains an explicit hold because the source audit found
no exact PSD candidate in either the capped or uncapped clear Tulip folder:

`GBTulip6BlkShSht` — `match:no-psd`

This lock is visual approval only. `indexingAuthorized` and
`publicationAuthorized` are both `false`. A new render must receive a new
review packet and new hashes. No Tulip ship instruction has been recorded.

Review packets:

- `docs/reviews/tulip-amber-capoff-recovery-2026-09-13/index.html`
- `docs/reviews/tulip-clear-capoff-recovery-2026-09-13/index.html`

## Required first command

Run these in this order from the checkout:

```bash
PATH=/opt/homebrew/bin:$PATH python3 scripts/asset-ledger/measure-plates.py && npm run ledger:build
```

The measurement step reads the live Convex plate index and writes
`src/lib/asset-ledger/plate-geometry.json`; the build then writes the ledger.
If Convex cannot be resolved, stop and report the error. Do not use
`ASSET_LEDGER_SKIP_CONVEX=1` to manufacture a “refreshed” production-like
ledger, and do not manually mark rows complete.

## Next work order

Continue the handoff's order of work, one family at a time:

1. Keep the grouping fix in `scripts/paperdoll/build_plates.py` keyed by
   `familyId` alone and verify the ledger movement.
2. Rebuild legacy-sourced plates from the master PSD source.
3. Resolve real cap-off gaps with exact capped/uncapped pairs.
4. Acquire and prepare rows in the 223 missing-plate queue.
5. Process the 316 visual-review and 294 technical-reconciliation rows in
   reviewable family batches. Use exact catalog identity; never infer identity
   from a SKU or filename.
6. Only after plate indexing is verified, return to kits. Heroes remain a
   separate lane.

After every step, rerun the two required commands and compare the counts with
the predicted movement. If they do not move as predicted, stop and diagnose.

## Non-negotiable rules

- The only PSD source is `/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master`.
- Legacy pages and exact option evidence can establish catalog identity and
  source recovery; a failed filename match is not proof of missing artwork.
- Never infer product identity from a SKU string or filename.
- Never fabricate a component. A flat image is not automatically a kit.
- Code never touches shadows. Preserve original assembly and geometry; only
  use approved uniform scale/position and background correction.
- Preserve exact source bytes, source paths, and SHA-256 values. A re-render is
  a new review card and a new approval.
- Keep visual approval, technical clearance, indexing, publication, merge, and
  deployment as separate states.
- Nothing is published without Jordan's exact release-specific `ship`
  instruction. A visual “approved” message is not publication authorization.
- Preserve unrelated dirty worktree changes and never commit `.claude/launch.json`.

## Validation already completed

- Tulip lock script passed: 59 rows, 177 views, 1 explicit hold.
- All 118 Tulip master PSD paths resolve.
- SHA-256 and row metadata validation passed.
- `node --check scripts/asset-ledger/lock-tulip-plates.mjs` passed.
- `python3 -m py_compile` passed for the Tulip review builders.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint -- --no-warn-ignored` passed with 0 errors and pre-existing
  warnings.

The most recent network retry was rejected by automatic approval review after
the account hit its usage limit. Do not work around that restriction.
