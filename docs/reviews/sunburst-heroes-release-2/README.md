# Sunburst 2.5 heroes — release 2 (Boston Round)

Jordan reviewed the Boston Round family card
(`r5-boston-round-2026-09-10`, 29 images) on 2026-09-11 and approved all 29,
with no notes and no target-height changes. Each approval belongs to the exact
image version shown, recorded by sha256 in `approved-lock.json`.

**23 of the 29 are indexed here.** The other six are approved and locked but
have no catalog registry row yet, so they cannot be indexed without inventing
identity — see below.

## What moved

| | |
|---|---|
| Registry rows repointed | 23 (`src/lib/products/catalog-heroes.json`) |
| Release manifest rows updated | 23 (`docs/reviews/catalog-complete-hero-release-2026-09-07.json`) |
| New image files | 23 under `public/images/catalog/bone-review/`, named `<sku>.<sha256[0:12]>.png` |
| Family | Boston Round (clear, amber, cobalt — shortcap, dropper, roll-on) |

The registry and the manifest have to move together: `tests/catalog-approved-heroes.test.ts`
hashes the bytes behind every registry url against the manifest entry. That test
passes at 396 assertions with this change.

Framing is identity (`scale 1`, no translate) for these rows. The sized Sunburst
images already carry the 91 % baseline and the centring in their pixels, so the
shared catalogue nudge must not be applied on top of them.

## Checks before writing

Per image: bytes hashed against the approved hash, 1560×1716, and all four
corners exactly bone `[245, 243, 239]`. Nothing is written if any check fails.

All 23 indexed images also passed the lane's own geometry gate and the locked
shadow check. The two measured exceptions on the card are both among the six
that are *not* indexed:

- `GBBstn2ozMtlRollGl` — geometry gate FAIL (base +19 px, left −11 px).
- `GBBstn1ozRollonShBlk` — shadow outside the locked spec (contact 6, reads as floating).

Jordan approved both visually; they stay out of the registry until they have rows,
so the measurements can be addressed first.

## The six awaiting registry rows

`GBBstn1ozRollonShBlk`, `GBBstn2ozMtlRollGl`, `GBBstnAmb1ozRollonMattGl`,
`GBBstnAmb2ozRollonMattGl`, `GBBstnBlu1ozRollonMattBlk`, `GBBstnBlu2ozRollonMattGl`.

These are the Boston Round roll-ons from the product groups that had no hero at
all, so no registry row exists for them. A row carries `groupSlug`, `graceSku`
and `shopifyVariantId` — real identity that must be read from Convex and
Shopify, never inferred from a SKU string. Adding those rows is a separate
change. `GBBell10RollBlkDot` from release 1 is in the same position.

## Scope

This is an indexing step. It touches no Shopify media, no Convex rows and no
hosted assets. Visual approval is not technical clearance, and nothing here
publishes or indexes anything beyond the catalogue registry the storefront reads.

## Rollback

`registry-rollback.json` holds every replaced url, manifest hash and framing
value. Restoring those undoes this release. Reproduce with
`node scripts/publish-sunburst-heroes.mjs release-2`.
