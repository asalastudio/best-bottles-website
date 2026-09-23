# Catalog image and data delivery audit — 2026-09-23

The approved hero masters remain unchanged. This release changes the bytes sent
to each screen, not the SKU-to-image association, image framing, or paper-doll
registration.

## Baseline

- A live Boston/Diva approved PNG returned 2,898,416 bytes with
  `Cache-Control: public, max-age=0, must-revalidate`.
- The live Next image endpoint returned HTTP 200, `image/webp`, and 4,194 bytes
  for that same approved hero at 640 pixels. This confirms the transformation
  works on the deployed site; the new page markup still needs preview QA.
- A live clear-glass builder body shrank from 117,060 to 23,526 bytes at 640
  pixels; both source and optimized output retain an alpha channel.
- The sampled direct Blob PDP plate is already 12,330-byte WebP with a
  one-year public cache header, so it does not need another image-proxy hop.
- In the checked-out approved Boston/Diva batch, 20 PNG masters totaled
  72,015,907 bytes. The same 20 converted locally to 640-pixel WebP at quality
  75 totaled 167,552 bytes. This is a transfer-size illustration, not a live
  before/after browser measurement.
- The catalog route returned about 41 KB of decoded HTML and the default
  builder route about 750 KB of decoded HTML in one live request. Both were
  dynamic, no-store responses. These figures are decoded response sizes, not
  compressed network transfer, and one request is not a latency benchmark.
- Convex catalog queries return image URLs and metadata, not the image bytes.
  The catalog visibility summary also made two full metadata queries per cold
  server instance despite a 30-second process-local cache.

## Changes in this branch

- Catalog cards, catalog list thumbnails, and PDP galleries use responsive
  Next Image URLs for approved local and Shopify sources. Other remote hosts
  keep their original URL so they cannot break the image proxy.
- Builder chooser bodies use responsive images. Twelve full-resolution preload
  links are removed; the first twelve chooser tiles still render eagerly.
- Registered PDP and builder layers retain their exact canvas geometry. For
  eligible sources, their decode preload and painted image use the same
  display-sized URL, so the browser does not download both the original and
  the optimized copy. The already-compact Blob WebP plates stay direct: local
  Next rejected that Blob host while the deployed optimizer accepted it.
- The catalog visibility snapshot now uses a shared 30-second Next data cache,
  preserving the existing freshness window while reducing repeated Convex
  metadata reads across cold instances.

## Release checks and next measurement

Check the catalog grid, one PDP with a plate, one with a decoded kit, and the
builder on desktop and mobile. Confirm the chosen image URL resolves to the
correct SKU and that caps, dip tubes, and shadows remain aligned. On the preview
deployment, record image request count, transferred bytes, LCP, and Convex
query time for a cold and warm catalog, PDP, and builder load. The builder's
decoded HTML is a separate payload-reduction opportunity; do not trim its
configuration data until exact selection and cart behavior are checked.
