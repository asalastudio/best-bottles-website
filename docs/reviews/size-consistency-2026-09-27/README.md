# Size consistency audit, 27 September 2026

Report: `report.html` (published as https://claude.ai/artifact/9a94GGHUkCLdSMnJyWbH5a).
Every live SKU on production was resolved the way the product page and Build Your Bottle resolve it, laid
out with the site's own code, and its glass measured in the image the page draws. The rule is the bottle-scale
skill's: one glass, one size.

- `summary.json`: page totals, causes, and every glass that changes size.
- `off-variants.csv`: each SKU or configuration more than 3% off its glass's standard size, with its cause.
- `proof/`: same-zoom pairs captured from https://best-bottles-website.vercel.app.

Re-run (read-only against production):

    for t in products productGroups productPlates productKits; do npx convex data $t --prod --limit 30000 --format jsonl > output/size-audit/$t-prod.jsonl; done
    NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22 AUDIT_CONVEX_URL=https://precise-raccoon-123.convex.cloud npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/size-consistency/pdp-stage.ts
    NEXT_PUBLIC_CONVEX_URL=https://precise-raccoon-123.convex.cloud npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/size-consistency/byb-preview.ts
    python3 scripts/audit/size-consistency/measure.py
    python3 scripts/audit/size-consistency/analyse.py

`output/size-audit/geometry.json` holds the desktop stage sizes measured on production at 1440 x 900
(product page stage 672 x 540, builder preview 410 x 472, builder glass step 410 x 312).
