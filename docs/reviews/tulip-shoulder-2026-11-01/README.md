# Tulip shoulder and tube review

The user reference shows the sprayer bottom above the rounded shoulder with a small neck band visible. This local revision raises the sprayer and assembled overcap to each body's existing shoulder landmark. All component dimensions and artwork remain unchanged. The two masters remain separate: 5 ml amber and 6 ml clear.

The clear tube previously extended into the thick glass base. Both tube endpoints are now registered above their own interior floor: clear at canvas y=982, amber at y=1009. Each has an 8 px clearance from the visually registered floor. These are artwork landmarks, not manufacturer depth measurements. Permanent layer clipping trims only the lower tube and preserves its diameter, bend and pump mechanism. The same trim applies in exploded view and the standalone builder.

Scope: the 15 existing fine-mist preview SKUs (eight amber and seven clear). Applied only to explicit `assetPreview=gpt13` requests on localhost. No production or catalog records were changed. Prior kits, source screenshot and before/after screenshots are preserved here. Original body assets, boxes, anchors and sizing are unchanged.

Verified: 45 desktop product-page states, constant body frame across views, same trim across views, exact SKU builder links, two actual builder entries, 48 targeted tests and TypeScript. Before/after shiny-black examples were inspected visually. Other finish screenshots are retained for review. This is a local candidate, not a production release or whole-catalog sign-off.

Next review: metal and plastic rollers on both Tulip bodies. The user also directed that both bodies move under Cylinder after fitting corrections. That taxonomy migration is pending and must preserve distinct capacities, original SKUs, routes and body identity.

Rebuild from the active worktree root: `python3 docs/reviews/tulip-shoulder-2026-11-01/build.py`. Source body and tube assets are recoverable from `docs/reviews/gpt-13-415-paperdoll-2026-10-31/restore.mjs`.

Capture: `node docs/reviews/tulip-shoulder-2026-11-01/capture.cjs`.
Verify captured states and builder: `node docs/reviews/tulip-shoulder-2026-11-01/verify.cjs`.
