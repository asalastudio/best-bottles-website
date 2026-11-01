# Cylinder 9 ml glass-refraction revision v03

Jordan requested better clear-glass refraction because v02 read blurry. One high-quality GPT 2.5 Sunburst edit used the leveled-rim v02 as the geometry target and the previously supplied clear 5 ml photograph as a material-only reference. The exact prompt and both inputs are preserved in this package.

Native output is 743 × 2116 RGBA, the same resolution as v02. It is a material edit, not a pixel-resolution upscale. No raster retouching, filters or stretching were applied afterward. The API completed in 21.6 seconds.

Visual result: more defined specular reflections and refracted contours at the threads, shoulder and base. The new image retains a near-level top rim. The median left-to-right rim difference remains 1 px; the fitted upper-edge angle is 0.248° versus 0.143° in v02. Overall opaque-outline aspect changed −0.964% from v02. These alpha-edge diagnostics do not establish exact dimensional compliance.

Remaining issues: rough alpha fringe is visible around the silhouette on dark backgrounds, exact shoulder/neck fit and through-glass fitment compositing must be rechecked before a paper-doll assignment. Center-body mean alpha fell from 252.34 to 113.41 on the 0–255 scale (same 140 × 1000 px sample area), confirming improved transparency but not physical refraction accuracy. This material comparison does not establish final configurator compatibility. This is a REVIEW candidate, not an approved or assigned master.

Originals, the active 5 ml clear/cobalt masters and all 71 active configurations are preserved. No product-page or builder assignment changed.

The full-bottle comparison preserves the earlier source's 43.5% shoulder-to-base target and 91% baseline through uniform image scaling to equal overall height. This comparison is not a replacement anchor approval. Close-up views use identical CSS viewports into the native PNGs.

Local review: http://localhost:3010/reviews/cylinder9-glass-refraction-2026-11-01/index.html

Drive: https://drive.google.com/drive/folders/1vTAxvhlt3h7RQTyyY14voRPjrr1sZFky

Restore: node docs/reviews/cylinder9-glass-refraction-2026-11-01/restore.mjs --apply

No merge, deployment, database change or live media replacement.
