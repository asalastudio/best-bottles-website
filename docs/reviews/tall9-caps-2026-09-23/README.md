# Tall 9 mL screw-cap and builder layout review

Local review: `http://localhost:3070/matrix?family=Cylinder`.
Select 9 mL / 13-415, Clear or Frosted, then Screw Cap.

## Corrected associations

Both glass finishes have ten existing, published cap-split image kits: six short
smooth lined caps, two short ribbed caps, and two tall regular caps. Sixteen exact
assembled SKUs were added to the included-assembly registry to recover the smooth
short and tall choices. Existing stock, Shopify variant, price, exact SKU, material,
and neck checks remain in place. This does not create new loose-component matches.

The cap list groups the six short smooth finishes first, ribbed black/white next,
then tall shiny gold/silver. Desktop and mobile explain that smooth short and tall
caps include liners. Tall Regular Shiny Gold retains its requested name.

Evidence: Convex catalog rows and all twenty published kits were read on
2026-09-23. Exact short-cap links already exist in
`convex/catalog-component-links.json` and
`docs/data-audit/cylinder-release-2026-09-04/short-caps-sources.json`.
The live legacy page for
https://www.bestbottles.com/product/tall-cylinder-design-9-ml-frosted-glass-bottle-shiny-gold-cap
was checked on the same date: GBTallCylFrst9Gl, 9 mL, 13-415, and all ten cap options.

## Image repair

Six frosted short-cap body layers had an exterior white rectangle. Local lossless
derivatives remove only exterior-connected near-white matte below pixel Y=300;
neck highlights, enclosed frosted glass, canvas dimensions, and placement remain
unchanged. Replacement is restricted to the exact source hash and tall frosted
9 mL / 13-415 identity. Original published images remain intact.

`cleanup-lineage.json` records original URLs, source/output hashes and pixel counts.
`cleanup-inputs.json` preserves the minimal inputs. To reproduce, download each
source to a cache directory as `<source SHA256>.webp`, then run:

```sh
python3 scripts/paperdoll/clean_tall9_cap_matte.py \
  --audit docs/reviews/tall9-caps-2026-09-23/cleanup-inputs.json \
  --cache /path/to/source-cache
```

Frosted tall 9 mL dip-tube layers use multiply blending to suppress the white matte
edge. The bottle, sprayer and metal cap remain opaque.

## Verification and release status

- 76 focused tests passed; TypeScript passed.
- Local browser: all ten frosted cap names, order and thumbnails checked; short
  shiny black preview has no white rectangle; shiny gold sprayer tube checked.
- Phone-sized browser exposes the same ten choices and liner explanation.
- Wider desktop choices and narrower canvas are a review prototype. Back and Review
  remain visible while the cap list scrolls independently at 1280 x 720.
- Local implementation only. No Convex production deployment or production image
  replacement was performed. Cart checkout was not exercised in this pass.
- PR #243 conflicts were resolved separately and pushed; its CI and Vercel checks
  were green. These additional cap/layout changes are not part of PR #243.
