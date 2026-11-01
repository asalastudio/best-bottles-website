# Clear 2 ml vial: source correction for local review

Historical source investigation. The final October 31 clear and amber Sunburst masters supersede the initial candidates below. See `../catalog-checkpoint-2026-10-31/README.md` for the current restorable checkpoint; earlier validation and approval statements below describe their recorded stage only.

The white-cap PDP displayed the wrong bottle profile. The same body mismatch exists on the production website and affects the black-cap variant. The existing released catalog hero also derives from the rejected source.

## Evidence

- User identified the incorrect shape on October 31, 2026 at `/products/vial-2ml-clear-8-425?cap=white`.
- Exact white SKU: `GBVialClr2mlWhtCap`, Grace `GB-VIA-CLR-2ML-WHT-T`. Black SKU: `GBVialClr2mlBlackCap`, Grace `GB-VIA-CLR-2ML-BLK-T`.
- Current legacy white-cap product: https://www.bestbottles.com/product/Vial-design-2-ml-clear-glass-vial-short-white-cap
- Its original images are preserved here as `vial-legacy-sidecar.gif` and `vial-legacy-capped.gif`. The specification identifies 2 ml, 8-425, 35 ± 0.5 mm glass height, 37 ± 0.5 mm capped height and 12 ± 0.5 mm diameter.
- Rejected source: `6.   8-425 Bottles - CB/2. 2ml Dram/1.  Clear 2ml Dram/2. GBVialClr2mlWhtCap.psd`. It has the angular shoulder and heavy outline visible in the user's screenshot. The earlier “approved” label does not override this identity finding.
- Replacement source: `12. Vials/0. All Vials/Capped/1. GBVClr2mlWhtCap..psd`, with its uncapped counterpart. Its rounded shoulders, neck and glass heel match the legacy photograph. The black-cap PSD uses the same body pixels and its own black closure.
- `source-manifest.json` records exact source hashes, every layer, exclusions, uniform placement and encoded-image parity. Native masters were not modified.

The white PSD contains two hidden obsolete layers. The black capped PSD also leaves the obsolete white closure enabled behind its own black cap. The candidate explicitly excludes these old layers and keeps the correct body plus each SKU's own cap. The black cap matches the pixels in the black uncapped source. The initial PSD-only candidate generated no new product pixels; the later body regeneration is recorded below.

## Current state

Local review candidate only. No user visual acceptance, database publication, catalog-hero replacement, commit, merge or production deployment has been recorded for this correction. The regenerated body is now the default for both clear 2 ml vial SKUs on localhost, including ordinary links without a preview parameter:

http://localhost:3010/products/vial-2ml-clear-8-425?cap=white

The redesigned PDP now accepts the same guarded local kit input as the classic PDP. It requires a localhost host, an exact SKU match, and `BUILDER_LOCAL_KITS`; the loader refuses Vercel deployments. These two SKUs are explicitly listed in `defaultPdpSkus` in the local manifest, so they do not require `assetPreview=kits`. Other staged SKUs still require that flag. The local environment setting is saved for ordinary dev-server restarts.

To rebuild the candidate from the mounted source library:

```sh
python3 docs/reviews/vial-2ml-source-correction-2026-10-31/prepare.py "$PWD"
BUILDER_LOCAL_KITS="$PWD/public/local-kits/vial-2ml-source-2026-10-31/kits.json" npm run dev -- --port 3010
```

## Validation

Both kits pass the existing alpha checks. Compositing the encoded part assets against the selected PSD layers passes the existing parity gate: mean errors 1.1141 and 1.1852, no pixels above the gate's large-difference threshold. Uniform scaling preserves source proportions. TypeScript, changed-file lint, whitespace validation and both existing local-preview guard tests pass.

Browser screenshots and `browser-checks.json` record the finish/view checks separately. Production publication must also replace the incorrect catalog hero and verify the exact SKU through catalog, PDP and Builder; this local preview does not establish that release.

Browser verification passed for white and black caps in Sidecar, Cap On and Exploded views, with loaded candidate images in all six desktop checks. Mobile at 390 px has no horizontal overflow. At that initial validation stage the normal URL did not receive candidates; the later navigation fix below supersedes that behavior for these two SKUs. Screenshot inspection confirms the rounded vial body and each finish's own closure. The first browser probe timed out because it checked unescaped local image URLs; the corrected probe decodes Next.js image URLs before matching.

Additional data issues observed during this review: the exact white SKU is called “short white cap” on the current legacy page, while production imports `capStyle: Tall` and displays “Tall white screw cap.” Both production variants also carry `bottleWeightG: 75.08`, displayed as 75 g in the exploded callout. The fetched legacy page did not establish a bottle weight; treat that value as unverified and reconcile with exact-SKU weight evidence before using it for shipping. No weight or cap-style data was changed here.

## Later local update: regenerated clear body

After Jordan requested regeneration, the localhost review overlay was updated with a transparent generated body referenced only to the corrected PSD. Both white- and black-cap SKUs use the same registered body; the cap assets remain the corrected PSD layers. See `image-generation/body/README.md` for the saved image, prompt, geometry comparison and browser checks. Production remains unchanged. A later navigation fix makes the regenerated body the default on normal localhost URLs for the two clear-vial SKUs.


## Approved display sizing, October 31

Jordan chose the later approved vial-family sizing. The local product page now uses 40.24% bare-glass height with the glass foot at 91% of the canvas, for both cap colors and all three views. Caps scale uniformly with the body. The size survives normal-URL reloads and remains local. See `sizing/README.md` for the approval, measured browser results, and screenshots at the same viewport before and after.
