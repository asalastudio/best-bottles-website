# Cylinder leftover kits — sibling reuse

18 September 2026. Thirteen plated Cylinder SKUs still had no usable production kit. This batch reuses already published photographic parts from same-family siblings. No new pixels were created. Nothing was indexed.

## Result

| Gate | Count | SKUs |
|---|---:|---|
| Strict (mean ≤ 6, tail ≤ 1%) | 3 | GBCylBlu9RollPnkDot, GBCylSwrl9RollMattCu, GBCylSwrl9RollWht |
| Visual-review band (mean ≤ 12, tail ≤ 8%) | 8 | GBCyl9RollBlkDot, GBCyl9RollPnkDot, GBCylBlu9RollSlDot, GBCylSwrl9RollMattGl, GBCylSwrl9RollMattSl, GBCylSwrl9RollShBlk, GBCylSwrl9RollShnGl, GBCylSwrl9RollShnSl |
| Held | 2 | GBCyl9SpryShSl, GBSpry3mlClBlk |
| Indexed | 0 | Write token is not present in this environment |

Parts already live on the public Vercel Blob store. Publishing the three strict kits needs only `BEST_BOTTLES_CONVEX_WRITE_TOKEN` against production:

```bash
python3 scripts/paperdoll/publish_sibling_reuse_kits.py --apply
```

## Holds

- **GBCyl9SpryShSl** — shiny-silver overcap from `GBCylBlu9SpryShSl` does not transfer onto clear glass (mean 44.8). No same-scale clear Cylinder shiny-silver spray overcap is indexed.
- **GBSpry3mlClBlk** — the 9 ml black spray overcap is the wrong scale for the 3.3 ml body (mean 57.0). Needs a same-size black overcap source.

## Rebuild

```bash
python3 scripts/paperdoll/build_sibling_reuse_kits.py
python3 scripts/paperdoll/tests/test_sibling_reuse_kits.py
```

Recipes: `scripts/paperdoll/cylinder_leftover_kit_recipes.json`. Candidates: `data/paper-doll/cylinder-leftover-kits/`. Ledger: `data/paper-doll/cylinder-leftover-kit-ledger.json`.
