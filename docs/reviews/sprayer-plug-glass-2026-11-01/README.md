# Clear sprayer plug transmission

The clear Tulip 6 ml and Sleek 8 ml sprayer chambers still looked pasted onto the glass after the earlier layer-order correction. Their broad plastic chambers had too much contrast at the existing 40% seated tube opacity.

A shared CSS alpha gradient now softens the chamber separately. Its endpoint comes from the existing 376-pixel mechanism section in each registered source. The narrow shaft retains its current opacity, bend, length and trimmed endpoint. Glass reflections remain above the internal part. This is a compositing treatment using the existing images, not a new physically simulated refraction render.

The correction covers seven clear Tulip 6 ml finishes and eight clear Sleek 8 ml finishes. Catalog SVGs, product-page image layers and builder SVGs use the same helper. HTML and SVG masks use each image's own bounds, including the prefixed mask property for WebKit. Exploded parts retain their natural plastic appearance. Source filenames guard the treatment so a future unregistered replacement cannot silently inherit this mask.

No master image pixels, approved recipe values, dimensions, anchors, cap positions, sizing targets, prices or inventory records changed. The shared manifest remains at version 4c6095d23d920c4f with 456 recipes. The separate Sleek glass-material candidate remains local and unapproved. Amber, frosted, lotion-pump and roller treatments are unchanged.

Validation: 3,263 tests passed with 7 skipped; typecheck and scoped lint passed. Browser QA covered 25 product-page states, 30 catalog finish selections and four builder pages across desktop and mobile. Sidecar and cap-on soften the seated plug; exploded has no mask. Before/after checks preserve image URLs and bounding boxes. Additional pixel comparisons verify that SVG masks change the chamber while leaving the narrow shaft unchanged. The paint check allows up to three RGB levels of raster rounding only on the final fractional scanline of an SVG image; it records those pixels separately.

Open comparison.html for the full bottles at product-page size. verification.json records the main browser pass; paint-verification.json records actual SVG paint checks. The source, mask rules and snapshots are preserved in this folder and the Best Bottles Drive review archive. The change is prepared in PR #388 and has not been merged or deployed.

The full capture set and fifteen recipe snapshots are stored in the verified Drive ZIP. Git retains four before/after product-size captures and the verification records. Additional screenshots can be reproduced with verify.cjs.
