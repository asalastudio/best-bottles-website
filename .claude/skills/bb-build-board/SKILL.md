---
name: bb-build-board
description: Open, refresh, or update the Configurator Build Board — the interactive artifact tracking every configurator component's geometry + material status (missing colourways, quality passes, geometry gaps, the 64-material authoring library). Use when Jordan says "build board", "component board", "material board", "what caps are missing", or wants the coverage artifact updated or reopened.
---

# Configurator Build Board

The board is a published artifact and a committed HTML source. **Never
create a second artifact for it** — always republish to the fixed URL.

- **Artifact URL (fixed):** https://claude.ai/code/artifact/066cc47a-531b-4e1e-abaf-c4fa7f483a0c
- **Source of the page:** `docs/configurator/build-board.html` (committed; the
  scratchpad copy is disposable)
- To reopen for Jordan: give him the URL (or /artifacts, or ctrl+]).

## To update the board

1. Edit `docs/configurator/build-board.html` (data lives in the `DATA` array;
   the library in `LIB`, generated from `data/materials/physicallybased-library.json`
   — linear→sRGB via the transfer function, not ×255).
2. Republish with the Artifact tool: `file_path` = the repo file,
   `url` = the fixed URL above, favicon 🧩. Commit the file change.

## To refresh the DATA from live truth (measure, never guess)

- Cap colourway coverage (which sell with no material token):
  `npx convex data products --limit 3000 --format jsonl` → group by `capColor`,
  map names through `capTokenFor` in `src/components/products/ConfiguratorPdp.tsx`,
  compare against `public/models/materials.json` tokens.
- Geometry inventory: `ls public/models/closures/*.glb` vs the catalog's
  neck×applicator matrix from `npx convex data productGroups`.
- SKU impact numbers: variantCount sums from productGroups per neck/applicator.
- Reconciliation context: `docs/catalog/RECONCILIATION-2026-08-31.md`.

## Board interactivity contract (keep intact when editing)

- Row status cycle To do → Planned → Done persists in localStorage
  `bb-build-board-v1`; library base-picks in `bb-build-board-picks-v1`.
  Both wrapped in try/catch — never let a storage failure break render.
- Filter chips / search / sort; the Library section renders all 64
  physicallybased entries as derived swatches (metalness tints the
  highlight, roughness broadens it — same derivation as materialSwatch.ts).
