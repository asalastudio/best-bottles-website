# Bottle measurements snapshot, 2026-09-16

Production Convex (`precise-raccoon-123`), pulled 2026-09-16 21:30 UTC through the site's public product-group queries.
Built and read by the `bestbottles-bottle-scale` skill (`.claude/skills/bestbottles-bottle-scale/`).

| File | What it is |
|---|---|
| `prod-products.json` | Every product row with its measurements (2,479 grouped SKUs; retired SKUs and components are filtered later) |
| `bodies.json` | 2,269 live container SKUs grouped into 108 glass bodies. Ids are positional: the review file's Bottle # |
| `Best Bottles bottle bodies - measurements (Convex production 2026-09-16).xlsx` / `.csv` | One row per glass with the source-of-truth height without cap, every SKU, and a read-me |
| `Best Bottles bottle heights - please check (sent 2026-09-16).xlsx` | The review copy sent to Jordan's boss: red Issues tab (19), All bottles (89), SKU detail |
| `review-meta.json` | Which bottle numbers were issues when the review copy was built |
| `scale-card/` | Universal scale card v1 **proposal** (not approved) and the one-product example on the real 10:11 card |

When the reviewed file comes back:

```bash
python3 .claude/skills/bestbottles-bottle-scale/scripts/reconcile_review.py "<returned file>.xlsx" docs/reviews/bottle-measurements-2026-09-16
```

Do not regenerate or re-pull into this folder. A new pull goes in a new dated folder, because the Bottle # values
in the sent file refer to this snapshot.
