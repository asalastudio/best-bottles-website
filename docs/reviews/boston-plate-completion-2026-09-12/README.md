# Boston Round — prepared plate review, September 12, 2026

Local review only. No new finished-image approvals have been granted, no productPlates/productKits records have been changed, and no release has been published.

## Ledger before and after

Before preparation: 123 Boston catalog SKUs; 90 indexed plates; 62 plates complete with current-byte approval; 33 missing indexed plates; 28 indexed plates needing correction/reconciliation. Kits: zero live, 25 candidates, 65 held, 33 without a plate. Sunburst: 23 of 23 product groups complete in the configured ledger deployment.

After preparation: 61 local candidates (33 new + 28 corrections), 105 image views, 44 matched cap-on/cap-off pairs, 17 assembled-only dropper plates. All 61 pass the local candidate source, framing and alignment checks. Zero candidate approvals. The 62 original approvals are unchanged. Indexed coverage, 33 missing indexed plates, kit counts, and Sunburst coverage remain unchanged. Candidate readiness does not clear historical indexed holds or complete a release.

The measurement command checked 1,876 indexed plates with zero fetch failures and zero measurement failures. Its catalog-wide diagnostic totals remain 49 wrong-size and 550 legacy-source images; those are not the stricter ledger completion score.

## Source and geometry evidence

Only BB-PSD-Files-Master supplied PSD pixels. Every mapping follows an explicit catalog record and reviewed source record. Original merged previews were hash-verified before rendering.

Nine short-cap sources contain original bare glass and cap layers. Their roles were inspected in `short-cap-layer-audit.png`. Thirty-five additional cap-off sources have a separately recoverable original cap layer, inspected in `loose-cap-layer-audit.png`. Recombining each original PSD's visible layers reproduced its reviewed merged preview within one color level (0–255), with the 99th-percentile difference zero. The component is repositioned using its entire original layer; no new component, selective mask, or shadow treatment is introduced.

`existing-source-inspection.json` retains the exact source evidence for the 28 existing corrections. `loose-cap-layer-audit.json` records the 35 cap-layer selections and their source hashes. `composite-parity.json` records the reconstruction checks. `prepared.json` retains every final transform, image SHA-256, source SHA-256, framing target, and alignment check.

The shared full-glass registration uses inspected bare glass, bottom to rim, excluding closures. For capped sources, the hidden rim is projected from the matching bare-glass body width and base, not directly observed through the cap. This remains a visual-review task. Every pair's lower glass-body mean difference is below 2.71 color levels; the technical hold threshold is 12.

Two existing source-gallery view labels were reversed: GBBstn2ozMtlRollMattGl and GBBstn2ozMtlRollShnSl. The cap-on/cap-off role labels and source plan were corrected from the actual pixels. Original reviewed image bytes and source approvals were retained.

## Plate framing is a proposed presentation, separate from hero locks

The locked hero geometry records remain byte-for-byte unchanged. These candidate plates use the existing 1000 × 1100 plate canvas and a common glass baseline at y=1060. Proposed full-glass heights are 792.31 px (15 mL), 812.35 px (30 mL), and 823.49 px (60 mL).

15/30 mL framing comes from the median full-glass registration of approved plates. The 60 mL target uses the existing approved GBBstnBlu2ozWhtDropper plate (SHA-256 ed37984df5fa1fbc4dc141fcbe570765c68ba6efa9773fd5d492247e4d4d1ce5), which leaves room for tall closures. Using the larger median caused clipping. This choice is explicitly proposed for review, not silently written into a glass lock. The old 62 approved plate bytes are preserved; these candidates do not imply that all preserved plate framing has been newly standardized.

A candidate approval binds its exact image/source evidence and proposed plate presentation. Changed image bytes, relevant standard snapshots, or catalog identity put that candidate on hold or back into review. Changes to an unrelated standard do not invalidate this size. Candidate decisions are saved separately from existing indexed-plate approvals.

## Local review routes

- Family review: http://localhost:3040/team/asset-ledger?preview=1&view=completion
- Example product: http://localhost:3040/products/boston-round-30ml-clear-20-400-rollon?assetPreview=boston&sku=GBBstn1ozRollonMattBlk

Every eligible contact-sheet card has its exact product-preview link. Product previews require development mode, localhost, and the explicit Boston preview flag. They match catalog group and variant identities, overlay only verified local candidates, and preserve indexed siblings. They never write the catalog. Both website and Grace SKU aliases resolve to the same candidate. Cap-off candidates take priority over the existing fallback photo in this local preview only. The preview flag persists through component and glass selections. Product pages check for new local candidate/decision versions every ten seconds while visible, and offer a manual refresh.

The comparison mode displays current/reference and candidate images on equal-size canvases. The 30 mL browser check showed all displayed comparison images at 197 px width, with no failed images. The full proposed sheet loaded all 105 views. Desktop and 390 px mobile product views loaded the candidate; the expanded mobile viewer loaded the exact cap-off pair. A mobile Matte Gold selection resolved the corresponding catalog variant and retained local preview mode.

Sanity's live CMS subscription logs an existing localhost CORS warning. The local plate preview uses its own files/version check and is operational; CMS CORS configuration was not changed.

## Next review action

Jordan reviews this family sheet, flags exceptions, acknowledges the displayed plate framing, and approves the eligible candidates. This is finished-plate review only. Kits still need their own extraction/alignment review and approval. A release packet must name approved hashes and receive release-specific “ship” before any indexing/publication. No hero regeneration is needed for this preparation step.

## Verification receipt

Final ledger refresh: 2026-09-13T01:51:39.890Z (September 12 Pacific). The prescribed measurement/build sequence was run before preparation and again after candidate preparation and local preview integration. Final counts are retained in `final-ledger-counts.json`.

19 focused tests passed across candidate approval/preview, existing plate batch approvals, and source recovery. TypeScript passed. The final production Webpack build passed. The homepage, workbench, and ordinary product route returned HTTP 200. The ordinary product route did not include local candidate URLs or the preview banner. Contact sheet: 105 images loaded on desktop, no overflow at 390 px, and approval disabled before review acknowledgement. The original approval file and locked standards still match the protected preparation hashes. Build-generated sitemap and Next type-reference changes were restored; no commit was made and `.claude/launch.json` was not staged or committed.

The 15 mL clear black-dropper catalog row currently has an N/A applicator field despite its explicit dropper item description and reviewed assembled dropper source. Its candidate records the assembled-only view; reconcile that catalog classification explicitly in the release packet rather than publishing an invented cap-off view.
