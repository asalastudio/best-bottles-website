# Cylinder 9 ml level-rim revision v02

One high-quality GPT 2.5 Sunburst edit corrected the top lip after Jordan flagged its downward slope toward the left. The input was the full native Sunburst v01 PNG. The attached screenshot identified the defect; it was not uploaded to the API. The exact instruction is in prompt.txt.

The generated v02 is 743 × 2116 px. The upper-edge diagnostic improved from a 3 px left-to-right median difference to 1 px, and fitted tilt from 0.973° to 0.143°. Overall opaque-outline aspect changed +0.215% from v01. The rim looks more level in the close-up. The native output is preserved and no pixel edit or geometric stretch was applied afterward.

The model changed pixels outside the requested rim. The original and both generated versions are retained. Residual alpha fringe remains, and material/fit approval is still pending. No product-page or builder assignment changed.

The full-bottle comparison uses the source's approved 43.5% shoulder-to-base target and 91% baseline with uniform scaling. The neck comparison is a CSS viewport on both native images at identical image scale.

Local review: http://localhost:3010/reviews/cylinder9-rim-level-2026-11-01/index.html

Drive: https://drive.google.com/drive/folders/1Ytrfo7QxC6FpxbUOEDRsKb0QeWqp3V7H

Restore: node docs/reviews/cylinder9-rim-level-2026-11-01/restore.mjs --apply

No merge, deployment, database change or live media replacement.
