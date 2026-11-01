# Approved hosted masters and Tulip regrouping

The approved release contains 267 exact configurations: Cylinder 5 ml (71), Cylinder 9 ml / 17-415 (145), and Tulip clear/amber sprayers and rollers (51). The 68 shared image files are immutable, content-addressed objects in the existing Best Bottles Vercel Blob store. `asset-receipt.json` records a successful public GET digest check for each file. The website does not need the Blob upload credential. Raster layers use display-sized quality-90 derivatives; registered SVG envelopes remain direct, preserving their exact alpha contours.

`approved-kits.generated.json` supplies the same recipe to product pages, catalog previews and the builder. A small index enables catalog selection without putting the recipe library in client JavaScript. Local candidate loaders remain disabled on hosted deployments. The broader remaining 13-415 batch and small sprayer candidates are not included in this release.

Tulip now belongs to the Cylinder storefront group. Clear 6 ml and amber 5 ml retain their Tulip shape labels, body IDs, product slugs, SKUs, registration and scale. Catalog family filters combine the two source families before pagination. Old Tulip family links resolve to Cylinder. Builder family entry, options and purchase validation read both source families; compatibility is resolved using original source records before display regrouping. No Convex or Shopify records are changed.

The local browser check confirms 36 amber and 34 clear builder configurations remain available through either family entry, and both existing product URLs produce Cylinder builder links carrying the exact selected SKU. The hosted release promotes the approved sprayer/roller subset only; other configurations retain their existing published media.

Release gates: typecheck, lint, regression suite, exact-commit hosted build, hosted media/PDP/catalog/builder verification and user merge approval. A successful local check or asset upload is not a deployment or merge. Hosted verification evidence will be saved here after the preview build completes.

No previous source assets were deleted. Generated sources and approved masters remain archived in the Best Bottles Drive library under the earlier batch receipts.
