# Four silver tassels — local integration, 13 October 2026

Jordan approved all four corrected source assets and authorized local PDP/Builder integration and verification. Publication remains prohibited. No merge, upload, production data write or deployment was performed.

## Implementation

- Four content-addressed PNG crops live in `public/local-media/tassel-silver/`. The manifest records source hashes, crop coordinates, original URLs, dimensions and registration anchors.
- The shared register loader substitutes the approved images only in development, after kit composition. Component ID, original URL and dimensions must all match. Applying the substitution before composition would invalidate URL-keyed cap-seat measurements.
- Body images, body-specific tubes, alpha geometry, seating and placement boxes are unchanged by the asset substitution. Production continues using existing hosted URLs.
- Development-only Builder cache keys prevent old hosted kits from concealing the local replacement.
- Offline review exposed an existing Empire100 Builder issue: the legacy canonical body substitution also ran on register kits and displaced the hardware above the neck. The guard now preserves measured register plates; legacy kits retain their original substitution. A regression test fails before this correction and passes after it.

## Fresh bounded scope and results

Read-only catalogue/register snapshot collected at **2026-10-13T20:01:49.127Z**: 2,485 product records, 1,172 envelope records for affected bodies, 20 body records. This is source-data evidence, not a live UI audit.

| Check | Result |
| --- | --- |
| Corrected register-backed bottle combinations | 104; 26 per finish |
| Offline PDP/Builder complete renders | 208 |
| Builder body/fitment/complete × cover states | 624 |
| PDP finish selection resolves exact SKU | 104/104 |
| PDP and Builder finish thumbnail mapping | 104/104 each |
| Builder cart payload SKU/Shopify variant identity | 104/104 |
| Decoded unique local/hosted source images | 56 |
| Supported PDP or Builder bounds failures | 0 |
| Focused regression suite | 48 tests, five files, passed |
| TypeScript and whitespace checks | Passed |
| Browser, mobile Safari, cart UI and live verification | Pending |

All ten family contact sheets were inspected. Corrected hardware is silver, textile finishes remain distinct, and the original bottle geometry is retained. Empire100 was rerendered after the placement correction. These are offline composites. They do not reproduce CSS blending, browser image optimization, responsive controls or network failure/recovery. Bounds checks do not establish tube visibility or photographic acceptance. Source artwork approval does not imply owner approval of every assembled product.

Tassel assemblies offer Cap On only; Sidecar/Exploded requests resolve to Cap On and are not offered as distinct supported views. Exact selection URLs and a 104-row pending browser matrix are included in the evidence.

## Separate unresolved scope

Four Diva46 jeweled-ring combinations remain unresolved in the register:

- `GBDiva46AnSpTslBlkRng`
- `GBDiva46AnSpTslIvySlRng`
- `GBDiva46AnSpTslRedRng`
- `GBDiva46AnSpTslWhtRng`

Their fallback images were not established as using the same defective layer and were not replaced. Four standalone sprayer catalogue records are also separate from the 104 bottle assemblies; their source hose geometry and imagery paths differ. Bottle cutouts were not substituted into those records.

The Empire registration guard also applies to other register-based Empire100 fitments. The four corrected tassel assemblies were inspected offline; broader Empire browser regression is required before release.

## Evidence and review

Evidence root:

`/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/tassel-local-integration-2026-10-13/`

- `review.html`: all family sheets, full-size image links and exact local PDP selections.
- `verification.json`: 104 geometry/identity results, 624 stage states, image hashes and eight separate scope exceptions.
- `selection-verification.json`: exact finish and thumbnail mapping checks.
- `owner-approval.json`: approval and source/integrated hashes.
- `manual-browser-matrix.csv`: all browser results remain pending.
- `empire-before-registration-fix.*`: retained pre-fix evidence.

Reproduce with `scripts/review-local-tassel-integration.ts` and `scripts/review-local-tassel-selections.ts`, passing the evidence directory. These scripts do not modify catalogue data. The rasterizer converts WebP to in-memory PNG for librsvg compatibility; source and website assets remain unchanged.

## Remaining release gates

The supported browser tool still denied localhost access this turn because of a saved permission setting. No alternate browser or HTTP page inspection was used to bypass it. The local server is listening on port 3005 in this worktree; that is process readiness only.

Use the manual matrix to inspect desktop/mobile PDP, exact finish/glass changes, zoom, Builder steps, PDP handoff, cart imagery/identity and physical iPhone Safari with interrupted/recovered image loading. Record visible outcomes and screenshots. Resolve the ring assemblies separately. Publishing and production reference changes require explicit release approval after this review.

## Later 13 October update

The four Diva ring combinations listed above are now integrated locally and checked offline. They remain unresolved in production. The 104 non-ring combinations plus four ring assemblies total 108 local bottle combinations using the approved silver heads; this is not a live completion count. Four standalone sprayer records remain separate. See [Diva ring review](DIVA-RINGS-LOCAL.md).
