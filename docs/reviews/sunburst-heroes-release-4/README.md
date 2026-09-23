# Sunburst 2.5 heroes — release 4 (Circle)

Jordan reviewed the Circle family across three cards and approved 28 images:
21 on `r6-circle-settled-2026-09-11` (his own size targets, drift removed),
6 on `r10-circle-frost-2026-09-12` (frosted, re-rendered with the two-line
prompt), and 1 on `r11-circle-frost-resize-2026-09-12` (the reducer bottle,
scaled to match its twin's glass). Each approval belongs to the exact image
version shown, recorded by sha256 in `approved-lock.json`.

**27 of the 28 are indexed here.** `GBCrcl15RollBlkSh` is approved and locked but
has no catalog registry row yet, so it cannot be indexed without inventing
identity.

## What moved

| | |
|---|---|
| Registry rows repointed | 27 (`src/lib/products/catalog-heroes.json`) |
| Release manifest rows updated | 27 (`docs/reviews/catalog-complete-hero-release-2026-09-07.json`) |
| New image files | 27 under `public/images/catalog/bone-review/` |
| Family | Circle (clear and frosted; droppers, sprayers, roll-ons, atomisers, lotion pumps, reducers) |

## The guard change this needed, and why

Two rules both claimed these rows, and they cannot both apply.

`docs/reviews/circle-recovery/alignment-and-matte-report.json` records a *framing*
for 27 Circle rows — a `scale` and `translateYPercent` that position the original
photograph so the glass shoulder lands on a saved per-capacity target (37 % at
15 ml, 43 % at 30 ml, 47 % at 50 ml, 54 % at 100 ml).

An approved Sunburst hero carries that geometry **in its own pixels**: Jordan's
size target, the foot on the 1562 baseline, the group centred at x=780. It is
published with identity framing, because the shared nudge must not be applied on
top of an image that is already placed.

Jordan's decision, 2026-09-12: **the new images win.** He set the Circle heights
himself and approved the result; the older record describes how to frame
photographs we have now replaced.

`tests/catalog-approved-heroes.test.ts` therefore checks each row against
whichever approval actually describes the bytes on disk. A row whose file hash
matches a release lock is asserted against that lock and required to carry
identity framing; every other row is still asserted against the older per-family
record exactly as before. No row is exempted — each is checked against one
approval or the other. The test passes at 396 assertions both before and after
this release is applied.

The corner-bone check was also relaxed from exact `[245,243,239]` to within
2/255, in the test and in `scripts/publish-sunburst-heroes.mjs`. The enhancement
pass reconstructs its own plate a unit away; a genuinely wrong background —
white, transparent, another plate — is off by tens and still fails.

## Checks before writing

Per image: bytes hashed against the approved hash, 1560×1716, and four corners
bone within 2/255. Nothing is written if any check fails.

## Scope

An indexing step. No Shopify media, no Convex rows, no hosted assets. Visual
approval is not technical clearance.
