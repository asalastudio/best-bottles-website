# Four-family closeout — September 23, 2026

Jordan confirmed Empire and Round have been verified. Retain their approval;
this follow-up does not reopen their image review or alter any approved heroes.
The approved hero release was merged in PR #228. Component reconciliation is
tracked separately in PR #235.

## Circle publication support

The publisher now accepts explicit `operation: insert` only when both scoped
before-image sets show absence. It never infers insertion from a missing backup.
The six short caps, as well as the nine frosted tassels, have no existing exact
index entries in the preserved snapshot. Both batches therefore use insertion.

`convex/nativeMediaRelease.ts` adds:

- A read-only pre-upload check covering SKU, website-SKU and Grace-SKU aliases,
  including orphan kits hidden by the normal storefront plate-hash guard.
- An authenticated atomic insertion of the matching plate and kit. The server
  rechecks exact catalog identity and index absence inside the transaction.
- An authenticated atomic rollback to absence, comparing all release content
  before removing either index row. A changed or partial pair is refused.
  Stored images, master sources, products, Shopify data and heroes are untouched.

The existing update/recovery path remains available for older releases with full
before-images. New-insert rollback restores absence instead of leaving an orphan
kit behind. Exact matching insert/rollback requests are retry-safe at the API
boundary. If a multi-SKU publisher run is interrupted, preserve its payload and
receipts; roll it back before preparing a new complete run.

### Read-only preflights

| Batch | SKUs | Content-addressed assets | Hashed source files |
| --- | ---: | ---: | ---: |
| Frosted Circle 50 mL tassels | 9 | 53 | 9 |
| Circle 15 mL short caps | 6 | 31 | 12 |

Both preflights passed source/identity/part hashes, alpha/canvas and the existing
public plate/kit absence checks. Both exited with status 2, **not clearance**:
the new backend insertion-index check is unavailable on the current target.
`readyToApply` is false in each preflight receipt. An unavailable query is never
interpreted as proof of absence, and `--apply` fails before upload in this state.

The scoped Blob write token and Convex write token are absent from this checkout.
No upload, publication, rollback, backend deployment or website deployment was
performed. Do not fetch the full production environment as a workaround.

After reviewing/deploying an aligned Convex backend and providing scoped release
credentials through the approved environment, rerun both dry-runs. Only proceed
to `--apply` when the entire preflight passes:

```sh
node scripts/paperdoll/publish-native-recovery.mjs \
  --release docs/reviews/builder-pdp-reconciliation-2026-09-23/frosted-circle-release \
  --target https://precise-raccoon-123.convex.cloud
node scripts/paperdoll/publish-native-recovery.mjs \
  --release docs/reviews/builder-pdp-reconciliation-2026-09-23/circle15-short-cap-release \
  --target https://precise-raccoon-123.convex.cloud
```

Use the same scoped command with `--rollback` to restore absence from its exact
publication payload; no blob deletion is performed. Verify all 15 served pairs
and the actual Builder/PDP behavior after publication.

The separate `GBCrclFrst50RdcrIvyLthr` 18-400 versus 18-415 source conflict remains
held. No neck specification was guessed or changed.

## Colored standard 9 mL Cylinder audit

[Per-SKU ledger](colored9-source-audit/audit-ledger.csv) and
[current public index snapshot](colored9-source-audit/current-indexes.json.gz)
cover all 36 amber, cobalt, frosted and swirl spray/lotion configurations.
The current backend returned all 36 kits, **zero separate dip-tube parts**, and
no non-cap hardware part extending into the lower half of its bottle.
All 137 unique referenced public part files were downloaded and SHA256 verified
for local inspection; their hashes and URLs are retained in the snapshot.

All 72 exact capped/uncapped master PSD candidates were located and read. The
source audit records paths, SHA256, canvas and every layer's visibility, bounds,
opacity and type. The three sheets below show the original source composites,
not repaired or newly approved assets:

- [Original source sheet 1](colored9-source-audit/source-sheet-1.jpg)
- [Original source sheet 2](colored9-source-audit/source-sheet-2.jpg)
- [Original source sheet 3](colored9-source-audit/source-sheet-3.jpg)

Representative body/actuator/collar/cover layers were inspected individually for
all four materials and the treatment-pump actuator. The master compositions do
not supply the missing tube as a standalone part. Five Swirl sources additionally
contain two visible body-sized layers; extraction must preserve their actual
composite and adjustment behavior, rather than blindly selecting one layer.

This is an artwork repair batch, not a catalog-label-only fix. The nine approved
Desktop mechanisms provide source candidates, but placing them through colored
or frosted glass still requires a registered/material-correct composition and
visual review. No generic tube was pasted over opaque glass; no 36-image repair
or publication is claimed. Approved catalog heroes are unchanged.

## Verification

New tests cover authorization, atomic insertion, repeat requests, rollback,
identity/registration mismatch, hidden aliases, and refusal to remove a later
release. Existing publisher guards additionally require explicit absence and
reject out-of-scope rollback payloads. The focused seven-file regression run passed all 21 tests, including the full
925-record Builder/PDP parity replay. TypeScript and targeted ESLint passed.
These local checks do not replace deployment or hosted publication verification.
