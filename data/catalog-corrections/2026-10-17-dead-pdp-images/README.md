# Dead product images on 15 pages (17 Oct 2026)

The 17 Oct browser sweep of all 347 product pages found 15 whose main image answers HTTP 404. Each one is
`products.imageUrl` pointing at a Shopify file Shopify has since deleted. Nothing has been written yet:
Jordan approves the images and the run separately.

| File | What it is |
|---|---|
| `plan.json` | Per SKU: old URL → new URL, the plate it comes from (id, family, sha256, what it was built from), the old-site photo used as an identity check, and which page shows it first. Also lists every member of the 15 pages and the one held SKU. |
| `rollback.json` | The values the 43 rows held on 17 Oct before any change. |
| `contact-sheet.jpg` | One card per SKU: the old bestbottles.com photo of that SKU (reference only) beside the plate that will be written. A red tab marks the variant each page shows first. |

## Where the dead URL shows

`products.imageUrl` of the page's primary variant feeds `og:image`, the Product JSON-LD `image`, the stage's photo
fallback and the gallery, which requests it through `/_next/image` and gets a 404. `productGroups.heroImageUrl` is
empty on all 15 groups. No product on these pages has an `imageUrlCapOff`. The stage itself already draws each
SKU's plate, so customers see the product; the broken request, metadata, variant tiles and cart image are what
this fixes.

## Where the replacements come from

1. **Shopify's current media:** none. All 44 variants and their products return no variant image, no variant
   media and no product media (Admin GraphQL, read-only).
2. **The SKU's own plate in `productPlates`:** 43 of 44. Each is a distinct file built from that SKU's master PSD
   (or, for 10, from its own old-site photo). None is shared or borrowed from another SKU. These are the images
   the product-page stage already shows. Two rows, GBAtom5Sl and GBAtom5SlimSl (different bottles), shared one dead
   URL; each now gets its own plate.
3. **The old-site photo:** shown on the contact sheet only, to check identity. The product page filters out
   `www.bestbottles.com/images/store` URLs, so writing one would show nothing.

The old value moves to `legacyShopifyImageUrl`, as `promotePlateImagery` (convex/productPlates.ts) does.

## Held: no trustworthy replacement

- **CJBlu3** (3 ml blue cream jar), the variant **/products/cream-jar-3ml-mixed** shows first. It has no plate, no
  kit and no Shopify media. The only real photo is
  `https://www.bestbottles.com/images/store/enlarged_pics/CJBlu3.gif`, which the product page blocks and PR #370
  does not mirror. After the plan the page's other jar (CJClr3) is fixed, but this page's `og:image` and JSON-LD
  still name the dead file until CJBlu3 gets a plate from its master PSD, or Jordan approves another source.

## Running it

Needs the `catalogCorrections` change from this PR on production first, which happens when the PR merges (the
production build deploys Convex). Then:

```bash
node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod                     # dry run
node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod --apply             # write
node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod --rollback --apply  # undo
```

The script stops with nothing written if any row no longer holds the plan's old value, and checks that each
plate still answers 200 with the bytes recorded here. Product pages are rendered per request, so the change
shows at once.

Rebuild the sheet with `python3 scripts/catalog-corrections/2026-10-17-dead-pdp-images-sheet.py <cache-dir>`.
