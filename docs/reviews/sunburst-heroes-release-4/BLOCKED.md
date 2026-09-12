# Release 4 (Circle) — built, NOT shipped

28 Circle heroes are approved and locked by hash. The publish step repoints 27 of
them cleanly (the 28th, `GBCrcl15RollBlkSh`, has no registry row yet). It is not
committed because it breaks a guard that encodes an earlier approval, and that
needs a decision rather than a weakened test.

## What breaks

`tests/catalog-approved-heroes.test.ts` fails 7 of 396 assertions.

**Five are cosmetic and already handled.** The corner-bone check demanded the
plate be *exactly* `[245,243,239]`; the enhancement pass returns its own plate
reconstructed one unit away, e.g. `[245,243,240]`. `scripts/publish-sunburst-heroes.mjs`
now allows 2/255, which still catches a genuinely wrong background (white,
transparent, another plate) since those are off by tens. The test asserts exact
bone in the same way and would need the same tolerance.

**Two are real.** The manifest carries a `circleRevision` block: 27 Circle rows
whose *framing* (`scale`, `translateYPercent`) positions the original photograph
so the glass shoulder lands on a saved target — 37 % at 15 ml, 43 % at 30 ml,
47 % at 50 ml, 54 % at 100 ml — with the base on the 91 % baseline.

The approved Sunburst heroes carry their geometry **in their pixels**: Jordan's
size targets, the foot on 1562, the group centred at x=780. They are published
with identity framing, because the shared framing nudge must not be applied on
top of an image that is already placed. Repointing those 27 rows therefore drops
the framing the `circleRevision` test is asserting, and the shoulder maths gives
45.45 % where it expects 47 %.

## The decision

Both systems are "approved", at different times, and they cannot both apply:

1. **The new images win.** `circleRevision` described how to frame the *old*
   photographs and is obsolete for any row replaced by an approved Sunburst
   hero. The test should assert it only for rows still using that framing.
2. **The old targets win.** The new images should be re-sized so the glass
   shoulder lands on the saved per-capacity target, and go back for approval.

Option 1 matches what Jordan actually reviewed: he set the Circle heights
himself on `r6-circle-settled-2026-09-11` and approved the result. Option 2 would
override those clicks with a rule saved earlier.

Nothing is shipped either way until that is settled.

## Preserved here

`approved-lock-all-90.json` — all 90 approvals to date by sha256 and originating
card, with the scratch file paths stripped because they do not survive a session.
The bytes live in the review-library cards, so `lock_card.py <scratch> <card...>`
rebuilds the lock from `sunburst-all-heroes-latest-2026-09-09-r4`,
`r5-boston-round-2026-09-10`, `r7-resettle-approved-2026-09-11`,
`r6-circle-settled-2026-09-11`, `r10-circle-frost-2026-09-12` and
`r11-circle-frost-resize-2026-09-12`, newest last.
