# Cylinder material pilot

Scope: preserve recovered body geometry and the 109-record scale contract while testing higher-quality glass with the user-requested GPT 2.5 Sunburst model.

The current catalog has 53 Cylinder product groups: 50 glass groups and three plastic groups. The glass groups map to 18 body/color identities across 12 size/neck designs. Seventeen source images were recovered. The fixed-sprayer 30 ml body needs source recovery. One glass group has a cached variant count of zero; group counts are not sellability verification.

Pilot: cylinder-9ml-17-415|Clear. Preserve the 43.5% shoulder span, 91% baseline and centered axis. Preserve later accepted family corrections when assigning bodies to components.

The prepared input files are source-cylinder9-clear.png and glass-material-reference.png under output/imagegen/cylinder9-material-pilot-2026-10-31/. The second is Jordan's earlier clear 5 ml reference and is used only for material, not geometry.

Status: Jordan explicitly approved the two input images for upload to OpenAI. The requested GPT 2.5 Sunburst edit returned HTTP 429, credit_balance_exhausted. Zero images were generated. Jordan chose to keep Sunburst and restore credits; no fallback was used. No family batch has started and no runtime artwork changed.

Files:
- family-inventory.json and family-inventory.csv: all body/color identities and product-page mappings.
- request.json and prompt.txt: exact prepared pilot specification.
- index.html: review page source.

Local review: http://localhost:3010/reviews/cylinder-master-materials-2026-10-31/index.html

The two exact inputs are also copied into this review folder with the hashes in request.json. result.json records the API error and the decision to keep Sunburst. Retry the prepared one-image request after Jordan confirms credits are restored. Do not substitute models or start a family batch before reviewing the pilot.
