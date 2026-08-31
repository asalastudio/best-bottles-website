# Material & Environment Audit — vs. the Agent Brief (2026-08-31)

Brief: "Material Registry & Scene Environment". Verdict per section, then
the gaps that were implemented.

## Already satisfied (and where the brief must yield)

**1. Registry.** Exists as DATA, stronger than the brief's TS module:
- `public/models/materials.json` — 16 closure/component materials, shared
  Blender↔browser, notes carry provenance
- `src/lib/materials/glassPresets.ts` — 5 colourways + `GLASS_BASE`
  (canonical measured glass from `data/materials/physicallybased-library.json`)
- `public/models/materials.lock.json` — sha256 of every renderer-loaded
  file + all shipping values; `material_lock.py verify` gates drift

⚠️ The brief's target values (gold #d4af6f r0.25, flint attenuation
#f0f4f0 @ 0.8, chrome r0.15) are generic defaults. Ours are measured
(physicallybased.info, CC0) and JORDAN-APPROVED/LOCKED. The brief's values
must not be adopted where a locked value exists.

**2. Environment.** Beyond the brief's single `<Environment>`:
three per-material-class environments (glass = laundered dark room,
plastics = soft tent, metals/glossy = panels-only laundered
studio_small_03) + per-colourway approved `envRotationDeg`. The brief's
suggested HDRIs were both evaluated and REJECTED with recorded reasons:
studio_small_08 (rig clutter corrupts cap reflections), brown_photostudio_02
(warm cast turns mirror silver sepia). Suspense ✓, ACES + exposure 0.91 ✓,
no zero envMapIntensity (11 sites checked) ✓.

**3. Blender export path.** Normals audit caught a real defect (roller
ball 100% inverted normals — `fix_inverted_normals.py` now exists).
Units contract ✓ (metres, closures manifest). Knurling: the dot caps use
real BB_CAP_DOTS geometry — better than a roughness map.
NOT done: baked AO (ContactShadows carries grounding; revisit if floors
tighten), roughness maps for machined ribbing (no such parts in family 1).

## Gaps implemented from this audit

**A. Scene wrapper** — `src/components/products/ProductStage.tsx`:
canvas config, tone mapping, off-frame room, sweep, contact shadows,
approved studio + rotation, quality tier — one reusable unit; product
meshes render as children. `STAGE` block consolidates the last inline
stage-surface values.

**B. Inline PBR stragglers** — sweep/shadow/backdrop values moved into
the `STAGE` registry; the neutral fallback grey remains only as the
explicit missing-material fallback.

**C. Perf constraints (per brief)** — PDP transmission resolution
1024→512 (the LAB keeps 1024 as the QA bench); lite tier (coarse pointer
or ≤640px) drops every glass to the plain MeshPhysicalMaterial path and
caps dpr at 1.5; closure materials memoized per registry name and shared
across all meshes/clones.

## Source assets needing re-export (brief deliverable 5)

None outstanding. The one defect found (inverted ball normals) was fixed
in place with tooling retained. AO baking is a future nicety, not a defect.
