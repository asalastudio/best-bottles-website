# Build Your Bottle — PR #99 release check

Checked September 7, 2026 after merging `origin/main` at `4a46bfeb` into the feature branch.

## Hero work stays separate

- All 274 tracked hero/catalog asset paths checked against `origin/main` are unchanged.
- No changes to catalog hero manifests, catalog/product card renderers, or `tools/hero-review`.
- Every public asset added by this PR is under `public/images/bottle-builder/`.
- The pending committed changes on `codex/catalog-complete-hero-coverage` and `codex/bone-studio-recovery` have no file overlap with this PR. The inspected dirty tracked files in those worktrees and `codex/cylinder-catalog-heroes` also have no overlap.
- Other worktrees, source PSDs, hero review decisions, and branch tips were not modified. This check does not publish pending hero approvals.
- The mobile global CSS additions are scoped to pages containing `main[data-builder-page]`.

## Integration validation

- Full Vitest suite: 1,197 passed, 7 skipped across 154 passing test files and 2 skipped files.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- ESLint: passed with 0 errors and 49 warnings; unrelated warning cleanup was excluded.
- Checkout fixture reconciliation preserves main's stale-SKU checks and the builder's cart-wide minimum. Added a combined regression proving the corrected SKU's current price determines the minimum.

## Browser checks before main integration

- Desktop and 390px mobile builder flows checked for horizontal overflow and usable actions.
- Five lotion-pump finishes show the exposed mechanism and matching included overcap.
- Tall 9 ml metal roller and clear-glass previews checked against the repaired layers.
- Nine vintage finishes visible with three unavailable finishes disabled.
- Twenty-six selectable vintage/tassel combinations across 50 ml and 100 ml Cylinder retain the same glass image, body transform, and viewBox across finish changes on desktop and mobile.
- No purchase or production backend deployment was performed.

The production build and remote PR checks are reported on PR #99 for the final pushed commit.
