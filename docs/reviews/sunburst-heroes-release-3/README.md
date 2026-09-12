# Sunburst 2.5 heroes — release 3 (re-settled placement)

Jordan reviewed the re-settle card (`r7-resettle-approved-2026-09-11`, 44 images)
on 2026-09-12 and approved 42, rejecting 2. Each approval belongs to the exact
image version shown, recorded by sha256 in `approved-lock.json`.

**35 of the 42 are indexed here.** The other seven are approved and locked but
have no catalog registry row yet, so they cannot be indexed without inventing
identity — see below.

## What these images are

The same renders that were already approved, moved. Nothing was re-rendered,
re-scaled, or re-shadowed: each image is its approved predecessor translated so
the product's foot sits on the 1562 baseline and the product group is centred at
x=780. The placement step that does this did not exist when these 44 were first
approved, so they carried up to 48 px of horizontal drift (`GBBstn1ozBlkCapSht`)
and up to 34 px of vertical drift (`GBMtlMrblLarge`).

Because an approval binds to exact bytes, a moved image is a new image with a new
hash, which is why they went back on a card for a fresh visual approval before
being indexed here.

## What moved

| | |
|---|---|
| Registry rows repointed | 35 (`src/lib/products/catalog-heroes.json`) |
| Release manifest rows updated | 35 (`docs/reviews/catalog-complete-hero-release-2026-09-07.json`) |
| New image files | 35 under `public/images/catalog/bone-review/`, named `<sku>.<sha256[0:12]>.png` |
| Families | Boston Round 15, Atomizer 11, Decorative 4, Bell 2, Tool 1, Vial 1, Apothecary 1 |

The registry and the manifest have to move together: `tests/catalog-approved-heroes.test.ts`
hashes the bytes behind every registry url against the manifest entry. That test
passes at 396 assertions with this change.

Framing is identity (`scale 1`, no translate) for these rows. The sized Sunburst
images already carry the 91 % baseline and the centring in their pixels, so the
shared catalogue nudge must not be applied on top of them.

## Checks before writing

Per image: bytes hashed against the approved hash, 1560×1716, and all four
corners exactly bone `[245, 243, 239]`. Nothing is written if any check fails.

## The two rejected images

`GBMtlMrblLarge` and `GBMtlMrblSmall` keep the bytes approved on
`sunburst-all-heroes-latest-2026-09-09-r4`, which are what the registry already
points at. Nothing about them changes in this release.

Both are a bottle standing upright with a glass pipette lying in front of it. In
the render the pipette reaches lower than the bottle's own foot — 207 px lower on
the large, 122 px on the small — so no translation can put both the bottle and
the pipette on the baseline at once. Seating the group on the pipette leaves the
bottle visibly floating, which is what Jordan rejected; seating it on the bottle
would push the pipette off the bottom of the canvas. This needs a re-render that
lays the pipette on the same ground plane as the bottle, not a placement fix.

## The seven awaiting registry rows

`GBBell10RollBlkDot`, `GBBstn1ozRollonShBlk`, `GBBstn2ozMtlRollGl`,
`GBBstnAmb1ozRollonMattGl`, `GBBstnAmb2ozRollonMattGl`,
`GBBstnBlu1ozRollonMattBlk`, `GBBstnBlu2ozRollonMattGl`.

These are roll-ons from product groups that had no hero at all, so no registry
row exists for them. A row carries `groupSlug`, `graceSku` and
`shopifyVariantId` — real identity that must be read from Convex and Shopify,
never inferred from a SKU string. Adding those rows is a separate change; it is
the same seven named in release 2.

`GBBstn1ozRollonShBlk` also still shows its bottle floating above its cap, which
is a render fault rather than a placement one.

## Four open sizing requests

Four approvals carry a saved target height that has NOT been acted on here, and
is recorded on the lock entry as `sizingRequest`:

| SKU | height today | target saved | siblings at that capacity |
|---|---|---|---|
| `GBBstn1ozBlkCapSht` | 53.3 % | 42.5 % | 12 rows, median 60.6 % |
| `GBBstn1ozRollonShBlk` | 62.5 % | 42.5 % | 12 rows, median 60.6 % |
| `GBBstn2ozBlkCapSht` | 65.0 % | 51.5 % | 12 rows, median 74.6 % |
| `GBBstn2ozBlkDrprShnGlTrim` | 78.0 % | 51.5 % | 12 rows, median 74.6 % |

Applying them would make each of these the smallest bottle in its capacity by a
wide margin, which runs against the stated goal of one size per body. They are
left unapplied and flagged rather than guessed at. This release changes placement
only.

## Scope

This is an indexing step. It touches no Shopify media, no Convex rows and no
hosted assets. Visual approval is not technical clearance, and nothing here
publishes or indexes anything beyond the catalogue registry the storefront reads.
