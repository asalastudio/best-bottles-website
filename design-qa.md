# Catalog cap chooser — 2026-09-05

Status: local interaction verified. Final premium imagery review pending the separate hero-image task. Not merged or deployed.

## Accepted direction

Use the existing compact catalog grid with actual top-component photographs, a total option count, four thumbnails and a remaining count. Clicking the rail opens a separate chooser. Each option links to the same product/application with its SKU selected. Image/title and “View full configuration” remain normal product links. The legacy screenshots establish component-photo presentation; the latest user direction supersedes component hover previews and the legacy purchase controls.

Caps on roll-on assemblies may vary, but roller balls/materials are not chooser options. Sprayers, pumps, droppers and antique tops stay within their own assembly. Mixed applicator groups do not expose this chooser.

## Hero integration contract

CatalogCardPreview owns only pointer hover on the main image. CatalogCapOptions has no callback or state that can replace it. The default heroImageUrl and optional heroHoverImageUrl are separate inputs; missing hover imagery retains the default. A fallback product image is used only when the default is unavailable. No premium image assets were changed or imported from another worktree.

The other task must supply its approved pair through these inputs (or preserve this separation when integrating its own image component). The live catalog response currently does not supply the premium filled image. Unit tests cover the priority contract; an actual premium empty/filled pair still needs browser verification after integration.

## Verification

- Compared the supplied compact-card reference and rendered chooser together. Compact hierarchy, actual component photographs, simple metadata and no card purchase buttons are present. Existing site navigation/grid styling is retained.
- Desktop chooser displays six compatible 9 ml Amber sprayer finishes with names and thumbnails. Gold navigation resolves GBCylAmb9SpryGl and a Gold-selected PDP.
- At 390 × 844, the chooser fits the viewport and its Gold link reaches the mobile PDP with Sprayer Finish: Gold and the same SKU. Close and native Escape/light-dismiss behavior were checked locally.
- 986 tests passed, 7 skipped across the full suite. TypeScript passed; full ESLint completed with zero errors and 49 warnings. The added regressions preserve all eight frosted finishes and recognize 13-415 sprayer component SKUs.

Local screenshot evidence: /tmp/catalog-caps-desktop-final.png, /tmp/catalog-caps-chooser-final.png and /tmp/catalog-caps-mobile-final.png.

## Remaining visual limitations

Current source hero images have inconsistent framing/backgrounds. The frosted 13-415 bottle now loads its existing assembly plate independently of cap eligibility. Both 13-415 cards expose eight choices. All eight finishes now use exact-SKU spray-top kit layers consistently; the mixed standalone top/overcap index is bypassed for these sixteen clear/Frosted SKUs. All sixteen source URLs returned 200 and their SHA-256 hashes matched. Transparent layers are framed using their recorded bounds, without changing source pixels. Desktop visual inspection confirms a complete eight-top Frosted chooser. These are not final premium imagery. Final visual signoff requires the finished hover-task integration. The standalone index gaps no longer affect these two rails. No catalog truth repairs, backend writes, cart mutations or production publication were performed.

Production build passed before the final spray-top presentation change. The final change passed 15 targeted regression tests, TypeScript and targeted ESLint. Source lineage for the exact published sprayer layers is recorded in `src/lib/products/tall-cylinder-spray-tops.json` (URLs, hashes, dimensions and bounds). Screenshot: /tmp/catalog-frosted-eight-spray-tops.png. No overcap fallback is allowed for this complete set if an individual URL fails.
