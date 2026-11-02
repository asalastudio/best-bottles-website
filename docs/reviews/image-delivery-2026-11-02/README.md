# Product image delivery, PR 388

Approved original masters and the 456 assembly recipes are unchanged. Display copies live at immutable, content-addressed URLs in the existing Best Bottles Blob store. No image binaries were added to the application repository.

## Delivery changes

- 119 source images, including Tola and the cleaned 25 ml copper overcap, have lossless WebP copies at 128, 256, 640 and 1200 pixel width, without enlarging a source.
- All 476 encodes preserve every alpha value and every visible RGB value of their resized reference raster. Display delivery does not change geometry, crop, aspect ratio, masks or stage anchors.
- Full-library source bytes: 85,578,313. The complete display sets total 2,319,006 bytes at 128, 6,661,048 at 256, 24,673,590 at 640 and 43,242,756 at 1200. These are whole-library totals, not a single page payload.
- 85 local working URLs reuse a delivery copy only after full SHA-256 equality with an approved source. Unapproved material candidates remain separate.
- PDP images use responsive resolution, selected-assembly preloads and high fetch priority. Closure rails and component strips use smaller, lazy images. Catalog images are fetched near the viewport and sized for the rendered part and device pixel ratio. Builder thumbnails and expanded views use appropriate delivery sizes.
- An image failure falls back for that individual source, without sending all other full-resolution masters to the browser.
- Metadata and the page share one live product read within a request. Approved recipes avoid redundant register/legacy lookups. There is no cross-request caching of stock, pricing or customer data.

## Verification

Typecheck, scoped lint and script syntax passed. Full suite: 3,276 passed, 7 skipped, zero failures. Five approved assemblies passed 28 desktop/mobile presentation checks and five comparisons to original source pixels, with identical registered boxes. Stage-wide mean channel differences were below 0.3 on a 0 to 255 scale; the differences come from display resampling. The new 25 ml glass remains an explicit localhost candidate. Its source and review evidence are archived under Cylinder in Drive.

## Performance target and baseline

Target: the visible product assembly decoded and painted within two seconds of navigation. Record LCP separately because the largest painted element can be text rather than the complete layered bottle.

The public-production baseline used Chrome at 390 x 844, DPR 2, an empty browser cache, 9 Mbps download, 1.5 Mbps upload, 80 ms RTT and native CPU. Sleek 8 ml completed in 11.23 seconds with 6.03 MB of image transfer; the frosted Tall Cylinder 9 ml completed in 9.89 seconds with 7.45 MB. One Tulip run stalled on the existing image optimizer and did not reach the assembly-ready checkpoint during the timeout. These baseline observations do not establish performance for all catalog products.

Earlier private-preview measurements improved the sample pages substantially but did not consistently meet the target, and included stalled navigation samples. Commit `7cebdf7b4ec3f85d3bb892a033dbe6374da6fa0a` also preconnects the image CDN, prioritizes the visible studio backdrop, and skips queries used only by the classic PDP. That exact build passed CI, 132 hosted lotion-PDP states, 22 Builder API entries and two actual Builder pages. Six cold-cache mobile measurements completed without navigation failures: all hero images decoded in 1.78 to 2.87 seconds. The two-second target is still not met consistently. Its temporary access link was revoked after testing. `hosted-7ceb-summary.json` records the exact build and measurements; full evidence is archived in the Cylinder lotion-tube review folder in Drive. Production has not been changed by this work.
