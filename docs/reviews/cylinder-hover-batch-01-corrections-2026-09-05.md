# Batch one correction verification

User authorized whole-image scaling, positioning and color grading, with quality preserved. Original generated files and the four approved trial pairs remain unchanged.

Twenty corrected2080×2288 PNGs are installed at `/preview/cylinder-hover-batch-01/index.html`. This is local review publication, not production catalog integration.

- Bottle body anchors drive full-frame horizontal/vertical scale and translation. The three cobalt5mL bodies share the roller reference dimensions. No product parts were regenerated or masked.
- One Lanczos resample from each original; lossless PNG output. Frame edges extend existing edge pixels where the positioning exposes a margin.
- Global luminance-dependent RGB highlight grade targets#F5F3EF. Dark product details stay unchanged by the grade. Natural contact-shadow tones remain.
- Independent post-export bottom-edge measurements: all20 within1pixel of y2082 on2288px canvas. These are image contact measurements, not certification of physical product dimensions.
- Seven background-only patches per image: mean channel error below0.5RGB. Local shadows retain variation; not every background pixel is identical.
- Twenty desktop/touch hover checks passed.390/768/1440px layouts load all20 images without horizontal overflow. Reduced motion and all10 failed-hover fallbacks passed.

Reproduce: `python3 output/cylinder-hover-batch-01/normalize.py`, then `node output/cylinder-hover-batch-01/export.mjs`. Per-file anchors, transforms, grade values and hashes are retained beside those scripts. Do not use the earlier regeneration candidates.
