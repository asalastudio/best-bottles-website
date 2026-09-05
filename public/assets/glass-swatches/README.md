# Shared glass selector swatches

Generated material illustrations based on existing Best Bottles glass references, September 5, 2026. These are selector assets, not exact-SKU product photographs or replacement heroes.

Current set: clear-v6, amber-v6, cobalt-v6, frosted-v1, swirl-v1 (512px square WebP). Original generations and rejected versions are retained locally outside this PR. Only these five current WebP assets are included.

Clear, Amber and Cobalt use plain unpatterned glass with transmitted softbox light. Frosted and Swirl retain the versions the user liked. Swirl's molded diagonal pattern was referenced from the published GBCylSwrl9SpryGl plate. Other material references are in public/references/9ml.

Use glassSwatchImage from src/lib/products/glass-swatches.ts wherever a supported glass finish can be selected. It normalizes Cobalt Blue/Blue to Cobalt and preserves fallback behavior for other finishes. Desktop PDP, mobile PDP picker, 3D glass selector and glass-color preview swatches use this shared mapping. Product heroes and filled-hover assets stay separate.
