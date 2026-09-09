# Studio rendering reconciliation — PR #69

This branch rebuilds the rendering delta from #69 onto main `0417a361`, after #117 and #110. It is a DRAFT, not approved for merge or publication. See inventory.json for the exact source commit and each of the 38 original files.

## What was preserved

- 23 original rendering file deltas were reconciled. BottleViewer's reset changes are already superseded by main's keyed state, so that file needs no resulting delta.
- Six coverage/data deltas and seven wholesale design deltas remain available as original patches in separate folders. These are historical snapshots, not current coverage claims.
- Two historical agent/configuration deltas are archived as patches, not installed as active instructions.
- Original PR #69 and its source branch remain intact. No force push or branch deletion.

## Conflict decisions

- package.json retains every current main script/dependency and adds only look:verify, look:lock, look:sheet. The lockfile is unchanged.
- MaterialLab preserves keyed bake measurements, picker-driven reset handling, and current imperative Three.js lint guards.
- BottleViewer retains main's keyed material and closure state; old reset logic was not reintroduced.
- Bottle3DViewer preserves current thickness/dispersion controls and uses preset.backsideThickness with the current thickness fallback.
- ProductStage retains current scene lifecycle handling and adopts managedEnv.
- StudioEnvironment memo dependencies use the new sigmaX and sigmaY inputs.

## Required before this draft can merge

1. Set up and verify the Blender color transform matching browser PBR Neutral, including exposure equivalence. The port changes global exposure from 0.91 to 1.0 and cannot inherit an ACES visual approval.
2. Render clear, amber, cobalt, frosted, and swirl examples in browser and Blender; inspect glass, metals, plastics, nozzle geometry, and solid-body interior behavior against approved references.
3. Resolve the historical opaque-white overcap override against the applicable exact product/reference before customer release. Preserve this as a rendering candidate, not a catalog metadata correction.
4. Record fresh visual approval. The inherited material lock passing only proves source-setting consistency; do not run look:lock to manufacture approval.
5. Review the contact-sheet script against current PDP selectors and ensure all five finishes render. The recovered script is historical tooling, not proof that the comparison has been performed.

## Validation

- material_lock.py verify: passed without rewriting the inherited lock.
- TypeScript: passed with current main's locked dependencies.
- Vitest: 1561 passed, 7 skipped.
- Changed rendering TypeScript lint: zero errors, eight warnings.
- Production Webpack build: pending at report creation.

Photographic plate and kit approvals, SKU records, Shopify/Convex data, and production releases are separate from this draft.
