# Quarantined scripts

Nothing in this folder is referenced by `package.json`, the GitHub workflows, other scripts or
the docs (checked 5 November 2026, see `docs/audits/2026-11-05-cleanup-audit.md`). Each one
writes to the Convex deployment named by `.env.local` / `NEXT_PUBLIC_CONVEX_URL`, and that is
why they were moved here instead of deleted: a script that is easy to find and easy to run is a
hazard when it can rewrite products.

| Script | What it does when run |
|---|---|
| `clear_loop.mjs` | Calls `api.seedProducts.clearAll` in a loop until the `products` table is empty. **Wipes the catalog.** Formerly at the repository root. |
| `run_atomizer_reclassify.mjs`, `run_decorative_shapes.mjs`, `run_fix_misparsed_spray_colors.mjs`, `run_plastic_bottle_reclassify.mjs` | One-off reclassification mutations from the 2026 data cleanup. The corrections they made are already in the data. |
| `check_tulip_sprayer_variants.mjs`, `verify_bsr_fix.mjs`, `verify_grace_sku_preservation.mjs`, `_inspect_groups.mjs` | Diagnostics that also patch or create rows while checking. |

Do not run any of these against production (`precise-raccoon-123`). If one is needed again,
copy the relevant mutation into a dated script under `scripts/catalog-corrections/` with a
`--dry-run` default, as the other corrections do.
