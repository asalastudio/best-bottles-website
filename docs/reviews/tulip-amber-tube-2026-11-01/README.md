# Tulip amber tube material and overcap seating

The user approved the seated amber tube treatment in this review. It uses multiply compositing at 0.5 opacity so the source tube takes the amber body color and retains the body reflections. This is a 2D compositing treatment, not simulated refraction. Exploded tubes retain the original translucent plastic appearance. Clear tubes, body artwork, geometry, width, bend, length and scale are unchanged.

The closed overcaps on all 15 fine-mist configurations now meet the shoulder, 16.3 canvas pixels below the exposed-sprayer seat. The sprayers still show the slight neck band required by the earlier reference. Source pixels and component dimensions are unchanged. The new overcap source reference is preserved here.

Validated: 45 product-page states across 15 sprayer SKUs, the two actual builder entries, TypeScript, and 50 targeted tests. One added test initially used an assembled-only vintage sprayer fixture; it was corrected to exercise separable fine-mist views and passed. Product-sized cap-on, sidecar and exploded images were inspected for both bottles. No production publication or merge.

Rebuild in order:
1. `python3 docs/reviews/tulip-shoulder-2026-11-01/build.py`
2. `python3 docs/reviews/tulip-amber-tube-2026-11-01/build.py`

Browser evidence: `node docs/reviews/tulip-amber-tube-2026-11-01/capture.cjs`, then `node docs/reviews/tulip-amber-tube-2026-11-01/verify.cjs`.

Deferred at the user's request: replace the current click-to-zoom interaction with hover zoom across products. Do not change zoom in this image-fitting pass. Metal/plastic roller review for both Tulip bodies and subsequent regrouping into Cylinder remain separate pending work.
