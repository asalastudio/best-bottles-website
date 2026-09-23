# Ledger repair and bottle-standard foundation — 2026-09-12

This is local implementation and review evidence, not a release authorization. No product images, approvals, locks, Convex records or Shopify records were changed. Nothing was published or committed.

The required measurement and ledger commands ran in order before changes and after the ledger repair. The first fresh-byte sweep encountered four DNS failures and stopped before ledger generation. A bounded retry fixed the transport issue; subsequent complete sweeps downloaded and measured all 1,876 images with zero failures. The ledger build was rerun successfully after correcting a local initialization-order error.

## Before and after the ledger repair

The baseline contained 2,572 SKU rows, including 2,536 identified catalog SKUs and 36 review-only SKUs. All remain present. The full catalog query contains 2,540 records: the additional four lack website SKUs, rather than being duplicate identified SKUs. Those records are now explicitly listed. The catalog has 380 product groups; the old family summary covered only 377 joined groups.

The old summary counted 1,119 plates as done without requiring matching visual approval. The repaired dashboard counts 165 of 2,312 applicable SKUs passing the current checks with matching plate-image approval. Another 866 pass the current automated checks but lack the required matching approval. These are accounting changes; no plate has been visually corrected by this repair.

All 642 false hero approvals were removed from the hero lane. They were plate-review decisions and remain preserved as plate evidence. The registry still contains 391 images: 82 match Sunburst locks and 309 belong to the prior release. By the complete catalog group inventory, 71 of 380 groups have matching Sunburst coverage; 371 have any valid indexed hero. Earlier-generation coverage does not complete the Sunburst goal.

Live kits remain 420 of 2,309 applicable SKUs. The previous 70 approved-but-unpublished kit entries became 60 with matching current plate evidence, plus 10 requiring a plate-parity recheck. Current candidates and holds remain separate from served kits.

The old diagnostic reported 174 size flags across inferred bottle cohorts. The new measurement uses exact catalog group IDs, without SKU identity inference, and reports 49 diagnostic outliers, including components. After applicability classification, 21 bottle rows carry that raw size state. The earlier 174 findings remain explicit open holds; none were closed by changing the ruler. All 550 legacy-source flags remain present, with overlap across the primary state categories.

The ledger preserves 89 paused local plate candidates and 150 source preflight holds. Candidate existence does not change live coverage or inherit approval. The two unclassified source-comparison collections (four copies across roots) remain quarantined while their SKU rows stay visible. All referenced review images passed byte verification. Historical decisions that do not match a current card remain recorded in their original files and cannot approve different bytes.

## Physical groups and persistent sizing

The unsafe familyId-only proposal is replaced with explicit catalog product-group grouping, with support for an explicit physical-standard ID. The renderer no longer parses an applicator from SKU spelling. Missing group/applicator metadata stops rendering and requires refreshed catalog evidence. Tall and footed profiles cannot merge merely because an old family ID matches. Full source reconciliation is still open; the 150 holds are not claimed resolved.

Three proposed standards are recorded separately for Boston Round 15, 30 and 60 mL, spanning the explicitly mapped colors and compatible closures. The reference images are unchanged, existing Sunburst-approved Clear images. All three shared standards remain unconfirmed: zero shared glass-height locks have been granted.

Historical Boston targets include `bottle_with_fitment` measurements, so they cannot be silently interpreted as glass height. The standards preserve that history. A tested geometry planner keeps glass scale and baseline constant across fitments, rejects stale standard versions and clipping, and requires a locked reference. It does not edit images. Automatic normalization is not yet integrated into the render pipeline, and no new target has been invented.

After these grouping safeguards and standard proposals, the refresh again reports 1,876 measured plates, 550 legacy sources, 174 retained historical size holds, 420 live kits, 165 checked-and-approved plates and 71 Sunburst-covered groups. The three new proposals change the workflow inventory, not asset completion. No subsequent batch or release began.

## Interface and checks

The dashboard uses separate plate, kit and Sunburst sections; readable status text with green/amber/red; a family and size selector; exact-SKU search; status filters; pagination; and expandable evidence. Boston 15 mL is the initial focus. The bottle-standard cards preserve old targets and let Jordan focus on 15, 30 or 60 mL. Unmatched records and source holds remain accessible.

The current local URL is `http://localhost:3040/team/asset-ledger?preview=1`. The preview bypass remains development-only and the staff authentication gate is unchanged. This is not proof of production access or a released storefront.

Browser checks covered desktop rendering, exact-SKU filtering, empty-search recovery, complete/blocked views, pagination, and a 390 px phone viewport with no horizontal overflow. Same-zoom dashboard before/after views were delivered in the conversation. The existing product-image comparison board remains separate and pending review.

The focused review tests and existing hero-lock tests pass (401). The new bottle-standard planner tests pass (7), measurement evidence tests pass (3), and family-batch tests pass (11). TypeScript and the Webpack production build also pass with the final dashboard additions. The final local route returns HTTP 200 and visibly renders the workbench and standards. The size-focus controls correctly show 16 SKUs at 15 mL and 53 at 30 mL. All three reference images load at their original 1560 × 1716 resolution.

Next: verify the glass landmarks on the proposed 15 mL reference, record the shared standard with Jordan's explicit approval, resolve the pilot's source and cap-off holds, then integrate and verify normalization against plates and kits. Product desktop/mobile behavior and release-specific “ship” remain required before any publication.
